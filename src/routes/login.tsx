import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { toast } from "sonner";
import { Mail, Lock, ArrowRight, ShieldCheck, Zap, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Sleepox" }] }),
  component: LoginPage,
});

const font = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("The login server took too long to respond. Please try again.")), 20_000);
        }),
      ]);
      if (result.error || !result.data.session) {
        toast.error(result.error?.message ?? "Login failed");
        return;
      }

      // Session is in localStorage. Try SPA nav; hard-redirect as a guaranteed fallback.
      const fallback = window.setTimeout(() => { window.location.replace("/dashboard"); }, 1200);
      try {
        await navigate({ to: "/dashboard", replace: true });
        window.clearTimeout(fallback);
      } catch {
        window.clearTimeout(fallback);
        window.location.replace("/dashboard");
      }
    } catch {
      toast.error("Could not reach the login server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div
      className="relative min-h-screen w-full bg-[#FFF9F5] text-[#4A3728] overflow-hidden grid lg:grid-cols-2"
      style={font}
    >
      {/* warm blobs */}
      <div className="fixed top-[-15%] left-[-10%] w-[55%] h-[55%] bg-[#FF7E5F]/20 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[50%] h-[55%] bg-[#FEB47B]/25 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed top-[30%] left-[30%] w-[35%] h-[35%] bg-[#FFEDD5]/50 blur-[120px] rounded-full pointer-events-none" />

      {/* LEFT — brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 z-10">
        <Link to="/" aria-label="Sleepox home"><BrandLogo /></Link>

        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-xl border border-white/80 text-[#FF7E5F] text-[10px] font-bold uppercase tracking-widest shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF7E5F] animate-pulse" /> Live now
          </div>

          <h1 className="text-5xl xl:text-6xl font-extrabold leading-[1.05] text-[#2D1B0D] tracking-tight">
            Operate at the<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FF7E5F] via-[#FEB47B] to-[#FF7E5F]">
              edge of every click.
            </span>
          </h1>

          <div className="grid grid-cols-3 gap-3">
            {[
              { v: "30ms", l: "Edge redirect" },
              { v: "99.9%", l: "Uptime SLA" },
              { v: "5M+", l: "Daily clicks" },
            ].map((s) => (
              <div key={s.l} className="p-4 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/80 shadow-sm">
                <div className="text-2xl font-extrabold text-[#2D1B0D]">{s.v}</div>
                <div className="mt-1 text-[10px] text-[#FF7E5F] uppercase tracking-widest font-bold">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white/60 backdrop-blur-xl border border-white/80 shadow-sm p-5 space-y-3">
            {[
              { Icon: ShieldCheck, t: "5-layer bot filter on every redirect" },
              { Icon: Zap, t: "Global edge — sub 30ms everywhere" },
              { Icon: BarChart3, t: "Real-time analytics & geo routing" },
            ].map(({ Icon, t }) => (
              <div key={t} className="flex items-center gap-3 text-sm text-[#4A3728]">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center shadow shadow-orange-500/30">
                  <Icon className="w-3.5 h-3.5 text-white" />
                </span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[#A38D7D] tracking-widest uppercase">© {new Date().getFullYear()} Sleepox · Smart links</p>
      </div>

      {/* RIGHT — form */}
      <div className="relative flex items-center justify-center px-5 py-12 sm:px-8 z-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Link to="/"><BrandLogo /></Link>
          </div>

          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-tr from-[#FF7E5F]/30 via-[#FEB47B]/20 to-transparent blur-2xl rounded-[2.5rem] pointer-events-none" />
            <div className="relative rounded-[2rem] border border-white/80 bg-white/60 backdrop-blur-2xl p-8 sm:p-10 shadow-xl shadow-orange-900/10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF7E5F]/10 border border-[#FF7E5F]/30 text-[#FF7E5F] text-[10px] font-bold uppercase tracking-widest mb-4">
                Sign in
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#2D1B0D]">Welcome back.</h2>
              <p className="mt-2 text-sm text-[#7D6452]">Pick up where you left off. Your dashboard is live.</p>

              <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <Field label="Email" icon={<Mail className="w-4 h-4" />}>
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" className={inputCls}
                  />
                </Field>
                <Field label="Password" icon={<Lock className="w-4 h-4" />}>
                  <input
                    type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" className={inputCls}
                  />
                </Field>

                <button
                  type="submit" disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] hover:from-[#E66D50] hover:to-[#FF9F6B] text-white py-3.5 rounded-2xl font-bold text-sm tracking-tight transition-all shadow-lg shadow-orange-500/30 hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Signing in…" : <>Sign in <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-[#7D6452]">
                New here?{" "}
                <Link to="/signup" className="font-bold text-[#FF7E5F] hover:text-[#E66D50]">Create an account</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-white/70 border border-[#FFEDD5] rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-[#FF7E5F] focus:bg-white transition-all text-[#2D1B0D] placeholder:text-[#A38D7D]";

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A38D7D] mb-2 block">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A38D7D]">{icon}</span>
        {children}
      </div>
    </div>
  );
}
