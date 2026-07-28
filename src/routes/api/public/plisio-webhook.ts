import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { fetchIpv4 } from "@/lib/fetch-ipv4";

/**
 * Plisio callback verification (form-encoded hash).
 */
function verifyFormHash(body: Record<string, string>, apiKey: string): boolean {
  const verifyHash = body.verify_hash;
  if (!verifyHash) return false;
  const clone = { ...body };
  delete clone.verify_hash;
  const ordered = Object.keys(clone).sort().map((k) => clone[k]).join(":");
  const payload = `${ordered}:${apiKey}`;

  // Plisio currently sends a 40-char SHA-1 verify_hash for invoice IPNs.
  // Keep MD5 too so older/test callbacks still verify if they use the legacy
  // 32-char format.
  const expectedSha1 = createHash("sha1").update(payload).digest("hex");
  const expectedMd5 = createHash("md5").update(payload).digest("hex");
  return verifyHash === expectedSha1 || verifyHash === expectedMd5;
}

async function fetchPlisioOperation(txnId: string, apiKey: string) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), 90000);
    const res = await fetchIpv4(
      `https://api.plisio.net/api/v1/operations/${encodeURIComponent(txnId)}?api_key=${encodeURIComponent(apiKey)}`,
      { signal: ctrl.signal },
    );
    clearTimeout(timer);
    timer = null;
    const json = await res.json() as {
      status?: string;
      message?: string;
      data?: {
        status?: string;
        order_number?: string;
        source_amount?: string;
        source_currency?: string;
        amount?: string;
        actual_sum?: string;
        pending_amount?: string;
        invoice_sum?: string;
        invoice_total_sum?: string;
      };
    };

    if (json.status === "success" && json.data) return json.data;
    console.warn("[plisio] operation lookup rejected", {
      txnId,
      http: res.status,
      status: json?.status,
      message: json?.message || (json?.data as any)?.message || null,
    });
  } catch (e) {
    console.error("[plisio] fetch operation failed", e);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return null;
}

