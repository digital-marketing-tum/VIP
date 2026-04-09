# InfluenceOS

AI-powered content pipeline manager for Instagram creators. Manage influencer personas, generate carousels and videos with Gemini AI, schedule posts, and track analytics.

## Self-hosting setup

### 1. Supabase (your own project, free tier works)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, run the entire contents of [`supabase/schema.sql`](supabase/schema.sql) — this creates all tables and security policies
3. In **Authentication → Providers**, enable **Google** (needed for sign-in and Google Drive export)
4. Copy your **Project URL** and **anon public key** from Project Settings → API

### 2. Google OAuth Client ID

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **Google Drive API** and **Google Identity Services**
3. Create an **OAuth 2.0 Client ID** (Web application)
4. Add your local/deployed URL to Authorized JavaScript Origins
5. Also add it as an Authorized redirect URI in your Supabase Auth settings

### 3. Environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

### 4. Run

```bash
npm install
npm run dev
```

### 5. API keys (inside the app)

After logging in, go to **Settings** and enter your own:
- **Gemini API key** — from [aistudio.google.com](https://aistudio.google.com) (free tier available)
- **RapidAPI key** — subscribe to *Instagram Looter 2* on RapidAPI for analytics (free tier available)

These are stored in your own Supabase, never shared.

## Stack

- React + Vite
- Supabase (auth + database)
- Gemini API (text + image + video generation via Veo)
- Google Drive API (export posts)
- RapidAPI / Instagram Looter 2 (analytics)
