# Vercel Cron Schedule — Design Spec
_2026-05-25_

## Problem
`schedule_slots` stores when content should be posted, but nothing ever reads those slots and fires posts. The app is a pure client-side React app — when the browser tab is closed, nothing runs.

## Solution
A Vercel Cron serverless function that fires every minute, checks which slots are due in Berlin time, and runs the full carousel pipeline (generate → upload → post to Instagram).

## Architecture

```
lib/
  gemini.js       ← core Gemini functions, no rate limiting
  instagram.js    ← Instagram Graph API (moved from src/services/instagramGraph.js)

src/services/
  generator.js    ← thin wrapper: imports lib/gemini.js, adds rate limiting for browser
  instagramGraph.js ← re-exports from lib/instagram.js (keeps frontend imports working)

api/
  run-schedule.js ← Vercel Cron handler, imports from lib/

vercel.json       ← add crons config
.env.example      ← add SUPABASE_SERVICE_ROLE_KEY
```

## Shared Lib (`lib/`)

### `lib/gemini.js`
Extracted from `src/services/generator.js` — all prompt builders and Gemini API call functions, **without rate limiting**. Rate limiting is a browser concern, not a server concern.

Exports:
- `buildPersonaContext(inf)`
- `extractJSON(text)`
- `geminiText(apiKey, { system, user, model, temperature })`
- `buildIdeationPrompt(inf)` / `ideateCarousel(apiKey, inf, customPrompt)`
- `buildSlidePromptsPrompt(...)` / `generateSlidePrompts(...)`
- `generateSlideImage(apiKey, prompt, refImages, aspectRatio, model)`
- `buildCaptionPrompt(...)` / `generateCaption(...)`
- `buildVideoIdeaPrompt`, `buildVideoPromptsPrompt`, `generateVideoIdea`, `generateVideoPrompts`
- `buildTopicListPrompt`, `generateTopicList`
- `IMAGE_MODELS`, `DEFAULT_IMAGE_MODEL`

### `lib/instagram.js`
Moved verbatim from `src/services/instagramGraph.js`. Pure fetch calls, no browser APIs.

## Updated `src/services/generator.js`
Becomes a thin browser wrapper:
- Imports all functions from `../../lib/gemini.js`
- Wraps `geminiText` and `generateSlideImage` with rate limiter `acquire()` / `readHeaders()`
- Re-exports everything — UI sees no change

## Updated `src/services/instagramGraph.js`
Re-exports everything from `../../lib/instagram.js` — UI sees no change.

## Cron Handler (`api/run-schedule.js`)

### Auth
Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on cron invocations.
Function rejects any request without a matching header.

### Berlin Time
```js
Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
```
Produces `day_key` (`mon`–`sun`) and `HH:MM` string. Compared directly against `schedule_slots.time`.

### Slot Matching
Query `schedule_slots` with `day_key = <today>` AND `time = <HH:MM>` using service role client (bypasses RLS).

### Pipeline Execution (per slot)
1. Load `carousel_pipelines` → `influencers` → `api_keys` (via service role)
2. Map DB snake_case → camelCase for influencer fields
3. Resolve ref images: `data:` URLs pass through; `https://` URLs are fetched + converted to base64 Buffer
4. Run Gemini pipeline: ideate → slide prompts → generate images one by one
5. Upload each image to `carousel-images` bucket via service role Supabase client
6. Generate caption
7. Insert `carousel_executions` row with `posted: false`
8. Attempt `publishCarousel` from `lib/instagram.js` — on success update to `posted: true`, on failure **do not throw** (leave as `posted: false` for manual posting)

### Error handling
- Per-slot errors are caught and logged; other slots still run
- Missing Gemini key → skip slot, log error
- Missing IG credentials → skip Instagram step only, execution still saved

### Config
```js
export const config = { maxDuration: 300 }  // requires Vercel Pro
```

## Environment Variables
| Variable | Source | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | existing | api function via `process.env` |
| `VITE_SUPABASE_ANON_KEY` | existing | frontend only |
| `SUPABASE_SERVICE_ROLE_KEY` | **new** — Supabase → Settings → API | api function only |
| `CRON_SECRET` | auto-set by Vercel | api function |

## Vercel Requirements
- **Vercel Pro** required: cron frequency every minute + 300s function timeout
- Hobby plan: max daily cron + 10s timeout (not sufficient)

## Files Changed
| File | Action |
|---|---|
| `lib/gemini.js` | create |
| `lib/instagram.js` | create (moved from instagramGraph.js) |
| `src/services/generator.js` | refactor to wrapper |
| `src/services/instagramGraph.js` | refactor to re-export |
| `api/run-schedule.js` | create |
| `vercel.json` | update |
| `.env.example` | update |
