import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

function getClientIp(): string | null {
  try {
    const req = getRequest();
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const xrip = req.headers.get("x-real-ip");
    if (xrip) return xrip.trim();
    return null;
  } catch {
    return null;
  }
}

/**
 * Called by the signup page BEFORE supabase.auth.signUp.
 * Enforces admin-controlled rules: master kill-switch, Gmail-only, disposable
 * blocklist, per-IP daily cap. Always logs the attempt.
 */
export const preSignupCheck = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email().max(255) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const domain = email.split("@")[1] ?? "";
    const ip = getClientIp();

    const log = async (success: boolean, reason: string | null) => {
      try {
        await supabaseAdmin.from("signup_attempts").insert({ ip, email, success, reason } as any);
      } catch (e) {
        console.error("[preSignupCheck] log failed", e);
      }
    };

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("signup_protection_enabled, signup_gmail_only, signup_blocklist_enabled, signup_ip_max_per_day")
      .eq("id", true)
      .maybeSingle();

    // Master switch OFF → allow everything (just log)
    if (!settings?.signup_protection_enabled) {
      await log(true, "protection_disabled");
      return { ok: true as const };
    }

    // 1. Gmail-only
    if (settings.signup_gmail_only && !GMAIL_DOMAINS.has(domain)) {
      await log(false, "not_gmail");
      return { ok: false as const, error: "Only Gmail addresses (@gmail.com) are accepted at this time." };
    }

    // 2. Disposable blocklist
    if (settings.signup_blocklist_enabled) {
      const { data: blocked } = await supabaseAdmin
        .from("blocked_email_domains")
        .select("domain")
        .eq("domain", domain)
        .maybeSingle();
      if (blocked) {
        await log(false, "disposable_domain");
        return { ok: false as const, error: "Disposable / temporary email addresses are not allowed." };
      }
    }

    // 3. Per-IP daily cap — DISABLED (unlimited accounts per IP by request).
    //    Attempts are still logged for visibility, but never blocked.


    await log(true, null);
    return { ok: true as const };
  });
