import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles, Megaphone, Gift, AlertTriangle, Info, CheckCircle2,
  Crown, Zap, Rocket, Star, Trophy, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { listActiveBroadcasts, markBroadcastRead } from "@/lib/broadcasts.functions";
import { BroadcastMarkdown } from "@/components/broadcast-markdown";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles, megaphone: Megaphone, gift: Gift, warning: AlertTriangle,
  info: Info, check: CheckCircle2, crown: Crown, zap: Zap, rocket: Rocket,
  star: Star, trophy: Trophy,
};

const TONE: Record<string, { grad: string; ring: string; badge: string; accent: string }> = {
  premium: {
    grad: "from-[#FF7E5F] via-[#FEB47B] to-[#FFD4BB]",
    ring: "shadow-[0_25px_80px_-20px_rgba(255,126,95,0.55)]",
    badge: "bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white",
    accent: "text-[#FF7E5F]",
  },
  info: {
    grad: "from-blue-400 via-blue-500 to-indigo-600",
    ring: "shadow-[0_25px_80px_-20px_rgba(59,130,246,0.5)]",
    badge: "bg-blue-500 text-white",
    accent: "text-blue-600",
  },
  success: {
    grad: "from-emerald-400 via-emerald-500 to-teal-600",
    ring: "shadow-[0_25px_80px_-20px_rgba(16,185,129,0.5)]",
    badge: "bg-emerald-500 text-white",
    accent: "text-emerald-600",
  },
  warning: {
    grad: "from-amber-400 via-orange-500 to-red-500",
    ring: "shadow-[0_25px_80px_-20px_rgba(245,158,11,0.5)]",
    badge: "bg-amber-500 text-white",
    accent: "text-amber-600",
  },
};

const SESSION_FLAG = "sleepox_login_notice_seen_v1";

export function BroadcastLoginPopup() {
  const list = useServerFn(listActiveBroadcasts);
  const mark = useServerFn(markBroadcastRead);

  const q = useQuery({
    queryKey: ["broadcasts"],
    queryFn: () => list(),
    staleTime: 60_000,
  });

  const unread = useMemo(
    () => (q.data?.items ?? []).filter((b: any) => !b.is_read),
    [q.data],
  );

  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Trigger once per browser session when unread notices exist.
  useEffect(() => {
    if (!mounted || unread.length === 0) return;
    try {
      if (sessionStorage.getItem(SESSION_FLAG)) return;
      sessionStorage.setItem(SESSION_FLAG, "1");
    } catch {}
    setIdx(0);
    setOpen(true);
  }, [mounted, unread.length]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!mounted || !open || unread.length === 0) return null;
  const current = unread[Math.min(idx, unread.length - 1)];
  if (!current) return null;

  const tone = TONE[current.tone] ?? TONE.info;
  const Icon = ICON_MAP[current.icon] ?? Sparkles;
  const total = unread.length;

  const goNext = async () => {
    try { await mark({ data: { broadcast_id: current.id } }); } catch {}
    if (idx + 1 < total) setIdx(idx + 1);
    else close();
  };
  const goPrev = () => setIdx(Math.max(0, idx - 1));
  const close = async () => {
    try { await mark({ data: { broadcast_id: current.id } }); } catch {}
    setOpen(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 md:p-8 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#1a0f08]/70 backdrop-blur-md"
        onClick={close}
      />

      {/* Card — fluid width, capped, never taller than viewport */}
      <div
        className={`relative w-full max-w-[min(96vw,42rem)] max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl overflow-hidden bg-white ${tone.ring} animate-in zoom-in-95 slide-in-from-bottom-4 duration-300`}
      >
        {/* Top gradient banner */}
        <div className={`relative h-28 sm:h-36 md:h-40 shrink-0 bg-gradient-to-br ${tone.grad} overflow-hidden`}>
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.4) 0%, transparent 40%)",
          }} />
          <div className="absolute -bottom-8 -right-6 w-40 h-40 rounded-full bg-white/20 blur-2xl" />

          <button
            onClick={close}
            aria-label="Close notice"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/25 hover:bg-white/40 backdrop-blur flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {total > 1 && (
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-white/25 backdrop-blur text-white text-[11px] font-semibold tracking-wide">
              {idx + 1} / {total}
            </div>
          )}

          {/* Floating icon */}
          <div className="absolute -bottom-8 left-5 sm:left-7">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center ring-4 ring-white">
              <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${tone.grad} flex items-center justify-center`}>
                <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Body — flexes and scrolls internally so footer stays visible */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 pt-12 sm:pt-14 pb-5 sm:pb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${tone.badge}`}>
              {current.tone === "premium" ? "✦ Premium" : current.tone}
            </span>
            <span className="text-[11px] text-[#9A9488]">
              {new Date(current.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>

          <h2
            id="notice-title"
            className="text-2xl sm:text-3xl md:text-[32px] leading-tight text-[#2A2A28] mb-4 break-words"
            style={{ fontFamily: "'Instrument Serif', 'Outfit', serif", fontWeight: 500 }}
          >
            {current.title}
          </h2>

          <div className="text-[15px] sm:text-base leading-relaxed text-[#5A554C]">
            <BroadcastMarkdown>{current.body}</BroadcastMarkdown>
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 sm:px-8 py-4 bg-[#FAF7F2] border-t border-[#EFE9DD]">
          <div className="flex items-center gap-1.5 min-w-0">
            {total > 1 && Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? `w-6 bg-gradient-to-r ${tone.grad}` : "w-1.5 bg-[#DDD5C4]"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {total > 1 && idx > 0 && (
              <button
                onClick={goPrev}
                className="w-9 h-9 rounded-full border border-[#E8E2D5] text-[#5A554C] hover:bg-white flex items-center justify-center transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={goNext}
              className={`px-5 sm:px-6 h-10 sm:h-11 rounded-full bg-gradient-to-r ${tone.grad} text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5`}
            >
              {idx + 1 < total ? (
                <>Next <ChevronRight className="w-4 h-4" /></>
              ) : (
                <>Got it ✦</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
