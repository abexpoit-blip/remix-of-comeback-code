import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";
import { LayoutDashboard, BarChart3, Crown, ShieldCheck, LogOut, Menu, X, Globe, Activity, Shield, Bell, Ban, Bug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { consumeDailyRedirect } from "@/lib/app-settings.functions";
import { BrandLogo } from "@/components/brand-logo";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { BroadcastBell } from "@/components/broadcast-bell";
import { BroadcastLoginPopup } from "@/components/broadcast-login-popup";

export const Route = createFileRoute("/_authenticated")({
  head: () => ({
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" },
    ],
  }),
  // Auth check is client-only — SSR has no localStorage so getSession() would
  // always be null and bounce users to /login on every hard refresh.
  component: AuthenticatedLayout,
});

const navMgmt = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/live", label: "Live Feed", icon: Activity },
  { to: "/notices", label: "Notices", icon: Bell },
  { to: "/domains", label: "Domains", icon: Globe },
  { to: "/link-debugger", label: "Link Debugger", icon: Bug },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banChecked, setBanChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const authCheckedRef = useRef(false);
  const dailyFn = useServerFn(consumeDailyRedirect);

  // Client-only auth gate. Wait for session restore before deciding to redirect.
  useEffect(() => {
    let mounted = true;
    const finishInitialAuthCheck = (u: User | null) => {
      if (!mounted) return;
      setUser(u);
      authCheckedRef.current = true;
      setAuthChecked(true);
      if (!u) navigate({ to: "/login" });
    };

    // A transient network failure makes supabase-js emit SIGNED_OUT / null
    // session even though the refresh token in localStorage is still valid.
    // Re-verify once before kicking the user out, so users stop getting
    // randomly logged out mid-session.
    const bounceIfReallySignedOut = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session?.user) {
        setUser(data.session.user);
        return;
      }
      navigate({ to: "/login" });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      const u = session?.user ?? null;
      if (u) setUser(u);
      if (event === "SIGNED_OUT") { void bounceIfReallySignedOut(); return; }
      if (authCheckedRef.current && !u && event !== "INITIAL_SESSION") void bounceIfReallySignedOut();
    });

    // Watchdog: a stalled token refresh can leave getSession() pending
    // forever, which used to freeze the app on "Loading…".
    const authWatchdog = setTimeout(() => {
      if (!authCheckedRef.current) finishInitialAuthCheck(null);
    }, 8000);

    supabase.auth.getSession().then(({ data }) => {
      finishInitialAuthCheck(data.session?.user ?? null);
    }).catch(() => {
      finishInitialAuthCheck(null);
    });
    return () => { mounted = false; clearTimeout(authWatchdog); subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const uid = user.id;

    // Fail-open: never let a slow/failing profile lookup trap the user on
    // "Loading…". Worst case we render the dashboard without the ban check.
    const watchdog = setTimeout(() => { if (!cancelled) setBanChecked(true); }, 5000);

    (async () => {
      try {
        const [roleRes, profRes] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
          supabase.from("profiles").select("is_banned").eq("id", uid).maybeSingle(),
        ]);
        if (cancelled) return;
        setIsAdmin(!!roleRes.data);
        setIsBanned(!!profRes.data?.is_banned);
      } catch {
        /* network hiccup — fail open */
      } finally {
        if (!cancelled) setBanChecked(true);
      }
      // Non-blocking: last-login tracking must never gate the UI.
      void supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", uid);
    })();

    return () => { cancelled = true; clearTimeout(watchdog); };
  }, [user]);


  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await dailyFn();
        if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
      } catch { /* silent */ }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  // Don't render protected UI until we've confirmed an authenticated session
  // AND the ban check has completed. Otherwise banned users see a flash of
  // the dashboard before the suspension screen appears.
  if (!authChecked || !user || !banChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF9F5] text-[#7A5C45] text-sm">
        Loading…
      </div>
    );
  }

  // Banned user — block all dashboard access, show suspension notice.
  if (isBanned) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center px-6 bg-[#FFF9F5] text-[#4A3728] relative overflow-hidden"
        style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}
      >
        <div className="fixed top-[-15%] left-[-10%] w-[55%] h-[55%] bg-red-400/15 blur-[140px] rounded-full pointer-events-none" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-300/20 blur-[140px] rounded-full pointer-events-none" />
        <div className="relative max-w-md w-full bg-white/80 backdrop-blur-2xl border border-white/80 rounded-3xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
            <Ban className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-[#2D1B0D] mb-3">Account Suspended</h1>
          <p className="text-sm text-[#7D6452] leading-relaxed mb-2">
            Your account has been <span className="font-semibold text-red-600">banned</span> by an administrator.
          </p>
          <p className="text-sm text-[#7D6452] leading-relaxed mb-6">
            You cannot access the dashboard, create, edit, or delete links. If you believe this is a mistake, please contact support.
          </p>
          <div className="bg-[#FFF4ED] border border-[#FFE4D2] rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs text-[#A38D7D] uppercase tracking-wider font-bold mb-1">Signed in as</p>
            <p className="text-sm font-semibold text-[#2D1B0D] truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] text-white font-semibold rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const initials = (user.email ?? "U").slice(0, 2).toUpperCase();

  const SidebarContent = (
    <>
      <div className="flex items-center justify-between mb-12">
        <Link to="/dashboard" aria-label="Sleepox dashboard">
          <BrandLogo />
        </Link>
        <button
          className="lg:hidden p-2 text-[#7D6452] hover:text-[#2D1B0D]"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-8">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#A38D7D] font-bold mb-3 ml-3">Management</p>
          {navMgmt.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={
                  active
                    ? "flex items-center gap-3 px-4 py-2.5 text-[#FF7E5F] bg-gradient-to-r from-[#FF7E5F]/15 to-transparent rounded-2xl border border-[#FF7E5F]/25 shadow-sm font-semibold transition-all"
                    : "flex items-center gap-3 px-4 py-2.5 text-[#7D6452] hover:text-[#2D1B0D] hover:bg-white/40 rounded-2xl transition-all font-medium"
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#A38D7D] font-bold mb-3 ml-3">Account</p>
          <Link
            to="/upgrade"
            className={
              pathname === "/upgrade"
                ? "flex items-center gap-3 px-4 py-2.5 text-white font-semibold bg-gradient-to-r from-[#FF7E5F] to-[#FEB47B] rounded-2xl shadow-lg shadow-orange-500/30"
                : "flex items-center gap-3 px-4 py-2.5 text-[#FF7E5F] font-semibold bg-[#FF7E5F]/10 rounded-2xl border border-[#FF7E5F]/20 hover:bg-[#FF7E5F]/15 transition-all"
            }
          >
            <Crown className="w-4 h-4" />
            Upgrade Pro
          </Link>

          {isAdmin && (
            <Link
              to="/control-panel"
              className={
                pathname === "/control-panel"
                  ? "flex items-center gap-3 px-4 py-2.5 text-[#FF7E5F] bg-[#FF7E5F]/10 rounded-2xl border border-[#FF7E5F]/25 font-semibold"
                  : "flex items-center gap-3 px-4 py-2.5 text-[#7D6452] hover:text-[#2D1B0D] hover:bg-white/40 rounded-2xl transition-all font-medium"
              }
            >
              <ShieldCheck className="w-4 h-4" />
              Control Panel
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/smart-filter"
              className={
                pathname === "/smart-filter"
                  ? "flex items-center gap-3 px-4 py-2.5 text-[#FF7E5F] bg-[#FF7E5F]/10 rounded-2xl border border-[#FF7E5F]/25 font-semibold"
                  : "flex items-center gap-3 px-4 py-2.5 text-[#7D6452] hover:text-[#2D1B0D] hover:bg-white/40 rounded-2xl transition-all font-medium"
              }
            >
              <Shield className="w-4 h-4" />
              Smart Filter
            </Link>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[#7D6452] hover:text-[#2D1B0D] hover:bg-white/40 rounded-2xl transition-all font-medium"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </nav>

      <div className="mt-auto pt-6 border-t border-[#FFEDD5]">
        <div className="flex items-center gap-3 bg-white/60 p-3 rounded-2xl border border-white/80 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF7E5F] to-[#FEB47B] flex items-center justify-center text-white text-xs font-bold shadow-md">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#2D1B0D] truncate">{user?.email}</p>
            <p className="text-[10px] text-[#FF7E5F] uppercase tracking-wider font-bold">{isAdmin ? "Admin" : "Premium Tier"}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="min-h-screen w-full flex bg-[#FFF9F5] text-[#4A3728] overflow-hidden relative"
      style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}
    >
      {/* Warm ambient blobs */}
      <div className="fixed top-[-15%] left-[-10%] w-[55%] h-[55%] bg-[#FF7E5F]/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed top-[10%] right-[-15%] w-[50%] h-[55%] bg-[#FEB47B]/20 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[20%] w-[45%] h-[45%] bg-[#FFEDD5]/40 blur-[130px] rounded-full pointer-events-none" />

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-5 py-4 backdrop-blur-2xl bg-white/70 border-b border-white/60">
        <Link to="/dashboard" aria-label="Sleepox dashboard">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-2">
          <BroadcastBell />
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 rounded-xl bg-white/60 border border-white/80 text-[#2D1B0D]"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-[#2D1B0D]/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={
          "fixed lg:static inset-y-0 left-0 z-50 w-72 border-r border-white/60 flex flex-col p-7 backdrop-blur-3xl bg-white/70 lg:bg-white/40 shrink-0 transition-transform duration-300 " +
          (menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")
        }
      >
        {SidebarContent}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto z-10 pt-16 lg:pt-0">
        <ImpersonationBanner />
        <Outlet />
      </main>

      {/* Login-time notice popup (premium modal, once per session) */}
      <BroadcastLoginPopup />
    </div>
  );
}
