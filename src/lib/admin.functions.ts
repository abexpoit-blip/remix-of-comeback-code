import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

type PackageQuota = {
  slug: string;
  click_quota: number | null;
  link_limit: number | null;
};

async function applyPackageToProfileIds(userIds: string[], pkg: PackageQuota) {
  const ids = [...new Set(userIds)];
  const now = new Date();
  const resetAt = now.toISOString();
  const nowMs = now.getTime();
  const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
  const isLifetime = pkg.slug === "lifetime" || pkg.slug === "unlimited";
  const isFree = pkg.slug === "free";

  const { data: profiles, error: fetchErr } = await supabaseAdmin
    .from("profiles")
    .select("id, plan_slug, plan_expires_at, click_quota")
    .in("id", ids);
  if (fetchErr) throw new Error(fetchErr.message);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  // Renewal = same paid plan that is still active → stack days + stack quota.
  const isRenewal = (profile: any) => {
    if (isFree || isLifetime) return false;
    if (profile?.plan_slug !== pkg.slug) return false;
    const expiry = profile?.plan_expires_at ? new Date(profile.plan_expires_at).getTime() : null;
    return expiry != null && !Number.isNaN(expiry) && expiry > nowMs;
  };

  for (const id of ids) {
    const profile = profileMap.get(id);
    const renewal = isRenewal(profile);

    let update: Record<string, unknown>;

    if (renewal) {
      const currentExpiry = new Date(profile.plan_expires_at).getTime();
      update = {
        plan_slug: pkg.slug,
        click_quota:
          pkg.click_quota == null ? null : Number(profile?.click_quota ?? 0) + Number(pkg.click_quota),
        link_limit: pkg.link_limit,
        plan_expires_at: new Date(currentExpiry + PERIOD_MS).toISOString(),
      };
    } else {
      update = {
        plan_slug: pkg.slug,
        click_quota: pkg.click_quota,
        link_limit: pkg.link_limit,
        clicks_used: 0,
        clicks_period_start: resetAt,
        // Manual admin upgrades must also carry a visible start/expiry date,
        // otherwise the control panel shows "—" for the plan period.
        plan_started_at: isFree ? null : resetAt,
        plan_expires_at: isFree || isLifetime ? null : new Date(nowMs + PERIOD_MS).toISOString(),
      };
    }

    const { error } = await supabaseAdmin.from("profiles").update(update as any).eq("id", id);
    if (error) throw new Error(error.message);
  }
}




