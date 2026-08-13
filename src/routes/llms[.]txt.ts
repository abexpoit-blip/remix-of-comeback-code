// Host-aware llms.txt.
//
// LEAK FIX: the old static public/llms.txt was served on EVERY domain and
// literally described the product as "Bot-filtered short links built for
// Facebook & Instagram ad campaigns ... protect your ad accounts". Served
// from an ad domain that is a confession of cloaking and a direct cause of
// ad rejections. Content domains now publish a plain storefront summary;
// only the SaaS host describes the SaaS.
import { createFileRoute } from "@tanstack/react-router";
import { isSleepoxSaasHost } from "@/lib/site-hosts";
import { brandForOrigin } from "@/lib/brand-registry";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
          .split(",")[0]
          .trim()
          .toLowerCase();
        const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
        const origin = `${proto}://${host || "breezysocial.com"}`;
        const brand = brandForOrigin(origin);

        const body = isSleepoxSaasHost(host)
          ? `# Sleepox

> Smart link manager with real-time click analytics, geo and device routing.

## Pages

- [Home](/): Link management and analytics platform.
- [Pricing](/pricing): Plans for individuals and teams.
- [Sign up](/signup): Create an account.
`
          : `# ${brand.name}

> ${brand.tagline} Online store for sleep, focus, and travel gear. Free shipping over $50, 30-day returns.

## Pages

- [Home](/): Featured products and new arrivals.
- [Shop](/shop): Full product catalog.
- [Journal](/blog): Sleep, wellness, and travel articles.
- [About](/about): Our story and team.
- [Contact](/contact): Customer support — ${brand.email}.
- [FAQ](/faq): Shipping, returns, and warranty answers.
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
