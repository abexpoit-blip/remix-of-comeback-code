import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/wordmark";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Sleepox" },
      { name: "description", content: "Free forever with 1M clicks, $10 monthly Pro with 10M clicks, or $50 lifetime unlimited. Pay with crypto." },
    ],
  }),
  component: PricingPage,
});

// Per-package feature descriptions so people understand exactly what they get.
const PLAN_META: Record<
  string,
  { blurb: string; features: string[]; highlight?: boolean; badge?: string }
> = {
  free: {
    blurb: "Best for testing the platform and personal links.",
    features: [
      "Edge-fast redirects (30ms)",
      "Real-time analytics",
      "Traffic quality filter",
      "Email support",
    ],
  },
  monthly: {
    blurb: "Recommended for growing campaigns and active marketers.",
    features: [
      "Everything in Free",
      "Geo + device routing",
      "Priority redirect lane",
      "Link health score",
      "10,000,000 clicks / month",
      "50 smart links",
    ],
    highlight: true,
    badge: "⭐ RECOMMENDED",
  },
  lifetime: {
    blurb: "Best long-term value. Pay once, use forever.",
    features: [
      "Everything in Pro",
      "Unlimited clicks",
      "Unlimited links",
      "No recurring fees",
      "Priority support",
      "Early access to new features",
    ],
    badge: "💎 BEST VALUE",
  },
};

function PricingPage() {
  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-mesh text-foreground">
      <header className="border-b border-border/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" aria-label="Sleepox home">
            <Wordmark size="md" />
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/login" className="hover:underline">Login</Link>
            <Link to="/signup" className="rounded-md bg-sky-gradient px-3 py-1.5 text-primary-foreground hover:opacity-90">Sign up</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">Pick the plan that fits.</h1>
          <p className="mt-3 text-muted-foreground">Pay with crypto. Upgrade, downgrade, or cancel anytime.</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {packages?.map((p) => {
            const meta = PLAN_META[p.slug] ?? { blurb: "", features: [] };
            return (
              <div
                key={p.id}
                className={`relative rounded-2xl p-8 ${meta.highlight ? "glass-panel sky-glow border border-sky scale-[1.02]" : "glass-card"}`}
              >
                {meta.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-gradient px-3 py-1 text-xs font-bold text-primary-foreground whitespace-nowrap">
                    {meta.badge}
                  </div>
                )}
                <h3 className="text-xl font-bold">{p.name}</h3>
                {meta.blurb && <p className="mt-1 text-xs text-muted-foreground">{meta.blurb}</p>}

                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-gradient-sky">
                    ${Number(p.price_usd).toFixed(0)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {p.slug === "lifetime" ? "/ lifetime" : p.slug === "monthly" ? "/ month" : "/ forever"}
                  </span>
                </div>

                <div className="mt-6 space-y-1 text-sm">
                  <div className="font-medium">
                    {p.click_quota ? `${p.click_quota.toLocaleString()} clicks / mo` : "Unlimited clicks"}
                  </div>
                  <div className="text-muted-foreground">
                    {p.link_limit === null ? "Unlimited links" : `${p.link_limit} link${p.link_limit > 1 ? "s" : ""}`}
                  </div>
                </div>

                <ul className="mt-6 space-y-2 text-sm">
                  {meta.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 text-success">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/signup"
                  className={`mt-8 block rounded-xl py-3 text-center text-sm font-semibold ${
                    meta.highlight
                      ? "bg-sky-gradient text-primary-foreground sky-glow"
                      : "border border-sky hover:bg-secondary"
                  }`}
                >
                  Get {p.name}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          💡 Smart pick: <span className="font-semibold text-foreground">Lifetime Unlimited</span> pays for itself in 10 months vs Monthly Pro.
        </p>
      </main>
    </div>
  );
}
