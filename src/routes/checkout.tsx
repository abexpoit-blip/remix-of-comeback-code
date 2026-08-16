import { siteFor } from "@/lib/site-identity";
import { getHost } from "@/lib/host";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";
import { useCart } from "@/lib/cart-context";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: `Secure Checkout — ${siteFor(getHost()).name}` },
      { name: "description", content: "Complete your order securely." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const shipping = subtotal >= 50 || subtotal === 0 ? 0 : 6.99;
  const tax = subtotal * 0.0825;
  const total = subtotal + shipping + tax;

  if (items.length === 0 && !submitting) {
    return (
      <BreezyLayout>
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <h1 className="text-3xl mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Your cart is empty
          </h1>
          <button
            onClick={() => navigate({ to: "/shop" })}
            className="text-[#5A7A55] hover:underline"
          >
            ← Browse the shop
          </button>
        </div>
      </BreezyLayout>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const orderNumber = `BS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    setTimeout(() => {
      try {
        sessionStorage.setItem("breezy_last_order", JSON.stringify({
          orderNumber,
          total,
          items,
          subtotal,
          shipping,
          tax,
          date: new Date().toISOString(),
        }));
      } catch { /* ignore */ }
      clear();
      navigate({ to: "/order-confirmed", search: { o: orderNumber } });
    }, 1400);
  };

  return (
    <BreezyLayout>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1
          className="text-4xl md:text-5xl mb-10 text-[#2A2A28]"
          style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
        >
          Checkout
        </h1>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <Section title="Contact information">
              <Field label="Email" name="email" type="email" required placeholder="you@email.com" />
              <label className="flex items-center gap-2 text-sm text-[#5A554C] mt-3">
                <input type="checkbox" defaultChecked className="rounded" />
                Email me with news and offers
              </label>
            </Section>

            <Section title="Shipping address">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="First name" name="fname" required />
                <Field label="Last name" name="lname" required />
              </div>
              <Field label="Address" name="address" required placeholder="Street address" />
              <Field label="Apartment, suite, etc. (optional)" name="apt" />
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="City" name="city" required />
                <Field label="State" name="state" required placeholder="State" />
                <Field label="ZIP" name="zip" required placeholder="ZIP code" />
              </div>
              <Field label="Country" name="country" required defaultValue="United States" />
              <Field label="Phone" name="phone" type="tel" placeholder="Phone number" />
            </Section>

            <Section title="Payment">
              <div className="flex items-center gap-2 mb-4 text-xs text-[#7A7468]">
                <span>🔒</span>
                <span>All transactions are secure and encrypted.</span>
              </div>
              <Field label="Card number" name="card" required placeholder="1234 1234 1234 1234" inputMode="numeric" maxLength={19} />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Expiration (MM / YY)" name="exp" required placeholder="MM / YY" maxLength={7} />
                <Field label="CVC" name="cvc" required placeholder="123" inputMode="numeric" maxLength={4} />
              </div>
              <Field label="Name on card" name="cname" required />
            </Section>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <button
                type="button"
                onClick={() => navigate({ to: "/cart" })}
                className="text-sm text-[#5A7A55] hover:underline"
              >
                ← Return to cart
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto bg-[#2A2A28] text-[#FAF7F2] px-10 py-4 rounded-full text-sm font-semibold uppercase tracking-wide hover:bg-[#5A7A55] transition-colors disabled:opacity-60"
              >
                {submitting ? "Processing payment…" : `Pay $${total.toFixed(2)}`}
              </button>
            </div>
          </div>

          <aside className="bg-white border border-[#E8E2D5] rounded-2xl p-6 h-fit lg:sticky lg:top-28">
            <h2 className="text-lg font-semibold mb-4">Order summary</h2>
            <ul className="space-y-3 mb-5 max-h-72 overflow-y-auto pr-1">
              {items.map((i) => (
                <li key={i.slug} className="flex justify-between text-sm">
                  <span className="text-[#5A554C]">{i.name} <span className="text-[#9A9488]">× {i.qty}</span></span>
                  <span className="font-medium">${(i.price * i.qty).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <dl className="border-t border-[#E8E2D5] pt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
              <Row label="Shipping" value={shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`} />
              <Row label="Tax (estimated)" value={`$${tax.toFixed(2)}`} />
            </dl>
            <div className="border-t border-[#E8E2D5] mt-4 pt-4 flex justify-between items-baseline">
              <span className="text-[#5A554C]">Total</span>
              <span className="text-2xl font-semibold">${total.toFixed(2)}</span>
            </div>
          </aside>
        </form>
      </div>
    </BreezyLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-4 text-[#2A2A28]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, name, type = "text", required, placeholder, defaultValue, inputMode, maxLength }: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string;
  defaultValue?: string; inputMode?: "text" | "numeric" | "tel" | "email"; maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[#7A7468] block mb-1">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        inputMode={inputMode}
        maxLength={maxLength}
        className="w-full px-4 py-3 rounded-xl border border-[#E8E2D5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5A7A55] focus:border-transparent"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[#7A7468]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
