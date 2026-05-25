-- InfluenceOS — Full Database Schema
-- ─────────────────────────────────────────────────────────────────────────────
-- Fresh install: run this entire file in Supabase → SQL Editor → New query → Run
-- Existing install: see the MIGRATIONS section at the bottom for ALTER statements.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── TABLES ──────────────────────────────────────────────────────────────────

-- One row per virtual/real influencer persona
CREATE TABLE IF NOT EXISTS public.influencers (
  id              text PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  name            text NOT NULL,
  niche           text DEFAULT '',
  status          text DEFAULT 'active',         -- active | archived
  color           text DEFAULT '#2563EB',         -- accent color in UI
  platforms       text[] DEFAULT '{}',            -- e.g. ['ig', 'tt']
  ref_images      text[] DEFAULT '{}',            -- public URLs or data: URIs
  personality     text DEFAULT '',
  visual_style    text DEFAULT '',
  tone            text DEFAULT '',
  audience        text DEFAULT '',
  avoid           text DEFAULT '',
  freq_ig         text DEFAULT '',
  freq_tt         text DEFAULT '',
  freq_yt         text DEFAULT '',
  pipelines       jsonb DEFAULT '[]',             -- legacy pipeline list (unused)
  posts_generated integer DEFAULT 0,
  accounts        jsonb DEFAULT '[]',             -- connected social accounts
  ig_metrics      jsonb DEFAULT '{}',             -- cached Instagram analytics
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- One row per user — stores all third-party API credentials
CREATE TABLE IF NOT EXISTS public.api_keys (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id),
  gemini_key       text DEFAULT '',               -- Google AI Studio key
  rapid_key        text,                          -- RapidAPI key (analytics)
  google_client_id text,                          -- Google OAuth client ID
  ig_access_token  text DEFAULT '',               -- Instagram long-lived token
  meta_app_id      text DEFAULT '',               -- Meta developer app ID
  ig_user_id       text DEFAULT '',               -- Instagram business user ID
  updated_at       timestamptz DEFAULT now()
);

