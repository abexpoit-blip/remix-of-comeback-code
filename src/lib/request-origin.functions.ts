/**
 * Returns the origin the current request was served from — e.g.
 * "https://tekuc.com" or "https://breezysocial.com". Server-only import
 * lives inside the handler so this module stays safe to import from
 * client-reachable route files.
 */
import { createServerFn } from "@tanstack/react-start";

// 2026-08: tekuc.com is Google-Safe-Browsing flagged and retired. Never use it
// as a canonical/OG fallback — it would stamp a blacklisted host on real pages.
const FALLBACK_ORIGIN = "https://breezysocial.com";

export const getRequestOrigin = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getRequest, getRequestHeader } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const headers = req.headers;

    const normalize = (host: string | null | undefined): string | null => {
      if (!host) return null;
      const clean = host.split(",")[0].trim().toLowerCase();
      if (!clean) return null;
      return clean.replace(/:80$|:443$/, "");
    };

    const host =
      normalize(headers.get("x-forwarded-host")) ??
      normalize(headers.get("host")) ??
      normalize(getRequestHeader("host"));

    if (!host) return { origin: FALLBACK_ORIGIN };

    const xf = headers.get("x-forwarded-proto");
    const proto = xf ? xf.split(",")[0].trim() || "https" : "https";
    return { origin: `${proto}://${host}` };
  } catch {
    return { origin: FALLBACK_ORIGIN };
  }
});