export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    
    // Auto-expire old pending requests (> 30 minutes) to keep counts accurate
    const expiryCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("upgrade_requests")
      .update({ status: "expired" } as any)
      .eq("status", "pending")
      .lt("created_at", expiryCutoff);

    // Use UTC midnight for Today stats to be accurate
    const now = new Date();
    const todayISO = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    
    const [
      { count: users },
      { count: links },
      { data: globalClicks },
      { count: pending },
      { count: bannedUsers },
      { count: activeLinks },
      { count: todayTotal, error: todayTotalErr },
      { count: todayOursRaw, error: todayOursErr },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("links").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("links").select("clicks_count, ours_clicks_count, offer_clicks_count, bot_clicks_count"),
      supabaseAdmin.from("upgrade_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("is_banned", true),
      supabaseAdmin.from("links").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", todayISO),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).eq("routed_to", "ours").gte("created_at", todayISO),
    ]);

    if (todayTotalErr) console.error("[adminStats] today_total count failed:", todayTotalErr.message);
    if (todayOursErr) console.error("[adminStats] today_ours count failed:", todayOursErr.message);

    // The routed_to='ours' count is unindexed and can time out on high-traffic
    // days, which silently rendered "Today ours = 0". Fall back to the
    // pre-aggregated timeseries RPC so the card stays accurate.
    let todayOurs = todayOursRaw ?? 0;
    if (todayOursErr || todayOursRaw === null || (todayOurs === 0 && (todayTotal ?? 0) > 0)) {
      const { data: series, error: seriesErr } = await supabaseAdmin.rpc(
        "admin_clicks_timeseries" as never,
        { _days: 1 } as never,
      );
      if (seriesErr) {
        console.error("[adminStats] today_ours fallback failed:", seriesErr.message);
      } else {
        const rows = (series ?? []) as Array<{ date: string; ours: number }>;
        const todayKey = todayISO.slice(0, 10);
        const row = rows.find((r) => String(r.date).slice(0, 10) === todayKey) ?? rows[rows.length - 1];
        if (row && Number(row.ours) > 0) todayOurs = Number(row.ours);
      }
    }

    const globalClicksData = globalClicks ?? [];

    
    // Aggregating human clicks from the links table summary
    const humansTotalFromLinks = globalClicksData.reduce((s, l: any) => s + (Number(l.clicks_count) || 0), 0);
    const oursTotalFromLinks = globalClicksData.reduce((s, l: any) => s + (Number(l.ours_clicks_count) || 0), 0);
    const botsTotalFromLinks = globalClicksData.reduce((s, l: any) => s + (Number(l.bot_clicks_count) || 0), 0);
    const offerTotalFromLinks = globalClicksData.reduce((s, l: any) => s + (Number(l.offer_clicks_count) || 0), 0);

    // EMERGENCY FALLBACK: If link summary is 0 but we know there are clicks, query the clicks table directly
    // This solves the issue if the linking columns like 'ours_clicks_count' haven't updated yet.
    let humansTotal = humansTotalFromLinks;
    let oursTotal = oursTotalFromLinks;
    let botsTotal = botsTotalFromLinks;
    let offerTotal = offerTotalFromLinks;

    if (humansTotal === 0) {
      const { count: absoluteTotal } = await supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).eq("is_bot", false);
      const { count: absoluteOurs } = await supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).eq("is_bot", false).eq("routed_to", "ours");
      const { count: absoluteBots } = await supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).eq("is_bot", true);
      
      if ((absoluteTotal ?? 0) > 0) {
        humansTotal = absoluteTotal ?? 0;
        oursTotal = absoluteOurs ?? 0;
        botsTotal = absoluteBots ?? 0;
        offerTotal = (absoluteTotal ?? 0) - (absoluteOurs ?? 0);
      }
    }

    const monthISO = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: paidRows } = await supabaseAdmin
      .from("upgrade_requests")
      .select("amount")
      .or("status.eq.paid,status.eq.completed,status.eq.success,status.eq.finished")
      .gte("created_at", monthISO);
    const mrr = (paidRows ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
    const { data: allPaid } = await supabaseAdmin
      .from("upgrade_requests")
      .select("amount")
      .or("status.eq.paid,status.eq.completed,status.eq.success,status.eq.finished");

    const totalRevenue = (allPaid ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);

    return {
      users: users ?? 0,
      links: links ?? 0,
      active_links: activeLinks ?? 0,
      clicks: humansTotal,
      pending: pending ?? 0,
      ours: oursTotal,
      offer: offerTotal,
      bots: botsTotal,
      today_total: todayTotal ?? 0,
      today_ours: todayOurs ?? 0,
      banned_users: bannedUsers ?? 0,
      mrr_30d: mrr,
      total_revenue: totalRevenue,
    };
  });

export const adminClicksTimeseries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("admin_clicks_timeseries" as never, { _days: 14 } as never);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ date: string; total: number; ours: number; offer: number; bots: number }>;
  });

export const adminTopCountries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("admin_top_countries" as never, { _days: 7, _limit: 12 } as never);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ country: string; count: number }>;
  });


export const adminTopUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    // Aggregate from links table for dashboard ranking; quota usage lives in
    // profiles.clicks_used and must not be recomputed from resettable counters.
    const { data: links } = await supabaseAdmin
      .from("links")
      .select("user_id, clicks_count, bot_clicks_count, ours_clicks_count");
    const totals: Record<string, { humans: number; bots: number; ours: number }> = {};
    (links ?? []).forEach((l: any) => {
      if (!l.user_id) return;
      const t = (totals[l.user_id] ||= { humans: 0, bots: 0, ours: 0 });
      t.humans += l.clicks_count ?? 0;
      t.bots += l.bot_clicks_count ?? 0;
      t.ours += l.ours_clicks_count ?? 0;
    });
    const topIds = Object.entries(totals)
      .sort((a, b) => b[1].humans - a[1].humans)
      .slice(0, 10)
      .map(([id]) => id);
    if (topIds.length === 0) return [];
    const { data: profs } = await supabaseAdmin
      .from("profiles").select("id, email, plan_slug").in("id", topIds);
    return topIds.map((id) => {
      const p = (profs ?? []).find((x: any) => x.id === id) || { id, email: "(unknown)", plan_slug: null };
      return { ...p, clicks_used: totals[id].humans, bot_clicks: totals[id].bots, ours_clicks: totals[id].ours };
    });
  });

