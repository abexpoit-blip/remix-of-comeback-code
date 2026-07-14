import { createFileRoute } from "@tanstack/react-router";
import { getHost, variantFromHost } from "@/lib/host";
import { SleepoxHome } from "@/components/sleepox-home";
import { BreezyHome } from "@/components/breezy/BreezyHome";

/**
 * Host-aware homepage:
 *   sleepox.com         → Sleepox SaaS landing (existing)
 *   breezysocial.com    → BreezySocial gadget storefront (new)
 *
 * Host is detected SSR-side (request headers) so Facebook/Twitter/Google
 * crawlers — which don't execute JS — receive the correct HTML on first
 * fetch. This matters: a "real ecommerce" landing page is the trust signal
 * that keeps /r/{code} links from being flagged.
 */
export const Route = createFileRoute("/")({
  loader: () => {
    const host = getHost();
    return { host, variant: variantFromHost(host) };
  },
  head: ({ loaderData }) => {
    if (loaderData?.variant === "breezysocial") {
      return {
        meta: [
          { title: "BreezySocial — Smart Gadgets for Calm, Modern Living" },
          {
            name: "description",
            content:
              "Thoughtfully designed tools for better sleep, sharper focus, and easier travel. Free shipping over $50. 30-day returns.",
          },
          { property: "og:title", content: "BreezySocial — Smart Gadgets for Calm, Modern Living" },
          { property: "og:description", content: "Curated sleep, wellness, and travel gadgets. Free shipping over $50." },
          { property: "og:type", content: "website" },
          { property: "og:url", content: "https://breezysocial.com/" },
          { property: "og:image", content: "https://breezysocial.com/og-default.png" },
          { property: "og:image:width", content: "1200" },
          { property: "og:image:height", content: "630" },
          { name: "twitter:card", content: "summary_large_image" },
          { name: "twitter:title", content: "BreezySocial — Smart Gadgets for Calm, Modern Living" },
          { name: "twitter:description", content: "Curated sleep, wellness, and travel gadgets. Free shipping over $50." },
          { name: "twitter:image", content: "https://breezysocial.com/og-default.png" },
        ],
        links: [
          { rel: "canonical", href: "https://breezysocial.com/" },
          { rel: "preconnect", href: "https://fonts.googleapis.com" },
          { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
          {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap",
          },
        ],
        scripts: [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "BreezySocial",
              url: "https://breezysocial.com",
              logo: "https://breezysocial.com/favicon.svg",
              email: "hello@breezysocial.com",
              address: {
                "@type": "PostalAddress",
                streetAddress: "1280 Market Street, Suite 400",
                addressLocality: "San Francisco",
                addressRegion: "CA",
                postalCode: "94102",
                addressCountry: "US",
              },
              foundingDate: "2019",
              sameAs: [],
            }),
          },
        ],
      };
    }
    return {
      meta: [
        { title: "Sleepox — Smart Link Manager & Real-Time Analytics" },
        {
          name: "description",
          content:
            "Branded short links, edge-fast redirects, geo & device routing, real-time analytics. Free forever plan. $50 lifetime unlimited.",
        },
        { property: "og:title", content: "Sleepox — Smart Link Manager" },
        { property: "og:description", content: "Shorten, route, and measure every link with sub-30ms edge redirects and live analytics." },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://sleepox.com/" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Sleepox — Smart Link Manager" },
        { name: "twitter:description", content: "Shorten, route, and measure every link with sub-30ms edge redirects and live analytics." },
      ],
      links: [
        { rel: "canonical", href: "https://sleepox.com/" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap",
        },
      ],
    };
  },

  component: HomeRouter,
});

function HomeRouter() {
  const { variant } = Route.useLoaderData();
  if (variant === "breezysocial") return <BreezyHome />;
  return <SleepoxHome />;
}
