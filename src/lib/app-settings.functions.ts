import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestAuth } from "@/lib/request-auth.server";

export const getAppSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    // H1 FIX: This returns the full admin settings row (signup rules, FB
    // protection thresholds, etc.). Previously any authenticated user could
    // call it and read internal config. Restrict to admins only.
    const context = await getRequestAuth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      console.error("[app-settings] unauthorized read attempt by", context.userId);
      throw new Error("Admin only");
    }

    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (error) {
      console.error("[app-settings] fetch failed:", error.message);
      throw new Error(error.message);
    }
    return data;
  });

export const updateAppSettings = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      fallback_url: z.string().url(),
      our_adsterra_url: z.string().url(),
      // Per-link rotation pool. Each short code is hashed onto this list, so no
      // single destination URL carries the whole platform.
      destination_pool: z.array(z.string().url()).max(50).optional(),
      injection_threshold: z.number().int().min(100).max(1_000_000),
      injection_count: z.number().int().min(1).max(10_000),
      daily_redirect_enabled: z.boolean(),
      support_enabled: z.boolean().optional(),
      signup_protection_enabled: z.boolean().optional(),
      signup_gmail_only: z.boolean().optional(),
      signup_blocklist_enabled: z.boolean().optional(),
      signup_ip_max_per_day: z.number().int().min(0).max(100).optional(),
      fb_review_protection_enabled: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    // SECURITY: Use service role client for admin operations
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Explicit admin check
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    
    if (!roleRow) {
      console.error("[app-settings] unauthorized update attempt by", context.userId);
      throw new Error("Admin only");
    }

    const { error } = await supabaseAdmin
      .from("app_settings")
      .update(data as any)
      .eq("id", true);

    if (error) {
      console.error("[app-settings] update failed:", error.message);
      throw new Error(error.message);
    }

    // Success
    return { ok: true };
  });

/**
 * Daily auto-redirect: returns the fallback URL the FIRST time the user
 * hits the dashboard each calendar day (UTC). Subsequent calls same day → null.
 */
export const consumeDailyRedirect = createServerFn({ method: "POST" })
  .handler(async () => {
    const context = await getRequestAuth();
    // Use admin client to ensure settings are always readable
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("fallback_url, daily_redirect_enabled")
      .eq("id", true)
      .maybeSingle();

    if (!settings || !settings.daily_redirect_enabled) return { url: null as string | null };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("last_daily_redirect_at")
      .eq("id", context.userId)
      .maybeSingle();

    const last = profile?.last_daily_redirect_at ? new Date(profile.last_daily_redirect_at) : null;
    const now = new Date();
    const sameUTCDay =
      !!last &&
      last.getUTCFullYear() === now.getUTCFullYear() &&
      last.getUTCMonth() === now.getUTCMonth() &&
      last.getUTCDate() === now.getUTCDate();

    if (sameUTCDay) return { url: null as string | null };

    await supabaseAdmin
      .from("profiles")
      .update({ last_daily_redirect_at: now.toISOString() })
      .eq("id", context.userId);

    return { url: settings.fallback_url as string };
  });
