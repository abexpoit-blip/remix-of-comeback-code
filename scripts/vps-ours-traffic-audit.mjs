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

const ENV_FILES = [
  process.env.ENV_FILE,
  path.join(root, ".env"),
  path.join(root, ".env.production"),
  path.join(root, ".env.local"),
  "/opt/supabase/docker/.env",
  "/opt/supabase/.env",
  "/root/supabase/docker/.env",
].filter(Boolean);

function loadEnv() {
  const out = {};
  for (const file of ENV_FILES) {
    try {
      if (!fs.existsSync(file)) continue;
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && out[m[1]] === undefined) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch { /* ignore unreadable env file */ }
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const URL_BASE = (
  env.SUPABASE_URL ||
  env.VITE_SUPABASE_URL ||
  env.SUPABASE_PUBLIC_URL ||
  env.API_EXTERNAL_URL ||
  ""
).replace(/\/+$/, "");
const KEY =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SERVICE_ROLE_KEY ||
  env.SUPABASE_SERVICE_KEY ||
  env.SERVICE_KEY ||
  env.SUPABASE_SECRET_KEY ||
  "";

if (!URL_BASE || !KEY) {
  console.error("!! could not resolve Supabase URL / service-role key.");
  console.error("   looked in:", ENV_FILES.filter((f) => fs.existsSync(f)).join(", ") || "(no env files found)");
  console.error("   url found:", URL_BASE ? "yes" : "NO");
  console.error("   key found:", KEY ? "yes" : "NO");
  console.error("   fix: SUPABASE_URL=http://127.0.0.1:8000 SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/vps-ours-traffic-audit.mjs");
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
  `clicks?select=created_at,routed_to,is_bot,bot_reason,country,device,ua,signals,link_id&created_at=gte.${since}&order=created_at.desc&limit=20000`,
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
  // Only clicks AFTER the link was last changed can be expected to use the new host.
  const changedAt = settings?.updated_at || since;
  const afterChange = ours.filter((c) => c.created_at >= changedAt);
  const stale = ours.length - afterChange.length;
  if (stale) console.log(`  ℹ ${stale} ours clicks happened BEFORE the link was changed (${changedAt}) — old host is expected.`);
  const mismatched = afterChange.filter((c) => c.signals?.target_host && c.signals.target_host !== ourHost);
  if (ourHost && mismatched.length)
    console.log(`  ❌ ${mismatched.length} of ${afterChange.length} post-change "ours" clicks did NOT go to ${ourHost}.`);
  else if (ourHost) console.log(`  ✅ all ${afterChange.length} post-change "ours" clicks pointed at ${ourHost}`);

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

// `device` column is often empty (we log UA instead) → derive from UA when missing.
const deviceOf = (c) => {
  if (c.device) return String(c.device).toLowerCase();
  const ua = String(c.ua || c.signals?.ua || "");
  if (!ua) return "unknown";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
};
console.log("  devices:", tally(clicks, deviceOf).map(([k, v]) => `${k}=${v}`).join("  "));

const desktop = clicks.filter((c) => deviceOf(c) === "desktop");
const desktopSafe = desktop.filter((c) => c.routed_to === "safe" || c.routed_to === "fallback").length;
const desktopBots = desktop.filter((c) => c.is_bot);
console.log(`  desktop: ${desktop.length}, routed to safe/fallback: ${desktopSafe} (${pct(desktopSafe, desktop.length)}), flagged bot: ${desktopBots.length} (${pct(desktopBots.length, desktop.length)})`);
if (desktopBots.length) {
  console.log("  desktop bot reasons:");
  for (const [k, v] of tally(desktopBots, (c) => c.bot_reason).slice(0, 10)) {
    console.log(`    ${String(k).padEnd(34)} ${String(v).padStart(6)}  ${pct(v, desktopBots.length)}`);
  }
  // real desktop users = desktop hits that are NOT known crawler UAs / FB infra
  const crawlerish = (r) => /^(fb-|crawler-|bot-|ua-bot|headless)/i.test(String(r || ""));
  const suspectFalsePositive = desktopBots.filter((c) => !crawlerish(c.bot_reason));
  console.log(`  ⚠ desktop blocked WITHOUT a crawler signature (possible real users lost): ${suspectFalsePositive.length}`);
  for (const [k, v] of tally(suspectFalsePositive, (c) => c.bot_reason).slice(0, 8)) {
    console.log(`    ${String(k).padEnd(34)} ${String(v).padStart(6)}`);
  }
}

console.log("\n--- [7] fingerprint auto-block state ---");
let fps = [];
let fpErr = null;
for (const q of [
  "bot_fingerprints?select=fingerprint_hash,is_bot_count,is_human_count,auto_blocked,last_ip,last_country,updated_at&order=updated_at.desc&limit=500",
  "bot_fingerprints?select=fingerprint_hash,is_bot_count,is_human_count,auto_blocked&limit=500",
  "bot_fingerprints?select=*&limit=500",
]) {
  try { fps = await rest(q); fpErr = null; break; } catch (e) { fpErr = e; }
}
if (fpErr) console.log("  ⚠ bot_fingerprints query failed:", String(fpErr.message || fpErr).slice(0, 160));

if (fps.length) {
  const botCount = (f) => f.is_bot_count ?? f.bot_count ?? f.bot_hits ?? 0;
  const humanCount = (f) => f.is_human_count ?? f.human_count ?? f.human_hits ?? 0;
  const blocked = fps.filter((f) => f.auto_blocked);
  console.log(`  fingerprints (recent 500): ${fps.length}, auto_blocked: ${blocked.length}`);
  const mixed = fps.filter((f) => botCount(f) > 0 && humanCount(f) > 0);
  console.log(`  mixed (both bot+human hits on same fingerprint): ${mixed.length}`);
  const humanBlocked = blocked.filter((f) => humanCount(f) > 0);
  if (humanBlocked.length) {
    console.log(`  ⚠ ${humanBlocked.length} blocked fingerprints ALSO have human hits (possible false positives):`);
    humanBlocked
      .sort((a, b) => humanCount(b) - humanCount(a))
      .slice(0, 10)
      .forEach((f) =>
        console.log(`    ${f.fingerprint_hash} bot=${botCount(f)} human=${humanCount(f)} ${f.last_country ?? ""} ${f.last_ip ?? ""}`),
      );
    console.log("  → these fingerprints are losing real traffic; raise BOT_BLOCK_THRESHOLD or clear them.");
  } else {
    console.log("  ✅ no auto-blocked fingerprint has human hits");
  }
} else if (!fpErr) {
  console.log("  (bot_fingerprints table is empty — auto-block is not eating anyone)");
}

console.log("\n--- [8] live probe: is the ours ad link actually serving? ---");
async function probe(url, ua, referer) {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": ua, ...(referer ? { referer } : {}), accept: "text/html,*/*", "accept-language": "en-US,en;q=0.9" },
    });
    const loc = res.headers.get("location");
    const body = res.status >= 300 && res.status < 400 ? "" : await res.text();
    return { status: res.status, loc, len: body.length, snippet: body.slice(0, 120).replace(/\s+/g, " ") };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}
if (ourUrl) {
  const UAS = [
    ["mobile ", "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"],
    ["desktop", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"],
  ];
  let bad = 0;
  let proxyBlocked = 0;
  for (const [label, ua] of UAS) {
    const r = await probe(ourUrl, ua, "https://sleepox.com/");
    if (r.error) { console.log(`  ${label}: ERROR ${r.error}`); bad++; continue; }
    const isProxyBlock = /anonymous proxy|proxy detected|vpn detected/i.test(r.snippet || "");
    const verdict = r.loc ? `→ redirect ${r.loc.slice(0, 80)}` : r.len === 0 ? "❌ EMPTY BODY (no ad served / rejected)" : `body ${r.len}b`;
    if (!r.loc && r.len === 0) bad++;
    if (isProxyBlock) proxyBlocked++;
    console.log(`  ${label}: HTTP ${r.status} ${verdict}`);
    if (!r.loc && r.len > 0) console.log(`     ${r.snippet}`);
  }
  if (proxyBlocked) {
    console.log("  ℹ INCONCLUSIVE — Adsterra answered \"Anonymous Proxy detected\" for THIS server's IP.");
    console.log("     That is a datacenter-IP block on the probe, not proof the link is broken.");
    console.log("     Real mobile users are not affected; test the link from a phone on mobile data instead.");
  } else if (bad) {
    console.log("  ❌ Adsterra is NOT serving on this direct link (empty/failed response).");
    console.log("     → create a fresh Direct Link in Adsterra and replace it in Control Panel.");
  } else {
    console.log("  ✅ link responds with real ad content/redirect.");
  }
} else {
  console.log("  (skipped — our_adsterra_url not set)");
}

console.log("\n--- [9] per-user traffic sanity (are users' own links delivering?) ---");
try {
  const links = await rest("links?select=id,short_code,user_id,adsterra_url,destination_url&limit=5000");
  const byId = new Map(links.map((l) => [l.id, l]));
  const perUser = new Map();
  for (const c of clicks) {
    const l = byId.get(c.link_id);
    if (!l) continue;
    const u = perUser.get(l.user_id) || { total: 0, offer: 0, ours: 0, safe: 0, bot: 0 };
    u.total++;
    if (c.is_bot) u.bot++;
    if (c.routed_to === "offer") u.offer++;
    if (c.routed_to === "ours") u.ours++;
    if (c.routed_to === "safe" || c.routed_to === "fallback") u.safe++;
    perUser.set(l.user_id, u);
  }
  const rows = [...perUser.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 12);
  console.log("  user_id                              total  offer   ours   safe   bot");
  for (const [uid, u] of rows) {
    console.log(
      `  ${uid}  ${String(u.total).padStart(5)}  ${String(u.offer).padStart(5)}  ${String(u.ours).padStart(5)}  ${String(u.safe).padStart(5)}  ${String(u.bot).padStart(4)}`,
    );
  }
  const hurt = rows.filter(([, u]) => u.total >= 50 && u.safe / u.total > 0.1);
  console.log(hurt.length ? `  ⚠ ${hurt.length} users have >10% traffic going to safe page` : "  ✅ no user is losing >10% traffic to the safe page");
  const noAd = links.filter((l) => !l.adsterra_url && !l.destination_url).length;
  if (noAd) console.log(`  ⚠ ${noAd} links have no destination/adsterra URL configured`);
} catch (e) {
  console.log("  ⚠ per-user check failed:", String(e.message || e).slice(0, 160));
}



console.log("\n=== VERDICT ===");
const oursPct = total ? (ours.length / total) * 100 : 0;
console.log(`  ours share: ${oursPct.toFixed(1)}%  |  offer share: ${pct(offer.length, total)}  |  bot share: ${pct(bots, total)}`);
if (!ourUrl) console.log("  ❌ our_adsterra_url missing → ours traffic never reaches Adsterra.");
if (ours.length && ourUrl) console.log("  ℹ If Adsterra still shows 0, the link itself is the problem (wrong direct-link URL, or Adsterra rejecting the referrer).");
console.log("");
