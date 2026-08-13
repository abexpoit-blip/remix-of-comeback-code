/**
 * Phase A: Fixed pool of 5 real Breezy pages used as safe redirects for bot
 * traffic. Sticky per visitor (fingerprint hash) + per short_code, so the
 * SAME visitor always sees the SAME page on revisit — looks like a normal
 * site, not a cloaking rotation.
 *
 * Includes:
 *  - Health tracking (unhealthy URLs auto-skipped, next healthy URL used)
 *  - Lazy background HEAD self-check every HEALTH_CHECK_INTERVAL_MS
 *  - Structured pick log returned to caller (for redirect audit log)
 */
import { fetchIpv4 } from "@/lib/fetch-ipv4";
export const SAFE_PAGE_POOL: readonly string[] = [
  "https://breezysocial.com/blog/magnesium-sleep-guide-2026",
  "https://breezysocial.com/faq",
  "https://breezysocial.com/size-guide",
  "https://breezysocial.com/about",
] as const;

// Mark a URL unhealthy for this long after a 4xx/5xx is observed.
const UNHEALTHY_TTL_MS = 10 * 60 * 1000; // 10 min
// Re-run full pool HEAD check at most this often (lazy, non-blocking).
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min
// HEAD timeout per URL.
const HEALTH_CHECK_TIMEOUT_MS = 4000;

type HealthEntry = { unhealthyUntil: number; lastStatus: number | null; lastCheckedAt: number };
const health: Map<string, HealthEntry> = new Map();
let lastFullCheckAt = 0;
let inflightCheck: Promise<void> | null = null;

// djb2 — fast, well-distributed string hash. Stable across processes.
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function isHealthy(url: string, now: number): boolean {
  const h = health.get(url);
  if (!h) return true;
  return h.unhealthyUntil <= now;
}

export function markSafePageUnhealthy(url: string, status: number | null = null): void {
  const now = Date.now();
  health.set(url, {
    unhealthyUntil: now + UNHEALTHY_TTL_MS,
    lastStatus: status,
    lastCheckedAt: now,
  });
}

export function markSafePageHealthy(url: string, status = 200): void {
  health.set(url, { unhealthyUntil: 0, lastStatus: status, lastCheckedAt: Date.now() });
}

export function getSafePoolHealth(): Array<{
  url: string;
  healthy: boolean;
  lastStatus: number | null;
  lastCheckedAt: number;
  unhealthyUntil: number;
}> {
  const now = Date.now();
  return SAFE_PAGE_POOL.map((url) => {
    const h = health.get(url);
    return {
      url,
      healthy: !h || h.unhealthyUntil <= now,
      lastStatus: h?.lastStatus ?? null,
      lastCheckedAt: h?.lastCheckedAt ?? 0,
      unhealthyUntil: h?.unhealthyUntil ?? 0,
    };
  });
}

async function headCheck(url: string): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    // Use GET with Range header — some hosts/CDNs don't answer HEAD reliably.
    const r = await fetchIpv4(url, {
      method: "GET",
      headers: { range: "bytes=0-0", "user-agent": "BreezySocial-Healthcheck/1.0" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (r.status >= 200 && r.status < 400) {
      markSafePageHealthy(url, r.status);
    } else {
      markSafePageUnhealthy(url, r.status);
      console.warn(JSON.stringify({
        event: "safe_pool.unhealthy",
        url,
        status: r.status,
        reason: "non-2xx-on-check",
      }));
    }
  } catch (e) {
    // Network-level failure (DNS/IPv6/hairpin from inside the VPS) is NOT
    // evidence the page is broken for real visitors. Never mark unhealthy on
    // transport errors — only real 4xx/5xx responses count.
    console.warn(JSON.stringify({
      event: "safe_pool.check_skipped",
      url,
      reason: "transport-error",
      error: (e as Error)?.message,
    }));
  } finally {
    clearTimeout(t);
  }
}

/** Lazy, non-blocking full-pool health check. At most one inflight at a time. */
export function maybeRunHealthCheck(): void {
  const now = Date.now();
  if (inflightCheck) return;
  if (now - lastFullCheckAt < HEALTH_CHECK_INTERVAL_MS) return;
  lastFullCheckAt = now;
  inflightCheck = Promise.allSettled(SAFE_PAGE_POOL.map(headCheck))
    .then(() => undefined)
    .finally(() => {
      inflightCheck = null;
    });
}

/**
 * Force a full-pool re-check RIGHT NOW, bypassing the throttle interval.
 * Awaitable — use from an admin trigger route.
 */
export async function forceHealthCheck(): Promise<Array<{ url: string; healthy: boolean; status: number | null }>> {
  // Clear all prior unhealthy marks so a recovered URL gets a clean slate.
  health.clear();
  if (inflightCheck) await inflightCheck;
  lastFullCheckAt = Date.now();
  const p = Promise.allSettled(SAFE_PAGE_POOL.map(headCheck)).then(() => undefined);
  inflightCheck = p.finally(() => { inflightCheck = null; });
  await p;
  const now = Date.now();
  return SAFE_PAGE_POOL.map((url) => {
    const h = health.get(url);
    return {
      url,
      healthy: !h || h.unhealthyUntil <= now,
      status: h?.lastStatus ?? null,
    };
  });
}


export type SafePagePick = {
  url: string;
  index: number;
  fallbackFrom: number | null; // original idx if we had to skip unhealthy
};

/**
 * Deterministic pick from the safe pool. Same (code, fpHash) → same URL.
 * If the chosen URL is currently marked unhealthy, advance to the next
 * healthy URL (preserves stickiness while routing around broken pages).
 * Also kicks off a lazy background health check.
 */
export function pickSafePage(code: string, fpHash: string | null | undefined): SafePagePick {
  maybeRunHealthCheck();
  const now = Date.now();
  const key = `${code}|${fpHash || "anon"}`;
  const startIdx = djb2(key) % SAFE_PAGE_POOL.length;

  for (let step = 0; step < SAFE_PAGE_POOL.length; step++) {
    const i = (startIdx + step) % SAFE_PAGE_POOL.length;
    if (isHealthy(SAFE_PAGE_POOL[i], now)) {
      return {
        url: SAFE_PAGE_POOL[i],
        index: i,
        fallbackFrom: step === 0 ? null : startIdx,
      };
    }
  }
  // All unhealthy → use original pick anyway (better than SAFE_FALLBACK loop).
  return { url: SAFE_PAGE_POOL[startIdx], index: startIdx, fallbackFrom: null };
}

/** Backward-compat shim — returns only the URL. */
export function pickSafePageUrl(code: string, fpHash: string | null | undefined): string {
  return pickSafePage(code, fpHash).url;
}
