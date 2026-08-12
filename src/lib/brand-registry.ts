/**
 * Per-host brand identity for safe pages / articles.
 *
 * Goal — every safe-content domain (tekuc.com, breezysocial.com, sleepox.com,
 * and any future host) presents a DIFFERENT brand name / tagline / email to
 * Meta / Facebook / Google crawlers. This breaks the cross-domain footprint:
 * the crawler sees three unrelated ecommerce brands, not three mirrors of
 * one site.
 *
 * The internal storefront copy is written around "BreezySocial" — we
 * intercept that token in og:title / og:description at meta-build time and
 * swap it for the host's brand. No route file needs to know which brand it
 * is running under.
 */

export type Brand = {
  /** Display brand name — replaces "BreezySocial" tokens in titles/desc. */
  name: string;
  /** Short tagline used for og:site_name where useful. */
  tagline: string;
  /** Support email surfaced in schema.org / contact info. */
  email: string;
  /** City / country line for local-business schema. */
  city: string;
};

const REGISTRY: Record<string, Brand> = {
  "tekuc.com": {
    name: "Tekuc",
    tagline: "Modern wellness tech for calm, focused living.",
    email: "hello@tekuc.com",
    city: "Austin, TX",
  },
  "breezysocial.com": {
    name: "BreezySocial",
    tagline: "Smart gadgets for calm, modern living.",
    email: "hello@breezysocial.com",
    city: "San Francisco, CA",
  },
  "skypq.com": {
    name: "Skypq",
    tagline: "Everyday essentials, thoughtfully made.",
    email: "hello@skypq.com",
    city: "Denver, CO",
  },
  "mefok.com": {
    name: "Mefok",
    tagline: "Simple home gear for better daily routines.",
    email: "hello@mefok.com",
    city: "Portland, OR",
  },
  "sleepox.com": {
    name: "Sleepox",
    tagline: "Sleep-first gear engineered for real rest.",
    email: "hello@sleepox.com",
    city: "Seattle, WA",
  },
};

const DEFAULT_BRAND: Brand = REGISTRY["breezysocial.com"];

function hostOf(origin: string): string {
  try {
    return new URL(origin).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return origin.replace(/^https?:\/\//i, "").replace(/^www\./, "").toLowerCase();
  }
}

export function brandForOrigin(origin: string): Brand {
  return REGISTRY[hostOf(origin)] ?? DEFAULT_BRAND;
}

/**
 * Rewrite any "BreezySocial" mention in a string to the host's brand name.
 * Case-preserving for the plain form; leaves other brand words alone.
 */
export function rebrand(text: string, origin: string): string {
  const brand = brandForOrigin(origin);
  if (brand.name === "BreezySocial" || !text) return text;
  return text
    .replace(/BreezySocial/g, brand.name)
    .replace(/breezysocial/g, brand.name.toLowerCase());
}
