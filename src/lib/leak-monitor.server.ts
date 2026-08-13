import { fetchIpv4 } from "@/lib/fetch-ipv4";
/**
 * SMART BRAIN — LEAK MONITOR
 * ---------------------------------------------------------------------------
 * Continuously probes every shortener domain the way Facebook / Meta and a
 * human ad reviewer would, and reports anything that could get an ad or a
 * domain banned.
 *
 * Every check is READ-ONLY (plain GET requests from the server). It never
 * touches the redirect hot path, so it can never cause traffic loss.
 *
 * Findings are written to public.error_logs with source="leak_monitor" so they
 * show up in Control Panel → Errors as well as the dedicated Leak Monitor tab.
 * Each finding carries a `fix` string: a copy-pasteable one-line remedy.
 */

import { isSaasOnlyPath } from "./site-hosts";

export const LEAK_SOURCE = "leak_monitor";

export const FB_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
export const META_AGENT_UA =
  "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)";
export const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
export const MOBILE_FB_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.36.109]";

const TIMEOUT_MS = 9000;

/** Words that must NEVER appear in HTML served from a shortener domain. */
const SAAS_FINGERPRINTS = [
  "sleepox",
  "link shortener",
  "short link manager",
  "adsterra",
  "supabase",
  "control panel",
  "cloak",
];

/** Response headers that would fingerprint our stack to a reviewer. */
const LEAKY_HEADER_PREFIXES = ["x-sleepox", "x-cloak", "x-bot", "x-offer"];

export type Severity = "error" | "warn" | "info";

export type LeakFinding = {
  check: string;
  severity: Severity;
  domain: string;
  url: string;
  message: string;
  evidence: string;
  fix: string;
};

type Probe = {
  status: number;
  headers: Record<string, string>;
  location: string | null;
  body: string;
  error: string | null;
};

async function probe(
  url: string,
  ua: string,
  opts: { redirect?: "manual" | "follow"; referer?: string } = {},
): Promise<Probe> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml,*/*",
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (opts.referer) headers.Referer = opts.referer;
    const res = await fetchIpv4(url, {
      method: "GET",
      headers,
      redirect: opts.redirect ?? "manual",
      signal: ctrl.signal,
    });
    const hdrs: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      hdrs[k.toLowerCase()] = v;
    });
    let body = "";
    const ct = hdrs["content-type"] || "";
    if (/text|html|xml|json/i.test(ct)) {
      body = (await res.text()).slice(0, 200_000);
    }
    return {
      status: res.status,
      headers: hdrs,
      location: hdrs["location"] ?? null,
      body,
      error: null,
    };
  } catch (err) {
    return {
      status: 0,
      headers: {},
      location: null,
      body: "",
      error: (err as Error)?.message ?? "fetch failed",
    };
  } finally {
    clearTimeout(t);
  }
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url, "https://x.invalid").hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Static marketing/storefront slugs that must never be flagged as short codes. */
const KNOWN_STATIC_SLUGS = new Set([
  "",
  "shop",
  "blog",
  "about",
  "contact",
  "faq",
  "size-guide",
  "shipping",
  "returns",
  "privacy",
  "terms",
  "pricing",
  "login",
  "signup",
  "cart",
  "checkout",
]);

/** SaaS paths that must 404 on shortener hosts. */

const SAAS_PROBE_PATHS = [
  "/login",
  "/signup",
  "/dashboard",
  "/control-panel",
  "/pricing",
  "/analytics",
  "/smart-filter",
  "/link-debugger",
];

/**
 * Run the full leak sweep for one domain.
 * `sampleCode` is a real active short code used to exercise the redirect path.
 */
