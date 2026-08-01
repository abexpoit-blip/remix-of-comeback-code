// Install process-level guards at server bundle load time.
// h3's decodePathname (H3Event constructor) throws URIError on malformed
// URLs (e.g. bots hitting `/r/%E0%A4` or `/foo%`), and the throw happens
// BEFORE our fetch handler runs — so a try/catch in `fetch()` cannot catch
// it. Without this listener, Node's default behavior kills the PM2 worker.
if (typeof process !== "undefined" && typeof process.on === "function") {
  const g = globalThis as { __sleepox_proc_guards?: boolean };
  if (!g.__sleepox_proc_guards) {
    g.__sleepox_proc_guards = true;
    process.on("uncaughtException", (err: Error) => {
      if (
        err instanceof URIError ||
        (err && typeof err.message === "string" && err.message.includes("URI malformed"))
      ) {
        // Silently drop — malformed URL from a bot, not our bug.
        return;
      }
      console.error("[uncaughtException]", err);
    });
    process.on("unhandledRejection", (reason) => {
      console.error("[unhandledRejection]", reason);
    });
  }
}

import { isSaasOnlyPath, isSleepoxSaasHost } from "./lib/site-hosts";

type ServerEntry = {

  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

/**
 * The production proxy's bare short-link rewrite can turn `/dashboard` into
 * `/r/dashboard` before TanStack sees the request. On the SaaS host that must
 * resolve back to the real app route, never the unknown-code safe article.
 * Shortener hosts deliberately keep `/r/<code>` unchanged.
 */
function restoreSaasRoute(request: Request): Request {
  const url = new URL(request.url);
  if (!url.pathname.toLowerCase().startsWith("/r/")) return request;

  const host = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  ).split(",")[0].trim();
  const restoredPath = url.pathname.slice(2) || "/";

  if (!isSleepoxSaasHost(host) || !isSaasOnlyPath(restoredPath)) return request;

  url.pathname = restoredPath;
  return new Request(url, request);
}

// Paths whose HTML is user/host specific and must never be cached or shared.
const SAAS_HTML_PREFIXES = [
  "/login",
  "/signup",
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
  "/pricing",
];

// Security headers applied to every response (improves domain trust score).
// Note: do NOT set X-Frame-Options on /r/* article responses for FB crawler — FB embeds in iframe.
function applySecurityHeaders(request: Request, response: Response): Response {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);

  // Always-on baseline
  if (!headers.has("strict-transport-security")) {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  }
  if (!headers.has("x-content-type-options")) {
    headers.set("x-content-type-options", "nosniff");
  }
  if (!headers.has("referrer-policy")) {
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
  }
  if (!headers.has("permissions-policy")) {
    headers.set("permissions-policy", "geolocation=(), microphone=(), camera=(), payment=()");
  }
  if (!headers.has("x-xss-protection")) {
    headers.set("x-xss-protection", "0");
  }

  // X-Frame-Options: skip for /r/* (cloaked article may be previewed in social iframes)
  const isRedirectRoute = url.pathname.startsWith("/r/");
  if (!isRedirectRoute && !headers.has("x-frame-options")) {
    headers.set("x-frame-options", "SAMEORIGIN");
  }

  // ── HOST-DEPENDENT HTML MUST NEVER BE SHARED BETWEEN DOMAINS ──────────────
  // The same worker renders three different sites off the same paths:
  //   sleepox.com/…      → the SaaS app
  //   tekuc.com/…        → neutral storefront / article content
  // The page body is chosen from the Host header, but the response carried no
  // `Vary`, so ANY shared cache (nginx proxy_cache, Cloudflare, a corporate
  // proxy) could hand the storefront/article HTML to someone who asked
  // sleepox.com/dashboard — which is exactly the "reload or duplicate tab and
  // I get the blog page" bug — and hand SaaS HTML to an ad domain (the
  // /dashboard 200 the leak monitor reported on tekuc.com).
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const existingVary = headers.get("vary");
    const varyParts = new Set(
      (existingVary ? existingVary.split(",") : []).map((v) => v.trim()).filter(Boolean),
    );
    varyParts.add("Host");
    varyParts.add("X-Forwarded-Host");
    headers.set("vary", Array.from(varyParts).join(", "));

    // Authenticated / product HTML is per-user: never let it sit in any cache.
    const p = url.pathname.toLowerCase();
    const isAppHtml =
      p === "/" ||
      SAAS_HTML_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + "/"));
    if (isAppHtml && !isRedirectRoute) {
      headers.set("cache-control", "private, no-store, must-revalidate");
    } else if (!headers.has("cache-control")) {
      headers.set("cache-control", "private, no-cache");
    }
  }


  const nullBodyStatus = response.status === 204 || response.status === 205 || response.status === 304;

  return new Response(nullBodyStatus ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const routedRequest = restoreSaasRoute(request);
      const handler = await getServerEntry();
      const response = await handler.fetch(routedRequest, env, ctx);
      return applySecurityHeaders(routedRequest, response);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        request,
        new Response("Internal Server Error", {
          status: 500,
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
      );
    }
  },
};
