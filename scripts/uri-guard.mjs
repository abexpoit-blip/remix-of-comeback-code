// Loaded by Node before the app server starts.
// Purpose: malformed bot URLs like `/r/%E0%A4` can throw `URIError: URI malformed`
// inside the HTTP/router stack before TanStack middleware is reached. If not swallowed,
// PM2 restarts the worker. We only swallow this known-safe URI decode error.

const INSTALL_KEY = Symbol.for("sleepox.uriGuardInstalled");

function isMalformedUriError(error) {
  return error instanceof URIError || String(error?.message || error).includes("URI malformed");
}

if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = true;

  const originalEmit = process.emit.bind(process);

  process.emit = function patchedEmit(eventName, error, ...args) {
    if (eventName === "uncaughtException" && isMalformedUriError(error)) {
      console.warn("[uri-guard] Swallowed URIError (malformed URL from bot):", error?.message || error);
      return true;
    }

    return originalEmit(eventName, error, ...args);
  };
}