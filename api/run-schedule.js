import { createClient } from '@supabase/supabase-js'
import { publishCarousel } from '../lib/instagram.js'
import {
  extractJSON,
  DEFAULT_IMAGE_MODEL,
  buildIdeationPrompt,
  buildSlidePromptsPrompt,
  buildCaptionPrompt,
} from '../lib/gemini.js'
import { genId, normalizeHashtags, stripHashtagsFromCaption } from '../lib/utils.js'

export const config = { maxDuration: 300 }

// ── Gemini API helpers ────────────────────────────────────────────────────────

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
  return imgPart.inlineData
}

// ── Ref image resolver ────────────────────────────────────────────────────────

async function resolveRefImages(refImages) {
  const result = []
  for (const img of refImages) {
    if (img.startsWith('data:')) {
      const comma = img.indexOf(',')
      if (comma === -1) continue
      result.push({ mimeType: img.slice(5, img.indexOf(';')), data: img.slice(comma + 1) })
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

// ── Supabase storage upload ───────────────────────────────────────────────────

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

function ts() {
  return new Date().toISOString().slice(11, 19)
}

// ── Full carousel pipeline ────────────────────────────────────────────────────

async function runCarouselPipeline(supabase, slot) {
  const logs = []
  const log  = msg => { logs.push(`[${ts()}] ${msg}`) }

  // Flush logs to DB so they're visible even if the function crashes mid-run
  async function flushLogs() {
    await supabase.from('schedule_slots').update({ logs }).eq('id', slot.id)
  }

  log(`Starting carousel pipeline — pip_id=${slot.pip_id}`)
  await flushLogs()

  const { data: pip, error: pipErr } = await supabase
    .from('carousel_pipelines').select('*').eq('id', slot.pip_id).single()
  if (pipErr || !pip) throw new Error(`Pipeline ${slot.pip_id} not found — ${pipErr?.message || 'not found'}`)
  log(`Pipeline: "${pip.name}" (${pip.slide_count} slides, ${pip.aspect_ratio}, model=${pip.image_model})`)

  const [{ data: infRow, error: infErr }, { data: keys, error: keysErr }] = await Promise.all([
    supabase.from('influencers').select('*').eq('id', pip.influencer_id).single(),
    supabase.from('api_keys').select('*').eq('user_id', pip.user_id).single(),
  ])
  if (!infRow) throw new Error(`Influencer ${pip.influencer_id} not found — ${infErr?.message || 'not found'}`)
  if (!keys?.gemini_key) throw new Error(`No Gemini key configured — ${keysErr?.message || 'row missing or key empty'}`)
  log(`Influencer: "${infRow.name}" — Gemini: yes, IG token: ${keys.ig_access_token ? 'yes' : 'no'}, IG user ID: ${keys.ig_user_id ? 'yes' : 'no'}`)
  await flushLogs()

  const geminiKey  = keys.gemini_key
  const inf        = mapInfluencer(infRow)
  const inlineRefs = await resolveRefImages(inf.refImages)
  log(`Ref images: ${inlineRefs.length} of ${inf.refImages.length} resolved`)

  // Phase 1: ideation
  log('Phase 1: Ideation…')
  await flushLogs()
  const ideaDefaults = buildIdeationPrompt(inf)
  const ideaRaw = await geminiText(geminiKey, {
    system:      pip.p1_prompt?.system ?? ideaDefaults.system,
    user:        pip.p1_prompt?.user   ?? ideaDefaults.user,
    temperature: 1.5,
  })
  const idea = extractJSON(ideaRaw)
  log(`Phase 1 done — topic: "${idea?.topic}"`)

  // Phase 2: slide prompts
  log('Phase 2: Slide prompts…')
  await flushLogs()
  const slideDefaults = buildSlidePromptsPrompt(inf, idea, pip.slide_count, pip.aspect_ratio)
  const slideRaw = await geminiText(geminiKey, {
    system: pip.p2_prompt?.system ?? slideDefaults.system,
    user:   slideDefaults.user,
  })
  const { slides } = extractJSON(slideRaw)
  log(`Phase 2 done — ${slides?.length} slide prompts generated`)
  await flushLogs()

  // Phase 3: generate + upload images
  log('Phase 3: Image generation…')
  const execKey       = genId()
  const storageFolder = `${pip.user_id}/${pip.id}/${execKey}`
  const images        = []
  const QUALITY_SUFFIX = ' | Quality requirements: anatomically correct human anatomy, natural body proportions, properly formed hands with exactly five fingers each, no floating or detached limbs, no body parts clipping through objects or surfaces, no distorted or melting faces, no extra or missing body parts, coherent and physically plausible scene.'

  for (const slide of slides) {
    log(`  Slide ${slide.position}/${slides.length}: generating image…`)
    await flushLogs()
    const inlineData = await geminiImage(geminiKey, slide.prompt + QUALITY_SUFFIX, inlineRefs, pip.aspect_ratio, pip.image_model)
    const dataUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`
    const src = await uploadToStorage(supabase, dataUrl, 'carousel-images', `${storageFolder}/slide-${slide.position}`)
    images.push({ position: slide.position, src })
    log(`  Slide ${slide.position} done — uploaded to storage`)
    await flushLogs()
  }

  // Phase 4: caption
  log('Phase 4: Caption…')
  await flushLogs()
  const capDefaults = buildCaptionPrompt(inf, idea, pip.hashtag_count ?? 20)
  const capRaw = await geminiText(geminiKey, {
    system: pip.p4_prompt?.system ?? capDefaults.system,
    user:   pip.p4_prompt?.user   ?? capDefaults.user,
  })
  const capData = extractJSON(capRaw)
  log(`Phase 4 done — caption: ${capData?.caption?.length ?? 0} chars, hashtags: ${capData?.hashtags?.length ?? 0}`)

  // Save execution
  log('Saving execution to database…')
  await flushLogs()
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
    caption:       stripHashtagsFromCaption(capData?.caption) || null,
    hashtags:      normalizeHashtags(capData?.hashtags),
    posted:        false,
  })
  if (insertErr) throw new Error(`Failed to save execution: ${insertErr.message}`)
  log(`Execution saved — id=${execId}`)

  // Instagram post — token lives on influencer.accounts, not api_keys
  const igAccount = (infRow.accounts || []).find(a => a.platform === 'ig')
  const igToken   = igAccount?.ig_access_token
  const igUserId  = igAccount?.ig_user_id

  if (igToken && igUserId && images.length >= 2) {
    log('Posting to Instagram…')
    await flushLogs()
    try {
      const imageUrls   = images.map(img => img.src)
      const captionText = [stripHashtagsFromCaption(capData?.caption), normalizeHashtags(capData?.hashtags).join(' ')].filter(Boolean).join('\n\n')
      await publishCarousel({ igUserId, accessToken: igToken, imageUrls, caption: captionText })
      await supabase.from('carousel_executions').update({ posted: true }).eq('id', execId)
      log('Instagram post successful')
    } catch (err) {
      log(`Instagram post failed: ${err.message}`)
    }
  } else {
    log(`Instagram post skipped — token: ${!!igToken}, userId: ${!!igUserId}, images: ${images.length}`)
  }

  log('Pipeline complete')
  await flushLogs()
  return execId
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  console.log('[run-schedule] Cron triggered')

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    console.warn('[run-schedule] Unauthorized — wrong or missing CRON_SECRET')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const now   = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)

  const berlinDatetime = [
    parts.find(p => p.type === 'year').value, '-',
    parts.find(p => p.type === 'month').value, '-',
    parts.find(p => p.type === 'day').value, 'T',
    parts.find(p => p.type === 'hour').value.padStart(2, '0'), ':',
    parts.find(p => p.type === 'minute').value.padStart(2, '0'),
  ].join('')

  console.log(`[run-schedule] Berlin time: ${berlinDatetime}`)

  const { data: slots, error: slotErr } = await supabase
    .from('schedule_slots')
    .select('*')
    .lte('scheduled_at', berlinDatetime)
    .eq('status', 'pending')
    .limit(1)

  if (slotErr) {
    console.error('[run-schedule] Supabase query error:', slotErr.message)
    return res.status(500).json({ error: slotErr.message })
  }

  if (!slots?.length) {
    console.log('[run-schedule] No pending slots due — skipping')
    return res.status(200).json({ skipped: true, berlin: berlinDatetime })
  }

  console.log(`[run-schedule] Found ${slots.length} pending slot(s)`)

  for (const slot of slots) {
    console.log(`[run-schedule] Processing slot ${slot.id} (${slot.pip_format})`)
    try {
      await supabase.from('schedule_slots').update({ status: 'running', logs: [] }).eq('id', slot.id)
      if (slot.pip_format === 'carousel' && slot.pip_id) {
        await runCarouselPipeline(supabase, slot)
      } else {
        console.log(`[run-schedule] Skipping slot ${slot.id} — unsupported format or missing pip_id`)
      }
      await supabase.from('schedule_slots').update({ status: 'done' }).eq('id', slot.id)
    } catch (err) {
      console.error(`[run-schedule] Slot ${slot.id} failed:`, err.message)
      await supabase.from('schedule_slots').update({
        status: 'error',
        error_message: err.message?.slice(0, 500) || 'Unknown error',
      }).eq('id', slot.id)
    }
  }

  console.log('[run-schedule] All slots processed')
  res.status(200).json({ done: true, slots: slots.length, berlin: berlinDatetime })
}
