# InfluenceOS

AI-powered content pipeline manager for Instagram creators. Manage influencer personas, generate carousel posts and videos with Gemini AI, schedule automated publishing, and track analytics.

## Features

- **Influencer profiles** — persona, visual style, tone, audience, reference images
- **Carousel pipelines** — 4-phase AI generation: ideation → slide prompts → image generation (Gemini) → caption + hashtags
- **Video pipelines** — first/last frame generation + Veo video synthesis
- **Scheduled publishing** — one-time posts scheduled to Berlin time, auto-executed by cron, published to Instagram via Graph API
- **Post dashboard** — browse all generated carousels, edit titles, download images, re-post
- **Analytics** — Instagram reach/engagement pulled via RapidAPI
- **Google Drive export** — save carousel slides to Drive

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier works)
2. Go to **SQL Editor → New query**, paste the full contents of [`supabase/schema.sql`](supabase/schema.sql), and run it — this creates all tables, storage buckets, and RLS policies
3. Go to **Authentication → Providers** and enable **Google**
4. Note your **Project URL** and **anon public key** from Project Settings → API
5. Note your **service_role key** from the same page (used server-side only — never expose to the browser)

### 2. Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → enable **Google Drive API** and **Google Identity Services**
3. Create an **OAuth 2.0 Client ID** (Web application type)
4. Add your deployed URL (and `http://localhost:5173` for local dev) to **Authorized JavaScript Origins**
5. Add the same URLs as **Authorized redirect URIs** in Supabase → Authentication → URL Configuration

### 3. Deploy to Vercel

1. Push this repo to GitHub and import it in [vercel.com](https://vercel.com)
2. Vercel auto-detects Vite — no build config needed
3. Add the following environment variables in Vercel → Project → Settings → Environment Variables:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `VITE_GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials → your OAuth client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
| `CRON_SECRET` | Any random secret string you generate (e.g. `openssl rand -hex 32`) |

> `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are server-side only — they are never sent to the browser.

### 4. Set up automated scheduling (cron-job.org)

The `/api/run-schedule` serverless function runs the carousel pipeline for any due schedule slots. It needs to be triggered every 10 minutes by an external cron service (Vercel Hobby only allows 1 cron/day).

1. Create a free account at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **URL:** `https://your-app.vercel.app/api/run-schedule`
   - **Schedule:** every 10 minutes (`*/10 * * * *`)
   - **Timeout:** 30 seconds (maximum on free tier)
   - **Header:** `Authorization: Bearer <your CRON_SECRET value>`
3. The function responds with `202` immediately (within the 30s window) and continues processing in the background for up to 5 minutes

### 5. Local development

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GOOGLE_CLIENT_ID
npm install
npm run dev
```

> `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are only needed for the serverless function — local `npm run dev` doesn't run it.

### 6. In-app API keys

After logging in, go to **Settings** and enter your own API credentials (stored in your Supabase, never shared):

| Key | Purpose | Where to get it |
|---|---|---|
| **Gemini API key** | AI text + image generation | [aistudio.google.com](https://aistudio.google.com) — free tier available |
| **RapidAPI key** | Instagram analytics | Subscribe to *Instagram Looter 2* on RapidAPI — free tier available |
| **Meta App ID** | Instagram publishing | [developers.facebook.com](https://developers.facebook.com) → your app → Instagram → API setup |
| **Instagram Access Token** | Instagram publishing | Long-lived user token from the Meta developer console |
| **Instagram User ID** | Instagram publishing | Your Instagram business account numeric ID |

---

## Architecture

```
src/               React + Vite SPA (browser only)
  pages/           Route-level components
  services/        API call wrappers (Gemini, Instagram Graph, Drive)
  store.js         Global state (Zustand-free, plain module)

lib/               Shared code — works in both browser (Vite) and Node (Vercel)
  gemini.js        Prompt builders and JSON extractor (no API calls)
  instagram.js     Instagram Graph API fetch wrappers

api/               Vercel serverless functions (Node.js, ESM)
  run-schedule.js  Cron handler — runs due schedule slots, executes carousel pipelines

supabase/
  schema.sql       Full DB schema + storage policies + migration notes
```

### Carousel pipeline (4 phases)

1. **Ideation** — Gemini generates a concrete post idea (topic, hook, angle) at high temperature for variety
2. **Slide prompts** — Gemini generates one detailed image prompt per slide, referencing the influencer's visual style and reference images
3. **Image generation** — Gemini image model renders each slide; images are uploaded to Supabase Storage (`carousel-images` bucket)
4. **Caption** — Gemini writes the caption and hashtags

The pipeline runs server-side in `api/run-schedule.js` (scheduled) or client-side in the browser (manual runs from the UI). Both paths use the same prompt builders from `lib/gemini.js`.

### Scheduling

- Users schedule one-time posts from the weekly calendar in the influencer detail view
- Slots are stored in `schedule_slots` with a Berlin-timezone timestamp (`YYYY-MM-DDTHH:MM`)
- The cron function queries for `status = 'pending'` slots with `scheduled_at <= now_berlin`
- Slot lifecycle: `pending` → `running` → `done` / `error`
- Step-by-step logs are written to `schedule_slots.logs` after each phase and are viewable in the UI by clicking the slot

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5 |
| Backend / DB | Supabase (PostgreSQL + Storage + Auth) |
| Serverless | Vercel Functions (Node.js ESM, 300s max) |
| AI — text | Gemini 2.0 Flash |
| AI — images | Gemini image model (configurable per pipeline) |
| AI — video | Veo via Gemini API |
| Publishing | Instagram Graph API |
| Analytics | RapidAPI / Instagram Looter 2 |
| Drive export | Google Drive API |
| Scheduling | cron-job.org (external HTTP trigger) |
