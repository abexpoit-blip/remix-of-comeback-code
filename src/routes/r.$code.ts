import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { type PrelandingTemplate, ARTICLE_TEMPLATES, pickArticleTemplateForCode, renderPrelanding } from "@/lib/prelanding-templates";
import {
  analyzeSignals,
  classifyReferrer,
  fingerprint,
  matchCloaking,
  matchReferrer,
  weightedPick,
  type CloakingRule,
  type ReferrerRule,
} from "@/lib/bot-detect";
import { redisSAddWithTTL, redisSet } from "@/lib/redis-cache.server";
import { pickSafePage, pickSafePageUrl } from "@/lib/safe-page-pool";


const SAFE_FALLBACK = "https://sleepox.com/";
const RESERVED_PUBLIC_PATHS = new Set([
  "about",
  "privacy",
  "terms",
  "contact",
  "faq",
  "shipping",
  "returns",
  "pricing",
  "cart",
  "checkout",
  "login",
  "signup",
  "blog",
  "shop",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
]);
// FULL BOT DETECTION MODE (default): cloaking rules, fingerprint auto-block,
// signal analysis (score ≥80), referrer block, and legacy UA list all run.
// These layers only catch confirmed bots (headless browsers, ahrefs/semrush,
// suspicious referrers) — zero real-user traffic loss.
// Emergency escape: set LEGACY_DIRECT_MODE=true in .env to skip these layers.
const LEGACY_DIRECT_MODE = process.env.LEGACY_DIRECT_MODE === "true";
// Desktop-block is aggressive: blocks ALL desktop users (including real
// WhatsApp Web / Messenger Web forwards). OFF by default to preserve real
// user traffic. Enable only if ad-reviewer bots are slipping through on
// desktop UAs: set STRICT_DESKTOP_BLOCK=true in .env.
const STRICT_DESKTOP_BLOCK = process.env.STRICT_DESKTOP_BLOCK === "true";
// Higher = fewer false auto-blocks. 3 was way too aggressive on mobile carrier
// NATs where thousands of real users share one /24+UA bucket. 20 means we need
// 20 confirmed bot hits from the EXACT same fingerprint before locking it out.
const BOT_BLOCK_THRESHOLD = 20;

// Pure datacenter / hosting ASNs only. We intentionally do NOT include:
//   32934 (Facebook)  – FB in-app browser traffic comes from here
//   15169 (Google)    – Google Fiber + Android device traffic
//   8075  (Microsoft) – Bing + Outlook users
//   13335 (Cloudflare)– Warp / 1.1.1.1 routes real users through this
// Those were blocking ~60% of real mobile/proxy users. Real FB crawlers are
// still caught by the UA list in step 0; cloaking_rules can add more ASNs.
const BOT_ASNS = new Set(["16509", "14618"]);

type RedirectLink = {
  id: string;
  user_id: string;
  clicks_count: number | null;
  bot_clicks_count: number | null;
  adsterra_url: string | null;
  safe_url: string | null;
  safe_url_category: string | null;
  is_active: boolean;
  prelanding_template: PrelandingTemplate | "none";
  created_at: string | null;
  blocked_countries: string[];
};

const LINK_SELECT_COLUMNS = [
  "id",
  "user_id",
  "clicks_count",
  "bot_clicks_count",
  "adsterra_url",
  "adsterra_direct_link",
  "destination_url",
  "safe_url",
  "safe_url_category",
  "is_active",
  "status",
  "prelanding_template",
  "created_at",
  "blocked_countries",
].join(",");


// Facebook ad-review window: treat FB in-app browsers + FB referers as crawler
// for the first N hours after link creation, so ad reviewers always land on
// the safe article instead of the Adsterra offer.
// Smart FB ad-review protection:
// FB ad reviewer hits a brand-new link within the first ~hour, using FB in-app
// browser or l.facebook.com referer. After that, the same UA = real users.
// We protect ONLY when BOTH conditions are true:
//   (a) link is younger than FB_AD_REVIEW_WINDOW_HOURS, AND
//   (b) link has fewer than FB_AD_REVIEW_MAX_CLICKS total clicks
// Either threshold passed → real FB/IG users get the offer normally.
// FB crawler UAs (facebookexternalhit etc.) are ALWAYS blocked in step 0
// regardless of this window — ad approval safety is preserved.
const FB_AD_REVIEW_WINDOW_HOURS = 6;
const FB_AD_REVIEW_MAX_CLICKS = 25;

// ============================================================================
// CRAWLER / LINK-PREVIEW BOT DETECTION (module-scope, pre-compiled, O(1) test)
// ============================================================================
// CRITICAL: These bots MUST get article HTML (200 OK), never offer/safe redirect.
// If we redirect link-preview crawlers, FB/Meta ads get disapproved + account bans.
//
// Sources: https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/
//          (last verified 2026-06)
// Each pattern is a lowercase substring of the UA string.
const FB_META_UA = [
  // Official Meta crawlers (https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/)
  "facebookexternalhit",   // primary link-preview scraper for FB/IG/Messenger
  "facebot",                // legacy FB crawler
  "facebookcatalog",        // FB Catalog / Commerce crawler
  "facebookplatform",       // FB Platform debugger
  "meta-externalagent",     // AI/training crawler
  "meta-externalfetcher",   // on-demand AI fetcher (bypasses robots.txt)
  "meta-externalads",       // ads quality crawler (NEW 2025)
  "meta-webindexer",        // Meta AI search indexer (NEW 2025)
  "metainspector",          // OG debugger
  "instagram-fbexternalhit",// IG-specific OG fetcher
];
const SOCIAL_PREVIEW_UA = [
  // Other social/messenger link-preview crawlers
  "whatsapp",               // WhatsApp/2.x link preview
  "twitterbot",             // Twitter/X card validator
  "linkedinbot",            // LinkedIn share preview
  "linkedin-newsletter",
  "telegrambot",
  "discordbot",
  "slackbot",
  "slack-imgproxy",
  "pinterestbot",
  "redditbot",
  "skypeuripreview",
  "snapchat",
  "tiktokbot",
  "bytespider",             // TikTok parent ByteDance crawler
  "vkshare",
  "viberbot",
  "kakaotalk-scrap",        // KakaoTalk link preview
  "line-livecheck",         // LINE messenger preview
  "yahoo! slurp",           // Yahoo Messenger / mail preview
  "naverbot",               // Naver (Korea)
  "qwantify",
];
const SEARCH_ENGINE_UA = [
  // Major search engines & ad quality bots — DO NOT serve offer to them
  "googlebot",
  "adsbot-google",
  "google-adwords",
  "google-inspectiontool",
  "googleother",
  "google-extended",
  "bingbot",
  "adidxbot",                // Bing Ads
  "msnbot",
  "duckduckbot",
  "yandexbot",
  "baiduspider",
  "applebot",                // Apple Spotlight / Siri / iMessage preview
  "petalbot",                // Huawei
  "mojeekbot",
  "ia_archiver",
  "archive.org_bot",
];
// Compiled once at module load — single substring scan per request.
const CRAWLER_UA_LIST: readonly string[] = [
  ...FB_META_UA,
  ...SOCIAL_PREVIEW_UA,
  ...SEARCH_ENGINE_UA,
] as const;
// Fast regex for one-pass detection. Escaped, alternation, case-insensitive.
const CRAWLER_UA_RE = new RegExp(
  CRAWLER_UA_LIST.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i",
);
// Subset that should be treated as FB-class (serves article + ad-safety path)
const FB_CLASS_RE = new RegExp(
  FB_META_UA.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i",
);

// Meta/Facebook ASN ranges (verified via PeeringDB + Meta network docs)
//   32934 — Facebook, Inc.
//   63293 — Facebook
//   54115 — Facebook (edge / WhatsApp infra)
const FB_ASN_SET = new Set(["32934", "63293", "54115"]);

// Always-on SCANNER / DATACENTER ASNs. Real human ad traffic NEVER originates
// from these — they are cloud/VPS providers used by FB's continuous monitoring
// scanners, competitors, security crawlers, and VPN exits. Hitting any of
// these → safe page, ALWAYS (no time window, no click threshold).
// Sources: PeeringDB, IANA RIR data, public datacenter ASN lists.
const DATACENTER_ASNS = new Set([
  // AWS
  "16509", "14618", "39111",
  // Google Cloud (NOT 15169 = consumer Google + Android)
  "396982", "139070", "19527",
  // Microsoft Azure (NOT 8075 = Bing+consumer; kept out to avoid Edge users)
  "8068", "8069", "12076",
  // Cloudflare datacenter (NOT 13335 = Warp/1.1.1.1 real users)
  "209242", "395747",
  // DigitalOcean
  "14061", "133165", "200130",
  // Linode / Akamai cloud
  "63949", "20940",
  // Vultr / Choopa
  "20473",
  // Hetzner
  "24940", "213230",
  // OVH
  "16276", "35540",
  // Oracle Cloud
  "31898",
  // Alibaba Cloud
  "45102", "37963",
  // Tencent Cloud
  "132203", "45090",
  // Other commonly-abused VPS / hosting
  "9009", "29073", "51167", "62240", "60068", "60781", "29802", "46606",
]);

// Multi-link velocity threshold: same IP hitting N+ distinct short_codes
// within 1 hour → almost certainly a scanner (FB monitor, competitor crawler,
// security scanner). Real users click ONE ad link per session.
// Raised 3 → 6 in 2026-07 after production data showed 3-5 was firing almost
// entirely on mobile-carrier-NAT users (see the calibration note at the
// call site). Genuine scanners enumerate 10+ codes/hour and still trip this.
// 2026-08: raised 6 → 12. The only genuine scanner found in the 24h audit
// touched 12+ distinct codes, while shared mobile-carrier NAT IPs routinely
// reach 6-10 legitimately (whole neighbourhoods behind one IPv4).
const MULTILINK_SCANNER_THRESHOLD = 12;

const MULTILINK_WINDOW_SEC = 3600;

// Meta-owned IP prefixes (most common reviewer egress ranges).
// IMPORTANT: keep both IPv4 AND IPv6 — Facebook's crawler is now mostly IPv6
// out of 2a03:2880::/29. Missing the IPv6 prefix caused real FB crawlers to
// be flagged as "spoofers" and redirected → ad rejections.
const FB_IP_PREFIX_LIST = [
  // IPv4
  "31.13.",
  "157.240.",
  "66.220.",
  "69.63.",
  "69.171.",
  "173.252.",
  "204.15.20.",
  "199.201.64.",
  "129.134.",                // Meta corp
  "179.60.192.",
  "185.60.216.",
  "185.60.218.",
  "102.132.",                // Meta Africa edge
  // IPv6 — Facebook AS32934 owns 2a03:2880::/32, current crawler egress
  "2a03:2880:",
  "2620:0:1c00:",            // Meta corp v6
  "2620:0:1cff:",
  "2a03:83e0:",              // WhatsApp edge v6
];


function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  const u = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(u)) return "tablet";
  if (/mobile|iphone|android|phone|webos|opera mini/.test(u)) return "mobile";
  return "desktop";
}

/**
 * True when the visit carries evidence of a real paid-social / search ad click.
 *
 * Every genuine click coming from a Facebook, Instagram, TikTok, Google or
 * Twitter ad arrives with a click-id query parameter or a social referrer.
 * A reviewer (or scraper) that types the URL by hand has neither — which is
 * exactly the traffic we want to keep on the article page.
 */
const AD_CLICK_PARAMS = [
  "fbclid",
  "gclid",
  "ttclid",
  "twclid",
  "msclkid",
  "igshid",
  "utm_source",
  "utm_campaign",
  "ref",
];
const SOCIAL_REFERRER_RE =
  /(facebook|fb\.me|fbcdn|instagram|messenger|whatsapp|tiktok|t\.co|twitter|x\.com|snapchat|pinterest|google|bing|yandex)\./i;

