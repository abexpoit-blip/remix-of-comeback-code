/**
 * Host classification for the multi-domain deployment.
 *
 *   sleepox.com / www.sleepox.com  → the SaaS app (dashboard, billing, admin)
 *   every other host (tekuc.com, breezysocial.com, user custom domains)
 *                                  → shortener / content host ONLY
 *
 * Why this exists: an ad reviewer who opens the bare shortener domain must
 * never see a link-shortener SaaS. Seeing "Sleepox — Smart Link Manager"
 * on the domain used in an ad is, by itself, grounds for a domain-level ban.
 * So on shortener hosts we serve only neutral content and 404 every SaaS path.
 */

/** Hosts that are allowed to serve the Sleepox SaaS surface.
 *
 * FAIL-OPEN: an empty / internal host (missing Host header, proxy passing
 * `127.0.0.1:400x`, health checks) must NOT be treated as a shortener host —
 * otherwise real users randomly get a 404 on /login when one upstream worker
 * receives a request without a proper forwarded host.
 */
export function isSleepoxSaasHost(host: string): boolean {
  const h = (host || "").toLowerCase().split(":")[0].trim();
  if (!h) return true; // no host info → never shield
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "::1") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true; // raw IP = internal/proxy hit
  if (!h.includes(".")) return true; // upstream/service name (e.g. "sleepox_backend") = internal hit

  return (
    h === "sleepox.com" ||
    h === "www.sleepox.com" ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com")
  );
}

/** True for tekuc.com, breezysocial.com, user custom domains, … */
export function isShortenerHost(host: string): boolean {
  return !isSleepoxSaasHost(host);
}

/**
 * Path prefixes that expose the SaaS product. Blocked (404) on shortener hosts.
 * Keep this an explicit deny-list: anything not listed keeps working, so a
 * mistake here can never break redirect traffic.
 */
const SAAS_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/pricing",
  "/dashboard",
  "/analytics",
  "/control-panel",
  "/domains",
  "/link-debugger",
  "/live",
  "/notices",
  "/smart-filter",
  "/support",
  "/upgrade",
  "/admin",
  "/sx-vault",
];

export function isSaasOnlyPath(pathname: string): boolean {
  const p = (pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
  return SAAS_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + "/"));
}
