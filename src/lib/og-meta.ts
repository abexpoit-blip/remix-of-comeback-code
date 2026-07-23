/**
 * Host-agnostic Open Graph / Meta metadata builder.
 *
 * Design goal — no cross-domain fingerprint. The safe pages / articles
 * must NEVER hard-code a specific brand domain in canonical, og:url,
 * og:image, or JSON-LD. Every URL self-references the origin the current
 * request was actually served from (tekuc.com, breezysocial.com, or any
 * future safe-content host), so Facebook / Meta / Google can't correlate
 * the shortener with the safe-content brand through the returned tags.
 *
 * Callers must resolve the origin in the route loader
 * (via `getRequestOrigin` from "@/lib/request-origin.functions") and
 * pass it into `buildOg({ origin, ... })`.
 */

import { brandForOrigin, rebrand } from "./brand-registry";

export const OG_LOCALE = "en_US";
export const OG_DEFAULT_IMAGE_PATH = "/og-default.png";
export const OG_DEFAULT_IMAGE_W = 1024;
export const OG_DEFAULT_IMAGE_H = 1024;

export type MetaTag =
  | { name: string; content: string }
  | { property: string; content: string }
  | { title: string }
  | { charSet: string }
  | { httpEquiv: string; content: string };

export type LinkTag = { rel: string; href: string; [k: string]: any };

export type BuildOgOptions = {
  /** Absolute serving origin, e.g. "https://tekuc.com". REQUIRED to avoid host leaks. */
  origin: string;
  /** Root-relative path, e.g. "/blog/foo". */
  path: string;
  title: string;
  description: string;
  /** Root-relative image path (preferred) OR absolute URL. If omitted, an
   *  on-demand server-generated image based on `title` + `brand` + `variant`
   *  is used (stable, content-addressed URL, cached forever). */
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  /** og:site_name — brand name for this host. Defaults to the host label. */
  siteName?: string;
  /** og:type. */
  type?: "website" | "article" | "product" | "profile";
  updatedTime?: string;
  /** Eyebrow label used only when the dynamic OG image is generated. */
  ogImageEyebrow?: string;
  /** Color variant used only when the dynamic OG image is generated. */
  ogImageVariant?: "sage" | "sand" | "ink" | "sunrise" | "ocean";
  article?: {
    author?: string;
    publishedTime?: string;
    modifiedTime?: string;
    section?: string;
    tags?: string[];
  };
  product?: {
    price?: number | string;
    currency?: string;
    availability?: "in stock" | "out of stock" | "preorder";
    brand?: string;
    condition?: "new" | "used" | "refurbished";
  };
};

function stripTrailingSlash(u: string): string {
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

/** Resolve any URL/path against `origin`. Absolute inputs are returned as-is. */
export function absoluteUrl(origin: string, pathOrUrl: string): string {
  if (!pathOrUrl) return stripTrailingSlash(origin);
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const o = stripTrailingSlash(origin);
  return `${o}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Derive a friendly site name from an origin ("https://tekuc.com" → "tekuc.com"). */
export function hostLabel(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin.replace(/^https?:\/\//, "");
  }
}

export function buildOg(opts: BuildOgOptions): { meta: MetaTag[]; links: LinkTag[] } {
  const origin = stripTrailingSlash(opts.origin);
  const url = absoluteUrl(origin, opts.path);
  const brand = brandForOrigin(origin);
  const siteName = opts.siteName ?? brand.name;
  // Rebrand title/description so each host presents a distinct brand to crawlers.
  const title = rebrand(opts.title, origin);
  const description = rebrand(opts.description, origin);
  // Static default image — dynamic PNG generator removed (native module
  // could not be bundled for Worker builds). Callers that want per-page
  // artwork should pass `opts.image` explicitly.
  const image = absoluteUrl(origin, opts.image ?? OG_DEFAULT_IMAGE_PATH);
  const imgW = opts.imageWidth ?? OG_DEFAULT_IMAGE_W;
  const imgH = opts.imageHeight ?? OG_DEFAULT_IMAGE_H;
  const imgAlt = rebrand(opts.imageAlt ?? title, origin);
  const imgType = image.endsWith(".jpg") || image.endsWith(".jpeg")
    ? "image/jpeg"
    : image.endsWith(".webp") ? "image/webp" : "image/png";
  const type = opts.type ?? "website";
  const updated = opts.updatedTime ?? new Date().toISOString();

  const meta: MetaTag[] = [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },

    { property: "og:site_name", content: siteName },
    { property: "og:locale", content: OG_LOCALE },
    { property: "og:type", content: type },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:updated_time", content: updated },

    { property: "og:image", content: image },
    { property: "og:image:secure_url", content: image },
    { property: "og:image:type", content: imgType },
    { property: "og:image:width", content: String(imgW) },
    { property: "og:image:height", content: String(imgH) },
    { property: "og:image:alt", content: imgAlt },

    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: imgAlt },
  ];

  if (opts.article) {
    if (opts.article.author) meta.push({ property: "article:author", content: opts.article.author });
    if (opts.article.publishedTime) meta.push({ property: "article:published_time", content: opts.article.publishedTime });
    if (opts.article.modifiedTime) meta.push({ property: "article:modified_time", content: opts.article.modifiedTime });
    if (opts.article.section) meta.push({ property: "article:section", content: opts.article.section });
    for (const tag of opts.article.tags ?? []) {
      meta.push({ property: "article:tag", content: tag });
    }
  }

  if (opts.product) {
    if (opts.product.price != null) meta.push({ property: "product:price:amount", content: String(opts.product.price) });
    if (opts.product.currency) meta.push({ property: "product:price:currency", content: opts.product.currency });
    if (opts.product.availability) meta.push({ property: "product:availability", content: opts.product.availability });
    if (opts.product.brand) meta.push({ property: "product:brand", content: opts.product.brand });
    if (opts.product.condition) meta.push({ property: "product:condition", content: opts.product.condition });
    if (opts.product.price != null) meta.push({ property: "og:price:amount", content: String(opts.product.price) });
    if (opts.product.currency) meta.push({ property: "og:price:currency", content: opts.product.currency });
  }

  const links: LinkTag[] = [{ rel: "canonical", href: url }];

  return { meta, links };
}