// C5 FIX: Single UPDATE instead of two — eliminates the race window where
// plan_slug was applied but quota fields still held old values.
async function applyPackageToProfile(
  supabaseAdmin: any,
  userId: string,
  pkg: { slug: string; click_quota: number | null; link_limit: number | null },
) {
  const now = new Date();
  const resetAt = now.toISOString();
  const isLifetime = pkg.slug === "lifetime" || pkg.slug === "unlimited";

  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from("profiles")
    .select("plan_slug, plan_expires_at, click_quota, clicks_used")
    .eq("id", userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const currentExpiry = profile?.plan_expires_at ? new Date(profile.plan_expires_at).getTime() : null;
  const hasActiveSamePlan =
    pkg.slug !== "free" &&
    profile?.plan_slug === pkg.slug &&
    currentExpiry != null &&
    !Number.isNaN(currentExpiry) &&
    currentExpiry > now.getTime();

  // Renewal (same active plan, still valid): STACK — 30 more days AND the package's
  // click allowance is ADDED on top of the current quota (usage counter untouched,
  // so remaining clicks carry over instead of being lost).
  // New purchase / plan switch / expired plan: fresh period, fresh quota, usage reset.
  const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
  const expiresAt = isLifetime
    ? null
    : hasActiveSamePlan
      ? new Date(currentExpiry + PERIOD_MS).toISOString()
      : new Date(now.getTime() + PERIOD_MS).toISOString();

  const stackedQuota =
    pkg.click_quota == null
      ? null
      : Number(profile?.click_quota ?? 0) + Number(pkg.click_quota);

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
  if (error) throw error;
}


export const Route = createFileRoute("/api/public/plisio-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.PLISIO_API_KEY;
        if (!apiKey) {
          console.error("[plisio] PLISIO_API_KEY missing");
          return new Response("not configured", { status: 500 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const rawText = await request.text();
        const body: Record<string, string> = {};
        let isJson = false;

        if (rawText.trim().startsWith("{")) {
          isJson = true;
          try {
            const j = JSON.parse(rawText);
            for (const k of Object.keys(j)) {
              body[k] = typeof j[k] === "string" ? j[k] : JSON.stringify(j[k]);
            }
          } catch (e) {
            console.error("[plisio] JSON parse failed", e);
            return new Response("bad json", { status: 400 });
          }
        } else {
          const params = new URLSearchParams(rawText);
          params.forEach((v, k) => { body[k] = v; });
        }

        const txnId = body.txn_id || body.id;
        const orderNumber = body.order_number;
        let status = body.status;

        // C4 FIX: VERIFY FIRST, log only after verification succeeds.
        // Previously raw_body was logged before any signature check, letting
        // anyone spam plisio_event_logs.
        let verified = false;

        if (!isJson) {
          // Form-encoded path: HMAC verify with shared secret.
          verified = verifyFormHash(body, apiKey);
        }
        const hashVerified = verified;

        // For JSON payloads (or when form-hash fails), verify against our own
        // DB linkage: we created the invoice with plisio_invoice_id = txn_id
        // and order_number = upgrade_requests.id. If both match in our DB, the
        // callback is genuine (attacker cannot forge a (txnId, orderNumber)
        // pair without knowing our stored linkage).
        //
        // We also still cross-check with Plisio API for the actual status, but
        // do NOT require op.order_number to match (Plisio's operations endpoint
        // sometimes returns it as null/missing — that was the source of the
        // false "mismatch" rejections that lost real payments).
        let verificationTemporarilyUnavailable = false;
        let opInfo: Record<string, unknown> | null = null;

        if (!verified && txnId && orderNumber) {
          try {
            const { data: linkedReq } = await supabaseAdmin
              .from("upgrade_requests")
              .select("id, plisio_invoice_id")
              .eq("id", orderNumber)
              .maybeSingle();

            if (linkedReq && (linkedReq as any).plisio_invoice_id === txnId) {
              const op = await fetchPlisioOperation(txnId, apiKey); opInfo = op ?? opInfo;
              const incomingStatus = String(status || "").toLowerCase();
              const isPaidLike = ["completed", "success", "finished", "mismatch"].includes(incomingStatus);
              if (op?.status) {
                verified = true;
                status = op.status;
              } else if (hashVerified || !isPaidLike) {
                verified = true;
              } else {
                verificationTemporarilyUnavailable = true;
                console.warn("[plisio] paid callback verification delayed — stored txn but Plisio lookup unavailable", { txnId, orderNumber, status });
              }
            } else if (linkedReq) {
              // RECOVERY: DB has null (or different) txn_id because createInvoice
              // timed out before saving. Ask Plisio directly; if the txn is real
              // and belongs to this order_number, back-fill and accept.
              // Attackers cannot know a valid Plisio-generated txn_id, so any
              // txn Plisio confirms as tied to our order_number is genuine.
              const incomingStatus = String(status || "").toLowerCase();
              const isPaidLike = ["completed", "success", "finished", "mismatch"].includes(incomingStatus);
              const hasStoredTxn = Boolean((linkedReq as any).plisio_invoice_id);

              // Non-paid lifecycle callbacks (new/expired/cancelled/error) do not
              // grant packages, so accept them for an existing local order even if
              // invoice save previously failed. Paid callbacks still require a
              // live Plisio lookup before package activation.
              if (!hasStoredTxn && !isPaidLike) {
                verified = true;
                try {
                  await supabaseAdmin
                    .from("upgrade_requests")
                    .update({
                      plisio_invoice_id: txnId,
                      plisio_invoice_url: `https://plisio.net/invoice/${encodeURIComponent(txnId)}`,
                    })
                    .eq("id", orderNumber)
                    .is("plisio_invoice_id", null);
                } catch (_e) {}
                console.log("[plisio] accepted non-paid callback for unsaved txn", { txnId, orderNumber, status });
              } else {
                const op = await fetchPlisioOperation(txnId, apiKey); opInfo = op ?? opInfo;
                const orderMatches = !op?.order_number || op.order_number === orderNumber;
                if (op && orderMatches) {
                  verified = true;
                  if (op.status) status = op.status;
                  // Back-fill DB so future callbacks for the same txn verify fast.
                  try {
                    await supabaseAdmin
                      .from("upgrade_requests")
                      .update({
                        plisio_invoice_id: txnId,
                        plisio_invoice_url: `https://plisio.net/invoice/${encodeURIComponent(txnId)}`,
                      })
                      .eq("id", orderNumber);
                  } catch (_e) {}
                  console.log("[plisio] recovered null txn_id via Plisio API for order", orderNumber);
                } else if (isPaidLike && !op) {
                  verificationTemporarilyUnavailable = true;
                  if (!hasStoredTxn) {
                    try {
                      await supabaseAdmin
                        .from("upgrade_requests")
                        .update({
                          plisio_invoice_id: txnId,
                          plisio_invoice_url: `https://plisio.net/invoice/${encodeURIComponent(txnId)}`,
                        })
                        .eq("id", orderNumber)
                        .is("plisio_invoice_id", null);
                    } catch (_e) {}
                  }
                  console.warn("[plisio] paid callback verification delayed — Plisio lookup unavailable", { txnId, orderNumber, status });
                } else {
                  console.warn(
                    "[plisio] txn_id mismatch — callback claims",
                    txnId,
                    "for order",
                    orderNumber,
                    "but DB has",
                    (linkedReq as any).plisio_invoice_id,
                  );
                }
              }
            }
          } catch (e) {
            console.error("[plisio] db linkage check failed", e);
          }
        }

        if (!verified) {
          if (verificationTemporarilyUnavailable) {
            return new Response("verification temporarily unavailable", { status: 503 });
          }
          console.warn("[plisio] verification failed", { txnId, orderNumber, status });
          return new Response("invalid signature", { status: 401 });
        }

        // Now safe to log the verified event.
        // L4 FIX: capture the inserted row id so the later processed_at update
        // targets *this* log row, not every prior pending/completed row that
        // happens to share the same txn_id.
        let logRowId: string | null = null;
        try {
          const { data: inserted } = await supabaseAdmin
            .from("plisio_event_logs")
            .insert({
              txn_id: txnId,
              order_number: orderNumber,
              status: status,
              raw_body: body,
            })
            .select("id")
            .single();
          logRowId = (inserted as any)?.id ?? null;
        } catch (logErr) {
          console.error("[plisio] logging failed", logErr);
        }


        // "mismatch" = paid amount differs from the invoiced amount. Plisio uses
        // it for BOTH underpayment and OVERpayment.
        //   - Overpaid / exact-with-rounding  -> treat as fully PAID (auto-activate)
        //   - Genuinely underpaid             -> 'underpaid' (admin review)
        const mismatchOutcome = (): "paid" | "underpaid" => {
          const src: Record<string, unknown> = { ...body, ...(opInfo ?? {}) };
          const num = (v: unknown) => {
            const n = Number(String(v ?? "").trim());
            return Number.isFinite(n) ? n : null;
          };

          // 1) Plisio tells us what is still owed. <= 0 means nothing pending.
          const pending = num(src.pending_amount) ?? num(src.pending_sum);
          if (pending != null && pending <= 0) return "paid";

          // 2) Compare received crypto vs invoiced total (0.5% rounding tolerance).
          const received = num(src.actual_sum) ?? num(src.amount);
          const expected = num(src.invoice_total_sum) ?? num(src.invoice_sum);
          if (received != null && expected != null && expected > 0) {
            return received >= expected * 0.995 ? "paid" : "underpaid";
          }

          // 3) No usable amounts -> stay safe, admin reviews.
          return "underpaid";
        };

        let internalStatus =
          status === "completed" || status === "success" || status === "finished"
            ? "paid"
          : status === "mismatch"
            ? mismatchOutcome()
          : status === "new" || status === "pending"
            ? "pending"
          : status === "expired" || status === "cancelled" || status === "error"
            ? "expired"
          : status;

        if (status === "mismatch") {
          console.log("[plisio] mismatch resolved as", internalStatus, {
            txnId,
            orderNumber,
            pending_amount: body.pending_amount ?? (opInfo as any)?.pending_amount ?? null,
            amount: body.amount ?? null,
            invoice_total_sum: body.invoice_total_sum ?? null,
            source_amount: body.source_amount ?? (opInfo as any)?.source_amount ?? null,
          });
        }


        // FIND ORDER (with recovery from previous logs)
        let userId = "";
        let packageSlug = "";

        let req: any = null;
        try {
          const { data } = await supabaseAdmin
            .from("upgrade_requests")
            .select("id, user_id, package_slug, status")
            .eq("id", orderNumber)
            .maybeSingle();
          req = data;
        } catch (e) {
          console.error("[plisio] upgrade_requests query failed", e);
        }

        if (!req) {
          console.warn("[plisio] recovery: order missing from DB", { txnId, orderNumber });
          let previousLog: any = null;
          try {
            const { data } = await supabaseAdmin
              .from("plisio_event_logs")
              .select("order_number")
              .eq("txn_id", txnId)
              .not("order_number", "is", null)
              .maybeSingle();
            previousLog = data;
          } catch (_e) {}

          const recoveryId = orderNumber || previousLog?.order_number;
          if (recoveryId) {
            const { data: recoveredReq } = await supabaseAdmin
              .from("upgrade_requests")
              .select("id, user_id, package_slug, status")
              .eq("id", recoveryId)
              .maybeSingle();
            if (recoveredReq) {
              req = recoveredReq;
              userId = req.user_id;
              packageSlug = req.package_slug;
              console.log("[plisio] recovered order for user", userId);
            }
          }
        } else {
          userId = req.user_id;
          packageSlug = req.package_slug;
        }

        // FIAT SAFETY NET: crypto amounts were unusable, but Plisio reports the
        // fiat value actually received. If that covers the package price (2%
        // tolerance for FX drift), the user paid in full — activate.
        if (internalStatus === "underpaid" && req?.package_slug) {
          const paidUsd = Number(
            String((opInfo as any)?.source_amount ?? body.source_amount ?? "").trim(),
          );
          const currency = String((opInfo as any)?.source_currency ?? body.source_currency ?? "USD").toUpperCase();
          if (Number.isFinite(paidUsd) && paidUsd > 0 && currency === "USD") {
            const { data: pk } = await supabaseAdmin
              .from("packages")
              .select("price_usd")
              .eq("slug", req.package_slug)
              .maybeSingle();
            const price = Number((pk as any)?.price_usd ?? 0);
            if (price > 0 && paidUsd >= price * 0.98) {
              internalStatus = "paid";
              console.log("[plisio] underpaid overridden to paid by fiat check", {
                orderNumber, paidUsd, price,
              });
            }
          }
        }

        // UPDATE ORDER AND APPLY PACKAGE
        if (req) {

          const currentStatus = String(req.status || "").toLowerCase();
          const shouldUpdateOrderStatus =
            !(currentStatus === "paid" && internalStatus !== "paid") &&
            !(currentStatus === "underpaid" && internalStatus !== "paid" && internalStatus !== "underpaid");

          if (shouldUpdateOrderStatus) {
            await supabaseAdmin
              .from("upgrade_requests")
              .update({ status: internalStatus })
              .eq("id", req.id);
          }

          if (internalStatus === "paid" && req.status !== "paid") {
            const { data: pkg } = await supabaseAdmin
              .from("packages")
              .select("slug, click_quota, link_limit")
              .eq("slug", packageSlug)
              .single();
            if (pkg) {
              await applyPackageToProfile(supabaseAdmin, userId, pkg);
              if (logRowId) {
                try {
                  await supabaseAdmin
                    .from("plisio_event_logs")
                    .update({ processed_at: new Date().toISOString() })
                    .eq("id", logRowId);
                } catch (_e) {}
              }
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});