export const adminRevenueTimeseries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ days: z.number().optional().default(30) }).parse(d))
  .handler(async ({ data: input, context }) => {
    await assertAdmin(context.userId);
    const days = input.days;
    const fromISO = new Date(Date.now() - days * 86_400_000).toISOString();
    
    // Updated to include all success statuses
    const { data } = await supabaseAdmin
      .from("upgrade_requests")
      .select("created_at, amount, status")
      .gte("created_at", fromISO)
      .or("status.eq.paid,status.eq.completed,status.eq.success,status.eq.finished");

    const buckets: Record<string, { date: string; revenue: number; count: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      buckets[d] = { date: d, revenue: 0, count: 0 };
    }
    
    (data ?? []).forEach((r: any) => {
      const d = (r.created_at as string).slice(0, 10);
      if (!buckets[d]) return;
      buckets[d].revenue += Number(r.amount || 0);
      buckets[d].count++;
    });
    return Object.values(buckets);
  });


export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("profiles").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    const oursByUser: Record<string, number> = {};
    const { data: linkRows } = await supabaseAdmin.from("links").select("user_id, ours_clicks_count");
    (linkRows ?? []).forEach((l: any) => {
      oursByUser[l.user_id] = (oursByUser[l.user_id] ?? 0) + (l.ours_clicks_count ?? 0);
    });
    return (data ?? []).map((u: any) => ({ ...u, ours_clicks: oursByUser[u.id] ?? 0 }));
  });

export const adminBanUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_banned: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("profiles").update({ is_banned: data.is_banned } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminBulkBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500), is_banned: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("profiles").update({ is_banned: data.is_banned } as any).in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, updated: data.ids.length };
  });

export const adminResetUserQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ clicks_used: 0, clicks_period_start: new Date().toISOString() } as any)
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, updated: data.ids.length };
  });

export const adminBulkSetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500), package_slug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: pkg } = await supabaseAdmin
      .from("packages").select("*").eq("slug", data.package_slug).maybeSingle();
    if (!pkg) throw new Error("Package not found");
    await applyPackageToProfileIds(data.ids, pkg);
    return { ok: true, updated: data.ids.length };
  });

// Repair paid-plan quota drift without applying/renewing a package. The expected
// quota is derived from successful payments in the current plan cycle, so this
// operation is idempotent: clicking it repeatedly cannot add quota or plan days.
export const adminFixUnlimitedMonthly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [{ data: packages, error: pkgErr }, { data: profiles, error: profileErr }, { data: paidOrders, error: orderErr }] = await Promise.all([
      supabaseAdmin.from("packages").select("slug, click_quota, link_limit"),
      supabaseAdmin
        .from("profiles")
        .select("id, plan_slug, plan_started_at, plan_expires_at, click_quota, link_limit")
        .neq("plan_slug", "free"),
      supabaseAdmin
        .from("upgrade_requests")
        .select("user_id, package_slug, status, created_at")
        .in("status", ["paid", "completed", "success", "finished"]),
    ]);
    if (pkgErr) throw new Error(pkgErr.message);
    if (profileErr) throw new Error(profileErr.message);
    if (orderErr) throw new Error(orderErr.message);

    const packageMap = new Map((packages ?? []).map((pkg: any) => [pkg.slug, pkg]));
    const ordersByUser = new Map<string, any[]>();
    for (const order of paidOrders ?? []) {
      const list = ordersByUser.get((order as any).user_id) ?? [];
      list.push(order);
      ordersByUser.set((order as any).user_id, list);
    }

    let fixed = 0;
    for (const profile of profiles ?? []) {
      const pkg = packageMap.get((profile as any).plan_slug) as any;
      if (!pkg) continue;

      const isUnlimited = pkg.slug === "lifetime" || pkg.slug === "unlimited" || pkg.click_quota == null;
      const startedMs = (profile as any).plan_started_at ? Date.parse((profile as any).plan_started_at) : Number.NaN;
      // Invoice rows are created shortly before plan_started_at is written by
      // the paid callback. Include a 24-hour margin so the first payment in the
      // current cycle is not accidentally excluded.
      const cycleCutoff = Number.isNaN(startedMs) ? Number.NEGATIVE_INFINITY : startedMs - 86_400_000;
      const successfulPayments = (ordersByUser.get((profile as any).id) ?? []).filter((order: any) =>
        order.package_slug === pkg.slug && Date.parse(order.created_at) >= cycleCutoff,
      ).length;
      const entitledPeriods = Math.max(1, successfulPayments);
      const expectedClickQuota = isUnlimited ? null : Number(pkg.click_quota) * entitledPeriods;
      const expectedLinkLimit = isUnlimited ? null : pkg.link_limit;
      const expectedExpiry = isUnlimited
        ? null
        : Number.isNaN(startedMs)
          ? (profile as any).plan_expires_at
          : new Date(startedMs + entitledPeriods * 30 * 86_400_000).toISOString();
      const expiryMatches = isUnlimited
        ? (profile as any).plan_expires_at == null
        : Number.isNaN(startedMs) || Date.parse((profile as any).plan_expires_at) === Date.parse(expectedExpiry);

      if (
        (profile as any).click_quota === expectedClickQuota &&
        (profile as any).link_limit === expectedLinkLimit &&
        expiryMatches
      ) continue;

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          click_quota: expectedClickQuota,
          link_limit: expectedLinkLimit,
          plan_expires_at: expectedExpiry,
        } as any)
        .eq("id", (profile as any).id);
      if (error) throw new Error(error.message);
      fixed++;
    }

    return { ok: true, fixed, scanned: profiles?.length ?? 0 };
  });

