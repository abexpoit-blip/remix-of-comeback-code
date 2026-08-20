import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Delivery beacon — GET/POST /api/public/t?r=ours
 *
 * This is a brand-neutral alias of /api/public/px. The short extensionless
 * path avoids both common blocker keywords and Nginx static-file rules. It
 * records the same arrival counter used to compute delivered / decided rates.
 *
 * Returns a 1x1 transparent GIF.
 */

const GIF = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

function pixel() {
  return new Response(GIF, {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, max-age=0",
    },
  });
}

async function record(request: Request): Promise<string | null> {
  try {
    const r = new URL(request.url).searchParams.get("r") || "offer";
    const route = r === "ours" ? "ours" : "offer";
    const { error } = await supabaseAdmin.rpc("record_bridge_delivery" as never, {
      _route: route,
    } as never);
    return error ? `${error.code || ""} ${error.message || ""}`.trim() : null;
  } catch (e) {
    // never let measurement affect the visitor
    return e instanceof Error ? e.message : "unknown";
  }
}

export const Route = createFileRoute("/api/public/t")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const err = await record(request);
        if (new URL(request.url).searchParams.get("debug") === "1") {
          return new Response(JSON.stringify({ ok: !err, error: err }), {
            status: 200,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        }
        return pixel();
      },
      POST: async ({ request }) => {
        await record(request);
        return pixel();
      },
    },
  },
});
