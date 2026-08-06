import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users, Link2, MousePointerClick, Sparkles, Settings2, ShieldCheck, CreditCard, Bot,
  Target, Zap, Calendar, DollarSign, TrendingUp, Globe, Package, Ban, RotateCcw, Trash2,
  Plus, Search, X, Eye, Check, Star, RefreshCw, LifeBuoy, Megaphone, MessageCircle,
  Send, Power, PowerOff, Clock, CheckCircle2, Crown, Gift, AlertTriangle, Info, Rocket, Trophy, KeyRound,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  adminStats, adminListUsers, adminBanUser, adminBulkBan, adminResetUserQuota, adminBulkSetPlan,
  adminListPackages, adminListAllPackages, adminUpsertPackage, adminDeletePackage,
  adminSetUserPlan, adminListUpgradeRequests, adminDecideUpgradeRequest,
  adminClicksTimeseries, adminTopCountries, adminTopUsers, adminRevenueTimeseries,
  adminListLinks, adminToggleLink, adminUpdateLink, adminDeleteLink,
  adminListBotRules, adminUpsertBotRule, adminDeleteBotRule,
  adminListCloakingRules, adminUpsertCloakingRule, adminDeleteCloakingRule,
  adminListCountryTiers, adminUpsertCountryTier, adminDeleteCountryTier,
  adminUserDetail, adminImpersonate, adminFixUnlimitedMonthly,
  adminListErrors, adminErrorStats, adminResolveError, adminDeleteError, adminClearResolvedErrors,
  adminGetInactiveUsers, adminRunMaintenance, adminDeleteUsers, adminTrafficSnapshot,
  adminGetPurgeStatus, adminPurgeBatch, adminResetAllClicks,
  adminTestQuotaSync, adminQuotaSyncStatus
} from "@/lib/admin.functions";
import { adminListPlisioLogs, adminReverifyOrder, adminBulkReverify, adminGetOutgoingIp } from "@/lib/plisio-admin.functions";
import { startImpersonation } from "@/lib/impersonation";
import { getAppSettings, updateAppSettings } from "@/lib/app-settings.functions";
import {
  listShortenerDomains, addShortenerDomain, verifyShortenerDomain,
  setPrimaryShortenerDomain, toggleShortenerDomainActive, deleteShortenerDomain,
} from "@/lib/shortener-domains.functions";
import {
  getSupportStatus, toggleSupport, adminListTickets, adminReplyTicket,
  adminCloseTicket, adminDeleteTicket,
} from "@/lib/support.functions";
import {
  adminListBroadcasts, adminCreateBroadcast, adminToggleBroadcast, adminDeleteBroadcast,
} from "@/lib/broadcasts.functions";
import { BroadcastMarkdown } from "@/components/broadcast-markdown";
import {
  listMonitoredDomains, addMonitoredDomain, toggleMonitoredDomain, deleteMonitoredDomain,
  syncOfferDomainsFromLinks, scanMonitoredDomain, scanAllMonitoredDomains,
} from "@/lib/domain-monitor.functions";
import { LeakMonitorTab } from "@/components/leak-monitor-tab";


export const Route = createFileRoute("/_authenticated/control-panel")({
  head: () => ({ meta: [{ title: "Control Panel — Sleepox" }] }),
  component: AdminPage,
});

const font = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;
const PIE_COLORS = ["#FF7E5F", "#FEB47B", "#FFD4BB", "#7A5C45", "#FFEDD5", "#2D1B0D", "#4A3728", "#A8907A"];