export async function scanDomain(
  domain: string,
  sampleCode: string | null,
  selfHosts: string[],
): Promise<LeakFinding[]> {
  const out: LeakFinding[] = [];
  const base = `https://${domain}`;
  const add = (f: LeakFinding) => out.push(f);

  // ---- 1. Meta crawler reachability on the root ---------------------------
  const rootFb = await probe(base + "/", FB_UA);
  if (rootFb.status === 0 || rootFb.status === 403 || rootFb.status >= 500) {
    add({
      check: "meta_root_blocked",
      severity: "error",
      domain,
      url: base + "/",
      message: `Meta crawler cannot load ${domain} (HTTP ${rootFb.status || "network error"})`,
      evidence: rootFb.error || `status=${rootFb.status} server=${rootFb.headers["server"] || "?"}`,
      fix: "Cloudflare → Security → WAF: add a Skip rule for social crawler user agents, and turn Bot Fight Mode OFF for this domain.",
    });
  }

  // ---- 2. SaaS product visible on the shortener domain --------------------
  const rootHtml = rootFb.body.toLowerCase();
  const rootHits = SAAS_FINGERPRINTS.filter((w) => rootHtml.includes(w));
  if (rootHits.length > 0) {
    add({
      check: "saas_fingerprint_on_root",
      severity: "error",
      domain,
      url: base + "/",
      message: `Shortener homepage leaks internal keywords: ${rootHits.join(", ")}`,
      evidence: rootHits.join(", "),
      fix: "Serve the neutral storefront on this host (src/lib/host.ts → variantFromHost) and strip the leaked words from that template.",
    });
  }

  // ---- 3. SaaS paths must not resolve -------------------------------------
  for (const p of SAAS_PROBE_PATHS) {
    if (!isSaasOnlyPath(p)) continue;
    const r = await probe(base + p, DESKTOP_UA);
    if (r.status !== 200) continue;
    // A 200 alone is NOT a leak: the shortener host legitimately serves a
    // neutral safe-pool article for unknown paths. Only flag it when the body
    // actually exposes the SaaS product.
    const body = r.body.toLowerCase();
    const hits = SAAS_FINGERPRINTS.filter((w) => body.includes(w));
    if (hits.length === 0) continue;
    add({
      check: "saas_path_reachable",
      severity: "error",
      domain,
      url: base + p,
      message: `SaaS page ${p} is reachable on the ad domain (HTTP 200, leaks: ${hits.join(", ")})`,
      evidence: `status=200 hits=${hits.join(", ")} title=${(r.body.match(/<title[^>]*>([^<]*)/i)?.[1] || "").slice(0, 80)}`,
      fix: `Add "${p}" to SAAS_PATH_PREFIXES in src/lib/site-hosts.ts so the shortenerShield middleware 404s it.`,
    });
  }


  // ---- 4. robots.txt must let Meta in -------------------------------------
  const robots = await probe(base + "/robots.txt", DESKTOP_UA);
  const rb = robots.body.toLowerCase();
  if (robots.status === 200 && /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*$/im.test(rb)) {
    add({
      check: "robots_blocks_all",
      severity: "error",
      domain,
      url: base + "/robots.txt",
      message: "robots.txt disallows all crawlers — Meta cannot read OG tags",
      evidence: rb.slice(0, 200),
      fix: "Edit public/robots.txt: keep `Allow: /` for `User-agent: *` and explicit Allow blocks for facebookexternalhit / meta-externalagent.",
    });
  } else if (robots.status === 200 && !rb.includes("facebookexternalhit")) {
    add({
      check: "robots_missing_meta_allow",
      severity: "warn",
      domain,
      url: base + "/robots.txt",
      message: "robots.txt has no explicit allow block for Meta crawlers",
      evidence: rb.slice(0, 200),
      fix: "Add `User-agent: facebookexternalhit` + `Allow: /` (and the same for meta-externalagent) to public/robots.txt.",
    });
  }

  // ---- 5. sitemap must not publish the short-code inventory ---------------
  const sitemap = await probe(base + "/sitemap.xml", DESKTOP_UA);
  if (sitemap.status === 200) {
    const locs = sitemap.body.match(/<loc>[^<]*<\/loc>/gi) || [];
    const codeLike = locs.filter((l) => {
      const slug = (l.match(/<loc>https?:\/\/[^/]+\/([^<]*)<\/loc>/i)?.[1] || "")
        .replace(/\/+$/, "")
        .toLowerCase();
      if (!slug || slug.includes("/")) return false;
      if (KNOWN_STATIC_SLUGS.has(slug)) return false;
      // Real short codes are opaque: 5-10 chars, no hyphen, and mix letters+digits.
      return /^(?=.*[0-9])(?=.*[a-z])[a-z0-9]{5,10}$/.test(slug);
    });
    if (codeLike.length > 3) {
      add({
        check: "sitemap_exposes_short_codes",
        severity: "error",
        domain,
        url: base + "/sitemap.xml",
        message: `sitemap.xml exposes ${codeLike.length} short codes (full campaign inventory)`,
        evidence: codeLike.slice(0, 3).join(" "),
        fix: "Remove dynamic short-code entries from src/routes/sitemap[.]xml.ts — list only static safe pages.",
      });
    }
  }


  // ---- 6. Redirect behaviour on a real short code -------------------------
  if (sampleCode) {
    const codeUrl = `${base}/${sampleCode}`;

    // 6a. Meta crawler must get a 200 safe article, never a redirect to the offer.
    const fbCode = await probe(codeUrl, FB_UA);
    const fbTarget = hostOf(fbCode.location);
    if (fbCode.status >= 300 && fbCode.status < 400 && fbTarget && !selfHosts.includes(fbTarget)) {
      add({
        check: "crawler_sees_offer_redirect",
        severity: "error",
        domain,
        url: codeUrl,
        message: `Meta crawler is redirected off-site to ${fbTarget} — direct cloaking violation`,
        evidence: `HTTP ${fbCode.status} → ${fbCode.location}`,
        fix: "In src/routes/r.$code.ts step 0, always return the safe article HTML (200) for crawler user agents.",
      });
    }
    if (fbCode.status === 200 && !/og:title/i.test(fbCode.body)) {
      add({
        check: "missing_og_tags",
        severity: "warn",
        domain,
        url: codeUrl,
        message: "Safe page served to Meta has no og:title — link preview will fail",
        evidence: (fbCode.body.match(/<title[^>]*>([^<]*)/i)?.[1] || "no title").slice(0, 120),
        fix: "Ensure src/lib/og-meta.ts tags are rendered on the crawler response in src/routes/r.$code.ts.",
      });
    }
    const fbBody = fbCode.body.toLowerCase();
    const fbHits = SAAS_FINGERPRINTS.filter((w) => fbBody.includes(w));
    if (fbHits.length > 0) {
      add({
        check: "saas_fingerprint_on_safe_page",
        severity: "error",
        domain,
        url: codeUrl,
        message: `Safe page shown to Meta leaks: ${fbHits.join(", ")}`,
        evidence: fbHits.join(", "),
        fix: "Strip these words from src/lib/prelanding-templates.ts / safe-page-pool.ts templates.",
      });
    }

    // 6b. Cold desktop browser (no fbclid, no social referer) — a manual
    // reviewer. Must NOT reach the money page.
    const cold = await probe(codeUrl, DESKTOP_UA);
    const coldTarget = hostOf(cold.location);
    if (cold.status >= 300 && cold.status < 400 && coldTarget && !selfHosts.includes(coldTarget)) {
      add({
        check: "reviewer_reaches_offer",
        severity: "error",
        domain,
        url: codeUrl,
        message: `Cold desktop visit redirects straight to ${coldTarget} — a manual ad reviewer would see the offer`,
        evidence: `HTTP ${cold.status} → ${cold.location}`,
        fix: "Tighten hasAdClickSignal() in src/routes/r.$code.ts so desktop visits without fbclid/social referer get the safe article.",
      });
    }

    // 6c. Header fingerprint leak on the real traffic path.
    const mobile = await probe(codeUrl, MOBILE_FB_UA, {
      referer: "https://l.facebook.com/",
    });
    for (const [k, v] of Object.entries(mobile.headers)) {
      if (LEAKY_HEADER_PREFIXES.some((p) => k.startsWith(p))) {
        add({
          check: "debug_header_leak",
          severity: "warn",
          domain,
          url: codeUrl,
          message: `Internal debug header "${k}" is exposed to visitors`,
          evidence: `${k}: ${String(v).slice(0, 80)}`,
          fix: "Remove the X-Sleepox-* / debug headers from the response in src/routes/r.$code.ts.",
        });
      }
    }
    if (mobile.status === 0) {
      add({
        check: "traffic_path_unreachable",
        severity: "error",
        domain,
        url: codeUrl,
        message: "Real ad-click path is unreachable — traffic is being lost right now",
        evidence: mobile.error || "network error",
        fix: "Check Nginx + PM2 on the VPS: cd /opt/sleepox-app-new && pm2 status && nginx -t",
      });
    }
  } else {
    add({
      check: "no_sample_code",
      severity: "info",
      domain,
      url: base,
      message: "No active short code found to test the redirect path",
      evidence: "links table returned no rows",
      fix: "Create at least one active link so the leak monitor can verify redirect behaviour.",
    });
  }

  return out;
}

