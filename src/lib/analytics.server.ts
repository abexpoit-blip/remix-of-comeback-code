type Click = {
  id: string;
  link_id: string;
  country: string | null;
  ua: string | null;
  is_bot: boolean;
  routed_to: string;
  bot_reason?: string | null;
  created_at: string;
  user_agent?: string | null;
  referer_host?: string | null;
  variant?: string | null;
  referrer_source?: string | null;
};

type AnalyticsContext = {
  supabase: any;
  userId: string;
};

const hideBots = (real: number) => real;

const BOT_UA_PATTERNS: Array<{ re: RegExp; name: string; slug: string; color: string }> = [
  { re: /facebookexternalhit|facebot|facebookcatalog|facebookplatform/i, name: "Facebook Crawler", slug: "facebook", color: "1877F2" },
  { re: /meta-external|metainspector|instagram-fbexternalhit/i, name: "Meta Crawler", slug: "meta", color: "0668E1" },
  { re: /googlebot|google-inspection|adsbot-google|mediapartners-google|google-read-aloud|google favicon/i, name: "Googlebot", slug: "google", color: "4285F4" },
  { re: /bingbot|adidxbot|bingpreview/i, name: "Bingbot", slug: "microsoftbing", color: "008373" },
  { re: /yandexbot|yandeximages/i, name: "YandexBot", slug: "yandex", color: "FF0000" },
  { re: /baiduspider/i, name: "Baidu Spider", slug: "baidu", color: "2932E1" },
  { re: /duckduckbot/i, name: "DuckDuckBot", slug: "duckduckgo", color: "DE5833" },
  { re: /applebot/i, name: "Applebot", slug: "apple", color: "000000" },
  { re: /twitterbot/i, name: "Twitterbot", slug: "x", color: "000000" },
  { re: /linkedinbot|linkedin-newsletter/i, name: "LinkedInBot", slug: "linkedin", color: "0A66C2" },
  { re: /telegrambot/i, name: "TelegramBot", slug: "telegram", color: "26A5E4" },
  { re: /discordbot/i, name: "DiscordBot", slug: "discord", color: "5865F2" },
  { re: /slackbot|slack-imgproxy/i, name: "Slackbot", slug: "slack", color: "4A154B" },
  { re: /whatsapp/i, name: "WhatsApp Bot", slug: "whatsapp", color: "25D366" },
  { re: /pinterestbot/i, name: "PinterestBot", slug: "pinterest", color: "BD081C" },
  { re: /redditbot/i, name: "RedditBot", slug: "reddit", color: "FF4500" },
  { re: /bytespider|tiktokbot/i, name: "ByteSpider", slug: "tiktok", color: "000000" },
  { re: /ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|seznambot/i, name: "SEO Crawler", slug: "spider", color: "64748b" },
  { re: /gptbot|chatgpt-user|claude-web|anthropic|perplexitybot|youbot|ccbot/i, name: "AI Crawler", slug: "robot", color: "8B5CF6" },
  { re: /curl\//i, name: "curl", slug: "terminal", color: "073551" },
  { re: /wget\//i, name: "wget", slug: "terminal", color: "073551" },
  { re: /python-requests|python-urllib|aiohttp|httpx/i, name: "Python Script", slug: "python", color: "3776AB" },
  { re: /node-fetch|axios|got\//i, name: "Node Script", slug: "nodedotjs", color: "5FA04E" },
  { re: /go-http-client|java\/|okhttp|apache-httpclient/i, name: "HTTP Client", slug: "robot", color: "64748b" },
  { re: /postmanruntime|insomnia/i, name: "API Tool", slug: "postman", color: "FF6C37" },
  { re: /headlesschrome|phantomjs|puppeteer|playwright|selenium/i, name: "Headless Browser", slug: "robot", color: "8B5CF6" },
  { re: /\bbot\b|crawler|spider|scraper|monitor|uptime|pingdom|statuscake/i, name: "Generic Bot", slug: "robot", color: "64748b" },
];

function detectBotUA(u: string): { name: string; slug: string; color: string } | null {
  for (const p of BOT_UA_PATTERNS) {
    if (p.re.test(u)) return { name: p.name, slug: p.slug, color: p.color };
  }
  return null;
}

function deviceFromUA(ua: string | null): "Mobile" | "Desktop" | "Tablet" | "Other" {
  if (!ua) return "Other";
  const u = ua.toLowerCase();
  if (detectBotUA(u)) return "Other";
  if (/ipad|tablet|playbook|silk/.test(u)) return "Tablet";
  if (/mobi|android|iphone|ipod|phone|webos/.test(u)) return "Mobile";
  if (/windows|macintosh|linux|x11|cros/.test(u)) return "Desktop";
  return "Other";
}

function osFromUA(ua: string | null): { name: string; slug: string } {
  if (!ua) return { name: "Unknown", slug: "unknown" };
  const u = ua.toLowerCase();
  if (detectBotUA(u)) return { name: "Bot", slug: "robot" };
  if (/iphone|ipad|ipod/.test(u)) return { name: "iOS", slug: "ios" };
  if (/android/.test(u)) return { name: "Android", slug: "android" };
  if (/windows nt/.test(u)) return { name: "Windows", slug: "windows" };
  if (/mac os x|macintosh/.test(u)) return { name: "macOS", slug: "macos" };
  if (/cros/.test(u)) return { name: "ChromeOS", slug: "googlechrome" };
  if (/linux|x11/.test(u)) return { name: "Linux", slug: "linux" };
  return { name: "Other", slug: "unknown" };
}

function browserFromUA(ua: string | null): { name: string; slug: string; color: string } {
  if (!ua) return { name: "Unknown", slug: "unknown", color: "94a3b8" };
  const u = ua.toLowerCase();
  const bot = detectBotUA(u);
  if (bot) return bot;
  if (u.includes("edg/")) return { name: "Edge", slug: "microsoftedge", color: "0078D4" };
  if (u.includes("opr/") || u.includes("opera")) return { name: "Opera", slug: "opera", color: "FF1B2D" };
  if (u.includes("samsungbrowser")) return { name: "Samsung Internet", slug: "samsung", color: "1428A0" };
  if (u.includes("ucbrowser")) return { name: "UC Browser", slug: "ucbrowser", color: "F8B500" };
  if (u.includes("brave")) return { name: "Brave", slug: "brave", color: "FB542B" };
  if (u.includes("firefox")) return { name: "Firefox", slug: "firefoxbrowser", color: "FF7139" };
  if (u.includes("fban") || u.includes("fbav")) return { name: "Facebook App", slug: "facebook", color: "1877F2" };
  if (u.includes("instagram")) return { name: "Instagram App", slug: "instagram", color: "E4405F" };
  if (u.includes("chrome")) return { name: "Chrome", slug: "googlechrome", color: "4285F4" };
  if (u.includes("safari")) return { name: "Safari", slug: "safari", color: "0FB5EE" };
  return { name: "Other", slug: "unknown", color: "94a3b8" };
}

const COUNTRIES: Record<string, { flag: string; name: string }> = {
  US: { flag: "🇺🇸", name: "United States" }, GB: { flag: "🇬🇧", name: "United Kingdom" },
  DE: { flag: "🇩🇪", name: "Germany" },       FR: { flag: "🇫🇷", name: "France" },
  CA: { flag: "🇨🇦", name: "Canada" },        IN: { flag: "🇮🇳", name: "India" },
  BD: { flag: "🇧🇩", name: "Bangladesh" },    PK: { flag: "🇵🇰", name: "Pakistan" },
  JP: { flag: "🇯🇵", name: "Japan" },         CN: { flag: "🇨🇳", name: "China" },
  BR: { flag: "🇧🇷", name: "Brazil" },        AU: { flag: "🇦🇺", name: "Australia" },
  NL: { flag: "🇳🇱", name: "Netherlands" },   IT: { flag: "🇮🇹", name: "Italy" },
  ES: { flag: "🇪🇸", name: "Spain" },         MX: { flag: "🇲🇽", name: "Mexico" },
  RU: { flag: "🇷🇺", name: "Russia" },        ID: { flag: "🇮🇩", name: "Indonesia" },
  PH: { flag: "🇵🇭", name: "Philippines" },   NG: { flag: "🇳🇬", name: "Nigeria" },
  ZA: { flag: "🇿🇦", name: "South Africa" },  SE: { flag: "🇸🇪", name: "Sweden" },
  PL: { flag: "🇵🇱", name: "Poland" },        TR: { flag: "🇹🇷", name: "Turkey" },
  KR: { flag: "🇰🇷", name: "South Korea" },   VN: { flag: "🇻🇳", name: "Vietnam" },
  AE: { flag: "🇦🇪", name: "UAE" },           SA: { flag: "🇸🇦", name: "Saudi Arabia" },
  EG: { flag: "🇪🇬", name: "Egypt" },         AR: { flag: "🇦🇷", name: "Argentina" },
  CO: { flag: "🇨🇴", name: "Colombia" },      CL: { flag: "🇨🇱", name: "Chile" },
  TH: { flag: "🇹🇭", name: "Thailand" },      MY: { flag: "🇲🇾", name: "Malaysia" },
  SG: { flag: "🇸🇬", name: "Singapore" },     CH: { flag: "🇨🇭", name: "Switzerland" },
  BE: { flag: "🇧🇪", name: "Belgium" },       AT: { flag: "🇦🇹", name: "Austria" },
  PT: { flag: "🇵🇹", name: "Portugal" },      IE: { flag: "🇮🇪", name: "Ireland" },
  NO: { flag: "🇳🇴", name: "Norway" },        DK: { flag: "🇩🇰", name: "Denmark" },
  FI: { flag: "🇫🇮", name: "Finland" },       NZ: { flag: "🇳🇿", name: "New Zealand" },
};

type AggRow<T> = T;
type AnalyticsAgg = {
  empty?: boolean;
  links: Array<{ id: string; short_code: string; title: string | null }>;
  total: number; humans: number; bots: number;
  unique?: number; uniqueVisitors?: number; unique_ips?: number;
  last24h: number; last24hHumans: number; last60s: number;
  offers: number; oursClicks: number;
  hourly: number[];
  heatmap: number[][]; heatMax: number;
  countries: Array<{ code: string; humans: number; bots: number; total: number }>;
  devices: Array<{ name: string; cnt: number }>;
  browsers: Array<{ name: string; cnt: number }>;
  operatingSystems: Array<{ name: string; cnt: number }>;
  botReasons: Array<{ name: string; cnt: number }>;
  trafficSources: Array<{ key: string; humans: number; bots: number; total: number }>;
  topLinks: Array<{ link_id: string; humans: number; bots: number; total: number }>;
  liveEvents: Array<{ id: string; link_id: string; country: string | null; ua: string | null; is_bot: boolean; routed_to: string; created_at: string }>;
};

type LiveAnalyticsSummary = {
  last60s?: number;
  cps5m?: number;
  humans1h?: number;
  bots1h?: number;
  last24h?: number;
  last24hHumans?: number;
  last24hBots?: number;
  links?: Array<{ id: string; short_code: string; title: string | null }>;
  events?: Array<{
    id: string;
    link_id: string;
    short_code?: string | null;
    title?: string | null;
    country: string | null;
    ua: string | null;
    is_bot: boolean;
    routed_to?: string | null;
    referer_host?: string | null;
    bot_reason?: string | null;
    created_at: string;
  }>;
  countries?: Array<{ code: string; count: number; humans?: number; bots?: number }>;
  cohorts?: Array<{ source: string; total: number; humans: number; bots?: number }>;
};

type LiveAnalyticsEvent = NonNullable<LiveAnalyticsSummary["events"]>[number];

const LIVE_ANALYTICS_RPC = "get_live_analytics_summary";

function isMissingLiveAnalyticsRpc(error: any) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`;
  return /PGRST202|schema cache|function .*get_live_analytics_summary|no matches were found/i.test(text);
}

function emptyLiveAnalyticsSummary(): LiveAnalyticsSummary {
  return {
    last60s: 0,
    cps5m: 0,
    humans1h: 0,
    bots1h: 0,
    last24h: 0,
    last24hHumans: 0,
    last24hBots: 0,
    links: [],
    events: [],
    countries: [],
    cohorts: [],
  };
}

async function countClicks(supabase: any, linkIds: string[], since: string, isBot?: boolean) {
  let query = supabase
    .from("clicks")
    .select("id", { count: "exact", head: true })
    .in("link_id", linkIds)
    .gte("created_at", since);

  if (typeof isBot === "boolean") query = query.eq("is_bot", isBot);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return Number(count ?? 0);
}

function sourceFromReferer(host: string | null | undefined) {
  if (!host) return "direct";
  const h = host.toLowerCase();
  if (h.includes("facebook") || h.includes("fb.")) return "facebook";
  if (h.includes("instagram")) return "instagram";
  if (h.includes("tiktok")) return "tiktok";
  if (h.includes("twitter") || h.includes("x.com")) return "twitter";
  if (h.includes("youtube")) return "youtube";
  if (h.includes("google")) return "google";
  if (h.includes("bing")) return "bing";
  if (h.includes("reddit")) return "reddit";
  if (h.includes("telegram") || h.includes("t.me")) return "telegram";
  if (h.includes("whatsapp")) return "whatsapp";
  return "other";
}

async function loadLiveAnalyticsFallback({ supabase, userId }: AnalyticsContext): Promise<LiveAnalyticsSummary> {
  const { data: linksRaw, error: linksError } = await supabase
    .from("links")
    .select("id, short_code, title")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (linksError) throw new Error(linksError.message);

  const links = (linksRaw ?? []) as Array<{ id: string; short_code: string; title: string | null }>;
  const linkIds = links.map((l) => l.id);
  if (linkIds.length === 0) return emptyLiveAnalyticsSummary();

  const now = Date.now();
  const since60s = new Date(now - 60_000).toISOString();
  const since5m = new Date(now - 300_000).toISOString();
  const since1h = new Date(now - 3_600_000).toISOString();
  const since24h = new Date(now - 86_400_000).toISOString();

  const [last60s, last5m, humans1h, bots1h, last24h, last24hHumans, last24hBots, eventsRes] = await Promise.all([
    countClicks(supabase, linkIds, since60s),
    countClicks(supabase, linkIds, since5m),
    countClicks(supabase, linkIds, since1h, false),
    countClicks(supabase, linkIds, since1h, true),
    countClicks(supabase, linkIds, since24h),
    countClicks(supabase, linkIds, since24h, false),
    countClicks(supabase, linkIds, since24h, true),
    supabase
      .from("clicks")
      .select("id, link_id, country, ua, is_bot, routed_to, referer_host, bot_reason, created_at")
      .in("link_id", linkIds)
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const linkLookup = new Map(links.map((l) => [l.id, l]));
  const events = ((eventsRes.data ?? []) as LiveAnalyticsEvent[]).map((event) => ({
    ...event,
    short_code: linkLookup.get(event.link_id)?.short_code ?? null,
    title: linkLookup.get(event.link_id)?.title ?? null,
  }));

  const countriesMap = new Map<string, { code: string; count: number; humans: number; bots: number }>();
  const cohortsMap = new Map<string, { source: string; total: number; humans: number; bots: number }>();

  for (const event of events) {
    const code = (event.country ?? "??").toUpperCase();
    const country = countriesMap.get(code) ?? { code, count: 0, humans: 0, bots: 0 };
    country.count += 1;
    if (event.is_bot) country.bots += 1;
    else country.humans += 1;
    countriesMap.set(code, country);

    const source = sourceFromReferer(event.referer_host ?? null);
    const cohort = cohortsMap.get(source) ?? { source, total: 0, humans: 0, bots: 0 };
    cohort.total += 1;
    if (event.is_bot) cohort.bots += 1;
    else cohort.humans += 1;
    cohortsMap.set(source, cohort);
  }

  return {
    last60s,
    cps5m: last5m,
    humans1h,
    bots1h,
    last24h,
    last24hHumans,
    last24hBots,
    links,
    events,
    countries: [...countriesMap.values()].sort((a, b) => b.count - a.count).slice(0, 12),
    cohorts: [...cohortsMap.values()].sort((a, b) => b.total - a.total).slice(0, 8),
  };
}

async function loadLiveAnalyticsSummary(context: AnalyticsContext): Promise<LiveAnalyticsSummary> {
  const { data, error } = await context.supabase.rpc(LIVE_ANALYTICS_RPC as never, { _user_id: context.userId } as never);
  if (!error) return (data ?? emptyLiveAnalyticsSummary()) as LiveAnalyticsSummary;
  if (isMissingLiveAnalyticsRpc(error)) return loadLiveAnalyticsFallback(context);
  throw new Error(error.message);
}

const BROWSER_META: Record<string, { slug: string; color: string }> = {
  Edge: { slug: "microsoftedge", color: "0078D4" },
  Opera: { slug: "opera", color: "FF1B2D" },
  "Samsung Internet": { slug: "samsung", color: "1428A0" },
  "UC Browser": { slug: "ucbrowser", color: "F8B500" },
  Brave: { slug: "brave", color: "FB542B" },
  Firefox: { slug: "firefoxbrowser", color: "FF7139" },
  "Facebook App": { slug: "facebook", color: "1877F2" },
  "Instagram App": { slug: "instagram", color: "E4405F" },
  Chrome: { slug: "googlechrome", color: "4285F4" },
  Safari: { slug: "safari", color: "0FB5EE" },
  Unknown: { slug: "unknown", color: "94a3b8" },
  Other: { slug: "unknown", color: "94a3b8" },
};

const OS_META: Record<string, string> = {
  iOS: "ios", Android: "android", Windows: "windows", macOS: "macos",
  ChromeOS: "googlechrome", Linux: "linux", Unknown: "unknown", Other: "unknown",
};

function friendlyReason(raw: string): string {
  const map: Record<string, string> = {
    ua: "Suspicious User Agent",
    asn: "Datacenter IP",
    ip: "Blocked IP Range",
    rule: "Custom Rule Match",
    "empty/short": "Missing User Agent",
    unknown: "Other",
  };
  return map[raw] ?? raw;
}

export function emptyAnalytics() {
  return {
    kpis: { total: 0, humans: 0, bots: 0, unique: 0, cps: "0.0", last24h: 0, humanRate: 100, activeLinks: 0, oursClicks: 0 },
    series24h: new Array(24).fill(0),
    heatmap: Array.from({ length: 7 }, () => new Array(24).fill(0)),
    heatMax: 1,
    topCountries: [] as Array<{ code: string; flag: string; name: string; count: number; humans: number; bots: number; pct: number }>,
    devices: [] as Array<{ name: string; count: number; pct: number }>,
    browsers: [] as Array<{ name: string; slug: string; color: string; count: number; pct: number }>,
    operatingSystems: [] as Array<{ name: string; slug: string; count: number; pct: number }>,
    botReasons: [] as Array<{ name: string; count: number; pct: number }>,
    topLinks: [] as Array<{ id: string; code: string; title: string | null; count: number; humans: number; bots: number; health: number }>,
    liveEvents: [] as Array<{ id: string; time: string; country: string; countryName: string; flag: string; device: string; browser: string; browserSlug: string; browserColor: string; isBot: boolean; routed: string }>,
    trafficSources: [] as Array<{ key: string; name: string; slug: string; color: string; humans: number; bots: number; total: number; pct: number; quality: number }>,
    funnel: [] as Array<{ stage: string; value: number; pct: number; color: string }>,
  };
}

export async function loadAnalyticsData({ supabase, userId }: AnalyticsContext) {
  const [aggRes, live] = await Promise.all([
    supabase.rpc("get_analytics_summary" as never, {
      _user_id: userId,
      _days: 7,
    } as never),
    loadLiveAnalyticsSummary({ supabase, userId }).catch(() => null),
  ]);
  const { data: aggRaw, error: aggErr } = aggRes;
  if (aggErr) throw new Error(aggErr.message);

  const agg = (aggRaw ?? { empty: true }) as AnalyticsAgg & { empty?: boolean };
  if (agg.empty || !agg.links) return emptyAnalytics();

  const total = Number(agg.total ?? 0);
  const humans = Number(agg.humans ?? 0);
  const realBots = Number(agg.bots ?? 0);
  const displayBots = hideBots(realBots);
  const displayTotal = humans + displayBots;
  const last24h = Number(live?.last24h ?? agg.last24h ?? 0);
  const last24hHumans = Number(live?.last24hHumans ?? agg.last24hHumans ?? 0);
  const last60s = Number(live?.last60s ?? agg.last60s ?? 0);
  const cps = String(last60s);
  const uniqueVisitors = Number(agg.unique ?? agg.uniqueVisitors ?? agg.unique_ips ?? 0);

  const fClick = total;
  const fHuman = humans;
  const fOffer = Number(agg.offers ?? 0);
  const fLanding = fOffer;
  const pct = (n: number) => (fClick ? Math.round((n / fClick) * 1000) / 10 : 0);
  const funnel = [
    { stage: "Clicks", value: fClick, pct: 100, color: "#FF7E5F" },
    { stage: "Human Pass", value: fHuman, pct: pct(fHuman), color: "#FEB47B" },
    { stage: "Offer Reach", value: fOffer, pct: pct(fOffer), color: "#F59E0B" },
    { stage: "Final Landing", value: fLanding, pct: pct(fLanding), color: "#10B981" },
  ];

  const hourBuckets = Array.isArray(agg.hourly) && agg.hourly.length === 24
    ? agg.hourly.map(Number)
    : new Array(24).fill(0);

  const heatmapRaw = Array.isArray(agg.heatmap) ? agg.heatmap : [];
  const heatmap: number[][] = Array.from({ length: 7 }, (_, i) =>
    Array.isArray(heatmapRaw[i]) ? (heatmapRaw[i] as number[]).map(Number) : new Array(24).fill(0),
  );
  const heatMax = Math.max(1, Number(agg.heatMax ?? 1));

  const topCountries = (agg.countries ?? []).map((c: AggRow<AnalyticsAgg["countries"][number]>) => {
    const code = c.code;
    const meta = COUNTRIES[code] ?? { flag: "🌐", name: code };
    const cnt = Number(c.humans) + hideBots(Number(c.bots));
    return {
      code,
      flag: meta.flag,
      name: meta.name,
      count: cnt,
      humans: Number(c.humans),
      bots: hideBots(Number(c.bots)),
      pct: displayTotal ? Math.round((cnt / displayTotal) * 1000) / 10 : 0,
    };
  });

  const totalHumansForDev = Math.max(1, humans);
  const devices = (agg.devices ?? []).map((d: AggRow<AnalyticsAgg["devices"][number]>) => ({
    name: d.name,
    count: Number(d.cnt),
    pct: Math.round((Number(d.cnt) / totalHumansForDev) * 1000) / 10,
  }));

  const browsers = (agg.browsers ?? []).map((b: AggRow<AnalyticsAgg["browsers"][number]>) => {
    const meta = BROWSER_META[b.name] ?? { slug: "unknown", color: "94a3b8" };
    return {
      name: b.name,
      slug: meta.slug,
      color: meta.color,
      count: Number(b.cnt),
      pct: Math.round((Number(b.cnt) / totalHumansForDev) * 1000) / 10,
    };
  });

  const operatingSystems = (agg.operatingSystems ?? []).map((o: AggRow<AnalyticsAgg["operatingSystems"][number]>) => ({
    name: o.name,
    slug: OS_META[o.name] ?? "unknown",
    count: Number(o.cnt),
    pct: Math.round((Number(o.cnt) / totalHumansForDev) * 1000) / 10,
  }));

  const botReasons = (agg.botReasons ?? []).map((r: AggRow<AnalyticsAgg["botReasons"][number]>) => ({
    name: friendlyReason(r.name),
    count: hideBots(Number(r.cnt)),
    pct: realBots ? Math.round((Number(r.cnt) / realBots) * 1000) / 10 : 0,
  }));

  const SOURCE_META: Record<string, { name: string; slug: string; color: string }> = {
    facebook: { name: "Facebook", slug: "facebook", color: "1877F2" },
    instagram: { name: "Instagram", slug: "instagram", color: "E4405F" },
    tiktok: { name: "TikTok", slug: "tiktok", color: "000000" },
    youtube: { name: "YouTube", slug: "youtube", color: "FF0000" },
    twitter: { name: "X / Twitter", slug: "x", color: "000000" },
    x: { name: "X / Twitter", slug: "x", color: "000000" },
    reddit: { name: "Reddit", slug: "reddit", color: "FF4500" },
    telegram: { name: "Telegram", slug: "telegram", color: "26A5E4" },
    whatsapp: { name: "WhatsApp", slug: "whatsapp", color: "25D366" },
    google: { name: "Google", slug: "google", color: "4285F4" },
    bing: { name: "Bing", slug: "microsoftbing", color: "008373" },
    direct: { name: "Direct", slug: "direct", color: "7D6452" },
    other: { name: "Other", slug: "direct", color: "7D6452" },
  };

  const totalSrcHumans = Math.max(1, (agg.trafficSources ?? []).reduce((s, v) => s + Number(v.humans), 0));
  const trafficSources = (agg.trafficSources ?? []).map((v: AggRow<AnalyticsAgg["trafficSources"][number]>) => {
    const meta = SOURCE_META[v.key] ?? { name: v.key, slug: "direct", color: "7D6452" };
    const tot = Number(v.total);
    const hum = Number(v.humans);
    const quality = tot ? Math.round((hum / tot) * 100) : 100;
    return {
      key: v.key,
      name: meta.name,
      slug: meta.slug,
      color: meta.color,
      humans: hum,
      bots: hideBots(Number(v.bots)),
      total: hum + hideBots(Number(v.bots)),
      pct: Math.round((hum / totalSrcHumans) * 1000) / 10,
      quality,
    };
  });

  const linkLookup = new Map(agg.links.map((l) => [l.id, l]));
  const topLinks = (agg.topLinks ?? []).map((t: AggRow<AnalyticsAgg["topLinks"][number]>) => {
    const l = linkLookup.get(t.link_id);
    const hum = Number(t.humans);
    const tot = Number(t.total);
    return {
      id: t.link_id,
      code: l?.short_code ?? "—",
      title: l?.title ?? null,
      count: hum + hideBots(Number(t.bots)),
      humans: hum,
      bots: hideBots(Number(t.bots)),
      health: tot ? Math.round((hum / tot) * 100) : 100,
    };
  });

  const latestEvents = live?.events?.length ? live.events : agg.liveEvents;
  const liveEvents = (latestEvents ?? []).map((c) => {
    const dev = deviceFromUA(c.ua);
    const br = browserFromUA(c.ua);
    const cc = (c.country ?? "??").toUpperCase();
    return {
      id: c.id,
      time: c.created_at,
      country: cc,
      countryName: COUNTRIES[cc]?.name ?? cc,
      flag: COUNTRIES[cc]?.flag ?? "🌐",
      device: dev,
      browser: br.name,
      browserSlug: br.slug,
      browserColor: br.color,
      isBot: c.is_bot,
      routed: c.routed_to ?? "offer",
    };
  });

  return {
    kpis: {
      total: displayTotal,
      humans,
      bots: displayBots,
      unique: uniqueVisitors,
      cps,
      last24h: last24hHumans + hideBots(last24h - last24hHumans),
      humanRate: displayTotal ? Math.round((humans / displayTotal) * 1000) / 10 : 100,
      activeLinks: agg.links.length,
      oursClicks: Number(agg.oursClicks ?? 0),
    },
    series24h: hourBuckets,
    heatmap,
    heatMax,
    topCountries,
    devices,
    browsers,
    operatingSystems,
    botReasons,
    topLinks,
    liveEvents,
    trafficSources,
    funnel,
  };
}

export async function loadCohortRetention({ supabase, userId }: AnalyticsContext) {
  const { data, error } = await supabase.rpc("get_cohort_retention" as never, { _user_id: userId } as never);
  if (error || !data) return { rows: [] as Array<{ day: string; size: number; d1: number; d7: number; d30: number }> };
  const rows = (data as Array<{ day_label: string; size: number; d1: number; d7: number; d30: number }>).map((r) => {
    const size = Number(r.size);
    const d1 = Number(r.d1);
    const d7 = Number(r.d7);
    const d30 = Number(r.d30);
    return {
      day: r.day_label,
      size,
      d1: size ? Math.round((d1 / size) * 100) : 0,
      d7: size ? Math.round((d7 / size) * 100) : 0,
      d30: size ? Math.round((d30 / size) * 100) : 0,
    };
  });
  return { rows };
}


export async function loadLinkDrilldown({ supabase, userId, linkId }: AnalyticsContext & { linkId: string }) {
  const { data: link } = await supabase
    .from("links")
    .select("id, short_code, title, user_id, clicks_count, bot_clicks_count, created_at")
    .eq("id", linkId)
    .single();

  if (!link || link.user_id !== userId) throw new Error("Not found");

  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { data: rawC } = await supabase
    .from("clicks")
    .select("country, ua, is_bot, routed_to, created_at")
    .eq("link_id", linkId)
    .gte("created_at", dayAgo)
    .order("created_at", { ascending: false })
    .limit(10000);

  const clicks = (rawC ?? []) as Array<{ country: string | null; ua: string | null; is_bot: boolean; routed_to: string; created_at: string }>;
  const now = Date.now();
  const series = new Array(24).fill(0);
  clicks.filter((c) => !c.is_bot).forEach((c) => {
    const h = Math.floor((now - new Date(c.created_at).getTime()) / 3_600_000);
    if (h >= 0 && h < 24) series[23 - h]++;
  });

  const cMap = new Map<string, number>();
  clicks.forEach((c) => {
    const k = (c.country ?? "??").toUpperCase();
    cMap.set(k, (cMap.get(k) ?? 0) + 1);
  });
  const tot = Math.max(1, clicks.length);
  const countries = [...cMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([code, count]) => ({
    code,
    flag: COUNTRIES[code]?.flag ?? "🌐",
    name: COUNTRIES[code]?.name ?? code,
    count,
    pct: Math.round((count / tot) * 1000) / 10,
  }));

  const bMap = new Map<string, { count: number; slug: string; color: string }>();
  clicks.filter((c) => !c.is_bot).forEach((c) => {
    const b = browserFromUA(c.ua);
    const cur = bMap.get(b.name) ?? { count: 0, slug: b.slug, color: b.color };
    cur.count++;
    bMap.set(b.name, cur);
  });

  const humans = clicks.filter((c) => !c.is_bot).length;
  const totH = Math.max(1, humans);
  const browsers = [...bMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 6).map(([name, v]) => ({
    name,
    slug: v.slug,
    color: v.color,
    count: v.count,
    pct: Math.round((v.count / totH) * 1000) / 10,
  }));

  const bots = clicks.filter((c) => c.is_bot).length;
  return {
    link: { id: link.id, code: link.short_code, title: link.title, total: link.clicks_count, created_at: link.created_at },
    kpis24h: { total: clicks.length, humans, bots: hideBots(bots), humanRate: clicks.length ? Math.round((humans / clicks.length) * 1000) / 10 : 100 },
    series,
    countries,
    browsers,
  };
}

export async function loadLiveFeed({ supabase, userId }: AnalyticsContext) {
  const summary = await loadLiveAnalyticsSummary({ supabase, userId });
  const typedLinks = (summary.links ?? []) as Array<{ id: string; short_code: string; title: string | null }>;
  const linkIds = typedLinks.map((l) => l.id);
  if (linkIds.length === 0) {
    return {
      cps5m: 0,
      humans1h: 0,
      bots1h: 0,
      events: [] as Array<{ id: string; created_at: string; short_code: string; country: string; flag: string; countryName: string; ua: string | null; is_bot: boolean; referrer_source: string | null; device: string; deviceOs: string; browser: string; browserSlug: string; browserColor: string }>,
      countries: [] as Array<{ code: string; flag: string; name: string; count: number; pct: number }>,
      cohorts: [] as Array<{ source: string; total: number; humans: number; humanRate: number }>,
    };
  }
  const linkLookup = new Map(typedLinks.map((l) => [l.id, l]));

  const classifySrc = (host: string | null): string => {
    if (!host) return "direct";
    const h = host.toLowerCase();
    if (h.includes("facebook") || h.includes("fb.")) return "facebook";
    if (h.includes("instagram")) return "instagram";
    if (h.includes("tiktok")) return "tiktok";
    if (h.includes("twitter") || h.includes("x.com")) return "twitter";
    if (h.includes("youtube")) return "youtube";
    if (h.includes("google")) return "google";
    if (h.includes("bing")) return "bing";
    if (h.includes("reddit")) return "reddit";
    if (h.includes("telegram") || h.includes("t.me")) return "telegram";
    if (h.includes("whatsapp")) return "whatsapp";
    return "other";
  };

  const events = (summary.events ?? []).slice(0, 50).map((c) => {
    const cc = (c.country ?? "??").toUpperCase();
    const ua = c.ua ?? null;
    const dev = deviceFromUA(ua);
    const br = browserFromUA(ua);
    const os = osFromUA(ua);
    const src = classifySrc(c.referer_host ?? null);
    return {
      id: c.id,
      created_at: c.created_at,
      short_code: c.short_code ?? linkLookup.get(c.link_id)?.short_code ?? "—",
      country: cc,
      flag: COUNTRIES[cc]?.flag ?? "🌐",
      countryName: COUNTRIES[cc]?.name ?? cc,
      ua,
      is_bot: c.is_bot,
      referrer_source: src === "direct" ? null : src,
      device: dev,
      deviceOs: os.name,
      browser: br.name,
      browserSlug: br.slug,
      browserColor: br.color,
    };
  });

  const totalForPct = Math.max(1, Number(summary.last24h ?? 0));
  const countries = (summary.countries ?? []).map((c) => {
    const code = (c.code ?? "??").toUpperCase();
    const count = Number(c.count ?? 0);
    return {
      code,
      flag: COUNTRIES[code]?.flag ?? "🌐",
      name: COUNTRIES[code]?.name ?? code,
      count,
      pct: Math.round((count / totalForPct) * 100),
    };
  });

  const cohorts = (summary.cohorts ?? []).map((v) => ({
    source: v.source,
    total: Number(v.total ?? 0),
    humans: Number(v.humans ?? 0),
    humanRate: Number(v.total ?? 0) ? Math.round((Number(v.humans ?? 0) / Number(v.total ?? 0)) * 100) : 0,
  }));

  return {
    cps5m: Number(summary.cps5m ?? 0),
    humans1h: Number(summary.humans1h ?? 0),
    bots1h: Number(summary.bots1h ?? 0),
    events,
    countries,
    cohorts,
  };
}