function AdminPage() {
  const navigate = useNavigate();
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        navigate({ to: "/sx-vault-9k2m7x" });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!mounted) return;
      if (!data) {
        navigate({ to: "/dashboard" });
        return;
      }
      setAdminChecked(true);
    })();
    return () => { mounted = false; };
  }, [navigate]);

  if (!adminChecked) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FFF9F5] text-[#7A5C45] text-sm">Loading…</div>;
  }

  return (
    <div className="relative min-h-screen bg-[#FFF9F5] text-[#4A3728] overflow-hidden" style={font}>
      <div className="fixed top-[-20%] left-[-10%] w-[55%] h-[55%] bg-[#FF7E5F]/15 blur-[160px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-15%] w-[55%] h-[55%] bg-[#FEB47B]/20 blur-[160px] rounded-full pointer-events-none" />
      <div className="relative z-10 p-5 sm:p-8 lg:p-12 space-y-8 max-w-[1600px] mx-auto">
        <Header />
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="traffic">Traffic</TabsTrigger>
            <TabsTrigger value="domains">Pool</TabsTrigger>
            <TabsTrigger value="user_domains">User Domains</TabsTrigger>
            <TabsTrigger value="leaks">Leak Monitor</TabsTrigger>


            <TabsTrigger value="support">Support</TabsTrigger>
            <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="plisio">Plisio Logs</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="links"><LinksTab /></TabsContent>
          <TabsContent value="revenue"><RevenueTab /></TabsContent>
          <TabsContent value="packages"><PackagesTab /></TabsContent>
          <TabsContent value="traffic"><TrafficTab /></TabsContent>
          <TabsContent value="domains"><DomainsTab /></TabsContent>
          <TabsContent value="user_domains"><UserDomainsTab /></TabsContent>
          <TabsContent value="leaks"><LeakMonitorTab /></TabsContent>


          <TabsContent value="support"><SupportTab /></TabsContent>
          <TabsContent value="broadcasts"><BroadcastsTab /></TabsContent>
          <TabsContent value="errors"><ErrorsTab /></TabsContent>
          <TabsContent value="plisio"><PlisioLogsTab /></TabsContent>
          <TabsContent value="maintenance"><MaintenanceTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-xl border border-white/80 text-[#FF7E5F] text-[10px] font-bold uppercase tracking-widest shadow-sm">
        <ShieldCheck className="w-3 h-3" /> Admin · Live
      </div>
      <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[#2D1B0D]">
        Control{" "}
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FF7E5F] via-[#FEB47B] to-[#FF7E5F]">Panel</span>
      </h1>
      <p className="mt-2 text-sm text-[#7A5C45]">Full system control · users, links, revenue, rules & analytics.</p>
    </div>
  );
}

// ===================== OVERVIEW =====================
function OverviewTab() {
  const statsFn = useServerFn(adminStats);
  const tsFn = useServerFn(adminClicksTimeseries);
  const ctyFn = useServerFn(adminTopCountries);
  const topUsersFn = useServerFn(adminTopUsers);
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });
  const ts = useQuery({ queryKey: ["admin-ts"], queryFn: () => tsFn() });
  const cty = useQuery({ queryKey: ["admin-cty"], queryFn: () => ctyFn() });
  const top = useQuery({ queryKey: ["admin-top-users"], queryFn: () => topUsersFn() });

  const s = stats.data;
  const botPct = s && s.clicks ? ((s.bots / s.clicks) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Users} label="Users" value={s?.users ?? "…"} sub={`${s?.banned_users ?? 0} banned`} />
        <Kpi icon={Link2} label="Links" value={s?.links ?? "…"} sub={`${s?.active_links ?? 0} active`} />
        <Kpi icon={MousePointerClick} label="Total clicks" value={(s?.clicks ?? 0).toLocaleString()} sub={`${botPct}% bots`} />
        <Kpi icon={DollarSign} label="MRR (30d)" value={`$${(s?.mrr_30d ?? 0).toFixed(2)}`} sub={`$${(s?.total_revenue ?? 0).toFixed(2)} all-time`} accent />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Zap} label="Ours rotations" value={(s?.ours ?? 0).toLocaleString()} sub="Quota + Injection" />
        <Kpi icon={Target} label="Offer clicks" value={(s?.offer ?? 0).toLocaleString()} sub="User destinations" />
        <Kpi icon={Bot} label="Bots blocked" value={(s?.bots ?? 0).toLocaleString()} sub="Shield active" />
        <Kpi 
          icon={Calendar} 
          label="Today ours/total" 
          value={`${(s?.today_ours ?? 0).toLocaleString()} / ${(s?.today_total ?? 0).toLocaleString()}`} 
          sub="Target: 100 per 1k (10%)" 
          accent 
        />
      </div>

      <Panel icon={TrendingUp} title="Clicks · last 14 days" subtitle="Daily breakdown of routing & bot traffic">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={ts.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FFD4BB" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#7A5C45" }} />
              <YAxis tick={{ fontSize: 10, fill: "#7A5C45" }} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #FFD4BB", borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="total" stroke="#FF7E5F" strokeWidth={2} />
              <Line type="monotone" dataKey="ours" stroke="#FEB47B" strokeWidth={2} />
              <Line type="monotone" dataKey="offer" stroke="#2D1B0D" strokeWidth={2} />
              <Line type="monotone" dataKey="bots" stroke="#A8907A" strokeWidth={2} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel icon={Globe} title="Top countries · 7d">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={cty.data ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#FFD4BB" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#7A5C45" }} />
                <YAxis dataKey="country" type="category" tick={{ fontSize: 10, fill: "#7A5C45" }} width={50} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #FFD4BB", borderRadius: 12 }} />
                <Bar dataKey="count" fill="#FF7E5F" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel icon={Users} title="Top users · by clicks">
          <div className="space-y-2">
            {(top.data ?? []).map((u, i) => (
              <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-white/60 border border-[#FFE4D0]">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <div className="text-sm font-semibold text-[#2D1B0D]">{u.email}</div>
                    <div className="text-[10px] uppercase font-bold text-[#7A5C45]">{u.plan_slug}</div>
                  </div>
                </div>
                <span className="font-bold text-[#FF7E5F]">{(u.clicks_used ?? 0).toLocaleString()}</span>
              </div>
            ))}
            {!top.data?.length && <div className="text-sm text-[#A8907A] p-4 text-center">No data yet.</div>}
          </div>
        </Panel>
      </div>

      <Panel icon={Bot} title="Bot vs Human · all-time">
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={[
                  { name: "Human (ours)", value: s?.ours ?? 0 },
                  { name: "Human (offer)", value: s?.offer ?? 0 },
                  { name: "Bots", value: s?.bots ?? 0 },
                ]}
                cx="50%" cy="50%" outerRadius={90} dataKey="value" label
              >
                {PIE_COLORS.slice(0, 3).map((c, i) => <Cell key={i} fill={c} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

// ===================== USERS =====================
function UsersTab() {
  const qc = useQueryClient();
  const usersFn = useServerFn(adminListUsers);
  const packagesFn = useServerFn(adminListPackages);
  const banFn = useServerFn(adminBanUser);
  const planFn = useServerFn(adminSetUserPlan);
  const bulkBanFn = useServerFn(adminBulkBan);
  const bulkPlanFn = useServerFn(adminBulkSetPlan);
  const resetFn = useServerFn(adminResetUserQuota);
  const detailFn = useServerFn(adminUserDetail);
  const impersonateFn = useServerFn(adminImpersonate);
  const navigate = useNavigate();
  const [imperBusyId, setImperBusyId] = useState<string | null>(null);

  const handleImpersonate = async (u: { id: string; email: string | null }) => {
    if (!confirm(`Sign in as ${u.email ?? u.id}?\n\nYour admin session is saved and can be restored from the orange banner.`)) return;
    setImperBusyId(u.id);
    try {
      const r = await impersonateFn({ data: { user_id: u.id } });
      await startImpersonation({ hashed_token: r.hashed_token, target: r.target });
      toast.success(`Now signed in as ${r.target.email}`);
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImperBusyId(null);
    }
  };


  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn() });
  const packages = useQuery({ queryKey: ["admin-packages"], queryFn: () => packagesFn() });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPlan, setBulkPlan] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["admin-user-detail", detailId],
    queryFn: () => detailFn({ data: { id: detailId! } }),
    enabled: !!detailId,
  });

  const filtered = useMemo(() => {
    const list = users.data ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((u) => (u.email ?? "").toLowerCase().includes(q) || u.id.includes(q) || u.plan_slug.includes(q));
  }, [users.data, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const banMut = useMutation({ mutationFn: (v: { id: string; is_banned: boolean }) => banFn({ data: v }), onSuccess: () => { toast.success("Updated"); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  const planMut = useMutation({ mutationFn: (v: { user_id: string; package_slug: string }) => planFn({ data: v }), onSuccess: () => { toast.success("Plan updated"); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  const bulkBanMut = useMutation({ mutationFn: (v: { ids: string[]; is_banned: boolean }) => bulkBanFn({ data: v }), onSuccess: (r) => { toast.success(`Updated ${r.updated} users`); setSelected(new Set()); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  const bulkPlanMut = useMutation({ mutationFn: (v: { ids: string[]; package_slug: string }) => bulkPlanFn({ data: v }), onSuccess: (r) => { toast.success(`${r.updated} users moved`); setSelected(new Set()); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  const resetMut = useMutation({ mutationFn: (v: { ids: string[] }) => resetFn({ data: v }), onSuccess: (r) => { toast.success(`Quota reset for ${r.updated}`); setSelected(new Set()); invalidate(); }, onError: (e: Error) => toast.error(e.message) });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((u) => u.id)));
  };
  const toggleOne = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };

  return (
    <Panel icon={Users} title="Users" subtitle="Search · bulk ban · reset quota · plan switch · per-user detail">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8907A]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email, plan, id…" className={`${inputCls} pl-10`} />
        </div>
        <span className="text-xs text-[#7A5C45]">{selected.size} selected</span>
        <Button
          size="sm"
          variant="outline"
          className="border-[#FFD4BB] ml-auto"
          onClick={async () => {
            if (!confirm("Repair paid-plan quota mismatches from payment history? This will not renew plans or add days.")) return;
            try {
              const r = await adminFixUnlimitedMonthly();
              toast.success(`Fixed ${r.fixed} of ${r.scanned} monthly users`);
              invalidate();
            } catch (e: any) {
              toast.error(e.message ?? "Failed");
            }
          }}
        >
          <RotateCcw className="w-3 h-3 mr-1" />Repair Quota Drift
        </Button>
      </div>


      {selected.size > 0 && (
        <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-[#FF7E5F]/10 to-[#FEB47B]/10 border border-[#FFD4BB] flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => bulkBanMut.mutate({ ids: [...selected], is_banned: true })} className="border-[#FFD4BB]"><Ban className="w-3 h-3 mr-1" />Ban</Button>
          <Button size="sm" variant="outline" onClick={() => bulkBanMut.mutate({ ids: [...selected], is_banned: false })} className="border-[#FFD4BB]">Unban</Button>
          <Button size="sm" variant="outline" onClick={() => { if (confirm(`Reset quota for ${selected.size} users?`)) resetMut.mutate({ ids: [...selected] }); }} className="border-[#FFD4BB]"><RotateCcw className="w-3 h-3 mr-1" />Reset quota</Button>
          <select value={bulkPlan} onChange={(e) => setBulkPlan(e.target.value)} className="bg-white/80 border border-[#FFD4BB] rounded-lg px-2 py-1 text-xs">
            <option value="">Move to plan…</option>
            {packages.data?.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
          <Button size="sm" disabled={!bulkPlan} onClick={() => { bulkPlanMut.mutate({ ids: [...selected], package_slug: bulkPlan }); setBulkPlan(""); }} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">Apply</Button>
        </div>
      )}

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]">
              <Th><input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={toggleAll} /></Th>
              <Th>Email</Th><Th>Plan</Th><Th>Change</Th><Th>Links</Th><Th>Clicks</Th><Th>Ours</Th><Th>Started</Th><Th>Expires</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-[#FFE4D0]/60 hover:bg-white/40">
                <Td><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} /></Td>
                <Td className="font-medium text-[#2D1B0D]">{u.email}</Td>
                <Td><Pill>{u.plan_slug}</Pill></Td>
                <Td>
                  <select value={u.plan_slug} onChange={(e) => { if (e.target.value !== u.plan_slug && confirm(`Change ${u.email} to ${e.target.value}?`)) planMut.mutate({ user_id: u.id, package_slug: e.target.value }); }}
                    className="bg-white/80 border border-[#FFD4BB] rounded-lg px-2 py-1 text-xs">
                    {packages.data?.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                    {!packages.data?.some((p) => p.slug === u.plan_slug) && <option value={u.plan_slug}>{u.plan_slug}</option>}
                  </select>
                </Td>
                <Td className="text-[#7A5C45]">{u.links_used} / {u.link_limit == null ? "∞" : u.link_limit}</Td>
                <Td className="text-[#7A5C45]">{u.clicks_used.toLocaleString()}{u.click_quota == null ? " / ∞" : ` / ${u.click_quota.toLocaleString()}`}</Td>
                <Td><span className="inline-flex px-2 py-0.5 rounded-md bg-gradient-to-r from-[#FF7E5F]/15 to-[#FEB47B]/15 text-[#FF7E5F] text-xs font-bold">{(u.ours_clicks ?? 0).toLocaleString()}</span></Td>
                <Td className="text-[#7A5C45] text-xs whitespace-nowrap">{u.plan_started_at ? new Date(u.plan_started_at).toLocaleDateString() : "—"}</Td>
                <Td className="text-xs whitespace-nowrap">{(() => {
                  if (u.plan_slug === "lifetime" || u.plan_slug === "unlimited") return <span className="text-emerald-600 font-semibold">Never</span>;
                  if (!u.plan_expires_at) return <span className="text-[#7A5C45]">—</span>;
                  const exp = new Date(u.plan_expires_at);
                  const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000);
                  const cls = daysLeft < 0 ? "text-rose-600 font-semibold" : daysLeft <= 3 ? "text-amber-600 font-semibold" : "text-[#7A5C45]";
                  return <span className={cls} title={exp.toLocaleString()}>{exp.toLocaleDateString()} ({daysLeft < 0 ? `expired ${-daysLeft}d ago` : `${daysLeft}d left`})</span>;
                })()}</Td>
                <Td>{u.is_banned ? <span className="text-rose-600 font-semibold">Banned</span> : <span className="text-emerald-600 font-semibold">Active</span>}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setDetailId(u.id)} className="border-[#FFD4BB]" title="View details"><Eye className="w-3 h-3" /></Button>
                    <Button size="sm" variant="outline" disabled={imperBusyId === u.id} onClick={() => handleImpersonate(u)} className="border-amber-400 text-amber-700 hover:bg-amber-50" title="Sign in as this user">
                      <KeyRound className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => banMut.mutate({ id: u.id, is_banned: !u.is_banned })} className="border-[#FFD4BB]">{u.is_banned ? "Unban" : "Ban"}</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail.data?.profile?.email ?? "User detail"}</DialogTitle></DialogHeader>
          {detail.isLoading && <div className="text-sm text-[#7A5C45]">Loading…</div>}
          {detail.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Stat label="Plan" value={detail.data.profile?.plan_slug ?? "—"} />
                <Stat label="Links" value={`${detail.data.profile?.links_used ?? 0} / ${detail.data.profile?.link_limit == null ? "∞" : detail.data.profile.link_limit}`} />
                <Stat label="Clicks" value={(detail.data.profile?.clicks_used ?? 0).toLocaleString()} />
              </div>
              <div className="h-44">
                <ResponsiveContainer>
                  <LineChart data={detail.data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFD4BB" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="clicks" stroke="#FF7E5F" />
                    <Line type="monotone" dataKey="bots" stroke="#A8907A" strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A5C45] mb-2">Links ({detail.data.links.length})</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {detail.data.links.map((l) => (
                    <div key={l.id} className="text-xs flex justify-between p-2 rounded bg-white/60 border border-[#FFE4D0]">
                      <span className="font-mono">{l.short_code}</span>
                      <span className="text-[#7A5C45]">{l.clicks_count} clicks · {l.bot_clicks_count} bots</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#7A5C45] mb-2">Payments ({detail.data.payments.length})</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {detail.data.payments.map((p) => (
                    <div key={p.id} className="text-xs flex justify-between p-2 rounded bg-white/60 border border-[#FFE4D0]">
                      <span>{new Date(p.created_at ?? "").toLocaleDateString()} · {p.package_slug}</span>
                      <span className="font-semibold">${Number(p.amount).toFixed(2)} · {p.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

// ===================== LINKS =====================
function LinksTab() {
  const qc = useQueryClient();
  const linksFn = useServerFn(adminListLinks);
  const toggleFn = useServerFn(adminToggleLink);
  const updateFn = useServerFn(adminUpdateLink);
  const delFn = useServerFn(adminDeleteLink);
  const links = useQuery({ queryKey: ["admin-links"], queryFn: () => linksFn() });
  const [search, setSearch] = useState("");
  const inv = () => qc.invalidateQueries({ queryKey: ["admin-links"] });
  const toggleMut = useMutation({ mutationFn: (v: { id: string; is_active: boolean }) => toggleFn({ data: v }), onSuccess: () => { toast.success("Toggled"); inv(); }, onError: (e: Error) => toast.error(e.message) });
  const updateMut = useMutation({ mutationFn: (v: { id: string; adsterra_url?: string; safe_url?: string; title?: string }) => updateFn({ data: v }), onSuccess: () => { toast.success("Updated"); inv(); }, onError: (e: Error) => toast.error(e.message) });
  const delMut = useMutation({ mutationFn: (v: { id: string }) => delFn({ data: v }), onSuccess: () => { toast.success("Deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });

  const filtered = useMemo(() => {
    const l = links.data ?? [];
    if (!search) return l;
    const q = search.toLowerCase();
    return l.filter((x) => x.short_code.toLowerCase().includes(q) || (x.title ?? "").toLowerCase().includes(q) || (x.owner_email ?? "").toLowerCase().includes(q));
  }, [links.data, search]);

  return (
    <Panel icon={Link2} title="All links" subtitle="Force disable, edit destination, view click/bot stats">
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8907A]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search short code, title, owner…" className={`${inputCls} pl-10`} />
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]">
              <Th>Code</Th><Th>Owner</Th><Th>Title</Th><Th>Destination</Th><Th>Clicks</Th><Th>Bots</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-[#FFE4D0]/60">
                <Td className="font-mono text-xs">{l.short_code}</Td>
                <Td className="text-xs text-[#7A5C45]">{l.owner_email}</Td>
                <Td>{l.title || <span className="text-[#A8907A]">—</span>}</Td>
                <Td className="max-w-[280px] truncate text-xs"><a href={l.adsterra_url} target="_blank" rel="noreferrer" className="text-[#FF7E5F] hover:underline">{l.adsterra_url}</a></Td>
                <Td>{l.clicks_count.toLocaleString()}</Td>
                <Td className="text-[#A8907A]">{l.bot_clicks_count.toLocaleString()}</Td>
                <Td>{l.is_active ? <span className="text-emerald-600 font-semibold">Active</span> : <span className="text-rose-600 font-semibold">Disabled</span>}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => toggleMut.mutate({ id: l.id, is_active: !l.is_active })} className="border-[#FFD4BB]">{l.is_active ? "Disable" : "Enable"}</Button>
                    <Button size="sm" variant="outline" onClick={() => { const url = prompt("New destination URL:", l.adsterra_url); if (url) updateMut.mutate({ id: l.id, adsterra_url: url }); }} className="border-[#FFD4BB]">Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => { if (confirm(`Delete link "${l.short_code}"?`)) delMut.mutate({ id: l.id }); }} className="border-rose-300 text-rose-600"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ===================== REVENUE =====================
function RevenueTab() {
  const qc = useQueryClient();
  const upgradesFn = useServerFn(adminListUpgradeRequests);
  const decideFn = useServerFn(adminDecideUpgradeRequest);
  const revTsFn = useServerFn(adminRevenueTimeseries);
  
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const daysMap = { "7d": 7, "30d": 30, "90d": 90 };

  const upgrades = useQuery({ queryKey: ["admin-upgrades"], queryFn: () => upgradesFn() });
  const ipFn = useServerFn(adminGetOutgoingIp);
  const outgoingIp = useQuery({ queryKey: ["plisio-outgoing-ip"], queryFn: () => ipFn(), staleTime: 5 * 60 * 1000 });
  const [reverifyResults, setReverifyResults] = useState<Record<string, { ok: boolean; msg: string; ip?: string; http?: number }>>({});
  const [bulkSummary, setBulkSummary] = useState<{ checked: number; recovered: number; ip: string; last_error: string | null } | null>(null);
  const revTs = useQuery({ 
    queryKey: ["admin-rev-ts", range], 
    queryFn: () => revTsFn({ data: { days: daysMap[range] } }) 
  });
  
  const statsFn = useServerFn(adminStats);
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn() });
  const s = stats.data;

  const decideMut = useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "reject" }) => decideFn({ data: v }),
    onSuccess: (_, v) => { toast.success(v.decision === "approve" ? "Approved" : "Rejected"); qc.invalidateQueries({ queryKey: ["admin-upgrades"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); qc.invalidateQueries({ queryKey: ["admin-rev-ts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const exportCsv = () => {
    const rows = upgrades.data ?? [];
    const csv = ["created_at,email,package,amount,status,invoice_id"].concat(rows.map((r) => `${r.created_at},${r.email},${r.package_slug},${r.amount},${r.status},${r.plisio_invoice_id ?? ""}`)).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `revenue-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const periodRevenue = (revTs.data ?? []).reduce((acc, curr) => acc + curr.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={DollarSign} label="Today Revenue" value={`$${(revTs.data?.[revTs.data.length - 1]?.revenue ?? 0).toFixed(2)}`} sub="UTC midnight" accent />
        <Kpi icon={TrendingUp} label="Yesterday" value={`$${(revTs.data?.[revTs.data.length - 2]?.revenue ?? 0).toFixed(2)}`} sub="Previous 24h" />
        <Kpi icon={Calendar} label={`Selected Period (${range})`} value={`$${periodRevenue.toFixed(2)}`} sub="Filtered sum" accent />
        <Kpi icon={Trophy} label="All-time Revenue" value={`$${(s?.total_revenue ?? 0).toFixed(2)}`} sub="Since start" />
      </div>

      <Panel icon={DollarSign} title="Revenue Analytics" subtitle="View performance trends across different timeframes">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex bg-white/60 p-1 rounded-xl border border-[#FFD4BB] w-fit">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  range === r ? "bg-[#FF7E5F] text-white shadow-md" : "text-[#7A5C45] hover:bg-white"
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-[#A8907A] tracking-wider">Average Daily</div>
            <div className="text-xl font-bold text-[#2D1B0D]">${(periodRevenue / (daysMap[range] || 1)).toFixed(2)}</div>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={revTs.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FFD4BB" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: "#7A5C45" }} 
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => val.split("-").slice(1).join("/")} 
              />
              <YAxis 
                tick={{ fontSize: 10, fill: "#7A5C45" }} 
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid #FFD4BB', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                formatter={(val: number) => [`$${val.toFixed(2)}`, "Revenue"]}
              />
              <Bar dataKey="revenue" fill="#FF7E5F" radius={[6, 6, 0, 0]} barSize={range === '7d' ? 40 : undefined} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel icon={CreditCard} title="Upgrade requests" subtitle="Approve, reject, export to CSV">
        {/* Plisio diagnostic banner: outgoing IP to whitelist + last bulk run summary */}
        <div className="mb-4 rounded-xl border border-[#FFD4BB] bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 text-xs text-[#7A5C45] flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-bold uppercase tracking-wider text-[10px] text-[#A8907A]">Plisio source IP</span>
          {outgoingIp.isLoading ? (
            <span className="italic">detecting…</span>
          ) : (
            <>
              <code className="font-mono font-bold text-[#2D1B0D] bg-white px-2 py-0.5 rounded border border-[#FFD4BB] select-all">
                {outgoingIp.data?.ip || "unknown"}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(outgoingIp.data?.ip || ""); toast.success("IP copied"); }}
                className="text-[#FF7E5F] hover:underline"
              >Copy</button>
              <span className="text-[#7A5C45]">→ Whitelist this in Plisio → API → Allowed IPs to fix “Invalid IP”.</span>
            </>
          )}
          {bulkSummary && (
            <div className="w-full mt-1 pt-1 border-t border-[#FFD4BB]/60">
              <span className="font-bold">Last bulk run:</span> checked {bulkSummary.checked}, recovered {bulkSummary.recovered}
              {bulkSummary.last_error && (
                <span className="text-rose-600"> · last error: <code className="font-mono">{bulkSummary.last_error}</code></span>
              )}
            </div>
          )}
        </div>

        <div className="mb-4 flex gap-2 flex-wrap">
          <Button size="sm" onClick={exportCsv} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">Export CSV</Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["admin-upgrades"] });
              toast.success("Refreshing order history...");
            }} 
            className="border-[#FFD4BB] flex items-center gap-2"
          >
            <RefreshCw className={`w-3 h-3 ${upgrades.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const tid = toast.loading("Asking Plisio about all recent orders…");
              try {
                const r = await adminBulkReverify();
                setBulkSummary({ checked: r.checked, recovered: r.recovered, ip: r.source_ip, last_error: r.last_error });
                if (r.last_error) {
                  toast.error(`Checked ${r.checked}, recovered ${r.recovered}. Plisio: ${r.last_error} (src ${r.source_ip})`, { id: tid });
                } else {
                  toast.success(`Checked ${r.checked} — recovered ${r.recovered} (src ${r.source_ip})`, { id: tid });
                }
                qc.invalidateQueries({ queryKey: ["admin-upgrades"] });
              } catch (e: any) {
                toast.error(e.message || "Bulk re-verify failed", { id: tid });
              }
            }}
            className="border-emerald-300 text-emerald-700"
          >
            🔄 Bulk re-verify with Plisio
          </Button>
        </div>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]"><Th>When</Th><Th>User</Th><Th>Package</Th><Th>Amount</Th><Th>Invoice</Th><Th>Status</Th><Th></Th></tr>
            </thead>
            <tbody>
              {upgrades.data?.length ? upgrades.data.map((r) => {
                const rv = reverifyResults[r.id];
                return (
                <tr key={r.id} className="border-t border-[#FFE4D0]/60">
                  <Td className="whitespace-nowrap text-[#7A5C45] text-xs">{new Date(r.created_at).toLocaleString()}</Td>
                  <Td>{r.email || r.user_id.slice(0, 8)}</Td>
                  <Td><Pill>{r.package_slug}</Pill></Td>
                  <Td className="font-semibold">${Number(r.amount).toFixed(2)}</Td>
                  <Td>{r.plisio_invoice_url ? <a href={r.plisio_invoice_url} target="_blank" rel="noreferrer" className="text-[#FF7E5F] font-semibold hover:underline">View</a> : <span className="text-[#A8907A]">—</span>}</Td>
                  <Td>
                    <StatusPill status={r.status} />
                    {rv && (
                      <div className={`mt-1 text-[10px] font-mono leading-tight ${rv.ok ? "text-emerald-700" : "text-rose-600"}`}>
                        {rv.ok ? "✓ " : "✗ "}{rv.msg}
                        {rv.ip && <div className="text-[#A8907A]">src: {rv.ip}{rv.http ? ` · HTTP ${rv.http}` : ""}</div>}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div className="flex gap-2 flex-wrap">
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => decideMut.mutate({ id: r.id, decision: "approve" })} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => decideMut.mutate({ id: r.id, decision: "reject" })} className="border-[#FFD4BB]">Reject</Button>
                        </>
                      )}
                      {r.status !== "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-300 text-emerald-700 text-xs"
                          onClick={async () => {
                            const tid = toast.loading("Checking with Plisio…");
                            try {
                              const res = await adminReverifyOrder({ data: { order_id: r.id } });
                              setReverifyResults((p) => ({ ...p, [r.id]: { ok: true, msg: `${res.action} · Plisio: ${res.plisio_status}`, ip: res.source_ip, http: res.http_status } }));
                              toast.success(`${res.action} (Plisio: ${res.plisio_status}) — src ${res.source_ip}`, { id: tid });
                              qc.invalidateQueries({ queryKey: ["admin-upgrades"] });
                            } catch (e: any) {
                              const msg = e?.message || "Re-verify failed";
                              setReverifyResults((p) => ({ ...p, [r.id]: { ok: false, msg, ip: e?.source_ip, http: e?.http_status } }));
                              toast.error(msg, { id: tid, duration: 8000 });
                            }
                          }}
                        >
                          Re-verify
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
                );
              }) : <tr><td colSpan={7} className="p-8 text-center text-[#A8907A]">No upgrade requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}


// ===================== PACKAGES =====================
type PkgForm = { id?: string; slug: string; name: string; price_usd: number; click_quota: number | null; link_limit: number | null; sort_order: number; is_active: boolean };
const emptyPkg: PkgForm = { slug: "", name: "", price_usd: 0, click_quota: null, link_limit: null, sort_order: 99, is_active: true };

function PackagesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListAllPackages);
  const upFn = useServerFn(adminUpsertPackage);
  const delFn = useServerFn(adminDeletePackage);
  const list = useQuery({ queryKey: ["admin-pkgs-all"], queryFn: () => listFn() });
  const [edit, setEdit] = useState<PkgForm | null>(null);
  const inv = () => { qc.invalidateQueries({ queryKey: ["admin-pkgs-all"] }); qc.invalidateQueries({ queryKey: ["admin-packages"] }); };
  const upMut = useMutation({ mutationFn: (v: PkgForm) => upFn({ data: v }), onSuccess: () => { toast.success("Saved"); inv(); setEdit(null); }, onError: (e: Error) => toast.error(e.message) });
  const delMut = useMutation({ mutationFn: (v: { id: string }) => delFn({ data: v }), onSuccess: () => { toast.success("Deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });

  return (
    <Panel icon={Package} title="Packages" subtitle="Create, edit, delete pricing tiers">
      <div className="mb-4"><Button onClick={() => setEdit(emptyPkg)} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0"><Plus className="w-4 h-4 mr-1" />New package</Button></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.data?.map((p) => (
          <div key={p.id} className={`p-4 rounded-2xl border ${p.is_active ? "bg-white/70 border-[#FFD4BB]" : "bg-white/30 border-[#A8907A]/40"}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-[#7A5C45]">{p.slug}</div>
                <div className="text-lg font-bold text-[#2D1B0D]">{p.name}</div>
              </div>
              <span className="text-2xl font-extrabold text-[#FF7E5F]">${Number(p.price_usd).toFixed(2)}</span>
            </div>
            <div className="mt-2 text-xs text-[#7A5C45]">{p.click_quota == null ? "∞" : p.click_quota.toLocaleString()} clicks · {p.link_limit == null ? "∞" : p.link_limit} links</div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit({ id: p.id, slug: p.slug, name: p.name, price_usd: Number(p.price_usd), click_quota: p.click_quota, link_limit: p.link_limit, sort_order: p.sort_order, is_active: p.is_active })} className="border-[#FFD4BB]">Edit</Button>
              <Button size="sm" variant="outline" onClick={() => { if (confirm(`Delete ${p.name}?`)) delMut.mutate({ id: p.id }); }} className="border-rose-300 text-rose-600"><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit package" : "New package"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <Field label="Slug (lowercase, no spaces)"><input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} className={inputCls} /></Field>
              <Field label="Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price USD"><input type="number" step="0.01" value={edit.price_usd} onChange={(e) => setEdit({ ...edit, price_usd: Number(e.target.value) })} className={inputCls} /></Field>
                <Field label="Sort order"><input type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} className={inputCls} /></Field>
                <Field label="Click quota (blank = ∞)"><input type="number" value={edit.click_quota ?? ""} onChange={(e) => setEdit({ ...edit, click_quota: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls} /></Field>
                <Field label="Link limit (blank = ∞)"><input type="number" value={edit.link_limit ?? ""} onChange={(e) => setEdit({ ...edit, link_limit: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> Active</label>
              <Button onClick={() => upMut.mutate(edit)} disabled={upMut.isPending} className="w-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">{upMut.isPending ? "Saving…" : "Save"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

// ===================== RULES (bot + cloaking) =====================
type RuleForm = { id?: string; rule_type: string; pattern: string; action: string; label: string; is_active: boolean; priority?: number };

function RulesTab() {
  return (
    <div className="space-y-6">
      <RuleSection title="Bot rules" icon={Bot} listFnRef={adminListBotRules} upFnRef={adminUpsertBotRule} delFnRef={adminDeleteBotRule} keyName="bot-rules" showPriority={false} />
      <RuleSection title="Cloaking rules" icon={ShieldCheck} listFnRef={adminListCloakingRules} upFnRef={adminUpsertCloakingRule} delFnRef={adminDeleteCloakingRule} keyName="cloak-rules" showPriority />
    </div>
  );
}

function RuleSection({ title, icon, listFnRef, upFnRef, delFnRef, keyName, showPriority }: {
  title: string; icon: React.ComponentType<{ className?: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listFnRef: any; upFnRef: any; delFnRef: any;
  keyName: string; showPriority: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listFnRef);
  const upFn = useServerFn(upFnRef);
  const delFn = useServerFn(delFnRef);
  const list = useQuery({ queryKey: [keyName], queryFn: () => listFn() });
  const [edit, setEdit] = useState<RuleForm | null>(null);
  const inv = () => qc.invalidateQueries({ queryKey: [keyName] });
  const upMut = useMutation({ mutationFn: (v: RuleForm) => upFn({ data: v as never }), onSuccess: () => { toast.success("Saved"); inv(); setEdit(null); }, onError: (e: Error) => toast.error(e.message) });
  const delMut = useMutation({ mutationFn: (v: { id: string }) => delFn({ data: v }), onSuccess: () => { toast.success("Deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });

  return (
    <Panel icon={icon} title={title}>
      <div className="mb-4"><Button onClick={() => setEdit({ rule_type: "ua", pattern: "", action: "safe", label: "", is_active: true, priority: showPriority ? 100 : undefined })} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0"><Plus className="w-4 h-4 mr-1" />New rule</Button></div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]"><Th>Type</Th><Th>Pattern</Th><Th>Action</Th><Th>Label</Th>{showPriority && <Th>Pri</Th>}<Th>Active</Th><Th></Th></tr></thead>
          <tbody>
            {list.data?.map((r: any) => (
              <tr key={r.id} className="border-t border-[#FFE4D0]/60">
                <Td><Pill>{r.rule_type}</Pill></Td>
                <Td className="font-mono text-xs max-w-[280px] truncate">{r.pattern}</Td>
                <Td><Pill>{r.action}</Pill></Td>
                <Td className="text-[#7A5C45] text-xs">{r.label ?? "—"}</Td>
                {showPriority && <Td>{(r as { priority?: number }).priority}</Td>}
                <Td>{r.is_active ? <span className="text-emerald-600 font-semibold">Yes</span> : <span className="text-rose-600 font-semibold">No</span>}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEdit({ id: r.id, rule_type: r.rule_type, pattern: r.pattern, action: r.action, label: r.label ?? "", is_active: r.is_active, priority: (r as { priority?: number }).priority })} className="border-[#FFD4BB]">Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => { if (confirm("Delete?")) delMut.mutate({ id: r.id }); }} className="border-rose-300 text-rose-600"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit rule" : "New rule"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <Field label="Type (ua, ip, asn, header…)"><input value={edit.rule_type} onChange={(e) => setEdit({ ...edit, rule_type: e.target.value })} className={inputCls} /></Field>
              <Field label="Pattern (regex or substring)"><input value={edit.pattern} onChange={(e) => setEdit({ ...edit, pattern: e.target.value })} className={inputCls} /></Field>
              <Field label="Action (safe, block, allow…)"><input value={edit.action} onChange={(e) => setEdit({ ...edit, action: e.target.value })} className={inputCls} /></Field>
              <Field label="Label (optional)"><input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} className={inputCls} /></Field>
              {showPriority && <Field label="Priority (lower = earlier)"><input type="number" value={edit.priority ?? 100} onChange={(e) => setEdit({ ...edit, priority: Number(e.target.value) })} className={inputCls} /></Field>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> Active</label>
              <Button onClick={() => upMut.mutate(edit)} disabled={upMut.isPending} className="w-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">{upMut.isPending ? "Saving…" : "Save"}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

// ===================== GEO TIERS =====================
function GeoTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCountryTiers);
  const upFn = useServerFn(adminUpsertCountryTier);
  const delFn = useServerFn(adminDeleteCountryTier);
  const list = useQuery({ queryKey: ["geo-tiers"], queryFn: () => listFn() });
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [tier, setTier] = useState(1);
  const inv = () => qc.invalidateQueries({ queryKey: ["geo-tiers"] });
  const upMut = useMutation({ mutationFn: (v: { country_code: string; country_name: string | null; tier: number }) => upFn({ data: v }), onSuccess: () => { toast.success("Saved"); inv(); setCode(""); setName(""); }, onError: (e: Error) => toast.error(e.message) });
  const delMut = useMutation({ mutationFn: (v: { country_code: string }) => delFn({ data: v }), onSuccess: () => { toast.success("Deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });

  return (
    <Panel icon={Globe} title="Country tiers" subtitle="Tier 1 = highest payout, Tier 5 = lowest">
      <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-2">
        <input placeholder="CC (2 letters)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={2} className={inputCls} />
        <input placeholder="Country name" value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} md:col-span-2`} />
        <select value={tier} onChange={(e) => setTier(Number(e.target.value))} className={inputCls}>{[1, 2, 3, 4, 5].map((t) => <option key={t} value={t}>Tier {t}</option>)}</select>
        <Button onClick={() => upMut.mutate({ country_code: code, country_name: name || null, tier })} disabled={code.length !== 2} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0">Add / Update</Button>
      </div>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]"><Th>Code</Th><Th>Name</Th><Th>Tier</Th><Th></Th></tr></thead>
          <tbody>
            {list.data?.map((r) => (
              <tr key={r.country_code} className="border-t border-[#FFE4D0]/60">
                <Td className="font-mono font-bold">{r.country_code}</Td>
                <Td>{r.country_name ?? "—"}</Td>
                <Td><Pill>Tier {r.tier}</Pill></Td>
                <Td><Button size="sm" variant="outline" onClick={() => { if (confirm(`Remove ${r.country_code}?`)) delMut.mutate({ country_code: r.country_code }); }} className="border-rose-300 text-rose-600"><X className="w-3 h-3" /></Button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ===================== TRAFFIC SETTINGS =====================
function TrafficTab() {
  const qc = useQueryClient();
  const settingsFn = useServerFn(getAppSettings);
  const updateSettingsFn = useServerFn(updateAppSettings);
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: () => settingsFn() });
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [ourUrl, setOurUrl] = useState("");
  const [threshold, setThreshold] = useState(900);
  const [count, setCount] = useState(100);
  const [dailyOn, setDailyOn] = useState(true);
  const [spOn, setSpOn] = useState(false);
  const [spGmail, setSpGmail] = useState(true);
  const [spBlock, setSpBlock] = useState(true);
  const [spIpMax, setSpIpMax] = useState(2);
  const [fbReviewOn, setFbReviewOn] = useState(true);
  useEffect(() => {
    if (settings.data) {
      const s: any = settings.data;
      setFallbackUrl(s.fallback_url ?? "");
      setOurUrl(s.our_adsterra_url ?? "");
      setThreshold(s.injection_threshold ?? 900);
      setCount(s.injection_count ?? 100);
      setDailyOn(s.daily_redirect_enabled ?? true);
      setSpOn(s.signup_protection_enabled ?? false);
      setSpGmail(s.signup_gmail_only ?? true);
      setSpBlock(s.signup_blocklist_enabled ?? true);
      setSpIpMax(s.signup_ip_max_per_day ?? 2);
      setFbReviewOn(s.fb_review_protection_enabled ?? true);
    }
  }, [settings.data]);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: any = {
        fallback_url: fallbackUrl,
        our_adsterra_url: ourUrl,
        injection_threshold: Number(threshold),
        injection_count: Number(count),
        daily_redirect_enabled: dailyOn,
        signup_protection_enabled: spOn,
        signup_gmail_only: spGmail,
        signup_blocklist_enabled: spBlock,
        signup_ip_max_per_day: Number(spIpMax),
        fb_review_protection_enabled: fbReviewOn,
      };
      // Only include support_enabled if it exists in the database record
      if ('support_enabled' in (settings.data || {})) {
        payload.support_enabled = (settings.data as any).support_enabled;
      }
      return updateSettingsFn({ data: payload });
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["app-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <>
      <TrafficSnapshotPanel />
      <div className="h-6" />
    <Panel icon={Settings2} title="Traffic & Monetization">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Fallback / Daily redirect URL"><input value={fallbackUrl} onChange={(e) => setFallbackUrl(e.target.value)} className={inputCls} /></Field>
        <Field label="Our Adsterra Direct URL"><input value={ourUrl} onChange={(e) => setOurUrl(e.target.value)} className={inputCls} /></Field>
        <Field label="Injection threshold"><input type="number" min={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={inputCls} /></Field>
        <Field label="Injection count"><input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputCls} /></Field>
        <label className="sm:col-span-2 flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={dailyOn} onChange={(e) => setDailyOn(e.target.checked)} className="w-4 h-4 accent-[#FF7E5F]" />
          <span className="text-sm">Daily auto-redirect on first dashboard login</span>
        </label>
      </div>

      <div className="mt-8 pt-6 border-t border-[#FFD4BB]">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[#FF7E5F] mb-1">FB Ad-Review Protection</h3>
        <p className="text-xs text-[#7A5C45] mb-4">নতুন লিংকের প্রথম ৬ ঘন্টা বা ২৫ ক্লিক পর্যন্ত FB/IG in-app browser-কে safe page দেখায় (ad reviewer যেন offer না দেখে)। <b>Ad approved হয়ে campaign run হলে এটা OFF করে দিন</b> — সব FB user offer পাবে, traffic 100% count হবে।</p>
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-white/60 border border-[#FFD4BB]">
          <input type="checkbox" checked={fbReviewOn} onChange={(e) => setFbReviewOn(e.target.checked)} className="w-5 h-5 accent-[#FF7E5F]" />
          <span className="text-sm font-semibold">🛡️ Enable FB Ad-Review Protection (turn OFF after ad approved)</span>
        </label>
      </div>


      <div className="mt-8 pt-6 border-t border-[#FFD4BB]">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[#FF7E5F] mb-1">Signup Protection</h3>
        <p className="text-xs text-[#7A5C45] mb-4">Master switch must be ON for any rule below to apply. Default OFF — turn ON when you're ready.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-white/60 border border-[#FFD4BB]">
            <input type="checkbox" checked={spOn} onChange={(e) => setSpOn(e.target.checked)} className="w-5 h-5 accent-[#FF7E5F]" />
            <span className="text-sm font-semibold">🛡️ Enable Signup Protection (master switch)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-white/60 border border-[#FFE4D0]">
            <input type="checkbox" checked={spGmail} onChange={(e) => setSpGmail(e.target.checked)} disabled={!spOn} className="w-4 h-4 accent-[#FF7E5F]" />
            <span className="text-sm">Allow only Gmail (@gmail.com)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-white/60 border border-[#FFE4D0]">
            <input type="checkbox" checked={spBlock} onChange={(e) => setSpBlock(e.target.checked)} disabled={!spOn} className="w-4 h-4 accent-[#FF7E5F]" />
            <span className="text-sm">Block disposable / temp email domains</span>
          </label>
          <Field label="Max signups per IP per day (0 = unlimited)">
            <input type="number" min={0} max={100} value={spIpMax} onChange={(e) => setSpIpMax(Number(e.target.value))} disabled={!spOn} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="mt-6"><Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white border-0"><Sparkles className="w-4 h-4 mr-1.5" />{saveMut.isPending ? "Saving…" : "Save settings"}</Button></div>
    </Panel>
    </>
  );
}

// ===================== TRAFFIC SNAPSHOT (mini live dashboard) =====================
function TrafficSnapshotPanel() {
  const snapFn = useServerFn(adminTrafficSnapshot);
  const snap = useQuery({
    queryKey: ["admin-traffic-snapshot"],
    queryFn: () => snapFn(),
    refetchInterval: 60_000, // refresh every 60s to reduce DB load
    staleTime: 60_000,
  });
  const d = snap.data;
  return (
    <Panel icon={TrendingUp} title="Live Traffic Snapshot (last 24h)" subtitle="Auto-refresh every 60s">

      {!d ? (
        <div className="text-sm text-[#7A5C45]">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={MousePointerClick} label="Total clicks 24h" value={d.total24h.toLocaleString()} sub={`${d.total1h.toLocaleString()} in last 1h`} />
            <Kpi icon={Users} label="Real users (humans)" value={`${d.humans24h.toLocaleString()}`} sub={`${d.humanPct}% of total`} accent />
            <Kpi icon={Bot} label="Bots blocked" value={d.bots24h.toLocaleString()} sub={`${d.botPct}% of total`} />
            <Kpi icon={Target} label="Offer success" value={`${d.offerSuccessPct}%`} sub={`${d.offer24h.toLocaleString()} hit offer`} />
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Offer (real)" value={d.offer24h.toLocaleString()} />
            <Stat label="Our Adsterra" value={d.ours24h.toLocaleString()} />
            <Stat label="Safe / blocked" value={d.safe24h.toLocaleString()} />
            <Stat label="FB crawler blocked" value={d.fbCrawlerBlocked.toLocaleString()} />
          </div>
          {d.botPct > 40 && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex gap-2 items-start">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                Bot rate <b>{d.botPct}%</b> — যদি FB campaign চলছে তাহলে নিচে <b>FB Ad-Review Protection</b> OFF করুন। Top bot reasons:&nbsp;
                {d.topBotReasons.map((r) => `${r.key}(${r.count})`).join(", ")}
              </div>
            </div>
          )}
          {d.botPct <= 40 && d.topBotReasons.length > 0 && (
            <div className="mt-4 text-xs text-[#7A5C45]">
              <b>Top bot reasons:</b> {d.topBotReasons.map((r) => `${r.key} (${r.count})`).join(" · ")}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}


// ===================== shared UI =====================
const inputCls = "w-full bg-white/70 border border-[#FFD4BB] rounded-xl px-4 py-2.5 text-sm text-[#2D1B0D] placeholder:text-[#A8907A] focus:outline-none focus:border-[#FF7E5F] focus:bg-white/90 transition-all";

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className={`relative rounded-2xl p-5 border backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(255,126,95,0.25)] ${accent ? "bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] border-white/40 text-white" : "bg-white/70 border-white/80 text-[#2D1B0D]"}`}>
      <div className="flex items-center justify-between">
        <div className={`text-[10px] font-bold uppercase tracking-widest ${accent ? "text-white/80" : "text-[#7A5C45]"}`}>{label}</div>
        <Icon className={`w-4 h-4 ${accent ? "text-white/90" : "text-[#FF7E5F]"}`} />
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className={`mt-1 text-[10px] ${accent ? "text-white/80" : "text-[#A8907A]"}`}>{sub}</div>}
    </div>
  );
}
function Panel({ icon: Icon, title, subtitle, children }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/80 bg-white/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(255,126,95,0.35)]">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center shadow-[0_6px_20px_-6px_rgba(255,126,95,0.6)]"><Icon className="w-4 h-4 text-white" /></div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#2D1B0D] tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-[#7A5C45] mb-6 ml-12">{subtitle}</p>}
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A5C45] mb-2 block">{label}</label>{children}</div>;
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="p-3 rounded-xl bg-white/60 border border-[#FFE4D0]"><div className="text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]">{label}</div><div className="mt-1 font-bold text-[#2D1B0D]">{value}</div></div>;
}
function Th({ children }: { children?: React.ReactNode }) { return <th className="px-3 py-3">{children}</th>; }
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <td className={`px-3 py-3 ${className}`}>{children}</td>; }
function Pill({ children }: { children: React.ReactNode }) { return <span className="inline-flex px-2 py-0.5 rounded-md bg-[#FFEDD5] text-[#FF7E5F] text-xs font-semibold">{children}</span>; }
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = { 
    paid: "bg-emerald-100 text-emerald-700", 
    completed: "bg-emerald-100 text-emerald-700", 
    successful: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700", 
    expired: "bg-rose-100 text-rose-700",
    cancelled: "bg-rose-100 text-rose-700",
    rejected: "bg-rose-100 text-rose-700" 
  };
  const label = status === "paid" ? "successful" : status;
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${map[status] ?? "bg-[#FFEDD5] text-[#7A5C45]"}`}>{label}</span>;

}

/* ============== Shortener Domains (admin) ============== */
function DomainsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listShortenerDomains);
  const addFn = useServerFn(addShortenerDomain);
  const verifyFn = useServerFn(verifyShortenerDomain);
  const primaryFn = useServerFn(setPrimaryShortenerDomain);
  const toggleFn = useServerFn(toggleShortenerDomainActive);
  const delFn = useServerFn(deleteShortenerDomain);

  const q = useQuery({ queryKey: ["sd-list"], queryFn: () => listFn(), staleTime: 15_000 });
  const [domain, setDomain] = useState("");
  const [note, setNote] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sd-list"] });

  const add = useMutation({
    mutationFn: () => addFn({ data: { domain, note: note || undefined } }),
    onSuccess: () => { setDomain(""); setNote(""); toast.success("Domain added — now verify DNS"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const verify = useMutation({
    mutationFn: (id: string) => verifyFn({ data: { id } }),
    onSuccess: (r: any) => { r.ok ? toast.success(r.message) : toast.error(r.message); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const setPrimary = useMutation({
    mutationFn: (id: string) => primaryFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Primary domain switched. All new short URLs use this domain.");
      invalidate();
      qc.invalidateQueries({ queryKey: ["primary-shortener-domain"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const toggleActive = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const domains: any[] = q.data?.domains ?? [];

  return (
    <section className="rounded-3xl border border-white/80 bg-white/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(255,126,95,0.35)]">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-[#FF7E5F]" />
        <h3 className="text-lg font-bold text-[#2D1B0D]">Shortener Domain Pool</h3>
      </div>
      <p className="text-sm text-[#7A5C45] mb-5">
        Add backup domains that point to your VPS (A record → <span className="font-mono">185.158.133.1</span>).
        If the current primary gets blocked, verify a new one and click <strong>Set Primary</strong> — every short URL
        instantly uses the new domain. Old short URLs on still-resolving domains keep working too.
      </p>

      <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 mb-6 p-4 rounded-2xl bg-white/60 border border-white/80">
        <input
          value={domain} onChange={(e) => setDomain(e.target.value)}
          placeholder="e.g. trk.example.com"
          className="px-4 py-2.5 rounded-xl bg-white border border-[#FFE4D2] text-sm font-mono outline-none focus:border-[#FF7E5F]"
        />
        <input
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="px-4 py-2.5 rounded-xl bg-white border border-[#FFE4D2] text-sm outline-none focus:border-[#FF7E5F]"
        />
        <Button onClick={() => domain.trim() && add.mutate()} disabled={add.isPending} className="bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white">
          <Plus className="w-4 h-4 mr-1" /> Add Domain
        </Button>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-[#7A5C45]">Loading…</p>
      ) : domains.length === 0 ? (
        <p className="text-sm text-[#7A5C45]">No domains in pool yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#FFE4D2] bg-white/70">
          <table className="w-full text-sm">
            <thead className="bg-[#FFF3E8] text-[#7A5C45]">
              <tr>
                <th className="text-left px-4 py-3">Domain</th>
                <th className="text-left px-4 py-3">DNS Target</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Note</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FFEDD5]">
              {domains.map((d) => (
                <tr key={d.id} className="hover:bg-[#FFF9F5]">
                  <td className="px-4 py-3 font-mono font-semibold text-[#2D1B0D]">
                    {d.domain}
                    {d.is_primary && <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider"><Star className="w-3 h-3" />Primary</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#7A5C45]">{d.dns_target}</td>
                  <td className="px-4 py-3">
                    {d.verified ? <Pill>Verified</Pill> : <span className="text-xs text-amber-600 font-semibold">Pending DNS</span>}
                    {!d.is_active && <span className="ml-2 text-xs text-rose-600 font-semibold">Inactive</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#7A5C45]">{d.note ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => verify.mutate(d.id)} disabled={verify.isPending}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Verify
                      </Button>
                      {!d.is_primary && d.verified && d.is_active && (
                        <Button size="sm" onClick={() => { if (confirm(`Switch primary to ${d.domain}? All new short URLs will use it.`)) setPrimary.mutate(d.id); }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Check className="w-3 h-3 mr-1" /> Set Primary
                        </Button>
                      )}
                      {!d.is_primary && (
                        <Button size="sm" variant="outline" onClick={() => toggleActive.mutate({ id: d.id, is_active: !d.is_active })}>
                          {d.is_active ? "Disable" : "Enable"}
                        </Button>
                      )}
                      {!d.is_primary && (
                        <Button size="sm" variant="outline" onClick={() => { if (confirm(`Delete ${d.domain}?`)) del.mutate(d.id); }} className="border-rose-300 text-rose-600">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
        <p className="font-bold">Setup steps for a new domain:</p>
        <ol className="list-decimal pl-5 space-y-0.5">
          <li>At your registrar, add an <strong>A record</strong>: <span className="font-mono">@ → 185.158.133.1</span> (and optionally <span className="font-mono">www → 185.158.133.1</span>).</li>
          <li>On the VPS, add the domain to Nginx/Caddy config and issue an SSL cert.</li>
          <li>Click <strong>Verify</strong> — DNS check via Cloudflare DoH.</li>
          <li>Click <strong>Set Primary</strong> when ready. All short links auto-switch.</li>
        </ol>
      </div>
    </section>
  );
}

function UserDomainsTab() {
  const qc = useQueryClient();
  const detailFn = useServerFn(adminUserDetail);
  
  // We can just query custom_domains directly since we are admin
  const q = useQuery({
    queryKey: ["admin-user-custom-domains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_domains")
        .select(`
          id, domain, verified, created_at, user_id,
          profiles ( email )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-user-custom-domains"] });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_domains").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message)
  });

  const domains = q.data ?? [];

  return (
    <Panel icon={Globe} title="User Custom Domains" subtitle="Manage and monitor domains added by users">
      <div className="overflow-x-auto rounded-2xl border border-[#FFE4D2] bg-white/70">
        <table className="w-full text-sm">
          <thead className="bg-[#FFF3E8] text-[#7A5C45]">
            <tr>
              <th className="text-left px-4 py-3">Domain</th>
              <th className="text-left px-4 py-3">Owner</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#FFEDD5]">
            {domains.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-[#A8907A]">No user domains yet.</td></tr>
            ) : (
              domains.map((d: any) => (
                <tr key={d.id} className="hover:bg-[#FFF9F5]">
                  <td className="px-4 py-3 font-mono font-semibold text-[#2D1B0D]">{d.domain}</td>
                  <td className="px-4 py-3 text-xs text-[#7A5C45]">{(d.profiles as any)?.email ?? d.user_id}</td>
                  <td className="px-4 py-3">
                    {d.verified ? <Pill>Verified</Pill> : <span className="text-xs text-amber-600 font-semibold">Pending</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#7A5C45]">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => { if (confirm(`Delete user domain ${d.domain}?`)) delMut.mutate(d.id); }} className="border-rose-300 text-rose-600">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ============================================================================
// SUPPORT TAB (Admin)
// ============================================================================
function SupportTab() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getSupportStatus);
  const toggleFn = useServerFn(toggleSupport);
  const listFn = useServerFn(adminListTickets);
  const replyFn = useServerFn(adminReplyTicket);
  const closeFn = useServerFn(adminCloseTicket);
  const delFn = useServerFn(adminDeleteTicket);

  const [filter, setFilter] = useState<"all" | "open" | "replied" | "closed">("open");
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  const statusQ = useQuery({ queryKey: ["support-status-admin"], queryFn: () => statusFn(), staleTime: 30_000 });
  const ticketsQ = useQuery({
    queryKey: ["admin-tickets", filter],
    queryFn: () => listFn({ data: { status: filter, limit: 200 } }),
    staleTime: 15_000,
  });

  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) => toggleFn({ data: { enabled } }),
    onSuccess: (r) => { toast.success(r.enabled ? "Support enabled" : "Support disabled"); qc.invalidateQueries({ queryKey: ["support-status-admin"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const replyMut = useMutation({
    mutationFn: (d: { ticket_id: string; reply: string }) => replyFn({ data: d }),
    onSuccess: (_r, vars) => { toast.success("Reply sent"); setReplyMap((m) => ({ ...m, [vars.ticket_id]: "" })); qc.invalidateQueries({ queryKey: ["admin-tickets"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const closeMut = useMutation({ mutationFn: (id: string) => closeFn({ data: { ticket_id: id } }), onSuccess: () => { toast.success("Closed"); qc.invalidateQueries({ queryKey: ["admin-tickets"] }); } });
  const delMut = useMutation({ mutationFn: (id: string) => delFn({ data: { ticket_id: id } }), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-tickets"] }); } });

  const enabled = statusQ.data?.enabled !== false;
  const tickets = ticketsQ.data ?? [];

  return (
    <section className="mt-6 space-y-5">
      <div className="rounded-2xl bg-white/80 border border-[#FFEDD5] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${enabled ? "bg-gradient-to-br from-emerald-400 to-emerald-600" : "bg-gradient-to-br from-gray-400 to-gray-600"} shadow-md`}>
            <LifeBuoy className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-[#2D1B0D]">Support System</div>
            <div className="text-[11px] text-[#A38D7D]">{enabled ? "Users can send messages" : "New tickets are disabled"}</div>
          </div>
        </div>
        <button
          onClick={() => toggleMut.mutate(!enabled)}
          disabled={toggleMut.isPending}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-2 transition-all ${enabled ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"}`}
        >
          {enabled ? <><PowerOff className="w-3.5 h-3.5" /> Disable</> : <><Power className="w-3.5 h-3.5" /> Enable</>}
        </button>
      </div>

      <div className="flex gap-1 bg-[#FFEDD5]/60 p-1 rounded-xl w-fit">
        {(["all", "open", "replied", "closed"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all ${filter === s ? "bg-[#FF7E5F] text-white shadow-sm" : "text-[#A38D7D] hover:text-[#7D6452]"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {ticketsQ.isLoading && <div className="text-xs text-[#A38D7D] p-6 text-center">Loading…</div>}
        {!ticketsQ.isLoading && tickets.length === 0 && <div className="text-xs text-[#A38D7D] p-10 text-center bg-white/60 border border-[#FFEDD5] rounded-2xl">No tickets</div>}
        {tickets.map((t: any) => (
          <div key={t.id} className="rounded-2xl bg-white border border-[#FFEDD5] shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-amber-100 text-amber-700" : t.status === "replied" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{t.status}</span>
                  <span className="text-[10px] text-[#A38D7D]">{new Date(t.created_at).toLocaleString()}</span>
                </div>
                <div className="font-bold text-sm text-[#2D1B0D]">{t.subject}</div>
                <div className="text-[11px] text-[#A38D7D] mt-0.5">From: {t.user_email ?? t.user_name ?? t.user_id}</div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {t.status !== "closed" && <button onClick={() => closeMut.mutate(t.id)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
                <button onClick={() => { if (confirm("Delete?")) delMut.mutate(t.id); }} className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="rounded-xl bg-[#FFF9F5] border border-[#FFEDD5] p-3 mb-3">
              <div className="text-[10px] font-bold text-[#A38D7D] uppercase mb-1">User message</div>
              <div className="text-[12.5px] whitespace-pre-wrap leading-relaxed">{t.message}</div>
            </div>
            {t.admin_reply && (
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 p-3 mb-3">
                <div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Previous reply</div>
                <div className="text-[12.5px] whitespace-pre-wrap leading-relaxed">{t.admin_reply}</div>
              </div>
            )}
            {t.status !== "closed" && (
              <div className="flex gap-2">
                <textarea
                  value={replyMap[t.id] ?? ""}
                  onChange={(e) => setReplyMap((m) => ({ ...m, [t.id]: e.target.value }))}
                  placeholder="Type your reply…"
                  rows={2}
                  className="flex-1 bg-[#FFF9F5] border border-[#FFEDD5] rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#FF7E5F]/50 resize-none"
                />
                <button
                  onClick={() => { const r = (replyMap[t.id] ?? "").trim(); if (!r) return toast.error("Reply empty"); replyMut.mutate({ ticket_id: t.id, reply: r }); }}
                  disabled={replyMut.isPending}
                  className="px-4 rounded-xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-bold text-xs shadow-md hover:shadow-lg inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// BROADCASTS TAB (Admin)
// ============================================================================
const BROADCAST_ICONS = [
  { id: "sparkles", Icon: Sparkles }, { id: "megaphone", Icon: Megaphone },
  { id: "gift", Icon: Gift }, { id: "crown", Icon: Crown },
  { id: "rocket", Icon: Rocket }, { id: "trophy", Icon: Trophy },
  { id: "star", Icon: Star }, { id: "zap", Icon: Zap },
  { id: "info", Icon: Info }, { id: "warning", Icon: AlertTriangle },
];
const BROADCAST_TONES = [
  { id: "premium", label: "Premium", cls: "from-[#FF7E5F] to-[#FEB47B]" },
  { id: "info", label: "Info", cls: "from-blue-500 to-blue-600" },
  { id: "success", label: "Success", cls: "from-emerald-500 to-emerald-600" },
  { id: "warning", label: "Warning", cls: "from-amber-500 to-orange-600" },
] as const;

function BroadcastsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListBroadcasts);
  const createFn = useServerFn(adminCreateBroadcast);
  const toggleFn = useServerFn(adminToggleBroadcast);
  const delFn = useServerFn(adminDeleteBroadcast);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [icon, setIcon] = useState("sparkles");
  const [tone, setTone] = useState<"premium" | "info" | "success" | "warning">("premium");

  const listQ = useQuery({ queryKey: ["admin-broadcasts"], queryFn: () => listFn(), staleTime: 30_000 });

  const createMut = useMutation({
    mutationFn: (d: any) => createFn({ data: d }),
    onSuccess: () => { toast.success("Broadcast sent to all users"); setTitle(""); setBody(""); qc.invalidateQueries({ queryKey: ["admin-broadcasts"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const toggleMut = useMutation({
    mutationFn: (d: { id: string; is_active: boolean }) => toggleFn({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-broadcasts"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-broadcasts"] }); },
  });

  const items = listQ.data ?? [];
  const PreviewIcon = BROADCAST_ICONS.find((i) => i.id === icon)?.Icon ?? Sparkles;
  const previewTone = BROADCAST_TONES.find((t) => t.id === tone) ?? BROADCAST_TONES[0];

  return (
    <section className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* Composer */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl bg-white border border-[#FFEDD5] shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-[#FFF9F5] to-[#FFEDD5]/40 border-b border-[#FFEDD5] flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#FF7E5F]" />
            <h3 className="text-sm font-extrabold">Send Broadcast</h3>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <label className="text-[10px] font-bold text-[#7D6452] uppercase">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="mt-1 w-full bg-[#FFF9F5] border border-[#FFEDD5] rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#FF7E5F]/50" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-[#7D6452] uppercase">Message ({body.length}/2000) — Markdown supported</label>
              </div>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {[
                  { label: "B", title: "Bold", wrap: "**" },
                  { label: "I", title: "Italic", wrap: "*" },
                  { label: "H", title: "Heading", prefix: "## " },
                  { label: "• List", title: "Bullet", prefix: "- " },
                  { label: "1. List", title: "Numbered", prefix: "1. " },
                  { label: "Link", title: "Link", insert: "[text](https://)" },
                  { label: "---", title: "Divider", insert: "\n---\n" },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("broadcast-body") as HTMLTextAreaElement | null;
                      if (!el) return;
                      const s = el.selectionStart, e = el.selectionEnd;
                      const sel = body.slice(s, e);
                      let next = body;
                      if (b.wrap) next = body.slice(0, s) + b.wrap + (sel || b.title.toLowerCase()) + b.wrap + body.slice(e);
                      else if (b.prefix) next = body.slice(0, s) + b.prefix + (sel || b.title) + body.slice(e);
                      else if (b.insert) next = body.slice(0, s) + b.insert + body.slice(e);
                      setBody(next.slice(0, 2000));
                      setTimeout(() => el.focus(), 0);
                    }}
                    title={b.title}
                    className="text-[10px] font-bold px-2 py-1 rounded-md bg-[#FFF9F5] border border-[#FFEDD5] text-[#7D6452] hover:border-[#FF7E5F]/50 hover:text-[#FF7E5F]"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <textarea id="broadcast-body" value={body} onChange={(e) => setBody(e.target.value.slice(0, 2000))} rows={8} placeholder={"## 🏆 The Prize: $500 Bonus\n\nDear members,\n\n**Event Timeline:**\n- Start: Right now\n- End: July 15th\n\n1. Fire up your links\n2. Scale your traffic\n3. Monitor dashboard"} className="w-full bg-[#FFF9F5] border border-[#FFEDD5] rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-[#FF7E5F]/50 resize-y font-mono" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#7D6452] uppercase">Icon</label>
              <div className="mt-1 grid grid-cols-5 gap-1.5">
                {BROADCAST_ICONS.map(({ id, Icon }) => (
                  <button key={id} onClick={() => setIcon(id)} className={`aspect-square rounded-lg flex items-center justify-center transition-all ${icon === id ? "bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] text-white shadow-md" : "bg-[#FFF9F5] border border-[#FFEDD5] text-[#7D6452] hover:border-[#FF7E5F]/40"}`}>
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#7D6452] uppercase">Tone</label>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {BROADCAST_TONES.map((t) => (
                  <button key={t.id} onClick={() => setTone(t.id)} className={`py-2 rounded-lg text-[11px] font-bold transition-all ${tone === t.id ? `bg-gradient-to-r ${t.cls} text-white shadow-md` : "bg-[#FFF9F5] border border-[#FFEDD5] text-[#7D6452]"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => { if (!title.trim() || !body.trim()) return toast.error("Title + message required"); createMut.mutate({ title: title.trim(), body: body.trim(), icon, tone }); }}
              disabled={createMut.isPending}
              className="w-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {createMut.isPending ? "Sending…" : "Broadcast to all users"}
            </button>
          </div>
        </div>

        {/* Preview */}
        {(title || body) && (
          <div className="rounded-2xl bg-white border border-[#FFEDD5] p-4">
            <div className="text-[10px] font-bold text-[#A38D7D] uppercase mb-3">Live preview</div>
            <div className="flex gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${previewTone.cls} flex items-center justify-center shadow-md`}>
                <PreviewIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-extrabold text-[#2D1B0D]">{title || "Title…"}</div>
                <div className="mt-1">{body ? <BroadcastMarkdown>{body}</BroadcastMarkdown> : <div className="text-[11.5px] text-[#7D6452]">Your message…</div>}</div>
                {tone === "premium" && <span className={`inline-block mt-2 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r ${previewTone.cls} text-white uppercase`}>✨ Premium</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="lg:col-span-3 space-y-3">
        {listQ.isLoading && <div className="text-xs text-[#A38D7D] p-6 text-center">Loading…</div>}
        {!listQ.isLoading && items.length === 0 && <div className="text-xs text-[#A38D7D] p-10 text-center bg-white/60 border border-[#FFEDD5] rounded-2xl">No broadcasts yet</div>}
        {items.map((b: any) => {
          const Icon = BROADCAST_ICONS.find((i) => i.id === b.icon)?.Icon ?? Sparkles;
          const t = BROADCAST_TONES.find((x) => x.id === b.tone) ?? BROADCAST_TONES[0];
          return (
            <div key={b.id} className={`rounded-2xl bg-white border ${b.is_active ? "border-[#FFEDD5]" : "border-gray-200 opacity-60"} shadow-sm p-4`}>
              <div className="flex gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.cls} flex items-center justify-center shadow-md shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-sm">{b.title}</div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => toggleMut.mutate({ id: b.id, is_active: !b.is_active })} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                        {b.is_active ? "Active" : "Inactive"}
                      </button>
                      <button onClick={() => { if (confirm("Delete?")) delMut.mutate(b.id); }} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="mt-1"><BroadcastMarkdown muted>{b.body}</BroadcastMarkdown></div>
                  <div className="text-[10px] text-[#A38D7D] mt-2">{new Date(b.created_at).toLocaleString()}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// Errors Tab — runtime error / bug viewer (admin debugging)
// ============================================================
function ErrorsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListErrors);
  const statsFn = useServerFn(adminErrorStats);
  const resolveFn = useServerFn(adminResolveError);
  const deleteFn = useServerFn(adminDeleteError);
  const clearFn = useServerFn(adminClearResolvedErrors);
  const [source, setSource] = useState<string>("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const stats = useQuery({
    queryKey: ["adminErrorStats"],
    queryFn: () => statsFn(),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
  const rows = useQuery({
    queryKey: ["adminListErrors", source, onlyOpen],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const resolveM = useMutation({
    mutationFn: (v: { id: string; is_resolved: boolean }) => resolveFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminListErrors"] });
      qc.invalidateQueries({ queryKey: ["adminErrorStats"] });
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminListErrors"] });
      qc.invalidateQueries({ queryKey: ["adminErrorStats"] });
      toast.success("Deleted");
    },
  });
  const clearM = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminListErrors"] });
      qc.invalidateQueries({ queryKey: ["adminErrorStats"] });
      toast.success("Cleared resolved");
    },
  });

  const sources = Object.keys(stats.data?.bySource ?? {}).sort();

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Total" value={stats.data?.total ?? 0} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatBox label="Last 24h" value={stats.data?.last24h ?? 0} icon={<Clock className="h-4 w-4" />} />
        <StatBox label="Open" value={stats.data?.open ?? 0} icon={<Bot className="h-4 w-4" />} />
        <StatBox label="Sources" value={sources.length} icon={<Info className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white/60 backdrop-blur border border-[#FF7E5F]/20 rounded-2xl p-3">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="text-sm bg-white border border-[#FF7E5F]/30 rounded-lg px-3 py-1.5"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s} ({stats.data?.bySource?.[s] ?? 0})</option>
          ))}
        </select>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Only unresolved
        </label>
        <Button size="sm" variant="outline" onClick={() => rows.refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => { if (confirm("Delete all resolved errors?")) clearM.mutate(); }}
        >
          <Trash2 className="h-4 w-4 mr-1" /> Clear resolved
        </Button>
        <span className="ml-auto text-xs text-[#4A3728]/60">Auto-refresh 15s • cap 10k rows</span>
      </div>

      <div className="bg-white/60 backdrop-blur border border-[#FF7E5F]/20 rounded-2xl overflow-hidden">
        {rows.isLoading ? (
          <div className="p-8 text-center text-[#4A3728]/60">Loading…</div>
        ) : (rows.data?.rows.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-[#4A3728]/60">No errors 🎉</div>
        ) : (
          <ul className="divide-y divide-[#FF7E5F]/15">
            {rows.data?.rows.map((r) => {
              const isOpen = expanded === r.id;
              return (
                <li key={r.id} className="p-3 hover:bg-[#FFF9F5]/60">
                  <div className="flex items-start gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.level === "error" ? "bg-red-100 text-red-700"
                        : r.level === "warn" ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {r.level}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-[#FF7E5F]/15 text-[#FF7E5F] font-semibold">
                      {r.source}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.message}</div>
                      <div className="text-xs text-[#4A3728]/60">
                        {new Date(r.created_at).toLocaleString()}
                        {r.link_id ? ` • link:${r.link_id.slice(0, 8)}` : ""}
                        {r.is_resolved ? " • ✅ resolved" : ""}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : r.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resolveM.mutate({ id: r.id, is_resolved: !r.is_resolved })}
                      title={r.is_resolved ? "Mark unresolved" : "Mark resolved"}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { if (confirm("Delete this error?")) deleteM.mutate(r.id); }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="mt-2 ml-2 space-y-2 text-xs">
                      {r.context && (
                        <pre className="bg-black/5 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                          {typeof r.context === "string" ? r.context : JSON.stringify(r.context, null, 2)}
                        </pre>
                      )}
                      {r.stack && (
                        <pre className="bg-black/5 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-64">
                          {r.stack}
                        </pre>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white/60 backdrop-blur border border-[#FF7E5F]/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-[#4A3728]/70 text-xs">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function ResetAllClicksPanel() {
  const qc = useQueryClient();
  const resetFn = useServerFn(adminResetAllClicks);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{ cleared?: number; reset_at?: string } | null>(null);

  const onReset = async () => {
    if (!confirm("Reset ALL clicks for every user now? Links and accounts will NOT be affected. This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? Type OK in the next prompt to confirm.")) return;
    const ans = prompt('Type "RESET" to confirm:');
    if (ans !== "RESET") { toast.error("Cancelled"); return; }
    try {
      setRunning(true);
      const r: any = await resetFn();
      setLastResult({ cleared: r?.cleared, reset_at: r?.reset_at });
      toast.success(`Cleared ${Number(r?.cleared ?? 0).toLocaleString()} click rows. All users will see a notice on next login.`);
      qc.invalidateQueries({ queryKey: ["admin-purge-status"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Reset failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Panel icon={RefreshCw} title="Reset All Clicks" subtitle="Wipe every click record across all users (links & accounts preserved)">
      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h4 className="font-bold text-rose-800">Full Click Reset</h4>
            <p className="text-sm text-rose-700 mt-1">
              Deletes every raw click, daily stat, and resets all link/user click counters to 0.
              Runs automatically every Sunday 03:00 UTC. Users will see a one-time popup on next login.
            </p>
            {lastResult && (
              <p className="text-xs text-rose-700/80 mt-2 font-mono">
                Last manual reset: {lastResult.cleared?.toLocaleString()} rows cleared @ {lastResult.reset_at?.slice(0, 19).replace("T", " ")} UTC
              </p>
            )}
          </div>
          <Button onClick={onReset} disabled={running} className="bg-rose-600 hover:bg-rose-700 text-white">
            {running ? "Resetting…" : "Reset Now"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function MaintenanceTab() {
  const qc = useQueryClient();
  const inactiveFn = useServerFn(adminGetInactiveUsers);
  const delUsersFn = useServerFn(adminDeleteUsers);
  const getStatusFn = useServerFn(adminGetPurgeStatus);
  const purgeBatchFn = useServerFn(adminPurgeBatch);

  const q = useQuery({ queryKey: ["admin-inactive-users"], queryFn: () => inactiveFn() });
  const statusQ = useQuery({ queryKey: ["admin-purge-status"], queryFn: () => getStatusFn() });

  const [purging, setPurging] = useState(false);
  const [progress, setProgress] = useState({ total: 0, deleted: 0, phase: "" as "" | "clicks" | "errors" | "done" });

  const runBatchedPurge = async () => {
    if (!confirm("Run maintenance now? This will purge old click logs in batches.")) return;
    try {
      setPurging(true);
      const status = await getStatusFn();
      const total = (status.oldClicks ?? 0) + (status.oldErrors ?? 0);
      setProgress({ total, deleted: 0, phase: "clicks" });

      if (total === 0) {
        setProgress({ total: 0, deleted: 0, phase: "done" });
        toast.success("Nothing to purge — already clean ✨");
        setPurging(false);
        return;
      }

      let deletedSoFar = 0;
      // Phase 1: clicks
      while (true) {
        const r = await purgeBatchFn({ data: { target: "clicks", batchSize: 2000 } });
        deletedSoFar += r.deleted;
        setProgress({ total, deleted: deletedSoFar, phase: "clicks" });
        if (r.done) break;
      }
      // Phase 2: error_logs
      setProgress({ total, deleted: deletedSoFar, phase: "errors" });
      while (true) {
        const r = await purgeBatchFn({ data: { target: "errors", batchSize: 2000 } });
        deletedSoFar += r.deleted;
        setProgress({ total, deleted: deletedSoFar, phase: "errors" });
        if (r.done) break;
      }

      setProgress({ total, deleted: deletedSoFar, phase: "done" });
      toast.success(`Maintenance completed: ${deletedSoFar.toLocaleString()} rows purged.`);
      qc.invalidateQueries({ queryKey: ["admin-purge-status"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Purge failed");
    } finally {
      setPurging(false);
    }
  };

  const delUsers = useMutation({
    mutationFn: (ids: string[]) => delUsersFn({ data: { ids } }),
    onSuccess: () => {
      toast.success("Inactive users deleted.");
      qc.invalidateQueries({ queryKey: ["admin-inactive-users"] });
    },
    onError: (e: Error) => toast.error(e.message)
  });

  const inactiveUsers = q.data ?? [];
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.deleted / progress.total) * 100)) : 0;
  const eligible = (statusQ.data?.oldClicks ?? 0) + (statusQ.data?.oldErrors ?? 0);

  return (
    <div className="space-y-6">
      <Panel icon={RefreshCw} title="System Maintenance" subtitle="Run manual maintenance tasks">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-bold text-amber-800">Purge Raw Click Logs</h4>
              <p className="text-sm text-amber-700 mt-1">
                Deletes all raw per-click records older than 7 days. Aggregate stats and daily charts are preserved.
              </p>
              <p className="text-xs text-amber-700/80 mt-1">
                Eligible for purge: <b>{(statusQ.data?.oldClicks ?? 0).toLocaleString()}</b> clicks
                {" + "}
                <b>{(statusQ.data?.oldErrors ?? 0).toLocaleString()}</b> error logs
                {" = "}<b>{eligible.toLocaleString()}</b> total
              </p>
            </div>
            <Button
              onClick={runBatchedPurge}
              disabled={purging}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {purging ? "Purging…" : "Run Now"}
            </Button>
          </div>

          {(purging || progress.phase === "done") && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-800">
                <span>
                  {progress.phase === "clicks" && "Phase 1/2: Purging old clicks…"}
                  {progress.phase === "errors" && "Phase 2/2: Purging old error logs…"}
                  {progress.phase === "done" && "✅ Completed"}
                </span>
                <span className="font-mono">
                  {progress.deleted.toLocaleString()} / {progress.total.toLocaleString()} ({pct}%)
                </span>
              </div>
              <Progress value={pct} className="h-3" />
            </div>
          )}
        </div>
      </Panel>

      <ResetAllClicksPanel />

      <QuotaSyncTestPanel />
      <QuotaSyncStatusPanel />






      <Panel icon={Users} title="Inactive Users" subtitle="Users who joined >7 days ago and never used the service">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-[#7A5C45]">Found {inactiveUsers.length} inactive users.</p>
          {inactiveUsers.length > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => {
                if (confirm(`Delete ${inactiveUsers.length} users? This cannot be undone.`)) {
                  delUsers.mutate(inactiveUsers.map((u: any) => u.id));
                }
              }}
              disabled={delUsers.isPending}
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete All Inactive
            </Button>
          )}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#FFE4D2] bg-white/70">
          <table className="w-full text-sm">
            <thead className="bg-[#FFF3E8] text-[#7A5C45]">
              <tr>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Last Login</th>
                <th className="text-right px-4 py-3">Clicks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#FFEDD5]">
              {inactiveUsers.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-[#A8907A]">No inactive users found.</td></tr>
              ) : (
                inactiveUsers.map((u: any) => (
                  <tr key={u.id} className="hover:bg-[#FFF9F5]">
                    <td className="px-4 py-3 font-medium">{u.email}</td>
                    <td className="px-4 py-3 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{u.clicks_used}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function QuotaSyncTestPanel() {
  const testFn = useServerFn(adminTestQuotaSync);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [pkg, setPkg] = useState("monthly");
  const [result, setResult] = useState<Awaited<ReturnType<typeof testFn>> | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!email.trim()) { toast.error("Enter a user email"); return; }
    setRunning(true);
    setResult(null);
    try {
      const r = await testFn({ data: { email: email.trim().toLowerCase(), package_slug: pkg } });
      setResult(r);
      if (r.pass) toast.success("Quota sync test PASSED ✅");
      else toast.error("Quota sync test FAILED ❌ — see log below");
      qc.invalidateQueries({ queryKey: ["admin-quota-sync-status"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Test failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Panel icon={ShieldCheck} title="Quota Sync Test" subtitle="Read-only verification — this never changes quota, usage, or expiry">
      <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs font-bold text-sky-900">Test user email</Label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-bold text-sky-900">Package to apply</Label>
            <select
              value={pkg}
              onChange={(e) => setPkg(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="monthly">monthly</option>
              <option value="lifetime">lifetime</option>
              <option value="unlimited">unlimited</option>
              <option value="free">free</option>
            </select>
          </div>
        </div>
        <Button onClick={run} disabled={running} className="bg-sky-600 hover:bg-sky-700 text-white">
          {running ? "Checking…" : "Check Quota Sync"}
        </Button>

        {result && (
          <div className="space-y-3 pt-2">
            <div className={`p-3 rounded-xl border ${result.pass ? "bg-emerald-50 border-emerald-300 text-emerald-900" : "bg-rose-50 border-rose-300 text-rose-900"}`}>
              <div className="font-bold text-sm">
                {result.pass ? "🎉 PASS — Quota sync is working" : "🚨 FAIL — Quota sync did NOT apply expected values"}
              </div>
              <div className="text-xs mt-1 opacity-80">Started at {result.startedAt}</div>
            </div>

            {result.before && result.expected && result.after && (
              <div className="overflow-x-auto rounded-xl border border-sky-200 bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-sky-100 text-sky-900">
                    <tr>
                      <th className="text-left px-3 py-2">Field</th>
                      <th className="text-left px-3 py-2">BEFORE</th>
                      <th className="text-left px-3 py-2">EXPECTED</th>
                      <th className="text-left px-3 py-2">AFTER</th>
                      <th className="text-left px-3 py-2">Match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100 font-mono">
                    <Row label="plan_slug" before={result.before.plan_slug} expected={result.expected.plan_slug} after={result.after.plan_slug} />
                    <Row label="click_quota" before={result.before.click_quota} expected={result.expected.click_quota} after={result.after.click_quota} />
                    <Row label="link_limit" before={result.before.link_limit} expected={result.expected.link_limit} after={result.after.link_limit} />
                  </tbody>
                </table>
              </div>
            )}

            <details open className="rounded-xl border border-sky-200 bg-slate-900 text-slate-100 overflow-hidden">
              <summary className="cursor-pointer px-3 py-2 text-xs font-bold bg-slate-800">Detailed log ({result.log.length} entries)</summary>
              <pre className="p-3 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono">{result.log.join("\n")}</pre>
            </details>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Row({ label, before, expected, after }: { label: string; before: any; expected: any; after: any }) {
  const match = after === expected;
  return (
    <tr>
      <td className="px-3 py-2 font-bold">{label}</td>
      <td className="px-3 py-2 text-slate-500">{before === null ? "NULL" : String(before)}</td>
      <td className="px-3 py-2">{expected === null ? "NULL (unlimited)" : String(expected)}</td>
      <td className="px-3 py-2 font-bold">{after === null ? "NULL" : String(after)}</td>
      <td className="px-3 py-2">{match ? "✅" : "❌"}</td>
    </tr>
  );
}

function QuotaSyncStatusPanel() {
  const statusFn = useServerFn(adminQuotaSyncStatus);
  const fixFn = useServerFn(adminFixUnlimitedMonthly);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-quota-sync-status"], queryFn: () => statusFn() });

  const fix = useMutation({
    mutationFn: () => fixFn(),
    onSuccess: (r: any) => {
      toast.success(`Fixed ${r.fixed} monthly users (scanned ${r.scanned}).`);
      qc.invalidateQueries({ queryKey: ["admin-quota-sync-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = q.data;
  const rows = data?.rows ?? [];
  const summary = data?.summary;
  const mismatches = rows.filter((r: any) => !r.ok);

  return (
    <Panel icon={ShieldCheck} title="Quota Sync Status" subtitle="Live verification from package allowance + successful renewals; repair never adds quota or days">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => q.refetch()}>
          <RefreshCw className={`w-3 h-3 mr-2 ${q.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {mismatches.length > 0 && (
          <Button size="sm" onClick={() => fix.mutate()} disabled={fix.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
            {fix.isPending ? "Repairing…" : `Repair ${mismatches.length} mismatched`}
          </Button>
        )}
        {summary && (
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold">✅ OK: {summary.ok}</span>
            <span className={`px-2 py-1 rounded-md font-bold ${summary.mismatches > 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"}`}>
              ❌ Mismatch: {summary.mismatches}
            </span>
            <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700">Total paid: {summary.total}</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#FFE4D2] bg-white/70">
        <table className="w-full text-sm">
          <thead className="bg-[#FFF3E8] text-[#7A5C45]">
            <tr>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-right px-4 py-3">click_quota</th>
              <th className="text-right px-4 py-3">expected</th>
              <th className="text-right px-4 py-3">link_limit</th>
              <th className="text-right px-4 py-3">expected</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#FFEDD5]">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-[#A8907A]">{q.isLoading ? "Loading…" : "No paid users."}</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id} className={r.ok ? "hover:bg-emerald-50/40" : "bg-rose-50/60 hover:bg-rose-50"}>
                <td className="px-4 py-3 font-medium">{r.email}</td>
                <td className="px-4 py-3"><span className="text-xs font-mono px-2 py-1 rounded bg-slate-100">{r.plan_slug}</span></td>
                <td className="px-4 py-3 text-right font-mono text-xs">{r.click_quota === null ? "NULL" : Number(r.click_quota).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">{r.expected_click_quota === null ? "NULL" : Number(r.expected_click_quota).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{r.link_limit === null ? "NULL" : r.link_limit}</td>
                <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">{r.expected_link_limit === null ? "NULL" : r.expected_link_limit}</td>
                <td className="px-4 py-3">
                  {r.ok ? (
                    <span className="text-xs font-bold text-emerald-700">✅ OK</span>
                  ) : (
                    <span className="text-xs font-bold text-rose-700">❌ {r.issue}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function PlisioLogsTab() {
  const listFn = useServerFn(adminListPlisioLogs);
  const { data: logs, isLoading, refetch } = useQuery({ queryKey: ["admin-plisio-logs"], queryFn: () => listFn() });

  return (
    <Panel icon={CreditCard} title="Plisio Webhook Logs" subtitle="Every incoming event from Plisio is logged here for debugging.">
      <div className="mb-4">
        <Button size="sm" variant="outline" onClick={() => refetch()} className="border-[#FFD4BB]">
          <RefreshCw className={`w-3 h-3 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Logs
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[#7A5C45]">
              <Th>Time</Th>
              <Th>User / Order</Th>
              <Th>Txn ID</Th>
              <Th>Status</Th>
              <Th>Processed</Th>
            </tr>
          </thead>
          <tbody>
            {logs?.length ? logs.map((log: any) => (
              <tr key={log.id} className="border-t border-[#FFE4D0]/60 hover:bg-[#FF7E5F]/5">
                <Td className="whitespace-nowrap text-xs">{new Date(log.created_at).toLocaleString()}</Td>
                <Td>
                  <div className="font-bold text-[#2D1B0D]">{log.user_email || "Unknown User"}</div>
                  <div className="text-[9px] font-mono text-[#A8907A]">{log.order_number || "No Order ID"}</div>
                </Td>
                <Td className="font-mono text-[10px]">{log.txn_id || "—"}</Td>
                <Td><StatusPill status={log.status} /></Td>
                <Td>
                  {log.processed_at ? (
                    <span className="text-emerald-600 flex items-center gap-1 font-bold text-[10px]">
                      <CheckCircle2 className="w-3 h-3" /> {new Date(log.processed_at).toLocaleTimeString()}
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1 font-bold text-[10px]">
                      <Clock className="w-3 h-3" /> Waiting/Failed
                    </span>
                  )}
                </Td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="p-8 text-center text-[#A8907A]">No Plisio events logged yet.</td></tr>
            )}

          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ============================================================================
// Offer Domain Health Monitor — SSL + DNS + HTTP + Blacklist
// ============================================================================
function DomainHealthTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMonitoredDomains);
  const addFn = useServerFn(addMonitoredDomain);
  const toggleFn = useServerFn(toggleMonitoredDomain);
  const delFn = useServerFn(deleteMonitoredDomain);
  const syncFn = useServerFn(syncOfferDomainsFromLinks);
  const scanOneFn = useServerFn(scanMonitoredDomain);
  const scanAllFn = useServerFn(scanAllMonitoredDomains);

  const q = useQuery({
    queryKey: ["monitored-domains"],
    queryFn: () => listFn(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const [domain, setDomain] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["monitored-domains"] });

  const add = useMutation({
    mutationFn: () => addFn({ data: { domain } }),
    onSuccess: () => { setDomain(""); toast.success("Domain added"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggleFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r: any) => { toast.success(`Synced ${r.total} domain(s) from active links`); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Sync failed"),
  });
  const scanOne = useMutation({
    mutationFn: (id: string) => scanOneFn({ data: { id } }),
    onSuccess: (r: any) => { toast.success(`Scanned — ${r.result.status}`); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Scan failed"),
  });
  const scanAll = useMutation({
    mutationFn: () => scanAllFn(),
    onSuccess: (r: any) => { toast.success(`Scanned ${r.scanned} (${r.critical} critical)`); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Scan failed"),
  });

  const list: any[] = q.data?.domains ?? [];
  const counts = useMemo(() => {
    const c = { healthy: 0, warning: 0, critical: 0, unknown: 0 };
    for (const d of list) {
      if (d.status === "healthy") c.healthy++;
      else if (d.status === "warning") c.warning++;
      else if (d.status === "critical") c.critical++;
      else c.unknown++;
    }
    return c;
  }, [list]);

  const statusBadge = (s: string | null) => {
    const map: Record<string, string> = {
      healthy: "bg-emerald-100 text-emerald-700 border-emerald-200",
      warning: "bg-amber-100 text-amber-700 border-amber-200",
      critical: "bg-rose-100 text-rose-700 border-rose-200",
    };
    const cls = s ? (map[s] ?? "bg-gray-100 text-gray-600 border-gray-200") : "bg-gray-100 text-gray-500 border-gray-200";
    return <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full border ${cls}`}>{s ?? "—"}</span>;
  };

  return (
    <section className="rounded-3xl border border-white/80 bg-white/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(255,126,95,0.35)]">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-[#FF7E5F]" />
        <h2 className="text-xl font-bold text-[#2D1B0D]">Offer Domain Health Monitor</h2>
      </div>
      <p className="text-sm text-[#7A5C45] mb-6">
        SSL certificate expiry, DNS/HTTP reachability, and DNSBL (Spamhaus / SURBL / URIBL) blacklist checks for every offer domain. Auto-scans daily.
      </p>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Healthy" value={counts.healthy} tone="emerald" />
        <KpiCard label="Warning" value={counts.warning} tone="amber" />
        <KpiCard label="Critical" value={counts.critical} tone="rose" />
        <KpiCard label="Not yet scanned" value={counts.unknown} tone="gray" />
      </div>

      {/* Add + actions */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="flex-1 px-3 py-2 rounded-xl border border-[#FFD4BB] bg-white text-sm"
        />
        <Button onClick={() => add.mutate()} disabled={!domain || add.isPending}
          className="bg-[#FF7E5F] hover:bg-[#FF6B4A] text-white">
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-1 ${sync.isPending ? "animate-spin" : ""}`} /> Sync from links
        </Button>
        <Button onClick={() => scanAll.mutate()} disabled={scanAll.isPending} variant="outline">
          <Zap className={`w-4 h-4 mr-1 ${scanAll.isPending ? "animate-pulse" : ""}`} /> Scan all
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#FFE8DA] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#FFF4EC] text-[#7A5C45] text-xs uppercase">
            <tr>
              <th className="text-left p-3">Domain</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">SSL</th>
              <th className="text-left p-3">DNS / HTTP</th>
              <th className="text-left p-3">Blacklist</th>
              <th className="text-left p-3">Last check</th>
              <th className="text-left p-3">Source</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (<tr><td colSpan={8} className="p-6 text-center text-[#7A5C45]">Loading…</td></tr>)}
            {!q.isLoading && list.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-[#7A5C45]">
                No domains yet. Click <strong>"Sync from links"</strong> to auto-import your offer URLs, or add one manually above.
              </td></tr>
            )}
            {list.map((d) => {
              const sslDays = d.ssl_days_remaining;
              const sslText = sslDays == null
                ? "—"
                : sslDays < 0 ? `Expired ${Math.abs(sslDays)}d ago`
                : sslDays <= 14 ? `⚠ ${sslDays}d left`
                : `${sslDays}d left`;
              const sslCls = sslDays == null ? "text-gray-500"
                : sslDays < 0 ? "text-rose-700 font-semibold"
                : sslDays <= 14 ? "text-amber-700 font-semibold"
                : "text-emerald-700";
              return (
                <tr key={d.id} className="border-t border-[#FFE8DA] hover:bg-[#FFF9F5]">
                  <td className="p-3 font-mono text-[#2D1B0D] break-all">{d.domain}</td>
                  <td className="p-3">{statusBadge(d.status)}</td>
                  <td className={`p-3 ${sslCls}`}>
                    {sslText}
                    {d.ssl_issuer && <div className="text-[10px] text-gray-500">{d.ssl_issuer}</div>}
                  </td>
                  <td className="p-3">
                    <div className={d.dns_ok ? "text-emerald-700" : "text-rose-700 font-semibold"}>
                      DNS {d.dns_ok ? "OK" : "FAIL"}
                    </div>
                    <div className="text-xs text-gray-600">
                      HTTP {d.http_status ?? "—"}{d.redirect_count ? ` · ${d.redirect_count} redirects` : ""}
                    </div>
                  </td>
                  <td className="p-3">
                    {d.blacklisted ? (
                      <span className="text-rose-700 font-semibold text-xs">
                        ⛔ {(d.blacklist_sources || []).join(", ") || "Listed"}
                      </span>
                    ) : (
                      <span className="text-emerald-700 text-xs">Clean</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-[#7A5C45]">
                    {d.last_checked_at ? new Date(d.last_checked_at).toLocaleString() : "never"}
                  </td>
                  <td className="p-3 text-xs">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] ${
                      d.source === "auto" ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : "bg-purple-50 text-purple-700 border-purple-200"
                    }`}>{d.source}</span>
                    {!d.is_active && <span className="ml-1 text-gray-500">(paused)</span>}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => scanOne.mutate(d.id)} disabled={scanOne.isPending}>
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => toggle.mutate({ id: d.id, is_active: !d.is_active })}>
                        {d.is_active ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => { if (confirm(`Remove ${d.domain}?`)) del.mutate(d.id); }}>
                        <Trash2 className="w-3 h-3 text-rose-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" | "gray" }) {
  const map = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    gray: "bg-gray-50 border-gray-200 text-gray-600",
  } as const;
  return (
    <div className={`rounded-2xl border p-4 ${map[tone]}`}>
      <div className="text-xs uppercase font-semibold opacity-80">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}
