/**
 * Limited-time promo campaign (auto-expires — no code change needed to revert).
 *
 * 1M USERS CELEBRATION — Lifetime Unlimited $50 → $35 for 7 days.
 * After `endsAt` passes, every helper below returns the original pricing and
 * the UI banner/badges disappear automatically.
 */
export const CAMPAIGN = {
  enabled: true,
  /** package slug the discount applies to */
  slug: "lifetime",
  title: "1M Users Celebration",
  subtitle: "Lifetime Unlimited — one-time payment, forever access",
  originalPrice: 50,
  price: 35,
  startsAt: "2026-07-27T00:00:00Z",
  endsAt: "2026-08-03T23:59:59Z",
} as const;

export function isCampaignActive(now: number = Date.now()): boolean {
  if (!CAMPAIGN.enabled) return false;
  const start = Date.parse(CAMPAIGN.startsAt);
  const end = Date.parse(CAMPAIGN.endsAt);
  return now >= start && now <= end;
}

export function campaignEndsAtMs(): number {
  return Date.parse(CAMPAIGN.endsAt);
}

/** Discount percentage, e.g. 30 */
export function campaignDiscountPct(): number {
  return Math.round(((CAMPAIGN.originalPrice - CAMPAIGN.price) / CAMPAIGN.originalPrice) * 100);
}

/**
 * Effective price for a package. Returns the base price unchanged when the
 * campaign is over or the package is not part of the promo.
 */
export function campaignPriceFor(slug: string, basePrice: number, now: number = Date.now()): number {
  const s = (slug || "").toLowerCase();
  const promoSlug = CAMPAIGN.slug;
  const matches = s === promoSlug || (promoSlug === "lifetime" && s === "unlimited");
  if (!matches) return basePrice;
  if (!isCampaignActive(now)) return basePrice;
  // Only discount when the stored price is the expected original price.
  if (Number(basePrice) !== CAMPAIGN.originalPrice) return basePrice;
  return CAMPAIGN.price;
}

export function isCampaignPackage(slug: string): boolean {
  const s = (slug || "").toLowerCase();
  return s === CAMPAIGN.slug || (CAMPAIGN.slug === "lifetime" && s === "unlimited");
}
