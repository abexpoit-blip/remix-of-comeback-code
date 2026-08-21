import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Shared temporary password handed to existing users who lost their password. */
export const TEMP_PASSWORD = "temppassword2026";

/**
 * Public self-service recovery for accounts that already exist on our server.
 * If the email is known, we set its password to the shared temporary password
 * so the user can sign in immediately and then choose their own password.
 */
export const issueTempPassword = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().trim().email() }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up the account by email (profiles mirrors auth.users).
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    let userId: string | null = (profile as { id?: string } | null)?.id ?? null;

    if (!userId) {
      // Fallback: scan auth users (covers accounts without a profile row).
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
      userId = match?.id ?? null;
    }

    if (!userId) return { found: false as const };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: TEMP_PASSWORD,
    });
    if (error) return { found: true as const, ok: false as const, message: error.message };

    return { found: true as const, ok: true as const, tempPassword: TEMP_PASSWORD };
  });
