/**
 * Build a stable, deterministic URL to the on-demand OG image generator.
 *
 * The URL is content-addressed by title + brand + variant, so Facebook /
 * Meta / Twitter can cache the result forever. Same inputs → same URL →
 * same image bytes.
 *
 * Callers pass the request `origin` so the image URL self-references
 * whatever host is currently serving (tekuc.com, breezysocial.com, …) —
 * no cross-domain fingerprint.
 */

export type OgImageParams = {
  title: string;
  brand?: string;
  eyebrow?: string;
  variant?: "sage" | "sand" | "ink" | "sunrise" | "ocean";
};

/** Deterministic 8-char hex hash — good enough for cache-key stability. */
function hash8(s: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = (h2 >>> 0) * 0x100000000 + (h1 >>> 0);
  return n.toString(16).padStart(16, "0").slice(0, 8);
}

export function buildOgImageUrl(origin: string, p: OgImageParams): string {
  const title = p.title.slice(0, 140);
  const brand = (p.brand ?? "").slice(0, 60);
  const eyebrow = (p.eyebrow ?? "").slice(0, 40);
  const variant = p.variant ?? "sage";
  const key = hash8(`${variant}|${brand}|${eyebrow}|${title}`);
  const qs = new URLSearchParams({
    t: title,
    b: brand,
    e: eyebrow,
    v: variant,
    k: key,
  });
  const o = origin.replace(/\/$/, "");
  return `${o}/api/public/og-image.png?${qs.toString()}`;
}
