import { createFileRoute } from "@tanstack/react-router";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";
import { buildOg } from "@/lib/og-meta";
import { getRequestOrigin } from "@/lib/request-origin.functions";

const FAQS: Array<{ category: string; q: string; a: string }> = [
  { category: "Orders & Shipping", q: "How long does shipping take?", a: "Domestic US orders ship within 1 business day and arrive in 3–5 business days via UPS Ground. International orders take 7–14 business days depending on your country's customs." },
  { category: "Orders & Shipping", q: "Do you offer free shipping?", a: "Yes — every order over $50 ships free worldwide. Orders under $50 have a flat $6.99 domestic shipping fee." },
  { category: "Orders & Shipping", q: "Can I track my order?", a: "Absolutely. Once your order ships, you'll receive an email with a tracking number and a link to follow your package in real time." },
  { category: "Orders & Shipping", q: "Do you ship internationally?", a: "Yes — we ship to over 60 countries. Import duties and taxes are the responsibility of the recipient." },
  { category: "Returns & Warranty", q: "What's your return policy?", a: "We offer 30-day no-questions-asked returns on unused items in original packaging. Used items can be returned within 14 days for a partial refund." },
  { category: "Returns & Warranty", q: "How do I start a return?", a: "Email support@breezysocial.com with your order number. We'll send a prepaid return label within 24 hours." },
  { category: "Returns & Warranty", q: "Are products covered by warranty?", a: "All electronics carry a 12-month limited warranty against manufacturing defects. The Blue-Light Glasses come with a lifetime scratch-replacement guarantee." },
  { category: "Returns & Warranty", q: "What if my item arrives damaged?", a: "We're sorry! Email a photo to support@breezysocial.com within 7 days of delivery and we'll send a free replacement immediately." },
  { category: "Products", q: "Are your products tested?", a: "Every item we sell is personally tested by our editorial team for at least 30 days before we put it on the site. If we wouldn't use it daily, we don't sell it." },
  { category: "Products", q: "Where are your products made?", a: "We work with small batch manufacturers in the US, Japan, Taiwan, and Portugal. Country of origin is listed on each product page." },
  { category: "Products", q: "Do you offer gift wrapping?", a: "Yes — add a gift note at checkout and we'll wrap your order in recycled kraft paper with a hand-written card. Free of charge." },
  { category: "Account & Payments", q: "What payment methods do you accept?", a: "Visa, Mastercard, American Express, Apple Pay, Google Pay, and Shop Pay. All transactions use 256-bit SSL encryption." },
  { category: "Account & Payments", q: "Is my payment information secure?", a: "Yes. We never store full card numbers on our servers. Payments are processed by PCI-DSS certified providers." },
  { category: "Account & Payments", q: "Can I change or cancel my order?", a: "Email us within 1 hour of placing your order and we'll do our best. After that, your order has likely already entered the warehouse for fulfillment." },
];

export const Route = createFileRoute("/faq")({
  loader: async () => await getRequestOrigin(),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "https://breezysocial.com";
    const { meta, links } = buildOg({
      origin,
      path: "/faq",
      title: "FAQ — BreezySocial Help Center",
      description: "Shipping times, returns, warranty coverage, product care, and account help — every common BreezySocial question answered in one place.",
      imageAlt: "BreezySocial FAQ and help center",
      type: "website",
    });
    return {
      meta,
      links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
      ],
    };
  },
  component: FaqPage,
});

function FaqPage() {
  const categories = Array.from(new Set(FAQS.map((f) => f.category)));
  return (
    <BreezyLayout>
      <section className="bg-[#F2EDE3]">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3">Help center</div>
          <h1
            className="text-5xl md:text-6xl text-[#2A2A28] mb-4"
            style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
          >
            Frequently asked questions
          </h1>
          <p className="text-[#5A554C]">Can't find what you need? <a href="mailto:support@breezysocial.com" className="text-[#5A7A55] underline">Email our team</a> — we usually reply within a few hours.</p>
        </div>
      </section>
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        {categories.map((cat) => (
          <section key={cat}>
            <h2
              className="text-2xl mb-6 text-[#2A2A28]"
              style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
            >
              {cat}
            </h2>
            <div className="divide-y divide-[#E8E2D5] border-t border-b border-[#E8E2D5]">
              {FAQS.filter((f) => f.category === cat).map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex items-center justify-between cursor-pointer list-none gap-4">
                    <span className="font-medium text-[#2A2A28]">{f.q}</span>
                    <span className="text-[#5A7A55] text-2xl leading-none transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[#5A554C] text-sm leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </BreezyLayout>
  );
}
