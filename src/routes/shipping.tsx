import { createFileRoute } from "@tanstack/react-router";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";
import { siteFor, useSite } from "@/lib/site-identity";
import { getRequestOrigin } from "@/lib/request-origin.functions";

export const Route = createFileRoute("/shipping")({
  loader: async () => await getRequestOrigin(),
  head: ({ loaderData }: { loaderData?: { origin: string } }) => {
    const SITE = siteFor(loaderData?.origin ?? "https://breezysocial.com");
    return {
    meta: [
      { title: `Shipping Policy — ${SITE.name}` },
      { name: "description", content: `Shipping rates, delivery times, and international info for ${SITE.name} orders. Free shipping over $50.` },
      { property: "og:title", content: `Shipping Policy — ${SITE.name}` },
      { property: "og:url", content: "/shipping" },
    ],
    links: [{ rel: "canonical", href: "/shipping" }],
    };
  },
  component: ShippingPage,
});

function ShippingPage() {
  const SITE = useSite();
  return (
    <BreezyLayout>
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-lg text-[#3A3A38]">
        <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3 not-prose">
          Customer Care
        </div>
        <h1 className="text-5xl text-[#2A2A28] mb-8 not-prose" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
          Shipping Policy
        </h1>

        <p>We ship from our warehouse near {SITE.city}, Monday through Friday (excluding US holidays). Orders placed before 1pm local time typically ship the same day.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">United States</h2>
        <ul>
          <li><strong>Standard (3–5 business days):</strong> $4.95 — <strong>FREE on orders over $50</strong></li>
          <li><strong>Express (2 business days):</strong> $14.95</li>
          <li><strong>Overnight (next business day):</strong> $29.95</li>
        </ul>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">International</h2>
        <p>We ship to Canada, the UK, EU member states, Australia, and New Zealand.</p>
        <ul>
          <li><strong>Canada:</strong> $12.95 (7–14 business days)</li>
          <li><strong>UK & EU:</strong> $18.95 (10–18 business days)</li>
          <li><strong>Australia & NZ:</strong> $24.95 (12–20 business days)</li>
        </ul>
        <p>International orders may be subject to customs duties or import taxes assessed by your local authorities. These charges are the responsibility of the customer.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Tracking</h2>
        <p>You'll receive a tracking number by email as soon as your order ships. Standard US orders ship via USPS; express and international via UPS or DHL.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Delays</h2>
        <p>Once a package is handed to the carrier, delivery timing is outside our control. We're not responsible for delays caused by weather, customs holds, or carrier issues, but we'll always help you track down a missing parcel.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Questions?</h2>
        <p>Email <a href={`mailto:${SITE.supportEmail}`} className="text-[#5A7A55]">{SITE.supportEmail}</a> with your order number and we'll get back to you within 24 hours on business days.</p>
      </article>
    </BreezyLayout>
  );
}
