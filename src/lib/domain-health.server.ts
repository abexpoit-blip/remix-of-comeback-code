import { fetchIpv4 } from "@/lib/fetch-ipv4";
/**
 * Server-only domain health probes: DNS, HTTP (+ redirect chain), SSL cert, DNSBL blacklist.
 *
 * Designed to run in a Node-compatible runtime (PM2 / Bun). Uses only Node built-ins
 * that are safe in the project's Worker runtime as well (dns, tls, net).
 */
import { promises as dns } from "node:dns";
import tls from "node:tls";

export type DomainHealthResult = {
  domain: string;
  status: "healthy" | "warning" | "critical";
  ssl_valid: boolean | null;
  ssl_expires_at: string | null;     // ISO
  ssl_days_remaining: number | null;
  ssl_issuer: string | null;
  dns_ok: boolean;
  http_status: number | null;
  http_final_url: string | null;
  redirect_count: number | null;
  blacklisted: boolean;
  blacklist_sources: string[];
  error_message: string | null;
  raw: Record<string, unknown>;
};

const TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

function normalizeDomain(input: string): string {
  let d = (input || "").trim().toLowerCase();
  if (!d) return d;
  // strip protocol & path
  d = d.replace(/^https?:\/\//, "").split("/")[0].split("?")[0].split("#")[0];
  // strip port
  d = d.split(":")[0];
  return d;
}

export function extractDomainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.toLowerCase();
  } catch { return null; }
}

async function checkDns(domain: string) {
  try {
    const addrs = await withTimeout(dns.resolve4(domain), TIMEOUT_MS, "dns");
    return { ok: addrs.length > 0, addrs };
  } catch (e: any) {
    // try AAAA as fallback
    try {
      const v6 = await withTimeout(dns.resolve6(domain), TIMEOUT_MS, "dns6");
      return { ok: v6.length > 0, addrs: v6 };
    } catch {
      return { ok: false, addrs: [] as string[], error: e?.message || "dns failed" };
    }
  }
}

async function checkHttp(domain: string) {
  // Follow redirects manually so we can count + capture final URL.
  let url = `https://${domain}/`;
  let redirects = 0;
  let lastStatus: number | null = null;
  let lastUrl = url;
  const visited = new Set<string>();
  try {
    for (let i = 0; i < 6; i++) {
      if (visited.has(url)) break;
      visited.add(url);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetchIpv4(url, {
          method: "GET",
          redirect: "manual",
          signal: ctrl.signal,
          headers: { "user-agent": "Mozilla/5.0 (compatible; SleepoxDomainHealth/1.0)" },
        });
      } finally { clearTimeout(t); }
      lastStatus = res.status;
      lastUrl = url;
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        url = new URL(loc, url).toString();
        redirects++;
        continue;
      }
      break;
    }
    return { status: lastStatus, final_url: lastUrl, redirects, error: null as string | null };
  } catch (e: any) {
    return { status: lastStatus, final_url: lastUrl, redirects, error: e?.message || "http failed" };
  }
}

type SslInfo = {
  valid: boolean | null;
  expires_at: string | null;
  days_remaining: number | null;
  issuer: string | null;
  error: string | null;
};

function checkSsl(domain: string): Promise<SslInfo> {
  return new Promise((resolve) => {
    let socket: tls.TLSSocket;
    const onConnect = () => {
      try {
        const cert = socket.getPeerCertificate(true);
        if (!cert || !cert.valid_to) {
          socket.end();
          return resolve({ valid: null, expires_at: null, days_remaining: null, issuer: null, error: "no cert" });
        }
        const expires = new Date(cert.valid_to);
        const days = Math.floor((expires.getTime() - Date.now()) / 86_400_000);
        const issuerObj = cert.issuer as { O?: string; CN?: string } | undefined;
        const issuer = issuerObj?.O || issuerObj?.CN || null;
        const sockAny = socket as unknown as { authorized?: boolean; authorizationError?: string };
        const authorized = sockAny.authorized === true;
        socket.end();
        resolve({
          valid: authorized && days > 0,
          expires_at: expires.toISOString(),
          days_remaining: days,
          issuer: typeof issuer === "string" ? issuer : null,
          error: authorized ? null : (sockAny.authorizationError || "untrusted"),
        });
      } catch (e: any) {
        try { socket.destroy(); } catch {}
        resolve({ valid: false, expires_at: null, days_remaining: null, issuer: null, error: e?.message || "ssl read failed" });
      }
    };
    socket = tls.connect({
      host: domain,
      port: 443,
      servername: domain,
      timeout: TIMEOUT_MS,
      rejectUnauthorized: false,
    }, onConnect);
    socket.on("timeout", () => {
      try { socket.destroy(); } catch {}
      resolve({ valid: null, expires_at: null, days_remaining: null, issuer: null, error: "ssl timeout" });
    });
    socket.on("error", (e: any) => {
      resolve({ valid: false, expires_at: null, days_remaining: null, issuer: null, error: e?.message || "ssl error" });
    });
  });
}

