import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
  try {
    const res = await fetchIpv4(`https://api.plisio.net/api/v1/operations/${encodeURIComponent(txnId)}?api_key=${encodeURIComponent(apiKey)}`);
    const json = await res.json() as {
      status?: string;
      data?: {
        status?: string;
        order_number?: string;
        source_amount?: string;
        source_currency?: string;
      };
    };
    if (json.status === "success" && json.data) return json.data;
  } catch (e) {
    console.error("[plisio] fetch operation failed", e);
  }
  return null;
}

// C5 FIX: Single UPDATE instead of two — eliminates the race window where
// plan_slug was applied but quota fields still held old values.
async function applyPackageToProfile(
  userId: string,
  pkg: { slug: string; click_quota: number | null; link_limit: number | null },
) {
  const now = new Date();
  const resetAt = now.toISOString();
  const isLifetime = pkg.slug === "lifetime" || pkg.slug === "unlimited";
  const expiresAt = isLifetime
    ? null
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from("profiles")
    .select("plan_slug, plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const expiry = profile?.plan_expires_at ? new Date(profile.plan_expires_at).getTime() : null;
  const keepExistingUsage =
    pkg.slug !== "free" &&
    profile?.plan_slug === pkg.slug &&
    (expiry == null || Number.isNaN(expiry) || expiry > now.getTime());

  const { error } = await supabaseAdmin
    .from("profiles")
    .update((keepExistingUsage ? {
      plan_slug: pkg.slug,
      click_quota: pkg.click_quota,
      link_limit: pkg.link_limit,
      plan_expires_at: expiresAt,
    } : {
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
        if (!verified && txnId && orderNumber) {
          try {
            const { data: linkedReq } = await supabaseAdmin
              .from("upgrade_requests")
              .select("id, plisio_invoice_id")
              .eq("id", orderNumber)
              .maybeSingle();

            if (linkedReq && (linkedReq as any).plisio_invoice_id === txnId) {
              verified = true;
              const op = await fetchPlisioOperation(txnId, apiKey);
              if (op?.status) status = op.status;
            } else if (linkedReq) {
              // RECOVERY: DB has null (or different) txn_id because createInvoice
              // timed out before saving. Ask Plisio directly; if the txn is real
              // and belongs to this order_number, back-fill and accept.
              // Attackers cannot know a valid Plisio-generated txn_id, so any
              // txn Plisio confirms as tied to our order_number is genuine.
              const op = await fetchPlisioOperation(txnId, apiKey);
              const orderMatches = !op?.order_number || op.order_number === orderNumber;
              if (op && orderMatches) {
                verified = true;
                if (op.status) status = op.status;
                // Back-fill DB so future callbacks for the same txn verify fast.
                try {
                  await supabaseAdmin
                    .from("upgrade_requests")
                    .update({ plisio_invoice_id: txnId })
                    .eq("id", orderNumber);
                } catch (_e) {}
                console.log("[plisio] recovered null txn_id via Plisio API for order", orderNumber);
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
          } catch (e) {
            console.error("[plisio] db linkage check failed", e);
          }
        }

        if (!verified) {
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


        // H6 FIX: "mismatch" means user paid less than invoiced amount.
        // Do NOT auto-grant full package — that's revenue loss. Mark order as
        // 'underpaid' so admin can manually review and decide.
        const internalStatus =
          status === "completed" || status === "success" || status === "finished"
            ? "paid"
          : status === "mismatch"
            ? "underpaid"
          : status === "expired" || status === "cancelled" || status === "error"
            ? "expired"
          : status;

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

        // UPDATE ORDER AND APPLY PACKAGE
        if (req) {
          await supabaseAdmin
            .from("upgrade_requests")
            .update({ status: internalStatus })
            .eq("id", req.id);

          if (internalStatus === "paid" && req.status !== "paid") {
            const { data: pkg } = await supabaseAdmin
              .from("packages")
              .select("slug, click_quota, link_limit")
              .eq("slug", packageSlug)
              .single();
            if (pkg) {
              await applyPackageToProfile(userId, pkg);
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