function hasAdClickSignal(url: URL, referer: string): boolean {
  for (const p of AD_CLICK_PARAMS) {
    if (url.searchParams.has(p)) return true;
  }
  if (referer && SOCIAL_REFERRER_RE.test(referer)) return true;
  return false;
}

// ------- In-memory Cache for High Traffic (TTL 2-5 mins) -------
// Drastically reduces DB load by caching global rules & settings.
const globalCache = {
  settings: null as any,
  cloaking: [] as any[],
  referrer: [] as any[],
  whitelist: [] as Array<{ id: string; rule_type: string; pattern: string; label: string | null }>,
  botRules: [] as Array<{ pattern: string | null; label: string | null; rule_type: string }>,
  tiers: new Map<string, number>(),
  lastFetch: 0,
};
const CACHE_TTL = 3 * 60 * 1000; // 3 mins
let globalCacheLoading: Promise<void> | null = null;

type CacheHit<T> = { value: T; expiresAt: number };
// Hybrid cache: L1 (in-memory, short TTL for request coalescing) + L2 (Redis, full TTL, shared across all 8 workers).
// L2 TTL = source of truth across processes. L1 TTL kept short so any DB-fresh write on another worker
// propagates within seconds via L2 lookups.
const LINK_CACHE_TTL_MS = 30 * 60 * 1000;    // L2 = 30m
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;  // L2 = 5m
const OFFER_CACHE_TTL_MS = 30 * 60 * 1000;   // L2 = 30m
const FP_CACHE_TTL_MS = 10 * 60 * 1000;      // L2 = 10m

// L1 TTLs — short. Just coalesces bursts within a single worker.
const LINK_L1_TTL_MS = 30 * 1000;
const PROFILE_L1_TTL_MS = 15 * 1000;
const OFFER_L1_TTL_MS = 30 * 1000;
const FP_L1_TTL_MS = 60 * 1000;

const REDIRECT_CACHE_MAX = 50_000;
const linkCache = new Map<string, CacheHit<RedirectLink>>();
const profileQuotaCache = new Map<string, CacheHit<{ click_quota: number | null; clicks_used: number | null } | null>>();
const offerCache = new Map<string, CacheHit<{ abRows: any[]; geoRows: any[] }>>();
const fpBlockedCache = new Map<string, CacheHit<boolean>>();

// In-flight de-duplication: collapses N concurrent requests for same key into 1 DB query.
const linkInflight = new Map<string, Promise<{ link: RedirectLink | null; error: Error | null }>>();
const profileInflight = new Map<string, Promise<{ click_quota: number | null; clicks_used: number | null } | null>>();
const offerInflight = new Map<string, Promise<{ abRows: any[]; geoRows: any[] }>>();

// L2 Redis cache (shared across all 8 PM2 workers). Best-effort: never throws.
import { redisGet, redisSetAsync } from "@/lib/redis-cache.server";
const L2_LINK_PREFIX = "rd:link:";
const L2_PROFILE_PREFIX = "rd:prof:";
const L2_OFFER_PREFIX = "rd:offer:";
const L2_FP_PREFIX = "rd:fp:";

// Stale read — returns last-known value even if expired (used as DB-failure fallback).
function cacheGetStale<T>(cache: Map<string, CacheHit<T>>, key: string): T | null {
  const hit = cache.get(key);
  return hit ? hit.value : null;
}

function cacheGet<T>(cache: Map<string, CacheHit<T>>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    // Keep entry as stale fallback — only LRU eviction removes it.
    return null;
  }
  return hit.value;
}

function cacheSet<T>(cache: Map<string, CacheHit<T>>, key: string, value: T, ttlMs: number) {
  if (cache.size >= REDIRECT_CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function timedQuery<T = any>(query: any, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await (typeof query.abortSignal === "function" ? query.abortSignal(ctrl.signal) : query);
  } finally {
    clearTimeout(timer);
  }
}

async function refreshGlobalCache() {
  const now = Date.now();
  if (now - globalCache.lastFetch < CACHE_TTL && globalCache.settings) return;
  if (globalCacheLoading) return globalCacheLoading;

  globalCacheLoading = (async () => { try {
    const [s, c, r, t, w, br] = await Promise.all([
      timedQuery(supabaseAdmin.from("app_settings").select("*").eq("id", true).maybeSingle(), 1200),
      timedQuery(supabaseAdmin.from("cloaking_rules").select("*").eq("is_active", true).order("priority"), 1200),
      timedQuery(supabaseAdmin.from("referrer_rules").select("*").eq("is_active", true), 1200),
      timedQuery(supabaseAdmin.from("country_tiers").select("country_code, tier"), 1200),
      timedQuery(supabaseAdmin.from("bot_whitelist" as never).select("id, rule_type, pattern, label").eq("is_active", true), 1200),
      timedQuery(supabaseAdmin.from("bot_rules").select("pattern, label, rule_type").eq("is_active", true), 1200),
    ]);
    if (s.data) globalCache.settings = s.data;
    if (c.data) globalCache.cloaking = c.data;
    if (r.data) globalCache.referrer = r.data;
    if ((w as any).data) globalCache.whitelist = (w as any).data as any;
    if (br.data) globalCache.botRules = br.data as any;
    if (t.data) {
      globalCache.tiers.clear();
      t.data.forEach((row: any) => globalCache.tiers.set(row.country_code.toUpperCase(), row.tier));
    }
    globalCache.lastFetch = now;
  } catch (e) {
    console.error("[cache] failed to refresh global config", e);
    globalCache.lastFetch = now;
  } finally {
    globalCacheLoading = null;
  } })();
  return globalCacheLoading;
}

// Whitelist matcher — returns matching rule if request signature is explicitly
// trusted (real-user ASN/UA/Referrer combos). FB crawler block runs BEFORE
// this, so whitelist can never bypass ad-safety protection.
function matchWhitelist(
  rules: Array<{ id: string; rule_type: string; pattern: string; label: string | null }>,
  ctx: { ua: string; asn: string | null; ip: string | null; ref: string; country: string | null },
): { id: string; label: string } | null {
  const uaLow = ctx.ua.toLowerCase();
  const refLow = ctx.ref.toLowerCase();
  for (const r of rules) {
    const p = (r.pattern || "").toLowerCase().trim();
    if (!p) continue;
    let hit = false;
    if (r.rule_type === "ua") hit = uaLow.includes(p);
    else if (r.rule_type === "asn") hit = !!ctx.asn && ctx.asn === p;
    else if (r.rule_type === "ip") hit = !!ctx.ip && ctx.ip.startsWith(p);
    else if (r.rule_type === "ref") hit = refLow === p || refLow.endsWith(`.${p}`);
    else if (r.rule_type === "combo") {
      // Format: ua=fban&asn=32934&ref=facebook.com&ip=157.240.&country=us
      // ALL listed conditions must match (case-insensitive).
      const parts = p.split("&").map((x) => x.trim()).filter(Boolean);
      hit = parts.length > 0 && parts.every((kv) => {
        const [k, ...rest] = kv.split("=");
        const v = rest.join("=").trim();
        if (!v) return false;
        if (k === "ua") return uaLow.includes(v);
        if (k === "asn") return ctx.asn === v;
        if (k === "ip") return !!ctx.ip && ctx.ip.startsWith(v);
        if (k === "ref") return refLow === v || refLow.endsWith(`.${v}`);
        if (k === "country") return (ctx.country || "").toLowerCase() === v;
        return false;
      });
    }
    if (hit) return { id: r.id, label: r.label || `${r.rule_type}:${p}` };
  }
  return null;
}

// ------- IP → Country lookup (workerd-compatible, no native deps) -------
// Cache by /24 subnet to drastically reduce upstream calls under high traffic.
const countryCache = new Map<string, { c: string; exp: number }>();
const COUNTRY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const COUNTRY_CACHE_MAX = 50_000;

function subnetKey(ip: string): string {
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":"); // IPv6 /64-ish
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : ip;
}

// Circuit breaker: upstream geo API rate-limits us under heavy traffic.
// After repeated failures we stop calling it for a while (cheap "" country)
// instead of burning 1.2s per request and flooding the error log.
let geoFailStreak = 0;
let geoOpenUntil = 0;
let geoLastLogAt = 0;
const GEO_TRIP_AFTER = 12; // consecutive failures (all providers) before opening
const GEO_OPEN_MS = 60_000; // stay open 60s, then probe again
const GEO_MAX_INFLIGHT = 4; // never let geo lookups pile up under load
// Dedupe concurrent lookups for the same subnet (8 workers × high RPS)
const geoInflight = new Map<string, Promise<string>>();

