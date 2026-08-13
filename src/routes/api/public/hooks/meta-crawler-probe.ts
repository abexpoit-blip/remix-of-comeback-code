import { fetchIpv4 } from "@/lib/fetch-ipv4";
// Meta crawler probe — runs on a cron schedule.
// For each target domain we serve short links from, we fetch a canary URL
// (root + newest short code) with each Meta / Facebook crawler UA. If the
// response is 403 or 5xx, we record an entry in public.error_logs with
// source="meta_crawler_block" so admins see it in Control Panel → Errors.
//
// WHY: our own worker ALWAYS serves 200 OK to Meta crawlers (see r.$code.ts
// step 0). A 403/5xx therefore means an UPSTREAM proxy (Cloudflare WAF,
// Bot Fight Mode, Rate Limiting, registrar block, DNS/SSL failure) is
// hiding the safe page from Meta — which causes ad rejections.

import { createFileRoute } from "@tanstack/react-router";

const META_UAS = [
  {
    label: "facebookexternalhit",
    ua: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  },
  {
    label: "meta-externalagent",
    ua: "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
  },
  {
    label: "Meta-ExternalFetcher",
    ua: "Meta-ExternalFetcher/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
  },
];

// Domains we advertise on Facebook / Meta. Keep this list in sync with
// src/lib/short-domains.ts and the primary app host.
const TARGET_DOMAINS = [
  "breezysocial.com",
  "skypq.com",
  "mefok.com",
  "sleepox.com",
  "www.sleepox.com",
];

const FETCH_TIMEOUT_MS = 8000;

async function probeOnce(url: string, ua: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetchIpv4(url, {
      method: "GET",
      headers: {
        "User-Agent": ua,
        Accept: "text/html,*/*",
      },
      redirect: "manual",
      signal: ctrl.signal,
    });
    return {
      status: res.status,
      elapsedMs: Date.now() - startedAt,
      server: res.headers.get("server"),
      cfRay: res.headers.get("cf-ray"),
      location: res.headers.get("location"),
      error: null as string | null,
    };
  } catch (err) {
    return {
      status: 0,
      elapsedMs: Date.now() - startedAt,
      server: null,
      cfRay: null,
      location: null,
      error: (err as Error)?.message ?? "fetch failed",
    };
  } finally {
    clearTimeout(t);
  }
}

export const Route = createFileRoute("/api/public/hooks/meta-crawler-probe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: standard `apikey` header pattern used by pg_cron.
        // Accept any of the common env var names so this works on both
        // Lovable Cloud and self-hosted VPS deploys.
        const anonCandidates = [
          process.env.SUPABASE_PUBLISHABLE_KEY,
          process.env.SUPABASE_ANON_KEY,
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          process.env.VITE_SUPABASE_ANON_KEY,
        ].filter((v): v is string => Boolean(v && v.length > 20));

        const providedApiKey = request.headers.get("apikey") ?? "";
        const providedBearer =
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        const provided = providedApiKey || providedBearer;

        const ok =
          anonCandidates.length > 0 &&
          anonCandidates.some((k) => k === provided);

        if (!ok) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Pull the newest active short code so we also probe a real link path,
        // not just the domain root. Best-effort — probe still runs without it.
        let sampleCode: string | null = null;
        try {
          const { data } = await supabaseAdmin
            .from("links")
            .select("short_code")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          sampleCode =
            (data as { short_code?: string } | null)?.short_code ?? null;
        } catch {
          // ignore — we'll still probe "/"
        }

        type Row = {
          domain: string;
          path: string;
          ua_label: string;
          status: number;
          error: string | null;
          server: string | null;
          cf_ray: string | null;
          location: string | null;
          elapsed_ms: number;
        };

        const results: Row[] = [];
        const blocks: Row[] = [];

        const paths = ["/"];
        if (sampleCode) paths.push(`/${sampleCode}`);

        for (const domain of TARGET_DOMAINS) {
          for (const path of paths) {
            const url = `https://${domain}${path}`;
            for (const { label, ua } of META_UAS) {
              const r = await probeOnce(url, ua);
              const row: Row = {
                domain,
                path,
                ua_label: label,
                status: r.status,
                error: r.error,
                server: r.server,
                cf_ray: r.cfRay,
                location: r.location,
                elapsed_ms: r.elapsedMs,
              };
              results.push(row);
              // A block = 403 (WAF / Cloudflare Bot Fight) OR any 5xx OR
              // network error. 200/301/302 are all healthy for Meta.
              const isBlock =
                r.status === 403 ||
                (r.status >= 500 && r.status <= 599) ||
                r.status === 0;
              if (isBlock) blocks.push(row);
            }
          }
        }

        // Record every block as an error_logs row. Admin panel already lists
        // errors by source with a dropdown filter — pick "meta_crawler_block".
        if (blocks.length > 0) {
          const inserts = blocks.map((b) => ({
            source: "meta_crawler_block",
            level: b.status >= 500 || b.status === 0 ? "error" : "warn",
            message:
              b.status === 0
                ? `${b.ua_label} → ${b.domain}${b.path}: network error (${b.error ?? "unknown"})`
                : `${b.ua_label} blocked on ${b.domain}${b.path} (HTTP ${b.status})`,
            context: {
              domain: b.domain,
              path: b.path,
              url: `https://${b.domain}${b.path}`,
              ua_label: b.ua_label,
              status: b.status,
              error: b.error,
              server: b.server,
              cf_ray: b.cf_ray,
              location: b.location,
              elapsed_ms: b.elapsed_ms,
              likely_cause:
                b.status === 403
                  ? "Cloudflare WAF / Bot Fight Mode blocking Meta UA. Fix: add WAF skip rule or set DNS to Grey Cloud."
                  : b.status >= 500
                    ? "Origin/edge server returned 5xx. Check Nginx + workers on the VPS."
                    : "Network unreachable. Check DNS, SSL cert, and origin availability.",
            },
          }));
          try {
            await (
              supabaseAdmin.from as unknown as (t: string) => {
                insert: (r: Record<string, unknown>[]) => Promise<unknown>;
              }
            )("error_logs").insert(inserts);
          } catch (e) {
            console.error("[meta-crawler-probe] failed to insert error_logs", e);
          }
        }

        return Response.json({
          ok: true,
          probed: results.length,
          blocked: blocks.length,
          checked_at: new Date().toISOString(),
          sample_code: sampleCode,
          blocks: blocks.map((b) => ({
            domain: b.domain,
            path: b.path,
            ua: b.ua_label,
            status: b.status,
          })),
        });
      },
    },
  },
});
