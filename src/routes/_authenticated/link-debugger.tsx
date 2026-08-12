import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Bug, Crown, Globe, Image as ImageIcon, AlertTriangle, CheckCircle2, Info,
  Loader2, ExternalLink, Copy, Search,
} from "lucide-react";
import { toast } from "sonner";

import { listMyLinks } from "@/lib/links.functions";
import { debugLinkPreview, getMyPlan, type BotKey } from "@/lib/link-debugger.functions";
import { useShortDomain, SHORT_DOMAINS, FLAGGED_SHORT_DOMAINS } from "@/lib/short-domains";

export const Route = createFileRoute("/_authenticated/link-debugger")({
  head: () => ({ meta: [{ title: "Link Debugger — Sleepox" }] }),
  component: LinkDebuggerPage,
});



const BOTS: { key: BotKey; label: string; emoji: string; color: string }[] = [
  { key: "facebook", label: "Facebook", emoji: "📘", color: "#1877F2" },
  { key: "twitter",  label: "Twitter / X", emoji: "🐦", color: "#000000" },
  { key: "linkedin", label: "LinkedIn", emoji: "💼", color: "#0A66C2" },
  { key: "whatsapp", label: "WhatsApp", emoji: "💬", color: "#25D366" },
  { key: "google",   label: "Google",   emoji: "🔎", color: "#34A853" },
];

type DebugResult = Awaited<ReturnType<typeof debugLinkPreview>>;

