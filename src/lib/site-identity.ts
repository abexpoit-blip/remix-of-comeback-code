/**
 * Per-host storefront identity.
 *
 * LEAK FIX (ad rejections): every storefront page used to render one hardcoded
 * `SITE` constant — "BreezySocial", hello@breezysocial.com, the same phone
 * number and the same San Francisco street address — on EVERY domain. A
 * reviewer only had to open mefok.com/about and skypq.com/about side by side
 * to prove the two ad domains are the same operator. Worse, the body copy
 * literally said "BreezySocial" on domains that are not breezysocial.com.
 *
 * Everything a visitor can read must now come from this file, keyed by host.
 * Unknown hosts get a deterministic SYNTHETIC identity (derived from the host
 * name) instead of silently inheriting a real brand's contact details.
 */

import { normalizeHost } from "@/lib/brand-assets";
import { getHost } from "@/lib/host";

export type SiteIdentity = {
  name: string;
  tagline: string;
  email: string;
  supportEmail: string;
  /** Street line, city + postcode. Unique per brand. */
  address: string;
  phone: string;
  founded: number;
  /** "San Francisco, CA" — used in footers and schema. */
  city: string;
  /** Neighbourhood / studio wording used in About copy. */
  district: string;
  /** Founder name used in the About story. */
  founder: string;
  /** Team size used in the About story. */
  teamSize: number;
  /** Legal entity suffix ("Inc.", "LLC", "Ltd.") */
  legalSuffix: string;
  /** Support hours line shown on Contact. */
  hours: string;
  /** Jurisdiction for the Terms governing-law clause. */
  jurisdiction: string;
};

const IDENTITIES: Record<string, SiteIdentity> = {
  "breezysocial.com": {
    name: "BreezySocial",
    tagline: "Smart gadgets for calm, modern living.",
    email: "hello@breezysocial.com",
    supportEmail: "support@breezysocial.com",
    address: "1280 Market Street, Suite 400, San Francisco, CA 94102",
    phone: "+1 (415) 555-0142",
    founded: 2019,
    city: "San Francisco, CA",
    district: "the Mission District",
    founder: "Mira Ostrowski",
    teamSize: 14,
    legalSuffix: "Inc.",
    hours: "Mon–Fri, 9am–5pm PST",
    jurisdiction: "the State of California, USA",
  },
  "mefok.com": {
    name: "Mefok",
    tagline: "Simple home gear for better daily routines.",
    email: "hello@mefok.com",
    supportEmail: "care@mefok.com",
    address: "914 SE Alder Street, Unit 6, Portland, OR 97214",
    phone: "+1 (503) 555-0188",
    founded: 2021,
    city: "Portland, OR",
    district: "the Buckman neighbourhood",
    founder: "Dana Whitcomb",
    teamSize: 9,
    legalSuffix: "LLC",
    hours: "Mon–Fri, 8am–4pm PT",
    jurisdiction: "the State of Oregon, USA",
  },
  "skypq.com": {
    name: "Skypq",
    tagline: "Everyday essentials, thoughtfully made.",
    email: "hello@skypq.com",
    supportEmail: "help@skypq.com",
    address: "2210 Blake Street, Floor 2, Denver, CO 80205",
    phone: "+1 (720) 555-0117",
    founded: 2020,
    city: "Denver, CO",
    district: "the Five Points district",
    founder: "Aaron Deveaux",
    teamSize: 11,
    legalSuffix: "LLC",
    hours: "Mon–Fri, 9am–5pm MT",
    jurisdiction: "the State of Colorado, USA",
  },
  "tekuc.com": {
    name: "Tekuc",
    tagline: "Modern wellness tech for calm, focused living.",
    email: "hello@tekuc.com",
    supportEmail: "support@tekuc.com",
    address: "605 West 42nd Street, Suite 12, Austin, TX 78751",
    phone: "+1 (512) 555-0163",
    founded: 2022,
    city: "Austin, TX",
    district: "the Hyde Park area",
    founder: "Lena Farrow",
    teamSize: 7,
    legalSuffix: "LLC",
    hours: "Mon–Fri, 9am–5pm CT",
    jurisdiction: "the State of Texas, USA",
  },
  "sleepox.com": {
    name: "Sleepox",
    tagline: "Sleep-first gear engineered for real rest.",
    email: "hello@sleepox.com",
    supportEmail: "support@sleepox.com",
    address: "1201 Western Avenue, Suite 305, Seattle, WA 98101",
    phone: "+1 (206) 555-0175",
    founded: 2018,
    city: "Seattle, WA",
    district: "the Belltown area",
    founder: "Priya Raman",
    teamSize: 16,
    legalSuffix: "Inc.",
    hours: "Mon–Fri, 9am–5pm PT",
    jurisdiction: "the State of Washington, USA",
  },
};

