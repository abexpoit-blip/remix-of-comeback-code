/**
 * Safe-page skin rotation.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every prelanding article shipped the exact same DOM: identical class names
 * (`.topbar`, `.cat-pill`, `.side-card`…), identical Google-font request
 * (Playfair Display + Source Sans 3), identical CSS byte-for-byte. Content and
 * colours rotated, structure never did — so a reviewer-side fingerprint of the
 * markup matched every single link across every domain we own. One flagged page
 * poisoned all of them.
 *
 * `applySkin()` is a deterministic, per-short-code post-processor over the
 * rendered HTML. It rewrites class names, swaps the typeface pair, and layers
 * structural CSS overrides, so two different short codes produce structurally
 * different documents while a single short code stays byte-stable across
 * re-scrapes (Facebook caches the first scrape — the page must not change under
 * it, or the mismatch itself becomes the signal).
 *
 * It never touches <head> metadata, OG tags, JSON-LD, links, or copy. Preview
 * cards, canonicals and crawler signals are unchanged.
 */

/** FNV-1a — same helper shape used by the template module. */
function skinHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Every class name the article template emits. Longest-first is not required
 *  because each replacement is word-boundary anchored. */
const CLASS_NAMES = [
  "topbar", "topbar-dot", "nav", "nav-inner", "logo", "nav-links",
  "layout", "crumbs", "cat-pill", "deck", "byline", "avatar", "byline-text",
  "share-row", "share-btn", "hero", "hero-cap", "intro", "highlights",
  "ad-slot", "ad-slot-inner", "tags", "tag", "side-card", "related-item",
  "newsletter",
] as const;

/** Neutral, editorial-looking class-name stems. Picked per code so the emitted
 *  markup reads like a hand-built site rather than a generated one. */
const STEM_SETS = [
  ["bar", "band", "brandline", "menu", "mark", "links", "grid", "path", "label", "sub", "meta", "badge", "author", "actions", "act", "lead", "leadcap", "open", "notes", "promo", "promobox", "topics", "topic", "panel", "entry", "signup"],
  ["strip", "masthead", "site", "navrow", "title", "menulinks", "wrap", "trail", "kicker", "standfirst", "credit", "sig", "creditline", "tools", "tool", "figure", "figcap", "opener", "points", "slot", "slotbox", "chips", "chip", "widget", "story", "subscribe"],
  ["ticker", "header", "brand", "headrow", "name", "navitems", "shell", "bread", "flag", "summary", "writer", "mono", "writerline", "social", "soc", "photo", "photocap", "first", "recap", "space", "spacebox", "labels", "labelitem", "block", "item", "optin"],
  ["announce", "bartop", "ident", "identrow", "wordmark", "sections", "page", "crumbline", "eyebrow", "intro-line", "attrib", "circle", "attribline", "sharebar", "sharelink", "lead-img", "lead-cap", "openpara", "keypoints", "advert", "advert-inner", "taglist", "taglink", "card", "rel", "mailform"],
];

type Skin = {
  headFont: string;
  bodyFont: string;
  fontsHref: string;
  overrides: string;
};

/** Font pairs, all Google-hosted, all common on real publisher sites. */
const FONT_PAIRS: { head: string; body: string; href: string }[] = [
  {
    head: "Playfair Display", body: "Source Sans 3",
    href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Source+Sans+3:wght@400;600;700&display=swap",
  },
  {
    head: "Libre Baskerville", body: "Karla",
    href: "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@700&family=Karla:wght@400;600;700&display=swap",
  },
  {
    head: "Merriweather", body: "Inter",
    href: "https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Inter:wght@400;600;700&display=swap",
  },
  {
    head: "Lora", body: "Nunito Sans",
    href: "https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Nunito+Sans:wght@400;600;700&display=swap",
  },
  {
    head: "Bitter", body: "Work Sans",
    href: "https://fonts.googleapis.com/css2?family=Bitter:wght@700;800&family=Work+Sans:wght@400;600;700&display=swap",
  },
  {
    head: "Domine", body: "Rubik",
    href: "https://fonts.googleapis.com/css2?family=Domine:wght@700&family=Rubik:wght@400;500;700&display=swap",
  },
];

/** Structural CSS layers. Each one changes measurable page geometry: column
 *  order, container width, corner radius, surface colour, dropcap presence. */
