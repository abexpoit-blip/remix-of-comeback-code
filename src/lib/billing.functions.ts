import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchIpv4 } from "@/lib/fetch-ipv4";
import { campaignPriceFor } from "@/lib/campaign";

/**
 * Create a Plisio invoice for the selected package and return the checkout URL.
 * Plisio API: https://plisio.net/documentation/endpoints/create-an-invoice
 */
export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ package_slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const apiKey = process.env.PLISIO_API_KEY;
    if (!apiKey) throw new Error("Plisio API key not configured");

    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("packages")
      .select("slug, name, price_usd")
      .eq("slug", data.package_slug)
      .eq("is_active", true)
      .single();
    if (pkgErr || !pkg) throw new Error("Package not found");
    if (Number(pkg.price_usd) <= 0) throw new Error("This package does not require payment");

    // NEW RULE: an active paid plan cannot be renewed/re-bought with the SAME package
    // until it expires. Users must upgrade to Lifetime or use a new account.
    const norm = (s?: string | null) => {
      const v = (s || "free").toLowerCase();
      if (v === "pro_monthly") return "monthly";
      if (v === "unlimited") return "lifetime";
      return v;
    };
    const { data: myProfile } = await supabaseAdmin
      .from("profiles")
      .select("plan_slug, plan_expires_at")
      .eq("id", context.userId)
      .maybeSingle();
    const currentPlan = norm(myProfile?.plan_slug);
    const expiresAt = (myProfile as any)?.plan_expires_at ? new Date((myProfile as any).plan_expires_at) : null;
    const stillActive = !!expiresAt && expiresAt.getTime() > Date.now();
    if (currentPlan === "lifetime") {
      throw new Error("You already have the Lifetime plan — no further purchase is needed.");
    }
    if (norm(pkg.slug) === currentPlan && stillActive) {
      const daysLeft = Math.ceil((expiresAt!.getTime() - Date.now()) / 86400000);
      throw new Error(
        `Your ${pkg.name} plan is still active (${daysLeft} day${daysLeft === 1 ? "" : "s"} left). The same package can only be purchased again after it expires. Upgrade to Lifetime, or use a new account for another ${pkg.name}.`
      );
    }


    // Limited-time campaign price (auto-reverts after the campaign window)
    const effectivePrice = campaignPriceFor(pkg.slug, Number(pkg.price_usd));
    // Add 2% network/processing fee so customer pays it ($5 -> $5.10, $35 -> $35.70)
    const chargeAmount = (effectivePrice * 1.02).toFixed(2);

    // M4 fix: prevent unbounded pending-invoice spam (Plisio API cost + DB bloat)
    const { count: pendingCount } = await supabaseAdmin
      .from("upgrade_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "pending");
    if ((pendingCount ?? 0) >= 3) {
      throw new Error("You already have 3 pending orders. Please complete or cancel one before creating a new invoice.");
    }

    // Create local order first
    const { data: req, error: reqErr } = await supabaseAdmin
      .from("upgrade_requests")
      .insert({
        user_id: context.userId,
        package_slug: pkg.slug,
        amount: Number(chargeAmount),
        status: "pending",
      })
      .select()
      .single();
    if (reqErr || !req) throw new Error("Failed to create order");

    // Build Plisio invoice
    const origin = "https://sleepox.com";
    const params = new URLSearchParams({
      api_key: apiKey,
      order_number: req.id,
      order_name: `${pkg.name} — Sleepox`,
      source_amount: chargeAmount,
      source_currency: "USD",
      callback_url: `${origin}/api/public/plisio-webhook?json=true`,
      success_callback_url: `${origin}/upgrade?payment=success`,
      fail_callback_url: `${origin}/upgrade?payment=failed`,
      email: "",
    });

    console.log("[plisio] requesting invoice for order", req.id, "amount", chargeAmount);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    let res: Response;
    let raw = "";
    try {
      res = await fetchIpv4(`https://api.plisio.net/api/v1/invoices/new?${params}`, { signal: ctrl.signal });
      raw = await res.text();
    } catch (e: any) {
      clearTimeout(timer);
      console.error("[plisio] fetch failed:", e?.message || e);
      await supabaseAdmin
        .from("upgrade_requests")
        .update({ status: "pending" } as any)
        .eq("id", req.id);
      throw new Error(`Payment gateway is slow right now. Please try again in a minute. If an invoice was created, it will appear in your order history automatically.`);
    }
    clearTimeout(timer);

    let json: any;
    try { json = JSON.parse(raw); } catch { json = null; }
    console.log("[plisio] http", res.status, "body", raw.slice(0, 500));

    if (!json || json.status !== "success" || !json.data?.invoice_url) {
      const msg =
        json?.data?.message ||
        json?.message ||
        json?.data?.name ||
        `HTTP ${res.status}: ${raw.slice(0, 200)}`;
      throw new Error(`Plisio error: ${msg}`);
    }

    // Plisio retired the `payplisio.net` invoice subdomain — it now returns
    // ERR_CONNECTION_TIMED_OUT in browsers. Their API still hands back the old
    // URL, so rewrite it to the working `plisio.net` host before we save or
    // return it. Path structure is identical.
    const rawInvoiceUrl: string = json.data.invoice_url;
    const invoiceUrl = rawInvoiceUrl.replace(/^https?:\/\/payplisio\.net\//i, "https://plisio.net/");

    const { error: updateErr } = await supabaseAdmin
      .from("upgrade_requests")
      .update({
        plisio_invoice_id: json.data.txn_id || null,
        plisio_invoice_url: invoiceUrl,
      })
      .eq("id", req.id);
    if (updateErr) {
      console.error("[plisio] failed to save invoice", req.id, updateErr.message);
      throw new Error("Invoice was created but could not be saved. Please contact support before paying.");
    }

    return { invoice_url: invoiceUrl };
  });


export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Auto-expire old pending requests (> 30 minutes)
    const expiryCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("upgrade_requests")
      .update({ status: "expired" } as any)
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .lt("created_at", expiryCutoff);

    const { data, error } = await context.supabase
      .from("upgrade_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data;
  });
