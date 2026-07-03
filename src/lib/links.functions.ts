import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestAuth } from "@/lib/request-auth.server";

type LinkRow = {
  id: string;
  user_id: string;
  short_code: string;
  title: string | null;
  clicks_count: number | null;
  bot_clicks_count: number | null;
  created_at: string;
  adsterra_url?: string | null;
  safe_url?: string | null;
  is_active?: boolean | null;
  destination_url?: string | null;
  adsterra_direct_link?: string | null;
  status?: string | null;
  prelanding_template?: string | null;
  blocked_countries?: string[] | null;
};

export type DashboardLink = ReturnType<typeof normalizeLink>;

function normalizeLink(row: LinkRow) {
  return {
    ...row,
    adsterra_url: row.adsterra_url ?? row.adsterra_direct_link ?? row.destination_url ?? "",
    safe_url: row.safe_url ?? (row.adsterra_direct_link ? row.destination_url : "https://sleepox.com/") ?? "https://sleepox.com/",
    is_active: row.is_active ?? row.status === "active",
    blocked_countries: Array.isArray(row.blocked_countries) ? row.blocked_countries : [],
  };
}


async function selectLinks(supabase: any): Promise<{ data: DashboardLink[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("links")
    .select("*")
    .order("created_at", { ascending: false });
  
  if (error) return { data: null, error: { message: error.message } };
  return { data: (data ?? []).map((row: LinkRow) => normalizeLink(row)), error: null };
}

async function getProfileQuota(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan_slug, link_limit, links_used")
    .eq("id", userId)
    .single();
  if (error) return null;
  const plan = String(data?.plan_slug ?? "").toLowerCase();
  if (plan === "lifetime" || plan === "unlimited") {
    return { limit: null, used: data?.links_used ?? 0 };
  }
  return { limit: data?.link_limit ?? null, used: data?.links_used ?? 0 };
}

/**
 * Server-side guard: blocks banned users from any link mutation.
 * Even if the UI is bypassed, the server refuses the request.
 */
async function assertNotBanned(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("is_banned")
    .eq("id", userId)
    .single();
  if (data?.is_banned) {
    throw new Error("Your account has been suspended. Please contact support.");
  }
}

function randomCode(len = 6) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const listMyLinks = createServerFn({ method: "GET" })
  .handler(async () => {
    const context = await getRequestAuth();
    const { data, error } = await selectLinks(context.supabase);
    if (error) throw new Error(error.message);
    return data;
  });


export const getDashboardData = createServerFn({ method: "GET" })
  .handler(async () => {
    const context = await getRequestAuth();
    // M1/M2 fix: fetch links once, then use linksRes.data for daily_stats; cap window to 30 days
    const linksRes = await selectLinks(context.supabase);
    const linkIds = (linksRes.data ?? []).map((l: any) => l.id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [profileRes, statsRes, domainsRes, archivedRes] = await Promise.all([
      // M8 fix: explicit column list — never SELECT * on profiles for client payloads
      context.supabase.from("profiles").select(
        "id, email, full_name, plan_slug, link_limit, links_used, click_quota, clicks_used, ours_clicks, plan_expires_at, avatar_url, is_banned, clicks_period_start"
      ).eq("id", context.userId).single(),
      context.supabase.rpc("get_dashboard_stats" as never, { _user_id: context.userId } as never),
      context.supabase.from("custom_domains").select("domain").eq("user_id", context.userId).eq("verified", true),
      linkIds.length
        ? context.supabase.from("daily_stats").select("day, human_clicks").in("link_id", linkIds).gte("day", thirtyDaysAgo)
        : Promise.resolve({ data: [] as any[], error: null as any }),
    ]);
    if (linksRes.error) throw new Error(linksRes.error.message);
    if (profileRes.error) throw new Error(profileRes.error.message);

    const links = linksRes.data ?? [];
    const customDomains = (domainsRes.data ?? []).map((d: any) => d.domain);

    type DashStats = {
      clicksByDay: Record<string, number>;
      countryStats: Record<string, number>;
      mobilePct: number;
      uniqueVisitors: number;
      perLinkDaily: Record<string, number[]>;
    };
    const stats = (statsRes.data as DashStats | null) ?? {
      clicksByDay: {}, countryStats: {}, mobilePct: 0, uniqueVisitors: 0, perLinkDaily: {},
    };

    const perLinkDaily: Record<string, number[]> = {};
    for (const l of links) {
      const arr = stats.perLinkDaily?.[l.id];
      perLinkDaily[l.id] = Array.isArray(arr) && arr.length === 7
        ? arr.map(Number) : new Array(7).fill(0);
    }

    const clicksByDay: Record<string, number> = {};
    // Merge archived daily stats with live stats
    (archivedRes.data ?? []).forEach((row: any) => {
      const k = row.day;
      clicksByDay[k] = (clicksByDay[k] ?? 0) + Number(row.human_clicks ?? 0);
    });

    for (let i = 29; i >= 0; i--) {
      const k = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      clicksByDay[k] = (clicksByDay[k] ?? 0) + Number(stats.clicksByDay?.[k] ?? 0);
    }

    return {
      links,
      customDomains,
      profile: profileRes.data,
      stats: {
        clicksByDay,
        countryStats: stats.countryStats ?? {},
        mobilePct: Number(stats.mobilePct ?? 0),
        uniqueVisitors: Number(stats.uniqueVisitors ?? 0),
        perLinkDaily,
      },
    };
  });

export const createLink = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      title: z.string().max(200).optional(),
      adsterra_url: z.string().url(),
      safe_url: z.string().url().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    await assertNotBanned(context.supabase, context.userId);
    const profile = await getProfileQuota(context.supabase, context.userId);
    if (profile && profile.limit !== null && profile.used >= profile.limit) {
      throw new Error(`Link limit reached (${profile.used}/${profile.limit}). Please upgrade.`);
    }

    let code = randomCode();
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await context.supabase
        .from("links").select("id").eq("short_code", code).maybeSingle();
      if (!exists) break;
      code = randomCode();
    }

    const safeUrlToStore = data.safe_url ?? "https://sleepox.com/";

    const { data: linkData, error } = await context.supabase
      .from("links")
      .insert({
        user_id: context.userId,
        short_code: code,
        title: data.title ?? null,
        destination_url: safeUrlToStore,
        adsterra_url: data.adsterra_url,
        safe_url: safeUrlToStore,
        status: "active",
        // Auto-shield US by default — FB ad reviewers concentrate in US datacenters.
        // Users can remove via Country Shield dialog on the dashboard.
        blocked_countries: ["US"],
      } as never)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return normalizeLink(linkData as LinkRow);
  });

