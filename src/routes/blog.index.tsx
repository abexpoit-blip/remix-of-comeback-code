import { createFileRoute, Link } from "@tanstack/react-router";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";
import { ARTICLES } from "@/lib/breezy-data";
import { BLOG_IMAGES } from "@/lib/breezy-content";
import { buildOg } from "@/lib/og-meta";
import { brandForOrigin } from "@/lib/brand-registry";
import { getRequestOrigin } from "@/lib/request-origin.functions";

export const Route = createFileRoute("/blog/")({
  loader: async () => await getRequestOrigin(),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "https://breezysocial.com";
    const brand = brandForOrigin(origin);
    const { meta, links } = buildOg({
      origin,
      path: "/blog",
      title: `Journal — ${brand.name}`,
      description: "Sleep science, wellness, gift guides, and travel — written by our editors and experts.",
      type: "website",
    });
    return { meta, links };
  },
  component: BlogIndexPage,
});


function BlogIndexPage() {
  return (
    <BreezyLayout>
      <section className="bg-[#F2EDE3]">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3">
            The Journal
          </div>
          <h1 className="text-5xl md:text-6xl text-[#2A2A28] mb-4" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
            Stories worth reading
          </h1>
          <p className="text-[#5A554C]">Sleep, wellness, gear, and slow living — researched and written by our team.</p>
        </div>
      </section>
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-10">
          {ARTICLES.map((a) => {
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
                    <img
                      src={img}
                      alt={a.title}
                      loading="lazy"
                      width={1536}
                      height={1024}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <span className="text-7xl">{a.emoji}</span>
                  )}
                </div>
                <div className="p-7">
                  <div className="text-[10px] uppercase tracking-wider text-[#7D9B76] font-semibold mb-2">
                    {a.category} · {a.readTime} min read · {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <h2 className="text-2xl text-[#2A2A28] mb-3 leading-snug group-hover:text-[#5A7A55] transition-colors" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
                    {a.title}
                  </h2>
                  <p className="text-sm text-[#7A7468] mb-4">{a.excerpt}</p>
                  <div className="text-xs text-[#5A554C]">By {a.author}, {a.authorRole}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </BreezyLayout>
  );
}
