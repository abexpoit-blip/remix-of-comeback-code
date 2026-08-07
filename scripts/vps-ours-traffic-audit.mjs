#!/usr/bin/env node
/**
 * Ours / Adsterra traffic audit — run on the VPS from the app root:
 *   node scripts/vps-ours-traffic-audit.mjs            # last 1 hour
 *   HOURS=6 node scripts/vps-ours-traffic-audit.mjs    # custom window
 *
 * Answers:
 *  1. Is our_adsterra_url actually configured (or silently falling back)?
 *  2. What % of last-hour clicks went ours / offer / safe / fb-article?
 *  3. Which destination hosts did we actually send people to?
 *  4. Are humans being eaten by the bot filter / fingerprint auto-block?
 */
import fs from "node:fs";
import path from "node:path";

const HOURS = Number(process.env.HOURS || 1);
const root = process.cwd();

function loadEnv() {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const URL_BASE = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;

if (!URL_BASE || !KEY) {
  console.error("!! missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(2);
}

async function rest(pathname) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathname}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`${pathname} → ${res.status} ${await res.text()}`);
  return res.json();
}

const pct = (n, total) => (total ? ((n / total) * 100).toFixed(1) + "%" : "0%");
const bar = (n, total) => "█".repeat(Math.round((total ? n / total : 0) * 30));

function tally(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r) ?? "-";
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const since = new Date(Date.now() - HOURS * 3600e3).toISOString();

console.log(`\n=== SLEEPOX OURS/ADSTERRA AUDIT — last ${HOURS}h (since ${since}) ===\n`);

// 1. settings
const [settings] = await rest("app_settings?select=*&limit=1");
const ourUrl = settings?.our_adsterra_url || null;
console.log("--- [1] app_settings ---");
console.log("  our_adsterra_url   :", ourUrl || "❌ NOT SET (ours traffic falls back to safe page!)");
console.log("  fallback_url       :", settings?.fallback_url || "-");
console.log("  injection_threshold:", settings?.injection_threshold, " injection_count:", settings?.injection_count);
if (settings?.injection_threshold != null) {
  const t = Math.max(100, settings.injection_threshold);
  const c = Math.max(0, Math.min(1000, Math.floor(t / 2), settings.injection_count ?? 0));
  console.log("  → effective ours rate:", ((c / (t + c)) * 100).toFixed(1) + "%");
}
if (!ourUrl) console.log("  ⚠ FIX: Control Panel → set the Adsterra direct link as our_adsterra_url");

// 2. clicks
const clicks = await rest(
  `clicks?select=created_at,routed_to,is_bot,bot_reason,country,device,signals,link_id&created_at=gte.${since}&order=created_at.desc&limit=20000`,
);
const total = clicks.length;
console.log(`\n--- [2] clicks in window: ${total} ---`);
for (const [k, v] of tally(clicks, (c) => c.routed_to)) {
  console.log(`  ${String(k).padEnd(12)} ${String(v).padStart(6)}  ${pct(v, total)}  ${bar(v, total)}`);
}
const bots = clicks.filter((c) => c.is_bot).length;
console.log(`  bots: ${bots} (${pct(bots, total)})   humans: ${total - bots}`);

console.log("\n--- [3] actual destination hosts (where traffic really went) ---");
for (const [k, v] of tally(clicks, (c) => c.signals?.target_host).slice(0, 15)) {
  console.log(`  ${String(k).padEnd(38)} ${String(v).padStart(6)}  ${pct(v, total)}`);
}
const ours = clicks.filter((c) => c.routed_to === "ours");
if (ours.length) {
  console.log(`\n  ours hits: ${ours.length}, destination hosts:`);
  for (const [k, v] of tally(ours, (c) => c.signals?.target_host)) console.log(`    ${k} → ${v}`);
  let ourHost = null;
  try { ourHost = ourUrl ? new URL(ourUrl).hostname : null; } catch {}
  const mismatched = ours.filter((c) => c.signals?.target_host && c.signals.target_host !== ourHost);
  if (ourHost && mismatched.length)
    console.log(`  ❌ ${mismatched.length} "ours" clicks did NOT go to ${ourHost} — they hit the safe/fallback page.`);
  else if (ourHost) console.log(`  ✅ all "ours" clicks pointed at ${ourHost}`);
} else {
  console.log("\n  ⚠ no 'ours' clicks recorded in this window");
}

console.log("\n--- [4] offer traffic (money page / adsterra link on each link) ---");
const offer = clicks.filter((c) => c.routed_to === "offer");
console.log(`  offer clicks: ${offer.length}`);
for (const [k, v] of tally(offer, (c) => c.signals?.target_host).slice(0, 10)) console.log(`    ${k} → ${v}`);
const noTarget = offer.filter((c) => !c.signals?.target_host).length;
if (noTarget) console.log(`  ⚠ ${noTarget} offer clicks had no target host recorded`);

console.log("\n--- [5] top bot reasons (traffic being filtered) ---");
for (const [k, v] of tally(clicks.filter((c) => c.is_bot), (c) => c.bot_reason).slice(0, 15)) {
  console.log(`  ${String(k).padEnd(34)} ${String(v).padStart(6)}  ${pct(v, bots)}`);
}

console.log("\n--- [6] country / device split (sanity: is 'all USA' back?) ---");
for (const [k, v] of tally(clicks, (c) => c.country).slice(0, 12)) console.log(`  ${String(k).padEnd(6)} ${String(v).padStart(6)} ${pct(v, total)}`);
console.log("  devices:", tally(clicks, (c) => c.device).map(([k, v]) => `${k}=${v}`).join("  "));

const desktop = clicks.filter((c) => c.device === "desktop");
const desktopSafe = desktop.filter((c) => c.routed_to === "safe").length;
console.log(`  desktop: ${desktop.length}, of which routed to safe: ${desktopSafe} (${pct(desktopSafe, desktop.length)})`);

console.log("\n--- [7] fingerprint auto-block state ---");
const fps = await rest("bot_fingerprints?select=fingerprint_hash,is_bot_count,is_human_count,auto_blocked,last_country,last_ip,updated_at&order=updated_at.desc&limit=500");
const blocked = fps.filter((f) => f.auto_blocked);
console.log(`  fingerprints (recent 500): ${fps.length}, auto_blocked: ${blocked.length}`);
const humanBlocked = blocked.filter((f) => (f.is_human_count || 0) > 0);
if (humanBlocked.length) {
  console.log(`  ⚠ ${humanBlocked.length} blocked fingerprints ALSO have human hits (possible false positives):`);
  humanBlocked.slice(0, 10).forEach((f) =>
    console.log(`    ${f.fingerprint_hash} bot=${f.is_bot_count} human=${f.is_human_count} ${f.last_country} ${f.last_ip}`),
  );
} else {
  console.log("  ✅ no auto-blocked fingerprint has human hits");
}

console.log("\n=== VERDICT ===");
const oursPct = total ? (ours.length / total) * 100 : 0;
console.log(`  ours share: ${oursPct.toFixed(1)}%  |  offer share: ${pct(offer.length, total)}  |  bot share: ${pct(bots, total)}`);
if (!ourUrl) console.log("  ❌ our_adsterra_url missing → ours traffic never reaches Adsterra.");
if (ours.length && ourUrl) console.log("  ℹ If Adsterra still shows 0, the link itself is the problem (wrong direct-link URL, or Adsterra rejecting the referrer).");
console.log("");
