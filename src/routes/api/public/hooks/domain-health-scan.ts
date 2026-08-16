import { createFileRoute } from "@tanstack/react-router";
import { internalHostGuard, opsNotFound } from "@/lib/internal-endpoint";

/**
 * Daily cron entry point that scans every active monitored domain.
 *
 * Called by pg_cron with `apikey` header (project anon key); since
 * /api/public/* bypasses platform auth, we additionally verify the apikey
 * matches the project's publishable key before doing anything.
 */
export const Route = createFileRoute("/api/public/hooks/domain-health-scan")({
  server: {
    handlers: {
      GET: async () => opsNotFound(),
      POST: async ({ request }) => {
        const blocked = internalHostGuard(request);
        if (blocked) return blocked;

        const provided = request.headers.get("apikey") || "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || "";
        if (!provided || !expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { scanAllInternal } = await import("@/lib/domain-monitor.server");
          // Also prune history > 30 days
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.rpc("prune_domain_health_history" as any);

          const res = await scanAllInternal();
          return new Response(JSON.stringify({ ...res, at: new Date().toISOString() }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          console.error("[domain-health-scan] failed", e);
          return new Response(JSON.stringify({ ok: false, error: e?.message || "scan failed" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
