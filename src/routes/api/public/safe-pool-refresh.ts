import { createFileRoute } from "@tanstack/react-router";
import { forceHealthCheck, getSafePoolHealth } from "@/lib/safe-page-pool";

/**
 * Force-refresh the in-memory safe-pool health for THIS worker process.
 * Since we run 8 PM2 workers, call this endpoint 8+ times (curl loop) or
 * let least_conn Nginx distribute — best to hit it in a loop from cron.
 *
 * Auth: header `x-admin-secret` must match SAFE_POOL_ADMIN_SECRET env.
 * GET  = read current health (no refresh).
 * POST = force full re-check + return results.
 */
export const Route = createFileRoute("/api/public/safe-pool-refresh")({
  server: {
    handlers: {
      GET: async () => Response.json({ health: getSafePoolHealth() }),
      POST: async ({ request }) => {
        const secret = process.env.SAFE_POOL_ADMIN_SECRET || process.env.CRON_SECRET;
        const provided = request.headers.get("x-admin-secret");
        // Only enforce when a secret is actually configured. The endpoint just
        // clears an in-memory health cache — harmless without a secret set.
        if (secret && provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const results = await forceHealthCheck();
        return Response.json({ ok: true, results, at: new Date().toISOString() });
      },
    },
  },
});
