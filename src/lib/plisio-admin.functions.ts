import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchIpv4 } from "@/lib/fetch-ipv4";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

async function applyPackageToProfile(userId: string, pkg: { slug: string; click_quota: number | null; link_limit: number | null }) {
  // Must stay in sync with applyPackageToProfile() in src/routes/api/public/plisio-webhook.ts
  const now = new Date();
  const resetAt = now.toISOString();
  const isLifetime = pkg.slug === "lifetime" || pkg.slug === "unlimited";

  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from("profiles")
    .select("plan_slug, plan_expires_at, click_quota, clicks_used")
    .eq("id", userId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);

  const currentExpiry = profile?.plan_expires_at ? new Date(profile.plan_expires_at).getTime() : null;
  const hasActiveSamePlan =
    pkg.slug !== "free" &&
    profile?.plan_slug === pkg.slug &&
    currentExpiry != null &&
    !Number.isNaN(currentExpiry) &&
    currentExpiry > now.getTime();

  const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
  const expiresAt = isLifetime
    ? null
    : hasActiveSamePlan
      ? new Date(currentExpiry + PERIOD_MS).toISOString()
      : new Date(now.getTime() + PERIOD_MS).toISOString();

  const stackedQuota =
    pkg.click_quota == null ? null : Number(profile?.click_quota ?? 0) + Number(pkg.click_quota);

  const { error } = await supabaseAdmin
    .from("profiles")
    .update((hasActiveSamePlan
      ? {
          plan_slug: pkg.slug,
          click_quota: stackedQuota,
          link_limit: pkg.link_limit,
          plan_expires_at: expiresAt,
        }
      : {
          plan_slug: pkg.slug,
          click_quota: pkg.click_quota,
          link_limit: pkg.link_limit,
          clicks_used: 0,
          clicks_period_start: resetAt,
          plan_started_at: resetAt,
          plan_expires_at: expiresAt,
        }) as any)
    .eq("id", userId);
  if (error) throw new Error(error.message);
}


export const adminListPlisioLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    
    // We try to fetch from plisio_event_logs, but if the table is missing or 
    // there are schema cache issues, we return an empty array instead of 
    // crashing the whole tab list.
    try {
      const { data: logs, error } = await supabaseAdmin
        .from("plisio_event_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
        
      if (error) {
        console.error("[plisio-admin] query error:", error.message);
        return [];
      }

      const typedLogs = (logs || []) as any[];

      // Fetch user emails for the logs that have an order_number
      const orderIds = Array.from(new Set(typedLogs
        .map(l => l.order_number)
        .filter((id): id is string => !!id && id.length > 20)));

      if (orderIds.length > 0) {
        const { data: requests } = await supabaseAdmin
          .from("upgrade_requests")
          .select("id, user_id")
          .in("id", orderIds);
        
        const userIds = Array.from(new Set((requests ?? []).map(r => r.user_id)));
        
        if (userIds.length > 0) {
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("id, email")
            .in("id", userIds);
            
          const emailMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.email]));
          const orderToUserMap = Object.fromEntries((requests ?? []).map(r => [r.id, r.user_id]));

          return typedLogs.map(l => ({
            ...l,
            user_email: l.order_number ? emailMap[orderToUserMap[l.order_number] || ""] : "Unknown"
          }));
        }
      }

      return typedLogs;
    } catch (e: any) {
      console.error("[plisio-admin] fatal log fetch error:", e.message);
      return [];
    }
  });

/**
 * Manually re-verify a single upgrade_request against the Plisio API and, if
 * Plisio reports the invoice as completed, mark it paid + upgrade the user's
 * package. Recovery path for orders where the webhook never fired.
 */
/**
 * Detect the outgoing public IP of the current server (the IP Plisio sees).
 * Cached for 5 minutes to avoid hammering ipify on every reverify call.
 */
let _cachedIp: { ip: string; at: number } | null = null;
export async function detectOutgoingIp(): Promise<string> {
  if (_cachedIp && Date.now() - _cachedIp.at < 5 * 60 * 1000) return _cachedIp.ip;
  try {
    const r = await fetchIpv4("https://api.ipify.org?format=json");
    const j: any = await r.json().catch(() => null);
    const ip = j?.ip || "unknown";
    _cachedIp = { ip, at: Date.now() };
    return ip;
  } catch {
    return "unknown";
  }
}

export const adminGetOutgoingIp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const ip = await detectOutgoingIp();
    return { ip, hint: "Whitelist this IP in your Plisio account → API → Allowed IPs" };
  });

