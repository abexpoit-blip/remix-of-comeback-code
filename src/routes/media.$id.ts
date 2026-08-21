// Same-origin image proxy for article hero images.
//
// WHY: every article page used to hotlink `images.unsplash.com/...` with an
// identical query signature (`?auto=format&fit=crop&w=1200&q=75`). A reviewer
// crawling several of our ad domains sees the exact same third-party CDN and
// parameter fingerprint on all of them — a cheap way to cluster the domains
// together. Serving the bytes from our own host removes that cross-domain link
// and makes every article look like a normal self-hosted publication.
//
// Path shape: /media/<base64url(image url)>.jpg
// The bare short-link nginx rewrite only matches a single 6-char segment, so a
// two-segment /media/... path passes straight through to the app.
import { createFileRoute } from "@tanstack/react-router";

// Strict allow-list: without it this route would be an open proxy (SSRF).
const ALLOWED_HOSTS = new Set(["images.unsplash.com"]);

function decodeId(raw: string): string | null {
  try {
    const withoutExt = raw.replace(/\.(jpg|jpeg|png|webp)$/i, "");
    const b64 = withoutExt.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const decoded =
      typeof atob === "function"
        ? atob(b64 + pad)
        : Buffer.from(b64 + pad, "base64").toString("binary");
    return decoded || null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/media/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const target = decodeId(String(params.id || ""));
        if (!target) return new Response("Not found", { status: 404 });

        let url: URL;
        try {
          url = new URL(target);
        } catch {
          return new Response("Not found", { status: 404 });
        }
        if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
          return new Response("Not found", { status: 404 });
        }

        try {
          const upstream = await fetch(url.toString(), {
            headers: { accept: "image/avif,image/webp,image/jpeg,image/*,*/*;q=0.8" },
          });
          if (!upstream.ok || !upstream.body) {
            return new Response("Not found", { status: 404 });
          }
          return new Response(upstream.body, {
            status: 200,
            headers: {
              "content-type": upstream.headers.get("content-type") || "image/jpeg",
              // Long-lived: the image for a given id never changes.
              "cache-control": "public, max-age=31536000, immutable",
              "x-content-type-options": "nosniff",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
