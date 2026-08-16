/**
 * Per-host visual identity assets.
 *
 * LEAK FIX (ad rejections): every domain used to serve byte-identical
 * /favicon.svg, /favicon.ico, /apple-touch-icon.png and /og-default.png, plus
 * the SAME Google Analytics property and the SAME google-site-verification
 * tokens. A reviewer only has to md5 the favicon (or read one GA id) to prove
 * that the ad domain, the storefront and the SaaS dashboard are one operator.
 * That is a textbook cloaking/footprint signal and by itself a rejection
 * reason.
 *
 * Every brand now has:
 *   - its own opaque asset folder  (/brand/<slug>/og.png)
 *   - its own generated SVG mark   (/brand/<slug>/icon.svg, served by a route)
 *   - its own GA property (or none at all)
 *   - its own font stack
 *
 * Slugs are deliberately opaque so the folder name does not spell out the
 * brand list to anyone poking at paths.
 */

export type BrandAssets = {
  slug: string;
  /** Primary hex, used for the generated mark + theme-color. */
  color: string;
  /** Secondary hex for the mark. */
  accent: string;
  /** Mark geometry variant — keeps the SVGs structurally different. */
  mark: "rounded" | "circle" | "diamond" | "arch";
  /** Google Fonts family query, or null to use system fonts. */
  fonts: string | null;
  /** GA4 measurement id, or null for no analytics on this host. */
  ga: string | null;
  ogWidth: number;
  ogHeight: number;
};

const ASSETS: Record<string, BrandAssets> = {
  "tekuc.com": {
    slug: "k7q2",
    color: "#1f3d2b",
    accent: "#8fae86",
    mark: "circle",
    fonts: "family=Manrope:wght@400;600;800",
    ga: null,
    ogWidth: 1200,
    ogHeight: 630,
  },
  "breezysocial.com": {
    slug: "m4vd",
    color: "#d9a521",
    accent: "#2b2b2b",
    mark: "rounded",
    fonts: "family=Outfit:wght@300;400;500;600;700;800&family=DM+Sans:wght@400;500;600;700",
    ga: null,
    ogWidth: 1200,
    ogHeight: 630,
  },
  "skypq.com": {
    slug: "p9xr",
    color: "#3a4f6b",
    accent: "#c9d3de",
    mark: "diamond",
    fonts: "family=Sora:wght@400;600;700",
    ga: null,
    ogWidth: 1200,
    ogHeight: 630,
  },
  "mefok.com": {
    slug: "t3bw",
    color: "#b5502f",
    accent: "#efe6d8",
    mark: "arch",
    fonts: "family=Figtree:wght@400;500;700;800",
    ga: null,
    ogWidth: 1200,
    ogHeight: 630,
  },
  "sleepox.com": {
    slug: "z8ha",
    color: "#0f172a",
    accent: "#6366f1",
    mark: "rounded",
    // The SaaS host is the only property that keeps the analytics tag.
    fonts: "family=Outfit:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700",
    ga: "G-79NYCD5JM9",
    ogWidth: 1024,
    ogHeight: 1024,
  },
};

const FALLBACK = ASSETS["breezysocial.com"];

export function normalizeHost(hostOrOrigin: string): string {
  const raw = (hostOrOrigin || "").trim();
  if (!raw) return "";
  let h = raw;
  try {
    if (/^https?:\/\//i.test(raw)) h = new URL(raw).host;
  } catch {
    h = raw.replace(/^https?:\/\//i, "");
  }
  return h.split("/")[0].split(":")[0].replace(/^www\./, "").toLowerCase();
}

export function assetsForHost(hostOrOrigin: string): BrandAssets {
  return ASSETS[normalizeHost(hostOrOrigin)] ?? FALLBACK;
}

/** Root-relative OG image for this host. Never shared between hosts. */
export function ogImagePath(hostOrOrigin: string): string {
  const a = assetsForHost(hostOrOrigin);
  return a.slug === "z8ha" ? "/og-default.png" : `/brand/${a.slug}/og.png`;
}

export function ogImageSize(hostOrOrigin: string): { w: number; h: number } {
  const a = assetsForHost(hostOrOrigin);
  return { w: a.ogWidth, h: a.ogHeight };
}

/** Root-relative favicon for this host (SVG, generated per brand). */
export function iconPath(hostOrOrigin: string): string {
  return `/brand/${assetsForHost(hostOrOrigin).slug}/icon.svg`;
}

/** Google Fonts stylesheet href for this host, or null. */
export function fontsHref(hostOrOrigin: string): string | null {
  const a = assetsForHost(hostOrOrigin);
  return a.fonts ? `https://fonts.googleapis.com/css2?${a.fonts}&display=swap` : null;
}

/**
 * Deterministic, per-brand SVG mark. Structurally different per brand so the
 * bytes (and the rendered glyph) never match across domains.
 */
export function renderBrandIconSvg(hostOrOrigin: string, letter: string): string {
  const a = assetsForHost(hostOrOrigin);
  const ch = (letter || "S").slice(0, 1).toUpperCase();

  const shape =
    a.mark === "circle"
      ? `<circle cx="32" cy="32" r="30" fill="${a.color}"/>`
      : a.mark === "diamond"
        ? `<path d="M32 2 62 32 32 62 2 32Z" fill="${a.color}"/>`
        : a.mark === "arch"
          ? `<path d="M4 60V28a28 28 0 0 1 56 0v32Z" fill="${a.color}"/>`
          : `<rect x="2" y="2" width="60" height="60" rx="16" fill="${a.color}"/>`;

  const dy = a.mark === "arch" ? "44" : "42";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${ch}">${shape}<text x="32" y="${dy}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="32" font-weight="700" fill="${a.accent}">${ch}</text></svg>`;
}
