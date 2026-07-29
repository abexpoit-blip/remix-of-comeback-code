import { redisDel } from "@/lib/redis-cache.server";

// Redirect-path L2 cache prefix (must stay in sync with src/routes/r.$code.ts).
const L2_LINK_PREFIX = "rd:link:";

/**
 * Drop the shared Redis entry for a short code so every PM2 worker re-reads the
 * row from the database on the next hit. Without this, an edited destination
 * keeps serving the old URL for up to 30 minutes.
 * Best-effort: never throws.
 */
export async function invalidateLinkCache(code?: string | null): Promise<void> {
  if (!code) return;
  try {
    await redisDel(L2_LINK_PREFIX + code);
  } catch {
    // ignore — cache invalidation is best-effort
  }
}
