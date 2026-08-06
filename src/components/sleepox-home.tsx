import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";

const FEATURES = [
  { title: "Branded Short Links", desc: "Turn long URLs into clean, memorable links you actually want to share." },
  { title: "Edge-Fast Redirects", desc: "Global edge network delivers every click in under 30ms — zero loss, zero lag." },
  { title: "Geo Routing", desc: "Send visitors to different destinations based on country. Match offers automatically." },
  { title: "Device Targeting", desc: "Route mobile, desktop, or tablet traffic separately. One link, infinite paths." },
  { title: "Real-Time Analytics", desc: "Live click counts, country breakdown, device split, referrer data. Pure numbers." },
  { title: "Link Health Score", desc: "0–100 score per link. Spot underperforming campaigns before they cost you." },
];

const PLANS = [
  { name: "Free", price: "$0", period: "forever", features: ["1,000,000 clicks / month", "1 active link", "Real-time analytics"], cta: "Start free" },
  { name: "Monthly Pro", price: "$10", period: "per month", features: ["10,000,000 clicks / month", "50 active links", "Geo + device routing", "Link health score"], cta: "Go Pro", highlight: true },
  { name: "Lifetime Unlimited", price: "$50", period: "one-time", features: ["Unlimited clicks", "Unlimited links", "Lifetime access", "Priority support"], cta: "Get lifetime" },
];

