import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runLeakScan, listLeakFindings, clearLeakFindings } from "@/lib/leak-monitor.functions";

type FindingRow = {
  id: string;
  level: string;
  message: string;
  created_at: string;
  context: {
    check?: string;
    domain?: string;
    url?: string;
    evidence?: string;
    fix?: string;
  } | null;
};

export function LeakMonitorTab() {
  const qc = useQueryClient();
  const scanFn = useServerFn(runLeakScan);
  const listFn = useServerFn(listLeakFindings);
  const clearFn = useServerFn(clearLeakFindings);

  const list = useQuery({
    queryKey: ["leak-findings"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });

  const scan = useMutation({
    mutationFn: () => scanFn({ data: {} }),
    onSuccess: (r: { total: number; critical: number; warnings: number }) => {
      toast.success(
        r.total === 0
          ? "No leaks found — all domains clean"
          : `${r.critical} critical, ${r.warnings} warnings found`,
      );
      qc.invalidateQueries({ queryKey: ["leak-findings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => {
      toast.success("Findings cleared");
      qc.invalidateQueries({ queryKey: ["leak-findings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = ((list.data as { findings?: FindingRow[] } | undefined)?.findings ?? []) as FindingRow[];

  // Latest sweep only: group by check+domain, keep newest.
  const latest = useMemo(() => {
    const seen = new Map<string, FindingRow>();
    for (const r of rows) {
      const key = `${r.context?.check ?? r.message}|${r.context?.domain ?? ""}`;
      if (!seen.has(key)) seen.set(key, r);
    }
    return [...seen.values()].sort((a, b) => (a.level === "error" ? -1 : 1) - (b.level === "error" ? -1 : 1));
  }, [rows]);

  const critical = latest.filter((r) => r.level === "error").length;
  const warns = latest.filter((r) => r.level === "warn").length;

  return (
    <section className="rounded-3xl border border-white/80 bg-white/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(255,126,95,0.35)] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#2D1B0D]">Smart Brain — Leak Monitor</h2>
            <p className="text-sm text-[#7A5C45]">
              Probes every ad domain as Facebook, Meta and a human reviewer would. Read-only — never affects live traffic.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => scan.mutate()} disabled={scan.isPending}>
            <RefreshCw className={`w-4 h-4 mr-2 ${scan.isPending ? "animate-spin" : ""}`} />
            {scan.isPending ? "Scanning…" : "Run leak scan"}
          </Button>
          <Button variant="outline" onClick={() => clear.mutate()} disabled={clear.isPending}>
            <Trash2 className="w-4 h-4 mr-2" /> Clear
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox label="Critical leaks" value={critical} tone={critical > 0 ? "bad" : "good"} />
        <StatBox label="Warnings" value={warns} tone={warns > 0 ? "warn" : "good"} />
        <StatBox label="Checks recorded" value={latest.length} tone="neutral" />
      </div>

      {list.isLoading ? (
        <p className="text-sm text-[#7A5C45]">Loading…</p>
      ) : latest.length === 0 ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm">
          <CheckCircle2 className="w-4 h-4" /> No leaks recorded. Run a scan to verify the current state.
        </div>
      ) : (
        <div className="space-y-3">
          {latest.map((r) => {
            const ctx = r.context ?? {};
            const bad = r.level === "error";
            return (
              <div
                key={r.id}
                className={`rounded-2xl border p-4 ${bad ? "border-rose-200 bg-rose-50/70" : "border-amber-200 bg-amber-50/70"}`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${bad ? "text-rose-600" : "text-amber-600"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${bad ? "bg-rose-600 text-white" : "bg-amber-500 text-white"}`}>
                        {bad ? "critical" : "warning"}
                      </span>
                      <span className="text-xs font-semibold text-[#2D1B0D]">{ctx.domain}</span>
                      <span className="text-[11px] text-[#7A5C45] font-mono">{ctx.check}</span>
                      <span className="text-[11px] text-[#9b8271]">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-[#2D1B0D] break-words">
                      {r.message.replace(/^\[[^\]]+\]\s*/, "")}
                    </p>
                    {ctx.url && <p className="text-xs text-[#7A5C45] break-all font-mono">{ctx.url}</p>}
                    {ctx.evidence && (
                      <p className="mt-1 text-xs text-[#7A5C45] break-all">
                        <span className="font-semibold">Evidence:</span> {ctx.evidence}
                      </p>
                    )}
                    {ctx.fix && (
                      <div className="mt-2 flex items-start gap-2 rounded-xl bg-white/80 border border-white p-2">
                        <p className="text-xs text-[#2D1B0D] flex-1">
                          <span className="font-semibold">Fix:</span> {ctx.fix}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(ctx.fix || "");
                            toast.success("Fix copied");
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: "good" | "bad" | "warn" | "neutral" }) {
  const cls =
    tone === "bad"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "good"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-white bg-white/70 text-[#2D1B0D]";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{label}</div>
    </div>
  );
}
