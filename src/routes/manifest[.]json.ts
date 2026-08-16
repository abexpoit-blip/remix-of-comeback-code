// Host-aware web app manifest.
//
// LEAK FIX: the old static public/manifest.json advertised
// "LinkShield — Bot-filtered short links built for Facebook & Instagram ad
// campaigns" on every host, including the ad domains. Manifests are fetched
// by crawlers and reviewers. Content domains now describe the storefront.
import { createFileRoute } from "@tanstack/react-router";
import { isSleepoxSaasHost } from "@/lib/site-hosts";
import { brandForOrigin } from "@/lib/brand-registry";
import { assetsForHost, iconPath } from "@/lib/brand-assets";

// LEAK FIX: the four shared PNG icons were byte-identical on every domain.
// Each host now advertises its own generated SVG mark instead.
function iconsFor(host: string) {
  const src = iconPath(host);
  return [
    { src, sizes: "any", type: "image/svg+xml", purpose: "any" },
    { src, sizes: "any", type: "image/svg+xml", purpose: "maskable" },
  ];
}

export const Route = createFileRoute("/manifest.json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
          .split(",")[0]
          .trim()
          .toLowerCase();
        const proto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
        const brand = brandForOrigin(`${proto}://${host || "breezysocial.com"}`);
        const saas = isSleepoxSaasHost(host);

        const body = saas
          ? {
              name: "Sleepox",
              short_name: "Sleepox",
              description: "Smart link manager with real-time analytics.",
              start_url: "/",
              display: "standalone",
              background_color: "#ffffff",
              theme_color: assetsForHost(host).color,
              icons: iconsFor(host),
            }
          : {
              name: brand.name,
              short_name: brand.name,
              description: brand.tagline,
              start_url: "/",
              display: "standalone",
              background_color: "#ffffff",
              theme_color: assetsForHost(host).color,
              icons: iconsFor(host),
            };

        return new Response(JSON.stringify(body, null, 2), {
          status: 200,
          headers: {
            "content-type": "application/manifest+json; charset=utf-8",
            "cache-control": "public, max-age=900",
          },
        });
      },
    },
  },
});