function LinkDebuggerPage() {
  const listFn = useServerFn(listMyLinks);
  const planFn = useServerFn(getMyPlan);
  const debugFn = useServerFn(debugLinkPreview);

  const profileQ = useQuery({ queryKey: ["my-plan"], queryFn: () => planFn() });
  const isPaid = !!profileQ.data?.is_paid;

  const linksQ = useQuery({
    queryKey: ["my-links-debugger"],
    queryFn: () => listFn(),
    enabled: isPaid,
  });

  const { host: shortHost, baseUrl, setHost } = useShortDomain();

  const [mode, setMode] = useState<"own" | "custom">("own");
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [customUrl, setCustomUrl] = useState("");
  const [bot, setBot] = useState<BotKey>("facebook");

  useEffect(() => {
    if (mode === "own" && !selectedCode && linksQ.data?.[0]?.short_code) {
      setSelectedCode(linksQ.data[0].short_code);
    }
  }, [mode, selectedCode, linksQ.data]);

  const targetUrl = useMemo(() => {
    if (mode === "custom") return customUrl.trim();
    if (!selectedCode) return "";
    return `${baseUrl}/${selectedCode}`;
  }, [mode, customUrl, selectedCode, baseUrl]);

  const mut = useMutation({
    mutationFn: async (vars: { url: string; bot: BotKey }) =>
      debugFn({ data: { url: vars.url, bot: vars.bot } }),
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Check failed"),
  });

  const result = mut.data as DebugResult | undefined;

  const run = () => {
    if (!targetUrl) { toast.error("Pick a link or paste a URL"); return; }
    try { new URL(targetUrl); } catch { toast.error("That URL looks invalid"); return; }
    mut.mutate({ url: targetUrl, bot });
  };

  // ---------- Locked screen for free users ----------
  if (profileQ.isLoading) {
    return <div className="p-10 text-center text-[#7D6452] text-sm">Loading…</div>;
  }
  if (!isPaid) {
    return (
      <div className="min-h-screen w-full" style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Header />
          <div className="mt-8 relative rounded-3xl border border-[#FFEDD5] bg-white/70 backdrop-blur-xl overflow-hidden shadow-xl shadow-orange-900/5">
            <div className="absolute inset-0 bg-gradient-to-br from-[#FF7E5F]/10 via-transparent to-[#FEB47B]/10 pointer-events-none" />
            <div className="relative p-10 lg:p-14 text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-[#2D1B0D]">Link Debugger is a Pro feature</h2>
              <p className="mt-3 text-sm text-[#7D6452] max-w-xl mx-auto">
                See exactly what Facebook, Twitter, LinkedIn, WhatsApp, and Google see when they scrape your link —
                preview cards, meta tags, warnings, and cloaking diffs. Available on Monthly &amp; Lifetime plans.
              </p>
              <Link to="/upgrade"
                className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-bold shadow-lg shadow-orange-500/30 hover:shadow-xl transition-all">
                <Crown className="w-4 h-4" /> Upgrade to unlock
              </Link>
              <div className="mt-10 grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto opacity-70 pointer-events-none select-none">
                {BOTS.slice(0, 3).map((b) => (
                  <div key={b.key} className="p-4 rounded-2xl border border-[#FFEDD5] bg-white/60">
                    <div className="text-2xl">{b.emoji}</div>
                    <div className="font-bold text-sm mt-1 text-[#2D1B0D]">{b.label} preview</div>
                    <div className="text-[11px] text-[#A38D7D]">Live render of how the card looks</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Paid: full UI ----------
  return (
    <div className="min-h-screen w-full" style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Header />

        {/* Controls */}
        <div className="rounded-3xl border border-[#FFEDD5] bg-white/70 backdrop-blur-xl p-5 lg:p-6 shadow-sm shadow-orange-900/5">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button onClick={() => setMode("own")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === "own" ? "bg-[#FF7E5F] text-white shadow" : "bg-[#FFF9F5] border border-[#FFEDD5] text-[#7D6452]"}`}>
              My links
            </button>
            <button onClick={() => setMode("custom")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === "custom" ? "bg-[#FF7E5F] text-white shadow" : "bg-[#FFF9F5] border border-[#FFEDD5] text-[#7D6452]"}`}>
              Paste any URL
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
            {mode === "own" ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A38D7D]" />
                  <select
                    value={selectedCode}
                    onChange={(e) => setSelectedCode(e.target.value)}
                    className="w-full bg-[#FFF9F5] border border-[#FFEDD5] rounded-xl py-3 pl-11 pr-4 text-sm text-[#2D1B0D] focus:outline-none focus:border-[#FF7E5F]/50"
                  >
                    {(linksQ.data ?? []).length === 0 && <option value="">No links yet</option>}
                    {(linksQ.data ?? []).map((l) => (
                      <option key={l.id} value={l.short_code}>
                        {(l.title || l.short_code)} — /{l.short_code}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  value={shortHost}
                  onChange={(e) => setHost(e.target.value as typeof shortHost)}
                  className="bg-[#FFF9F5] border border-[#FFEDD5] rounded-xl py-3 px-3 text-sm font-mono text-[#2D1B0D] focus:outline-none focus:border-[#FF7E5F]/50"
                  title="Choose domain to test against"
                >
                  {SHORT_DOMAINS.map((d) => (
                    <option key={d.host} value={d.host}>{d.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A38D7D]" />
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  className="w-full bg-[#FFF9F5] border border-[#FFEDD5] rounded-xl py-3 pl-11 pr-4 text-sm placeholder:text-[#A38D7D] focus:outline-none focus:border-[#FF7E5F]/50"
                />
              </div>
            )}

            <button onClick={run} disabled={mut.isPending || !targetUrl}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-bold text-sm shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
              {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
              {mut.isPending ? "Checking…" : "Check Now"}
            </button>
          </div>

          {/* Bot selector */}
          <div className="mt-4 flex flex-wrap gap-2">
            {BOTS.map((b) => (
              <button key={b.key} onClick={() => setBot(b.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  bot === b.key
                    ? "bg-[#2D1B0D] text-white border-[#2D1B0D]"
                    : "bg-white text-[#7D6452] border-[#FFEDD5] hover:border-[#FF7E5F]/40"
                }`}>
                <span>{b.emoji}</span> {b.label}
              </button>
            ))}
          </div>

          {targetUrl && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-[#A38D7D] font-mono break-all">
              Target: <span className="text-[#7D6452]">{targetUrl}</span>
              <button onClick={() => { navigator.clipboard.writeText(targetUrl); toast.success("Copied"); }}
                className="text-[#FF7E5F] hover:text-[#E66D50]"><Copy className="w-3 h-3" /></button>
            </div>
          )}
        </div>

        {/* Results */}
        {result && !("error" in result) && !result.locked && (
          <Results r={result} botLabel={BOTS.find((b) => b.key === result.bot)?.label ?? result.bot} />
        )}
        {result && "error" in result && (
          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-5 text-sm text-red-700">
            <strong className="font-bold">Fetch failed:</strong> {result.error}
          </div>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-start justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-3xl lg:text-4xl font-extrabold text-[#2D1B0D] flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Bug className="w-5 h-5" />
          </span>
          Link Debugger
        </h1>
        <p className="text-sm text-[#7D6452] mt-2">See exactly what bots see — no Facebook debug tool needed.</p>
      </div>
    </div>
  );
}

function Results({ r, botLabel }: { r: Extract<DebugResult, { locked: false }>; botLabel: string }) {
  if ("error" in r) return null;
  const p = r.preview;
  const host = (() => { try { return new URL(p.url ?? r.finalUrl).host; } catch { return ""; } })();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5">
      {/* LEFT: preview card + warnings */}
      <div className="space-y-5">
        <Panel title={`${botLabel} preview`} icon={<ImageIcon className="w-4 h-4" />}>
          <div className="rounded-2xl border border-[#E5E5EA] overflow-hidden bg-white">
            {p.image ? (
              <div className="w-full aspect-[1.91/1] bg-[#F5F5F7] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="og preview"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full aspect-[1.91/1] bg-gradient-to-br from-[#FFF4ED] to-[#FFEDD5] flex items-center justify-center text-[#A38D7D] text-xs">
                No og:image
              </div>
            )}
            <div className="px-4 py-3 border-t border-[#E5E5EA]">
              <p className="text-[10px] uppercase tracking-wider text-[#8E8E93] truncate">{host}</p>
              <p className="text-[15px] font-bold text-[#1D1D1F] line-clamp-2 mt-0.5">{p.title ?? "(no title)"}</p>
              {p.description && (
                <p className="text-[12px] text-[#6E6E73] line-clamp-2 mt-1">{p.description}</p>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Warnings" icon={<AlertTriangle className="w-4 h-4" />}>
          {r.warnings.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /> No issues found — preview should render cleanly.
            </div>
          ) : (
            <ul className="space-y-2">
              {r.warnings.map((w, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm rounded-xl px-3 py-2 ${
                  w.level === "error" ? "bg-red-50 text-red-800" :
                  w.level === "warn" ? "bg-amber-50 text-amber-800" :
                  "bg-blue-50 text-blue-800"
                }`}>
                  {w.level === "error" ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> :
                   w.level === "warn"  ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> :
                   <Info className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{w.msg}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

      </div>

      {/* RIGHT: response + meta */}
      <div className="space-y-5">
        <Panel title="Response details" icon={<Info className="w-4 h-4" />}>
          {(() => {
            const OUR_HOSTS = [...SHORT_DOMAINS.map((d) => d.host), ...FLAGGED_SHORT_DOMAINS];
            let finalHost = "";
            try { finalHost = new URL(r.finalUrl).host.toLowerCase(); } catch {}
            const isOurDomain = OUR_HOSTS.some((h) => finalHost === h || finalHost.endsWith(`.${h}`));
            const isAdsterra = /(\.|^)(adsterra|highrevenuegate|highcpmrevenuegate|profitableratecpm|onclkds|displaycontentprovider|topcreativeformat|realsrv)\./i.test(finalHost);
            const tone = isAdsterra
              ? "bg-red-50 text-red-800 border-red-200"
              : isOurDomain
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200";
            const label = isAdsterra
              ? "⚠ Leaked to Adsterra — short link is exposing the offer URL directly"
              : isOurDomain
                ? "✓ Stays on your main domain — safe to share"
                : `Lands on external host: ${finalHost || "unknown"}`;
            return (
              <div className={`mb-3 rounded-xl border px-3 py-2 text-xs font-bold ${tone}`}>
                {label}
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <KV k="Status" v={String(r.status)} tone={r.status < 300 ? "ok" : r.status < 400 ? "warn" : "err"} />
            <KV k="Time"   v={`${r.elapsedMs} ms`} />
            <KV k="Size"   v={`${r.sizeBytes.toLocaleString()} B`} />
            <KV k="Type"   v={r.contentType || "—"} />
            <KV k="Final URL" v={r.finalUrl} full />
          </div>
        </Panel>


        <Panel title={`All meta tags (${r.meta.length})`} icon={<ImageIcon className="w-4 h-4" />}>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-xl border border-[#FFEDD5]">
            <table className="w-full text-xs">
              <thead className="bg-[#FFF9F5] sticky top-0">
                <tr className="text-left text-[#A38D7D] uppercase tracking-wider text-[10px]">
                  <th className="px-3 py-2 font-bold">Kind</th>
                  <th className="px-3 py-2 font-bold">Key</th>
                  <th className="px-3 py-2 font-bold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FFEDD5]">
                {r.meta.map((t, i) => (
                  <tr key={i} className="hover:bg-[#FFF9F5]">
                    <td className="px-3 py-2 font-mono text-[#A38D7D]">{t.kind}</td>
                    <td className="px-3 py-2 font-mono font-bold text-[#2D1B0D]">{t.key}</td>
                    <td className="px-3 py-2 text-[#4A3728] break-all">{t.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <a href={r.finalUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-[#FF7E5F] font-bold hover:text-[#E66D50]">
              Open URL <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => { navigator.clipboard.writeText(JSON.stringify(r, null, 2)); toast.success("JSON copied"); }}
              className="inline-flex items-center gap-1.5 text-[11px] text-[#7D6452] font-bold hover:text-[#2D1B0D]"
            >
              Copy raw JSON <Copy className="w-3 h-3" />
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#FFEDD5] bg-white/70 backdrop-blur-xl p-5 shadow-sm shadow-orange-900/5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-[#2D1B0D] mb-4">
        <span className="w-7 h-7 rounded-lg bg-[#FFF4ED] text-[#FF7E5F] flex items-center justify-center">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function KV({ k, v, full, tone }: { k: string; v: string; full?: boolean; tone?: "ok" | "warn" | "err" }) {
  const toneCls =
    tone === "ok" ? "text-emerald-700" :
    tone === "warn" ? "text-amber-700" :
    tone === "err" ? "text-red-700" : "text-[#2D1B0D]";
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-[10px] uppercase tracking-wider text-[#A38D7D] font-bold mb-1">{k}</p>
      <p className={`text-xs font-mono break-all ${toneCls}`}>{v}</p>
    </div>
  );
}
