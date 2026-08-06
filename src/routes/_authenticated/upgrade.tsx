import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";

import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck, Zap, Globe2, BarChart3, Bot, Cpu, Infinity as InfinityIcon,
  Sparkles, Crown, Rocket, Lock, Layers, Gauge, Headphones, Star, Check,
  TrendingUp, MousePointerClick, Link2, Wallet, Bitcoin, PartyPopper,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createInvoice, getMyOrders } from "@/lib/billing.functions";
import { adminListUpgradeRequests } from "@/lib/admin.functions";
import { toast } from "sonner";
import { CampaignBanner } from "@/components/campaign-banner";
import {
  CAMPAIGN, campaignDiscountPct, campaignEndsAtMs, campaignPriceFor, isCampaignActive,
} from "@/lib/campaign";

export const Route = createFileRoute("/_authenticated/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade — Sleepox" }] }),
  component: UpgradePage,
});

const font = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

type PlanMeta = {
  icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  blurb: string;
  badge?: string;
  badgeIcon?: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  ctaLabel: string;
  features: { icon: React.ComponentType<{ className?: string }>; text: string }[];
  overflowNote: string;
};

const PLAN_META: Record<string, PlanMeta> = {
  free: {
    icon: Rocket,
    tagline: "Get started",
    blurb: "Perfect for testing the platform & personal links.",
    ctaLabel: "Current plan",
    features: [
      { icon: Link2, text: "1 smart link" },
      { icon: MousePointerClick, text: "1,000,000 clicks / month" },
      { icon: Zap, text: "Edge-fast redirects (~30 ms)" },
      { icon: ShieldCheck, text: "Bot Shield ML filter" },
      { icon: BarChart3, text: "Real-time click analytics" },
      { icon: Globe2, text: "Geo + device intel" },
    ],
    overflowNote: "After 1,000,000 clicks → traffic auto-routes to our Adsterra Direct link.",
  },
  monthly: {
    icon: Sparkles,
    tagline: "For active campaigns",
    blurb: "The sweet spot for growing affiliates & marketers.",
    badge: "MOST POPULAR",
    badgeIcon: Star,
    highlight: true,
    ctaLabel: "Pay with crypto",
    features: [
      { icon: Link2, text: "50 smart links" },
      { icon: MousePointerClick, text: "10,000,000 clicks / month" },
      { icon: Zap, text: "Edge-fast redirects (~30 ms)" },
      { icon: ShieldCheck, text: "Advanced Bot Shield ML" },
      { icon: Bot, text: "Bot traffic auto-filtering" },
      { icon: BarChart3, text: "Real-time analytics + history" },
      { icon: Globe2, text: "Geo + device + ISP routing" },
      { icon: Gauge, text: "Priority redirect lane" },
      { icon: Layers, text: "Custom pre-landers" },
      { icon: Cpu, text: "Smart traffic rotation engine" },
    ],
    overflowNote: "After 10,000,000 clicks → overflow routes to our Adsterra Direct link.",
  },
  lifetime: {
    icon: Crown,
    tagline: "Pay once. Use forever.",
    blurb: "Maximum scale — built for serious operators.",
    badge: "BEST VALUE",
    badgeIcon: Crown,
    ctaLabel: "Unlock lifetime",
    features: [
      { icon: InfinityIcon, text: "Unlimited smart links" },
      { icon: InfinityIcon, text: "Unlimited monthly clicks" },
      { icon: Zap, text: "Edge-fast redirects (~30 ms)" },
      { icon: ShieldCheck, text: "Elite Bot Shield ML" },
      { icon: Bot, text: "AI bot/scraper auto-filter" },
      { icon: BarChart3, text: "Real-time analytics + full history" },
      { icon: Globe2, text: "Geo + device + ISP + carrier routing" },
      { icon: Gauge, text: "Highest priority redirect lane" },
      { icon: Layers, text: "Unlimited custom pre-landers" },
      { icon: Cpu, text: "Smart traffic rotation engine" },
      { icon: Lock, text: "Cloaking + safe-page system" },
      { icon: Headphones, text: "Priority 24/7 support" },
      { icon: TrendingUp, text: "Early access to new features" },
    ],
    overflowNote: "No overflow — you have unlimited clicks, forever.",
  },
};

