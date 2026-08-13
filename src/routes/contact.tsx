import { createFileRoute } from "@tanstack/react-router";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";
import { SITE } from "@/lib/breezy-data";
import { buildOg } from "@/lib/og-meta";
import { brandForOrigin } from "@/lib/brand-registry";
import { getRequestOrigin } from "@/lib/request-origin.functions";

export const Route = createFileRoute("/contact")({
  loader: async () => await getRequestOrigin(),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "https://breezysocial.com";
    const brand = brandForOrigin(origin);
    const { meta, links } = buildOg({
      origin,
      path: "/contact",
      title: `Contact — ${SITE.name}`,
      description: `Reach the ${brand.name} team. Email ${brand.email} or use our contact form. We respond within 24 hours, Mon–Fri.`,
      type: "website",
    });
    return { meta, links };
  },
  component: ContactPage,
});



function ContactPage() {
  return (
    <BreezyLayout>
      <section className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3">Get in touch</div>
          <h1 className="text-5xl text-[#2A2A28] mb-6" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
            We'd love to hear from you.
          </h1>
          <p className="text-[#5A554C] mb-8 leading-relaxed">
            Whether it's a question about a product, a return, or just to say hi — our small team reads every message and responds within 24 hours on business days.
          </p>

          <div className="space-y-5 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#7D9B76] font-semibold mb-1">Email</div>
              <a href={`mailto:${SITE.email}`} className="text-[#2A2A28] hover:text-[#5A7A55]">{SITE.email}</a>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-[#7D9B76] font-semibold mb-1">Support</div>
              <a href={`mailto:${SITE.supportEmail}`} className="text-[#2A2A28] hover:text-[#5A7A55]">{SITE.supportEmail}</a>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-[#7D9B76] font-semibold mb-1">Phone</div>
              <span className="text-[#2A2A28]">{SITE.phone}</span>
              <div className="text-xs text-[#9A9488]">Mon–Fri, 9am–5pm PST</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-[#7D9B76] font-semibold mb-1">Studio</div>
              <span className="text-[#2A2A28]">{SITE.address}</span>
            </div>
          </div>
        </div>

        <form
          className="bg-white border border-[#E8E2D5] rounded-2xl p-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget as HTMLFormElement);
            const body = `Name: ${data.get("name")}\n\n${data.get("message")}`;
            window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent("Contact form: " + data.get("name"))}&body=${encodeURIComponent(body)}`;
          }}
        >
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#5A554C] font-semibold mb-2">Name</label>
            <input name="name" required className="w-full px-4 py-3 rounded-lg border border-[#E8E2D5] outline-none focus:border-[#5A7A55] text-sm" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#5A554C] font-semibold mb-2">Email</label>
            <input type="email" name="email" required className="w-full px-4 py-3 rounded-lg border border-[#E8E2D5] outline-none focus:border-[#5A7A55] text-sm" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#5A554C] font-semibold mb-2">Message</label>
            <textarea name="message" required rows={5} className="w-full px-4 py-3 rounded-lg border border-[#E8E2D5] outline-none focus:border-[#5A7A55] text-sm" />
          </div>
          <button type="submit" className="w-full bg-[#2A2A28] text-[#FAF7F2] py-3 rounded-full text-sm font-semibold hover:bg-[#5A7A55] transition-colors">
            Send message
          </button>
        </form>
      </section>
    </BreezyLayout>
  );
}