export const adminReverifyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => d as { order_id: string })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const apiKey = process.env.PLISIO_API_KEY;
    if (!apiKey) throw new Error("Plisio API key not configured");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("upgrade_requests")
      .select("id, user_id, package_slug, status, plisio_invoice_id")
      .eq("id", data.order_id)
      .maybeSingle();
    if (reqErr || !req) throw new Error("Order not found");
    if (!req.plisio_invoice_id) throw new Error("No Plisio invoice id stored");

    const sourceIp = await detectOutgoingIp();
    const url = `https://api.plisio.net/api/v1/operations/${encodeURIComponent(req.plisio_invoice_id)}?api_key=${encodeURIComponent(apiKey)}`;
    const res = await fetchIpv4(url);
    const json: any = await res.json().catch(() => null);
    console.log(`[plisio-reverify] order=${req.id} src_ip=${sourceIp} http=${res.status} body=`, JSON.stringify(json));

    if (!json || json.status !== "success" || !json.data) {
      const plisioMsg = json?.data?.message || json?.message || `HTTP ${res.status}`;
      const plisioCode = json?.data?.code ?? json?.code ?? null;
      const err: any = new Error(
        `Plisio lookup failed: ${plisioMsg} (source IP: ${sourceIp}, HTTP ${res.status}${plisioCode ? `, code ${plisioCode}` : ""})`
      );
      err.source_ip = sourceIp;
      err.http_status = res.status;
      err.plisio_code = plisioCode;
      err.plisio_message = plisioMsg;
      throw err;
    }

    const plisioStatus = json.data.status as string;
    const isPaid = ["completed", "success", "finished", "mismatch"].includes(plisioStatus);
    const isFailed = ["expired", "cancelled", "error"].includes(plisioStatus);

    if (isPaid && req.status !== "paid") {
      const { data: pkg } = await supabaseAdmin
        .from("packages")
        .select("slug, click_quota, link_limit")
        .eq("slug", req.package_slug).single();
      if (pkg) {
        await applyPackageToProfile(req.user_id, pkg);
      }
      await supabaseAdmin.from("upgrade_requests")
        .update({ status: "paid" } as any).eq("id", req.id);
      return { ok: true, action: "upgraded", plisio_status: plisioStatus, source_ip: sourceIp, http_status: res.status };
    }
    if (isFailed && req.status !== "expired") {
      await supabaseAdmin.from("upgrade_requests")
        .update({ status: "expired" } as any).eq("id", req.id);
      return { ok: true, action: "marked_expired", plisio_status: plisioStatus, source_ip: sourceIp, http_status: res.status };
    }
    return { ok: true, action: "no_change", plisio_status: plisioStatus, db_status: req.status, source_ip: sourceIp, http_status: res.status };
  });

/**
 * Bulk re-verify recent non-paid orders against Plisio and recover any that
 * are actually completed. Use after deploying the prod DB fix.
 */
export const adminBulkReverify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const apiKey = process.env.PLISIO_API_KEY;
    if (!apiKey) throw new Error("Plisio API key not configured");

    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders } = await supabaseAdmin
      .from("upgrade_requests")
      .select("id, user_id, package_slug, status, plisio_invoice_id")
      .gte("created_at", since)
      .in("status", ["expired", "pending", "new", "underpaid", "mismatch"])
      .not("plisio_invoice_id", "is", null)
      .limit(100);

    const sourceIp = await detectOutgoingIp();
    let recovered = 0, checked = 0;
    let lastError: string | null = null;
    const details: any[] = [];

    for (const req of orders ?? []) {
      checked++;
      try {
        const res = await fetchIpv4(
          `https://api.plisio.net/api/v1/operations/${encodeURIComponent(req.plisio_invoice_id!)}?api_key=${encodeURIComponent(apiKey)}`,
        );
        const json: any = await res.json().catch(() => null);
        if (json?.status !== "success" || !json.data) {
          lastError = `${json?.data?.message || json?.message || `HTTP ${res.status}`} (code ${json?.data?.code ?? "?"})`;
          console.warn(`[bulk-reverify] ${req.id} src_ip=${sourceIp} http=${res.status} err=${lastError}`);
          continue;
        }
        const plisioStatus = json.data.status as string;
        if (!["completed", "success", "finished", "mismatch"].includes(plisioStatus)) continue;

        const { data: pkg } = await supabaseAdmin.from("packages")
          .select("slug, click_quota, link_limit").eq("slug", req.package_slug).single();
        if (pkg) {
          await applyPackageToProfile(req.user_id, pkg);
        }
        await supabaseAdmin.from("upgrade_requests")
          .update({ status: "paid" } as any).eq("id", req.id);
        recovered++;
        details.push({ order: req.id, user: req.user_id, slug: req.package_slug, plisio_status: plisioStatus });
      } catch (e: any) {
        lastError = e?.message || "unknown";
        console.error("[bulk-reverify] error", req.id, e?.message);
      }
    }
    return { checked, recovered, details, source_ip: sourceIp, last_error: lastError };
  });




