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

// ── Full carousel pipeline ────────────────────────────────────────────────────

async function runCarouselPipeline(supabase, slot) {
  // Load pipeline, influencer, api keys
  const { data: pip, error: pipErr } = await supabase
    .from('carousel_pipelines').select('*').eq('id', slot.pip_id).single()
  if (pipErr || !pip) throw new Error(`Pipeline ${slot.pip_id} not found`)

  const { data: infRow } = await supabase
    .from('influencers').select('*').eq('id', pip.influencer_id).single()
  if (!infRow) throw new Error(`Influencer ${pip.influencer_id} not found`)

  const { data: keys } = await supabase
    .from('api_keys').select('*').eq('user_id', pip.user_id).single()
  if (!keys?.gemini_key) throw new Error('No Gemini key configured for this user')

  const geminiKey = keys.gemini_key
  const inf       = mapInfluencer(infRow)
  const inlineRefs = await resolveRefImages(inf.refImages)

  // Phase 1: ideate
  const ideaDefaults = buildIdeationPrompt(inf)
  const ideaRaw = await geminiText(geminiKey, {
    system:      pip.p1_prompt?.system ?? ideaDefaults.system,
    user:        pip.p1_prompt?.user   ?? ideaDefaults.user,
    temperature: 1.5,
  })
  const idea = extractJSON(ideaRaw)

  // Phase 2: slide prompts
  const slideDefaults = buildSlidePromptsPrompt(inf, idea, pip.slide_count, pip.aspect_ratio)
  const slideRaw = await geminiText(geminiKey, {
    system: pip.p2_prompt?.system ?? slideDefaults.system,
    user:   pip.p2_prompt?.user   ?? slideDefaults.user,
  })
  const { slides } = extractJSON(slideRaw)

  // Phase 3: generate + upload images
  const execKey      = genId()
  const storageFolder = `${pip.user_id}/${pip.id}/${execKey}`
  const images       = []

  for (const slide of slides) {
    const inlineData = await geminiImage(geminiKey, slide.prompt, inlineRefs, pip.aspect_ratio, pip.image_model)
    const dataUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`
    const src = await uploadToStorage(supabase, dataUrl, 'carousel-images', `${storageFolder}/slide-${slide.position}`)
    images.push({ position: slide.position, src })
  }

  // Phase 4: caption
  const capDefaults = buildCaptionPrompt(inf, idea, pip.hashtag_count ?? 20)
  const capRaw = await geminiText(geminiKey, {
    system: pip.p4_prompt?.system ?? capDefaults.system,
    user:   pip.p4_prompt?.user   ?? capDefaults.user,
  })
  const capData = extractJSON(capRaw)

  // Save execution (posted: false — always; updated to true only if IG post succeeds)
  const { count } = await supabase
    .from('carousel_executions')
    .select('*', { count: 'exact', head: true })
    .eq('influencer_id', inf.id)

  const execId = genId()
  await supabase.from('carousel_executions').insert({
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

  // Attempt Instagram post — failure is non-fatal
  const igToken  = keys.ig_access_token
  const igUserId = keys.ig_user_id

  if (igToken && igUserId && images.length >= 2) {
    try {
      const imageUrls   = images.map(img => img.src)
      const captionText = [capData?.caption, ...(capData?.hashtags || [])].filter(Boolean).join('\n\n')
      await publishCarousel({ igUserId, accessToken: igToken, imageUrls, caption: captionText })
      await supabase.from('carousel_executions').update({ posted: true }).eq('id', execId)
    } catch (err) {
      console.error(`Instagram post failed for execution ${execId}:`, err.message)
    }
  }

  return execId
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Verify Vercel Cron secret (auto-set by Vercel on deploy)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // Determine current Berlin time → day_key + HH:MM
  const now   = new Date()
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday:  'short',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(now)

  const DAY_MAP = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' }
  const dayKey = DAY_MAP[parts.find(p => p.type === 'weekday').value]
  const hh     = parts.find(p => p.type === 'hour').value.padStart(2, '0')
  const mm     = parts.find(p => p.type === 'minute').value.padStart(2, '0')
  const currentTime = `${hh}:${mm}`

  // Find slots due right now
  const { data: slots, error: slotErr } = await supabase
    .from('schedule_slots')
    .select('*')
    .eq('day_key', dayKey)
    .eq('time', currentTime)

  if (slotErr) return res.status(500).json({ error: slotErr.message })
  if (!slots?.length) {
    return res.status(200).json({ skipped: true, time: currentTime, day: dayKey })
  }

  // Respond immediately so cron-job.org gets its response within the 30s timeout.
  // Vercel keeps the function running up to maxDuration (300s) after the response.
  res.status(202).json({ started: true, slots: slots.length, time: currentTime, day: dayKey })

  // Run each due slot in the background — errors are isolated so one failure doesn't block others
  for (const slot of slots) {
    try {
      if (slot.pip_format === 'carousel' && slot.pip_id) {
        await runCarouselPipeline(supabase, slot)
      }
    } catch (err) {
      console.error(`Schedule slot ${slot.id} failed:`, err)
    }
  }

}
