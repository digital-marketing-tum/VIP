-- InfluenceOS — Seed Data
-- =============================================================================
-- INSTRUCTIONS — read before running
-- =============================================================================
--
-- This script imports data for the small tables directly.
-- Three tables (influencers, carousel_pipelines, carousel_executions) are
-- too large to inline and must be imported via CSV (see Step 3 below).
--
-- STEP 1 — Create your auth user
--   Open the app in the browser and sign up / sign in.
--   This creates your row in auth.users.
--
-- STEP 2 — Find your new user ID
--   Supabase Dashboard → Authentication → Users → copy your UUID.
--   Replace the placeholder below:

SELECT set_config('app.new_uid', '77c1e16c-cd5a-4135-ad98-7e82e0649152', false);

-- The original user ID from the exported data (all foreign keys reference this):
-- e764fe76-c312-40dc-b1c8-21a512e46f0f

-- STEP 3 — Import the three large CSVs (do this BEFORE running the rest)
--
--   The Table Editor CSV import enforces FK constraints, so disable triggers
--   first for each table, import, then re-enable.
--
--   a) influencers
--      Run in SQL Editor:
--        ALTER TABLE public.influencers DISABLE TRIGGER ALL;
--      Then: Table Editor → influencers → Import data → influencers_rows.csv
--      Then run:
--        ALTER TABLE public.influencers ENABLE TRIGGER ALL;
--
--   b) carousel_pipelines (depends on influencers)
--      Run in SQL Editor:
--        ALTER TABLE public.carousel_pipelines DISABLE TRIGGER ALL;
--      Then: Table Editor → carousel_pipelines → Import data → carousel_pipelines_rows.csv
--      Then run:
--        ALTER TABLE public.carousel_pipelines ENABLE TRIGGER ALL;
--
--   c) carousel_executions (depends on carousel_pipelines + influencers)
--      Run in SQL Editor:
--        ALTER TABLE public.carousel_executions DISABLE TRIGGER ALL;
--      Then: Table Editor → carousel_executions → Import data → carousel_executions_rows.csv
--      Then run:
--        ALTER TABLE public.carousel_executions ENABLE TRIGGER ALL;
--
-- STEP 4 — Run the rest of this script in the SQL Editor.
--   It will INSERT all remaining data, then update every user_id to your new one.
-- =============================================================================

-- Bypass FK constraint checks for this session so the old user_id doesn't fail.
SET session_replication_role = replica;


-- ─── api_keys ─────────────────────────────────────────────────────────────────
-- Note: replace these keys with your own in Settings after migration.
INSERT INTO public.api_keys
  (user_id, gemini_key, rapid_key, google_client_id, ig_access_token, meta_app_id, ig_user_id, updated_at)
VALUES (
  'e764fe76-c312-40dc-b1c8-21a512e46f0f',
  'AIzaSyAw_7hLKcXRqd89_eW0gwNiEyRwB4vzpb4',
  'dd0cd1db39msh948df295566ea84p121e07jsn7120b9823efa',
  NULL,
  'IGAARVeEVHInJBZAFpWcHpSRUhiYlVqSFVjMmVaM2RIX1FKMW9FUkZAPOG5yVlJoak1qV0toRWJWSnJRb1V1ajFCYldsbXN1bkF2SF9nUnBrMVFXajhuRXdGNl82RURGZAF84akk1aXlrN1oyN1RXZADAzRW1kV3d1ZAWt3dWxqcnp0WQZDZD',
  '87511085523457',
  '17841478286481561',
  '2026-04-21 10:13:22.958+00'
)
ON CONFLICT (user_id) DO NOTHING;


-- ─── video_pipelines ──────────────────────────────────────────────────────────
INSERT INTO public.video_pipelines
  (id, user_id, influencer_id, name, aspect_ratio, idea_mode, idea, p1_prompt, p2_prompt, prompts,
   first_frame_src, last_frame_src, video_url, created_at, updated_at)
