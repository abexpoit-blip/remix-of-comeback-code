# Sleepox — Bot Detection & Cloaking Filter Spec (portable to adspx)

Everything runs in ONE edge request (`src/routes/r.$code.ts`), no extra round-trips.
Decision output = one of 4 routes:

| route        | meaning                                            |
|--------------|----------------------------------------------------|
| `offer`      | money page (real human)                             |
| `ours`       | our own monetisation page (quota / injection)       |
| `safe`       | safe article (bot / reviewer)                       |
| `fb-article` | Facebook crawler gets a real article w/ OG tags     |

---

## 0. Request context collected first
`ua`, `ip` (first hop of `x-forwarded-for`), `asn` (`cf-asn`, `AS` prefix stripped),
`country` (CF/edge header first, IP-geo fallback), `referer` + `referer_host`,
`accept`, `accept-language`, `accept-encoding`, `sec-ch-ua`, UTM/ad params,
`device` = mobile | tablet | desktop, `fingerprint` = djb2(ip/24 + UA + lang + enc + sec-ch-ua).

**Country confidence flag (`countryConfident`)** — critical.
Never guess country from `Accept-Language`. Any country-based block only fires
when geo is verified. (This alone removed our fake "all traffic is USA" problem.)

---

## 1. HARD blocks (always safe/fb-article, no window)
1. **Meta/FB UA** — `facebookexternalhit`, `facebookcatalog`, `facebot`,
   `meta-externalagent`, `meta-externalfetcher` → `fb-article`
2. **FB ASN** — 32934 / 63293 / 54115
3. **FB IP prefixes** (list of Meta /16s)
4. **Crawler UA regex** (~40) — bots, previewers, search engines, chat apps
   (`whatsapp`, `telegrambot`, `slackbot`, `discordbot`, `skypeuripreview`, `bingbot`, …)
5. **Datacenter ASN set** (AWS/GCP/Azure/OVH/Hetzner/DO/Linode…) → `safe`

## 2. Soft heuristics (these are where traffic gets lost — tune carefully)
- **Multi-link velocity** — same IP hitting N distinct short codes / 1h.
  Threshold **12** (was 6 → too aggressive on carrier NAT).
- **FB ad-review window** — first 6h / first 25 clicks of a link, FB referer +
  headless-ish signals → safe.
- **Reviewer geo** — only when `countryConfident` and country ∈ {US, IE, GB, DE, SG, NL}.
- **Desktop reviewer rule** (final version, human loss = 0):
  cold desktop (no referer, no ad param) → `safe` **only if** one of
  1. verified reviewer country, **or**
  2. datacenter/hosting/unknown ASN (`desktop-reviewer-hosted:<asn>`), **or**
  3. Chrome/Edge UA but **no `sec-ch-ua`** header (`desktop-reviewer-nohints`).
  Everything else = money. Never block desktop on coherence score alone.
- **Header coherence score** (0-100): missing accept (+25), missing lang (+25),
  missing encoding (+15), Chrome w/o sec-ch-ua (+20), iOS w/ sec-ch-ua (+30),
  headless UA (+80). Used as *supporting* evidence only, never as sole blocker.
- **Fingerprint auto-block** — a fp seen bot N× (`BOT_BLOCK_THRESHOLD = 20`) is cached blocked.
- **DB rule tables**: `cloaking_rules` (ua/ip/asn/country + priority),
  `referrer_rules` (allow/suspect/block + trust score), `bot_rules`, `bot_whitelist`.

## 3. Known-human pass (biggest anti-false-positive win)
Once a visitor is classified human:
- Redis flag `hum:<code>:<fp>` **and** global `hum:g:<fp>`, TTL 6h
- Browser cookie `_sxh=1`, 6h
Any later hit with either → **skips all soft heuristics** (velocity, desktop guard,
reviewer geo). This fixes "reload / duplicate tab → safe article".

## 4. Country shield
Per-link `blocked_countries[]`, fires only when `countryConfident`.

## 5. Monetisation routing (not a filter — don't confuse with loss)
- Quota exceeded / expired plan → `ours`
- Injection: 1 in N humans → `ours`, `INJECT_COUNT` clamped to `THRESHOLD/2` (max 33%)
- Geo offers (tier/country weighted) and A/B variants (weighted pick)

## 6. Safe page layer
Deterministic per-link rotation over a Wikipedia/article pool
(`wikipedia_safe_urls`, per-language) + 10 prelanding templates.
Same link always resolves to the same article → fingerprint-proof for reviewers.

## 7. Performance / reliability
- L1 in-process cache + L2 Redis for link, profile quota, offers, fp-block
- In-flight dedupe map — **the promise must resolve the processed link**, otherwise
  concurrent double-clicks get `link: null` and fall through to safe article (real bug we hit)
- Geo lookup: 3 providers, 1.5s each, 400ms total budget, circuit breaker after 12 fails
- Clicks written via batched RPC (`record_redirect_clicks_batch`), never blocking the redirect
- `uncaughtException` guard for malformed-URI bot requests

## 8. Logging
`clicks` (routed_to, is_bot, bot_reason, bot_score, signals jsonb, country, device, utm),
`bot_fingerprints`, `error_logs` (source: redirect / leak_monitor / meta_crawler_block),
plus `scripts/vps-traffic-loss-audit.sh` for 24h forensics.

---

## Rules of thumb for adspx
1. Never block on a **guessed** country.
2. Never block desktop on coherence alone — require ASN or missing-client-hints evidence.
3. Give every confirmed human a 6h session pass (cookie + fp).
4. Velocity thresholds ≥ 12 per hour (carrier NAT).
5. Keep hard UA/ASN/IP lists strict; keep soft heuristics loose.
6. Measure with: `humans routed to safe` — that number must stay at **0**.
