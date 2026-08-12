import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Copy, Trash2, Play, Pause, Plus, Search, ArrowRight, LifeBuoy,
  TrendingUp, Filter, RefreshCw, ChevronRight, Smartphone, Globe, Shield, ShieldCheck,
  Crown, Gem, Star
} from "lucide-react";


import { getDashboardData, refreshDashboardData, createLink, deleteLink, toggleLink } from "@/lib/links.functions";

import { getPrimaryShortenerDomain } from "@/lib/shortener-domains.functions";
import { isFlaggedShortDomain } from "@/lib/short-domains";
import { getClickResetNotice, dismissClickResetNotice } from "@/lib/click-reset.functions";
import { BroadcastBell } from "@/components/broadcast-bell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button as UIButton } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { CountryShieldDialog } from "@/components/CountryShieldDialog";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sleepox" }] }),
  component: DashboardPage,
});

const display = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function fmtCompact(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return n.toLocaleString();
}

function formatRelativeTime(iso: string) {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DashboardPage() {
  const qc = useQueryClient();
  const dash = useServerFn(getDashboardData);
  const refreshDash = useServerFn(refreshDashboardData);
  const create = useServerFn(createLink);
  const remove = useServerFn(deleteLink);
  const toggle = useServerFn(toggleLink);

  // One-time popup: notify user when admin/cron has reset all clicks since they last saw the notice.
  const resetNoticeFn = useServerFn(getClickResetNotice);
  const dismissNoticeFn = useServerFn(dismissClickResetNotice);
  const noticeQ = useQuery({
    queryKey: ["click-reset-notice"],
    queryFn: () => resetNoticeFn(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const dismissNotice = () => {
    void dismissNoticeFn().then(() => qc.invalidateQueries({ queryKey: ["click-reset-notice"] }));
  };

  

  const dashQ = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dash(),
    staleTime: Infinity,          // Hybrid: never auto-stale, cache-first from DB
    gcTime: 30 * 60_000,
    refetchInterval: false,       // No auto-refetch — user controls freshness
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const refreshMut = useMutation({
    mutationFn: () => refreshDash(),
    onSuccess: (data) => {
      qc.setQueryData(["dashboard"], data);
      toast.success("Dashboard updated");
    },
    onError: (e: Error) => toast.error(e.message || "Refresh failed"),
  });

  const [adsterra, setAdsterra] = useState("");
  const [safe, setSafe] = useState("");
  const [title, setTitle] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [search, setSearch] = useState("");
  const [range, setRange] = useState<"7D" | "30D">("7D");

  const createMut = useMutation({
    mutationFn: (vars: { title?: string; adsterra_url: string; safe_url?: string }) => create({ data: vars }),
    onSuccess: () => {
      toast.success("Link created");
      setAdsterra(""); setSafe(""); setTitle(""); setShowCreate(false);
      refreshMut.mutate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refreshMut.mutate(); },
  });
  const togMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggle({ data: v }),
    onSuccess: () => refreshMut.mutate(),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      title: title || undefined,
      adsterra_url: adsterra,
      safe_url: safe || undefined,
    });
  };

  const primaryFn = useServerFn(getPrimaryShortenerDomain);
  const primaryQ = useQuery({
    queryKey: ["primary-shortener-domain"],
    queryFn: () => primaryFn(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const rawPrimary = primaryQ.data?.domain ?? "mefok.com";
  // Never hand out a Safe-Browsing-flagged domain, even if the DB still lists it.
  const primaryDomain = isFlaggedShortDomain(rawPrimary) || rawPrimary === "sleepox.com" ? "mefok.com" : rawPrimary;
  const customDomains = (dashQ.data?.customDomains ?? []).filter((d: string) => !isFlaggedShortDomain(d));
  // Built-in shortener domains always available + any user custom domains.
  const BUILTIN_DOMAINS = ["mefok.com", "skypq.com", "breezysocial.com"].filter(
    (d) => !isFlaggedShortDomain(d),
  );
  const allDomains = Array.from(new Set([primaryDomain, ...BUILTIN_DOMAINS, ...customDomains]));
  // Load persisted choice from localStorage on mount; ignore flagged/stale values.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("sleepox.shortDomain");
    if (saved && !isFlaggedShortDomain(saved) && allDomains.includes(saved)) setSelectedDomain(saved);
    else {
      setSelectedDomain(primaryDomain);
      window.localStorage.setItem("sleepox.shortDomain", primaryDomain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customDomains.join(","), primaryDomain]);
  const effectiveDomain = !selectedDomain || isFlaggedShortDomain(selectedDomain) ? primaryDomain : selectedDomain;

  const origin = typeof window !== "undefined" ? `${window.location.protocol}//${effectiveDomain}` : `https://${effectiveDomain}`;
  const links = dashQ.data?.links ?? [];
  const [shieldFor, setShieldFor] = useState<null | { id: string; title: string; initial: string[] }>(null);
  // Bulk-copy selection (Set of link ids)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const profile = dashQ.data?.profile;
  const stats = dashQ.data?.stats;

  const totalClicks = links.reduce((s, l) => s + (l.clicks_count || 0), 0);
  const botBlocked = links.reduce((s, l) => s + (l.bot_clicks_count || 0), 0);
  const allTraffic = totalClicks + botBlocked;
  const activeLinks = links.filter((l) => l.is_active).length;
  const uniqueVisitors = stats?.uniqueVisitors ?? 0;
  const botPct = allTraffic > 0 ? ((botBlocked / allTraffic) * 100) : 0;

  const clickQuota = profile?.click_quota ?? null;
  const clicksUsed = Number(profile?.clicks_used ?? 0);
  const quotaPct = clickQuota == null ? 0 : Math.min(100, Math.round((clicksUsed / clickQuota) * 100));
  const quotaLabel = clickQuota == null ? "Unlimited" : `${fmtCompact(clicksUsed)} / ${fmtCompact(clickQuota)}`;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) =>
        (l.title ?? "").toLowerCase().includes(q) ||
        l.short_code.toLowerCase().includes(q) ||
        (l.adsterra_url ?? "").toLowerCase().includes(q),
    );
  }, [links, search]);

  // REAL chart data from clicks table
  const chartData = useMemo(() => {
    const byDay = stats?.clicksByDay ?? {};
    const keys = Object.keys(byDay).sort();
    const n = range === "7D" ? 7 : 30;
    const slice = keys.slice(-n);
    const prevSlice = keys.slice(-n * 2, -n);
    const vals = slice.map((k) => byDay[k] ?? 0);
    const prevVals = prevSlice.map((k) => byDay[k] ?? 0);
    const total = vals.reduce((s, v) => s + v, 0);
    const prevTotal = prevVals.reduce((s, v) => s + v, 0);
    const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : (total > 0 ? 100 : 0);
    let peakIdx = 0, troughIdx = 0;
    vals.forEach((v, i) => {
      if (v > vals[peakIdx]) peakIdx = i;
      if (v < vals[troughIdx]) troughIdx = i;
    });
    return { vals, total, delta, peakIdx, troughIdx, labels: slice };
  }, [stats, range]);

  // REAL country stats top 4
  const regionRows = useMemo(() => {
    const cs = stats?.countryStats ?? {};
    const entries = Object.entries(cs).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, n]) => s + n, 0);
    if (total === 0) return [] as { name: string; pct: number; color: string }[];
    const palette = ["#BFDBFE", "#FECACA", "#BBF7D0", "#FED7AA"];
    const top = entries.slice(0, 3);
    const otherCount = entries.slice(3).reduce((s, [, n]) => s + n, 0);
    const rows = top.map(([name, n], i) => ({ name, pct: Math.round((n / total) * 100), color: palette[i] }));
    if (otherCount > 0) rows.push({ name: "Other", pct: Math.round((otherCount / total) * 100), color: palette[3] });
    return rows;
  }, [stats]);

  const mobilePct = stats?.mobilePct ?? 0;

  return (
    <div className="min-h-screen w-full text-[#2D1B0D]" style={display}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* TOP BAR */}
        <div className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-sm shadow-orange-900/5 px-5 py-3 flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] text-white font-extrabold text-lg flex items-center justify-center shadow-md shadow-orange-500/30">S</div>
            <span className="font-extrabold text-[17px] text-[#2D1B0D] tracking-tight">sleepox</span>
          </Link>
          <div className="flex-1 relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A38D7D]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search links..."
              className="w-full bg-[#FFF9F5]/70 border border-[#FFEDD5] rounded-xl py-2.5 pl-11 pr-4 text-sm placeholder:text-[#A38D7D] focus:outline-none focus:border-[#FF7E5F]/50 focus:bg-white transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#A38D7D]" />
            <select
              value={selectedDomain}
              onChange={(e) => {
                setSelectedDomain(e.target.value);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("sleepox.shortDomain", e.target.value);
                }
              }}
              className="bg-[#FFF9F5]/70 border border-[#FFEDD5] rounded-xl py-2 px-3 text-xs text-[#2D1B0D] focus:outline-none focus:border-[#FF7E5F]/50 transition-all"
              title="Choose which domain to use for new short links"
            >
              {allDomains.map((d: string) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <Link
            to="/support"
            className="hidden sm:inline-flex h-10 px-3 items-center gap-1.5 rounded-xl bg-[#FFF9F5] border border-[#FFEDD5] text-[#7D6452] hover:text-[#FF7E5F] hover:border-[#FF7E5F]/40 transition-all text-[12px] font-bold"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Support
          </Link>
          <BroadcastBell />
          <PlanBadge slug={(profile as any)?.plan_slug} />
          {(() => {
            const slug = (profile as any)?.plan_slug;
            const isPremium = slug === "lifetime" || slug === "unlimited" || slug === "pro" || slug === "pro_monthly" || slug === "yearly";
            const isLifetime = slug === "lifetime" || slug === "unlimited";
            return (
              <div className="relative">
                {isPremium && (
                  <div className={`absolute -inset-[3px] rounded-full bg-gradient-to-br ${isLifetime ? "from-amber-400 via-[#FF7E5F] to-fuchsia-500" : "from-[#FF7E5F] to-[#FEB47B]"} blur-[2px] opacity-80 animate-pulse`} />
                )}
                <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] shadow-md shadow-orange-500/30 flex items-center justify-center text-white text-[10px] font-bold ${isPremium ? "ring-2 ring-white" : ""}`}>
                  {(profile?.email ?? "U").slice(0, 2).toUpperCase()}
                  {isLifetime && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 ring-2 ring-white flex items-center justify-center shadow-md">
                      <Crown className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* KPI ROW — 5 floating cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard label="REAL VISITORS" value={fmtCompact(totalClicks)} sub={`Humans served — bots filtered out`} tone="muted" />
          <KpiCard label="ACTIVE LINKS" value={String(activeLinks)} sub={`${links.length} total`} tone="muted" />
          <KpiCard label="UNIQUE VISITORS" value={fmtCompact(uniqueVisitors)} sub="Last 30 days, humans only" tone="muted" />
          <KpiCard label="SHIELD BLOCKED ✓" value={`${botPct.toFixed(1)}%`} sub={`${fmtCompact(botBlocked)} scanners stopped`} tone="muted" />
          <QuotaCard pct={quotaPct} label={quotaLabel} />
        </div>

        {/* MAIN GRID: chart + side panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT: chart + CTA + table */}
          <div className="lg:col-span-2 space-y-5">
            {/* Chart */}
            <Panel className="p-6">
              <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A38D7D]">Clicks over {range === "7D" ? "7 days" : "30 days"}</p>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-3xl font-extrabold text-[#2D1B0D] tabular-nums" style={display}>{fmtCompact(chartData.total)}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${chartData.delta >= 0 ? "text-[#FF7E5F] bg-[#FFEDD5]" : "text-[#A38D7D] bg-[#FFF1EE]"}`}>
                      {chartData.delta >= 0 ? "+" : ""}{chartData.delta.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-[#A38D7D] mt-1">Tracking real-time traffic volume</p>
                </div>
                <div className="flex gap-1 bg-[#FFEDD5]/60 p-1 rounded-xl">
                  {(["7D", "30D"] as const).map((r) => (
                    <button key={r} onClick={() => setRange(r)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${range === r ? "bg-[#FF7E5F] text-white shadow-sm" : "text-[#A38D7D] hover:text-[#7D6452]"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <BarSparkChart vals={chartData.vals} peakIdx={chartData.peakIdx} troughIdx={chartData.troughIdx} labels={chartData.labels} />
            </Panel>

            {/* CTA BAR */}
            <button onClick={() => setShowCreate((v) => !v)}
              className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] p-5 flex items-center gap-4 shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 transition-all">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 blur-3xl rounded-full pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-white font-bold text-[15px]" style={display}>Create new smart link</h4>
                <p className="text-white/85 text-xs mt-0.5">Setup advanced redirection & cloaking</p>
              </div>
              <span className="hidden sm:flex items-center gap-1.5 bg-white text-[#FF7E5F] px-4 py-2 rounded-lg font-bold text-xs group-hover:scale-105 transition-transform">
                Quick Start <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* CREATE FORM */}
            {showCreate && (
              <Panel className="p-6">
                <h3 className="text-lg font-bold text-[#2D1B0D] mb-1" style={display}>Create Smart Link</h3>
                <p className="text-xs text-[#7D6452] mb-5">Wrap your Adsterra link with bot-shield & cloak page.</p>
                <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
                  <Field label="Title (optional)" full>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My ad campaign" className={fieldCls} />
                  </Field>
                  <Field label="Adsterra Direct Link *">
                    <input type="url" required value={adsterra} onChange={(e) => setAdsterra(e.target.value)} placeholder="https://..." className={fieldCls} />
                  </Field>
                  <Field label="Safe URL (optional)" full>
                    <input
                      type="url"
                      value={safe}
                      onChange={(e) => setSafe(e.target.value)}
                      placeholder="https://sleepox.com/"
                      className={fieldCls}
                    />
                    <p className="text-[11px] text-[#A38D7D] mt-1">
                      FB crawler & ad reviewers automatically receive our built safe article (200 OK HTML). Real users go to your offer.
                    </p>
                  </Field>
                  <div className="sm:col-span-2 flex gap-3 pt-1">
                    <button type="submit" disabled={createMut.isPending}
                      className="px-6 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-lg shadow-orange-500/30 hover:scale-[1.02] transition-transform disabled:opacity-50">
                      {createMut.isPending ? "Creating…" : "Create Link"}
                    </button>
                    <button type="button" onClick={() => setShowCreate(false)}
                      className="px-6 py-3 rounded-xl text-sm font-semibold text-[#7D6452] hover:text-[#2D1B0D] border border-[#FFEDD5] hover:bg-white/60">
                      Cancel
                    </button>
                  </div>
                </form>
              </Panel>
            )}

            {/* RECENT CAMPAIGNS / SMART LINKS */}
            <Panel className="overflow-hidden">
              <div className="p-5 flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h4 className="text-lg font-bold text-[#2D1B0D]" style={display}>Recent Campaigns</h4>
                  <p className="text-[11px] text-[#A38D7D] mt-0.5">
                    Showing {filtered.length} of {links.length}
                    {(dashQ.data as any)?._cachedAt && (
                      <span className="ml-2 text-[#A38D7D]/70">
                        · Updated {formatRelativeTime((dashQ.data as any)._cachedAt)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-9 h-9 rounded-lg border border-[#FFEDD5] text-[#A38D7D] hover:text-[#FF7E5F] hover:border-[#FF7E5F]/40 flex items-center justify-center transition-all"><Filter className="w-4 h-4" /></button>
                  <button
                    onClick={() => refreshMut.mutate()}
                    disabled={refreshMut.isPending}
                    title="Refresh dashboard (fetch latest data)"
                    className="w-9 h-9 rounded-lg border border-[#FFEDD5] text-[#A38D7D] hover:text-[#FF7E5F] hover:border-[#FF7E5F]/40 flex items-center justify-center transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshMut.isPending ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {dashQ.isLoading && <div className="py-16 text-center text-sm text-[#A38D7D]">Loading links…</div>}
              {!dashQ.isLoading && filtered.length === 0 && (
                <div className="py-16 text-center text-sm text-[#7D6452]">
                  {search ? "No links match." : "No links yet — click Create new smart link above."}
                </div>
              )}

              {filtered.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[480px] table-fixed">
                    <colgroup>
                      <col className="w-[44px]" />
                      <col />
                      <col className="hidden md:table-column w-[90px]" />
                      <col className="w-[80px]" />
                      <col className="hidden sm:table-column w-[90px]" />
                      <col className="w-[160px]" />
                    </colgroup>
                    <thead className="text-[10px] uppercase tracking-[0.18em] text-[#A38D7D] border-y border-[#FFEDD5]">
                      <tr>
                        <th className="px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label="Select all visible links"
                            checked={filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id))}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds(new Set(filtered.map((l) => l.id)));
                              else setSelectedIds(new Set());
                            }}
                            className="w-4 h-4 accent-[#FF7E5F] cursor-pointer"
                          />
                        </th>
                        <th className="px-3 sm:px-5 py-3 font-bold">Campaign</th>
                        <th className="hidden md:table-cell px-3 py-3 font-bold">Trend</th>
                        <th className="px-3 py-3 font-bold">Clicks</th>
                        <th className="hidden sm:table-cell px-3 py-3 font-bold">Status</th>
                        <th className="px-3 sm:px-5 py-3 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#FFEDD5]">
                      {filtered.map((l) => {
                        const shortUrl = `${origin}/${l.short_code}`;
                        const spark = stats?.perLinkDaily?.[l.id] ?? [];
                        const sparkUp = spark.length >= 2 ? spark[spark.length - 1] >= spark[0] : true;
                        const isSelected = selectedIds.has(l.id);
                        return (
                          <tr key={l.id} className={`hover:bg-[#FFF9F5] transition-colors ${isSelected ? "bg-[#FFF4ED]" : ""}`}>
                            <td className="px-3 py-4">
                              <input
                                type="checkbox"
                                aria-label={`Select ${l.title || l.short_code}`}
                                checked={isSelected}
                                onChange={() => toggleSelect(l.id)}
                                className="w-4 h-4 accent-[#FF7E5F] cursor-pointer"
                              />
                            </td>
                            <td className="px-3 sm:px-5 py-4 min-w-0">
                              <p className="text-sm font-bold text-[#2D1B0D] truncate" style={display}>
                                {l.title || l.short_code}
                              </p>
                              <button onClick={() => { navigator.clipboard.writeText(shortUrl); toast.success("Copied"); }}
                                className="text-[11px] text-[#FF7E5F] hover:text-[#E66D50] flex items-center gap-1 mt-0.5 font-mono truncate max-w-full">
                                <span className="truncate">{effectiveDomain}/{l.short_code}</span> <Copy className="w-3 h-3 shrink-0" />
                              </button>
                            </td>
                            <td className="hidden md:table-cell px-3 py-4"><MiniSpark up={sparkUp} /></td>
                            <td className="px-3 py-4">
                              <div className="text-sm font-bold text-[#2D1B0D] tabular-nums" style={display}>
                                {(l.clicks_count || 0).toLocaleString()}
                              </div>
                            </td>
                            <td className="hidden sm:table-cell px-3 py-4">
                              <button onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                                className={l.is_active
                                  ? "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"
                                  : "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700"}>
                                {l.is_active ? "ACTIVE" : "PAUSED"}
                              </button>
                            </td>
                            <td className="px-3 sm:px-5 py-4 text-right">
                              <div className="inline-flex items-center gap-0.5 sm:gap-1">
                                <button
                                  title={`Country Shield${(l as any).blocked_countries?.length ? ` (${(l as any).blocked_countries.length} blocked)` : ""}`}
                                  onClick={() => setShieldFor({ id: l.id, title: l.title || l.short_code, initial: (l as any).blocked_countries ?? [] })}
                                  className={`relative p-1.5 rounded-lg hover:bg-[#FFEDD5]/60 shrink-0 ${
                                    (l as any).blocked_countries?.length > 0
                                      ? "text-[#FF7E5F]"
                                      : "text-[#7D6452] hover:text-[#FF7E5F]"
                                  }`}
                                >
                                  <Shield className="w-4 h-4" />
                                  {(l as any).blocked_countries?.length > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#FF7E5F] text-white text-[8px] font-bold flex items-center justify-center">
                                      {(l as any).blocked_countries.length}
                                    </span>
                                  )}
                                </button>
                                <a
                                  href={shortUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`Verify: open ${effectiveDomain}/${l.short_code} and confirm it redirects to your offer`}
                                  className="text-[#7D6452] hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50 shrink-0"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </a>
                                <button onClick={() => togMut.mutate({ id: l.id, is_active: !l.is_active })}
                                  className="text-[#7D6452] hover:text-[#FF7E5F] p-1.5 rounded-lg hover:bg-[#FFEDD5]/60 shrink-0">
                                  {l.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </button>

                                <button onClick={() => { if (confirm("Delete this link?")) delMut.mutate(l.id); }}
                                  className="text-[#7D6452] hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          {/* RIGHT COLUMN: account quota + region */}
          <div className="space-y-5">
            {/* Account Quota */}
            <Panel className="p-6">
              <h4 className="text-base font-bold text-[#2D1B0D]" style={display}>Account Quota</h4>
              <div className="mt-5 flex items-center justify-between text-xs">
                <span className="text-[#7D6452]">Plan</span>
                <PlanBadge slug={(profile as any)?.plan_slug} size="lg" />
              </div>
              {(() => {
                const exp = (profile as any)?.plan_expires_at as string | null | undefined;
                if (!exp) {
                  const slug = (profile as any)?.plan_slug;
                  if (slug === "lifetime" || slug === "unlimited") {
                    return <div className="mt-2 flex items-center justify-between text-xs"><span className="text-[#7D6452]">Expires</span><span className="font-bold text-emerald-700">Never</span></div>;
                  }
                  return null;
                }
                const expDate = new Date(exp);
                const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / 86400000);
                const expired = daysLeft <= 0;
                return (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-[#7D6452]">{expired ? "Expired" : "Expires in"}</span>
                    <span className={`font-bold tabular-nums ${expired ? "text-red-600" : daysLeft <= 3 ? "text-amber-600" : "text-[#2D1B0D]"}`}>
                      {expired ? expDate.toLocaleDateString() : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                    </span>
                  </div>
                );
              })()}
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-[#7D6452]">Redirects used</span>
                <span className="font-bold text-[#2D1B0D] tabular-nums">{quotaLabel}</span>
              </div>
              <div className="mt-2 h-2 bg-[#FFEDD5] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-[0_0_8px_rgba(255,126,95,0.5)]" style={{ width: `${quotaPct}%` }} />
              </div>
              <Link to="/upgrade"
                className="mt-5 w-full block text-center py-3 rounded-xl border-2 border-[#FF7E5F] text-[#FF7E5F] font-bold text-sm hover:bg-gradient-to-r hover:from-[#FF7E5F] hover:to-[#FEB47B] hover:text-white hover:border-transparent transition-all">
                Upgrade to Pro
              </Link>
            </Panel>

            {/* Traffic by Region + Mobile Gauge */}
            <Panel className="p-6">
              <h4 className="text-base font-bold text-[#2D1B0D]" style={display}>Traffic by Region</h4>
              <div className="mt-4 space-y-3">
                {regionRows.length === 0 ? (
                  <p className="text-xs text-[#A38D7D]">No traffic yet.</p>
                ) : (
                  regionRows.map((r) => <RegionRow key={r.name} color={r.color} name={r.name} pct={r.pct} />)
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-[#FFEDD5] flex flex-col items-center">
                <MobileGauge pct={mobilePct} />
                <p className="mt-3 text-[10px] uppercase tracking-[0.18em] font-bold text-[#A38D7D] flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3" /> Mobile Traffic
                </p>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {shieldFor && (
        <CountryShieldDialog
          open={!!shieldFor}
          onOpenChange={(o) => { if (!o) setShieldFor(null); }}
          linkId={shieldFor.id}
          linkTitle={shieldFor.title}
          initial={shieldFor.initial}
          planSlug={(profile as any)?.plan_slug}
        />
      )}

      <Dialog open={!!noticeQ.data?.showPopup} onOpenChange={(open) => { if (!open) dismissNotice(); }}>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#2D1B0D]">
              <Sparkles className="w-5 h-5 text-[#FF7E5F]" />
              All clicks have been cleaned
            </DialogTitle>
            <DialogDescription className="text-[#5A4434] pt-2 leading-relaxed">
              Don't worry — <b>all your links and account data are safe</b>. We just
              cleared the click history to keep your dashboard fast and optimized.
              New clicks from now on will be counted as usual.
              {noticeQ.data?.resetAt && (
                <span className="block mt-2 text-xs text-[#A38D7D] font-mono">
                  Reset: {new Date(noticeQ.data.resetAt).toLocaleString()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <UIButton onClick={dismissNotice} className="bg-[#FF7E5F] hover:bg-[#FF6B47] text-white">
              Got it
            </UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating bulk-copy action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-2xl bg-[#2D1B0D] text-white shadow-2xl shadow-orange-900/30 border border-[#FF7E5F]/40 max-w-[95vw] flex-wrap justify-center">
          <span className="text-xs font-bold whitespace-nowrap">
            {selectedIds.size} selected
          </span>

          {/* Domain picker inside bulk bar — copied URLs ALWAYS match this */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 border border-white/15">
            <Globe className="w-3 h-3 text-[#FEB47B]" />
            <select
              value={effectiveDomain}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedDomain(v);
                if (typeof window !== "undefined") window.localStorage.setItem("sleepox.shortDomain", v);
              }}
              className="bg-transparent text-[11px] font-mono font-bold text-white focus:outline-none cursor-pointer"
            >
              {allDomains.map((d) => (
                <option key={d} value={d} className="text-[#2D1B0D]">{d}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              const urls = links
                .filter((l) => selectedIds.has(l.id))
                .map((l) => `https://${effectiveDomain}/${l.short_code}`)
                .join("\n");
              navigator.clipboard.writeText(urls);
              toast.success(`Copied ${selectedIds.size} short URL${selectedIds.size === 1 ? "" : "s"} on ${effectiveDomain}`);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-bold text-xs shadow-lg hover:opacity-90"
          >
            <Copy className="w-3.5 h-3.5" /> Copy URLs
          </button>

          <button
            onClick={() => {
              const chosen = links.filter((l) => selectedIds.has(l.id));
              if (chosen.length > 5 && !confirm(`Open ${chosen.length} tabs to verify each link redirects correctly?`)) return;
              chosen.forEach((l) => {
                window.open(`https://${effectiveDomain}/${l.short_code}`, "_blank", "noopener,noreferrer");
              });
              toast.success(`Verifying ${chosen.length} link${chosen.length === 1 ? "" : "s"} — check each tab lands on your offer`);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20"
            title="Open each selected short URL in a new tab to confirm it redirects to your offer"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Verify
          </button>

          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[11px] font-bold text-[#FFEDD5]/80 hover:text-white px-2 py-1"
          >
            Clear
          </button>
        </div>
      )}

    </div>
  );
}


/* ════════════════════ COMPONENTS ════════════════════ */

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={"rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl shadow-sm shadow-orange-900/5 " + className}>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "up" | "muted" }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl p-4 shadow-sm shadow-orange-900/5 hover:-translate-y-0.5 hover:shadow-md transition-all">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A38D7D]">{label}</div>
      <div className="text-2xl lg:text-3xl font-extrabold text-[#2D1B0D] mt-2 tabular-nums" style={display}>{value}</div>
      <div className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${tone === "up" ? "text-emerald-600" : "text-[#FF7E5F]"}`}>
        {tone === "up" && <TrendingUp className="w-3 h-3" />}
        {sub}
      </div>
    </div>
  );
}

function QuotaCard({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-xl p-4 shadow-sm shadow-orange-900/5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A38D7D]">QUOTA</span>
        <span className="text-[11px] font-bold text-[#FF7E5F] tabular-nums">{label}</span>
      </div>
      <div className="mt-4 h-2 bg-[#FFEDD5] rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] shadow-[0_0_8px_rgba(255,126,95,0.5)] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <Link to="/upgrade" className="mt-4 text-[11px] font-bold text-[#FF7E5F] hover:text-[#E66D50] flex items-center gap-1">
        Upgrade plan <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function BarSparkChart({ vals, peakIdx, troughIdx, labels }: { vals: number[]; peakIdx: number; troughIdx: number; labels: string[] }) {
  const max = Math.max(1, ...vals);
  const sw = 800, sh = 70;
  const pts = vals.length > 1
    ? vals.map((v, i) => {
        const x = (i / (vals.length - 1)) * sw;
        const y = sh - (v / max) * (sh - 12) - 6;
        return [x, y] as const;
      })
    : [[0, sh / 2], [sw, sh / 2]] as const;
  const path = "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  const peak = pts[Math.min(peakIdx, pts.length - 1)];
  const trough = pts[Math.min(troughIdx, pts.length - 1)];
  const fmtLabel = (k: string) => {
    if (!k) return "";
    const d = new Date(k);
    if (isNaN(d.getTime())) return k.slice(-5);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return (
    <div className="space-y-4">
      {/* Sparkline strip with floating peak/trough indicators */}
      <div className="relative w-full" style={{ height: 80 }}>
        <svg viewBox={`0 0 ${sw} ${sh}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="dashSpark" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FEB47B" />
              <stop offset="100%" stopColor="#FF7E5F" />
            </linearGradient>
          </defs>
          <path d={path} fill="none" stroke="url(#dashSpark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 2px 6px rgba(255,126,95,0.35))" }} />
          {/* Peak indicator */}
          <g>
            <circle cx={peak[0]} cy={peak[1]} r="5" fill="#FF7E5F" stroke="white" strokeWidth="2"
                    style={{ filter: "drop-shadow(0 0 8px rgba(255,126,95,0.6))" }} />
          </g>
          {/* Trough indicator (subtle) */}
          {vals.length > 1 && peakIdx !== troughIdx && (
            <circle cx={trough[0]} cy={trough[1]} r="3.5" fill="white" stroke="#FF7E5F" strokeWidth="2" />
          )}
        </svg>
        {/* Floating peak label */}
        <div className="absolute pointer-events-none -translate-x-1/2 -translate-y-full"
             style={{ left: `${(peak[0] / sw) * 100}%`, top: `${(peak[1] / sh) * 100}%`, marginTop: -6 }}>
          <div className="bg-[#2D1B0D] text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg whitespace-nowrap" style={display}>
            {fmtCompact(vals[peakIdx] ?? 0)}
            <span className="block text-[8px] font-normal text-white/60 leading-none mt-0.5">{fmtLabel(labels[peakIdx] ?? "")}</span>
          </div>
        </div>
      </div>

      {/* Bar distribution with hover */}
      <div className="flex items-end gap-[3px] h-28">
        {vals.map((v, i) => {
          const isPeak = i === peakIdx;
          const pct = (v / max) * 100;
          return (
            <div key={i} className="group relative flex-1 flex items-end h-full">
              <div
                className={`w-full rounded-t-md transition-all duration-300 cursor-pointer ${isPeak ? "bg-[#FF7E5F] shadow-[0_4px_14px_rgba(255,126,95,0.5)]" : "bg-[#FFEDD5] hover:bg-[#FF7E5F] hover:shadow-[0_6px_18px_rgba(255,126,95,0.55)] hover:scale-y-105 origin-bottom"}`}
                style={{ height: `${Math.max(4, pct)}%` }}
              />
              {/* Hover tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-[#2D1B0D] text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg whitespace-nowrap" style={display}>
                  {fmtCompact(v)}
                  <span className="block text-[8px] font-normal text-white/60 leading-none mt-0.5">{fmtLabel(labels[i] ?? "")}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels (sparse) */}
      <div className="flex justify-between text-[10px] font-bold text-[#A38D7D] uppercase tracking-wider px-0.5">
        {labels.length > 0 && (
          <>
            <span>{fmtLabel(labels[0])}</span>
            {labels.length > 6 && <span>{fmtLabel(labels[Math.floor(labels.length / 2)])}</span>}
            <span className="text-[#FF7E5F]">{fmtLabel(labels[labels.length - 1])}</span>
          </>
        )}
      </div>
    </div>
  );
}

function MiniSpark({ up }: { up: boolean }) {
  const w = 80, h = 28;
  const pts = up
    ? [[0, 20], [15, 18], [30, 14], [45, 16], [60, 10], [80, 6]]
    : [[0, 10], [15, 14], [30, 12], [45, 18], [60, 16], [80, 22]];
  const path = "M" + pts.map(([x, y]) => `${x},${y}`).join(" L");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <path d={path} fill="none" stroke={up ? "#10B981" : "#FF7E5F"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RegionRow({ color, name, pct }: { color: string; name: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-sm text-[#2D1B0D] flex-1">{name}</span>
      <span className="text-sm font-bold text-[#2D1B0D] tabular-nums">{pct}%</span>
    </div>
  );
}

function MobileGauge({ pct }: { pct: number }) {
  const size = 120, stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FFEDD5" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#mg)" strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
                style={{ filter: "drop-shadow(0 0 6px rgba(255,126,95,0.5))" }} />
        <defs>
          <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF7E5F" />
            <stop offset="100%" stopColor="#FEB47B" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-[#A38D7D] font-semibold">Mobile</span>
        <span className="text-2xl font-extrabold text-[#2D1B0D] tabular-nums" style={display}>{pct}%</span>
      </div>
    </div>
  );
}

const fieldCls = "w-full bg-[#FFF9F5] border border-[#FFEDD5] rounded-xl px-4 py-3 text-sm text-[#2D1B0D] placeholder:text-[#A38D7D] focus:outline-none focus:border-[#FF7E5F]/50 focus:bg-white transition-all";

function Field({ label, full = false, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#A38D7D] mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function PlanBadge({ slug, size = "sm" }: { slug?: string | null; size?: "sm" | "lg" }) {
  const s = (slug ?? "free").toLowerCase();
  const isLifetime = s === "lifetime" || s === "unlimited";
  const isPro = s === "pro" || s === "pro_monthly" || s === "yearly";
  const isMonthly = s === "monthly";
  const cfg = isLifetime
    ? { label: "Lifetime", Icon: Crown, grad: "from-amber-400 via-orange-500 to-fuchsia-500", ring: "ring-amber-200", glow: "shadow-[0_4px_18px_rgba(251,146,60,0.55)]" }
    : isPro
    ? { label: s === "yearly" ? "Pro Yearly" : "Pro", Icon: Gem, grad: "from-[#FF7E5F] via-[#FF6B4A] to-[#FEB47B]", ring: "ring-orange-200", glow: "shadow-[0_4px_14px_rgba(255,126,95,0.5)]" }
    : isMonthly
    ? { label: "Monthly", Icon: Star, grad: "from-[#FEB47B] to-[#FF7E5F]", ring: "ring-orange-100", glow: "shadow-[0_3px_10px_rgba(255,126,95,0.35)]" }
    : { label: "Free", Icon: Star, grad: "from-stone-300 to-stone-400", ring: "ring-stone-200", glow: "" };
  const pad = size === "lg" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]";
  const iconSize = size === "lg" ? "w-3 h-3" : "w-2.5 h-2.5";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider text-white bg-gradient-to-r ${cfg.grad} ring-1 ${cfg.ring} ${cfg.glow} ${pad}`}>
      <cfg.Icon className={iconSize} strokeWidth={2.5} fill="currentColor" />
      {cfg.label}
    </span>
  );
}
