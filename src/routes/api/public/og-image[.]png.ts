/**
 * Server-side Open Graph image generator.
 *
 * Given title / brand / eyebrow / variant query params, renders a 1200×630
 * PNG using an SVG template + @resvg/resvg-js, caches the result on disk
 * (/tmp/og-cache/<sha1>.png), and serves it with a year-long Cache-Control
 * so Meta / Facebook / Twitter / LinkedIn cache it once and never re-fetch.
 *
 * Same title+brand+variant → same URL → same bytes. This is what
 * `buildOgImageUrl` from src/lib/og-image-url.ts hashes into the URL
 * shipped in og:image / twitter:image.
 *
 * Host-agnostic: the image bytes never mention a specific domain, so the
 * same PNG can be served from tekuc.com and breezysocial.com without
 * leaking a shared fingerprint.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const CACHE_DIR = path.join(os.tmpdir(), "og-cache");
const WIDTH = 1200;
const HEIGHT = 630;

type Variant = "sage" | "sand" | "ink" | "sunrise" | "ocean";
const PALETTES: Record<Variant, { bg: string; grad: string; text: string; accent: string; sub: string }> = {
  sage: { bg: "#F2EDE3", grad: "#DDE7D5", text: "#2A2A28", accent: "#5A7A55", sub: "#5A554C" },
  sand: { bg: "#FBF5EA", grad: "#EFDFC4", text: "#2A2118", accent: "#B08A4F", sub: "#5A4A38" },
  ink: { bg: "#0F1418", grad: "#1B2530", text: "#F5F1E8", accent: "#7BB5E0", sub: "#B7BEC7" },
  sunrise: { bg: "#FFF3EA", grad: "#FFD9BC", text: "#3B1F14", accent: "#D8683A", sub: "#6A3F2A" },
  ocean: { bg: "#EAF3F5", grad: "#BEDCE1", text: "#0F2A31", accent: "#3D8593", sub: "#2A4C55" },
};

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => (
    { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!
  ));
}

/** Wrap a title into up to `maxLines` lines of at most `maxCharsPerLine` characters. */
function wrap(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxCharsPerLine && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) {
        // put remainder into the last line, ellipsize if too long
        const rest = [w, ...words.slice(words.indexOf(w) + 1)].join(" ");
        lines.push(rest.length > maxCharsPerLine ? rest.slice(0, maxCharsPerLine - 1).trimEnd() + "…" : rest);
        return lines;
      }
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function buildSvg(opts: { title: string; brand: string; eyebrow: string; variant: Variant }): string {
  const p = PALETTES[opts.variant] ?? PALETTES.sage;
  const title = escapeXml(opts.title || "Untitled");
  const brand = escapeXml(opts.brand || "");
  const eyebrow = escapeXml(opts.eyebrow || "");

  const titleLines = wrap(title, 26, 4);
  const titleFontSize = titleLines.length <= 2 ? 84 : titleLines.length === 3 ? 72 : 62;
  const lineHeight = Math.round(titleFontSize * 1.12);
  const titleStartY = 250;

  const titleTspans = titleLines
    .map(
      (line, i) =>
        `<tspan x="80" y="${titleStartY + i * lineHeight}">${line}</tspan>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bg}"/>
      <stop offset="100%" stop-color="${p.grad}"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="1050" cy="120" r="260" fill="${p.accent}" fill-opacity="0.10"/>
  <circle cx="1150" cy="560" r="180" fill="${p.accent}" fill-opacity="0.08"/>
  <rect x="80" y="80" width="80" height="6" rx="3" fill="${p.accent}"/>
  ${
    eyebrow
      ? `<text x="80" y="150" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="4" fill="${p.accent}" text-transform="uppercase">${eyebrow.toUpperCase()}</text>`
      : ""
  }
  <text font-family="Georgia, 'Times New Roman', serif" font-size="${titleFontSize}" font-weight="400" fill="${p.text}">
    ${titleTspans}
  </text>
  ${
    brand
      ? `<text x="80" y="560" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="600" fill="${p.sub}">${brand}</text>`
      : ""
  }
  <text x="1120" y="560" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="500" fill="${p.sub}" text-anchor="end">READ MORE →</text>
</svg>`;
}

async function ensureCacheDir() {
  try { await fs.mkdir(CACHE_DIR, { recursive: true }); } catch { /* noop */ }
}

async function renderPng(svg: string): Promise<Buffer> {
  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, {
    background: "rgba(255,255,255,1)",
    fitTo: { mode: "width", value: WIDTH },
    font: { loadSystemFonts: true, defaultFontFamily: "Helvetica" },
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}

export const Route = createFileRoute("/api/public/og-image.png")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const title = (url.searchParams.get("t") ?? "BreezySocial").slice(0, 140);
        const brand = (url.searchParams.get("b") ?? "").slice(0, 60);
        const eyebrow = (url.searchParams.get("e") ?? "").slice(0, 40);
        const variantRaw = url.searchParams.get("v") ?? "sage";
        const variant: Variant = (["sage","sand","ink","sunrise","ocean"] as const).includes(variantRaw as Variant)
          ? (variantRaw as Variant)
          : "sage";

        const cacheKey = createHash("sha1")
          .update(`v1|${variant}|${brand}|${eyebrow}|${title}`)
          .digest("hex");
        const cachePath = path.join(CACHE_DIR, `${cacheKey}.png`);

        await ensureCacheDir();
        let png: Buffer;
        try {
          png = await fs.readFile(cachePath);
        } catch {
          try {
            const svg = buildSvg({ title, brand, eyebrow, variant });
            png = await renderPng(svg);
            fs.writeFile(cachePath, png).catch(() => {});
          } catch (err) {
            console.error("[og-image] render failed:", err);
            // Fallback: redirect to the static default asset
            return new Response(null, {
              status: 302,
              headers: { location: "/og-default.png", "cache-control": "public, max-age=60" },
            });
          }
        }

        return new Response(new Uint8Array(png), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": String(png.length),
            "cache-control": "public, max-age=31536000, immutable",
            "x-og-cache-key": cacheKey,
          },
        });
      },
    },
  },
});
