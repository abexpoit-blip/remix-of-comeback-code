import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSite } from "@/lib/site-identity";
import { useCart } from "@/lib/cart-context";
import logoUrl from "@/assets/breezy/logo.png";

/**
 * Shared header + footer for the BreezySocial gadget storefront.
 * Used on every breezysocial.com page (home, shop, blog, policies).
 */
export function BreezyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#FAF7F2] text-[#2A2A28]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <AnnouncementBar />
      <BreezyHeader />
      <main>{children}</main>
      <BreezyFooter />
    </div>
  );
}

function AnnouncementBar() {
  return (
    <div className="bg-[#2A2A28] text-[#F2EDE3] text-center text-xs py-2 px-4 tracking-wide">
      ✦ Free worldwide shipping on orders over $50 — limited time
    </div>
  );
}

export function BreezyHeader() {
  const SITE = useSite();
  const { count } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="border-b border-[#E8E2D5] bg-[#FAF7F2]/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src={logoUrl}
            alt={`${SITE.name} logo`}
            width={36}
            height={36}
            className="w-9 h-9 object-contain"
          />
          <span
            className="text-xl tracking-tight text-[#2A2A28] hidden sm:inline"
            style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
          >
            {SITE.name}
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-[#5A554C]">
          <Link to="/shop" className="hover:text-[#5A7A55] transition-colors">Shop</Link>
          <Link to="/blog" className="hover:text-[#5A7A55] transition-colors">Journal</Link>
          <Link to="/about" className="hover:text-[#5A7A55] transition-colors">About</Link>
          <Link to="/faq" className="hover:text-[#5A7A55] transition-colors">FAQ</Link>
          <Link to="/contact" className="hover:text-[#5A7A55] transition-colors">Contact</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/cart"
            aria-label="Shopping cart"
            className="relative w-10 h-10 rounded-full border border-[#E8E2D5] flex items-center justify-center hover:bg-[#F2EDE3] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {mounted && count > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#5A7A55] text-white text-[10px] font-semibold w-5 h-5 rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function BreezyFooter() {
  const SITE = useSite();
  const [email, setEmail] = useState("");
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    toast.success("Thanks! Check your inbox for a 10% welcome code.");
    setEmail("");
  };

  return (
    <footer className="border-t border-[#E8E2D5] bg-[#F2EDE3] mt-24">
      {/* Newsletter strip */}
      <div className="border-b border-[#E8E2D5]">
        <div className="max-w-4xl mx-auto px-6 py-14 text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3">
            The Breeze Letter
          </div>
          <h3
            className="text-3xl md:text-4xl text-[#2A2A28] mb-3"
            style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
          >
            Slow living, delivered Sundays.
          </h3>
          <p className="text-sm text-[#7A7468] mb-6 max-w-md mx-auto">
            One curated email a week — sleep science, wellness gear, and 10% off your first order.
          </p>
          <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 rounded-full border border-[#E8E2D5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5A7A55] focus:border-transparent"
            />
            <button
              type="submit"
              className="bg-[#2A2A28] text-[#FAF7F2] px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wide hover:bg-[#5A7A55] transition-colors"
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-5 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <img src={logoUrl} alt="" width={32} height={32} className="w-8 h-8 object-contain" />
            <span style={{ fontFamily: "'Instrument Serif', serif" }} className="text-lg">
              {SITE.name}
            </span>
          </div>
          <p className="text-sm text-[#7A7468] leading-relaxed max-w-xs">{SITE.tagline}</p>
          <p className="text-xs text-[#9A9488] mt-4">Est. {SITE.founded} · {SITE.city}</p>
          <div className="flex items-center gap-3 mt-6">
            <span className="text-xs text-[#9A9488]">We accept</span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#5A554C]">
              <span className="px-2 py-1 bg-white rounded border border-[#E8E2D5]">VISA</span>
              <span className="px-2 py-1 bg-white rounded border border-[#E8E2D5]">MC</span>
              <span className="px-2 py-1 bg-white rounded border border-[#E8E2D5]">AMEX</span>
              <span className="px-2 py-1 bg-white rounded border border-[#E8E2D5]">PAY</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wider text-[#5A554C] mb-4 font-semibold">Shop</h4>
          <ul className="space-y-2 text-sm text-[#7A7468]">
            <li><Link to="/shop" className="hover:text-[#5A7A55]">All products</Link></li>
            <li><Link to="/shop" className="hover:text-[#5A7A55]">Sleep & wellness</Link></li>
            <li><Link to="/shop" className="hover:text-[#5A7A55]">Smart home</Link></li>
            <li><Link to="/shop" className="hover:text-[#5A7A55]">Travel</Link></li>
            <li><Link to="/cart" className="hover:text-[#5A7A55]">Your cart</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wider text-[#5A554C] mb-4 font-semibold">Help</h4>
          <ul className="space-y-2 text-sm text-[#7A7468]">
            <li><Link to="/faq" className="hover:text-[#5A7A55]">FAQ</Link></li>
            <li><Link to="/size-guide" className="hover:text-[#5A7A55]">Size guide</Link></li>
            <li><Link to="/shipping" className="hover:text-[#5A7A55]">Shipping</Link></li>
            <li><Link to="/returns" className="hover:text-[#5A7A55]">Returns</Link></li>
            <li><Link to="/contact" className="hover:text-[#5A7A55]">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-wider text-[#5A554C] mb-4 font-semibold">Company</h4>
          <ul className="space-y-2 text-sm text-[#7A7468]">
            <li><Link to="/about" className="hover:text-[#5A7A55]">About us</Link></li>
            <li><Link to="/blog" className="hover:text-[#5A7A55]">Journal</Link></li>
            <li><Link to="/privacy" className="hover:text-[#5A7A55]">Privacy</Link></li>
            <li><Link to="/terms" className="hover:text-[#5A7A55]">Terms</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#E8E2D5]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row gap-2 items-center justify-between text-xs text-[#9A9488]">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <p>{SITE.address}</p>
        </div>
      </div>
    </footer>
  );
}

export function TrustBar() {
  const items = [
    { icon: "🚚", text: "Free shipping over $50" },
    { icon: "↩️", text: "30-day easy returns" },
    { icon: "🔒", text: "Secure SSL checkout" },
    { icon: "⭐", text: "10,000+ happy customers" },
  ];
  return (
    <div className="bg-[#5A7A55] text-[#F2EDE3]">
      <div className="max-w-6xl mx-auto px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs sm:text-sm text-center">
        {items.map((i) => (
          <div key={i.text} className="flex items-center justify-center gap-2">
            <span>{i.icon}</span>
            <span>{i.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