export const adminUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const [{ data: profile }, { data: links }, { data: payments }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("links").select("*").eq("user_id", data.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("upgrade_requests").select("*").eq("user_id", data.id).order("created_at", { ascending: false }).limit(50),
    ]);
    const linkIds = (links ?? []).map((l: any) => l.id);
    let trend: { date: string; clicks: number; bots: number }[] = [];
    if (linkIds.length) {
      const { data: trendData } = await supabaseAdmin.rpc("admin_user_trend" as never, { _user_id: data.id, _days: 7 } as never);
      trend = ((trendData ?? []) as Array<{ date: string; clicks: number; bots: number }>);
    }

    return { profile, links: links ?? [], payments: payments ?? [], trend };
  });

export const adminSetUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), package_slug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: pkg } = await supabaseAdmin
      .from("packages").select("*").eq("slug", data.package_slug).maybeSingle();
    if (!pkg) throw new Error("Package not found");
    await applyPackageToProfileIds([data.user_id], pkg);
    return { ok: true };
  });

export const adminListPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("packages").select("*").eq("is_active", true).order("sort_order");
    if (error) throw new Error(error.message);
    return data;
  });

export const adminListAllPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("packages").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
    name: z.string().min(1).max(120),
    price_usd: z.number().min(0).max(100000),
    click_quota: z.number().int().min(0).nullable(),
    link_limit: z.number().int().min(0).nullable(),
    sort_order: z.number().int().min(0).max(1000),
    is_active: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const payload: any = {
      slug: data.slug,
      name: data.name,
      price_usd: data.price_usd,
      price_monthly: data.price_usd,
      click_quota: data.click_quota,
      link_limit: data.link_limit,
      sort_order: data.sort_order,
      is_active: data.is_active,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("packages").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("packages").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListUpgradeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    
    // Auto-expire old pending requests (> 30 minutes) as requested
    const expiryCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("upgrade_requests")
      .update({ status: "expired" } as any)
      .eq("status", "pending")
      .lt("created_at", expiryCutoff);

    const { data, error } = await supabaseAdmin
      .from("upgrade_requests")
      .select("id, user_id, package_slug, amount, status, plisio_invoice_id, plisio_invoice_url, created_at")
      .order("created_at", { ascending: false })

      .limit(500);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
    let emailMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, email").in("id", ids);
      emailMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email ?? ""]));
    }
    return (data ?? []).map((r: any) => ({ ...r, email: emailMap[r.user_id] ?? "" }));
  });


