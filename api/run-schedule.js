import { createClient } from '@supabase/supabase-js'
import { publishCarousel } from '../lib/instagram.js'
import {
  extractJSON,
  DEFAULT_IMAGE_MODEL,
  buildIdeationPrompt,
  buildSlidePromptsPrompt,
  buildCaptionPrompt,
} from '../lib/gemini.js'

export const config = { maxDuration: 300 }

// ── Gemini API helpers (no rate limiting needed server-side) ──────────────────

function geminiUrl(model, apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
}

async function geminiText(apiKey, { system, user, model = 'gemini-2.0-flash', temperature }) {
  const body = { contents: [{ parts: [{ text: user }] }] }
  if (system?.trim()) body.systemInstruction = { parts: [{ text: system }] }
  if (temperature !== undefined) body.generationConfig = { temperature }
  const res = await fetch(geminiUrl(model, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Gemini text error')
  return data.candidates[0].content.parts[0].text
}

async function geminiImage(apiKey, prompt, inlineRefs, aspectRatio, model = DEFAULT_IMAGE_MODEL) {
  const parts = [...inlineRefs.map(d => ({ inlineData: d })), { text: prompt }]
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: { aspectRatio },
    },
  }
  const res = await fetch(geminiUrl(model, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Gemini image error')
  const imgPart = data.candidates[0].content.parts.find(p => p.inlineData)
  if (!imgPart) throw new Error('No image returned from Gemini.')
  return imgPart.inlineData // { mimeType, data: b64 }
}

// ── Ref image resolver: handles both data: URLs and https:// URLs ─────────────

async function resolveRefImages(refImages) {
  const result = []
  for (const img of refImages) {
    if (img.startsWith('data:')) {
      const comma = img.indexOf(',')
      if (comma === -1) continue
      result.push({
        mimeType: img.slice(5, img.indexOf(';')),
        data:     img.slice(comma + 1),
      })
    } else if (img.startsWith('http')) {
      try {
        const res = await fetch(img)
        const buf = Buffer.from(await res.arrayBuffer())
        const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
        result.push({ mimeType, data: buf.toString('base64') })
      } catch { /* skip unreachable images */ }
    }
  }
  return result
}

// ── Supabase storage upload (Node-side, uses Buffer not atob) ─────────────────

async function uploadToStorage(supabase, dataUrl, bucket, path) {
  const [header, b64] = dataUrl.split(',')
  const mimeType = header.match(/:(.*?);/)[1]
  const ext      = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const fullPath = `${path}.${ext}`
  const buffer   = Buffer.from(b64, 'base64')
  const { error } = await supabase.storage.from(bucket).upload(fullPath, buffer, { contentType: mimeType, upsert: true })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath)
  return data.publicUrl
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapInfluencer(row) {
  return {
    id:          row.id,
    name:        row.name,
    niche:       row.niche,
    personality: row.personality,
    visualStyle: row.visual_style,
    tone:        row.tone,
    audience:    row.audience,
    avoid:       row.avoid,
    refImages:   row.ref_images || [],
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function log(slotId, msg) {
  console.log(`[run-schedule] [slot:${slotId}] ${msg}`)
}

// ── Full carousel pipeline ────────────────────────────────────────────────────

async function runCarouselPipeline(supabase, slot) {
  log(slot.id, `Starting carousel pipeline for pip_id=${slot.pip_id}`)

  // Load pipeline, influencer, api keys
  const { data: pip, error: pipErr } = await supabase
    .from('carousel_pipelines').select('*').eq('id', slot.pip_id).single()
  if (pipErr || !pip) throw new Error(`Pipeline ${slot.pip_id} not found`)
  log(slot.id, `Pipeline loaded: "${pip.name}" (${pip.slide_count} slides, ${pip.aspect_ratio})`)

  const { data: infRow } = await supabase
    .from('influencers').select('*').eq('id', pip.influencer_id).single()
  if (!infRow) throw new Error(`Influencer ${pip.influencer_id} not found`)
  log(slot.id, `Influencer loaded: "${infRow.name}"`)

  const { data: keys } = await supabase
    .from('api_keys').select('*').eq('user_id', pip.user_id).single()
  if (!keys?.gemini_key) throw new Error('No Gemini key configured for this user')
  log(slot.id, `API keys loaded — Gemini: yes, IG token: ${keys.ig_access_token ? 'yes' : 'no'}, IG user: ${keys.ig_user_id ? 'yes' : 'no'}`)

  const geminiKey  = keys.gemini_key
  const inf        = mapInfluencer(infRow)
  const inlineRefs = await resolveRefImages(inf.refImages)
  log(slot.id, `Ref images resolved: ${inlineRefs.length} of ${inf.refImages.length}`)

  // Phase 1: ideate
  log(slot.id, 'Phase 1: Ideation…')
  const ideaDefaults = buildIdeationPrompt(inf)
  const ideaRaw = await geminiText(geminiKey, {
    system:      pip.p1_prompt?.system ?? ideaDefaults.system,
    user:        pip.p1_prompt?.user   ?? ideaDefaults.user,
    temperature: 1.5,
  })
  const idea = extractJSON(ideaRaw)
  log(slot.id, `Phase 1 done — topic: "${idea?.topic}"`)

  // Phase 2: slide prompts
  log(slot.id, 'Phase 2: Slide prompts…')
  const slideDefaults = buildSlidePromptsPrompt(inf, idea, pip.slide_count, pip.aspect_ratio)
  const slideRaw = await geminiText(geminiKey, {
    system: pip.p2_prompt?.system ?? slideDefaults.system,
    user:   pip.p2_prompt?.user   ?? slideDefaults.user,
  })
  const { slides } = extractJSON(slideRaw)
  log(slot.id, `Phase 2 done — ${slides?.length} slide prompts`)

  // Phase 3: generate + upload images
  log(slot.id, 'Phase 3: Image generation…')
  const execKey       = genId()
  const storageFolder = `${pip.user_id}/${pip.id}/${execKey}`
  const images        = []

  for (const slide of slides) {
    log(slot.id, `  Generating image for slide ${slide.position}/${slides.length}…`)
    const inlineData = await geminiImage(geminiKey, slide.prompt, inlineRefs, pip.aspect_ratio, pip.image_model)
    const dataUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`
    const src = await uploadToStorage(supabase, dataUrl, 'carousel-images', `${storageFolder}/slide-${slide.position}`)
    images.push({ position: slide.position, src })
    log(slot.id, `  Slide ${slide.position} uploaded: ${src}`)
  }

  // Phase 4: caption
  log(slot.id, 'Phase 4: Caption…')
  const capDefaults = buildCaptionPrompt(inf, idea, pip.hashtag_count ?? 20)
  const capRaw = await geminiText(geminiKey, {
    system: pip.p4_prompt?.system ?? capDefaults.system,
    user:   pip.p4_prompt?.user   ?? capDefaults.user,
  })
  const capData = extractJSON(capRaw)
  log(slot.id, `Phase 4 done — caption length: ${capData?.caption?.length ?? 0}, hashtags: ${capData?.hashtags?.length ?? 0}`)

  // Save execution
  const { count } = await supabase
    .from('carousel_executions')
    .select('*', { count: 'exact', head: true })
    .eq('influencer_id', inf.id)

  const execId = genId()
  const { error: insertErr } = await supabase.from('carousel_executions').insert({
    id:            execId,
    pipeline_id:   pip.id,
    influencer_id: inf.id,
    user_id:       pip.user_id,
    title:         `Scheduled #${(count || 0) + 1}`,
    topic:         idea.topic || '',
    images,
    caption:       capData?.caption  || null,
    hashtags:      capData?.hashtags || null,
    posted:        false,
  })
  if (insertErr) throw new Error(`Failed to save execution: ${insertErr.message}`)
  log(slot.id, `Execution saved: id=${execId}`)

  // Attempt Instagram post — failure is non-fatal
  const igToken  = keys.ig_access_token
  const igUserId = keys.ig_user_id

  if (igToken && igUserId && images.length >= 2) {
    log(slot.id, 'Posting to Instagram…')
    try {
      const imageUrls   = images.map(img => img.src)
      const captionText = [capData?.caption, ...(capData?.hashtags || [])].filter(Boolean).join('\n\n')
      await publishCarousel({ igUserId, accessToken: igToken, imageUrls, caption: captionText })
      await supabase.from('carousel_executions').update({ posted: true }).eq('id', execId)
      log(slot.id, 'Instagram post successful')
    } catch (err) {
      console.error(`[run-schedule] [slot:${slot.id}] Instagram post failed:`, err.message)
    }
  } else {
    log(slot.id, `Skipping Instagram post — igToken: ${!!igToken}, igUserId: ${!!igUserId}, images: ${images.length}`)
  }

  log(slot.id, `Pipeline complete — execId=${execId}`)
  return execId
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  console.log('[run-schedule] Cron triggered')

  // Verify Vercel Cron secret (auto-set by Vercel on deploy)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    console.warn('[run-schedule] Unauthorized request — wrong or missing CRON_SECRET')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // Current Berlin datetime as "YYYY-MM-DDTHH:MM" for text comparison
  const now   = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(now)

  const berlinDatetime = [
    parts.find(p => p.type === 'year').value,
    '-',
    parts.find(p => p.type === 'month').value,
    '-',
    parts.find(p => p.type === 'day').value,
    'T',
    parts.find(p => p.type === 'hour').value.padStart(2, '0'),
    ':',
    parts.find(p => p.type === 'minute').value.padStart(2, '0'),
  ].join('')

  console.log(`[run-schedule] Berlin time: ${berlinDatetime}`)

  // Find all pending slots due now or overdue
  const { data: slots, error: slotErr } = await supabase
    .from('schedule_slots')
    .select('*')
    .lte('scheduled_at', berlinDatetime)
    .eq('status', 'pending')

  if (slotErr) {
    console.error('[run-schedule] Supabase query error:', slotErr.message)
    return res.status(500).json({ error: slotErr.message })
  }

  if (!slots?.length) {
    console.log('[run-schedule] No pending slots due — skipping')
    return res.status(200).json({ skipped: true, berlin: berlinDatetime })
  }

  console.log(`[run-schedule] Found ${slots.length} pending slot(s) due`)

  // Respond immediately so cron-job.org gets its response within the 30s timeout.
  // Vercel keeps the function running up to maxDuration (300s) after the response.
  res.status(202).json({ started: true, slots: slots.length, berlin: berlinDatetime })

  // Run each due slot in the background — mark status so it fires only once
  for (const slot of slots) {
    log(slot.id, `Processing slot — format=${slot.pip_format}, pip_id=${slot.pip_id}, scheduled_at=${slot.scheduled_at}`)
    try {
      await supabase.from('schedule_slots').update({ status: 'running' }).eq('id', slot.id)
      if (slot.pip_format === 'carousel' && slot.pip_id) {
        await runCarouselPipeline(supabase, slot)
      } else {
        log(slot.id, `Skipping — unsupported format "${slot.pip_format}" or missing pip_id`)
      }
      await supabase.from('schedule_slots').update({ status: 'done' }).eq('id', slot.id)
      log(slot.id, 'Slot marked done')
    } catch (err) {
      console.error(`[run-schedule] [slot:${slot.id}] Failed:`, err.message)
      await supabase.from('schedule_slots').update({
        status: 'error',
        error_message: err.message?.slice(0, 500) || 'Unknown error',
      }).eq('id', slot.id)
    }
  }

  console.log('[run-schedule] All slots processed')
}
