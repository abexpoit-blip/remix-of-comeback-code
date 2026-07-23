// Server-only error logging helper. Writes to public.error_logs via service role.
// Must NEVER throw — used inside catch blocks on the hot path.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LogSource =
  | "redirect"
  | "server_fn"
  | "webhook"
  | "bot_detect"
  | "country_lookup"
  | "db"
  | "meta_crawler_block"
  | "other";

export async function logServerError(
  source: LogSource,
  err: unknown,
  context: Record<string, unknown> = {},
  level: "error" | "warn" | "info" = "error",
): Promise<void> {
  try {
    const e = err as { message?: string; stack?: string } | null;
    const message = (e?.message || String(err) || "unknown error").slice(0, 2000);
    const stack = (e?.stack || "").slice(0, 8000) || null;
    const linkId = (context.linkId as string | undefined) ?? null;
    const userId = (context.userId as string | undefined) ?? null;

    await (supabaseAdmin.from as unknown as (t: string) => {
      insert: (row: Record<string, unknown>) => Promise<unknown>;
    })("error_logs").insert({
      source,
      level,
      message,
      stack,
      context,
      link_id: linkId,
      user_id: userId,
    });
  } catch (logErr) {
    // last-ditch — only console, never rethrow
    console.error("[error-log] failed to record", logErr);
  }
}