export const adminDecideUpgradeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), decision: z.enum(["approve", "reject"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: req, error: rErr } = await supabaseAdmin
      .from("upgrade_requests").select("*").eq("id", data.id).maybeSingle();
    if (rErr || !req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error(`Request already ${req.status}`);

    if (data.decision === "reject") {
      const { error } = await supabaseAdmin.from("upgrade_requests").update({ status: "rejected" } as any).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { data: pkg } = await supabaseAdmin.from("packages").select("*").eq("slug", req.package_slug).maybeSingle();
    if (!pkg) throw new Error("Package not found");

    const { error: uErr } = await supabaseAdmin
      .from("upgrade_requests").update({ status: "paid" } as any).eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    await applyPackageToProfileIds([req.user_id], pkg);

    return { ok: true };
  });

export const adminListLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, email");
    const emailMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.email]));
    
    const { data, error } = await supabaseAdmin
      .from("links")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    
    return (data ?? []).map((l: any) => ({
      ...l,
      owner_email: emailMap[l.user_id] ?? "unknown"
    }));
  });

export const adminToggleLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("links")
      .update({ is_active: data.is_active, status: data.is_active ? "active" : "paused" } as any)
      .eq("id", data.id)
      .select("short_code")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { invalidateLinkCache } = await import("@/lib/link-cache.server");
    await invalidateLinkCache((row as any)?.short_code);
    return { ok: true };
  });

// Partial update: the Control Panel edits one field at a time (destination only,
// safe URL only, ...). Requiring every field made those edits fail validation.
export const adminUpdateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        id: z.string().uuid(),
        title: z.string().nullable().optional(),
        adsterra_url: z.string().url().optional(),
        safe_url: z.string().url().optional(),
      })
      .parse,
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.adsterra_url !== undefined) {
      patch.adsterra_url = data.adsterra_url;
      // Legacy column kept in sync so older redirect paths resolve the new URL.
      patch.adsterra_direct_link = data.adsterra_url;
    }
    if (data.safe_url !== undefined) {
      patch.safe_url = data.safe_url;
      patch.destination_url = data.safe_url;
    }
    if (Object.keys(patch).length === 0) throw new Error("Nothing to update");

    const { data: row, error } = await supabaseAdmin
      .from("links")
      .update(patch as any)
      .eq("id", data.id)
      .select("short_code")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { invalidateLinkCache } = await import("@/lib/link-cache.server");
    await invalidateLinkCache((row as any)?.short_code);
    return { ok: true, short_code: (row as any)?.short_code ?? null };
  });

export const adminDeleteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: row } = await supabaseAdmin
      .from("links").select("short_code").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin.from("links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    const { invalidateLinkCache } = await import("@/lib/link-cache.server");
    await invalidateLinkCache((row as any)?.short_code);
    return { ok: true };
  });


export const adminListBotRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("bot_rules").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertBotRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid().optional(), rule_type: z.string(), pattern: z.string(), label: z.string().nullable(), is_active: z.boolean() }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("bot_rules").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("bot_rules").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteBotRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("bot_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListCloakingRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("cloaking_rules").select("*").order("priority");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertCloakingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid().optional(), rule_type: z.string(), pattern: z.string(), label: z.string().nullable(), action: z.string(), priority: z.number(), is_active: z.boolean() }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("cloaking_rules").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("cloaking_rules").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteCloakingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("cloaking_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListCountryTiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("country_tiers").select("*").order("tier");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertCountryTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ country_code: z.string(), tier: z.number(), country_name: z.string().nullable() }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("country_tiers").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCountryTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ country_code: z.string() }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("country_tiers").delete().eq("country_code", data.country_code);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminImpersonate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: target } = await supabaseAdmin.from("profiles").select("*").eq("id", data.user_id).single();
    if (!target) throw new Error("Target user not found");

    // Generate a secure one-time magic link token for the target user
    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: target.email!,
    });

    if (error) throw new Error(error.message);

    return { 
      hashed_token: linkData.properties.hashed_token, 
      target: { 
        id: target.id, 
        email: target.email || "unknown", 
        full_name: target.full_name 
      } 
    };
  });

export const adminListErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("error_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const adminErrorStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("error_logs").select("source, level, is_resolved, created_at");
    if (error) throw new Error(error.message);
    
    const now = Date.now();
    const last24h = (data ?? []).filter(e => now - new Date(e.created_at).getTime() < 86400000);
    const bySource: Record<string, number> = {};
    (data ?? []).forEach(e => bySource[e.source] = (bySource[e.source] || 0) + 1);
    
    return {
      total: data?.length || 0,
      open: data?.filter(e => !e.is_resolved).length || 0,
      last24h: last24h.length,
      bySource
    };
  });

