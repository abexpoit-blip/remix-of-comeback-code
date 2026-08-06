import { createFileRoute } from "@tanstack/react-router";

/**
 * Public health endpoint — GET /api/public/health
 *
 * Returns app + database connectivity status as JSON. No PII, no secrets:
 * only booleans, latency numbers and a coarse status string.
 *
 * status: "ok"       -> app up, DB reachable
 *         "degraded" -> app up, DB slow (> 1500ms)
 *         "error"    -> app up, DB unreachable (HTTP 503)
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();

        const env = {
          supabaseUrl: Boolean(process.env.SUPABASE_URL),
          supabaseKey: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
        };

        let db: {
          connected: boolean;
          latencyMs: number | null;
          error: string | null;
        } = { connected: false, latencyMs: null, error: null };

        if (!env.supabaseUrl || !env.supabaseKey) {
          db.error = "missing database environment variables";
        } else {
          const t0 = Date.now();
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const timeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("db ping timeout")), 5000),
            );
            const ping = supabaseAdmin
              .from("app_settings")
              .select("*", { count: "exact", head: true })
              .then((r) => r);

            const { error } = (await Promise.race([ping, timeout])) as { error: unknown };
            if (error) throw error;

            db = { connected: true, latencyMs: Date.now() - t0, error: null };
          } catch (e) {
            db = {
              connected: false,
              latencyMs: Date.now() - t0,
              error: e instanceof Error ? e.message : "database unreachable",
            };
          }
        }

        const status = !db.connected
          ? "error"
          : (db.latencyMs ?? 0) > 1500
            ? "degraded"
            : "ok";

        const body = {
          status,
          app: { ok: true, env },
          database: db,
          tookMs: Date.now() - startedAt,
          at: new Date().toISOString(),
        };

        return new Response(JSON.stringify(body), {
          status: status === "error" ? 503 : 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, max-age=0",
          },
        });
      },
    },
  },
});