export function SleepoxHome() {
  return (
    <div
      className="min-h-screen bg-[#FFF9F5] text-[#4A3728] relative overflow-hidden"
      style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}
    >
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#FF7E5F]/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[10%] right-[5%] w-[40%] h-[40%] bg-[#FEB47B]/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-[#FFEDD5]/40 blur-[80px] rounded-full pointer-events-none" />

      <nav className="sticky top-6 z-50 max-w-5xl mx-auto px-6 py-4">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/40 rounded-full px-6 sm:px-8 py-3 flex items-center justify-between shadow-xl shadow-orange-900/5">
          <Link to="/" aria-label="Sleepox home">
            <BrandLogo />
          </Link>
          <div className="hidden md:flex items-center gap-8 font-medium text-[#7D6452] text-sm">
            <a href="#features" className="hover:text-[#FF7E5F] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#FF7E5F] transition-colors">Pricing</a>
            <Link to="/login" className="hover:text-[#FF7E5F] transition-colors">Sign in</Link>
          </div>
          <Link to="/signup" className="bg-[#2D1B0D] text-white px-4 sm:px-5 py-2 rounded-full text-sm font-semibold hover:bg-[#FF7E5F] transition-all">
            Get Started
          </Link>
        </div>
      </nav>

      <section className="relative max-w-7xl mx-auto px-6 pt-20 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-10 bg-white/60 backdrop-blur-md border border-white/60 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF7E5F] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF7E5F]" />
          </span>
          <span className="text-[#FF7E5F] uppercase tracking-wider">v2.0 Analytics Live</span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-[#2D1B0D] mb-8 tracking-tight leading-[1.05]">
          Shorten the link,<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF7E5F] via-[#FEB47B] to-[#FF7E5F]" style={{ backgroundSize: "200% auto" }}>
            expand the reach.
          </span>
        </h1>
        <p className="text-lg md:text-xl text-[#7D6452] max-w-2xl mx-auto mb-12 leading-relaxed">
          The next-generation URL management platform. Branded short links, geo + device routing, and deep audience insights — under 30ms, anywhere on Earth.
        </p>

        <div className="max-w-2xl mx-auto relative group mb-6">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition" />
          <div className="relative flex flex-col sm:flex-row p-2 bg-white rounded-2xl shadow-xl shadow-orange-900/5 gap-2">
            <input type="text" placeholder="Paste your long URL here..." className="flex-1 px-5 py-4 outline-none text-base sm:text-lg text-[#2D1B0D] placeholder-[#A38D7D] bg-transparent" />
            <Link to="/signup" className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white px-7 py-4 rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform whitespace-nowrap text-center">
              Create Link
            </Link>
          </div>
        </div>
        <div className="flex justify-center gap-6 text-sm font-medium text-[#A38D7D]">
          <span>✓ No credit card</span>
          <span>✓ 1M clicks free</span>
        </div>
      </section>

      <section className="relative max-w-4xl mx-auto px-6 mb-24">
        <div className="rounded-[2rem] shadow-xl bg-[#2D1B0D]/5 backdrop-blur-xl border border-white/40 py-10 px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { v: "30ms", l: "Edge Redirect" },
            { v: "99.9%", l: "Uptime SLA" },
            { v: "5M+", l: "Clicks / day" },
            { v: "Instant", l: "Activation" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-3xl font-bold text-[#2D1B0D]">{s.v}</div>
              <div className="text-[10px] uppercase tracking-widest text-[#FF7E5F] font-bold mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="relative max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#2D1B0D] mb-4 tracking-tight">Everything your links need.</h2>
          <p className="text-lg text-[#7D6452]">A complete toolkit for short links, routing rules, and analytics.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="relative overflow-hidden rounded-[2rem] shadow-xl shadow-orange-900/5 hover:-translate-y-2 transition-transform duration-500 group">
              <div className="bg-white/50 backdrop-blur-2xl border border-white/60 p-8 h-full">
                <div className="w-12 h-12 bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-orange-500/20 text-white font-bold group-hover:scale-110 transition-transform">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-lg font-bold text-[#2D1B0D] mb-2">{f.title}</h3>
                <p className="text-sm text-[#7D6452] leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="relative max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#2D1B0D] mb-4 tracking-tight">Simple pricing.</h2>
          <p className="text-lg text-[#7D6452]">Pay with crypto via Plisio. Upgrade or stay free forever.</p>
        </div>
        <div className="grid gap-8 lg:grid-cols-3 items-stretch">
          {PLANS.map((p) => (
            <div key={p.name} className={p.highlight ? "relative bg-white p-10 rounded-[2.5rem] border-4 border-[#FF7E5F] shadow-2xl shadow-orange-900/10 flex flex-col lg:scale-105" : "relative bg-white/70 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/60 shadow-lg shadow-orange-900/5 flex flex-col"}>
              {p.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#FF7E5F] text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                  Recommended
                </div>
              )}
              <h3 className={`text-sm font-bold uppercase tracking-widest mb-2 ${p.highlight ? "text-[#FF7E5F]" : "text-[#7D6452]"}`}>{p.name}</h3>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-5xl font-extrabold text-[#2D1B0D]">{p.price}</span>
                <span className="text-[#A38D7D]">/ {p.period}</span>
              </div>
              <ul className="space-y-3 mb-10 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-[#4A3728]">
                    <span className="text-[#FF7E5F] font-bold">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link to="/signup" className={p.highlight ? "w-full py-4 rounded-2xl bg-[#FF7E5F] text-white font-bold text-center shadow-lg shadow-orange-500/30 hover:bg-[#E66D50] transition-colors" : "w-full py-4 rounded-2xl border-2 border-[#FFEDD5] text-[#2D1B0D] font-bold text-center hover:bg-[#FFF9F5] transition-colors"}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="relative max-w-5xl mx-auto px-6 pb-24">
        <div className="relative bg-[#2D1B0D] rounded-[3rem] p-12 sm:p-16 overflow-hidden shadow-2xl shadow-orange-900/20 text-center">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#FF7E5F]/40 to-transparent blur-3xl" />
          <div className="relative z-10 flex flex-col items-center">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Ready to ship smarter links?</h2>
            <p className="text-orange-100/60 text-lg mb-10 max-w-xl">Free plan, no credit card. Be live in under a minute.</p>
            <Link to="/signup" className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white px-10 py-5 rounded-2xl font-bold text-lg shadow-xl hover:scale-105 transition-transform">
              Create free account
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative max-w-7xl mx-auto px-6 py-12 text-center text-[#A38D7D] text-xs font-medium tracking-widest uppercase">
        © {new Date().getFullYear()} Sleepox · Smart links &amp; analytics
      </footer>
    </div>
  );
}