export const adminResolveError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), is_resolved: z.boolean() }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("error_logs").update({ is_resolved: data.is_resolved } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("error_logs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminClearResolvedErrors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("error_logs").delete().eq("is_resolved", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetInactiveUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("admin_get_inactive_users" as never);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminRunMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.rpc("maintenance_purge_old_clicks" as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Returns counts of rows eligible for purge (for progress bar baseline)
export const adminGetPurgeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const clicksCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const errorsCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ count: oldClicks }, { count: oldErrors }] = await Promise.all([
      supabaseAdmin.from("clicks").select("id", { count: "exact", head: true }).lt("created_at", clicksCutoff),
      supabaseAdmin.from("error_logs").select("id", { count: "exact", head: true }).lt("created_at", errorsCutoff),
    ]);
    return { oldClicks: oldClicks ?? 0, oldErrors: oldErrors ?? 0 };
  });

// Deletes ONE batch of old rows. Client calls in a loop until done=true.
export const adminPurgeBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    target: z.enum(["clicks", "errors"]),
    batchSize: z.number().int().min(100).max(10000).default(2000),
  }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const table = data.target === "clicks" ? "clicks" : "error_logs";
    const days = data.target === "clicks" ? 7 : 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error: selErr } = await supabaseAdmin
      .from(table)
      .select("id")
      .lt("created_at", cutoff)
      .limit(data.batchSize);
    if (selErr) throw new Error(selErr.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    if (ids.length === 0) return { deleted: 0, done: true };

    const { error: delErr } = await supabaseAdmin.from(table).delete().in("id", ids);
    if (delErr) throw new Error(delErr.message);

    return { deleted: ids.length, done: ids.length < data.batchSize };
  });

export const adminDeleteUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    let deleted = 0;
    const errors: string[] = [];

    for (const id of data.ids) {
      // 1. Wipe dependent rows first (FKs without cascade would block profile/auth delete)
      const linkIds = ((await supabaseAdmin.from("links").select("id").eq("user_id", id)).data ?? []).map(
        (l) => l.id as string,
      );
      if (linkIds.length) {
        await supabaseAdmin.from("clicks").delete().in("link_id", linkIds);
      }
      await supabaseAdmin.from("links").delete().eq("user_id", id);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
      await supabaseAdmin.from("upgrade_requests").delete().eq("user_id", id);
      await supabaseAdmin.from("custom_domains").delete().eq("user_id", id);

      // 2. Delete profile row
      const { error: pErr } = await supabaseAdmin.from("profiles").delete().eq("id", id);
      if (pErr) errors.push(`profile ${id}: ${pErr.message}`);

      // 3. Delete the auth.users row — THIS was missing before.
      //    Without it the handle_new_user trigger could re-create the profile on next session,
      //    and even if not, the user still existed in auth and appeared on next list refresh.
      const { error: aErr } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (aErr) errors.push(`auth ${id}: ${aErr.message}`);

      if (!pErr && !aErr) deleted++;
    }

    if (errors.length && deleted === 0) {
      throw new Error(errors.slice(0, 3).join(" | "));
    }
    return { ok: errors.length === 0, deleted, failed: errors.length, errors: errors.slice(0, 5) };
  });
// ===== Mini-dashboard for Control Panel — last 24h live stats =====
export const adminTrafficSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [
      { count: total24h },
      { count: humans24h },
      { count: bots24h },
      { count: offer24h },
      { count: ours24h },
      { count: safe24h },
      { count: total1h },
      { count: humans1h },
      { data: reasonsData },
      { data: fbBlockedData },
    ] = await Promise.all([
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", since).eq("is_bot", false),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", since).eq("is_bot", true),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", since).eq("routed_to", "offer").eq("is_bot", false),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", since).eq("routed_to", "ours").eq("is_bot", false),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", since).eq("routed_to", "safe"),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", since1h),
      supabaseAdmin.from("clicks").select("*", { count: "exact", head: true }).gte("created_at", since1h).eq("is_bot", false),
      supabaseAdmin.rpc("admin_bot_reasons" as never, { _hours: 24, _limit: 6 } as never),
      supabaseAdmin.rpc("admin_fb_blocked_count" as never, { _hours: 24 } as never),
    ]);

    const topReasons = ((reasonsData ?? []) as Array<{ key: string; count: number }>).map((r) => ({ key: r.key, count: Number(r.count) }));
    const fbBlocked = Number(fbBlockedData ?? 0);

    const t24 = total24h ?? 0;
    const h24 = humans24h ?? 0;
    const b24 = bots24h ?? 0;
    const o24 = offer24h ?? 0;

    return {
      total24h: t24,
      humans24h: h24,
      bots24h: b24,
      offer24h: o24,
      ours24h: ours24h ?? 0,
      safe24h: safe24h ?? 0,
      total1h: total1h ?? 0,
      humans1h: humans1h ?? 0,
      humanPct: t24 > 0 ? Math.round((h24 / t24) * 100) : 0,
      botPct: t24 > 0 ? Math.round((b24 / t24) * 100) : 0,
      offerSuccessPct: h24 > 0 ? Math.round((o24 / h24) * 100) : 0,
      fbCrawlerBlocked: fbBlocked,
      topBotReasons: topReasons,
    };
  });


