// Host-aware robots.txt.
//
// LEAK FIX: the old static public/robots.txt was served on EVERY host and
// contained `Disallow: /dashboard` + `/admin/`. On an ad domain that is a
// direct tell that a SaaS dashboard lives behind the storefront, which is
// exactly the footprint Meta/Google reviewers look for. Only the real SaaS
// host advertises those paths now; content domains get a plain storefront
// robots file.
import { createFileRoute } from "@tanstack/react-router";
import { isSleepoxSaasHost } from "@/lib/site-hosts";

const SOCIAL_ALLOW = `
# Social / link preview crawlers must always be allowed, otherwise
# Facebook cannot read the OG tags of shared pages.
User-agent: facebookexternalhit
Allow: /

User-agent: facebookcatalog
Allow: /

User-agent: meta-externalagent
Allow: /

User-agent: Twitterbot
Allow: /
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
          .split(",")[0]
          .trim()
          .toLowerCase();
        const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
        const origin = `${proto}://${host || "breezysocial.com"}`;

        const saas = isSleepoxSaasHost(host);

        const body = saas
          ? `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /dashboard
Disallow: /control-panel
${SOCIAL_ALLOW}
Sitemap: ${origin}/sitemap.xml
`
          : `User-agent: *
Allow: /
Disallow: /cart
Disallow: /checkout
Disallow: /order-confirmed
${SOCIAL_ALLOW}
Sitemap: ${origin}/sitemap.xml
`;

        return new Response(body, {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=900",
          },
        });
      },
    },
  },
});
