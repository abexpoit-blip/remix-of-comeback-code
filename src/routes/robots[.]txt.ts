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

// LEAK FIX #2: this block used to be byte-identical (same comment wording,
// same agent order) on every domain, which is itself a cross-domain
// fingerprint. Each host now gets a deterministic but different variant.
const SOCIAL_VARIANTS: string[] = [
  `
# Allow link-preview crawlers so shared pages render a proper card.
User-agent: facebookexternalhit
Allow: /

User-agent: meta-externalagent
Allow: /

User-agent: Twitterbot
Allow: /
`,
  `
User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: facebookcatalog
Allow: /
`,
  `
# Preview bots
User-agent: meta-externalagent
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: LinkedInBot
Allow: /

User-agent: Twitterbot
Allow: /
`,
  `
User-agent: facebookexternalhit
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: Slackbot-LinkExpanding
Allow: /
`,
];

function socialBlockFor(host: string): string {
  let n = 0;
  for (const ch of host) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return SOCIAL_VARIANTS[n % SOCIAL_VARIANTS.length];
}

const STORE_DISALLOW_VARIANTS: string[][] = [
  ["/cart", "/checkout", "/order-confirmed"],
  ["/checkout", "/cart"],
  ["/cart", "/order-confirmed"],
  ["/checkout", "/order-confirmed", "/cart"],
];

function storeDisallowFor(host: string): string {
  let n = 0;
  for (const ch of host) n = (n * 17 + ch.charCodeAt(0)) >>> 0;
  return STORE_DISALLOW_VARIANTS[n % STORE_DISALLOW_VARIANTS.length]
    .map((p) => `Disallow: ${p}`)
    .join("\n");
}


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

        const social = socialBlockFor(host);

        const body = saas
          ? `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /dashboard
Disallow: /control-panel
${social}
Sitemap: ${origin}/sitemap.xml
`
          : `User-agent: *
Allow: /
${storeDisallowFor(host)}
${social}
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