// Domain-based DNSBLs (work on apex domain rather than IP)
const DNSBLS = [
  { name: "Spamhaus DBL", zone: "dbl.spamhaus.org" },
  { name: "SURBL multi", zone: "multi.surbl.org" },
  { name: "URIBL black", zone: "black.uribl.com" },
];

async function checkBlacklists(domain: string) {
  const apex = domain.split(".").slice(-2).join(".");
  const hit: string[] = [];
  await Promise.all(DNSBLS.map(async ({ name, zone }) => {
    try {
      const addrs = await withTimeout(dns.resolve4(`${apex}.${zone}`), 4000, `dnsbl-${name}`);
      // Spamhaus returns 127.255.255.252/254/255 for query errors — ignore those
      const real = addrs.filter((a) => !/^127\.255\.255\./.test(a));
      if (real.length > 0) hit.push(name);
    } catch {
      // NXDOMAIN = clean
    }
  }));
  return hit;
}

export async function runDomainHealthCheck(rawDomain: string): Promise<DomainHealthResult> {
  const domain = normalizeDomain(rawDomain);
  const errors: string[] = [];

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return {
      domain: domain || rawDomain,
      status: "critical",
      ssl_valid: null, ssl_expires_at: null, ssl_days_remaining: null, ssl_issuer: null,
      dns_ok: false, http_status: null, http_final_url: null, redirect_count: null,
      blacklisted: false, blacklist_sources: [],
      error_message: "invalid domain",
      raw: { input: rawDomain },
    };
  }

  const [dnsR, httpR, sslR, blR] = await Promise.allSettled([
    checkDns(domain),
    checkHttp(domain),
    checkSsl(domain),
    checkBlacklists(domain),
  ]);

  const dnsRes = dnsR.status === "fulfilled" ? dnsR.value : { ok: false, addrs: [], error: String(dnsR.reason) };
  const httpRes = httpR.status === "fulfilled" ? httpR.value : { status: null, final_url: null, redirects: null, error: String(httpR.reason) };
  const sslRes = sslR.status === "fulfilled" ? sslR.value : { valid: false, expires_at: null, days_remaining: null, issuer: null, error: String(sslR.reason) };
  const blRes = blR.status === "fulfilled" ? blR.value : [];

  if ((dnsRes as any).error) errors.push(`dns:${(dnsRes as any).error}`);
  if (httpRes.error) errors.push(`http:${httpRes.error}`);
  if (sslRes.error) errors.push(`ssl:${sslRes.error}`);

  // Status decision
  let status: "healthy" | "warning" | "critical" = "healthy";
  if (!dnsRes.ok) status = "critical";
  else if (blRes.length > 0) status = "critical";
  else if (sslRes.valid === false) status = "critical";
  else if (httpRes.status && httpRes.status >= 500) status = "critical";
  else if ((sslRes.days_remaining ?? 999) <= 14) status = "warning";
  else if (httpRes.status && (httpRes.status >= 400 && httpRes.status < 500)) status = "warning";
  else if ((httpRes.redirects ?? 0) >= 4) status = "warning";

  return {
    domain,
    status,
    ssl_valid: sslRes.valid,
    ssl_expires_at: sslRes.expires_at,
    ssl_days_remaining: sslRes.days_remaining,
    ssl_issuer: sslRes.issuer,
    dns_ok: dnsRes.ok,
    http_status: httpRes.status,
    http_final_url: httpRes.final_url,
    redirect_count: httpRes.redirects,
    blacklisted: blRes.length > 0,
    blacklist_sources: blRes,
    error_message: errors.length ? errors.join(" | ") : null,
    raw: { dns: dnsRes, http: httpRes, ssl: sslRes, blacklists: blRes },
  };
}
