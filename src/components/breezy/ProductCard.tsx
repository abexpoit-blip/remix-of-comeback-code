import { Link } from "@tanstack/react-router";
import type { Product } from "@/lib/breezy-data";
import { PRODUCT_IMAGES } from "@/lib/breezy-content";
import { useRebrand } from "@/lib/site-identity";

export function ProductCard({ product }: { product: Product }) {
  const rb = useRebrand();
  const img = PRODUCT_IMAGES[product.slug];
  return (
    <Link
      to="/shop/$slug"
      params={{ slug: product.slug }}
      className="group block bg-white border border-[#E8E2D5] rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
    >
      <div className="aspect-square bg-gradient-to-br from-[#F2EDE3] to-[#E8E2D5] flex items-center justify-center overflow-hidden">
        {img ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            width={1024}
            height={1024}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <span className="text-7xl group-hover:scale-105 transition-transform">{product.emoji}</span>
        )}
      </div>
      <div className="p-5">
        <div className="text-[10px] uppercase tracking-wider text-[#7D9B76] font-semibold mb-1">
          {product.category}
        </div>
        <h3
          className="text-lg leading-tight text-[#2A2A28] mb-2"
          style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
        >
          {product.name}
        </h3>
        <p className="text-xs text-[#7A7468] mb-3 line-clamp-2">{rb(product.shortDesc)}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-[#2A2A28]">${product.price}</span>
            {product.originalPrice && (
              <span className="text-xs text-[#9A9488] line-through">${product.originalPrice}</span>
            )}
          </div>
          <div className="text-xs text-[#7A7468] flex items-center gap-1">
            <span className="text-[#E8A87C]">★</span>
            <span>{product.rating}</span>
            <span className="text-[#9A9488]">({product.reviews.toLocaleString()})</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
