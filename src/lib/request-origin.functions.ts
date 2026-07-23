/**
 * Returns the origin the current request was served from — e.g.
 * "https://tekuc.com" or "https://breezysocial.com" — reading the same
 * headers Nginx forwards to the Worker. Used by safe pages / articles so
 * every canonical, og:url, og:image and JSON-LD self-references the host
 * the crawler actually hit (no cross-domain fingerprint linking the
 * shortener to the safe-content brand).
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";

const FALLBACK_ORIGIN = "https://tekuc.com";

function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const clean = host.split(",")[0].trim().toLowerCase();
  if (!clean) return null;
  // strip port for standard 80/443
  return clean.replace(/:80$|:443$/, "");
}

function pickProto(headers: Headers): string {
  const xf = headers.get("x-forwarded-proto");
  if (xf) return xf.split(",")[0].trim() || "https";
  return "https";
}

export function readOriginFromRequest(): string {
  try {
    const req = getRequest();
    const headers = req.headers;
    const host =
      normalizeHost(headers.get("x-forwarded-host")) ??
      normalizeHost(headers.get("host")) ??
      normalizeHost(getRequestHeader("host"));
    if (!host) return FALLBACK_ORIGIN;
    return `${pickProto(headers)}://${host}`;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

export const getRequestOrigin = createServerFn({ method: "GET" }).handler(async () => {
  return { origin: readOriginFromRequest() };
});