/** Scan every domain and persist findings. Returns the report. */
export async function runLeakSweep(domains: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let sampleCode: string | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("links")
      .select("short_code")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sampleCode = (data as { short_code?: string } | null)?.short_code ?? null;
  } catch {
    /* best effort */
  }

  const selfHosts = [
    ...domains,
    ...domains.map((d) => (d.startsWith("www.") ? d.slice(4) : `www.${d}`)),
    "sleepox.com",
    "www.sleepox.com",
  ];

  const perDomain = await Promise.all(
    domains.map(async (d) => {
      try {
        return await scanDomain(d, sampleCode, selfHosts);
      } catch (err) {
        return [
          {
            check: "scan_failed",
            severity: "warn" as Severity,
            domain: d,
            url: `https://${d}`,
            message: `Leak scan failed for ${d}`,
            evidence: (err as Error)?.message ?? "unknown",
            fix: "Re-run the scan. If it keeps failing, the domain's DNS or SSL is broken.",
          },
        ];
      }
    }),
  );

  const findings = perDomain.flat();

  if (findings.length > 0) {
    const rows = findings.map((f) => ({
      source: LEAK_SOURCE,
      level: f.severity,
      message: `[${f.check}] ${f.message}`,
      context: {
        check: f.check,
        domain: f.domain,
        url: f.url,
        evidence: f.evidence,
        fix: f.fix,
        scanned_at: new Date().toISOString(),
      },
    }));
    try {
      await (
        supabaseAdmin.from as unknown as (t: string) => {
          insert: (r: Record<string, unknown>[]) => Promise<unknown>;
        }
      )("error_logs").insert(rows);
    } catch (err) {
      console.error("[leak-monitor] failed to persist findings", err);
    }
  }

  return {
    scanned_at: new Date().toISOString(),
    domains,
    sample_code: sampleCode,
    total: findings.length,
    critical: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warn").length,
    findings,
  };
}
