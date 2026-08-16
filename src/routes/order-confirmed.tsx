import { siteFor } from "@/lib/site-identity";
import { getHost } from "@/lib/host";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { BreezyLayout } from "@/components/breezy/BreezyLayout";

export const Route = createFileRoute("/order-confirmed")({
  validateSearch: z.object({ o: z.string().optional() }),
  head: () => ({
    meta: [
      { title: `Order Confirmed — ${siteFor(getHost()).name}` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OrderConfirmedPage,
});

type LastOrder = {
  orderNumber: string;
  total: number;
  items: Array<{ slug: string; name: string; price: number; qty: number }>;
  date: string;
};

function OrderConfirmedPage() {
  const { o } = Route.useSearch();
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("breezy_last_order");
      if (raw) setOrder(JSON.parse(raw));
    } catch {/* ignore */}
  }, []);

  const orderNumber = order?.orderNumber || o || "BS-2026-XXXXXX";

  return (
    <BreezyLayout>
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-[#7D9B76]/15 mx-auto flex items-center justify-center mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#5A7A55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <div className="text-xs uppercase tracking-[0.2em] text-[#7D9B76] font-semibold mb-2">
          Payment received
        </div>
        <h1
          className="text-4xl md:text-5xl text-[#2A2A28] mb-3"
          style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
        >
          Thank you for your order
        </h1>
        <p className="text-[#7A7468] mb-2">
          Order <span className="font-mono font-medium text-[#2A2A28]">#{orderNumber}</span>
        </p>
        <p className="text-sm text-[#7A7468] mb-10">
          A confirmation email is on its way. You'll get tracking details within 24 hours.
        </p>

        {order && (
          <div className="bg-white border border-[#E8E2D5] rounded-2xl p-6 text-left mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#5A554C] mb-4">
              Order details
            </h2>
            <ul className="space-y-3 mb-5">
              {order.items.map((i) => (
                <li key={i.slug} className="flex justify-between text-sm">
                  <span className="text-[#5A554C]">{i.name} × {i.qty}</span>
                  <span className="font-medium">${(i.price * i.qty).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-[#E8E2D5] pt-4 flex justify-between text-lg">
              <span className="text-[#5A554C]">Total paid</span>
              <span className="font-semibold">${order.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/shop"
            className="bg-[#2A2A28] text-[#FAF7F2] px-8 py-3 rounded-full text-sm font-semibold uppercase tracking-wide hover:bg-[#5A7A55] transition-colors"
          >
            Continue shopping
          </Link>
          <Link
            to="/contact"
            className="border border-[#E8E2D5] text-[#5A554C] px-8 py-3 rounded-full text-sm font-semibold hover:bg-[#F2EDE3] transition-colors"
          >
            Contact support
          </Link>
        </div>
      </div>
    </BreezyLayout>
  );
}