const SYSTEM_FEATURES = [
  { icon: ShieldCheck, title: "Bot Shield ML", desc: "Machine-learning engine that filters scrapers, crawlers & fake clicks in real time." },
  { icon: Zap, title: "Edge Redirects", desc: "30 ms global redirects deployed to 280+ edge locations worldwide." },
  { icon: Cpu, title: "Smart Rotation", desc: "Auto-rotate traffic between offers based on quota, geo & device fingerprint." },
  { icon: Globe2, title: "Geo Intelligence", desc: "Country, region, device, ISP & carrier-aware routing on every click." },
  { icon: BarChart3, title: "Live Analytics", desc: "Real-time click stream with bot vs human breakdown and 7-day retention." },
  { icon: Lock, title: "Safe-Page Cloaking", desc: "Show clean pages to bots & reviewers, money pages to real humans." },
];

function UpgradePage() {
  const buy = useServerFn(createInvoice);
  const orders = useServerFn(getMyOrders);
  const adminOrders = useServerFn(adminListUpgradeRequests);

  const { data: packages } = useQuery({
    queryKey: ["packages-up"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-plan"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("plan_slug, plan_expires_at").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle(),
      ]);
      return { plan_slug: p?.plan_slug, plan_expires_at: (p as any)?.plan_expires_at ?? null, isAdmin: !!r };
    },
  });
  const rawPlan = (myProfile?.plan_slug || "free").toLowerCase();
  const isAdmin = !!myProfile?.isAdmin;
  const currentPlan =
    rawPlan === "pro_monthly" ? "monthly" :
    rawPlan === "unlimited" ? "lifetime" : rawPlan;
  const planExpiresAt = myProfile?.plan_expires_at ? new Date(myProfile.plan_expires_at) : null;
  const isLifetimePlan = currentPlan === "lifetime";
  const daysLeft = planExpiresAt
    ? Math.max(0, Math.ceil((planExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;
  // NEW RULE: same package cannot be re-purchased while the plan is still active.
  const planStillActive = !!planExpiresAt && planExpiresAt.getTime() > Date.now();
  const [lockedOpen, setLockedOpen] = useState(false);

  // ── 1M users celebration campaign (auto-expires) ─────────────────────────
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const promoActive = isCampaignActive(nowTick);
  const promoMsLeft = Math.max(0, campaignEndsAtMs() - nowTick);
  const promoLeftLabel = (() => {
    const s = Math.floor(promoMsLeft / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
  })();
  const scrollToPromoPlan = () => {
    document.getElementById("plan-card-lifetime")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };




  const { data: ordersList } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => orders(),
  });

  const { data: allOrders } = useQuery({
    queryKey: ["admin-all-orders"],
    queryFn: () => adminOrders(),
    enabled: isAdmin,
  });

  const buyMut = useMutation({
    mutationFn: (slug: string) => buy({ data: { package_slug: slug } }),
    onSuccess: (r) => { window.location.href = r.invoice_url; },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="relative min-h-screen bg-[#FFF9F5] text-[#4A3728] overflow-hidden" style={font}>
      {/* Warm blobs */}
      <div className="fixed top-[-20%] left-[-10%] w-[55%] h-[55%] bg-[#FF7E5F]/15 blur-[160px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-15%] w-[55%] h-[55%] bg-[#FEB47B]/20 blur-[160px] rounded-full pointer-events-none" />
      <div className="fixed top-[40%] left-[35%] w-[35%] h-[35%] bg-[#FFEDD5]/40 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 py-10 sm:py-16 space-y-20">
        {/* Hero */}
        <header className="text-center max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-xl border border-white/80 text-[#FF7E5F] text-[10px] font-bold uppercase tracking-widest shadow-sm">
            <Sparkles className="w-3 h-3" /> Premium plans · Crypto checkout
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#2D1B0D] leading-[1.05]">
            Scale your traffic
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FF7E5F] via-[#FEB47B] to-[#FF7E5F]">
              at the edge of every click.
            </span>
          </h1>
          <p className="text-[#7A5C45] text-lg max-w-xl mx-auto">
            Edge redirects, ML bot shield, geo routing & smart rotation — built for serious operators running real volume.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-[#7A5C45]">
            <span className="inline-flex items-center gap-1.5"><Bitcoin className="w-3.5 h-3.5 text-[#FF7E5F]" /> BTC · USDT · LTC</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-[#FF7E5F]" /> Instant activation</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#FF7E5F]" /> No card required</span>
          </div>
        </header>

        {/* 1M users celebration — limited time */}
        <CampaignBanner onClaim={scrollToPromoPlan} />

        {/* Pricing cards */}
        <section className="grid gap-6 lg:grid-cols-3">
          {packages?.map((p, idx) => {
            // Robust meta lookup: by slug, then by name keyword, then by index order
            const slugKey = (p.slug || "").toLowerCase();
            const nameKey = (p.name || "").toLowerCase();
            const metaBySlug = PLAN_META[slugKey];
            const metaByName =
              nameKey.includes("life") ? PLAN_META.lifetime :
              nameKey.includes("month") || nameKey.includes("pro") ? PLAN_META.monthly :
              nameKey.includes("free") ? PLAN_META.free : undefined;
            const metaByOrder = [PLAN_META.free, PLAN_META.monthly, PLAN_META.lifetime][idx];
            const meta = metaBySlug ?? metaByName ?? metaByOrder ?? PLAN_META.free;
            const Icon = meta.icon;
            const BadgeIcon = meta.badgeIcon;
            const price = Number(p.price_usd ?? 0) || 0;
            const isFree = price === 0;
            const cardSlug =
              slugKey || (nameKey.includes("life") ? "lifetime" : nameKey.includes("month") || nameKey.includes("pro") ? "monthly" : "free");
            const shownPrice = campaignPriceFor(cardSlug, price, nowTick);
            const promoOn = promoActive && shownPrice < price;
            const isCurrent = cardSlug === currentPlan;
            const highlight = meta.highlight;
            const clickQuota = p.click_quota == null ? null : Number(p.click_quota);
            const linkLimit = p.link_limit == null ? null : Number(p.link_limit);
            const formatClicks = (n: number) =>
              n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
              : n >= 1_000 ? `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`
              : n.toLocaleString();

            return (
              <div
                key={p.id}
                id={`plan-card-${cardSlug}`}
                className={`relative rounded-3xl p-7 sm:p-8 backdrop-blur-xl transition-all hover:-translate-y-1 ${
                  highlight
                    ? "bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] text-white border border-white/30 shadow-[0_30px_80px_-20px_rgba(255,126,95,0.55)] lg:scale-[1.04] lg:my-[-8px]"
                    : "bg-white/70 border border-white/80 shadow-[0_20px_60px_-30px_rgba(255,126,95,0.3)]"
                } ${isCurrent ? "ring-2 ring-[#22C55E] ring-offset-2 ring-offset-[#FFF9F5]" : ""}`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 right-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest shadow-md bg-[#22C55E] text-white">
                    <Check className="w-3 h-3" /> Current plan{daysLeft != null && !isLifetimePlan ? ` · ${daysLeft}d left` : ""}
                  </div>
                )}

                {meta.badge && !isCurrent && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest shadow-md ${
                    highlight ? "bg-white text-[#FF7E5F]" : "bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white"
                  }`}>
                    {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
                    {meta.badge}
                  </div>
                )}

                {/* Plan head */}
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                    highlight ? "bg-white/20 backdrop-blur" : "bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] shadow-[0_6px_20px_-6px_rgba(255,126,95,0.6)]"
                  }`}>
                    <Icon className={`w-5 h-5 ${highlight ? "text-white" : "text-white"}`} />
                  </div>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${highlight ? "text-white/80" : "text-[#7A5C45]"}`}>
                      {meta.tagline}
                    </div>
                    <h3 className={`text-2xl font-extrabold ${highlight ? "text-white" : "text-[#2D1B0D]"}`}>{p.name}</h3>
                  </div>
                </div>

                <p className={`mt-3 text-sm ${highlight ? "text-white/85" : "text-[#7A5C45]"}`}>{meta.blurb}</p>

                {/* Price */}
                <div className="mt-6 flex items-baseline gap-2 flex-wrap">
                  {promoOn && (
                    <span className={`text-3xl font-extrabold line-through ${highlight ? "text-white/50" : "text-[#C7B2A0]"}`}>
                      ${price.toFixed(0)}
                    </span>
                  )}
                  <span className={`text-6xl font-extrabold tracking-tight ${highlight ? "text-white" : "bg-clip-text text-transparent bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B]"}`}>
                    ${shownPrice.toFixed(shownPrice % 1 === 0 ? 0 : 2)}
                  </span>
                  <span className={`text-sm font-medium ${highlight ? "text-white/80" : "text-[#7A5C45]"}`}>
                    {slugKey === "lifetime" || nameKey.includes("life")
                      ? "/ lifetime"
                      : slugKey === "monthly" || nameKey.includes("month")
                        ? "/ month"
                        : isFree ? "/ forever" : ""}
                  </span>
                  {promoOn && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#22C55E] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-sm">
                      <PartyPopper className="w-3 h-3" /> -{campaignDiscountPct()}% · 1M users
                    </span>
                  )}
                </div>
                {promoOn && (
                  <p className={`mt-1 text-[11px] font-bold ${highlight ? "text-white/85" : "text-[#FF7E5F]"}`}>
                    Celebration price ends in {promoLeftLabel} — then back to ${price.toFixed(0)}
                  </p>
                )}
                {!isFree && shownPrice > 0 && (
                  <p className={`mt-1 text-[11px] font-medium ${highlight ? "text-white/70" : "text-[#A8907A]"}`}>
                    + 2% network fee → pay <strong>${(shownPrice * 1.02).toFixed(2)}</strong> in crypto · invoice expires in 30 min
                  </p>
                )}

                {/* Quotas highlight strip */}
                <div className={`mt-6 grid grid-cols-2 gap-3 rounded-2xl p-4 ${
                  highlight ? "bg-white/15 backdrop-blur" : "bg-[#FFEDD5]/60"
                }`}>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${highlight ? "text-white/70" : "text-[#7A5C45]"}`}>Smart links</div>
                    <div className={`mt-1 text-xl font-extrabold flex items-center gap-1 ${highlight ? "text-white" : "text-[#2D1B0D]"}`}>
                      {linkLimit === null ? <><InfinityIcon className="w-5 h-5" /> Unlimited</> : linkLimit.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${highlight ? "text-white/70" : "text-[#7A5C45]"}`}>Clicks / month</div>
                    <div className={`mt-1 text-xl font-extrabold flex items-center gap-1 ${highlight ? "text-white" : "text-[#2D1B0D]"}`}>
                      {clickQuota === null ? <><InfinityIcon className="w-5 h-5" /> Unlimited</> : formatClicks(clickQuota)}
                    </div>
                    {clickQuota !== null && clickQuota >= 1000 && (
                      <div className={`text-[10px] mt-0.5 ${highlight ? "text-white/70" : "text-[#A8907A]"}`}>
                        ({clickQuota.toLocaleString()} clicks)
                      </div>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="mt-6 space-y-2.5">
                  {meta.features.map((f, i) => {
                    const FIcon = f.icon;
                    return (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                          highlight ? "bg-white/20" : "bg-[#FFEDD5]"
                        }`}>
                          <FIcon className={`w-3 h-3 ${highlight ? "text-white" : "text-[#FF7E5F]"}`} />
                        </div>
                        <span className={highlight ? "text-white/95" : "text-[#4A3728]"}>{f.text}</span>
                      </li>
                    );
                  })}
                </ul>




                {/* CTA */}
                {(() => {
                  const locked = isCurrent && !isFree && planStillActive;
                  const disabled = isFree || (isCurrent && !locked) || buyMut.isPending;
                  return (
                    <button
                      disabled={disabled}
                      onClick={() => (locked ? setLockedOpen(true) : buyMut.mutate(p.slug))}
                      className={`mt-7 w-full rounded-2xl py-3.5 text-sm font-bold transition-all ${
                        locked
                          ? "bg-[#2D1B0D] text-white hover:bg-[#4A3728] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)]"
                          : isCurrent
                            ? "bg-[#22C55E] text-white cursor-not-allowed"
                            : isFree
                              ? highlight ? "bg-white/20 text-white/70 cursor-not-allowed" : "bg-[#FFEDD5] text-[#A8907A] cursor-not-allowed"
                              : highlight
                                ? "bg-white text-[#FF7E5F] hover:bg-white/95 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)]"
                                : "bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white hover:opacity-95 shadow-[0_10px_30px_-10px_rgba(255,126,95,0.5)]"
                      }`}
                    >
                      {buyMut.isPending && buyMut.variables === p.slug
                        ? "Creating invoice…"
                        : locked
                          ? `🔒 Active${daysLeft != null ? ` · ${daysLeft}d left` : ""}`
                          : isCurrent
                            ? "✓ Your current plan"
                            : meta.ctaLabel}
                    </button>
                  );
                })()}


              </div>
            );
          })}
        </section>

        {/* Why Sleepox / system features */}
        <section className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-xl border border-white/80 text-[#FF7E5F] text-[10px] font-bold uppercase tracking-widest shadow-sm">
              <Cpu className="w-3 h-3" /> What you get on every plan
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#2D1B0D]">
              Every system. Every plan.
            </h2>
            <p className="text-[#7A5C45]">
              The infrastructure runs the same for everyone — paid plans just unlock more capacity.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group relative rounded-2xl border border-white/80 bg-white/60 backdrop-blur-xl p-6 shadow-[0_10px_40px_-20px_rgba(255,126,95,0.25)] hover:-translate-y-1 hover:shadow-[0_20px_60px_-20px_rgba(255,126,95,0.4)] transition-all">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center shadow-[0_6px_20px_-6px_rgba(255,126,95,0.6)]">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-[#2D1B0D]">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-[#7A5C45] leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Smart pick banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2D1B0D] via-[#4A2818] to-[#2D1B0D] text-white p-8 sm:p-12 shadow-[0_30px_80px_-20px_rgba(45,27,13,0.5)]">
          <div className="absolute top-[-30%] right-[-10%] w-[60%] h-[120%] bg-[#FF7E5F]/30 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-30%] left-[-10%] w-[40%] h-[100%] bg-[#FEB47B]/20 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-[#FEB47B] text-[10px] font-bold uppercase tracking-widest">
                <Crown className="w-3 h-3" /> Smart Pick
              </div>
              <h3 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
                Lifetime pays for itself in <span className="text-[#FEB47B]">10 months</span>.
              </h3>
              <p className="mt-3 text-white/70 max-w-xl">
                Unlimited links, unlimited clicks, priority support & every future feature — for one flat payment.
              </p>
            </div>
            <button
              onClick={() => buyMut.mutate("lifetime")}
              disabled={buyMut.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white px-7 py-4 font-bold shadow-[0_15px_40px_-10px_rgba(255,126,95,0.6)] hover:opacity-95"
            >
              <Crown className="w-4 h-4" /> Get Lifetime
            </button>
          </div>
        </section>

        {/* Orders */}
        {ordersList && ordersList.length > 0 && (
          <section className="rounded-3xl border border-white/80 bg-white/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(255,126,95,0.3)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center shadow-[0_6px_20px_-6px_rgba(255,126,95,0.6)]">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#2D1B0D] tracking-tight">Order history</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]">
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Package</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersList.map((o) => (
                    <tr key={o.id} className="border-t border-[#FFE4D0]/60">
                      <td className="px-3 py-3 text-[#7A5C45]">{new Date(o.created_at ?? "").toLocaleDateString()}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-[#FFEDD5] text-[#FF7E5F] text-xs font-semibold">{o.package_slug}</span>
                      </td>
                      <td className="px-3 py-3 font-semibold">${Number(o.amount).toFixed(2)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                          o.status === "completed" || o.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                          o.status === "pending" ? "bg-amber-100 text-amber-700" :
                          "bg-rose-100 text-rose-700"
                        }`}>
                          {(o.status === "completed" || o.status === "paid") && <Check className="w-3 h-3" />}
                          {o.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {o.plisio_invoice_url && o.status === "pending"
                          ? <a href={o.plisio_invoice_url} target="_blank" rel="noreferrer" className="text-[#FF7E5F] font-semibold hover:underline">Open</a>
                          : <span className="text-[#A8907A]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Admin Payment Logs */}
        {isAdmin && allOrders && allOrders.length > 0 && (
          <section className="rounded-3xl border border-[#FF7E5F]/30 bg-white/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(255,126,95,0.3)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2D1B0D] to-[#4A3728] flex items-center justify-center shadow-lg">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#2D1B0D] tracking-tight">Payment Logs (Admin)</h2>
                  <p className="text-xs text-[#7A5C45]">Monitoring all user upgrade attempts and statuses.</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]">
                    <th className="px-3 py-3">When</th>
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Package</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allOrders.slice(0, 50).map((o) => (
                    <tr key={o.id} className="border-t border-[#FFE4D0]/60 hover:bg-[#FF7E5F]/5 transition-colors">
                      <td className="px-3 py-3 text-[#7A5C45] whitespace-nowrap">{new Date(o.created_at ?? "").toLocaleString()}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-[#2D1B0D]">{o.email || "—"}</div>
                        <div className="text-[10px] text-[#A8907A] font-mono">{o.user_id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-[#FFEDD5] text-[#FF7E5F] text-[10px] font-extrabold uppercase">{o.package_slug}</span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-[#2D1B0D]">${Number(o.amount).toFixed(2)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          o.status === "completed" || o.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                          o.status === "pending" ? "bg-amber-100 text-amber-700" :
                          o.status === "expired" ? "bg-slate-100 text-slate-500" :
                          "bg-rose-100 text-rose-700"
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {o.plisio_invoice_url && (
                          <a href={o.plisio_invoice_url} target="_blank" rel="noreferrer" className="text-[#FF7E5F] text-xs font-bold hover:underline">Invoice</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Same-plan lock popup */}
      {lockedOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D1B0D]/60 backdrop-blur-sm"
          onClick={() => setLockedOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-3xl bg-[#FFF9F5] border border-white/80 shadow-[0_40px_100px_-30px_rgba(45,27,13,0.6)] p-8 text-center"
          >
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center shadow-[0_10px_30px_-10px_rgba(255,126,95,0.6)]">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <h3 className="mt-5 text-2xl font-extrabold text-[#2D1B0D]">Plan already active</h3>
            <p className="mt-3 text-[#7A5C45] leading-relaxed">
              Your current plan is still running
              {daysLeft != null ? <> — <strong>{daysLeft} day{daysLeft === 1 ? "" : "s"} left</strong></> : null}.
              The same package can be purchased again only after it expires.
            </p>
            <div className="mt-6 grid gap-3 text-left">
              <div className="rounded-2xl border border-white/80 bg-white/70 p-4">
                <div className="flex items-center gap-2 text-[#2D1B0D] font-bold"><Crown className="w-4 h-4 text-[#FF7E5F]" /> Recommended · Upgrade to Lifetime</div>
                <p className="mt-1 text-sm text-[#7A5C45]">Unlimited links & clicks, one flat payment, no expiry — works instantly on this account.</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/70 p-4">
                <div className="flex items-center gap-2 text-[#2D1B0D] font-bold"><Layers className="w-4 h-4 text-[#FF7E5F]" /> Need more capacity now?</div>
                <p className="mt-1 text-sm text-[#7A5C45]">Create a new account and buy the monthly package there, or wait until this plan expires.</p>
              </div>
            </div>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => { setLockedOpen(false); buyMut.mutate("lifetime"); }}
                disabled={isLifetimePlan || buyMut.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white py-3.5 font-bold shadow-[0_15px_40px_-10px_rgba(255,126,95,0.6)] hover:opacity-95 disabled:opacity-60"
              >
                <Crown className="w-4 h-4" /> Upgrade to Lifetime
              </button>
              <button
                onClick={() => setLockedOpen(false)}
                className="flex-1 rounded-2xl border border-[#E8D5C4] bg-white/70 py-3.5 font-bold text-[#4A3728] hover:bg-white"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
