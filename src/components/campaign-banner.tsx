import { useEffect, useState } from "react";
import { Crown, Sparkles, PartyPopper, Timer } from "lucide-react";
import {
  CAMPAIGN,
  campaignDiscountPct,
  campaignEndsAtMs,
  isCampaignActive,
} from "@/lib/campaign";

function useCountdown(target: number) {
  const [left, setLeft] = useState(() => Math.max(0, target - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, target - Date.now())), 1000);
    return () => clearInterval(t);
  }, [target]);
  const s = Math.floor(left / 1000);
  return {
    left,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  };
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="min-w-[54px] rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 px-3 py-2 text-2xl sm:text-3xl font-extrabold tabular-nums text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]">
        {String(value).padStart(2, "0")}
      </div>
      <span className="mt-1.5 text-[9px] font-bold uppercase tracking-widest text-white/75">{label}</span>
    </div>
  );
}

/**
 * Celebration promo banner with live countdown.
 * Renders nothing once the campaign window has passed.
 */
export function CampaignBanner({ onClaim }: { onClaim?: () => void }) {
  const [active, setActive] = useState(() => isCampaignActive());
  const end = campaignEndsAtMs();
  const { left, days, hours, mins, secs } = useCountdown(end);

  useEffect(() => {
    if (left <= 0) setActive(isCampaignActive());
  }, [left]);

  if (!active || left <= 0) return null;

  return (
    <section
      className="relative overflow-hidden rounded-[32px] p-7 sm:p-10 bg-gradient-to-br from-[#FF7E5F] via-[#FE8C6E] to-[#FEB47B] border border-white/30 shadow-[0_40px_100px_-30px_rgba(255,126,95,0.6)]"
      aria-label="Limited time lifetime offer"
    >
      <div className="pointer-events-none absolute -top-16 -left-10 w-64 h-64 rounded-full bg-white/20 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-20 right-0 w-72 h-72 rounded-full bg-[#FFF9F5]/25 blur-[90px]" />

      <div className="relative grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white">
            <PartyPopper className="w-3.5 h-3.5" /> {CAMPAIGN.title}
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold leading-[1.05] tracking-tight text-white">
            1,000,000 users, thank you.
            <br />
            <span className="text-white/90">Lifetime for just </span>
            <span className="inline-flex items-baseline gap-2">
              <span className="text-white/60 line-through text-2xl sm:text-4xl">${CAMPAIGN.originalPrice}</span>
              <span className="text-white">${CAMPAIGN.price}</span>
            </span>
          </h2>

          <p className="text-white/85 text-base max-w-xl">
            {CAMPAIGN.subtitle}. Unlimited links, unlimited clicks, elite Bot Shield & priority support —
            <strong className="font-extrabold"> save {campaignDiscountPct()}%</strong> for the next 7 days only.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={onClaim}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-extrabold text-[#FF7E5F] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-0.5"
            >
              <Crown className="w-4 h-4" /> Claim ${CAMPAIGN.price} Lifetime
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
              <Sparkles className="w-3.5 h-3.5" /> Instant auto-activation after payment
            </span>
          </div>
        </div>

        <div className="rounded-3xl bg-black/10 backdrop-blur-xl border border-white/25 p-5 sm:p-6">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/80">
            <Timer className="w-3.5 h-3.5" /> Offer ends in
          </div>
          <div className="mt-4 flex items-start justify-center gap-2 sm:gap-3">
            <Unit value={days} label="Days" />
            <Unit value={hours} label="Hours" />
            <Unit value={mins} label="Mins" />
            <Unit value={secs} label="Secs" />
          </div>
          <p className="mt-4 text-center text-[11px] text-white/75">
            Price returns to ${CAMPAIGN.originalPrice} automatically when the timer hits zero.
          </p>
        </div>
      </div>
    </section>
  );
}

export default CampaignBanner;
