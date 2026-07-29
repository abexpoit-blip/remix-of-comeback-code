// Public endpoint that returns the EXACT prelanding HTML/OG tags that
// Facebook (or any social crawler) would see when scraping /r/{code}.
// Use this to verify og:url, og:image, canonical, title, description
// without spoofing a facebookexternalhit user-agent.
//
// Usage:
//   GET /api/public/preview-prelanding/{code}            → raw HTML
//   GET /api/public/preview-prelanding/{code}?format=json → JSON with parsed og tags + html
//   GET /api/public/preview-prelanding/{code}?host=breezysocial.com → override og:url host
import { createFileRoute } from "@tanstack/react-router";
import {
  ARTICLE_TEMPLATES,
  pickArticleTemplateForCode,
  renderPrelanding,
  type PrelandingTemplate,
} from "@/lib/prelanding-templates";

function extractTags(html: string) {
  const out: Record<string, string> = {};
  const metaRe = /<meta\s+[^>]*?(?:property|name)\s*=\s*["']([^"']+)["'][^>]*?content\s*=\s*["']([^"']*)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html))) out[m[1]] = m[2];
  const titleMatch = /<title>([^<]*)<\/title>/i.exec(html);
  if (titleMatch) out["title"] = titleMatch[1];
  const canonMatch = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html);
  if (canonMatch) out["canonical"] = canonMatch[1];
  return out;
}

export const Route = createFileRoute("/api/public/preview-prelanding/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const code = params.code;
        const url = new URL(request.url);
        const format = url.searchParams.get("format");
        const hostOverride = url.searchParams.get("host");
        const tplParam = url.searchParams.get("template");

        // Resolve origin for og:url/canonical. Default = public request origin
        // rebuilt from forwarded headers (request.url is the upstream localhost
        // URL behind nginx). hostOverride lets you simulate a different host.
        const fwdHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
        const fwdProto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
        let origin = fwdHost ? `${fwdProto}://${fwdHost.split(",")[0].trim()}` : url.origin;
        if (hostOverride) {
          const proto = hostOverride.startsWith("localhost") ? "http" : "https";
          origin = `${proto}://${hostOverride.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
        }


        // Look up the link's stored template (admin client — public endpoint,
        // returns only template name; no PII / no destination URL).
        let template: PrelandingTemplate;
        if (tplParam && ARTICLE_TEMPLATES.includes(tplParam as PrelandingTemplate)) {
          template = tplParam as PrelandingTemplate;
        } else {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await supabaseAdmin
              .from("links")
              .select("prelanding_template")
              .eq("short_code", code)
              .maybeSingle();
            const stored = (data?.prelanding_template as string | null) || "";
            template = ARTICLE_TEMPLATES.includes(stored as PrelandingTemplate)
              ? (stored as PrelandingTemplate)
              : pickArticleTemplateForCode(code);
          } catch {
            template = pickArticleTemplateForCode(code);
          }
        }

        const html = renderPrelanding(template, code, "", "fbbot", origin);

        if (format === "json") {
          const tags = extractTags(html);
          return Response.json({
            code,
            template,
            origin,
            canonicalMatches: tags["og:url"] === `${origin}/${code}`,
            tags,
            sizeBytes: html.length,
            html,
          }, {
            headers: { "cache-control": "no-store" },
          });
        }

        return new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-robots-tag": "noindex, nofollow",

          },
        });
      },
    },
  },
});
