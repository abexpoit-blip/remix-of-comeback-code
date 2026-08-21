import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Mail, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Sleepox" },
      { name: "description", content: "Request a secure password reset link for your Sleepox smart-link account." },
      { property: "og:title", content: "Reset your password — Sleepox" },
      { property: "og:description", content: "Request a secure password reset link for your Sleepox account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

const font = { fontFamily: "'Outfit', system-ui, sans-serif" } as const;

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSent(true);
      toast.success("Reset link sent. Check your inbox and spam folder.");
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#FFF9F5] text-[#4A3728] flex items-center justify-center px-5 py-12" style={font}>
      <div className="fixed top-[-15%] left-[-10%] w-[55%] h-[55%] bg-[#FF7E5F]/20 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[50%] h-[55%] bg-[#FEB47B]/25 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        <div className="mb-8 flex justify-center"><Link to="/"><BrandLogo /></Link></div>
        <div className="rounded-[2rem] border border-white/80 bg-white/60 backdrop-blur-2xl p-8 sm:p-10 shadow-xl shadow-orange-900/10">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2D1B0D]">Forgot password?</h1>
          <p className="mt-2 text-sm text-[#7D6452]">
            {sent
              ? "If that email exists, a reset link is on its way. The link expires in 1 hour."
              : "Enter your account email and we'll send you a secure reset link."}
          </p>

          {!sent && (
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A38D7D] mb-2 block">Email</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A38D7D]"><Mail className="w-4 h-4" /></span>
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-white/70 border border-[#FFEDD5] rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-[#FF7E5F] focus:bg-white transition-all text-[#2D1B0D] placeholder:text-[#A38D7D]"
                  />
                </div>
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-orange-500/30 hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Sending…" : <>Send reset link <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          <p className="mt-7 text-center text-sm text-[#7D6452]">
            <Link to="/login" className="font-bold text-[#FF7E5F] hover:text-[#E66D50]">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
