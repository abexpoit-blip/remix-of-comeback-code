// Smart Brain leak sweep — cron entry point.
// POST with the project apikey header (same pattern as meta-crawler-probe).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/leak-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const keys = [
          process.env.SUPABASE_PUBLISHABLE_KEY,
          process.env.SUPABASE_ANON_KEY,
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          process.env.VITE_SUPABASE_ANON_KEY,
        ].filter((v): v is string => Boolean(v && v.length > 20));

        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";

        if (keys.length === 0 || !keys.some((k) => k === provided)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const domains = new Set<string>(["breezysocial.com", "skypq.com", "mefok.com"]);
        try {
          const { data } = await supabaseAdmin
            .from("custom_domains")
            .select("domain")
            .eq("verified", true)
            .limit(50);
          for (const row of (data as { domain?: string }[] | null) ?? []) {
            const d = (row.domain || "").trim().toLowerCase();
            if (d) domains.add(d);
          }
        } catch {
          /* built-ins are enough */
        }

        const { runLeakSweep } = await import("@/lib/leak-monitor.server");
        const report = await runLeakSweep([...domains]);

        return new Response(JSON.stringify(report), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
