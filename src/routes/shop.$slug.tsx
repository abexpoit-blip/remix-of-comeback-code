import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BreezyLayout, TrustBar } from "@/components/breezy/BreezyLayout";
import { ProductCard } from "@/components/breezy/ProductCard";
import { getProduct, PRODUCTS, SITE, type Product } from "@/lib/breezy-data";
import { PRODUCT_IMAGES } from "@/lib/breezy-content";
import { getReviews } from "@/lib/breezy-reviews";
import { useCart } from "@/lib/cart-context";
import { buildOg, absoluteUrl } from "@/lib/og-meta";
import { getRequestOrigin } from "@/lib/request-origin.functions";

export const Route = createFileRoute("/shop/$slug")({
  loader: async ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    const { origin } = await getRequestOrigin();
    return { product, origin };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.product;
    const origin = loaderData?.origin ?? "https://breezysocial.com";
    if (!p) return { meta: [{ title: "Product not found" }] };
    const imgPath = PRODUCT_IMAGES[p.slug];
    const imgUrl = imgPath ? absoluteUrl(origin, imgPath) : undefined;
    const { meta, links } = buildOg({
      origin,
      path: `/shop/${params.slug}`,
      title: `${p.name} — $${p.price} · ${SITE.name}`,
      description: p.shortDesc,
      image: imgUrl,
      imageAlt: `${p.name} — product photo`,
      type: "product",
      product: {
        price: p.price,
        currency: "USD",
        availability: p.inStock ? "in stock" : "out of stock",
        brand: SITE.name,
        condition: "new",
      },
    });
    return {
      meta,
      links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            description: p.longDesc,
            image: imgUrl,
            brand: { "@type": "Brand", name: SITE.name },
            sku: p.slug,
            offers: {
              "@type": "Offer",
              price: p.price,
              priceCurrency: "USD",
              availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url: absoluteUrl(origin, `/shop/${params.slug}`),
              itemCondition: "https://schema.org/NewCondition",
            },
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: p.rating,
              reviewCount: p.reviews,
            },
          }),
        },
      ],
    };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <BreezyLayout>
      <div className="max-w-2xl mx-auto px-6 py-32 text-center">
        <h1 className="text-3xl mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>Product not found</h1>
        <Link to="/shop" className="text-[#5A7A55] hover:underline">← Back to shop</Link>
      </div>
    </BreezyLayout>
  ),
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const p = product as Product;
  const related: Product[] = PRODUCTS.filter((x) => x.slug !== p.slug && x.category === p.category).slice(0, 3);
  const fillerRelated: Product[] = related.length < 3 ? PRODUCTS.filter((x) => x.slug !== p.slug).slice(0, 3 - related.length) : [];
  const recommended: Product[] = [...related, ...fillerRelated].slice(0, 3);
  const reviews = getReviews(p.slug);
  const cart = useCart();
  const navigate = useNavigate();

  const handleAdd = (gotoCart = false) => {
    cart.add({ slug: p.slug, name: p.name, price: p.price, image: PRODUCT_IMAGES[p.slug] });
    if (gotoCart) {
      navigate({ to: "/cart" });
    } else {
      toast.success(`Added to cart — ${p.name}`, {
        action: { label: "View cart", onClick: () => navigate({ to: "/cart" }) },
      });
    }
  };

  return (
    <BreezyLayout>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <nav className="text-xs text-[#9A9488] mb-8">
          <Link to="/" className="hover:text-[#5A7A55]">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/shop" className="hover:text-[#5A7A55]">Shop</Link>
          <span className="mx-2">/</span>
          <span className="text-[#5A554C]">{p.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-12">
          <div className="aspect-square rounded-3xl bg-gradient-to-br from-[#F2EDE3] to-[#E8E2D5] overflow-hidden border border-[#E8E2D5] flex items-center justify-center">
            {PRODUCT_IMAGES[p.slug] ? (
              <img
                src={PRODUCT_IMAGES[p.slug]}
                alt={p.name}
                width={1024}
                height={1024}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[14rem]">{p.emoji}</span>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-[#7D9B76] font-semibold mb-2">{p.category}</div>
            <h1 className="text-4xl md:text-5xl text-[#2A2A28] mb-4" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
              {p.name}
            </h1>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[#E8A87C]">★★★★★</span>
              <span className="text-sm text-[#7A7468]">{p.rating} ({p.reviews.toLocaleString()} reviews)</span>
            </div>
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-4xl font-semibold text-[#2A2A28]">${p.price}</span>
              {p.originalPrice && (
                <>
                  <span className="text-xl text-[#9A9488] line-through">${p.originalPrice}</span>
                  <span className="text-sm text-[#5A7A55] font-semibold">
                    Save ${p.originalPrice - p.price}
                  </span>
                </>
              )}
            </div>
            <p className="text-[#5A554C] leading-relaxed mb-8">{p.longDesc}</p>

            <div className="flex gap-3 mb-4">
              <button
                type="button"
                className="flex-1 bg-[#2A2A28] text-[#FAF7F2] py-4 rounded-full text-sm font-semibold tracking-wide hover:bg-[#5A7A55] transition-colors"
                onClick={() => handleAdd(false)}
              >
                Add to cart — ${p.price}
              </button>
              <button
                type="button"
                className="px-5 py-4 rounded-full border border-[#E8E2D5] hover:bg-[#F2EDE3] transition-colors"
                aria-label="Save to wishlist"
              >
                ♡
              </button>
            </div>
            <button
              type="button"
              className="w-full mb-8 border border-[#2A2A28] text-[#2A2A28] py-3.5 rounded-full text-sm font-semibold tracking-wide hover:bg-[#2A2A28] hover:text-[#FAF7F2] transition-colors"
              onClick={() => handleAdd(true)}
            >
              Buy it now
            </button>

            <div className="border-t border-[#E8E2D5] pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5A554C] mb-3">
                Key features
              </h3>
              <ul className="space-y-2">
                {p.features.map((f: string) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#5A554C]">
                    <span className="text-[#5A7A55] mt-1">✓</span> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <section className="mt-20 border-t border-[#E8E2D5] pt-12">
          <h2 className="text-2xl mb-6" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
            Specifications
          </h2>
          <dl className="grid sm:grid-cols-2 gap-x-12 gap-y-4">
            {Object.entries(p.specs).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-[#E8E2D5] pb-3">
                <dt className="text-sm text-[#7A7468]">{k}</dt>
                <dd className="text-sm text-[#2A2A28] font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {reviews.length > 0 && (
          <section className="mt-20 border-t border-[#E8E2D5] pt-12">
            <div className="flex items-baseline justify-between mb-8 flex-wrap gap-3">
              <h2 className="text-2xl md:text-3xl" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
                Customer reviews
              </h2>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-[#E8A87C] text-lg">★★★★★</span>
                <span className="font-semibold text-[#2A2A28]">{p.rating}</span>
                <span className="text-[#7A7468]">based on {p.reviews.toLocaleString()} reviews</span>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {reviews.map((r, i) => (
                <article key={i} className="bg-white border border-[#E8E2D5] rounded-2xl p-6">
                  <header className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-[#2A2A28]">{r.author}</div>
                      <div className="text-xs text-[#9A9488] flex items-center gap-2">
                        {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {r.verified && (
                          <span className="text-[#5A7A55] flex items-center gap-1">
                            <span>✓</span> Verified purchase
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[#E8A87C] text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  </header>
                  <h3 className="font-semibold text-[#2A2A28] mb-2">{r.title}</h3>
                  <p className="text-sm text-[#5A554C] leading-relaxed">{r.body}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mt-20">
          <h2 className="text-2xl mb-6" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
            You may also like
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {recommended.map((r) => (r ? <ProductCard key={r.slug} product={r} /> : null))}
          </div>
        </section>
      </div>
      <TrustBar />
    </BreezyLayout>
  );
}
