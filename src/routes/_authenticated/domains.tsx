import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import {
  Globe, Plus, Check, X, Copy, Trash2, ShieldCheck, AlertCircle, Crown, RefreshCw,
  ExternalLink, HelpCircle, Sparkles, Loader2,
} from "lucide-react";
import {
  listCustomDomains,
  addCustomDomain,
  verifyCustomDomain,
  deleteCustomDomain,
} from "@/lib/custom-domains.functions";

export const Route = createFileRoute("/_authenticated/domains")({
  head: () => ({ meta: [{ title: "Custom Domains — Sleepox" }] }),
  component: DomainsPage,
});

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;
const CNAME_TARGET = "sleepox.com";

// Registrar quick-links (fallback list; server also detects provider).
const REGISTRARS = [
  { id: "cloudflare", label: "Cloudflare", url: "https://dash.cloudflare.com/" },
  { id: "namecheap", label: "Namecheap", url: "https://ap.www.namecheap.com/domains/list/" },
  { id: "godaddy", label: "GoDaddy", url: "https://dcc.godaddy.com/manage/dns" },
  { id: "namesilo", label: "Namesilo", url: "https://www.namesilo.com/account_domains.php" },
  { id: "hostinger", label: "Hostinger", url: "https://hpanel.hostinger.com/domains" },
  { id: "google", label: "Google Domains", url: "https://domains.google.com/registrar" },
];

function DomainsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomDomains);
  const addFn = useServerFn(addCustomDomain);
  const verifyFn = useServerFn(verifyCustomDomain);
  const deleteFn = useServerFn(deleteCustomDomain);

  const q = useQuery({
    queryKey: ["custom-domains"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const [newDomain, setNewDomain] = useState("");
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [autoPollId, setAutoPollId] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (domain: string) => addFn({ data: { domain } }),
    onSuccess: (res: any) => {
      setNewDomain("");
      setActionMsg({ type: "ok", text: "Domain added! Now add the 2 DNS records below. We'll auto-check every 6 seconds." });
      qc.invalidateQueries({ queryKey: ["custom-domains"] });
      setAutoPollId(res.id); // start auto-verify polling
    },
    onError: (e: any) => setActionMsg({ type: "err", text: e?.message ?? "Failed to add domain" }),
  });

  const verify = useMutation({
    mutationFn: (id: string) => verifyFn({ data: { id } }),
    onSuccess: (res: any, id) => {
      setActionMsg({ type: res.ok ? "ok" : "err", text: res.message });
      qc.invalidateQueries({ queryKey: ["custom-domains"] });
      if (res.ok && autoPollId === id) setAutoPollId(null);
    },
    onError: (e: any) => setActionMsg({ type: "err", text: e?.message ?? "Verification failed" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-domains"] }),
  });

  if (q.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-[#7D6452]">Loading…</div>;
  }

  if (q.isError) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <div className="p-8 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700">
          <h2 className="font-bold mb-2">Could not load domains</h2>
          <p className="text-sm">{(q.error as Error)?.message ?? "Unknown error"}</p>
          <button onClick={() => q.refetch()} className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold">Retry</button>
        </div>
      </div>
    );
  }

  const data = q.data;
  if (!data) return null;

  if (!data.isPaid) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="p-10 rounded-3xl bg-white/85 border border-white/90 backdrop-blur-2xl shadow-[0_8px_30px_rgba(255,126,95,0.12)] text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] text-white shadow-lg shadow-orange-500/30 mb-5">
            <Crown className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold text-[#2D1B0D]" style={display}>
            Custom Domains — Paid feature
          </h1>
          <p className="text-[#5D4538] mt-3 max-w-md mx-auto">
            Use your own domain (e.g. <span className="font-mono text-[#2D1B0D]">go.yoursite.com</span>) for every smart link. Available on all paid plans.
          </p>
          <Link
            to="/upgrade"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-bold shadow-lg shadow-orange-500/30 hover:scale-[1.02] transition-transform"
          >
            <Crown className="w-4 h-4" /> Upgrade to unlock
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-[1200px] mx-auto">
      <header>
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#FF7E5F] font-bold mb-2">Branded Links</p>
        <h1 className="text-3xl lg:text-4xl font-bold text-[#2D1B0D] tracking-tight" style={display}>
          Custom Domains
        </h1>
        <p className="text-[#5D4538] text-sm mt-2 max-w-2xl">
          Serve your smart links from your own domain. Add a subdomain like{" "}
          <span className="font-mono text-[#2D1B0D]">go.yoursite.com</span>, add 2 DNS records — we handle the rest automatically.
        </p>
      </header>

      {/* Quick guide */}
      <QuickGuide />

      {/* Add domain */}
      <section className="p-6 rounded-3xl bg-white/85 border border-white/90 backdrop-blur-2xl shadow-[0_8px_30px_rgba(255,126,95,0.08)]">
        <h2 className="text-sm font-bold text-[#2D1B0D] uppercase tracking-wider mb-4" style={display}>
          <Sparkles className="inline w-4 h-4 mr-1.5 -mt-0.5 text-[#FF7E5F]" />
          Add a new domain
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newDomain.trim() && !add.isPending) add.mutate(newDomain);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-[#FFEDD5] focus-within:border-[#FF7E5F]/50 transition">
            <Globe className="w-4 h-4 text-[#7D6452] shrink-0" />
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="go.yoursite.com"
              className="bg-transparent flex-1 outline-none text-sm text-[#2D1B0D] placeholder:text-[#A38D7D] font-mono"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            type="submit"
            disabled={!newDomain.trim() || add.isPending}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-bold shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform"
          >
            {add.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {add.isPending ? "Adding…" : "Add domain"}
          </button>
        </form>
        <p className="mt-3 text-xs text-[#7D6452]">
          Tip: use a <span className="font-semibold text-[#2D1B0D]">subdomain</span> like <span className="font-mono">go.</span> or <span className="font-mono">link.</span> — keeps your main site untouched.
        </p>
        {actionMsg && (
          <div
            className={`mt-4 flex items-start gap-2 p-3 rounded-xl text-sm ${
              actionMsg.type === "ok"
                ? "bg-emerald-500/10 border border-emerald-400/40 text-emerald-700"
                : "bg-rose-500/10 border border-rose-400/40 text-rose-700"
            }`}
          >
            {actionMsg.type === "ok" ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{actionMsg.text}</span>
          </div>
        )}
      </section>

      {/* List */}
      <section className="space-y-4">
        {data.domains.length === 0 ? (
          <div className="p-10 rounded-3xl bg-white/70 border border-dashed border-[#FFD9C4] text-center">
            <Globe className="w-10 h-10 text-[#FEB47B] mx-auto mb-3" />
            <p className="text-[#5D4538]">No domains yet. Add your first one above to get started.</p>
          </div>
        ) : (
          data.domains.map((dom: any) => (
            <DomainCard
              key={dom.id}
              dom={dom}
              verifyFn={verifyFn}
              autoPoll={autoPollId === dom.id}
              onStopPoll={() => setAutoPollId(null)}
              onVerified={() => qc.invalidateQueries({ queryKey: ["custom-domains"] })}
              onManualVerify={() => verify.mutate(dom.id)}
              onDelete={() => {
                if (confirm(`Delete ${dom.domain}? Links using this domain will stop working.`)) del.mutate(dom.id);
              }}
              manualVerifying={verify.isPending && verify.variables === dom.id}
            />
          ))
        )}
      </section>
    </div>
  );
}

function QuickGuide() {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#FFF5EC] to-white border border-[#FFEDD5] p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-white border border-[#FFEDD5] flex items-center justify-center">
          <HelpCircle className="w-6 h-6 text-[#FF7E5F]" />
        </div>
        <div>
          <p className="font-bold text-[#2D1B0D] text-lg" style={display}>How to add your domain</p>
          <p className="text-sm text-[#7D6452] mt-0.5">Just 3 easy steps — takes 2 minutes</p>
        </div>
      </div>

      {/* MUST READ warning — which domains to buy / not to buy */}
      <div className="rounded-2xl border-2 border-red-400 bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-bold uppercase tracking-wider animate-pulse">⚠ Must Read</span>
          <p className="font-bold text-red-900 text-base" style={display}>Domain Buying Rules — Read Before You Buy</p>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {/* GOOD */}
          <div className="rounded-xl bg-white border border-green-300 p-4">
            <p className="text-sm font-bold text-green-700 mb-2 uppercase tracking-wider">✅ Safe to Buy</p>
            <ul className="text-sm text-[#2D1B0D] space-y-2 leading-relaxed">
              <li>• <strong>Fresh new domain</strong> (never used before)</li>
              <li>• <strong>Clean .com / .net / .org / .co</strong> extensions</li>
              <li>• <strong>Brandable name</strong> (looks like a real business: <em>e.g. shopnex.com, kartly.co</em>)</li>
              <li>• <strong>Short & easy to spell</strong> (6–14 letters)</li>
              <li>• <strong>Buy from trusted registrars:</strong> Namecheap, Cloudflare, Namesilo, Porkbun</li>
            </ul>
          </div>

          {/* BAD */}
          <div className="rounded-xl bg-white border border-red-300 p-4">
            <p className="text-sm font-bold text-red-700 mb-2 uppercase tracking-wider">❌ Never Buy</p>
            <ul className="text-sm text-[#2D1B0D] space-y-2 leading-relaxed">
              <li>• <strong>Expired / dropped domains</strong> — bad history, may be Meta/Google blacklisted</li>
              <li>• <strong>Free TLDs:</strong> .tk .ml .ga .cf .gq .xyz .top .click .work .buzz (Facebook auto-flags)</li>
              <li>• <strong>Copycat / brand names</strong> (amaz0n-shop.com, nikee-store.com — instant ban)</li>
              <li>• <strong>Numbers/dashes</strong> in name (buy-now-cheap-24.com looks spammy)</li>
              <li>• <strong>Auction / backorder domains</strong> from GoDaddy Auctions, Sedo (check history first)</li>
              <li>• <strong>Adult / gambling / crypto</strong> keywords in name</li>
            </ul>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-yellow-100 border border-yellow-300 p-3">
          <p className="text-sm text-yellow-900 leading-relaxed">
            <strong>💡 Pro tip:</strong> Before buying, check the domain on <a href="https://www.facebook.com/debug/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Facebook Debugger</a> and <a href="https://transparencyreport.google.com/safe-browsing/search" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Google Safe Browsing</a>. If either shows a warning — <strong>do not buy</strong>. Also search the domain on Google — if old spam pages show up, skip it.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <GuideStep
          n={1}
          title="Type your subdomain"
          body="In the box above, type something like go.yoursite.com or link.yoursite.com. Then click Add."
        />
        <GuideStep
          n={2}
          title="Copy 2 DNS records"
          body="We show 1 CNAME and 1 TXT record. Click Copy on each, open your domain's DNS panel (links below), paste and Save."
        />
        <GuideStep
          n={3}
          title="Wait for green ✓"
          body="We auto-check every 6 seconds. Most domains verify in 1–3 minutes. Green tick = your domain is live!"
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-[#5D4538] font-semibold mr-1">Open DNS panel:</span>
        {REGISTRARS.map((r) => (
          <a
            key={r.id}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#FFEDD5] text-sm font-semibold text-[#2D1B0D] hover:border-[#FF7E5F]/50 transition"
          >
            {r.label} <ExternalLink className="w-3.5 h-3.5 text-[#7D6452]" />
          </a>
        ))}
      </div>
    </div>
  );
}

function GuideStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-[#FFEDD5]">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] text-white text-base font-bold flex items-center justify-center">{n}</span>
        <p className="font-bold text-[#2D1B0D] text-base" style={display}>{title}</p>
      </div>
      <p className="text-sm text-[#5D4538] leading-relaxed">{body}</p>
    </div>
  );
}

function DomainCard({
  dom,
  verifyFn,
  autoPoll,
  onStopPoll,
  onVerified,
  onManualVerify,
  onDelete,
  manualVerifying,
}: {
  dom: any;
  verifyFn: (args: any) => Promise<any>;
  autoPoll: boolean;
  onStopPoll: () => void;
  onVerified: () => void;
  onManualVerify: () => void;
  onDelete: () => void;
  manualVerifying: boolean;
}) {
  const [open, setOpen] = useState(!dom.verified);
  const [status, setStatus] = useState<{ txtOk: boolean; cnameOk: boolean; provider?: any; message?: string } | null>(null);
  const [polling, setPolling] = useState(false);
  const attemptsRef = useRef(0);

  // Auto-polling: every 6s for up to 20 attempts (~2 min) after adding.
  useEffect(() => {
    if (!autoPoll || dom.verified) return;
    setPolling(true);
    attemptsRef.current = 0;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      attemptsRef.current += 1;
      try {
        const res = await verifyFn({ data: { id: dom.id } });
        if (cancelled) return;
        setStatus({ txtOk: res.txtOk, cnameOk: res.cnameOk, provider: res.provider, message: res.message });
        if (res.ok) {
          setPolling(false);
          onVerified();
          onStopPoll();
          return;
        }
      } catch { /* ignore transient */ }
      if (attemptsRef.current >= 20) {
        setPolling(false);
        onStopPoll();
        return;
      }
      setTimeout(tick, 6000);
    };
    const t = setTimeout(tick, 3000); // first check after 3s
    return () => { cancelled = true; clearTimeout(t); setPolling(false); };
  }, [autoPoll, dom.id, dom.verified, verifyFn, onVerified, onStopPoll]);

  const runManual = async () => {
    onManualVerify();
    try {
      const res = await verifyFn({ data: { id: dom.id } });
      setStatus({ txtOk: res.txtOk, cnameOk: res.cnameOk, provider: res.provider, message: res.message });
    } catch { /* handled by parent */ }
  };

  const cnameName = dom.domain;
  const txtName = `_sleepox-verify.${dom.domain}`;

  const copyAll = () => {
    const text = `CNAME  ${cnameName}  →  ${CNAME_TARGET}\nTXT    ${txtName}  →  ${dom.verification_token}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-6 rounded-3xl bg-white/85 border border-white/90 backdrop-blur-2xl shadow-[0_8px_30px_rgba(255,126,95,0.08)]">
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF7E5F]/20 to-[#FEB47B]/20 border border-[#FFEDD5] flex items-center justify-center shrink-0">
          <Globe className="w-5 h-5 text-[#FF7E5F]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-[#2D1B0D] font-mono truncate" style={display}>{dom.domain}</p>
          <p className="text-xs text-[#7D6452] mt-0.5">
            Added {new Date(dom.created_at).toLocaleDateString()}
            {dom.verified_at && <> · Verified {new Date(dom.verified_at).toLocaleDateString()}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dom.verified ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-700 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified
            </span>
          ) : polling ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/40 text-blue-700 text-xs font-bold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Auto-checking…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-700 text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5" /> Pending DNS
            </span>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#5D4538] hover:bg-[#FFEDD5]/60 transition"
          >
            {open ? "Hide" : "Setup"}
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-xl text-rose-600 hover:bg-rose-500/10 transition"
            title="Delete domain"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-6 pt-6 border-t border-[#FFEDD5] space-y-5">
          {/* Live status */}
          {!dom.verified && (
            <div className="grid grid-cols-2 gap-3">
              <StatusPill label="CNAME record" ok={status?.cnameOk ?? false} />
              <StatusPill label="TXT record" ok={status?.txtOk ?? false} />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs uppercase tracking-[0.2em] text-[#7D6452] font-bold">DNS Records (add at your registrar)</h4>
              <button
                onClick={copyAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D1B0D] text-white text-xs font-bold hover:bg-[#3D2818] transition"
              >
                <Copy className="w-3 h-3" /> Copy all
              </button>
            </div>
            <div className="space-y-3">
              <DnsRow type="CNAME" name={cnameName} value={CNAME_TARGET} live={status?.cnameOk} />
              <DnsRow type="TXT" name={txtName} value={dom.verification_token} live={status?.txtOk} />
            </div>
          </div>

          {/* Registrar hint (from detected nameservers) */}
          {status?.provider && status.provider.id !== "other" && status.provider.dashUrl && (
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-900" style={display}>
                  Looks like your DNS is on {status.provider.label}
                </p>
                <p className="text-xs text-blue-800 mt-0.5">Open the DNS panel directly and paste the records above.</p>
              </div>
              <a
                href={status.provider.dashUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                Open {status.provider.label} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-[#FFF5EC] border border-[#FFEDD5]">
            <p className="text-xs text-[#5D4538] leading-relaxed">
              <strong className="text-[#2D1B0D]">How it works:</strong> Add the CNAME record (points your domain to <span className="font-mono">{CNAME_TARGET}</span>) and the TXT record (proves you own the domain). Use the Copy buttons — no typing needed. DNS usually updates in 1–3 minutes and we verify automatically.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runManual}
              disabled={manualVerifying || polling}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2D1B0D] text-white text-sm font-bold hover:bg-[#3D2818] disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-4 h-4 ${manualVerifying || polling ? "animate-spin" : ""}`} />
              {manualVerifying ? "Checking DNS…" : dom.verified ? "Re-check" : "Check now"}
            </button>
            {status?.message && !dom.verified && (
              <span className={`text-xs ${status.txtOk && status.cnameOk ? "text-emerald-700" : "text-amber-700"}`}>
                {status.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl border ${
      ok ? "bg-emerald-50 border-emerald-200" : "bg-white border-[#FFEDD5]"
    }`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
        ok ? "bg-emerald-500 text-white" : "bg-[#FFEDD5] text-[#7D6452]"
      }`}>
        {ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      </div>
      <span className={`text-xs font-bold ${ok ? "text-emerald-800" : "text-[#7D6452]"}`}>{label}</span>
    </div>
  );
}

function DnsRow({ type, name, value, live }: { type: string; name: string; value: string; live?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <div className={`grid grid-cols-12 gap-2 items-center p-3 rounded-xl bg-white border text-xs ${
      live === true ? "border-emerald-300 bg-emerald-50/40" : "border-[#FFEDD5]"
    }`}>
      <span className="col-span-2 inline-flex items-center justify-center px-2 py-1 rounded-md bg-[#FF7E5F]/15 text-[#FF7E5F] font-bold font-mono">
        {type}
        {live === true && <Check className="w-3 h-3 ml-1 text-emerald-600" />}
      </span>
      <div className="col-span-5 min-w-0 flex items-center gap-2">
        <span className="text-[10px] uppercase text-[#7D6452] shrink-0">Name</span>
        <code className="text-[#2D1B0D] font-mono truncate" title={name}>{name}</code>
        <button onClick={() => copy(`n-${name}`, name)} className="ml-auto p-1 text-[#7D6452] hover:text-[#FF7E5F]" title="Copy">
          {copied === `n-${name}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="col-span-5 min-w-0 flex items-center gap-2">
        <span className="text-[10px] uppercase text-[#7D6452] shrink-0">Value</span>
        <code className="text-[#2D1B0D] font-mono truncate" title={value}>{value}</code>
        <button onClick={() => copy(`v-${value}`, value)} className="ml-auto p-1 text-[#7D6452] hover:text-[#FF7E5F]" title="Copy">
          {copied === `v-${value}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
