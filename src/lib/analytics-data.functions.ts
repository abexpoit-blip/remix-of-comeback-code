import { createServerFn } from "@tanstack/react-start";
import { emptyAnalytics, loadAnalyticsData } from "@/lib/analytics.server";
import { getRequestAuth } from "@/lib/request-auth.server";
import { checkPaidAccess } from "@/lib/plan-gate.server";

// Hard cap so a slow DB never blocks a PM2 worker (nginx read timeout is 60s;
// we return degraded data well before that so redirects keep flowing).
const ANALYTICS_HARD_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      console.warn(`[analytics][TIMEOUT] ${label} exceeded ${ms}ms — returning degraded payload`);
      resolve(fallback);
    }, ms);
    promise
      .then((v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } })
      .catch((e) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        console.error(`[analytics][ERR] ${label}: ${e?.message ?? e}`);
        resolve(fallback);
      });
  });
}

export const getAnalyticsData = createServerFn({ method: "GET" })
  .handler(async () => {
    const t0 = Date.now();
    let stage = "auth";
    try {
      const context = await getRequestAuth();
      const tAuth = Date.now();

      stage = "plan-gate";
      const gate = await checkPaidAccess(context.supabase, context.userId);
      const tGate = Date.now();

      if (!gate.allowed) {
        console.log(`[analytics] locked user=${context.userId} plan=${gate.plan} auth=${tAuth - t0}ms gate=${tGate - tAuth}ms`);
        return { ...emptyAnalytics(), locked: true, plan: gate.plan };
      }

      stage = "load-rpc";
      // Wrap DB work in a hard timeout — never let it hold a worker for 60s+.
      const data = await withTimeout(
        loadAnalyticsData(context) as Promise<ReturnType<typeof emptyAnalytics>>,
        ANALYTICS_HARD_TIMEOUT_MS,
        emptyAnalytics(),
        `loadAnalyticsData(user=${context.userId})`,
      );
      const tDone = Date.now();

      console.log(
        `[analytics][OK] user=${context.userId} total=${tDone - t0}ms auth=${tAuth - t0}ms gate=${tGate - tAuth}ms rpc+transform=${tDone - tGate}ms`,
      );
      return { ...data, locked: false, plan: gate.plan };
    } catch (err: any) {
      const dt = Date.now() - t0;
      const msg = err?.message ?? String(err);
      const code = err?.code ?? err?.cause?.code ?? null;
      const details = err?.details ?? err?.hint ?? null;
      console.error(
        `[analytics][FAIL] stage=${stage} after=${dt}ms code=${code} msg=${msg} details=${details}`,
      );
      throw new Error(`[${stage}] ${msg}${code ? ` (code=${code})` : ""}${details ? ` — ${details}` : ""}`);
    }
  });