// Multiple free providers — api.country.is rate-limits us at our volume, so we
// rotate. Each returns a 2-letter country code (or "" when it fails).
const GEO_PROVIDERS: Array<(ip: string, signal: AbortSignal) => Promise<string>> = [
  async (ip, signal) => {
    const r = await fetch(`https://get.geojs.io/v1/ip/country/${encodeURIComponent(ip)}.json`, {
      signal,
      headers: { accept: "application/json" },
    });
    if (!r.ok) return "";
    const j = (await r.json()) as { country?: string };
    return (j.country || "").toUpperCase();
  },
  async (ip, signal) => {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=country_code`, {
      signal,
      headers: { accept: "application/json" },
    });
    if (!r.ok) return "";
    const j = (await r.json()) as { country_code?: string };
    return (j.country_code || "").toUpperCase();
  },
  async (ip, signal) => {
    const r = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, {
      signal,
      headers: { accept: "application/json" },
    });
    if (!r.ok) return "";
    const j = (await r.json()) as { country?: string };
    return (j.country || "").toUpperCase();
  },
];
// Round-robin start index so load spreads across providers.
let geoProviderCursor = 0;

// Background (non-blocking) refresh. The redirect path NEVER awaits this —
// a slow upstream must not add latency to a user's click.
function scheduleCountryLookup(ip: string): void {
  const key = subnetKey(ip);
  const now = Date.now();
  if (now < geoOpenUntil) return;
  if (geoInflight.size >= GEO_MAX_INFLIGHT) return;
  if (geoInflight.has(key)) return;

  const task = (async (): Promise<string> => {
    const start = geoProviderCursor++ % GEO_PROVIDERS.length;
    for (let i = 0; i < GEO_PROVIDERS.length; i++) {
      const provider = GEO_PROVIDERS[(start + i) % GEO_PROVIDERS.length];
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      try {
        const c = await provider(ip, ctrl.signal);
        clearTimeout(t);
        if (c && /^[A-Z]{2}$/.test(c)) {
          geoFailStreak = 0;
          if (countryCache.size >= COUNTRY_CACHE_MAX) {
            const firstKey = countryCache.keys().next().value;
            if (firstKey) countryCache.delete(firstKey);
          }
          countryCache.set(key, { c, exp: Date.now() + COUNTRY_TTL_MS });
          return c;
        }
      } catch {
        // try next provider
      } finally {
        clearTimeout(t);
      }
    }

    // Every provider failed for this IP
    geoFailStreak++;
    if (geoFailStreak >= GEO_TRIP_AFTER) {
      geoOpenUntil = Date.now() + GEO_OPEN_MS;
      geoFailStreak = 0;
      if (now - geoLastLogAt > 600_000) {
        geoLastLogAt = now;
        console.warn(`[redirect] geo breaker OPEN for ${GEO_OPEN_MS / 1000}s (all providers down)`);
      }
    }

    // Negative cache for 10 min to avoid hammering on bad IPs
    countryCache.set(key, { c: "", exp: Date.now() + 10 * 60 * 1000 });
    return "";
  })().finally(() => {
    geoInflight.delete(key);
  });

  geoInflight.set(key, task);
  void task.catch(() => {});
}


// Synchronous, zero-latency read: cache only. Warms the cache in background.
function lookupCountryByIp(ip: string): string {
  const key = subnetKey(ip);
  const hit = countryCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.c;
  scheduleCountryLookup(ip);
  return "";
}

/**
 * Bounded, awaitable geo lookup. Only used on the narrow path where a wrong
 * answer is expensive AND a guess is unacceptable: a link that has an explicit
 * Country Shield list. Everywhere else we stay on the zero-latency cache read.
 * Returns "" if the lookup can't answer within `budgetMs` — callers must treat
 * "" as "unknown", never as a block.
 */
async function resolveCountryByIp(ip: string, budgetMs = 400): Promise<string> {
  const key = subnetKey(ip);
  const hit = countryCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.c;
  scheduleCountryLookup(ip);
  const inflight = geoInflight.get(key);
  if (!inflight) return "";
  try {
    const c = await Promise.race([
      inflight,
      new Promise<string>((resolve) => setTimeout(() => resolve(""), budgetMs)),
    ]);
    return /^[A-Z]{2}$/.test(c) ? c : "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// KNOWN-HUMAN SESSION PASS (2026-08)
//
// Bug report: a visitor who already reached the offer gets the SAFE ARTICLE on
// their next hit — double-click, "open in new tab", back-then-forward, or the
// link owner opening their own link from the dashboard in a second tab.
//
// Cause: the second request looks *worse* than the first even though it is the
// same person. A new tab / duplicated tab drops the Referer (default
// `strict-origin-when-cross-origin`) and often the ad-click param, so the
// direct-hit heuristics (fb-reviewer-geo on fresh links, desktop guard) fire on
// a visitor who was already classified human seconds earlier.
//
// Fix: once a fingerprint is served a real offer for a link, remember it in
// Redis (shared across all 8 workers) and let that visitor keep the offer for
// HUMAN_PASS_TTL_SEC. Hard bot rules (Meta crawler UA/ASN/IP, datacenter ASN,
// generic crawler UA, the user's own Country Shield) are NOT bypassed — only
// the soft heuristics that rely on referer/ad-param presence.
// ---------------------------------------------------------------------------
const HUMAN_PASS_TTL_SEC = 6 * 60 * 60; // 6h — covers a browsing session
const HUMAN_PASS_PREFIX = "hum:";
// Browser-side pass. A cookie survives everything a fingerprint does not:
// new tab / duplicated tab / back-forward / a different link code / Redis down.
const HUMAN_COOKIE = "_sxh";

function humanPassKey(code: string, fpHash: string): string {
  return `${HUMAN_PASS_PREFIX}${code}:${fpHash}`;
}

/** Fingerprint pass that is NOT scoped to one link code. */
function humanPassGlobalKey(fpHash: string): string {
  return `${HUMAN_PASS_PREFIX}g:${fpHash}`;
}

function hasHumanCookie(request: Request): boolean {
  const raw = request.headers.get("cookie") || "";
  return raw.split(";").some((part) => part.trim().startsWith(`${HUMAN_COOKIE}=1`));
}

function humanCookieHeader(): string {
  return `${HUMAN_COOKIE}=1; Max-Age=${HUMAN_PASS_TTL_SEC}; Path=/; SameSite=Lax; Secure`;
}

/** Best-effort read. Redis down → false (cookie check still covers the tab case). */
async function isKnownHuman(code: string, fpHash: string): Promise<boolean> {
  if (!fpHash) return false;
  try {
    const [perLink, global] = await Promise.all([
      redisGet<number>(humanPassKey(code, fpHash)),
      redisGet<number>(humanPassGlobalKey(fpHash)),
    ]);
    return perLink === 1 || global === 1;
  } catch {
    return false;
  }
}

/** Fire-and-forget mark. Never blocks the redirect. */
function markKnownHuman(code: string, fpHash: string): void {
  if (!fpHash) return;
  void redisSet(humanPassKey(code, fpHash), 1, HUMAN_PASS_TTL_SEC * 1000).catch(() => {});
  void redisSet(humanPassGlobalKey(fpHash), 1, HUMAN_PASS_TTL_SEC * 1000).catch(() => {});
}








function sanitizeRedirectTarget(target: string | null | undefined): string {
  try {
    if (!target) return SAFE_FALLBACK;
    const parsed = new URL(target);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return SAFE_FALLBACK;
    return parsed.toString();
  } catch {
    return SAFE_FALLBACK;
  }
}

// Ad networks (Adsterra direct link) only register a visit when a real browser
// with JS loads the destination and sends a Referer. A bare 302 from the edge is
// frequently dropped by their anti-fraud filter (no referrer, no JS, no window).
// For monetised "ours" traffic we therefore bounce through a 1-frame HTML page
// that navigates client-side with referrer intact.
// Internal routing headers (X-Sleepox-Route / -Reason) expose how a request was
// classified. Anyone (including Meta / ad reviewers) could read them and
// fingerprint the system, so they are OFF unless SLEEPOX_DEBUG_HEADERS=1.
const DEBUG_HEADERS = process.env.SLEEPOX_DEBUG_HEADERS === "1";

function setDebugHeaders(headers: Headers, route: string, reason?: string | null) {
  if (!DEBUG_HEADERS) return;
  headers.set("X-Sleepox-Route", route);
  if (reason)
    headers.set("X-Sleepox-Reason", reason.replace(/[^a-zA-Z0-9:._ -]/g, "").slice(0, 80));
}

function browserBounce(target: string, route: string, reason?: string | null) {
  const safe = sanitizeRedirectTarget(target);
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "unsafe-url",
  });
  setDebugHeaders(headers, route, reason);
  const url = htmlEscape(safe);
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="referrer" content="unsafe-url">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${url}">
<title>Loading…</title>
<style>html,body{height:100%;margin:0;background:#0b0b0f;color:#e5e7eb;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center}
.s{width:34px;height:34px;border:3px solid #2a2a35;border-top-color:#7c3aed;border-radius:50%;animation:r .8s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}</style></head>
<body><div class="s"></div>
<script>location.replace(${JSON.stringify(safe)});</script>
<noscript><a href="${url}">Continue</a></noscript></body></html>`;
  return new Response(html, { status: 200, headers });
}

function redirectTo(
  target: string | null | undefined,
  route: "safe" | "offer" | "ours" | "fallback",
  reason?: string | null,
  setHumanCookie = false,
) {
  if (route === "ours") return browserBounce(target ?? "", route, reason);
  const headers = new Headers({
    Location: sanitizeRedirectTarget(target),
    "Cache-Control": "no-store",
  });
  // Second-tab fix: remember this browser as human so a duplicated tab or a
  // direct hit without referer/fbclid is not re-classified into the article.
  if (setHumanCookie) headers.append("Set-Cookie", humanCookieHeader());
  setDebugHeaders(headers, route, reason);
  return new Response(null, { status: 302, headers });
}


function htmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderReservedPublicPage(code: string, publicOrigin: string) {
  const path = `/${code}`;
  const canonical = `${publicOrigin}${path}`;
  const page = code === "contact"
    ? {
        title: "Contact — BreezySocial",
        description: "Reach the BreezySocial customer care team for order questions, returns, and product support.",
        h1: "Contact",
        body: `
          <p>Questions about an order, return, or product? Our customer care team reads every message.</p>
          <dl>
            <dt>Email</dt><dd><a href="mailto:hello@breezysocial.com">hello@breezysocial.com</a></dd>
            <dt>Support</dt><dd><a href="mailto:support@breezysocial.com">support@breezysocial.com</a></dd>
            <dt>Phone</dt><dd>+1 (415) 555-0142</dd>
            <dt>Office</dt><dd>1280 Market Street, Suite 400, San Francisco, CA 94102</dd>
          </dl>
        `,
      }
    : code === "privacy"
      ? {
          title: "Privacy Policy — BreezySocial",
          description: "How BreezySocial collects, uses, and protects customer information.",
          h1: "Privacy Policy",
          body: `
            <p>BreezySocial respects your privacy. This policy explains how we collect, use, and protect information when you visit our website or contact us.</p>
            <h2>Information we collect</h2>
            <p>We collect information you provide directly, such as your name, email address, shipping details, and messages to customer support. We also collect basic website usage data such as pages viewed, device type, and timestamps.</p>
            <h2>How we use information</h2>
            <p>We use information to process orders, respond to support requests, improve our products, prevent fraud, and meet legal obligations.</p>
            <h2>Sharing</h2>
            <p>We do not sell personal information. We share information only with trusted service providers when needed to operate our store and support customers.</p>
            <h2>Contact</h2>
            <p>For privacy questions, email <a href="mailto:hello@breezysocial.com">hello@breezysocial.com</a>.</p>
          `,
        }
      : null;

  if (!page) return null;
  const title = htmlEscape(page.title);
  const description = htmlEscape(page.description);
  const safeCanonical = htmlEscape(canonical);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${safeCanonical}" />
  <meta property="og:site_name" content="BreezySocial" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${safeCanonical}" />
  <meta property="og:image" content="${htmlEscape(publicOrigin)}/og-default.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${htmlEscape(publicOrigin)}/og-default.png" />
  <style>
    body{margin:0;background:#faf7f2;color:#2a2a28;font-family:Arial,Helvetica,sans-serif;line-height:1.65}
    header,main,footer{max-width:880px;margin:0 auto;padding:28px 24px}
    nav{display:flex;gap:18px;flex-wrap:wrap;font-size:14px}a{color:#476b43}h1{font-size:44px;line-height:1.1;margin:40px 0 18px}h2{font-size:22px;margin-top:32px}dl{display:grid;grid-template-columns:110px 1fr;gap:12px 18px}dt{font-weight:700}footer{border-top:1px solid #e8e2d5;color:#6b665e;font-size:14px}
  </style>
</head>
<body>
  <header><nav><a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></header>
  <main><h1>${htmlEscape(page.h1)}</h1>${page.body}</main>
  <footer>© ${new Date().getUTCFullYear()} BreezySocial · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/contact">Contact</a></footer>
</body>
</html>`;
}

type RedirectClickInput = {
  eventId?: string;
  attempt?: number;
  linkId: string;
  userId: string;
  ip: string | null;
  country: string | null;
  ua: string | null;
  isBot: boolean;
  botReason: string | null;
  routedTo: "safe" | "offer" | "ours" | "fb-article";
  utm: Record<
    "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content",
    string | null
  >;
  refererHost: string | null;
  botScore: number;
  signals: Record<string, unknown>;
  challengePassed: boolean;
  fingerprintHash?: string | null;
  abVariant?: string | null;
};

type ClickBatchState = {
  queue: RedirectClickInput[];
  flushing: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  enqueued: number;
  flushed: number;
  dropped: number;
  failed: number;
};

// Tuned for sustained throughput without overwhelming PostgREST/DB. In 8 PM2
// workers, high per-worker parallelism creates 50+ simultaneous RPCs and causes
// upstream timeouts, so keep per-worker flushing serial and use idempotent retries.
// Batch size is ADAPTIVE: it shrinks on timeouts and slowly grows back when the
// DB is healthy, so slow-RPC windows never turn into retry storms.
const CLICK_BATCH_SIZE = 50;
const CLICK_BATCH_SIZE_MIN = 20;
const CLICK_BATCH_SIZE_MAX = 100;
const CLICK_BATCH_QUEUE_MAX = 50_000;
const CLICK_BATCH_FLUSH_MS = 400;
const CLICK_BATCH_TIMEOUT_MS = 60_000;
const CLICK_BATCH_MAX_PARALLEL = 1;
const CLICK_BATCH_MAX_ATTEMPTS = 10;

type ClickBatchStateExt = ClickBatchState & {
  inFlight: number;
  retryNotBefore: number;
  batchSize: number;
};


function getClickBatchState(): ClickBatchStateExt {
  const g = globalThis as typeof globalThis & { __sleepoxClickBatch?: ClickBatchStateExt };
  if (!g.__sleepoxClickBatch) {
    g.__sleepoxClickBatch = {
      queue: [],
      flushing: false,
      timer: null,
      enqueued: 0,
      flushed: 0,
      dropped: 0,
      failed: 0,
      inFlight: 0,
      retryNotBefore: 0,
      batchSize: CLICK_BATCH_SIZE,
    };
  }
  const state = g.__sleepoxClickBatch;
  // Migrate older state without newer fields
  if (typeof state.inFlight !== "number") state.inFlight = 0;
  if (typeof state.retryNotBefore !== "number") state.retryNotBefore = 0;
  if (typeof state.batchSize !== "number") state.batchSize = CLICK_BATCH_SIZE;
  return state;

}

function toClickBatchEvent(input: RedirectClickInput) {
  return {
    id: input.eventId,
    link_id: input.linkId,
    user_id: input.userId,
    ip: input.ip,
    country: input.country,
    ua: input.ua,
    is_bot: input.isBot,
    bot_reason: input.botReason,
    routed_to: input.routedTo,
    utm_source: input.utm?.utm_source ?? null,
    utm_medium: input.utm?.utm_medium ?? null,
    utm_campaign: input.utm?.utm_campaign ?? null,
    utm_term: input.utm?.utm_term ?? null,
    utm_content: input.utm?.utm_content ?? null,
    referer_host: input.refererHost ?? null,
    bot_score: input.botScore ?? 0,
    signals: (input.signals ?? {}) as Json,
    challenge_passed: input.challengePassed,
  };
}

function scheduleClickBatchFlush(delayMs = CLICK_BATCH_FLUSH_MS) {
  const state = getClickBatchState();
  if (state.timer) return;
  state.timer = setTimeout(() => {
    state.timer = null;
    void flushClickBatch();
  }, delayMs);
  if (typeof state.timer === "object" && "unref" in state.timer) {
    (state.timer as { unref: () => void }).unref();
  }
}

function enqueueClickForBatch(input: RedirectClickInput) {
  const state = getClickBatchState();
  if (state.queue.length >= CLICK_BATCH_QUEUE_MAX) {
    state.queue.shift();
    state.dropped += 1;
    if (state.dropped === 1 || state.dropped % 100 === 0) {
      console.warn(`[click-batch][DROP] total=${state.dropped} queue=${state.queue.length}`);
    }
  }
  state.queue.push({
    ...input,
    eventId: input.eventId ?? crypto.randomUUID(),
    attempt: input.attempt ?? 0,
  });
  state.enqueued += 1;
  if (state.queue.length >= state.batchSize) void flushClickBatch();
  else scheduleClickBatchFlush();
}

async function flushClickBatch(force = false) {
  const state = getClickBatchState();
  const retryWaitMs = state.retryNotBefore - Date.now();
  if (!force && retryWaitMs > 0) {
    scheduleClickBatchFlush(retryWaitMs);
    return;
  }
  // Allow up to N parallel in-flight RPCs (instead of strict serial)
  if (state.inFlight >= CLICK_BATCH_MAX_PARALLEL) return;
  if (state.queue.length === 0) return;
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  const batch = state.queue.splice(0, Math.max(CLICK_BATCH_SIZE_MIN, Math.min(state.batchSize, CLICK_BATCH_SIZE_MAX)));
  if (batch.length === 0) return;

  state.inFlight += 1;
  const startedAt = Date.now();
  try {
    const events = batch.map(toClickBatchEvent);
    const result = await timedQuery<{ error?: unknown }>(
      supabaseAdmin.rpc("record_redirect_clicks_batch" as never, { _events: events } as never),
      CLICK_BATCH_TIMEOUT_MS,
    );
    if (result?.error) throw result.error;
    state.flushed += batch.length;
    state.retryNotBefore = 0;
    // Healthy + fast RPC → grow batch back gradually; slow RPC → shrink early
    const elapsed = Date.now() - startedAt;
    if (elapsed > 10_000) {
      state.batchSize = Math.max(CLICK_BATCH_SIZE_MIN, Math.floor(state.batchSize / 2));
    } else if (elapsed < 3_000 && state.batchSize < CLICK_BATCH_SIZE_MAX) {
      state.batchSize = Math.min(CLICK_BATCH_SIZE_MAX, state.batchSize + 10);
    }

  } catch (error) {
    const raw = (error as Error)?.message || String(error);
    const reason = /abort|timeout/i.test(raw) ? "timeout" : raw.slice(0, 120);
    const retriable = /abort|timeout|upstream|temporar|network|fetch|invalid response|pldbgapi|call stack|schema cache|ECONN|EAI_AGAIN|connection pool|502|503|504/i.test(raw);
    // Back off batch size on timeouts so the retry lands on a smaller payload
    if (reason === "timeout") {
      state.batchSize = Math.max(CLICK_BATCH_SIZE_MIN, Math.floor(state.batchSize / 2));
    }
    const retryBatch = retriable

      ? batch
          .filter((item) => (item.attempt ?? 0) < CLICK_BATCH_MAX_ATTEMPTS)
          .map((item) => ({ ...item, attempt: (item.attempt ?? 0) + 1 }))
      : [];

    if (retryBatch.length > 0 && state.queue.length + retryBatch.length <= CLICK_BATCH_QUEUE_MAX) {
      state.queue.unshift(...retryBatch);
      const highestAttempt = Math.max(...retryBatch.map((item) => item.attempt ?? 1));
      const backoffMs = Math.min(5_000, 250 * (2 ** Math.min(highestAttempt, 4))) + Math.floor(Math.random() * 250);
      state.retryNotBefore = Date.now() + backoffMs;
      if (state.failed === 0 || state.failed % 1000 < batch.length) {
        console.warn(`[click-batch][RETRY] count=${retryBatch.length} reason=${reason} queue=${state.queue.length} inFlight=${state.inFlight} backoffMs=${backoffMs}`);
      }
    } else {
      state.failed += batch.length;
      if (state.failed === batch.length || state.failed % 1000 < batch.length) {
        console.warn(`[click-batch][FAIL] dropped=${state.failed} reason=${reason} queue=${state.queue.length} inFlight=${state.inFlight}`);
      }
    }
  } finally {
    state.inFlight -= 1;
    // Immediately kick another flush if queue still has work and capacity remains
    const remainingBackoffMs = state.retryNotBefore - Date.now();
    if (!force && remainingBackoffMs > 0) {
      scheduleClickBatchFlush(remainingBackoffMs);
    } else if (state.queue.length >= state.batchSize && state.inFlight < CLICK_BATCH_MAX_PARALLEL) {
      void flushClickBatch();
    } else if (state.queue.length > 0) {
      scheduleClickBatchFlush(25);
    }
  }
}

// Register a one-time graceful shutdown hook to drain the click queue before
// PM2 sends SIGKILL. Without this every deploy loses ~100 queued clicks.
function installClickBatchShutdownHook() {
  const g = globalThis as typeof globalThis & { __sleepoxClickShutdownInstalled?: boolean };
  if (g.__sleepoxClickShutdownInstalled) return;
  g.__sleepoxClickShutdownInstalled = true;

  const drain = async (signal: string) => {
    const state = getClickBatchState();
    const start = Date.now();
    // Flush repeatedly until queue is empty or 12s elapsed (PM2 kill_timeout=15s).
    while (state.queue.length > 0 && Date.now() - start < 12_000) {
      try {
        await flushClickBatch(true);
      } catch {
        break;
      }
    }
    if (state.queue.length > 0) {
      console.warn(`[click-batch][SHUTDOWN] ${signal} could not drain ${state.queue.length} clicks`);
    } else {
      console.log(`[click-batch][SHUTDOWN] ${signal} drained cleanly (flushed=${state.flushed} failed=${state.failed})`);
    }
  };

  // Don't add `process.exit()` — let TanStack's own graceful server close run.
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.once(sig, () => {
      void drain(sig);
    });
  }
}

installClickBatchShutdownHook();


export async function recordRedirectClick(input: RedirectClickInput) {
  // Never block redirects on analytics writes. One PM2 worker now sends clicks
  // in small batches, avoiding the AbortError storm from one RPC per visitor.
  enqueueClickForBatch(input);

  // Bot fingerprint learning (separate RPC, atomic upsert)
  if (input.fingerprintHash && input.isBot) {
    Promise.resolve(
      timedQuery(
        supabaseAdmin.rpc(
          "record_bot_fingerprint" as never,
          {
            _hash: input.fingerprintHash,
            _is_bot: input.isBot,
            _ip: input.ip,
            _ua: input.ua,
            _country: input.country,
            _block_threshold: BOT_BLOCK_THRESHOLD,
          } as never,
        ),
        700,
      ),
    ).catch(() => {});
  }

  // A/B variant click counter (best-effort)
  if (input.abVariant && !input.isBot) {
    Promise.resolve(
      timedQuery(
        supabaseAdmin.rpc(
          "increment_ab_variant_clicks" as never,
          {
            _link_id: input.linkId,
            _variant_label: input.abVariant,
          } as never,
        ),
        700,
      ),
    ).catch(() => {});
  }
}


export async function lookupRedirectLink(
  code: string,
): Promise<{ link: RedirectLink | null; error: Error | null }> {
  const cached = cacheGet(linkCache, code);
  if (cached) return { link: cached, error: null };

  // In-flight de-dup: collapse N concurrent requests for the same code into 1
  // DB query. The promise MUST be registered before the first await, otherwise
  // a second request arriving during the Redis round-trip misses the map and
  // issues its own query (double-click / duplicate-tab burst).
  const existing = linkInflight.get(code);
  if (existing) return existing;

  const promise = (async (): Promise<{ link: RedirectLink | null; error: Error | null }> => {
    // L2 (Redis): try shared cache before DB. Populated by any of the 8 workers.
    const l2 = await redisGet<RedirectLink>(L2_LINK_PREFIX + code);
    if (l2) {
      cacheSet(linkCache, code, l2, LINK_L1_TTL_MS);
      return { link: l2, error: null };
    }

    let res: any = null;
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const ctrl = new AbortController();
      // Bumped from 3200 → 5000ms: under load the DB pool occasionally needs
      // ~3-4s. 5s + 3 retries removes the bulk of "AbortError" lookup failures.
      const timer = setTimeout(() => ctrl.abort(), 5000);
      try {
        const query = supabaseAdmin
          .from("links")
          .select(LINK_SELECT_COLUMNS)
          .eq("short_code", code)
          .maybeSingle();
        res = await (query as any).abortSignal(ctrl.signal);
      } catch (error) {
        lastErr = error;
        await new Promise((r) => setTimeout(r, 120 * attempt));
        continue;
      } finally {
        clearTimeout(timer);
      }
      if (!res.error) { lastErr = null; break; }
      lastErr = res.error;
      const msg = String(res.error?.message || "");
      const errCode = String((res.error as any)?.code || "");
      const transient =
        errCode === "PGRST002" ||
        errCode === "PGRST001" ||
        /schema cache|upstream|fetch failed|timeout|aborted|ECONN|EAI_AGAIN|connection pool|503|502|504/i.test(msg);
      if (!transient) break;
      await new Promise((r) => setTimeout(r, 120 * attempt));
    }
    if (lastErr) {
      // STALE-ON-ERROR: prefer expired cache over redirect failure.
      const stale = cacheGetStale(linkCache, code);
      return stale ? { link: stale, error: null } : { link: null, error: lastErr as unknown as Error };
    }
    if (!res || !res.data) return { link: null, error: null };
    // Build the link inside the shared promise so EVERY concurrent waiter gets
    // the real link (previously only the first caller did — the others received
    // link:null and were sent to the safe article).
    return processLinkRow(code, res.data);
  })();

  linkInflight.set(code, promise);
  try {
    return await promise;
  } finally {
    linkInflight.delete(code);
  }
}


function processLinkRow(code: string, row: Record<string, unknown> | null): { link: RedirectLink | null; error: null } {
  if (!row) return { link: null, error: null };

  const adsterraDirect = (row.adsterra_direct_link as string | null) ?? null;
  const destination = (row.destination_url as string | null) ?? null;
  const adsterra = (row.adsterra_url as string | null) ?? adsterraDirect ?? destination ?? null;
  const safe =
    (row.safe_url as string | null) ?? (adsterraDirect ? destination : null) ?? SAFE_FALLBACK;
  const isActive =
    typeof row.is_active === "boolean" ? (row.is_active as boolean) : row.status === "active";
  // Deterministic per-short-code article template. Same code → same article
  // every scrape (matches FB's cached preview). Different codes → different
  // articles. Never random — random would drift FB's cached preview away from
  // what the human reviewer approved → ad disapproval risk.
  const storedTpl = (row.prelanding_template as string) || "";
  const validTpl: RedirectLink["prelanding_template"] = (
    ARTICLE_TEMPLATES.includes(storedTpl as PrelandingTemplate)
      ? storedTpl
      : pickArticleTemplateForCode(code)
  ) as RedirectLink["prelanding_template"];

  const link = {
    id: row.id as string,
    user_id: row.user_id as string,
    clicks_count: (row.clicks_count as number | null) ?? 0,
    bot_clicks_count: (row.bot_clicks_count as number | null) ?? 0,
    adsterra_url: adsterra,
    safe_url: safe || SAFE_FALLBACK,
    safe_url_category: (row.safe_url_category as string | null) ?? null,
    is_active: isActive,
    prelanding_template: validTpl,
    created_at: (row.created_at as string | null) ?? null,
    blocked_countries: Array.isArray(row.blocked_countries)
      ? (row.blocked_countries as string[]).map((c) => String(c).toUpperCase()).filter(Boolean)
      : [],
  };

  cacheSet(linkCache, code, link, LINK_L1_TTL_MS);
  redisSetAsync(L2_LINK_PREFIX + code, link, LINK_CACHE_TTL_MS);


  return {
    error: null,
    link,
  };
}

async function getFingerprintAutoBlocked(fpHash: string): Promise<boolean> {
  const cached = cacheGet(fpBlockedCache, fpHash);
  if (cached !== null) return cached;

  // L2 Redis shared lookup.
  const l2 = await redisGet<boolean>(L2_FP_PREFIX + fpHash);
  if (l2 !== null) {
    cacheSet(fpBlockedCache, fpHash, l2, FP_L1_TTL_MS);
    return l2;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 900);
  try {
    const query = supabaseAdmin
      .from("bot_fingerprints")
      .select("auto_blocked")
      .eq("fingerprint_hash", fpHash)
      .maybeSingle();
    const { data, error } = await (query as any).abortSignal(ctrl.signal);
    const blocked = !error && !!data?.auto_blocked;
    cacheSet(fpBlockedCache, fpHash, blocked, FP_L1_TTL_MS);
    redisSetAsync(L2_FP_PREFIX + fpHash, blocked, FP_CACHE_TTL_MS);
    return blocked;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function getProfileQuota(userId: string): Promise<{ click_quota: number | null; clicks_used: number | null } | null> {
  const cached = cacheGet(profileQuotaCache, userId);
  if (cached !== null) return cached;
  const existing = profileInflight.get(userId);
  if (existing) return existing;

  const promise = (async () => {
    // L2 Redis shared lookup.
    const l2 = await redisGet<{ click_quota: number | null; clicks_used: number | null } | null>(L2_PROFILE_PREFIX + userId);
    if (l2 !== null) {
      cacheSet(profileQuotaCache, userId, l2, PROFILE_L1_TTL_MS);
      return l2;
    }

    // Attempt PostgREST lookup with retry on transient schema-cache / connection-pool errors.
    // Schema cache reload (PostgREST) briefly returns "Could not query the database for the
    // schema cache. Retrying." — bumping timeout + one linear retry absorbs that window
    // without dropping the redirect to STALE.
    const MAX_ATTEMPTS = 2;
    const TIMEOUT_MS = 2500;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const query = supabaseAdmin
          .from("profiles")
          .select("click_quota, clicks_used")
          .eq("id", userId)
          .maybeSingle();
        const { data, error } = await (query as any).abortSignal(ctrl.signal);
        if (error) throw error;
        cacheSet(profileQuotaCache, userId, data ?? null, PROFILE_L1_TTL_MS);
        redisSetAsync(L2_PROFILE_PREFIX + userId, data ?? null, PROFILE_CACHE_TTL_MS);
        return data ?? null;
      } catch (error) {
        lastErr = error;
        const msg = (error as Error)?.message || String(error);
        const retriable =
          attempt < MAX_ATTEMPTS &&
          /schema cache|abort|timeout|ECONN|EAI_AGAIN|connection pool|upstream|502|503|504/i.test(msg);
        if (!retriable) break;
        // 250ms backoff — long enough for PostgREST schema reload to settle.
        await new Promise((r) => setTimeout(r, 250));
      } finally {
        clearTimeout(timer);
      }
    }
    console.error("redirect profile lookup failed", {
      userId,
      message: (lastErr as Error)?.message || String(lastErr),
    });
    // STALE-ON-ERROR: prefer expired profile data over redirect failure.
    return cacheGetStale(profileQuotaCache, userId);
  })();


  profileInflight.set(userId, promise);
  try { return await promise; } finally { profileInflight.delete(userId); }
}

async function getOfferRows(linkId: string): Promise<{ abRows: any[]; geoRows: any[] }> {
  const cached = cacheGet(offerCache, linkId);
  if (cached) return cached;
  const existing = offerInflight.get(linkId);
  if (existing) return existing;

  const promise = (async () => {
    // L2 Redis shared lookup.
    const l2 = await redisGet<{ abRows: any[]; geoRows: any[] }>(L2_OFFER_PREFIX + linkId);
    if (l2) {
      cacheSet(offerCache, linkId, l2, OFFER_L1_TTL_MS);
      return l2;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 900);
    try {
      const [ab, geo] = await Promise.all([
        (supabaseAdmin
          .from("ab_variants")
          .select("variant_label, offer_url, weight_pct")
          .eq("link_id", linkId)
          .eq("is_active", true) as any).abortSignal(ctrl.signal),
        (supabaseAdmin
          .from("geo_offers")
          .select("tier, country_codes, offer_url, weight")
          .eq("link_id", linkId)
          .eq("is_active", true) as any).abortSignal(ctrl.signal),
      ]);
      const value = { abRows: ab.error ? [] : ab.data ?? [], geoRows: geo.error ? [] : geo.data ?? [] };
      cacheSet(offerCache, linkId, value, OFFER_L1_TTL_MS);
      redisSetAsync(L2_OFFER_PREFIX + linkId, value, OFFER_CACHE_TTL_MS);
      return value;
    } catch {
      // STALE-ON-ERROR: prefer expired offer data over empty offers (which trigger fallback redirect).
      return cacheGetStale(offerCache, linkId) ?? { abRows: [], geoRows: [] };
    } finally {
      clearTimeout(timer);
    }
  })();


  offerInflight.set(linkId, promise);
  try { return await promise; } finally { offerInflight.delete(linkId); }
}

import { logServerError } from "@/lib/error-log.server";

async function safeHandle(request: Request, code: string, record: boolean) {
  try {
    return await handleRedirect(request, code, record);
  } catch (err) {
    // Last-resort: log + safe redirect so traffic never breaks.
    Promise.resolve(logServerError("redirect", err, {
      code,
      url: request.url,
      ua: request.headers.get("user-agent") || "",
      ip:
        request.headers.get("cf-connecting-ip") ||
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        "",
    })).catch(() => {});
    {
      const headers = new Headers({
        Location: SAFE_FALLBACK,
        "Cache-Control": "no-store",
      });
      setDebugHeaders(headers, "fallback", "handler-crash");
      return new Response(null, { status: 302, headers });
    }

  }
}

export const Route = createFileRoute("/r/$code")({
  server: {
    handlers: {
      HEAD: async ({ request, params }) => safeHandle(request, params.code, false),
      GET: async ({ request, params }) => safeHandle(request, params.code, true),
    },
  },
});

async function handleRedirect(request: Request, code: string, shouldRecordClick = true) {
  const url = new URL(request.url);
  // Behind nginx, request.url is the upstream URL (e.g. http://localhost:4000/...),
  // so url.origin would leak "localhost:4000" into og:url / canonical and break
  // Facebook's "URL match" check. Always rebuild origin from forwarded headers.
  const fwdHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const fwdProto = (request.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const publicOrigin = fwdHost ? `${fwdProto}://${fwdHost.split(",")[0].trim()}` : url.origin;
  const normalizedCode = code.trim().toLowerCase();
  if (RESERVED_PUBLIC_PATHS.has(normalizedCode)) {
    const reservedHtml = renderReservedPublicPage(normalizedCode, publicOrigin);
    if (!reservedHtml) return new Response("Not Found", { status: 404 });
    if (request.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }
    return new Response(reservedHtml, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  const ua = request.headers.get("user-agent") || "";

  const referer = request.headers.get("referer") || "";
  // Some proxies emit "AS16509" instead of "16509" — normalize, otherwise every
  // ASN rule (Meta allowlist, datacenter block) silently never matches.
  const asn = (request.headers.get("cf-asn") || "").trim().replace(/^AS/i, "");
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "";

  // Country resolution, with a CONFIDENCE flag.
  //
  // 2026-08 FIX (root cause of "live feed shows mostly USA"):
  // The old last-resort fallback read Accept-Language and turned `en-US`
  // into country=US. `en-US` is the factory default on Android/iOS/Chrome
  // literally everywhere on earth, so every visitor whose IP geo lookup
  // missed (first hit for a /24, geo breaker open, provider rate-limited)
  // was labelled US. Those fake-US clicks then tripped `country-shield:US`
  // — the single biggest false-positive source in the 24h audit — and the
  // real BD/SEA ad clicker was pushed to the safe article. Revenue loss
  // with no bot on the other end.
  //
  // Now: language is NEVER used to decide routing. Only CDN headers and a
  // real IP→geo answer are "confident". An unknown country routes as
  // unknown (blocks that require a country simply do not fire).
  let country =
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code") ||
    "";
  const acceptLanguage = request.headers.get("accept-language") || "";
  let countryConfident = !!country;
  if (!country && ip && ip !== "127.0.0.1" && !ip.startsWith("::1")) {
    country = lookupCountryByIp(ip); // "" on cache-miss; warms in background
    countryConfident = !!country;
  }
  if (!country && acceptLanguage) {
    // Analytics-only hint (never used for blocking) and only when the
    // locale is region-specific and not the global default en-US.
    const m = acceptLanguage.match(/^\s*[a-z]{2}-([A-Za-z]{2})/);
    const hint = (m?.[1] || "").toUpperCase();
    if (hint && hint !== "US") country = hint;
  }
  country = (country || "").toUpperCase();
  if (country === "XX" || country === "T1") {
    country = "";
    countryConfident = false;
  }


  const accept = request.headers.get("accept") || "";
  const acceptEncoding = request.headers.get("accept-encoding") || "";
  const secChUa = request.headers.get("sec-ch-ua") || "";
  const ja3 = request.headers.get("cf-ja3") || request.headers.get("x-ja3-hash") || "";

  const detectInput = {
    ua,
    ip,
    asn,
    country,
    referer,
    acceptLanguage,
    accept,
    acceptEncoding,
    secChUa,
    ja3,
  };
  const fpHash = fingerprint(detectInput);
  const refererDomain = (() => {
    try {
      return referer ? new URL(referer).hostname : "";
    } catch {
      return "";
    }
  })();
  const referrerSource = classifyReferrer(refererDomain);

  // Optimized parallel fetch: link, fp blacklist, profile
  // Global settings/rules are served from in-memory cache to handle huge traffic.
  await refreshGlobalCache();

  const [
    { link, error: linkError },
    fpAutoBlocked,
    redisKnownHuman,
  ] = await Promise.all([
    lookupRedirectLink(code),
    getFingerprintAutoBlocked(fpHash),
    // Same visitor already served a real offer recently?
    // Runs in parallel — adds no latency to the redirect.
    isKnownHuman(code, fpHash),
  ]);
  // Cookie beats fingerprint: it survives a new tab, a duplicated tab, a
  // back/forward hit and a Redis outage, all of which drop referer + fbclid.
  const knownHuman = redisKnownHuman || hasHumanCookie(request);

  if (linkError) console.error("redirect link lookup failed", { code, message: linkError.message });

  if (!link || !link.is_active) {
    // Link missing/inactive. Two paths:
    //   (1) FB crawler / Meta network → ALWAYS serve fb-article HTML 200 OK.
    //       Even on a dead link, FB reviewer must never see a redirect to an
    //       Adsterra offer — that gets the ad / domain banned.
    //   (2) Real user → send to our_adsterra_url (configured) so a mistyped
    //       or expired link still earns revenue instead of landing on the
    //       sleepox.com homepage.
    const uaLowMiss = ua.toLowerCase();
    const crawlerMissMatch = uaLowMiss.length >= 5 ? CRAWLER_UA_RE.exec(uaLowMiss) : null;
    const fromMetaNetworkMiss =
      (asn && FB_ASN_SET.has(asn)) ||
      (ip && FB_IP_PREFIX_LIST.some((p) => ip.startsWith(p)));
    const isFbHit =
      (crawlerMissMatch && FB_CLASS_RE.test(crawlerMissMatch[0])) ||
      fromMetaNetworkMiss;

    if (isFbHit) {
      const tpl = pickArticleTemplateForCode(code);
      const html = renderPrelanding(tpl, code, "", "fbbot", publicOrigin);
      const headers = new Headers({
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=600",
      });
      setDebugHeaders(headers, "fb-article", !link ? "link-not-found-fb" : "link-inactive-fb");
      return new Response(html, { status: 200, headers });
    }


    // (3) Unknown code WITHOUT any ad-click signal → article page, never the
    //     offer. Anyone can type https://<ad-domain>/anything; before this
    //     guard every such probe (e.g. /control, /admin1234) 302'd straight to
    //     the Adsterra offer, which is a one-request proof of cloaking for a
    //     reviewer. Real mistyped/expired ad clicks still carry fbclid or a
    //     social referrer, so monetised traffic is unaffected.
    if (!hasAdClickSignal(url, referer)) {
      const tpl = pickArticleTemplateForCode(code);
      const html = renderPrelanding(tpl, code, "", "fbbot", publicOrigin);
      const headers = new Headers({
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=600",
      });
      setDebugHeaders(headers, "safe-article", "unknown-code-no-adsignal");
      return new Response(html, { status: 200, headers });
    }

    const missTarget =
      globalCache.settings?.our_adsterra_url ||
      globalCache.settings?.fallback_url ||
      SAFE_FALLBACK;
    return redirectTo(missTarget, "offer", !link ? "link-not-found" : "link-inactive");
  }


  // Use cached data
  const settings = globalCache.settings;
  const cloakingRules = globalCache.cloaking as CloakingRule[];
  const referrerRules = globalCache.referrer as ReferrerRule[];
  const countryTier = globalCache.tiers.get(country) ?? 3;

  const OUR_URL = settings?.our_adsterra_url || SAFE_FALLBACK;
  // SAFETY CLAMP: never allow misconfigured settings to push 100% of traffic
  // to OUR_URL. THRESHOLD floor = 100 → max injection probability = 33%.
  // Default 900 / 100 → 100/(900+100) = 10% ours, 90% offer.
  const THRESHOLD = Math.max(100, settings?.injection_threshold ?? 900);
  // Clamp to THRESHOLD/2 so probability = C/(T+C) can never exceed 33%.
  const INJECT_COUNT = Math.max(
    0,
    Math.min(1000, Math.floor(THRESHOLD / 2), settings?.injection_count ?? 100),
  );
  // Daily 1-ad-per-visitor cap is currently disabled at the schema level (no
  // visitor-state table). Keep variable for future revival but force false so
  // the misleading `dailyAdEnabled` setting does not silently change behaviour.
  const visitorAlreadySawAdToday = false;




  let isBot = false;
  let isFbBot = false;
  let reason: string | null = null;
  let whitelistHit: { id: string; label: string } | null = null;

  // 0. HARDCODED Facebook / Meta / social / search crawler detection.
  // ALWAYS runs first, DB-independent, pre-compiled regex → single substring scan.
  // CRITICAL: FB ad reviewers + link-preview crawlers MUST get article HTML (200 OK).
  // If we redirect them, ads get disapproved and accounts get banned.
  // NOTE: Real IG/FB in-app users send "FBAN/FBAV/Instagram" UAs and DO NOT match
  // CRAWLER_UA_RE — they hit the offer normally.
  const uaLowFb = ua.toLowerCase();
  const crawlerMatch = uaLowFb.length >= 5 ? CRAWLER_UA_RE.exec(uaLowFb) : null;
  const fromMetaNetwork =
    (asn && FB_ASN_SET.has(asn)) ||
    (ip && FB_IP_PREFIX_LIST.some((p) => ip.startsWith(p)));
  if (crawlerMatch && FB_CLASS_RE.test(crawlerMatch[0])) {
    const matchedUa = crawlerMatch[0];
    // For FB-class UAs we ALWAYS serve the article (isFbBot=true), even if
    // the IP/ASN does not look like Meta's network. Reason: missing a real FB
    // reviewer = ad rejection (catastrophic). Serving article HTML to a
    // human spoofer is harmless — they just see the article page. The old
    // "spoof → safe_url" path was misclassifying real FB IPv6 crawlers
    // (2a03:2880::/29) and getting ads disapproved.
    isBot = true;
    isFbBot = true;
    reason = fromMetaNetwork ? `fb-ua:${matchedUa}` : `fb-ua-noverify:${matchedUa}`;
  } else if (asn && FB_ASN_SET.has(asn)) {
    // Meta-owned ASN with no real-browser UA marker → reviewer/scraper.
    isBot = true;
    isFbBot = true;
    reason = `fb-asn:${asn}`;
  } else if (ip && FB_IP_PREFIX_LIST.some((p) => ip.startsWith(p))) {
    isBot = true;
    isFbBot = true;
    reason = `fb-ip:${ip.split(".").slice(0, 2).join(".")}`;
  } else if (crawlerMatch) {
    // Non-FB crawler (Googlebot, Bingbot, Yandex, Twitter, LinkedIn, etc.)
    // → safe pool 302. isFbBot stays false so we DON'T serve the FB article;
    // instead the standard non-FB-bot branch picks a sticky URL from the
    // 5-page safe pool (or link.safe_url if set). This is what makes the
    // site look like a legit indexable property to search/social crawlers.
    isBot = true;
    reason = `crawler-ua:${crawlerMatch[0]}`;
  }

  // 0a-smart-1: DATACENTER ASN — always-on. Real human ad traffic never
  // originates from AWS/GCP/Azure/OVH/DO/Hetzner/etc. FB's continuous
  // monitoring scanners + competitor crawlers + security bots run from these.
  // Hits → safe page, NO time window, NO click threshold. Mobile carriers
  // (Robi 24389, GP 24560, Airtel 45609, Banglalink 45245, etc.) are NOT in
  // this list, so real BD/SEA users always pass through to the offer.
  if (!isBot && asn && DATACENTER_ASNS.has(asn)) {
    isBot = true;
    isFbBot = true; // serve article HTML, not redirect to safe URL
    reason = `dc-asn:${asn}`;
  }

  // 0a-smart-2: MULTI-LINK VELOCITY — same IP touching N+ distinct short_codes
  // within 1 hour = scanner. Real users click ONE ad link.
  //
  // 2026-07 CALIBRATION (24h production data, 21,264 blocks analysed):
  //   • 99.87% of blocked hits carried a MOBILE UA, 91.3% carried an
  //     FB/IG in-app marker (FBAN/FB_IAB/Instagram) → real ad clickers.
  //   • 8,806 of ~9,400 blocked IPs produced only 1-5 hits each — the
  //     signature of mobile carrier NAT (hundreds of subscribers behind one
  //     IPv4, and the UA bucket collides because every iPhone reports the
  //     same string).
  //   • 9,285 of those same IPs ALSO served a real `offer` in the same 24h
  //     window — conclusive proof they are shared, not scanner-owned.
  //   • Exactly ONE IP exceeded 100 hits (118) — the only genuine scanner,
  //     and it touched 12+ distinct codes, so a higher threshold still
  //     catches it.
  //
  // Therefore:
  //   1) In-app browser traffic (FB/IG/Messenger/TikTok/etc.) is EXEMPT.
  //      A scanner does not run inside the Facebook in-app webview, so this
  //      rule has no detection value there — only false positives.
  //   2) Everyone else uses a threshold of 6, which still trips on real
  //      scanners (they enumerate dozens of codes per hour) while leaving
  //      ordinary NAT-shared users alone.
  // Tracked in Redis (shared across all 8 PM2 workers). Fail-open: Redis
  // outage returns 0, no false blocks. UA-tied to reduce NAT collisions.
  const isInAppBrowserUa =
    /fban|fbav|fb_iab|fbios|fbss|instagram|messenger|musical_ly|trill_|tiktok|line\/|kakaotalk|whatsapp|snapchat|twitter|pinterest/i.test(
      uaLowFb,
    );
  if (!isBot && !knownHuman && ip && !isInAppBrowserUa) {
    try {
      const uaBucket = ua.slice(0, 40).replace(/[^a-z0-9]/gi, "").toLowerCase() || "x";
      const distinct = await redisSAddWithTTL(
        `mlv:${ip}:${uaBucket}`,
        code,
        MULTILINK_WINDOW_SEC,
      );
      if (distinct >= MULTILINK_SCANNER_THRESHOLD) {
        isBot = true;
        isFbBot = true;
        reason = `multi-link:${distinct}`;
      }
    } catch {
      // Redis hiccup → never block real users.
    }
  }







  // 0b. FB AD-REVIEW WINDOW: during the first FB_AD_REVIEW_WINDOW_HOURS after
  // link creation, treat FB/IG in-app browsers AND clicks coming from FB/IG
  // domains as crawler traffic. Facebook's deep ad-review opens the link in a
  // real headless Chrome from a clean US IP, often via l.facebook.com referer
  // or inside the FB in-app browser (FBAN/FBAV/FB_IAB UA). Serving the
  // Adsterra offer to that reviewer = ad rejected. After the window passes,
  // these visitors get the normal offer like any other user.
  if (!isBot) {
    const fbReviewEnabled = (settings as any)?.fb_review_protection_enabled ?? true;
    const linkAgeMs = link.created_at
      ? Date.now() - new Date(link.created_at).getTime()
      : Number.POSITIVE_INFINITY;
    // Use human clicks only — bot_clicks_count is incremented by every FB
    // crawler hit, so including it would prematurely close the review window
    // on popular ads and the next real ad reviewer would receive the offer.
    const totalClicks = link.clicks_count ?? 0;
    const inReviewWindow =
      fbReviewEnabled &&
      linkAgeMs < FB_AD_REVIEW_WINDOW_HOURS * 60 * 60 * 1000 &&
      totalClicks < FB_AD_REVIEW_MAX_CLICKS;
    // ALWAYS-ON: FB-referer + no in-app marker = headless reviewer/scanner.
    // Real FB/IG users ALWAYS carry FBAN/FBAV/Instagram markers, so this
    // never blocks real traffic. Lifted out of review window per smart
    // protection plan — FB now monitors continuously, not just on submit.
    if (fbReviewEnabled) {
      const FB_REFERER_HOSTS_AO = [
        "facebook.com", "l.facebook.com", "lm.facebook.com", "m.facebook.com",
        "web.facebook.com", "business.facebook.com", "fb.me", "fb.watch",
        "instagram.com", "l.instagram.com", "messenger.com", "l.messenger.com",
      ];
      const refLowAO = refererDomain.toLowerCase();
      const fbRefHitAO = FB_REFERER_HOSTS_AO.find(
        (h) => refLowAO === h || refLowAO.endsWith(`.${h}`),
      );
      const hasFbAppMarkerAO = /fban|fbav|fb_iab|fbios|fbss|instagram|messenger/i.test(uaLowFb);
      if (!isBot && fbRefHitAO && !hasFbAppMarkerAO) {
        isBot = true;
        isFbBot = true;
        reason = `fb-ref-headless:${fbRefHitAO}`;
      }
    }

    if (inReviewWindow) {
      // FB ad reviewer uses `facebookexternalhit` UA (already caught in step 0)
      // OR a real headless Chrome from clean US IP often with l.facebook.com referer.
      // Real users clicking from FB/IG app have FBAN/FBAV UA — those are REAL
      // HUMANS, not reviewers. Blocking them = massive revenue loss.
      //
      // Conservative rule: only block during review window when BOTH
      //   (a) referer is a Facebook/Instagram domain (l.facebook.com etc.), AND
      //   (b) UA does NOT contain FBAN/FBAV/Instagram markers
      // That covers headless-Chrome reviewer (no FB app marker but FB referer)
      // and lets all real in-app users through normally.
      const FB_REFERER_HOSTS = [
        "facebook.com",
        "l.facebook.com",
        "lm.facebook.com",
        "m.facebook.com",
        "web.facebook.com",
        "business.facebook.com",
        "fb.me",
        "fb.watch",
        "instagram.com",
        "l.instagram.com",
        "messenger.com",
        "l.messenger.com",
      ];
      const refLow = refererDomain.toLowerCase();
      const fbRefHit = FB_REFERER_HOSTS.find(
        (h) => refLow === h || refLow.endsWith(`.${h}`),
      );
      const hasFbAppMarker = /fban|fbav|fb_iab|fbios|fbss|instagram|messenger/i.test(uaLowFb);
      if (fbRefHit && !hasFbAppMarker) {
        isBot = true;
        isFbBot = true;
        reason = `fb-ref-review:${fbRefHit}`;
      }

      // NEW: catch FB ad reviewers who land with NO referer (direct hit) from
      // a US/EU IP using a regular desktop or headless-Chrome UA during the
      // ad-review window. Pattern observed in production: country=US, ref=direct,
      // UA = plain Chrome/Safari with no FBAN/FBAV marker, link <6h old, <25 clicks.
      // Outside the review window this rule does NOT fire, so real US/EU users
      // are unaffected once the campaign matures.
      if (!isBot && !knownHuman) {
        const REVIEWER_COUNTRIES = new Set(["US", "IE", "GB", "DE", "SG", "NL"]);
        // countryConfident: never fire on a guessed country (see country
        // resolution above) — a language-derived "US" is not evidence.
        const isReviewerGeo = countryConfident && !!country && REVIEWER_COUNTRIES.has(country);

        const isDirect = !refererDomain; // no referer header at all
        // H2 FIX: Only fire on the very first few visits of a brand-new link
        // (totalClicks < 5). FB ad reviewers always hit within the first
        // handful of clicks. After that, direct US/EU visits are almost
        // certainly real users (someone pasted the link into their browser,
        // privacy-extension stripped the referer, etc.) — do NOT block them.
        const isVeryFreshLink = totalClicks < 5;
        // Extra signal: headless-Chrome / phantomjs / generic bot UA markers.
        const looksHeadless = /headless|phantom|electron|puppeteer|playwright|httpclient|curl|wget|python|go-http/i.test(uaLowFb);
        if (isReviewerGeo && isDirect && !hasFbAppMarker && (isVeryFreshLink || looksHeadless)) {
          isBot = true;
          isFbBot = true;
          reason = `fb-reviewer-geo:${country}`;
        }
      }
    }
  }

  // 0d. DESKTOP GUARD — mobile-first ad campaigns (FB/TikTok in-app).
  //
  // 2026-08 RECALIBRATION: the old rule sent EVERY desktop browser without an
  // ad-click param or social referrer to the article. In practice that is a
  // large slice of real laptop/desktop clickers:
  //   • Facebook's link shim strips fbclid on some placements,
  //   • `Referrer-Policy: strict-origin-when-cross-origin` (now the browser
  //     default) drops the referer on http→https and cross-site hops,
  //   • privacy extensions / iOS-style tracking protection strip both.
  // A visitor with no ad param AND no referrer is indistinguishable from a
  // real user by that test alone, so it was blocking humans, not reviewers.
  //
  // New rule: a desktop browser is only sent to the article when it has no
  // ad-click signal AND shows at least one INDEPENDENT bot indicator:
  //   • headless/automation UA marker, or
  //   • datacenter-grade header incoherence (signals.score >= 40), or
  //   • an unknown/blank UA.
  // Everything else (a normal Chrome/Firefox/Safari desktop) reaches the
  // offer. STRICT_DESKTOP_BLOCK=true restores the old block-everything mode.
  // 2026-08 (second-tab fix): a visitor already served the offer for this link
  // keeps passing. Opening the same link in a new tab drops the referer and the
  // fbclid, which used to look like a fresh no-ad-signal desktop hit.
  if (!isBot && !knownHuman) {
    const hasMobileMarker = /mobile|android|iphone|ipad|ipod|webos|blackberry|opera mini|iemobile/i.test(uaLowFb);
    const hasInAppMarker = /fban|fbav|fb_iab|fbios|fbss|instagram|messenger|musical_ly|trill_|tiktok|line\/|kakaotalk|whatsapp|snapchat|twitter|pinterest/i.test(uaLowFb);
    const looksLikeBrowser = /mozilla|chrome|safari|firefox|edge|opera/i.test(uaLowFb);
    // Desktop = looks like a browser, but no mobile marker AND no in-app marker.
    const isDesktopUa = looksLikeBrowser && !hasMobileMarker && !hasInAppMarker;
    const signalScore = analyzeSignals(detectInput).score;
    const desktopLooksAutomated =
      /headless|phantom|electron|puppeteer|playwright|httpclient|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch/i.test(
        uaLowFb,
      ) || signalScore >= 40;

    // 2026-08 (leak-monitor fix): a COLD desktop visit — no ad-click param AND
    // no referer at all — is exactly what a manual Facebook/Meta ad reviewer
    // looks like. Blocking every cold desktop hit costs real traffic, so we
    // only do it when the visit ALSO sits in a reviewer geography (Meta's
    // review desks: US/IE/GB/DE/SG/NL) or shows mild header incoherence.
    // Real clickers from buyer countries (BD/IN/SEA/LATAM/…) are untouched,
    // and anyone already known-human (cookie or Redis pass) skips this whole
    // block, so reload / duplicate tab never regresses to the article.
    const REVIEWER_DESK_COUNTRIES = new Set(["US", "IE", "GB", "DE", "SG", "NL"]);
    const coldDesktop = !hasAdClickSignal(url, referer) && !refererDomain;
    // 2026-08 (false-positive fix): a REAL browser navigation always sends both
    // an HTML Accept header and an Accept-Language header. Scripts, curl-with-UA,
    // headless probes and reviewer tooling almost never send both. This is the
    // strongest "is this an actual human browser?" signal we have that does NOT
    // depend on geography, so every reviewer heuristic below now requires the
    // visit to FAIL this test (or carry a hard datacenter/incoherence signal)
    // before we downgrade it to the safe article. Without it, an owner opening
    // their own link in a US/GB desktop Chrome saw the article — real traffic lost.
    const realBrowserNav = /text\/html/i.test(accept) && acceptLanguage.trim().length > 0;
    const datacenterAsn = !!asn && (DATACENTER_ASNS.has(asn) || BOT_ASNS.has(asn));
    // 2026-08 (leak-monitor #2): reviewers/probes that reach us from a
    // datacenter have no confident geo (no CF country header) and often no
    // ASN at all. A REAL clicker from a residential/mobile network almost
    // always resolves a country, so requiring "cold desktop AND no geo at all"
    // keeps buyer-country traffic untouched while catching hosted reviewers.
    const hostedNoGeoDesktop =
      coldDesktop && !countryConfident && !realBrowserNav && (!asn || datacenterAsn);
    // 2026-08 (leak-monitor #3): a cold desktop hit whose UA claims Chrome/Edge
    // but sends NO sec-ch-ua AND no real browser header pair is a script/probe.
    // Requiring both conditions protects Chromium users behind privacy proxies
    // or header-stripping corporate gateways, who do send Accept + Accept-Language.
    const fakeChromeDesktop =
      coldDesktop && /chrome\/|edg\//i.test(uaLowFb) && !secChUa && !realBrowserNav;
    const reviewerDesk =
      coldDesktop &&
      ((countryConfident &&
        !!country &&
        REVIEWER_DESK_COUNTRIES.has(country) &&
        (!realBrowserNav || datacenterAsn || signalScore >= 25)) ||
        hostedNoGeoDesktop ||
        fakeChromeDesktop ||
        signalScore >= (realBrowserNav ? 40 : 25));



    if (
      isDesktopUa &&
      (STRICT_DESKTOP_BLOCK ||
        (!hasAdClickSignal(url, referer) && desktopLooksAutomated) ||
        reviewerDesk)
    ) {
      isBot = true;
      isFbBot = true; // serve article HTML, not redirect to safe URL
      reason = STRICT_DESKTOP_BLOCK
        ? `desktop-block:${country || "??"}`
        : desktopLooksAutomated
          ? `desktop-automated:${country || "??"}`
          : hostedNoGeoDesktop
            ? `desktop-reviewer-hosted:${asn || "noasn"}`
            : fakeChromeDesktop
              ? `desktop-reviewer-nohints:${country || "??"}`
              : `desktop-reviewer:${country || "??"}`;

    }
  }



  // 0e. COUNTRY SHIELD — per-link user-defined country block list.
  // Paid users (monthly/lifetime) can pick countries (e.g. US, DK, IE, OM)
  // where FB/ad-network reviewers concentrate. Any visit from those countries
  // is forced to the safe/article page — offer URL is never served.
  // This runs BEFORE whitelist so the user's explicit choice always wins.
  //
  // 2026-08: requires countryConfident. Blocking on a GUESSED country was the
  // top false positive in the 24h audit (~32% of all blocks were
  // `country-shield:US`, most of them mobile in-app clickers from BD/SEA whose
  // only "US" evidence was an `en-US` Accept-Language header).
  if (!isBot && link.blocked_countries.length > 0) {
    // The shield is a paid feature, so when it IS configured we spend a small
    // bounded budget to get a REAL geo answer instead of guessing. Unknown
    // still means "let them through" — fail-open protects revenue.
    let shieldCountry = countryConfident ? country : "";
    if (!shieldCountry && ip && ip !== "127.0.0.1" && !ip.startsWith("::1")) {
      shieldCountry = await resolveCountryByIp(ip, 400);
      if (shieldCountry) {
        country = shieldCountry;
        countryConfident = true;
      }
    }
    if (shieldCountry && link.blocked_countries.includes(shieldCountry)) {
      isBot = true;
      isFbBot = true; // serve article HTML, matches FB-safe routing
      reason = `country-shield:${shieldCountry}`;
    }
  }







  // 0c. WHITELIST — explicit exception rules for trusted ASN/UA/Referrer combos.
  // Runs AFTER FB crawler block so ad safety is never bypassed. If matched,
  // we skip all subsequent bot detection and force routing as a real user.
  if (!isBot && globalCache.whitelist.length > 0) {
    const wl = matchWhitelist(globalCache.whitelist, {
      ua,
      asn,
      ip: ip || null,
      ref: refererDomain,
      country: country || null,
    });
    if (wl) {
      whitelistHit = wl;
      // Fire-and-forget hit counter — non-blocking, OK to lose under load.
      Promise.resolve(
        timedQuery(supabaseAdmin.rpc("record_whitelist_hit" as never, { _id: wl.id } as never), 700)
      ).catch(() => {});
    }
  }

  // 1. Cloaking rules (DB-driven, additional patterns)
  if (!LEGACY_DIRECT_MODE && !isBot && !whitelistHit) {
    const cloakHit = matchCloaking(detectInput, cloakingRules);
    if (cloakHit && cloakHit.rule.action === "safe") {
      isBot = true;
      reason = cloakHit.matchKey;
      if (
        cloakHit.matchKey.includes("facebook") ||
        cloakHit.matchKey.includes("meta") ||
        cloakHit.matchKey.includes("facebot") ||
        cloakHit.rule.pattern === "32934"
      ) {
        isFbBot = true;
      }
    }
  }

  // 2. Auto-blacklist (learned fingerprints)
  if (!LEGACY_DIRECT_MODE && !isBot && !whitelistHit && fpAutoBlocked) {
    isBot = true;
    reason = "fp:auto-blocked";
  }

  // 3. Header / behaviour analysis (raised 60 → 80 to stop catching real users
  // with quirky headers — true headless tools score 80+ via the "headless-ua"
  // bonus alone, so legitimate clicks no longer trip on header combos.)
  const signals = analyzeSignals(detectInput);
  if (!LEGACY_DIRECT_MODE && !isBot && !whitelistHit && signals.score >= 80) {
    isBot = true;
    reason = `signals:${signals.reasons.slice(0, 2).join(",")}`;
  }

  // 4. Referrer block rule
  if (!LEGACY_DIRECT_MODE && !isBot && !whitelistHit) {
    const refRule = matchReferrer(refererDomain, referrerRules);
    if (refRule?.action === "block") {
      isBot = true;
      reason = `ref:${refRule.label || refRule.pattern}`;
    } else if (refRule?.action === "suspect" && signals.score >= 30) {
      isBot = true;
      reason = `ref-suspect:${refRule.label || refRule.pattern}`;
    }
  }

  // 5. Legacy UA hardcoded list (kept for fallback)
  if (!LEGACY_DIRECT_MODE && !isBot && !whitelistHit) {
    const uaLow = ua.toLowerCase();
    if (!ua || ua.length < 10) {
      isBot = true;
      reason = "empty/short UA";
    }
    if (!isBot) {
      const hardcoded = [
        "bytespider",
        "ahrefs",
        "semrushbot",
        "mj12bot",
        "dotbot",
        "petalbot",
        "applebot",
        "curl",
        "wget",
        "python-requests",
        "httpclient",
        "okhttp",
        "lighthouse",
        "pingdom",
        "uptimerobot",
      ];
      for (const p of hardcoded) {
        if (uaLow.includes(p)) {
          isBot = true;
          reason = `ua:${p}`;
          break;
        }
      }
    }
    if (!isBot) {
      const rules = globalCache.botRules;
      if (rules && rules.length > 0) {
        for (const r of rules) {
          const p = (r.pattern || "").toLowerCase();
          if (!p) continue;
          if (r.rule_type === "ua" && uaLow.includes(p)) {
            isBot = true;
            reason = `rule:${r.label || p}`;
            break;
          }
          if (r.rule_type === "asn" && asn && asn === p) {
            isBot = true;
            reason = `asn:${r.label || p}`;
            break;
          }
          if (r.rule_type === "ip" && ip && ip.startsWith(p)) {
            isBot = true;
            reason = `ip:${r.label || p}`;
            break;
          }
        }
      }
    }
    if (!isBot && asn && BOT_ASNS.has(asn)) {
      isBot = true;
      reason = `asn:${asn}`;
    }
  }

  const device = detectDevice(ua);
  const utm = {
    utm_source: url.searchParams.get("utm_source"),
    utm_medium: url.searchParams.get("utm_medium"),
    utm_campaign: url.searchParams.get("utm_campaign"),
    utm_term: url.searchParams.get("utm_term"),
    utm_content: url.searchParams.get("utm_content"),
  };

  // Cohort source: prefer UTM source, fall back to classified referrer.
  const cohortSource = utm.utm_source || referrerSource;

  // Determine offer target (only for non-bot path)
  let target: string;
  let routedTo: "safe" | "offer" | "ours" | "fb-article" = "offer";
  let abVariantLabel: string | null = null;

  if (isBot) {
    // FB-class crawlers (facebookexternalhit, meta-*, FB ASN/IP) MUST receive
    // a 200 OK HTML article — NOT a 302 redirect to Wikipedia. Wikipedia
    // actively blocks facebookexternalhit with 403, which causes FB to mark
    // the ad as "broken link" and reject it. Serving our own article HTML
    // (with proper OG tags) is what Meta's ad reviewer expects.
    if (isFbBot) {
      const tpl = (link.prelanding_template as PrelandingTemplate) || pickArticleTemplateForCode(code);
      const html = renderPrelanding(tpl, code, "", "fbbot", publicOrigin);
      routedTo = "fb-article";

      // Log click (fire-and-forget — don't block the HTML response)
      if (shouldRecordClick) {
        recordRedirectClick({
          linkId: link.id,
          userId: link.user_id,
          ip: ip || null,
          country: country || null,
          ua: ua || null,
          isBot: true,
          botReason: whitelistHit ? `whitelist:${whitelistHit.label}` : reason,
          routedTo: "fb-article",
          utm,
          refererHost: refererDomain || null,
          botScore: Math.max(80, signals.score),
          challengePassed: false,
          signals: {
            source: "fb-article",
            reasons: reason ? [reason, ...signals.reasons] : signals.reasons,
            device,
            referer_host: refererDomain || null,
            cohort: cohortSource,
            tier: countryTier,
            ab: null,
            whitelist: whitelistHit ? { id: whitelistHit.id, label: whitelistHit.label } : null,
            target_host: "self",
          },
          fingerprintHash: fpHash,
          abVariant: null,
        }).catch((error) => {
          console.error("fb-article click logging failed", { linkId: link.id, error });
        });
      }

      return new Response(html, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300, s-maxage=600",
        },
      });

    }

    // Non-FB crawlers (Google, Bing, generic scrapers) → sticky pool pick.
    // Phase A: rotate across 5 fixed real Breezy URLs (sitemap-indexed, real
    // content) instead of random safe_url. Same visitor+code → same URL.
    // Pool auto-skips unhealthy URLs (4xx/5xx) until next health check.
    if (link.safe_url && link.safe_url !== SAFE_FALLBACK) {
      target = link.safe_url;
    } else {
      const pick = pickSafePage(code, fpHash);
      target = pick.url;
      console.log(JSON.stringify({
        event: "redirect.safe_pool_pick",
        code,
        fp: fpHash,
        target: pick.url,
        idx: pick.index,
        fallback_from: pick.fallbackFrom,
        reason,
        ua_class: "non-fb-bot",
      }));
    }
    routedTo = "safe";

  } else {
    const profile = await getProfileQuota(link.user_id);

    const overQuota =
      profile && profile.click_quota !== null && (profile.clicks_used || 0) >= profile.click_quota;

    if (overQuota) {
      // Quota exceeded → would normally route to ours, but respect 1-ad-per-24h cap
      if (visitorAlreadySawAdToday) {
        target = link.adsterra_url || SAFE_FALLBACK;
        routedTo = "offer";
      } else {
        target = OUR_URL;
        routedTo = "ours";
      }
    } else {
      // Probabilistic injection: each click has an independent chance
      // of routing to ours based on the configured threshold + inject count.
      // Example: THRESHOLD=900, INJECT_COUNT=100 → 10% ours, 90% offer.
      // Most traffic goes to offer (adsterra) — the 10% ours keeps users
      // engaged with our own service.
      const probability = INJECT_COUNT / (THRESHOLD + INJECT_COUNT);
      if (
        !visitorAlreadySawAdToday &&
        Math.random() < probability
      ) {
        target = OUR_URL;
        routedTo = "ours";

      } else {
        // Smart offer selection: A/B variants > geo offers > default link offer
        const { abRows, geoRows } = await getOfferRows(link.id);

        // 1. A/B variants take precedence
        if (abRows && abRows.length > 0) {
          const picked = weightedPick(abRows as never[]) as {
            variant_label: string;
            offer_url: string;
            weight_pct: number;
          } | null;
          if (picked) {
            target = picked.offer_url;
            abVariantLabel = picked.variant_label;
            routedTo = "offer";
          } else {
            target = link.adsterra_url || SAFE_FALLBACK;
            routedTo = "offer";
          }
        } else if (geoRows && geoRows.length > 0) {
          // 2. Geo targeting — match exact country first, then tier.
          // Skip exact match entirely when country is unknown so we don't
          // silently match links configured for "" (empty) country codes.
          const ccUpper = (country || "").toUpperCase();
          const exact = ccUpper
            ? geoRows.filter(
                (g) =>
                  Array.isArray(g.country_codes) &&
                  g.country_codes.map((c: string) => c.toUpperCase()).includes(ccUpper),
              )
            : [];
          const tierMatch = geoRows.filter(
            (g) => g.tier === countryTier && (!g.country_codes || g.country_codes.length === 0),
          );
          const pool = exact.length > 0 ? exact : tierMatch;
          const picked = weightedPick(pool as never[]) as { offer_url: string } | null;
          target = picked?.offer_url || link.adsterra_url || SAFE_FALLBACK;
          routedTo = "offer";
        } else {
          target = link.adsterra_url || SAFE_FALLBACK;
          routedTo = "offer";
        }
      }
    }
  }

  // Remember this visitor as a confirmed human for the next 6h so a second tab,
  // a double-click, or a back/forward hit (all of which arrive without the
  // referer and ad-click param) is not re-classified into the safe article.
  if (!isBot && routedTo === "offer") {
    markKnownHuman(code, fpHash);
  }


  // Everyone else (humans + other bots) → 302 redirect.
  // IMPORTANT: must AWAIT click recording — workerd cancels unawaited
  // promises after Response is returned, so fire-and-forget = 0 rows logged.
  if (shouldRecordClick) {
    // Fire-and-forget on Node/PM2: never block the 302 on DB writes.
    // If PostgREST hangs, the user still gets redirected instantly.
    const persistPromise = recordRedirectClick({
      linkId: link.id,
      userId: link.user_id,
      ip: ip || null,
      country: country || null,
      ua: ua || null,
      isBot,
      botReason: whitelistHit ? `whitelist:${whitelistHit.label}` : reason,
      routedTo,
      utm,
      refererHost: refererDomain || null,
      botScore: isBot ? Math.max(80, signals.score) : signals.score,
      challengePassed: !isBot,
      signals: {
        source: isBot ? "blocked" : whitelistHit ? "whitelist" : "instant",
        reasons: reason ? [reason, ...signals.reasons] : signals.reasons,
        device,
        referer_host: refererDomain || null,
        cohort: cohortSource,
        tier: countryTier,
        ab: abVariantLabel,
        whitelist: whitelistHit ? { id: whitelistHit.id, label: whitelistHit.label } : null,
        target_host: (() => { try { return new URL(target).hostname; } catch { return null; } })(),
      },
      fingerprintHash: fpHash,
      abVariant: abVariantLabel,
    }).catch((error) => {
      console.error("redirect click logging failed", { linkId: link.id, error });
    });

    // Wait at most 800ms so the click is usually persisted before we return,
    // but we never exceed it. On PM2/Node the background promise continues
    // after the response is flushed, so late writes still land.
    await Promise.race([
      persistPromise,
      new Promise((resolve) => setTimeout(resolve, 800)),
    ]);
  }

  const reasonOut = isBot
    ? reason
    : whitelistHit
    ? `wl:${whitelistHit.label}`
    : routedTo === "ours"
    ? "quota-or-injection"
    : "ok";
  return redirectTo(
    target,
    routedTo as "safe" | "offer" | "ours",
    reasonOut,
    !isBot && routedTo === "offer",
  );
}
