import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isFlaggedShortDomain } from "@/lib/short-domains";

const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;

function normalize(d: string) {
  return d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin only.");
}

// Public — any signed-in user (used by dashboard to display short URLs on the live domain)
export const getPrimaryShortenerDomain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data } = await supabase
      .from("shortener_domains")
      .select("domain")
      .eq("is_primary", true)
      .eq("is_active", true)
      .maybeSingle();
    const primary = data?.domain as string | undefined;
    // A Safe-Browsing-flagged domain must never be served as primary.
    if (!primary || isFlaggedShortDomain(primary)) {
      const { data: alt } = await supabase
        .from("shortener_domains")
        .select("domain")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      const safe = (alt ?? []).map((r: any) => r.domain as string).find((d: string) => !isFlaggedShortDomain(d));
      return { domain: safe ?? "breezysocial.com" };
    }
    return { domain: primary };
  });

export const listShortenerDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("shortener_domains")
      .select("id, domain, dns_target, is_primary, is_active, verified, verified_at, note, created_at")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { domains: data ?? [] };
  });

export const addShortenerDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { domain: string; note?: string }) =>
    z.object({ domain: z.string().min(3).max(253), note: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const domain = normalize(data.domain);
    if (!domainRegex.test(domain)) throw new Error("Invalid domain (e.g. trk.example.com)");
    const { data: existing } = await supabase
      .from("shortener_domains").select("id").eq("domain", domain).maybeSingle();
    if (existing) throw new Error("Domain already in pool.");
    const { data: row, error } = await supabase
      .from("shortener_domains").insert({ domain, note: data.note ?? null })
      .select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const verifyShortenerDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: row } = await supabase
      .from("shortener_domains").select("id, domain, dns_target").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    let ok = false; let foundIps: string[] = [];
    try {
      const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(row.domain)}&type=A`,
        { headers: { accept: "application/dns-json" } });
      const j: any = await r.json();
      foundIps = (j?.Answer ?? []).map((a: any) => String(a?.data ?? ""));
      ok = foundIps.includes(row.dns_target);
    } catch { /* ignore */ }
    if (!ok) {
      return { ok: false, message: `A record not pointing to ${row.dns_target}. Found: ${foundIps.join(", ") || "none"}` };
    }
    await supabase.from("shortener_domains")
      .update({ verified: true, verified_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true, message: "Domain verified — DNS points to VPS." };
  });

export const setPrimaryShortenerDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: row } = await supabase
      .from("shortener_domains").select("id, verified, is_active").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    if (!row.verified) throw new Error("Verify the domain first (DNS A record must point to VPS).");
    if (!row.is_active) throw new Error("Activate the domain first.");
    // Clear any existing primary, then set this one (atomic via single-primary unique index)
    const { error: clearErr } = await supabase
      .from("shortener_domains").update({ is_primary: false }).eq("is_primary", true);
    if (clearErr) throw new Error(clearErr.message);
    const { error } = await supabase
      .from("shortener_domains").update({ is_primary: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleShortenerDomainActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; is_active: boolean }) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("shortener_domains").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteShortenerDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: row } = await supabase
      .from("shortener_domains").select("is_primary").eq("id", data.id).maybeSingle();
    if (row?.is_primary) throw new Error("Cannot delete the primary domain. Promote another first.");
    const { error } = await supabase.from("shortener_domains").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
