/**
 * Bun test: safe-page-pool + crawler-class redirect determinism.
 * Run: bun test src/lib/safe-page-pool.test.ts
 */
import { describe, expect, test, beforeEach } from "bun:test";
import {
  SAFE_PAGE_POOL,
  pickSafePage,
  pickSafePageUrl,
  markSafePageUnhealthy,
  markSafePageHealthy,
  getSafePoolHealth,
} from "../src/lib/safe-page-pool";

function resetHealth() {
  for (const url of SAFE_PAGE_POOL) markSafePageHealthy(url, 200);
}

describe("safe-page-pool", () => {
  beforeEach(resetHealth);

  test("pool holds only real breezysocial URLs", () => {
    expect(SAFE_PAGE_POOL.length).toBeGreaterThan(2);
    for (const u of SAFE_PAGE_POOL) {
      expect(u).toMatch(/^https:\/\/breezysocial\.com\//);
    }
  });

  test("deterministic: same (code, fp) → same URL across many calls", () => {
    const first = pickSafePageUrl("abc123", "fp-xyz");
    for (let i = 0; i < 100; i++) {
      expect(pickSafePageUrl("abc123", "fp-xyz")).toBe(first);
    }
  });

  test("sticky per fingerprint: different fps spread across pool", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(pickSafePageUrl("code1", `fp-${i}`));
    }
    // With 200 fingerprints across 5 buckets we must hit every URL.
    expect(seen.size).toBe(SAFE_PAGE_POOL.length);
  });

  test("anon fingerprint still deterministic", () => {
    const a = pickSafePageUrl("xyz", null);
    const b = pickSafePageUrl("xyz", undefined);
    const c = pickSafePageUrl("xyz", "");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  test("crawler class (facebookexternalhit-style fp) gets stable URL", () => {
    // Simulate what r.$code.ts produces for FB crawler fingerprints.
    const fbFingerprints = [
      "fbexternalhit:31.13.24.1",
      "facebot:157.240.1.5",
      "meta-externalagent:2a03:2880:f0fe::",
      "meta-externalfetcher:69.171.250.1",
    ];
    for (const fp of fbFingerprints) {
      const first = pickSafePageUrl("ad-code-1", fp);
      // Repeat 50× — same URL every time
      for (let i = 0; i < 50; i++) {
        expect(pickSafePageUrl("ad-code-1", fp)).toBe(first);
      }
      // URL must be in pool
      expect(SAFE_PAGE_POOL).toContain(first);
    }
  });

  test("fallback: unhealthy URL is skipped, sticky to next healthy", () => {
    const pickA = pickSafePage("code-fallback", "fp-1");
    markSafePageUnhealthy(pickA.url, 503);
    const pickB = pickSafePage("code-fallback", "fp-1");
    expect(pickB.url).not.toBe(pickA.url);
    expect(pickB.fallbackFrom).toBe(pickA.index);
    expect(SAFE_PAGE_POOL).toContain(pickB.url);
  });

  test("fallback: all unhealthy → returns original pick (no infinite loop)", () => {
    for (const u of SAFE_PAGE_POOL) markSafePageUnhealthy(u, 500);
    const pick = pickSafePage("x", "y");
    expect(SAFE_PAGE_POOL).toContain(pick.url);
  });

  test("health restoration clears unhealthy flag", () => {
    markSafePageUnhealthy(SAFE_PAGE_POOL[0], 502);
    expect(getSafePoolHealth()[0].healthy).toBe(false);
    markSafePageHealthy(SAFE_PAGE_POOL[0], 200);
    expect(getSafePoolHealth()[0].healthy).toBe(true);
  });

  test("distribution is reasonably uniform across many fingerprints", () => {
    const counts = new Map<string, number>();
    const N = 10_000;
    for (let i = 0; i < N; i++) {
      const u = pickSafePageUrl("dist-code", `visitor-${i}`);
      counts.set(u, (counts.get(u) ?? 0) + 1);
    }
    const expected = N / SAFE_PAGE_POOL.length;
    for (const u of SAFE_PAGE_POOL) {
      const c = counts.get(u) ?? 0;
      // Allow ±25% drift from perfectly uniform (djb2 isn't crypto)
      expect(c).toBeGreaterThan(expected * 0.75);
      expect(c).toBeLessThan(expected * 1.25);
    }
  });
});