// ===== Reset ALL clicks (admin) =====
export const adminResetAllClicks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("reset_all_clicks" as never);
    if (error) throw new Error(error.message);
    return data ?? { ok: true };
  });

// ===== Quota Sync: Read-only verification for one user/package =====
export const adminTestQuotaSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      email: z.string().email(),
      package_slug: z.string().min(1).max(64),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const startedAt = new Date().toISOString();
    const log: string[] = [];
    const push = (msg: string) => log.push(`[${new Date().toISOString()}] ${msg}`);

    push(`Looking up user by email: ${data.email}`);
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, plan_slug, click_quota, link_limit, clicks_used, plan_started_at, plan_expires_at")
      .ilike("email", data.email)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) {
      push(`❌ User not found.`);
      return { ok: false, log, before: null, expected: null, after: null, pass: false, startedAt };
    }
    push(`✅ Found user id=${profile.id}, current plan=${profile.plan_slug}`);

    const { data: pkg, error: kErr } = await supabaseAdmin
      .from("packages").select("slug, click_quota, link_limit").eq("slug", data.package_slug).maybeSingle();
    if (kErr) throw new Error(kErr.message);
    if (!pkg) {
      push(`❌ Package "${data.package_slug}" not found.`);
      return { ok: false, log, before: profile, expected: null, after: null, pass: false, startedAt };
    }
    const { data: paidOrders, error: orderErr } = await supabaseAdmin
      .from("upgrade_requests")
      .select("package_slug, status, created_at")
      .eq("user_id", profile.id)
      .eq("package_slug", pkg.slug)
      .in("status", ["paid", "completed", "success", "finished"]);
    if (orderErr) throw new Error(orderErr.message);

    const startedMs = profile.plan_started_at ? Date.parse(profile.plan_started_at) : Number.NaN;
    const cycleCutoff = Number.isNaN(startedMs) ? Number.NEGATIVE_INFINITY : startedMs - 86_400_000;
    const successfulPayments = (paidOrders ?? []).filter((order: any) => Date.parse(order.created_at) >= cycleCutoff).length;
    const entitledPeriods = Math.max(1, successfulPayments);
    const unlimitedPlan = pkg.slug === "lifetime" || pkg.slug === "unlimited" || pkg.click_quota == null;
    const expectedClickQuota = unlimitedPlan ? null : Number(pkg.click_quota) * entitledPeriods;
    const expectedLinkLimit = unlimitedPlan ? null : pkg.link_limit;
    push(`📦 Package "${pkg.slug}" has ${successfulPayments} successful payment(s) in this cycle; expected click_quota=${expectedClickQuota}, link_limit=${expectedLinkLimit}`);

    const before = {
      plan_slug: profile.plan_slug,
      click_quota: profile.click_quota,
      link_limit: profile.link_limit,
      clicks_used: profile.clicks_used,
    };
    push(`BEFORE → plan=${before.plan_slug}, click_quota=${before.click_quota}, link_limit=${before.link_limit}, clicks_used=${before.clicks_used}`);

    push(`🔒 Read-only verification — no package, quota, usage, or expiry fields were changed.`);
    const after = profile;
    push(`AFTER  → plan=${after?.plan_slug}, click_quota=${after?.click_quota}, link_limit=${after?.link_limit}, clicks_used=${after?.clicks_used}`);

    const planOk = after?.plan_slug === pkg.slug;
    const cqOk = after?.click_quota === expectedClickQuota;
    const llOk = after?.link_limit === expectedLinkLimit;
    const pass = planOk && cqOk && llOk;

    push(planOk ? `✅ plan_slug matches` : `❌ plan_slug mismatch (got ${after?.plan_slug}, expected ${pkg.slug})`);
    push(cqOk ? `✅ click_quota matches (${expectedClickQuota})` : `❌ click_quota mismatch (got ${after?.click_quota}, expected ${expectedClickQuota})`);
    push(llOk ? `✅ link_limit matches (${expectedLinkLimit})` : `❌ link_limit mismatch (got ${after?.link_limit}, expected ${expectedLinkLimit})`);
    push(pass ? `🎉 PASS — Quota sync is working correctly.` : `🚨 FAIL — Quota sync did NOT produce expected values.`);

    return {
      ok: true,
      pass,
      startedAt,
      before,
      expected: { plan_slug: pkg.slug, click_quota: expectedClickQuota, link_limit: expectedLinkLimit },
      after: {
        plan_slug: after?.plan_slug ?? null,
        click_quota: after?.click_quota ?? null,
        link_limit: after?.link_limit ?? null,
        clicks_used: after?.clicks_used ?? null,
      },
      log,
    };
  });

