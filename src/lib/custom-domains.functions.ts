import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Custom Domains is available to all paid members.
const PAID_PLANS = new Set([
  "monthly",
  "pro_monthly",
  "pro",
  "yearly",
  "lifetime",
  "unlimited",
  "premium",
  "starter",
  "business",
  "enterprise",
]);

// The public CNAME target every custom domain points to.
export const CNAME_TARGET = "sleepox.com";

const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;

function normalize(d: string) {
  return d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

async function assertPaid(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_slug")
    .eq("id", userId)
    .maybeSingle();
  const slug = (profile?.plan_slug ?? "free").toLowerCase();
  if (!PAID_PLANS.has(slug)) {
    throw new Error("Custom Domains is a paid feature. Upgrade your plan to add a domain.");
  }
}

// --- DNS helpers (Cloudflare DoH; works in edge runtime) ---
async function dohQuery(name: string, type: "A" | "TXT" | "CNAME" | "NS"): Promise<string[]> {
  try {
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: "application/dns-json" } },
    );
    const j: any = await r.json();
    return (j?.Answer ?? []).map((a: any) => String(a?.data ?? "").replace(/^"|"$/g, ""));
  } catch {
    return [];
  }
}

// Registrar / DNS provider hints from nameservers, for a tailored 1-click guide.
function detectProvider(nameservers: string[]): { id: string; label: string; dashUrl: string } {
  const ns = nameservers.join(" ").toLowerCase();
  if (ns.includes("cloudflare")) return { id: "cloudflare", label: "Cloudflare", dashUrl: "https://dash.cloudflare.com/" };
  if (ns.includes("registrar-servers.com") || ns.includes("namecheaphosting"))
    return { id: "namecheap", label: "Namecheap", dashUrl: "https://ap.www.namecheap.com/domains/list/" };
  if (ns.includes("domaincontrol.com") || ns.includes("godaddy"))
    return { id: "godaddy", label: "GoDaddy", dashUrl: "https://dcc.godaddy.com/manage/dns" };
  if (ns.includes("namesilo")) return { id: "namesilo", label: "Namesilo", dashUrl: "https://www.namesilo.com/account_domains.php" };
  if (ns.includes("hostinger") || ns.includes("hostgator"))
    return { id: "hostinger", label: "Hostinger", dashUrl: "https://hpanel.hostinger.com/domains" };
  if (ns.includes("dnsimple")) return { id: "dnsimple", label: "DNSimple", dashUrl: "https://dnsimple.com/" };
  if (ns.includes("awsdns")) return { id: "route53", label: "AWS Route 53", dashUrl: "https://console.aws.amazon.com/route53/" };
  if (ns.includes("google") || ns.includes("googledomains"))
    return { id: "google", label: "Google Domains", dashUrl: "https://domains.google.com/registrar" };
  return { id: "other", label: "Your DNS provider", dashUrl: "" };
}

export const listCustomDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_slug")
      .eq("id", userId)
      .maybeSingle();
    const slug = (profile?.plan_slug ?? "free").toLowerCase();
    const isPaid = PAID_PLANS.has(slug);

    const { data, error } = await supabase
      .from("custom_domains")
      .select("id, domain, verification_token, verified, verified_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { domains: data ?? [], isPaid, planSlug: slug, cnameTarget: CNAME_TARGET };
  });

export const addCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { domain: string }) =>
    z.object({ domain: z.string().min(3).max(253) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertPaid(supabase, userId);
    const domain = normalize(data.domain);
    if (!domainRegex.test(domain)) throw new Error("Invalid domain format (e.g. go.yoursite.com)");

    // Global uniqueness (RLS-scoped select would miss other users' rows)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("custom_domains")
      .select("id, user_id")
      .eq("domain", domain)
      .maybeSingle();
    if (existing) {
      if (existing.user_id === userId) throw new Error("You have already registered this domain.");
      throw new Error("This domain is already registered by another account.");
    }

    const tokenBytes = new Uint8Array(16);
    crypto.getRandomValues(tokenBytes);
    const verification_token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: inserted, error } = await supabase
      .from("custom_domains")
      .insert({ user_id: userId, domain, verification_token })
      .select("id, domain, verification_token, verified, created_at")
      .single();
    if (error) throw new Error(`Could not save domain: ${error.message}`);
    return { ...inserted, cnameTarget: CNAME_TARGET };
  });

/**
 * Enhanced verify: checks TXT + CNAME, detects registrar from nameservers,
 * flips `verified = true` when both records are correct. Safe to poll.
 */
export const verifyCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const { data: row } = await supabase
      .from("custom_domains")
      .select("id, domain, verification_token, verified")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Domain not found.");

    const txtName = `_sleepox-verify.${row.domain}`;

    // Run all lookups in parallel for speed.
    const rootParts = row.domain.split(".");
    const rootDomain = rootParts.length > 2 ? rootParts.slice(-2).join(".") : row.domain;
    const [txtAnswers, cnameAnswers, aAnswers, nsAnswers] = await Promise.all([
      dohQuery(txtName, "TXT"),
      dohQuery(row.domain, "CNAME"),
      dohQuery(row.domain, "A"),
      dohQuery(rootDomain, "NS"),
    ]);

    const txtOk = txtAnswers.some((v) => v.includes(row.verification_token));
    const cnameTarget = cnameAnswers.find((v) => v.toLowerCase().includes(CNAME_TARGET)) ?? cnameAnswers[0] ?? "";
    const cnameOk = !!cnameAnswers.find((v) => v.toLowerCase().includes(CNAME_TARGET));

    // Fallback: some registrars flatten subdomain CNAMEs into A records at edge.
    // If A record resolves to a Cloudflare/Sleepox-fronted IP, treat as OK.
    const aOk = aAnswers.length > 0 && cnameAnswers.length === 0
      ? await (async () => {
          // Look up A record of CNAME_TARGET; consider OK if they match.
          const targetA = await dohQuery(CNAME_TARGET, "A");
          return targetA.some((ip) => aAnswers.includes(ip));
        })()
      : false;

    const pointsOk = cnameOk || aOk;
    const provider = detectProvider(nsAnswers);

    const base = {
      txtOk,
      cnameOk: pointsOk,
      cnameTarget: cnameTarget || (aOk ? aAnswers[0] : ""),
      nameservers: nsAnswers,
      provider,
    };

    if (!txtOk && !pointsOk) {
      return {
        ok: false,
        message: "DNS records not detected yet. Add both records at your registrar and try again in 1–2 minutes.",
        ...base,
      };
    }
    if (!txtOk) {
      return {
        ok: false,
        message: `TXT record missing. Add TXT at "${txtName}" with value: ${row.verification_token}`,
        ...base,
      };
    }
    if (!pointsOk) {
      return {
        ok: false,
        message: `CNAME not pointing to ${CNAME_TARGET}. Add a CNAME at ${row.domain} → ${CNAME_TARGET}`,
        ...base,
      };
    }

    await supabase
      .from("custom_domains")
      .update({ verified: true, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", row.id);

    return { ok: true, message: "Domain verified successfully! You can now use it for your links.", ...base };
  });

export const deleteCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase
      .from("custom_domains")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
