/**
 * Smart Brain Leak Monitor — admin server functions.
 * Read-only probes; nothing here touches the redirect hot path.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Every domain we advertise from: built-ins + verified user custom domains. */
async function collectDomains(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const set = new Set<string>(["breezysocial.com", "skypq.com", "mefok.com"]);
  try {
    const { data } = await supabaseAdmin
      .from("custom_domains")
      .select("domain, verified")
      .eq("verified", true)
      .limit(50);
    for (const row of (data as { domain?: string }[] | null) ?? []) {
      const d = (row.domain || "").trim().toLowerCase();
      if (d) set.add(d);
    }
  } catch {
    /* built-ins are enough */
  }
  return [...set];
}

export const runLeakScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domain?: string } | undefined) =>
    z.object({ domain: z.string().optional() }).optional().parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./domain-monitor.server");
    await assertAdmin(context.userId);
    const { runLeakSweep } = await import("./leak-monitor.server");
    const domains = data?.domain ? [data.domain.toLowerCase()] : await collectDomains();
    return await runLeakSweep(domains);
  });

export const listLeakFindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./domain-monitor.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("error_logs")
      .select("id, level, message, context, created_at")
      .eq("source", "leak_monitor")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { findings: data ?? [] };
  });

export const clearLeakFindings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./domain-monitor.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("error_logs")
      .delete()
      .eq("source", "leak_monitor");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
