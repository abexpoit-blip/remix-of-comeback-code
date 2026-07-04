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
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return applySecurityHeaders(request, response);
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