export const deleteLink = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    await assertNotBanned(context.supabase, context.userId);
    const { data: link, error: lookupError } = await context.supabase
      .from("links")
      .select("id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!link) throw new Error("Link not found");

    const { error } = await context.supabase.from("links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleLink = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    await assertNotBanned(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("links")
      .update({ 
        is_active: data.is_active,
        status: data.is_active ? "active" : "paused"
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// COUNTRY SHIELD — paid-only feature. Users on `monthly` or `lifetime` plans
// can block specific countries per link. Visitors from those countries are
// forced to the safe/article page (offer URL never served).
const ISO_COUNTRY = /^[A-Z]{2}$/;
export const updateBlockedCountries = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      countries: z.array(z.string().length(2)).max(60),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const context = await getRequestAuth();
    await assertNotBanned(context.supabase, context.userId);

    // Plan gate
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("plan_slug")
      .eq("id", context.userId)
      .single();
    if (pErr) throw new Error(pErr.message);
    const plan = String((profile as any)?.plan_slug ?? "free").toLowerCase();
    if (plan !== "monthly" && plan !== "lifetime" && plan !== "unlimited") {
      throw new Error("Country Shield is a Pro feature. Please upgrade to Monthly or Lifetime.");
    }

    // Normalize + dedupe
    const cleaned = Array.from(
      new Set(
        data.countries
          .map((c) => c.trim().toUpperCase())
          .filter((c) => ISO_COUNTRY.test(c)),
      ),
    );

    const { data: updatedLink, error } = await (context.supabase as any)
      .from("links")
      .update({ blocked_countries: cleaned })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("short_code")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const shortCode = String(updatedLink?.short_code ?? "").trim();
    if (shortCode) {
      const { redisDel } = await import("@/lib/redis-cache.server");
      await redisDel(`rd:link:${shortCode}`);
    }

    return { ok: true, countries: cleaned };
  });

