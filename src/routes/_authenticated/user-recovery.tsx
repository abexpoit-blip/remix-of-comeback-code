import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Search, ShieldCheck, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminFindUser, adminResetUserPassword } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/user-recovery")({
  head: () => ({
    meta: [
      { title: "Account recovery — Sleepox admin" },
      { name: "description", content: "Admin tool to look up an account and issue a new password for a locked-out user." },
      { property: "og:title", content: "Account recovery — Sleepox admin" },
      { property: "og:description", content: "Admin tool to restore access for locked-out accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UserRecoveryPage,
});

type Found = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan_slug: string | null;
  clicks_used: number | null;
  created_at: string | null;
  last_login_at: string | null;
};

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return `${out}@1`;
}

function UserRecoveryPage() {
  const findUser = useServerFn(adminFindUser);
  const resetPassword = useServerFn(adminResetUserPassword);

  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<Found | null>(null);
  const [linkCount, setLinkCount] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setUser(null);
    setDone(false);
    try {
      const res = await findUser({ data: { email } });
      if (!res.found) {
        toast.error("No account found with that email.");
        return;
      }
      setUser(res.profile as Found);
      setLinkCount(res.linkCount);
      setNewPassword(randomPassword());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setSearching(false);
    }
  };

  const onReset = async () => {
    if (!user) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await resetPassword({ data: { userId: user.id, newPassword } });
      setDone(true);
      toast.success("Password updated. Share it with the user.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account recovery</h1>
          <p className="text-sm text-muted-foreground">
            Look up a locked-out user and issue a new password instantly. No email needed.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Find the account</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com" className="h-11"
            />
            <Button type="submit" disabled={searching} className="h-11 gap-2">
              <Search className="h-4 w-4" /> {searching ? "Searching…" : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {user && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. Account found</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Row label="Email" value={user.email ?? "—"} />
              <Row label="Name" value={user.full_name ?? "—"} />
              <Row label="Plan" value={user.plan_slug ?? "free"} />
              <Row label="Links" value={String(linkCount)} />
              <Row label="Clicks used" value={String(user.clicks_used ?? 0)} />
              <Row label="Joined" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"} />
            </dl>

            <div className="space-y-2">
              <Label htmlFor="np">New password</Label>
              <div className="flex gap-2">
                <Input id="np" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-11 font-mono" />
                <Button type="button" variant="outline" className="h-11" onClick={() => setNewPassword(randomPassword())}>
                  New
                </Button>
                <Button
                  type="button" variant="outline" className="h-11 gap-2"
                  onClick={() => { navigator.clipboard.writeText(newPassword); toast.success("Copied"); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button onClick={onReset} disabled={saving} className="w-full h-11 gap-2">
              <KeyRound className="h-4 w-4" /> {saving ? "Updating…" : "Set this password"}
            </Button>

            {done && (
              <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
                Done. Send this password to <strong>{user.email}</strong> and ask them to change it after signing in.
                All their links and stats are untouched.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  );
}
