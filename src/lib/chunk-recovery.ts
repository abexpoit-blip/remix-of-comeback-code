/**
 * Recovery for stale-deploy asset errors.
 *
 * After a deploy, browsers holding old HTML request JS chunk filenames that no
 * longer exist. The dynamic import rejects and the router error boundary shows
 * "Something went wrong". The correct fix is a single hard reload so the
 * browser picks up the fresh HTML + asset map.
 */

const RELOAD_FLAG = "sx_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 30_000;

const CHUNK_ERROR_PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "failed to load module script",
  "unable to preload css",
  "loading chunk",
  "loading css chunk",
  "chunkloaderror",
];

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : `${(error as { name?: string }).name ?? ""} ${(error as { message?: string }).message ?? ""}`;
  const normalized = message.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/**
 * Reloads once (per cooldown window) with a cache-busting query so the stale
 * HTML document is not re-served. Returns true when a reload was triggered.
 */
export function recoverFromChunkError(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_FLAG) ?? "0");
    if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) {
      // Already reloaded very recently — avoid an infinite reload loop.
      return false;
    }
    window.sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    // sessionStorage blocked (private mode / strict cookie settings): still
    // allow one reload attempt rather than leaving the user on an error page.
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

/** Global safety net for chunk errors thrown outside a React boundary. */
export function installChunkErrorRecovery(): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (event: ErrorEvent) => {
    if (isChunkLoadError(event.error ?? event.message)) recoverFromChunkError();
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (isChunkLoadError(event.reason)) recoverFromChunkError();
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