VALUES
(
  'mnqfg1uzxguj',
  'e764fe76-c312-40dc-b1c8-21a512e46f0f',
  'mnmr0zxsci06',
  'Video #1',
  '9:16',
  'manual',
  '{"mood":"Adventurous, carefree, vibrant","concept":"Gaia laughs as she playfully swings on a rope swing over a crystal-clear turquoise river in a lush jungle."}',
  NULL,
  NULL,
  '{"motionPrompt":"The subject swings from left to right across the frame. The camera follows the arc, maintaining the swing in the center of the shot. As she swings, the light shifts subtly, creating dynamic highlights and shadows on the surrounding foliage. A gentle zoom out during the swing emphasizes the expansive jungle backdrop before quickly zooming back in to capture the splash.","lastFramePrompt":"Tight shot capturing the turquoise river, and the splash of water created as the swing slows. The jungle foliage surrounds the river. Camera angle close to the water surface, showing droplets and reflections. Sunlight glinting off the water, creating sparkling highlights. Emerald green and turquoise color palette, with warm golden highlights. Shallow depth of field to further emphasize the splash.","firstFramePrompt":"Lush, vibrant jungle setting. Wide shot, capturing the river, rope swing, and surrounding foliage. Camera positioned slightly below the subject, looking up to emphasize height and freedom. Soft, diffused sunlight filtering through the canopy, creating dappled light. Emerald green and turquoise color palette, with warm golden highlights. Shallow depth of field to subtly blur the background, drawing focus to the swing and river."}',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqg0yyc87zr/first-frame.jpg',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqg0yyc87zr/last-frame.jpg',
  NULL,
  '2026-04-08 19:14:28.58536+00',
  '2026-04-08 20:24:14.304+00'
),
(
  'mo746fftw75f',
  'e764fe76-c312-40dc-b1c8-21a512e46f0f',
  'mnmr4gr1q6bz',
  'Video #1',
  '9:16',
  'auto',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  '2026-04-20 11:31:07.984635+00',
  '2026-04-20 11:31:07.984635+00'
)
ON CONFLICT (id) DO NOTHING;


-- ─── video_executions ─────────────────────────────────────────────────────────
INSERT INTO public.video_executions
  (id, pipeline_id, influencer_id, user_id, title, idea, first_frame_src, last_frame_src, video_url, created_at)
VALUES
(
  'mnqh13gor6io', 'mnqfg1uzxguj', 'mnmr0zxsci06', 'e764fe76-c312-40dc-b1c8-21a512e46f0f',
  'Video #1',
  'Gaia laughs joyfully as she swings on a simple rope swing over a lush green valley, hair flowing freely in the wind.',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqgqkhksobg/first-frame.jpg',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqgqkhksobg/last-frame.jpg',
  'https://generativelanguage.googleapis.com/v1beta/files/6htchee3bdq3:download?alt=media',
  '2026-04-08 19:58:49.926346+00'
),
(
  'mnqh5n8yzh9w', 'mnqfg1uzxguj', 'mnmr0zxsci06', 'e764fe76-c312-40dc-b1c8-21a512e46f0f',
  'Video #2',
  'Gaia laughs freely as she skips down a cobblestone street in a vibrant Italian town, sunlight dappling her face.',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqh2wzjvxzc/first-frame.jpg',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqh2wzjvxzc/last-frame.jpg',
  'https://generativelanguage.googleapis.com/v1beta/files/htsr5r3yaq8q:download?alt=media',
  '2026-04-08 20:02:22.229876+00'
),
(
  'mnqhdtl89qul', 'mnqfg1uzxguj', 'mnmr0zxsci06', 'e764fe76-c312-40dc-b1c8-21a512e46f0f',
  'Video #3',
  'Gaia spins around with her arms outstretched, laughing, as vibrant colored prayer flags flutter around her in the Himalayan mountains.',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqhbmfrhseh/first-frame.jpg',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqhbmfrhseh/last-frame.jpg',
  'https://generativelanguage.googleapis.com/v1beta/files/gbpeckuy94he:download?alt=media&key=AIzaSyA9dYAlBF_XWNngsFO_-AGfvdLeITtj0Hk',
  '2026-04-08 20:08:43.655718+00'
),
(
  'mnqhk5wqzrpb', 'mnqfg1uzxguj', 'mnmr0zxsci06', 'e764fe76-c312-40dc-b1c8-21a512e46f0f',
  'Video #4',
  'Gaia Close up (Selfie) , sitted in a bench, background Rio de Janeiro Ipanema',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqhhux55lm3/first-frame.jpg',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqhhux55lm3/last-frame.jpg',
  'https://generativelanguage.googleapis.com/v1beta/files/lnj0re24phel:download?alt=media&key=AIzaSyA9dYAlBF_XWNngsFO_-AGfvdLeITtj0Hk',
  '2026-04-08 20:13:39.661191+00'
),
(
  'mnqi0oexd3zm', 'mnqfg1uzxguj', 'mnmr0zxsci06', 'e764fe76-c312-40dc-b1c8-21a512e46f0f',
  'Video #5',
  'Ultra-realistic 4K natural selfie (zoom) of a woman (from the reference image) in the Ipanema beach, Rio de Janeiro, Brazil, at golden hour.  Focus on the vibrant colors of the sunset reflecting on the wet sand, . Soft, warm lighting bathes the scene. Shallow depth of field with blurred silhouettes of people enjoying the beach in the background.',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqhxthgymig/first-frame.jpg',
  'https://zumwbzvdpwmafzrymndo.supabase.co/storage/v1/object/public/carousel-images/e764fe76-c312-40dc-b1c8-21a512e46f0f/mnqfg1uzxguj/mnqhxthgymig/last-frame.jpg',
  'https://generativelanguage.googleapis.com/v1beta/files/wlwog05teo94:download?alt=media&key=AIzaSyA9dYAlBF_XWNngsFO_-AGfvdLeITtj0Hk',
  '2026-04-08 20:26:30.095445+00'
)
ON CONFLICT (id) DO NOTHING;


