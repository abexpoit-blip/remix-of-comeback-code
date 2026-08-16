import { Link } from "@tanstack/react-router";
import { BreezyLayout, TrustBar } from "@/components/breezy/BreezyLayout";
import { ProductCard } from "@/components/breezy/ProductCard";
import { PRODUCTS, ARTICLES } from "@/lib/breezy-data";
import { useSite } from "@/lib/site-identity";
import { BLOG_IMAGES } from "@/lib/breezy-content";

/**
 * BreezySocial gadget storefront homepage — served when host is breezysocial.com.
 * Hero → featured products (4) → trust bar → latest journal (3) → newsletter CTA → footer.
 * Editorial / wellness vibe (warm sand + sage), distinct from Sleepox orange SaaS look.
 */
export function BreezyHome() {
  const SITE = useSite();
  const featured = PRODUCTS.slice(0, 4);
  const latestArticles = ARTICLES.slice(0, 3);

  return (
    <BreezyLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F2EDE3] via-[#FAF7F2] to-[#E8E2D5]" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-[#7D9B76]/10 blur-3xl rounded-full" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-6">
              Est. {SITE.founded} · {SITE.city.split(",")[0]}
            </div>
            <h1
              className="text-5xl md:text-6xl lg:text-7xl text-[#2A2A28] leading-[1.05] mb-6"
              style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
            >
              Smart gadgets for{" "}
              <span className="italic text-[#5A7A55]">calm,</span> modern living.
            </h1>
            <p className="text-lg text-[#5A554C] leading-relaxed mb-8 max-w-md">
              Thoughtfully designed tools for better sleep, sharper focus, and easier travel — curated, tested, and shipped from California.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/shop"
                className="bg-[#2A2A28] text-[#FAF7F2] px-7 py-4 rounded-full text-sm font-semibold tracking-wide hover:bg-[#5A7A55] transition-colors"
              >
                Shop the collection
              </Link>
              <Link
                to="/blog"
                className="border border-[#2A2A28] text-[#2A2A28] px-7 py-4 rounded-full text-sm font-semibold hover:bg-[#2A2A28] hover:text-[#FAF7F2] transition-colors"
              >
                Read the journal
              </Link>
            </div>
            <div className="flex items-center gap-6 mt-10 text-xs text-[#7A7468]">
              <div className="flex items-center gap-2">
                <span className="text-[#E8A87C]">★★★★★</span>
                <span>4.8 / 5 from 10,000+ customers</span>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-3xl bg-gradient-to-br from-[#7D9B76]/20 to-[#E8A87C]/20 border border-[#E8E2D5] flex items-center justify-center text-[12rem]">
              🌿
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-5 border border-[#E8E2D5] max-w-[200px]">
              <div className="text-xs text-[#9A9488] mb-1">Bestseller</div>
              <div className="text-sm font-semibold text-[#2A2A28]">Aromatherapy Diffuser</div>
              <div className="text-sm text-[#5A7A55] font-semibold mt-1">$69</div>
            </div>
          </div>
        </div>
      </section>

      <TrustBar />

      {/* Featured Products */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-2">
              The Collection
            </div>
            <h2 className="text-3xl md:text-4xl text-[#2A2A28]" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
              Featured this week
            </h2>
          </div>
          <Link to="/shop" className="text-sm text-[#5A7A55] hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      {/* Latest Journal */}
      <section className="bg-[#F2EDE3]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-2">
                The Journal
              </div>
              <h2 className="text-3xl md:text-4xl text-[#2A2A28]" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
                Stories worth reading
              </h2>
            </div>
            <Link to="/blog" className="text-sm text-[#5A7A55] hover:underline">
              All articles →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {latestArticles.map((a) => {
              const img = BLOG_IMAGES[a.slug];
              return (
                <Link
                  key={a.slug}
                  to="/blog/$slug"
                  params={{ slug: a.slug }}
                  className="group block bg-white border border-[#E8E2D5] rounded-2xl overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="aspect-[16/10] bg-gradient-to-br from-[#FAF7F2] to-[#E8E2D5] overflow-hidden flex items-center justify-center">
                    {img ? (
                      <img src={img} alt={a.title} loading="lazy" width={1536} height={1024} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <span className="text-6xl">{a.emoji}</span>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="text-[10px] uppercase tracking-wider text-[#7D9B76] font-semibold mb-2">
                      {a.category} · {a.readTime} min read
                    </div>
                    <h3 className="text-xl text-[#2A2A28] mb-2 leading-snug group-hover:text-[#5A7A55] transition-colors" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
                      {a.title}
                    </h3>
                    <p className="text-sm text-[#7A7468] line-clamp-2">{a.excerpt}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3">
          Stay connected
        </div>
        <h2 className="text-3xl md:text-4xl text-[#2A2A28] mb-4" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
          Get 10% off your first order
        </h2>
        <p className="text-[#5A554C] mb-8">
          Subscribe for product launches, gift guides, and wellness tips. No spam — just the good stuff.
        </p>
        <form
          className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            placeholder="your@email.com"
            className="flex-1 px-5 py-3 rounded-full bg-white border border-[#E8E2D5] outline-none focus:border-[#5A7A55] text-sm"
          />
          <button
            type="submit"
            className="bg-[#2A2A28] text-[#FAF7F2] px-6 py-3 rounded-full text-sm font-semibold hover:bg-[#5A7A55] transition-colors"
          >
            Subscribe
          </button>
        </form>
      </section>
    </BreezyLayout>
  );
}
