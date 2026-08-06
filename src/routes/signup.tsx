import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Mail, Lock, User, Send, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { preSignupCheck } from "@/lib/signup-protection.functions";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — Sleepox" }] }),
  component: SignupPage,
});

const font = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function SignupPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const preCheck = useServerFn(preSignupCheck);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const tg = telegram.trim().replace(/^@/, "");

    // Signup protection gate (Gmail-only / disposable blocklist / IP cap)
    try {
      const check = await preCheck({ data: { email: normalizedEmail } });
      if (!check.ok) { setLoading(false); toast.error(check.error); return; }
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || "Signup check failed. Please try again.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail, password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName.trim(), telegram: tg },
      },
    });
    if (error) { setLoading(false); toast.error(error.message); return; }
    // On self-hosted Supabase with auto-confirm disabled, we might need to inform the user.
    // However, if the user says "at least they can login", we assume they might have auto-confirm on or we can try auto-login.
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setLoading(false);
    if (signInErr) { 
      toast.success("Account created! Please check your email to confirm (or contact admin)."); 
      navigate({ to: "/login" }); 
      return; 
    }
    await router.invalidate();
    navigate({ to: "/dashboard", replace: true });
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

      {/* FORM */}
      <div className="relative flex items-center justify-center px-5 py-12 sm:px-8 z-10 order-2 lg:order-1">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Link to="/"><BrandLogo /></Link>
          </div>
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-tr from-[#FF7E5F]/30 via-[#FEB47B]/20 to-transparent blur-2xl rounded-[2.5rem] pointer-events-none" />
            <div className="relative rounded-[2rem] border border-white/80 bg-white/60 backdrop-blur-2xl p-8 sm:p-10 shadow-xl shadow-orange-900/10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF7E5F]/10 border border-[#FF7E5F]/30 text-[#FF7E5F] text-[10px] font-bold uppercase tracking-widest mb-4">
                Create account
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#2D1B0D]">Start free in 60s.</h2>
              <p className="mt-2 text-sm text-[#7D6452]">No credit card. 1,000,000 free clicks every month.</p>

              <form onSubmit={onSubmit} className="mt-8 space-y-4">
                <FormField label="Full name" icon={<User className="w-4 h-4" />}>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe" className={inputCls} />
                </FormField>
                <FormField label="Email" icon={<Mail className="w-4 h-4" />}>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" className={inputCls} />
                </FormField>
                <FormField label="Telegram (optional)" icon={<Send className="w-4 h-4" />}>
                  <input type="text" value={telegram} onChange={(e) => setTelegram(e.target.value)}
                    placeholder="@username" className={inputCls} />
                </FormField>
                <FormField label="Password" icon={<Lock className="w-4 h-4" />}>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters" className={inputCls} minLength={6} />
                </FormField>

                <button type="submit" disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] hover:from-[#E66D50] hover:to-[#FF9F6B] text-white py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-orange-500/30 hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? "Creating account…" : <>Create account <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[#7D6452]">
                Already have an account?{" "}
                <Link to="/login" className="font-bold text-[#FF7E5F] hover:text-[#E66D50]">Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BRAND */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 z-10 order-1 lg:order-2">
        <Link to="/" aria-label="Sleepox home"><BrandLogo /></Link>

        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-xl border border-white/80 text-[#FF7E5F] text-[10px] font-bold uppercase tracking-widest shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF7E5F] animate-pulse" /> 2,418 joined this month
          </div>

          <h1 className="text-5xl xl:text-6xl font-extrabold leading-[1.05] text-[#2D1B0D] tracking-tight">
            Built for the<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FF7E5F] via-[#FEB47B] to-[#FF7E5F]">
              serious affiliates.
            </span>
          </h1>

          <div className="grid grid-cols-2 gap-3">
            <KpiTile label="Avg clicks / user" value="184k" delta="+22%" />
            <KpiTile label="Bot block rate" value="98.2%" delta="↑ 5-layer" />
            <KpiTile label="Activation" value="< 60s" delta="No KYC" />
            <KpiTile label="Lifetime price" value="$50" delta="One-time" />
          </div>

          <div className="rounded-2xl bg-white/60 backdrop-blur-xl border border-white/80 shadow-sm p-5 space-y-3">
            {[
              "Free 1M clicks / month, no credit card",
              "Crypto checkout via Plisio · USDT, BTC, LTC",
              "Geo + device routing on every plan",
              "Telegram support — 24h response",
            ].map((t) => (
              <div key={t} className="flex items-center gap-3 text-sm text-[#4A3728]">
                <CheckCircle2 className="w-4 h-4 text-[#FF7E5F] shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[#A38D7D] tracking-widest uppercase">© {new Date().getFullYear()} Sleepox · Smart links</p>
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-white/70 border border-[#FFEDD5] rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-[#FF7E5F] focus:bg-white transition-all text-[#2D1B0D] placeholder:text-[#A38D7D]";

function FormField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
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

function KpiTile({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/80 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A38D7D] mb-1">{label}</div>
      <div className="text-2xl font-extrabold text-[#2D1B0D]">{value}</div>
      <div className="text-[10px] text-[#FF7E5F] mt-1 font-bold uppercase tracking-wider">{delta}</div>
    </div>
  );
}