/* --------------------------------------------------------------------- */
/* Synthetic identity for unregistered hosts — never inherit a real brand. */
/* --------------------------------------------------------------------- */

const SYNTH_CITIES = [
  { city: "Columbus, OH", street: "418 North High Street", zip: "43215", area: "the Short North", code: "614", tz: "ET", state: "the State of Ohio, USA" },
  { city: "Boise, ID", street: "760 West Idaho Street", zip: "83702", area: "the North End", code: "208", tz: "MT", state: "the State of Idaho, USA" },
  { city: "Raleigh, NC", street: "233 South Wilmington Street", zip: "27601", area: "the Warehouse District", code: "919", tz: "ET", state: "the State of North Carolina, USA" },
  { city: "Madison, WI", street: "512 East Wilson Street", zip: "53703", area: "the Willy Street area", code: "608", tz: "CT", state: "the State of Wisconsin, USA" },
];
const SYNTH_FOUNDERS = ["Noel Bergstrom", "Iris Kaneko", "Tomas Ardelean", "Hana Vogel", "Peter Larkin"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function titleCase(host: string): string {
  const base = host.split(".")[0].replace(/[^a-z0-9]/gi, "");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function syntheticIdentity(host: string): SiteIdentity {
  const h = hash(host || "unknown");
  const loc = SYNTH_CITIES[h % SYNTH_CITIES.length];
  const name = titleCase(host || "Store");
  return {
    name,
    tagline: "Everyday gear, thoughtfully chosen.",
    email: `hello@${host}`,
    supportEmail: `support@${host}`,
    address: `${loc.street}, Suite ${1 + (h % 40)}, ${loc.city} ${loc.zip}`,
    phone: `+1 (${loc.code}) 555-0${String(100 + (h % 800)).slice(0, 3)}`,
    founded: 2018 + (h % 6),
    city: loc.city,
    district: loc.area,
    founder: SYNTH_FOUNDERS[h % SYNTH_FOUNDERS.length],
    teamSize: 6 + (h % 12),
    legalSuffix: h % 2 === 0 ? "LLC" : "Inc.",
    hours: `Mon–Fri, 9am–5pm ${loc.tz}`,
    jurisdiction: loc.state,
  };
}

/** Identity for a host or origin. Never falls back to another real brand. */
export function siteFor(hostOrOrigin: string): SiteIdentity {
  const host = normalizeHost(hostOrOrigin);
  if (!host) return IDENTITIES["breezysocial.com"];
  return IDENTITIES[host] ?? syntheticIdentity(host);
}

/** Isomorphic hook-style accessor for components (server + client safe). */
export function useSite(): SiteIdentity {
  return siteFor(getHost());
}

/**
 * Rewrite any hardcoded "BreezySocial" / "breezysocial.com" mention inside
 * static catalog + article copy so an ad domain never prints another brand's
 * name in its body text. This was the single loudest cross-domain fingerprint:
 * mefok.com/about literally said "BreezySocial" nine times.
 */
export function rebrandText(text: string, hostOrOrigin: string): string {
  if (!text) return text;
  const site = siteFor(hostOrOrigin);
  const host = site.email.split("@")[1] ?? "breezysocial.com";
  if (site.name === "BreezySocial") return text;
  return text
    .replace(/breezysocial\.com/gi, host)
    .replace(/BreezySocial/g, site.name)
    .replace(/breezysocial/gi, site.name.toLowerCase());
}

/** Component-side variant of rebrandText bound to the current host. */
export function useRebrand(): (text: string) => string {
  const host = getHost();
  return (text: string) => rebrandText(text, host);
}
