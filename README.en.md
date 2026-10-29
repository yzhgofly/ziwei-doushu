<div align="center">

# Zi Wei Dou Shu · Open-Source Charting Engine

### Algorithms are openly shared traditional wisdom; they shouldn’t be locked behind walls.

[![CI](https://github.com/Renhuai123/ziwei-doushu/actions/workflows/ci.yml/badge.svg)](https://github.com/Renhuai123/ziwei-doushu/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](./LICENSE)
[![Dataset: CC BY 4.0](https://img.shields.io/badge/dataset-CC%20BY%204.0-green.svg)](./DATASET-LICENSE)

[中文](./README.md) · **English**

</div>

**1. Philosophy:** Zi Wei Dou Shu is a treasure of traditional Chinese astrology, and Ni Haixia laid out its authentic system in *Tian Ji* (《天纪》). We hope technology can bring more people to learn it.

We open-source the charting algorithm and the knowledge base because we believe **algorithms are openly shared traditional wisdom and shouldn’t be locked behind walls**. The real value lies in the depth of interpretation, a carefully polished user experience, and what we build up by running the service day after day.

**2. About the project:** A Zi Wei Dou Shu (紫微斗数, "Purple Star Astrology") charting engine following the teaching system of **Ni Haixia's *Tian Ji* (倪海厦《天纪》)**. It includes the full charting algorithm, the Four Transformations (四化), a pattern knowledge base, public-domain classical texts, and a **518,400-chart sample dataset**, plus a **674,976-chart × 13-topic interpretation dataset (v4.0, 2026-10-15): 8.77 million readings, about 20.4 billion characters of text, 56.6 GB uncompressed** — up from 518,400 charts and 33.1 GB in v3.0.

| Dataset | Charts | Readings | Uncompressed | Years | Characters per chart |
|---|---|---|---|---|---|
| **v4.0 interpretations** (2026-10-15) | **674,976** | **8,774,688** | **56.6 GB** | **1950–2026** (real dates only) | **~30,000** |
| v3.0 samples | 518,400 | 6,739,200 | 33.1 GB | 1924–1983 | ~21,000 |
| Change | +30% | +30% | **+71%** | +17 years | +44% |

<sub>v3.0 characters per chart estimated from a 2,160-chart sample; all other figures are full counts. Both versions have 13 topics per chart.</sub>

This repo is an open snapshot of the engine behind [metisziwei.com](https://metisziwei.com/?from=gh-readme-en), synced from production periodically.

> **Note: on readings of family relations**
>
> Zi Wei Dou Shu has known limits when it comes to family relations (parents, siblings, children and so on). In *Tian Ji*, Master Ni Haixia said that "Dou Shu has always been somewhat weaker at reading family relations" ([lecture 2, part 1 · 00:25:27](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=1527)). Among traditional methods, Tie Ban Shen Shu has its own strengths in checking family relations ([00:03:15](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=195)); Master Ni still kept Zi Wei Dou Shu at the core because it can be read together with geography, surroundings and human affairs, forming a complete system that knows the heavens above, the earth below and human affairs in between ([00:25:43](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=1543)). Readings about family relations are therefore for reference only; the Parents, Siblings and Children sections on [metisziwei.com](https://metisziwei.com/?from=gh-readme-en) carry the same note.

## Latest update (2026-10-15)

![Update overview](./docs/update-20261015.png)

- **Interpretation dataset v4.0 released**: 674,976 charts (every real solar date 1950–2026 × 12 double-hours × male/female) × 13 topics = 8,774,688 readings; 161 MB compressed, 56.6 GB uncompressed (v3.0: 33.1 GB), 77 per-year files plus an all-years bundle. See [Release v4.0-13d](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d) and the dataset section below.
- **The 13 topics were revised sentence by sentence** against the verbatim transcripts of Ni Haixia's *Tian Ji* and the original *Complete Book*: untraceable citations removed or replaced with verbatim quotes (with episode and timestamp), sentences about impossible transformations removed, conditions spelled out, two-sided sentences resolved per chart, and health now follows Master Ni's whole-chart method instead of mapping stars to organs by Five Element. (The judgment library itself stays closed; the results are in the v4.0 dataset.)
- **Engine sync** ([PR #39](https://github.com/Renhuai123/ziwei-doushu/pull/39)): `chinaDSTSpan(year)` in `dst-cn.ts`; longitudes for province-administered county-level cities in `cities.ts`.
- **License**: `DATASET-LICENSE` now covers v4.0; quotations from *Tian Ji* inside the readings are not covered by the dataset license.

> **2026-10-27 addendum**: engine sync. `true-solar-time.ts` accepts `utcOffsetMinutes` (the birthplace's standard UTC offset) for births outside China; results inside China are unchanged. New `clock-adjust.ts` converts a clock reading taken under daylight saving time (or an older time zone) to standard time; it never crosses midnight and is meant to run only when the user confirms. Correction: the engine detects China DST but has never subtracted it automatically; the table below said otherwise.

## What the engine handles

| Feature | Notes |
|---|---|
| True solar time | Longitude offset plus the equation of time, so births near hour boundaries are not off by one double-hour |
| China DST | 1986–1991 daylight-saving periods are detected (not subtracted automatically; convert the clock reading with `clock-adjust.ts` once the user confirms) |
| Leap months | Four configurable conventions (previous month / next month / split by day / same month) |
| Late Zi hour | 23:00–23:59 is charted on the next day, 00:00–00:59 on the same day; switchable |
| Star brightness | 7 levels (庙 旺 得 利 平 不 陷); brightness tables of different schools are switchable, not hard-coded |
| Four Transformations | Natal, decade (大限) and annual (流年) transformations, plus flying-star self-transformations |
| Twelve spirits | Natal layer by year branch, annual layer by the annual branch |
| Patterns | 1,100+ lines of pattern rules (紫府同宫, 日月并明, 七杀朝斗, …) |

Engine code lives in `lib/ziwei/` (entry point: `generateChart()` in `algorithm.ts`). Inputs are a **Gregorian** date and an **hour branch index 0–11** (子 = 0 … 亥 = 11), not a clock hour.

## Quick start

```bash
git clone https://github.com/Renhuai123/ziwei-doushu.git
cd ziwei-doushu
npm ci
npm run dev          # charting demo at http://localhost:3000/chart

npm run typecheck    # TypeScript check
npm test             # charting regression tests
```

**No API key is needed for charting.** Charting, chart rendering and compatibility setup all run in the browser using this repo's engine.

### AI interpretation (`/api/interpret` and `/api/heming`)

Upstream's commercial AI prompts and backend routes are not open source. This repo ships **a working open-source implementation**: it serialises the real output of the charting engine (12 palaces, star brightness, four-transform landing palaces, detected patterns, decade/year transforms) into a textual "chart sheet" for the model, requires the model to reason **only from that chart sheet**, and streams the answer back over SSE.

| File | Role |
|---|---|
| `lib/ai/config.ts` | Env parsing: protocol, endpoint, key, model, token budget |
| `lib/ai/provider.ts` | Streaming client: Anthropic Messages protocol + OpenAI-compatible protocol |
| `lib/ai/chart-context.ts` | Chart → chart sheet (12 palaces, brightness, four transforms, sanfang-sizheng, patterns) |
| `lib/ai/prompt.ts` | System prompts for interpretation and compatibility (reuses `heming-knowledge.ts`) |
| `lib/ai/sse.ts` | SSE event wrapper (matches the frontend's `data: {"delta":{"text":...}}` contract) |
| `lib/ai/validate.ts` | Request validation + birthplace whitelist (injection guard) |
| `lib/ai/sanitize.ts` | Output cleanup: strips English words the model occasionally slips in |
| `lib/ai/guard.ts` | Public-exposure guard: per-IP rate limit + global concurrency cap + daily quota |
| `lib/ai/handlers.ts` | Shared handler for interpretation / compatibility (used by both the Next route and the Cloudflare Pages Function) |
| `app/api/interpret/route.ts` | AI chart interpretation |
| `app/api/heming/route.ts` | AI compatibility analysis |

Configure a model in `.env.local` — both protocols are supported:

```bash
# Anthropic protocol
AI_PROVIDER=anthropic
AI_BASE_URL=https://api.anthropic.com/v1
AI_AUTH_MODE=api-key          # or bearer for private endpoints
AI_API_KEY=sk-...
AI_MODEL=your-model-id

# OpenAI-compatible protocol (DeepSeek / MiMo / OpenAI, ...)
AI_PROVIDER=deepseek          # or mimo / openai
DEEPSEEK_API_KEY=sk-...
```

> **Give `AI_MAX_TOKENS` enough room.** Models with thinking (MiniMax M3 and friends) spend a large slice of the output budget on reasoning first; too small a budget truncates the response *before the answer starts* — the symptom is "not a single character of answer". The default is 16384; DeepSeek caps output at 8K, so set `AI_MAX_TOKENS=8192` there. The route has a safety net: if the response is truncated with zero output it retries once with 4x the budget.

`scripts/smoke-ai.ts` is a live smoke test against the real model — run `npm run dev` first, then `npx tsx scripts/smoke-ai.ts`.

> **On "no English mixed into the body"**: the prompt already states that rule, but the model still occasionally emits something like "重道义、 fairness 与担当". So the output goes through one more layer (`lib/ai/sanitize.ts`): Latin letter runs are removed, then leftover empty brackets, stray spaces and doubled separators are tidied up. There is no legitimate English in a Ziwei reading; numbers and Markdown markers are untouched.

#### Before exposing the site publicly: quota protection

Chart casting itself is free (it runs in the browser), but **AI interpretation costs money**. Once the site is reachable from the internet, anyone with the link can call `/api/interpret` and `/api/heming` and burn your API key quota. Both routes therefore pass through a guard by default (`lib/ai/guard.ts`):

| Protection | Default | Environment variable |
|---|---|---|
| Sliding-window rate limit per source | 6 requests / minute | `AI_RATE_LIMIT_PER_WINDOW` / `AI_RATE_LIMIT_WINDOW_MS` |
| Global concurrency cap | 2 simultaneous model calls | `AI_MAX_CONCURRENT` |
| Global daily quota | 60 requests / day | `AI_DAILY_REQUEST_CAP` (`0` = unlimited) |

Exceeding a limit returns `429` with a short Chinese message. The frontend treats that as a failed request, so don't set these three to 0. Raise them for personal use; keep the defaults (or tighter) when sharing the link.

> Upstream explicitly states that server-side security (signing, anti-abuse, watermarking) is out of scope for the open-source release. What ships here is a **quota-level safety net** (rate limit + concurrency + daily cap) — not a full account system or signed requests. If you intend to operate this publicly, add login, signing and per-user billing yourself.

**Reaching the site from the internet (tunnel / reverse proxy)**: `next dev` blocks cross-origin `/_next/hmr` and `/__nextjs_font/*`, so a public hostname makes the console spam "Blocked cross-origin request to Next.js dev resource". This repo already opens it up in `next.config.js`:

```js
allowedDevOrigins: ['*.trycloudflare.com'],
```

The wildcard covers the random hostname a tunnel picks on every restart; swap it for your own domain (and restart the dev server) if you use one. A production build (`next build && next start`) is not affected.

**SSE heartbeat**: interpretation is streamed, and the model may spend a minute or two thinking. If nothing is written during that window, a CDN in the middle will cut the connection (Cloudflare shows `524`, or returns 200 with an empty body). So the implementation sends an SSE comment heartbeat (`: open`) both at the **start** of the stream and **every 15 seconds while generating**. The frontend filters on the `data: ` prefix and skips those comment lines.

### Deploying to Cloudflare Pages (`pages.dev` is reachable from mainland China)

Charting runs entirely in the browser, but AI interpretation needs a server, so this repo supports two deployment shapes:

| | Vercel | Cloudflare Pages |
|---|---|---|
| Hostname | `*.vercel.app` | `*.pages.dev` |
| Reachability from mainland China | **blocked by SNI filtering** — usually unreachable | directly reachable |
| Server-side routes | Next Route Handlers (`app/api/*`) | Pages Functions (`functions/api/*`) |
| Shared logic | both use `lib/ai/handlers.ts`, identical wire protocol | same |

> Field note: `*.vercel.app` is blocked in mainland China via both DNS poisoning and a TLS-handshake reset keyed on SNI (on the same machine `api.vercel.com` answers normally while `*.vercel.app` gets RST during the handshake). For an audience in mainland China, deploy to `pages.dev` or your own domain instead.

`scripts/build-pages.mjs` produces the Pages bundle. It does three things:

1. runs Next's static export (`output: 'export'`) into `out/` — in export mode `next.config.js` narrows `pageExtensions` to `['tsx']` so the `app/api/*` server routes are excluded from the build;
2. bundles `functions-src/api/*.ts` into Workers-runtime ESM with esbuild, written to `functions/`;
3. writes `wrangler.toml`.

```bash
# dependency: npm i -g wrangler
npm run build:pages            # same as: node scripts/build-pages.mjs

wrangler login                 # authorise once in the browser
wrangler pages project create ziwei-doushu

# keep the key out of the repo
wrangler pages secret put AI_API_KEY --project-name ziwei-doushu
wrangler pages secret put AI_MODEL --project-name ziwei-doushu
# the rest (AI_PROVIDER / AI_PROTOCOL / AI_BASE_URL / AI_AUTH_MODE / AI_MAX_TOKENS / AI_TIMEOUT_MS)
# go in Pages dashboard → Settings → Environment variables

wrangler pages deploy out --project-name ziwei-doushu
```

Local pre-flight (no login needed): `node scripts/make-dev-vars.mjs` converts `.env.local` into `.dev.vars`, then `wrangler pages dev out --port 8788` runs `/api/interpret` and `/api/heming` on a real Workers runtime.

> Note: Pages Functions receive environment variables in `context.env`, not `process.env`. Both handlers in `lib/ai/handlers.ts` therefore take the env bag explicitly — Next passes `process.env`, Pages passes `context.env` — so both runtimes share one implementation. `.dev.vars`, `out/`, `functions/` and `.wrangler/` are all in `.gitignore`.

## What is not included

The interpretation database (`lib/ziwei/db-analysis.ts` is a placeholder), upstream's own AI prompts, the productionised backend around the API routes (user accounts, payments, server-side signing / anti-abuse / watermarking), and deployment configuration.

## Interpretation dataset v4.0 (674,976 charts × 13 topics, 2026-10-15)

Download from [Releases → v4.0-13d](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d): 77 per-year files `year-YYYY.jsonl.zst` (161 MB compressed, 56.6 GB uncompressed (v3.0: 33.1 GB)), plus `SHA256SUMS.txt` and `MANIFEST.json`.

- Every solar date from 1950 to 2026 (only dates that actually exist) × 12 double-hours × male/female; one chart per line (JSON Lines).
- Fields: `k` key, `y`/`m`/`d` solar date, `h` double-hour index 0–11 (not clock hours), `g` gender, `ms` first major star of the Life Palace (`null` if empty), `t` character counts, `c` the 13 topic readings in Markdown.
- Generated deterministically by the charting engine and the 2026-10-15 judgment library (content version `ca268829f7a9`), no AI involved. The 13 topics were revised sentence by sentence against the verbatim transcripts of Ni Haixia's *Tian Ji* and the original *Complete Book of Zi Wei Dou Shu*.
- Natal-chart view only: age-based rewording, the appended Master Ni rule sections and AI readings shown on the website are not included. Charts use the double-hour index directly, without true-solar-time correction.
- Decompress with `zstd -d --long=27 year-1990.jsonl.zst` (`--long=27` is required).
- Quotations from Ni Haixia's *Tian Ji* inside the readings are **not covered by the dataset license**: they are short citations with episode and timestamp, and copyright in the original lectures remains with the rights holder; bulk reuse of those quotations falls under the [CC BY-NC-SA 4.0](./docs/tianji-ziwei/LICENSE.md) terms of chapter 5. The *Complete Book* is in the public domain.
- License: same as v3.0 — [CC BY 4.0](./DATASET-LICENSE), commercial use OK with attribution (except the quotations above).
- A single all-years bundle `ziwei-interp-v4-all.tar` is also provided.

## Sample dataset (518,400 charts)

Download from [Releases](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v3.0-samples) (3 parts, 5.5 GB in total). Each sample is generated from `birthInfo`:

- `year` / `month` / `day`: **Gregorian** date, 1924–1983 (one full 60-year cycle), days 1–30 of every month
- `hour`: **hour branch index 0–11** (子 = 0 … 亥 = 11), *not* a clock hour; the `hHH` part of each file name is the same index
- `gender`: `male` / `female`; `longitude` is fixed at 120 (no local true-solar-time correction)

**Known issue:** about 2,520 samples (0.49%) carry dates that do not exist: Feb 30, and Feb 29 in non-leap years. The engine silently rolled them over to Mar 1–2, so their content duplicates the Mar 1–2 samples. Filter out `month = 2 && day = 30`, and `month = 2 && day = 29` in non-leap years. From 2026-10-03 the engine rejects non-existent dates.

## Ni Haixia's original words (*Tian Ji*, Zi Wei part)

[`docs/tianji-ziwei/`](./docs/tianji-ziwei/) holds **1,848 quotes** from the Zi Wei lectures of *Tian Ji* (14 lectures plus 2 supplements), each linked to the second it was said in the video. Taken from the sister repo [nihai-tianji-corpus](https://github.com/Renhuai123/nihai-tianji-corpus).

## License

| Part | License |
|---|---|
| Code (`lib/`, `app/`, `components/`) | [MIT](./LICENSE) |
| Sample dataset (Releases) | [CC BY 4.0](./DATASET-LICENSE): commercial use OK with attribution |
| Classical texts | Public domain |
| Ni Haixia quotes (`docs/tianji-ziwei/`) | [CC BY-NC-SA 4.0](./docs/tianji-ziwei/LICENSE.md): **non-commercial only** |

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md); questions go to [Discussions](https://github.com/Renhuai123/ziwei-doushu/discussions).
