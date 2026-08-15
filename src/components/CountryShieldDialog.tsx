import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Shield, X, Lock, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updateBlockedCountries } from "@/lib/links.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkId: string;
  linkTitle: string;
  initial: string[];
  planSlug: string | null | undefined;
};

// 2026-08-15: shield list trimmed to the real ad-reviewer desks only
// (US / FR / GB / CA). Buyer countries such as PH, IN, ID, BD are NEVER
// offered here — they carry real human traffic and are handled by the
// automatic bot-detection layer instead of a country block.
const PRESET_HIGH_RISK = [
  { code: "US", name: "United States", botPct: "98.6%" },
  { code: "FR", name: "France", botPct: "22.1%" },
  { code: "GB", name: "United Kingdom", botPct: "—" },
  { code: "CA", name: "Canada", botPct: "—" },
];

const PRESET_MEDIUM_RISK = [
  { code: "DK", name: "Denmark", botPct: "97.6%" },
  { code: "IE", name: "Ireland", botPct: "91.0%" },
  { code: "OM", name: "Oman", botPct: "56.8%" },
];


export function CountryShieldDialog({ open, onOpenChange, linkId, linkTitle, initial, planSlug }: Props) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateBlockedCountries);
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");

  const plan = String(planSlug ?? "free").toLowerCase();
  const isPaid = plan === "monthly" || plan === "lifetime" || plan === "unlimited";

  useEffect(() => {
    if (open) setSelected(initial.map((c) => c.toUpperCase()));
  }, [open, initial]);

  const mut = useMutation({
    mutationFn: (countries: string[]) => updateFn({ data: { id: linkId, countries } }),
    onSuccess: () => {
      toast.success("Country Shield updated");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update"),
  });

  const toggle = (code: string) => {
    const c = code.toUpperCase();
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  };

  const addCustom = () => {
    const c = custom.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) {
      toast.error("Enter a 2-letter country code (e.g. CA)");
      return;
    }
    if (!selected.includes(c)) setSelected((s) => [...s, c]);
    setCustom("");
  };

  const applyPreset = (which: "smart" | "strict" | "off") => {
    if (which === "off") return setSelected([]);
    if (which === "smart") return setSelected(PRESET_HIGH_RISK.map((p) => p.code));
    setSelected([...PRESET_HIGH_RISK, ...PRESET_MEDIUM_RISK].map((p) => p.code));
  };

  const allKnown = useMemo(() => [...PRESET_HIGH_RISK, ...PRESET_MEDIUM_RISK], []);
  const extras = selected.filter((c) => !allKnown.some((p) => p.code === c));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#2D1B0D]">
            <Shield className="w-5 h-5 text-[#FF7E5F]" />
            Country Shield — {linkTitle}
          </DialogTitle>
        </DialogHeader>

        {!isPaid ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-[#2D1B0D] mb-2">Pro Feature</h3>
            <p className="text-sm text-[#7D6452] max-w-md mx-auto mb-5">
              Country Shield lets you block high-risk FB ad-reviewer countries (US, DK, IE...)
              from seeing your offer URL. Available on <b>Monthly</b> and <b>Lifetime</b> plans.
            </p>
            <Link
              to="/upgrade"
              onClick={() => onOpenChange(false)}
              className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all"
            >
              Upgrade to Unlock
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-xs text-[#7D6452]">
              Visitors from selected countries will see the safe article page instead of the offer.
              Based on your last 7 days of traffic, these are the most bot-heavy countries.
            </p>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => applyPreset("off")}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-stone-100 text-stone-700 hover:bg-stone-200">
                Off (Clear all)
              </button>
              <button onClick={() => applyPreset("smart")}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                Smart (US + DK + IE + OM)
              </button>
              <button onClick={() => applyPreset("strict")}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200">
                Strict (all listed below)
              </button>
            </div>

            {/* High risk */}
            <div>
              <h4 className="text-[10px] uppercase tracking-[0.18em] font-bold text-rose-600 mb-2">
                🔴 High Risk (Recommended Block)
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_HIGH_RISK.map((p) => (
                  <CountryRow key={p.code} {...p} selected={selected.includes(p.code)} onToggle={() => toggle(p.code)} />
                ))}
              </div>
            </div>

            {/* Medium risk */}
            <div>
              <h4 className="text-[10px] uppercase tracking-[0.18em] font-bold text-amber-600 mb-2">
                🟡 Medium Risk (Optional)
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_MEDIUM_RISK.map((p) => (
                  <CountryRow key={p.code} {...p} selected={selected.includes(p.code)} onToggle={() => toggle(p.code)} />
                ))}
              </div>
            </div>

            {/* Custom add */}
            <div>
              <h4 className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#A38D7D] mb-2">
                Add Custom Country (ISO-2)
              </h4>
              <div className="flex gap-2">
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="e.g. CA"
                  maxLength={2}
                  className="flex-1 px-3 py-2 rounded-lg border border-[#FFEDD5] focus:border-[#FF7E5F] outline-none text-sm font-mono uppercase"
                  onKeyDown={(e) => e.key === "Enter" && addCustom()}
                />
                <button onClick={addCustom}
                  className="px-4 py-2 rounded-lg bg-[#2D1B0D] text-white text-sm font-bold flex items-center gap-1 hover:bg-[#3D2B1D]">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              {extras.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {extras.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-mono font-bold bg-[#FFEDD5] text-[#2D1B0D]">
                      {c}
                      <button onClick={() => toggle(c)} className="hover:text-rose-600">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-[#FFEDD5]">
              <p className="text-xs text-[#7D6452]">
                <b className="text-[#2D1B0D]">{selected.length}</b> {selected.length === 1 ? "country" : "countries"} will be blocked
              </p>
              <div className="flex gap-2">
                <button onClick={() => onOpenChange(false)}
                  className="px-4 py-2 rounded-lg border border-[#FFEDD5] text-[#7D6452] text-sm font-bold hover:bg-stone-50">
                  Cancel
                </button>
                <button onClick={() => mut.mutate(selected)} disabled={mut.isPending}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white text-sm font-bold shadow hover:shadow-md disabled:opacity-50">
                  {mut.isPending ? "Saving..." : "Save Shield"}
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CountryRow({
  code, name, botPct, selected, onToggle,
}: { code: string; name: string; botPct: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${
        selected
          ? "border-[#FF7E5F] bg-orange-50"
          : "border-[#FFEDD5] hover:border-[#FF7E5F]/50 bg-white"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <input
          type="checkbox"
          checked={selected}
          readOnly
          className="w-4 h-4 accent-[#FF7E5F] flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#2D1B0D] truncate">
            <span className="font-mono">{code}</span> — {name}
          </p>
          {botPct !== "—" && (
            <p className="text-[10px] text-[#A38D7D]">{botPct} bots</p>
          )}
        </div>
      </div>
    </button>
  );
}