-- ─── schedule_slots ───────────────────────────────────────────────────────────
INSERT INTO public.schedule_slots
  (id, influencer_id, user_id, day_key, pip_name, pip_format, pip_id, time, created_at)
VALUES
  ('76cpw1i', 'mnmrdhsacjeg', 'e764fe76-c312-40dc-b1c8-21a512e46f0f', 'thu', 'Carousel #1',              'carousel', 'mo20e26g528i', '09:00', '2026-05-12 14:58:33.296938+00'),
  ('77006r0', 'mnmr0zxsci06', 'e764fe76-c312-40dc-b1c8-21a512e46f0f', 'fri', 'Carousel #2',              'carousel', 'mnq4ikng3sl2', '13:00', '2026-04-08 14:15:56.006389+00'),
  ('royo7mr', 'mnmr0zxsci06', 'e764fe76-c312-40dc-b1c8-21a512e46f0f', 'thu', 'Carousel for Travel Posts','carousel', 'mno1edjs71zt', '09:00', '2026-04-08 13:54:41.826596+00'),
  ('usb8nto', 'mnmr4gr1q6bz', 'e764fe76-c312-40dc-b1c8-21a512e46f0f', 'sun', 'Carousel #2',              'carousel', 'mnyulqbhcbv5', '16:00', '2026-04-19 13:43:48.18277+00'),
  ('xstuqbm', 'mnmrdhsacjeg', 'e764fe76-c312-40dc-b1c8-21a512e46f0f', 'tue', 'Carousel #1',              'carousel', 'mo20e26g528i', '18:00', '2026-05-12 15:03:51.63907+00')
ON CONFLICT (id) DO NOTHING;


-- ─── workflows ────────────────────────────────────────────────────────────────
INSERT INTO public.workflows
  (id, influencer_id, user_id, name, nodes, edges, created_at, updated_at)
VALUES (
  '82720d3f-5d66-480e-b72d-1c89172a7795',
  'mnmr0zxsci06',
  'e764fe76-c312-40dc-b1c8-21a512e46f0f',
  'Test Workflow',
  '[{"id":"trigger-1","data":{"color":"#5e5ce6","label":"Start","config":{"input":""}},"type":"trigger","dragging":false,"measured":{"width":230,"height":55},"position":{"x":42.04028267551823,"y":187.75492989532844},"selected":false},{"id":"llm-1775460346193","data":{"color":"#0071e3","label":"LLM Call","config":{"model":"gemini-2.0-flash","prompt":"","systemPrompt":""}},"type":"llm","dragging":false,"measured":{"width":230,"height":82},"position":{"x":369.12655084124793,"y":173.69652555544883},"selected":true}]',
  '[{"id":"xy-edge__trigger-1-llm-1775460346193","type":"smoothstep","style":{"stroke":"#0071e3","strokeWidth":1.5},"source":"trigger-1","target":"llm-1775460346193","markerEnd":{"type":"arrowclosed","color":"#0071e3"}}]',
  '2026-04-06 06:57:28.422249+00',
  '2026-04-06 07:27:55.503+00'
)
ON CONFLICT (id) DO NOTHING;


-- ─── Restore FK checks ────────────────────────────────────────────────────────
SET session_replication_role = DEFAULT;


-- ─── Update user_id across all tables ────────────────────────────────────────
-- Reassigns every row from the old (exported) user ID to your new one.
-- This runs last so all rows exist before we update the FK.
DO $$
DECLARE
  old_uid uuid := 'e764fe76-c312-40dc-b1c8-21a512e46f0f';
  new_uid uuid := current_setting('app.new_uid')::uuid;
BEGIN
  UPDATE public.influencers        SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE public.api_keys           SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE public.carousel_pipelines SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE public.carousel_executions SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE public.video_pipelines    SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE public.video_executions   SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE public.schedule_slots     SET user_id = new_uid WHERE user_id = old_uid;
  UPDATE public.workflows          SET user_id = new_uid WHERE user_id = old_uid;
END $$;
