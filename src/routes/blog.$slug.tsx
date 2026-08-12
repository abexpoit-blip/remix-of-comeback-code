import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";
import { ProductCard } from "@/components/breezy/ProductCard";
import { getArticle, getProduct, SITE, type Article, type Product } from "@/lib/breezy-data";
import { ARTICLE_BODIES, BLOG_IMAGES } from "@/lib/breezy-content";
import { buildOg, absoluteUrl } from "@/lib/og-meta";
import { getRequestOrigin } from "@/lib/request-origin.functions";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    const { origin } = await getRequestOrigin();
    return { article, origin };
  },
  head: ({ loaderData, params }) => {
    const a = loaderData?.article;
    const origin = loaderData?.origin ?? "https://breezysocial.com";
    if (!a) return { meta: [{ title: "Article not found" }] };
    const imgPath = BLOG_IMAGES[a.slug];
    const imgUrl = imgPath ? absoluteUrl(origin, imgPath) : undefined;
    const { meta, links } = buildOg({
      origin,
      path: `/blog/${params.slug}`,
      title: `${a.title} — ${SITE.name} Journal`,
      description: a.excerpt,
      image: imgUrl,
      imageAlt: `${a.title} — illustration`,
      type: "article",
      updatedTime: a.date,
      article: {
        author: a.author,
        publishedTime: a.date,
        modifiedTime: a.date,
        section: "Wellness & Sleep",
        tags: ["sleep", "wellness", "gadgets", "focus"],
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
            "@type": "Article",
            headline: a.title,
            description: a.excerpt,
            image: imgUrl,
            author: { "@type": "Person", name: a.author, jobTitle: a.authorRole },
            publisher: {
              "@type": "Organization",
              name: SITE.name,
              url: absoluteUrl(origin, "/"),
              logo: { "@type": "ImageObject", url: absoluteUrl(origin, "/og-default.png") },
            },
            datePublished: a.date,
            dateModified: a.date,
            mainEntityOfPage: absoluteUrl(origin, `/blog/${params.slug}`),
          }),
        },
      ],
    };
  },
  component: ArticlePage,
  notFoundComponent: () => (
    <BreezyLayout>
      <div className="max-w-2xl mx-auto px-6 py-32 text-center">
        <h1 className="text-3xl mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>Article not found</h1>
        <Link to="/blog" className="text-[#5A7A55] hover:underline">← Back to journal</Link>
      </div>
    </BreezyLayout>
  ),
});

/** Render a tiny markdown subset: ## h2, - bullet lists, blank-line paragraphs. */
function renderMarkdown(body: string) {
  const blocks = body.split(/\n\n+/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("## ")) {
      return (
        <h2
          key={i}
          className="text-2xl md:text-3xl text-[#2A2A28] mt-10 mb-4 leading-snug"
          style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
        >
          {trimmed.replace(/^##\s+/, "")}
        </h2>
      );
    }
    if (trimmed.startsWith("# ")) {
      return null; // skip H1, title is already rendered
    }
    const lines = trimmed.split("\n");
    if (lines.every((l) => l.trim().startsWith("- ") || l.trim().startsWith("* "))) {
      return (
        <ul key={i} className="list-disc pl-6 mb-5 space-y-2 text-[#3A3A38]">
          {lines.map((l, j) => (
            <li key={j}>{l.replace(/^[-*]\s+/, "")}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="mb-5 text-[#3A3A38] leading-relaxed">
        {trimmed}
      </p>
    );
  });
}

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const a = article as Article;
  const related: Product[] = a.relatedProducts.map(getProduct).filter((x): x is Product => Boolean(x));
  const body = ARTICLE_BODIES[a.slug] || a.body;
  const img = BLOG_IMAGES[a.slug];

  return (
    <BreezyLayout>
      <article className="max-w-3xl mx-auto px-6 py-16">
        <nav className="text-xs text-[#9A9488] mb-6">
          <Link to="/" className="hover:text-[#5A7A55]">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#5A7A55]">Journal</Link>
        </nav>
        <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-3">
          {a.category} · {a.readTime} min read
        </div>
        <h1 className="text-4xl md:text-5xl text-[#2A2A28] mb-6 leading-tight" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
          {a.title}
        </h1>
        <div className="flex items-center gap-3 mb-10 text-sm text-[#7A7468] border-b border-[#E8E2D5] pb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7D9B76] to-[#5A7A55] flex items-center justify-center text-white text-sm font-semibold">
            {a.author.split(" ").map((n: string) => n[0]).join("")}
          </div>
          <div>
            <div className="text-[#2A2A28] font-medium">{a.author}</div>
            <div className="text-xs">{a.authorRole} · {new Date(a.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
          </div>
        </div>
        <div className="aspect-[16/9] rounded-2xl bg-gradient-to-br from-[#F2EDE3] to-[#E8E2D5] overflow-hidden mb-10 flex items-center justify-center">
          {img ? (
            <img src={img} alt={a.title} width={1536} height={1024} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[8rem]">{a.emoji}</span>
          )}
        </div>
        <div className="text-lg max-w-none">
          <p className="text-xl text-[#5A554C] italic mb-8">{a.excerpt}</p>
          {body ? (
            renderMarkdown(body)
          ) : (
            <p className="text-[#9A9488]">Full article content is being prepared and will be published shortly.</p>
          )}
        </div>

        {related.length > 0 && (
          <section className="mt-16 border-t border-[#E8E2D5] pt-12">
            <h2 className="text-2xl mb-6" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>
              Products mentioned in this article
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {related.map((p) => (p ? <ProductCard key={p.slug} product={p} /> : null))}
            </div>
          </section>
        )}
      </article>
    </BreezyLayout>
  );
}
