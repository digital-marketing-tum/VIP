-- InfluenceOS — Full Database Schema
-- Run this entire file in your Supabase project's SQL Editor to set up the database.
-- Dashboard → SQL Editor → New query → paste → Run

-- ─── TABLES ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.influencers (
  id              text PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  name            text NOT NULL,
  niche           text DEFAULT '',
  status          text DEFAULT 'active',
  color           text DEFAULT '#2563EB',
  platforms       text[] DEFAULT '{}',
  ref_images      text[] DEFAULT '{}',
  personality     text DEFAULT '',
  visual_style    text DEFAULT '',
  tone            text DEFAULT '',
  audience        text DEFAULT '',
  avoid           text DEFAULT '',
  freq_ig         text DEFAULT '',
  freq_tt         text DEFAULT '',
  freq_yt         text DEFAULT '',
  pipelines       jsonb DEFAULT '[]',
  posts_generated integer DEFAULT 0,
  accounts        jsonb DEFAULT '[]',
  ig_metrics      jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_keys (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id),
  gemini_key       text DEFAULT '',
  rapid_key        text,
  google_client_id text,
  ig_access_token  text DEFAULT '',
  meta_app_id      text DEFAULT '',
  ig_user_id       text DEFAULT '',
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.carousel_pipelines (
  id              text PRIMARY KEY,
  influencer_id   text NOT NULL REFERENCES public.influencers(id),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  name            text NOT NULL DEFAULT 'Carousel',
  idea_mode       text NOT NULL DEFAULT 'auto',
  idea            jsonb,
  slide_count     integer NOT NULL DEFAULT 5,
  aspect_ratio    text NOT NULL DEFAULT '4:5',
  prompts_result  jsonb,
  topic_list      jsonb NOT NULL DEFAULT '[]',
  p1_prompt       jsonb,
  p2_prompt       jsonb,
  p4_prompt       jsonb,
  hashtag_count   integer DEFAULT 20,
  image_model     text NOT NULL DEFAULT 'gemini-3.1-flash-image-preview',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.carousel_executions (
  id              text PRIMARY KEY,
  pipeline_id     text NOT NULL REFERENCES public.carousel_pipelines(id),
  influencer_id   text NOT NULL REFERENCES public.influencers(id),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  title           text NOT NULL DEFAULT 'Post',
  topic           text,
  images          jsonb NOT NULL DEFAULT '[]',
  caption         text,
  hashtags        text[],
  posted          boolean DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id              text PRIMARY KEY,
  influencer_id   text NOT NULL REFERENCES public.influencers(id),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  scheduled_at    text NOT NULL,  -- Berlin local time: "YYYY-MM-DDTHH:MM"
  pip_name        text NOT NULL,
  pip_format      text NOT NULL,
  pip_id          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

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
-- Run in SQL Editor or via Dashboard → Storage → New bucket (toggle Public on)

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('carousel-images', 'carousel-images', true),
  ('influencer-refs', 'influencer-refs', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read public files; only authenticated users can upload/delete their own
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

ALTER TABLE public.influencers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carousel_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carousel_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_pipelines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_executions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_slots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows          ENABLE ROW LEVEL SECURITY;

-- Each user can only access their own rows
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
