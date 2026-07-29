import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { isSleepoxSaasHost } from "@/lib/site-hosts";

/**
 * Returns the current request host (lowercased, no port), e.g. "breezysocial.com".
 * Works on both server (reads x-forwarded-host / host header) and client
 * (reads window.location.hostname). Used to switch the homepage between the
 * Sleepox SaaS landing and the BreezySocial gadget storefront on the same app.
 */
export const getHost = createIsomorphicFn()
  .server(() => {
    try {
      const req = getRequest();
      const raw =
        req.headers.get("x-forwarded-host") ||
        req.headers.get("host") ||
        "";
      return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
    } catch {
      return "";
    }
  })
  .client(() => {
    if (typeof window === "undefined") return "";
    return window.location.hostname.toLowerCase();
  });

export type SiteVariant = "breezysocial" | "sleepox";

/**
 * Only the real SaaS hosts render the Sleepox landing page. Every shortener /
 * custom domain (tekuc.com, breezysocial.com, user domains) renders the
 * neutral BreezySocial storefront so an ad reviewer opening the bare domain
 * sees ordinary content, never a link-shortener product page.
 */
export function variantFromHost(host: string): SiteVariant {
  return isSleepoxSaasHost(host) ? "sleepox" : "breezysocial";
}
