// Dynamic sitemap.xml — lists every active short link as a clean URL
// (https://{host}/{code}, no /r/ prefix) so search engines index the
// prelanding pages users actually share. The list rebuilds on every
// request, so newly-created codes appear automatically — no manual
// regen needed.
//
// Host-aware: sleepox.com/sitemap.xml lists sleepox.com URLs,
// breezysocial.com/sitemap.xml lists breezysocial.com URLs. This matches
// Google's "same host" rule (a sitemap can only list URLs on the same
// host it's served from).
import { createFileRoute } from "@tanstack/react-router";
import { isSleepoxSaasHost } from "@/lib/site-hosts";

// Public marketing routes (indexable). Internal/auth routes stay
// excluded via robots.txt.
const SLEEPOX_PATHS: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "monthly", priority: "0.7" },
  { path: "/login", changefreq: "yearly", priority: "0.3" },
  { path: "/signup", changefreq: "yearly", priority: "0.3" },
];

const BREEZY_PATHS: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/shop", changefreq: "weekly", priority: "0.9" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/faq", changefreq: "monthly", priority: "0.6" },
  { path: "/size-guide", changefreq: "monthly", priority: "0.5" },
  { path: "/shipping", changefreq: "yearly", priority: "0.3" },
  { path: "/returns", changefreq: "yearly", priority: "0.3" },
];

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Build the public origin from forwarded headers so the
        // sitemap reflects the host the crawler actually hit (not the
        // upstream localhost behind nginx).
        const fwdHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "sleepox.com";
        const fwdProto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
        const origin = `${fwdProto}://${fwdHost.split(",")[0].trim()}`;

        // Only the SaaS host advertises SaaS pages. Every shortener /
        // custom domain gets the neutral content sitemap.
        const isSaasHost = isSleepoxSaasHost(fwdHost.split(",")[0].trim());
        const isBreezy = !isSaasHost;

        const urls: string[] = [];
        const STATIC_PATHS = isBreezy ? BREEZY_PATHS : SLEEPOX_PATHS;

        for (const s of STATIC_PATHS) {
          urls.push(
            [
              "  <url>",
              `    <loc>${xmlEscape(origin + s.path)}</loc>`,
              `    <changefreq>${s.changefreq}</changefreq>`,
              `    <priority>${s.priority}</priority>`,
              "  </url>",
            ].join("\n"),
          );
        }

        if (isBreezy) {
          // Static product + article catalog.
          //
          // NOTE: short codes are deliberately NOT listed here any more.
          // Publishing every active code let anyone (including ad-network
          // review crawlers) download the complete link inventory of the
          // domain in one request and bulk-scan it. Short links are shared
          // directly, they never needed sitemap discovery.
          const { PRODUCTS, ARTICLES } = await import("@/lib/breezy-data");
          for (const p of PRODUCTS) {
            urls.push(
              [
                "  <url>",
                `    <loc>${xmlEscape(`${origin}/shop/${p.slug}`)}</loc>`,
                "    <changefreq>monthly</changefreq>",
                "    <priority>0.7</priority>",
                "  </url>",
              ].join("\n"),
            );
          }
          for (const a of ARTICLES) {
            urls.push(
              [
                "  <url>",
                `    <loc>${xmlEscape(`${origin}/blog/${a.slug}`)}</loc>`,
                `    <lastmod>${a.date}</lastmod>`,
                "    <changefreq>monthly</changefreq>",
                "    <priority>0.6</priority>",
                "  </url>",
              ].join("\n"),
            );
          }
        }

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          status: 200,
          headers: {
            "content-type": "application/xml; charset=utf-8",
            // 15-min edge cache — new codes show up within 15 min,
            // Google re-fetches roughly daily anyway.
            "cache-control": "public, max-age=900, s-maxage=900",

          },
        });
      },
    },
  },
});
