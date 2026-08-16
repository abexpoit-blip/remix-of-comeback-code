// Per-host favicon. Each brand gets a structurally different generated mark,
// so no two domains ever serve an identical icon file (the single easiest
// cross-domain fingerprint an ad reviewer can check).
import { createFileRoute } from "@tanstack/react-router";
import { assetsForHost, renderBrandIconSvg } from "@/lib/brand-assets";
import { brandForOrigin } from "@/lib/brand-registry";

export const Route = createFileRoute("/brand/$slug/icon.svg")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
          .split(",")[0]
          .trim()
          .toLowerCase();
        const brand = brandForOrigin(`https://${host || "breezysocial.com"}`);
        const svg = renderBrandIconSvg(host, brand.name);
        // Touch assetsForHost so an unknown slug still resolves by host.
        assetsForHost(host);

        return new Response(svg, {
          status: 200,
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=86400",
            vary: "Host, X-Forwarded-Host",
          },
        });
      },
    },
  },
});
