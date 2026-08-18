import { createFileRoute } from "@tanstack/react-router";
import { internalHostGuard, opsNotFound } from "@/lib/internal-endpoint";
import { fetchIpv4 } from "@/lib/fetch-ipv4";

/**
 * Ops-only diagnostic — GET /api/public/plisio-status
 *
 * Tells us WHY crypto checkout is failing without leaking the key:
 *  - keyPresent:false      -> PLISIO_API_KEY missing in the server env (.env / pm2)
 *  - apiCode 101/102       -> key is wrong / merchant disabled
 *  - apiCode 104           -> server IP not whitelisted in Plisio account settings
 *  - ok:true               -> gateway reachable and merchant active
 */
export const Route = createFileRoute("/api/public/plisio-status")({
  server: {
    handlers: {
      POST: async () => opsNotFound(),
      GET: async ({ request }) => {
        const blocked = internalHostGuard(request);
        if (blocked) return blocked;

        const apiKey = process.env.PLISIO_API_KEY;
        if (!apiKey) {
          return Response.json(
            { ok: false, keyPresent: false, reason: "PLISIO_API_KEY missing in server environment" },
            { status: 503 },
          );
        }

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        try {
          const res = await fetchIpv4(
            `https://api.plisio.net/api/v1/balances/USD?api_key=${encodeURIComponent(apiKey)}`,
            { signal: ctrl.signal },
          );
          const json = (await res.json().catch(() => null)) as any;
          clearTimeout(timer);

          const ok = json?.status === "success";
          return Response.json(
            {
              ok,
              keyPresent: true,
              keyLength: apiKey.length,
              http: res.status,
              apiStatus: json?.status ?? null,
              apiCode: json?.data?.code ?? null,
              apiMessage: json?.data?.message ?? null,
            },
            { status: ok ? 200 : 502 },
          );
        } catch (e: any) {
          clearTimeout(timer);
          return Response.json(
            { ok: false, keyPresent: true, reason: `network error: ${e?.message || e}` },
            { status: 502 },
          );
        }
      },
    },
  },
});
