import { useEffect, useState, useCallback } from "react";

/**
 * Domains flagged by Google Safe Browsing / blocklists. They must never be
 * offered or used as a default short domain — every link on them renders a
 * red "Dangerous site" interstitial. Remove a host from here only after the
 * Safe Browsing review has actually cleared it.
 */
export const FLAGGED_SHORT_DOMAINS: readonly string[] = ["tekuc.com"];

export function isFlaggedShortDomain(host: string): boolean {
  const h = (host || "").toLowerCase().split(":")[0].replace(/^www\./, "").trim();
  return FLAGGED_SHORT_DOMAINS.includes(h);
}

export const SHORT_DOMAINS = [
  { host: "mefok.com", label: "mefok.com" },
  { host: "skypq.com", label: "skypq.com" },
  { host: "breezysocial.com", label: "breezysocial.com" },
] as const;

export type ShortDomainHost = (typeof SHORT_DOMAINS)[number]["host"];

const STORAGE_KEY = "sleepox.shortDomain";
const DEFAULT_HOST: ShortDomainHost = "mefok.com";

function isValidHost(h: string | null): h is ShortDomainHost {
  return !!h && !isFlaggedShortDomain(h) && SHORT_DOMAINS.some((d) => d.host === h);
}

/**
 * Returns the currently selected short-link domain (e.g. "breezysocial.com")
 * and a setter that persists the choice to localStorage.
 *
 * Both domains route to the same backend, so any short code works on either.
 * Default: breezysocial.com (the dedicated shortener domain).
 */
export function useShortDomain(): {
  host: ShortDomainHost;
  baseUrl: string;
  setHost: (h: ShortDomainHost) => void;
} {
  const [host, setHostState] = useState<ShortDomainHost>(DEFAULT_HOST);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isValidHost(saved)) setHostState(saved);
  }, []);

  const setHost = useCallback((h: ShortDomainHost) => {
    setHostState(h);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, h);
    }
  }, []);

  return { host, baseUrl: `https://${host}`, setHost };
}

/** Build a clean short URL like https://breezysocial.com/abc123 (no /r/ prefix). */
export function buildShortUrl(host: ShortDomainHost, code: string): string {
  return `https://${host}/${code}`;
}
