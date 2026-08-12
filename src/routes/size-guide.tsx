import { createFileRoute } from "@tanstack/react-router";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";
import { buildOg } from "@/lib/og-meta";
import { getRequestOrigin } from "@/lib/request-origin.functions";

export const Route = createFileRoute("/size-guide")({
  loader: async () => await getRequestOrigin(),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "https://breezysocial.com";
    const { meta, links } = buildOg({
      origin,
      path: "/size-guide",
      title: "Size Guide — BreezySocial Wearables",
      description: "Find your perfect fit. Detailed sizing charts and measurement tips for BreezySocial headphones, blue-light glasses, posture corrector, and travel gear.",
      imageAlt: "BreezySocial wearable gear size guide",
      type: "website",
    });
    return { meta, links };
  },
  component: SizeGuidePage,
});

function SizeGuidePage() {
  return (
    <BreezyLayout>
      <section className="bg-[#F2EDE3]">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3">Fit & sizing</div>
          <h1
            className="text-5xl md:text-6xl text-[#2A2A28] mb-4"
            style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
          >
            Size guide
          </h1>
          <p className="text-[#5A554C] max-w-xl mx-auto">
            Our products are designed to fit most adult heads, wrists, and torsos — but here's the detail if you'd like to measure first.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-14">
        <Guide
          title="Smart Sleep Headphones — Headband"
          intro="Measure around the widest part of your head, just above the ears."
          rows={[
            ["Small", "20\" – 22\" / 51 – 56 cm"],
            ["Medium (Default)", "22\" – 24\" / 56 – 61 cm"],
            ["Large", "24\" – 26\" / 61 – 66 cm"],
          ]}
          tip="Headband uses a stretch fabric — most adults are happy with the default Medium. Pick Small only if you typically wear youth-sized hats."
        />

        <Guide
          title="Ergonomic Blue-Light Glasses"
          intro="Compare to a frame you already own."
          rows={[
            ["Frame width", "142 mm"],
            ["Lens width", "52 mm"],
            ["Lens height", "40 mm"],
            ["Bridge", "18 mm"],
            ["Temple length", "145 mm"],
          ]}
          tip="One unisex size designed to fit 95% of adult faces. Frames are flexible TR90 — they bend slightly to accommodate wider heads without losing shape."
        />

        <Guide
          title="Smart Posture Corrector"
          intro="Measure around the fullest part of your chest, under the armpits."
          rows={[
            ["XS", "28\" – 32\" / 71 – 81 cm"],
            ["S", "32\" – 36\" / 81 – 91 cm"],
            ["M (Default)", "36\" – 42\" / 91 – 107 cm"],
            ["L", "42\" – 48\" / 107 – 122 cm"],
            ["XL", "48\" – 54\" / 122 – 137 cm"],
          ]}
          tip="Choose snug — the strap should sit firmly without restricting breathing. Between sizes? Size down."
        />

        <Guide
          title="Travel Pillow — Noise Cancelling"
          intro="One size, designed for adult necks."
          rows={[
            ["Inner circumference", "12\" – 18\" / 30 – 46 cm"],
            ["Memory foam thickness", "1.6\" / 4 cm"],
            ["Outer length", "13\" / 33 cm"],
          ]}
          tip="The Velcro closure adjusts from kid-teen to large adult necks. Memory foam softens slightly with body heat over the first 10 minutes of wear."
        />

        <div className="bg-[#F2EDE3] rounded-2xl p-8 text-center">
          <h3
            className="text-2xl mb-3"
            style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
          >
            Still unsure?
          </h3>
          <p className="text-sm text-[#5A554C] mb-4">
            Email <a href="mailto:support@breezysocial.com" className="text-[#5A7A55] underline">support@breezysocial.com</a> with your measurements and we'll recommend a size within a few hours.
          </p>
          <p className="text-xs text-[#9A9488]">Free exchanges within 30 days if the fit isn't right.</p>
        </div>
      </div>
    </BreezyLayout>
  );
}

function Guide({ title, intro, rows, tip }: {
  title: string; intro: string; rows: Array<[string, string]>; tip: string;
}) {
  return (
    <section>
      <h2
        className="text-2xl md:text-3xl mb-3 text-[#2A2A28]"
        style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
      >
        {title}
      </h2>
      <p className="text-sm text-[#7A7468] mb-5">{intro}</p>
      <table className="w-full border-collapse text-sm mb-4">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-[#E8E2D5]">
              <td className="py-3 pr-4 text-[#5A554C] font-medium">{k}</td>
              <td className="py-3 text-[#2A2A28]">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-[#7A7468] italic border-l-2 border-[#7D9B76] pl-4">{tip}</p>
    </section>
  );
}
