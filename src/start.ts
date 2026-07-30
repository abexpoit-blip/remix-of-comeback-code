import { createStart, createMiddleware } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { isShortenerHost, isSaasOnlyPath } from "@/lib/site-hosts";

/** Neutral 404 body — no product name, no framework hints. */
const NOT_FOUND_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Page not found</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#fff;color:#111}main{text-align:center;padding:24px}h1{font-size:56px;margin:0 0 8px;font-weight:600}p{margin:0;color:#666;font-size:15px}</style></head><body><main><h1>404</h1><p>The page you requested could not be found.</p></main></body></html>`;

// Prevent worker crashes from malformed URIs (e.g. bots sending `/r/%E0%A4`)
// h3's decodePathname throws URIError BEFORE middleware runs, killing the worker.
// Node.js default: uncaughtException = process exit. We swallow it to keep PM2 workers alive.
if (typeof process !== "undefined" && process.on) {
  const g = globalThis as { __sleepox_handlers_installed?: boolean };
  if (!g.__sleepox_handlers_installed) {
    g.__sleepox_handlers_installed = true;
    const shouldLogUriNoise = () => {
      const state = globalThis as typeof globalThis & {
        __sleepoxUriNoiseMinute?: number;
        __sleepoxUriNoiseCount?: number;
      };
      const minute = Math.floor(Date.now() / 60_000);
      if (state.__sleepoxUriNoiseMinute !== minute) {
        state.__sleepoxUriNoiseMinute = minute;
        state.__sleepoxUriNoiseCount = 0;
      }
      state.__sleepoxUriNoiseCount = (state.__sleepoxUriNoiseCount ?? 0) + 1;
      return state.__sleepoxUriNoiseCount === 1 || state.__sleepoxUriNoiseCount % 500 === 0;
    };

    process.on("uncaughtException", (err: Error) => {
      // Only swallow known-safe errors; re-throw anything unexpected
      if (err instanceof URIError || err?.message?.includes("URI malformed")) {
        if (shouldLogUriNoise()) {
          console.warn("[uri-guard] malformed bot URL swallowed");
        }
        return;
      }
      console.error("[uncaughtException] FATAL:", err);
      // Let PM2 restart the worker for truly fatal errors
      process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
      console.error("[unhandledRejection]", reason);
    });
  }
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response("Internal Server Error", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
});

/**
 * SHORTENER-HOST SHIELD.
 *
 * On any host that is not the Sleepox SaaS domain (tekuc.com,
 * breezysocial.com, user custom domains) every SaaS surface — sign-in,
 * pricing, dashboard, control panel — is hidden behind a plain 404.
 * Without this an ad reviewer can open `https://<ad-domain>/login`,
 * see "Sign in — Sleepox", and ban the domain for cloaking.
 *
 * Deny-list only: any path not listed passes straight through, so redirect
 * traffic (`/{code}`, `/r/{code}`, `/api/*`, assets) can never be affected.
 */
const shortenerShield = createMiddleware().server(async ({ next, request }) => {
  try {
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "";
    const pathname = new URL(request.url).pathname;
    if (isShortenerHost(host.split(",")[0].trim()) && isSaasOnlyPath(pathname)) {
      return new Response(NOT_FOUND_HTML, {
        status: 404,
        headers: {
          "content-type": "text/html; charset=utf-8",
          // Never cache: a shared cache could otherwise serve this 404 for
          // sleepox.com/login too. Vary on host for good measure.
          "cache-control": "no-store",
          vary: "Host, X-Forwarded-Host",
        },
      });
    }
  } catch {
    // Never let the shield break a request.
  }
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, shortenerShield],
  functionMiddleware: [attachSupabaseAuth],
}));
