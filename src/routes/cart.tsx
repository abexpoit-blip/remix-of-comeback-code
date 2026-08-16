import { siteFor } from "@/lib/site-identity";
import { getHost } from "@/lib/host";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";
import { useCart } from "@/lib/cart-context";
import { PRODUCT_IMAGES } from "@/lib/breezy-content";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: `Your Cart — ${siteFor(getHost()).name}` },
      { name: "description", content: "Review your selected items and proceed to secure checkout." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, subtotal, setQty, remove } = useCart();
  const navigate = useNavigate();
  const shipping = subtotal >= 50 || subtotal === 0 ? 0 : 6.99;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <BreezyLayout>
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="text-6xl mb-6">🛍️</div>
          <h1 className="text-4xl mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Your cart is empty
          </h1>
          <p className="text-[#7A7468] mb-8">Discover thoughtfully made gear for slow living.</p>
          <Link
            to="/shop"
            className="inline-block bg-[#2A2A28] text-[#FAF7F2] px-8 py-3 rounded-full text-sm font-semibold uppercase tracking-wide hover:bg-[#5A7A55] transition-colors"
          >
            Continue shopping
          </Link>
        </div>
      </BreezyLayout>
    );
  }

  return (
    <BreezyLayout>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1
          className="text-4xl md:text-5xl mb-10 text-[#2A2A28]"
          style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
        >
          Your cart
        </h1>

        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const img = PRODUCT_IMAGES[item.slug];
              return (
                <div
                  key={item.slug}
                  className="flex gap-4 bg-white border border-[#E8E2D5] rounded-2xl p-4"
                >
                  <Link
                    to="/shop/$slug"
                    params={{ slug: item.slug }}
                    className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-xl overflow-hidden bg-[#F2EDE3]"
                  >
                    {img ? (
                      <img src={img} alt={item.name} className="w-full h-full object-cover" />
                    ) : null}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      to="/shop/$slug"
                      params={{ slug: item.slug }}
                      className="font-medium text-[#2A2A28] hover:text-[#5A7A55]"
                    >
                      {item.name}
                    </Link>
                    <div className="text-sm text-[#7A7468] mt-1">${item.price.toFixed(2)} each</div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 border border-[#E8E2D5] rounded-full px-1">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() => setQty(item.slug, item.qty - 1)}
                          className="w-8 h-8 rounded-full hover:bg-[#F2EDE3] text-[#5A554C]"
                        >−</button>
                        <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() => setQty(item.slug, item.qty + 1)}
                          className="w-8 h-8 rounded-full hover:bg-[#F2EDE3] text-[#5A554C]"
                        >+</button>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-[#2A2A28]">
                          ${(item.price * item.qty).toFixed(2)}
                        </span>
                        <button
                          onClick={() => remove(item.slug)}
                          className="text-xs text-[#9A9488] hover:text-[#5A7A55] underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <Link
              to="/shop"
              className="inline-block mt-4 text-sm text-[#5A7A55] hover:underline"
            >
              ← Continue shopping
            </Link>
          </div>

          <aside className="bg-white border border-[#E8E2D5] rounded-2xl p-6 h-fit lg:sticky lg:top-28">
            <h2
              className="text-2xl mb-5 text-[#2A2A28]"
              style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
            >
              Order summary
            </h2>
            <dl className="space-y-3 text-sm border-b border-[#E8E2D5] pb-5 mb-5">
              <div className="flex justify-between">
                <dt className="text-[#7A7468]">Subtotal</dt>
                <dd className="font-medium">${subtotal.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#7A7468]">Shipping</dt>
                <dd className="font-medium">{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</dd>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-[#9A9488] italic">
                  Add ${(50 - subtotal).toFixed(2)} more for free shipping
                </p>
              )}
            </dl>
            <div className="flex justify-between items-baseline mb-6">
              <span className="text-[#5A554C]">Total</span>
              <span className="text-2xl font-semibold text-[#2A2A28]">${total.toFixed(2)}</span>
            </div>
            <button
              onClick={() => navigate({ to: "/checkout" })}
              className="w-full bg-[#2A2A28] text-[#FAF7F2] py-4 rounded-full text-sm font-semibold uppercase tracking-wide hover:bg-[#5A7A55] transition-colors"
            >
              Secure checkout →
            </button>
            <div className="mt-5 pt-5 border-t border-[#E8E2D5] flex items-center justify-center gap-2 text-xs text-[#9A9488]">
              <span>🔒</span>
              <span>256-bit SSL encrypted checkout</span>
            </div>
          </aside>
        </div>
      </div>
    </BreezyLayout>
  );
}
