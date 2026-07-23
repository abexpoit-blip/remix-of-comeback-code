import { useEffect, useState, useCallback } from "react";

export const SHORT_DOMAINS = [
  { host: "tekuc.com", label: "tekuc.com" },
  { host: "breezysocial.com", label: "breezysocial.com" },
] as const;

export type ShortDomainHost = (typeof SHORT_DOMAINS)[number]["host"];

const STORAGE_KEY = "sleepox.shortDomain";
const DEFAULT_HOST: ShortDomainHost = "tekuc.com";

function isValidHost(h: string | null): h is ShortDomainHost {
  return !!h && SHORT_DOMAINS.some((d) => d.host === h);
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
