import { createFileRoute } from "@tanstack/react-router";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";
import { SITE } from "@/lib/breezy-data";
import { buildOg } from "@/lib/og-meta";
import { getRequestOrigin } from "@/lib/request-origin.functions";

export const Route = createFileRoute("/privacy")({
  loader: async () => await getRequestOrigin(),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "https://breezysocial.com";
    const { meta, links } = buildOg({
      origin,
      path: "/privacy",
      title: `Privacy Policy — ${SITE.name}`,
      description: `How ${SITE.name} collects, uses, and protects your personal information.`,
      type: "website",
    });
    return { meta, links };
  },
  component: PrivacyPage,
});



function PrivacyPage() {
  return (
    <BreezyLayout>
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-lg text-[#3A3A38]">
        <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3 not-prose">
          Legal · Last updated June 2026
        </div>
        <h1 className="text-5xl text-[#2A2A28] mb-8 not-prose" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
          Privacy Policy
        </h1>

        <p>{SITE.name} ("we," "our," or "us") respects your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website breezysocial.com.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Information we collect</h2>
        <p>We collect personal information you voluntarily provide when placing an order, creating an account, subscribing to our newsletter, or contacting us. This includes your name, email address, postal address, phone number, and payment information (processed via our PCI-compliant payment partner; we never store full card numbers).</p>
        <p>We also automatically collect certain information when you visit the site: IP address, browser type, operating system, pages viewed, and timestamps. We use cookies and similar tracking technologies to remember your preferences and improve your experience.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">How we use your information</h2>
        <ul>
          <li>To process and fulfill your orders</li>
          <li>To send order confirmations, shipping updates, and customer-service responses</li>
          <li>To send marketing emails (only if you opt in — unsubscribe at any time)</li>
          <li>To analyze site usage and improve our products and services</li>
          <li>To detect and prevent fraud or abuse</li>
          <li>To comply with legal obligations</li>
        </ul>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Sharing your information</h2>
        <p>We never sell your personal information. We share data only with trusted service providers (payment processors, shipping carriers, email platforms, analytics) under strict confidentiality agreements, and only when necessary to operate the business.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Your rights</h2>
        <p>Depending on where you live, you may have the right to: access the personal information we hold about you, request correction or deletion, opt out of marketing, and request a copy of your data. To exercise any of these rights, email <a href={`mailto:${SITE.email}`} className="text-[#5A7A55]">{SITE.email}</a>.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Security</h2>
        <p>We use industry-standard encryption (SSL/TLS) for all data transmission and follow best practices to safeguard the information we store. No system is 100% secure, but we work hard to protect your data.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Children's privacy</h2>
        <p>Our services are not directed to children under 13. We do not knowingly collect information from children under 13. If you believe we have, please contact us.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Changes to this policy</h2>
        <p>We may update this Privacy Policy from time to time. When we do, we'll revise the "Last updated" date at the top of this page.</p>

        <h2 className="text-2xl mt-10 text-[#2A2A28]">Contact</h2>
        <p>Questions? Email <a href={`mailto:${SITE.email}`} className="text-[#5A7A55]">{SITE.email}</a> or write to us at {SITE.address}.</p>
      </article>
    </BreezyLayout>
  );
}