function layoutOverride(i: number, cls: (n: string) => string): string {
  const L = cls("layout");
  const A = "article";
  const S = "aside";
  switch (i % 6) {
    case 0:
      return `.${L}{grid-template-columns:300px 1fr;max-width:1080px}
  .${L} > ${A}{order:2;border-radius:10px}
  .${L} > ${S}{order:1}
  body{background:#f4f5f7}
  .${cls("intro")}::first-letter{font-size:0;padding:0;float:none}`;
    case 1:
      return `.${L}{grid-template-columns:1fr;max-width:760px}
  ${A}{border-radius:0;border:1px solid #e8e8e8;box-shadow:none;padding:40px 44px}
  ${S}{max-width:760px;margin:0 auto}
  body{background:#fbfbfa}`;
    case 2:
      return `.${L}{grid-template-columns:1fr 320px;max-width:1180px;gap:56px}
  ${A}{border-radius:14px;box-shadow:0 6px 28px rgba(16,24,40,.07);padding:52px 60px}
  body{background:#eef1f5;font-size:16.5px}
  .${cls("topbar")}{display:none}`;
    case 3:
      return `.${L}{grid-template-columns:1fr 280px;max-width:1020px}
  ${A}{border-radius:2px;border-top:4px solid var(--accent);padding:40px 46px}
  body{background:#ffffff}
  .${cls("nav")}{position:static;border-bottom:2px solid #111}
  .${cls("hero")}{border-radius:0}`;
    case 4:
      return `.${L}{grid-template-columns:1fr;max-width:900px;gap:32px}
  ${A}{border-radius:18px;padding:44px 48px;box-shadow:0 2px 6px rgba(0,0,0,.05)}
  ${S}{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .${cls("side-card")}{border-radius:18px}
  body{background:#f6f4f0}`;
    default:
      return `.${L}{grid-template-columns:1fr 300px;max-width:1140px}
  ${A}{border-radius:6px;padding:46px 52px}
  body{background:#f7f7f8}
  .${cls("hero")}{border-radius:12px}
  .${cls("highlights")}{background:#f3f7f4;border-left-color:var(--accent)}`;
  }
}

function buildSkin(code: string, cls: (n: string) => string): Skin {
  const pair = FONT_PAIRS[skinHash(`font:${code}`) % FONT_PAIRS.length];
  const layout = layoutOverride(skinHash(`layout:${code}`), cls);
  const density = skinHash(`density:${code}`) % 3;
  const densityCss =
    density === 0
      ? `p{line-height:1.75}h1{letter-spacing:-.4px}`
      : density === 1
        ? `p{line-height:1.62;font-size:1.05rem}h1{letter-spacing:0;font-size:2.35rem}`
        : `p{line-height:1.8;font-size:1.1rem}h1{letter-spacing:-.8px;font-size:2.75rem}`;

  return {
    headFont: pair.head,
    bodyFont: pair.body,
    fontsHref: pair.href,
    overrides: `\n  /* layout */\n  ${layout}\n  ${densityCss}\n`,
  };
}

/**
 * Deterministically re-skins a rendered prelanding page for one short code.
 * Same code in → identical bytes out. Different codes → different structure.
 */
export function applySkin(html: string, code: string): string {
  const stems = STEM_SETS[skinHash(`stems:${code}`) % STEM_SETS.length];
  const salt = (skinHash(`salt:${code}`) % 900 + 100).toString(36);

  const map = new Map<string, string>();
  CLASS_NAMES.forEach((name, i) => {
    map.set(name, `${stems[i] ?? name}-${salt}`);
  });
  const cls = (n: string) => map.get(n) ?? n;

  let out = html;

  // 1. class="…" attribute values (HTML side)
  out = out.replace(/class="([^"]*)"/g, (full, value: string) => {
    const parts = String(value).split(/\s+/).filter(Boolean);
    if (parts.length === 0) return full;
    const mapped = parts.map((p) => map.get(p) ?? p);
    return `class="${mapped.join(" ")}"`;
  });

  // 2. .selector occurrences (CSS side) — word-boundary anchored so
  //    `.ad-slot-inner` is not clobbered by the `.ad-slot` rule.
  for (const [from, to] of map) {
    out = out.replace(new RegExp(`\\.${from.replace(/[-]/g, "\\-")}(?![\\w-])`, "g"), `.${to}`);
  }

  // 3. Typeface pair + the Google Fonts request itself.
  const skin = buildSkin(code, cls);
  out = out.replace(
    /https:\/\/fonts\.googleapis\.com\/css2\?[^"']+/,
    skin.fontsHref,
  );
  out = out
    .replace(/'Playfair Display'/g, `'${skin.headFont}'`)
    .replace(/'Source Sans 3'/g, `'${skin.bodyFont}'`);

  // 4. Structural overrides appended last so they win the cascade.
  out = out.replace("</style>", `${skin.overrides}</style>`);

  return out;
}
