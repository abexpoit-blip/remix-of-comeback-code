import { createFileRoute } from "@tanstack/react-router";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";
import { siteFor, useSite } from "@/lib/site-identity";
import { getRequestOrigin } from "@/lib/request-origin.functions";

export const Route = createFileRoute("/returns")({
  loader: async () => await getRequestOrigin(),
  head: ({ loaderData }: { loaderData?: { origin: string } }) => {
    const SITE = siteFor(loaderData?.origin ?? "https://breezysocial.com");
    return {
    meta: [
      { title: `Returns & Refunds — ${SITE.name}` },
      { name: "description", content: `30-day no-questions returns on every ${SITE.name} product. Here's how it works.` },
      { property: "og:title", content: `Returns & Refunds — ${SITE.name}` },
      { property: "og:url", content: "/returns" },
    ],
    links: [{ rel: "canonical", href: "/returns" }],
    };
  },
  component: ReturnsPage,
});

function ReturnsPage() {
  const SITE = useSite();
  return (
    <BreezyLayout>
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-lg text-[#3A3A38]">
        <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3 not-prose">
          Customer Care
        </div>
        <h1 className="text-5xl text-[#2A2A28] mb-8 not-prose" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
          Returns & Refunds
        </h1>

        <p>We stand behind every product we make. If you're not completely happy with your purchase, return it within <strong>30 days</strong> of delivery for a full refund — no questions asked.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">How to start a return</h2>
        <ol>
          <li>Email <a href={`mailto:${SITE.supportEmail}`} className="text-[#5A7A55]">{SITE.supportEmail}</a> with your order number and the item(s) you'd like to return.</li>
          <li>We'll reply within 24 hours (business days) with a prepaid return shipping label.</li>
          <li>Pack the item in its original packaging if possible — but lightly used is fine, we just need it intact.</li>
          <li>Drop it at any USPS location.</li>
          <li>Once we receive your return (5–10 business days), we issue your refund within 3 business days.</li>
        </ol>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Refund timing</h2>
        <p>Refunds go back to your original payment method. Credit card refunds typically post in 3–10 business days depending on your bank. We'll send an email confirmation the moment the refund leaves our end.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Exchanges</h2>
        <p>Want a different size, color, or product? Just include a note with your return or mention it in your initial email. We'll ship the replacement as soon as we receive your original item.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Damaged or defective items</h2>
        <p>If your product arrived damaged or stops working within its warranty period (12–24 months depending on the product), we'll send a free replacement immediately. Email us a photo and your order number — no need to return the damaged item first.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Exceptions</h2>
        <p>For hygiene reasons, used aromatherapy oils or replacement fabric covers cannot be returned. Gift cards and final-sale clearance items are also non-returnable.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">International returns</h2>
        <p>International customers are responsible for return shipping. Once we receive your return, the standard 3-business-day refund window applies. Original international shipping costs are non-refundable.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Questions?</h2>
        <p>Real humans, real answers — email <a href={`mailto:${SITE.supportEmail}`} className="text-[#5A7A55]">{SITE.supportEmail}</a> any time.</p>
      </article>
    </BreezyLayout>
  );
}
