import { isSleepoxSaasHost } from "@/lib/site-hosts";

/**
 * Operational endpoints (health, leak sweeps, crawler probes, prelanding
 * previews) must only answer on the SaaS host.
 *
 * LEAK FIX: `/api/public/*` is not covered by the SaaS path shield, so these
 * routes answered on the ad domains too. Their JSON payloads enumerate every
 * domain in the group ("breezysocial.com, skypq.com, mefok.com, sleepox.com"),
 * and their only auth was the Supabase publishable key — which by design ships
 * inside the client bundle. Anyone who read the bundle could ask an ad domain
 * to list its sibling domains. Now they 404 anywhere but the SaaS host,
 * indistinguishable from a route that does not exist.
 */
/**
 * A hard 404 for ops endpoints. Used as the GET handler on POST-only cron
 * routes: without it a browser/reviewer GET falls through to the SSR app
 * shell and answers 200, which advertises that the path exists.
 */
export function opsNotFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      vary: "Host, X-Forwarded-Host",
    },
  });
}

export function internalHostGuard(request: Request): Response | null {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (isSleepoxSaasHost(host)) return null;

  return new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      vary: "Host, X-Forwarded-Host",
    },
  });
}