// ===== Quota Sync: Status of all paid users =====
export const adminQuotaSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: packages, error: pkgErr } = await supabaseAdmin
      .from("packages")
      .select("slug, click_quota, link_limit");
    if (pkgErr) throw new Error(pkgErr.message);
    const pkgMap = new Map<string, { click_quota: number | null; link_limit: number | null }>();
    for (const p of packages ?? []) {
      pkgMap.set((p as any).slug, { click_quota: (p as any).click_quota, link_limit: (p as any).link_limit });
    }

    const [{ data: profiles, error: prErr }, { data: paidOrders, error: orderErr }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, email, plan_slug, plan_started_at, click_quota, link_limit, clicks_used, plan_expires_at")
        .neq("plan_slug", "free")
        .order("plan_slug", { ascending: true }),
      supabaseAdmin
        .from("upgrade_requests")
        .select("user_id, package_slug, status, created_at")
        .in("status", ["paid", "completed", "success", "finished"]),
    ]);
    if (prErr) throw new Error(prErr.message);
    if (orderErr) throw new Error(orderErr.message);

    const ordersByUser = new Map<string, any[]>();
    for (const order of paidOrders ?? []) {
      const list = ordersByUser.get((order as any).user_id) ?? [];
      list.push(order);
      ordersByUser.set((order as any).user_id, list);
    }

    const rows = (profiles ?? []).map((p: any) => {
      const unlimitedPlan = p.plan_slug === "unlimited" || p.plan_slug === "lifetime";
      const exp = pkgMap.get(p.plan_slug);
      const startedMs = p.plan_started_at ? Date.parse(p.plan_started_at) : Number.NaN;
      const cycleCutoff = Number.isNaN(startedMs) ? Number.NEGATIVE_INFINITY : startedMs - 86_400_000;
      const successfulPayments = (ordersByUser.get(p.id) ?? []).filter((order: any) =>
        order.package_slug === p.plan_slug && Date.parse(order.created_at) >= cycleCutoff,
      ).length;
      const entitledPeriods = Math.max(1, successfulPayments);
      const expectedQuota = unlimitedPlan || exp?.click_quota == null
        ? null
        : Number(exp.click_quota) * entitledPeriods;
      const expectedLinks = unlimitedPlan ? null : (exp?.link_limit ?? null);
      const cqOk = p.click_quota === expectedQuota;
      const llOk = p.link_limit === expectedLinks;
      return {
        id: p.id,
        email: p.email,
        plan_slug: p.plan_slug,
        click_quota: p.click_quota,
        link_limit: p.link_limit,
        clicks_used: p.clicks_used,
        plan_expires_at: p.plan_expires_at,
        expected_click_quota: expectedQuota,
        expected_link_limit: expectedLinks,
        paid_orders: successfulPayments,
        entitled_periods: entitledPeriods,
        ok: cqOk && llOk,
        issue: !cqOk && !llOk ? "click_quota + link_limit mismatch"
          : !cqOk ? "click_quota mismatch"
          : !llOk ? "link_limit mismatch"
          : null,
      };
    });

    const summary = {
      total: rows.length,
      ok: rows.filter(r => r.ok).length,
      mismatches: rows.filter(r => !r.ok).length,
      byPlan: rows.reduce((acc: Record<string, number>, r) => {
        acc[r.plan_slug] = (acc[r.plan_slug] ?? 0) + 1;
        return acc;
      }, {}),
    };

    return { summary, rows };
  });
