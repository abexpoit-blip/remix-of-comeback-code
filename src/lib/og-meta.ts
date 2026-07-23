/**
 * Facebook / Meta Link Debugger–compliant Open Graph metadata builder.
 * Guarantees every safe page / article ships the full set of tags the
 * FB Sharing Debugger validates: og:site_name, og:locale, og:image:*
 * (width/height/alt/type), twitter:card, canonical, and article/product
 * extensions when applicable.
 *
 * All URLs must be absolute for FB/Meta crawlers.
 */

export const SITE_ORIGIN = "https://breezysocial.com";
export const SITE_NAME = "BreezySocial";
export const OG_LOCALE = "en_US";
export const OG_DEFAULT_IMAGE = `${SITE_ORIGIN}/og-default.png`;
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
  /** Absolute or root-relative path (e.g. "/about" or full URL). */
  path: string;
  title: string;
  description: string;
  /** Absolute image URL. Falls back to OG_DEFAULT_IMAGE. */
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  /** og:type — "website" | "article" | "product" | "profile". */
  type?: "website" | "article" | "product" | "profile";
  updatedTime?: string;
  /** article extensions */
  article?: {
    author?: string;
    publishedTime?: string;
    modifiedTime?: string;
    section?: string;
    tags?: string[];
  };
  /** product extensions */
  product?: {
    price?: number | string;
    currency?: string;
    availability?: "in stock" | "out of stock" | "preorder";
    brand?: string;
    condition?: "new" | "used" | "refurbished";
  };
};

function toAbsolute(path: string): string {
  if (!path) return SITE_ORIGIN;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Returns the full FB-Debugger-compliant meta array + canonical link.
 * Merge/spread the returned arrays into your route's head() output.
 */
export function buildOg(opts: BuildOgOptions): { meta: MetaTag[]; links: LinkTag[] } {
  const url = toAbsolute(opts.path);
  const image = opts.image ?? OG_DEFAULT_IMAGE;
  const imgW = opts.imageWidth ?? OG_DEFAULT_IMAGE_W;
  const imgH = opts.imageHeight ?? OG_DEFAULT_IMAGE_H;
  const imgAlt = opts.imageAlt ?? opts.title;
  const imgType = image.endsWith(".jpg") || image.endsWith(".jpeg")
    ? "image/jpeg"
    : image.endsWith(".webp") ? "image/webp" : "image/png";
  const type = opts.type ?? "website";
  const updated = opts.updatedTime ?? new Date().toISOString();

  const meta: MetaTag[] = [
    // Base SEO
    { title: opts.title },
    { name: "description", content: opts.description },
    { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },

    // Open Graph (Facebook / Meta)
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: OG_LOCALE },
    { property: "og:type", content: type },
    { property: "og:title", content: opts.title },
    { property: "og:description", content: opts.description },
    { property: "og:url", content: url },
    { property: "og:updated_time", content: updated },

    // Image (all four sub-tags required by FB Sharing Debugger)
    { property: "og:image", content: image },
    { property: "og:image:secure_url", content: image },
    { property: "og:image:type", content: imgType },
    { property: "og:image:width", content: String(imgW) },
    { property: "og:image:height", content: String(imgH) },
    { property: "og:image:alt", content: imgAlt },

    // Twitter / X card
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: opts.title },
    { name: "twitter:description", content: opts.description },
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
    // og:price alias — some crawlers still key off this
    if (opts.product.price != null) meta.push({ property: "og:price:amount", content: String(opts.product.price) });
    if (opts.product.currency) meta.push({ property: "og:price:currency", content: opts.product.currency });
  }

  const links: LinkTag[] = [{ rel: "canonical", href: url }];

  return { meta, links };
}
