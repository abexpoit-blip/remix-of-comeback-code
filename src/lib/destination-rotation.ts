/**
 * Per-link destination rotation.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every short code resolved to the SAME monetisation URL
 * (`app_settings.our_adsterra_url`, plus whatever single URL the user saved on
 * the link). Two links tested side by side landed on the identical
 * `holylocusturtle.com/...?key=...` — one URL for the whole platform. Once a
 * reviewer or an automated integrity scan flags that URL, every link we own is
 * flagged with it.
 *
 * This module spreads traffic over a pool of destinations and assigns each
 * short code its OWN destination, deterministically:
 *
 *   - deterministic per code  → the same link always lands on the same place,
 *     so a reviewer re-checking a link sees consistent behaviour (a link that
 *     changes destination between two visits is itself a cloaking signal)
 *   - different across codes  → no single URL carries the whole platform
 *   - weight-aware            → an entry can be given a larger share
 *
 * The pool is global (`app_settings.destination_pool`), so every user's links
 * go through the exact same system — no per-user configuration needed.
 */

export type PoolEntry = { url: string; weight: number };

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function isUsableUrl(u: unknown): u is string {
  if (typeof u !== "string") return false;
  const v = u.trim();
  if (!v) return false;
  try {
    const parsed = new URL(v);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Normalises whatever is stored in settings into a clean weighted pool.
 * Accepts:  ["https://a", "https://b"]
 *           [{ url: "https://a", weight: 3 }, …]
 *           "https://a\nhttps://b"   (newline / comma separated string)
 */
export function parseDestinationPool(raw: unknown): PoolEntry[] {
  let items: unknown[] = [];

  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        items = Array.isArray(parsed) ? parsed : [];
      } catch {
        items = [];
      }
    } else {
      items = trimmed.split(/[\n,]+/);
    }
  } else {
    return [];
  }

  const out: PoolEntry[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    let url: unknown;
    let weight = 1;
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      url = o.url ?? o.destination ?? o.href;
      const w = Number(o.weight ?? o.weight_pct ?? 1);
      weight = Number.isFinite(w) && w > 0 ? Math.min(1000, w) : 1;
    } else {
      url = item;
    }
    if (typeof url === "string") url = url.trim();
    if (!isUsableUrl(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, weight });
  }
  return out;
}

/**
 * Assigns one destination from the pool to a short code.
 *
 * Deterministic: `pickDestinationForCode(pool, "abc123")` always returns the
 * same URL for the same pool. Weight is honoured by expanding each entry into
 * `weight` slots on a virtual ring, then hashing the code onto the ring.
 */
export function pickDestinationForCode(
  pool: PoolEntry[],
  code: string,
  fallback: string,
): string {
  if (!pool.length) return fallback;
  if (pool.length === 1) return pool[0].url;

  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return pool[0].url;

  let slot = fnv1a(`dest:${code}`) % total;
  for (const entry of pool) {
    if (slot < entry.weight) return entry.url;
    slot -= entry.weight;
  }
  return pool[pool.length - 1].url;
}

/**
 * Resolves the destination for a short code with a single call.
 * `linkUrl` (the destination saved on the link itself) always wins when set —
 * rotation only fills in where the platform, not the user, chooses the target.
 */
export function resolveDestination(opts: {
  code: string;
  linkUrl?: string | null;
  poolRaw?: unknown;
  fallback: string;
}): string {
  const { code, linkUrl, poolRaw, fallback } = opts;
  if (isUsableUrl(linkUrl)) return linkUrl;
  const pool = parseDestinationPool(poolRaw);
  return pickDestinationForCode(pool, code, fallback);
}
