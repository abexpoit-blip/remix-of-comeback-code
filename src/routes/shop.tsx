import { createFileRoute } from "@tanstack/react-router";
import { BreezyLayout, TrustBar } from "@/components/breezy/BreezyLayout";
import { ProductCard } from "@/components/breezy/ProductCard";
import { PRODUCTS } from "@/lib/breezy-data";
import { buildOg } from "@/lib/og-meta";
import { brandForOrigin } from "@/lib/brand-registry";
import { getRequestOrigin } from "@/lib/request-origin.functions";

export const Route = createFileRoute("/shop")({
  loader: async () => await getRequestOrigin(),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "https://breezysocial.com";
    const brand = brandForOrigin(origin);
    const { meta, links } = buildOg({
      origin,
      path: "/shop",
      title: `Shop — ${brand.name} Smart Gadgets`,
      description: `Browse the full ${brand.name} collection: sleep, wellness, smart home, and travel gadgets. Free shipping over $50.`,
      type: "website",
    });
    return { meta, links };
  },
  component: ShopPage,
});


function ShopPage() {
  return (
    <BreezyLayout>
      <section className="bg-[#F2EDE3]">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3">
            The full collection
          </div>
          <h1 className="text-5xl md:text-6xl text-[#2A2A28] mb-4" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
            Shop all products
          </h1>
          <p className="text-[#5A554C] max-w-xl mx-auto">
            Eight thoughtfully designed gadgets — chosen for craftsmanship, lasting value, and real impact on daily life.
          </p>
        </div>
      </section>
      <TrustBar />
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRODUCTS.map((p) => <ProductCard key={p.slug} product={p} />)}
        </div>
      </section>
    </BreezyLayout>
  );
}