-- Reusable carousel generation pipeline config per influencer
CREATE TABLE IF NOT EXISTS public.carousel_pipelines (
  id              text PRIMARY KEY,
  influencer_id   text NOT NULL REFERENCES public.influencers(id),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  name            text NOT NULL DEFAULT 'Carousel',
  idea_mode       text NOT NULL DEFAULT 'auto',   -- auto | manual
  idea            jsonb,                           -- manually set idea (idea_mode=manual)
  slide_count     integer NOT NULL DEFAULT 5,
  aspect_ratio    text NOT NULL DEFAULT '4:5',    -- 1:1 | 4:5 | 9:16
  prompts_result  jsonb,                           -- last generated slide prompts (preview)
  topic_list      jsonb NOT NULL DEFAULT '[]',    -- topic pool for auto ideation
  p1_prompt       jsonb,                           -- custom phase-1 prompt override {system, user}
  p2_prompt       jsonb,                           -- custom phase-2 prompt override
  p4_prompt       jsonb,                           -- custom phase-4 caption prompt override
  hashtag_count   integer DEFAULT 20,
  image_model     text NOT NULL DEFAULT 'gemini-3.1-flash-image-preview',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One row per completed carousel generation run
CREATE TABLE IF NOT EXISTS public.carousel_executions (
  id              text PRIMARY KEY,
  pipeline_id     text NOT NULL REFERENCES public.carousel_pipelines(id),
  influencer_id   text NOT NULL REFERENCES public.influencers(id),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  title           text NOT NULL DEFAULT 'Post',
  topic           text,
  images          jsonb NOT NULL DEFAULT '[]',    -- [{position, src}] public storage URLs
  caption         text,
  hashtags        text[],
  posted          boolean DEFAULT false,           -- true once successfully published to Instagram
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Reusable video generation pipeline config per influencer
CREATE TABLE IF NOT EXISTS public.video_pipelines (
  id              text PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  influencer_id   text NOT NULL REFERENCES public.influencers(id),
  name            text NOT NULL DEFAULT 'Untitled Video',
  aspect_ratio    text NOT NULL DEFAULT '9:16',
  idea_mode       text NOT NULL DEFAULT 'auto',
  idea            jsonb,
  p1_prompt       jsonb,
  p2_prompt       jsonb,
  prompts         jsonb,
  first_frame_src text,
  last_frame_src  text,
  video_url       text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- One row per completed video generation run
CREATE TABLE IF NOT EXISTS public.video_executions (
  id              text PRIMARY KEY,
  pipeline_id     text NOT NULL REFERENCES public.video_pipelines(id),
  influencer_id   text NOT NULL,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  title           text NOT NULL DEFAULT 'Video',
  idea            text,
  first_frame_src text,
  last_frame_src  text,
  video_url       text,
  created_at      timestamptz DEFAULT now()
);

-- One-time scheduled post slot (created by user, processed by cron, kept for audit)
CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id              text PRIMARY KEY,
  influencer_id   text NOT NULL REFERENCES public.influencers(id),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  scheduled_at    text NOT NULL,                  -- Berlin local time "YYYY-MM-DDTHH:MM" (lexicographic compare)
  pip_name        text NOT NULL,                  -- display name of the pipeline
  pip_format      text NOT NULL,                  -- 'carousel' | 'workflow'
  pip_id          text,                           -- references carousel_pipelines.id or workflows.id
  status          text NOT NULL DEFAULT 'pending',-- pending | running | done | error
  error_message   text,                           -- set on status=error; short crash reason
  logs            text[],                         -- step-by-step pipeline log lines written during run
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Visual node-based workflow editor state
CREATE TABLE IF NOT EXISTS public.workflows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id   text NOT NULL REFERENCES public.influencers(id),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  name            text NOT NULL DEFAULT 'Untitled Workflow',
  nodes           jsonb DEFAULT '[]',
  edges           jsonb DEFAULT '[]',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ─── STORAGE BUCKETS ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('carousel-images', 'carousel-images', true),  -- generated slide images
  ('influencer-refs', 'influencer-refs', true)    -- influencer reference photos
ON CONFLICT (id) DO NOTHING;

-- Public read; authenticated users can upload/delete their own files
CREATE POLICY "public read carousel-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'carousel-images');

CREATE POLICY "auth upload carousel-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'carousel-images');

CREATE POLICY "auth delete carousel-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'carousel-images');

CREATE POLICY "public read influencer-refs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'influencer-refs');

CREATE POLICY "auth upload influencer-refs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'influencer-refs');

CREATE POLICY "auth delete influencer-refs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'influencer-refs');

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE public.influencers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carousel_pipelines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carousel_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_pipelines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_executions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_slots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows           ENABLE ROW LEVEL SECURITY;

-- Each user can only read/write their own rows
CREATE POLICY "users manage own influencers"
  ON public.influencers FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own api_keys"
  ON public.api_keys FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own carousel pipelines"
  ON public.carousel_pipelines FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own carousel executions"
  ON public.carousel_executions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own video pipelines"
  ON public.video_pipelines FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own video executions"
  ON public.video_executions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "users manage own schedule slots"
  ON public.schedule_slots FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own workflows"
  ON public.workflows FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── MIGRATIONS (for existing installs) ──────────────────────────────────────
-- If you ran the schema before a certain date, apply the relevant ALTER statements below.
-- Safe to run multiple times — all use IF NOT EXISTS / IF EXISTS guards.

-- 2026-05-25: schedule_slots — switched from recurring day/time slots to one-time timestamps
-- (If your table has day_key + time columns instead of scheduled_at, recreate the table.)

-- 2026-05-25: schedule_slots — added status tracking and pipeline logs
-- ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
-- ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS error_message text;
-- ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS logs text[];
