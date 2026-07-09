import { createStart, createMiddleware } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

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

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
