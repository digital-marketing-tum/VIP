import { textLimiter, imageLimiter } from './rateLimiter.js'
import {
  buildPersonaContext,
  extractJSON,
  IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL,
  buildIdeationPrompt,
  buildSlidePromptsPrompt,
  buildTopicListPrompt,
  buildCaptionPrompt,
  buildVideoIdeaPrompt,
  buildVideoPromptsPrompt,
} from '../../lib/gemini.js'

export {
  buildPersonaContext,
  IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL,
  buildIdeationPrompt,
  buildSlidePromptsPrompt,
  buildTopicListPrompt,
  buildCaptionPrompt,
  buildVideoIdeaPrompt,
  buildVideoPromptsPrompt,
}

// ── Rate-limited Gemini text call ─────────────────────────────────────────────
export async function geminiText(apiKey, { system, user, model = 'gemini-2.0-flash', temperature }) {
  if (!apiKey || apiKey.length < 10 || !apiKey.startsWith('AIza')) {
    throw new Error('Invalid Gemini API key. Go to Settings and enter your key from aistudio.google.com (starts with AIza…).')
  }
  await textLimiter.acquire()
  const url  = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const body = { contents: [{ parts: [{ text: user }] }] }
  if (system?.trim()) {
    body.systemInstruction = { parts: [{ text: system }] }
  }
  if (temperature !== undefined) {
    body.generationConfig = { temperature }
  }
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  textLimiter.readHeaders(res)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Gemini API error')
  return data.candidates[0].content.parts[0].text
}

// ── Rate-limited image generation ─────────────────────────────────────────────
export async function generateSlideImage(apiKey, prompt, refImages = [], aspectRatio = '4:5', model = DEFAULT_IMAGE_MODEL) {
  if (!apiKey || !apiKey.startsWith('AIza')) {
    throw new Error('Invalid Gemini API key. Go to Settings.')
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const parts = []
  for (const imgData of refImages) {
    const comma = imgData.indexOf(',')
    if (comma === -1) continue
    const mimeType = imgData.slice(5, imgData.indexOf(';'))
    const b64      = imgData.slice(comma + 1)
    parts.push({ inlineData: { mimeType, data: b64 } })
  }
  parts.push({ text: prompt })

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: { aspectRatio },
    },
  }

  await imageLimiter.acquire()
  const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  imageLimiter.readHeaders(res)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Gemini image error')

  const imgPart = data.candidates[0].content.parts.find(p => p.inlineData)
  if (!imgPart) throw new Error('No image returned from Gemini.')
  const { mimeType, data: b64out } = imgPart.inlineData
  return `data:${mimeType};base64,${b64out}`
}

// ── High-level pipeline functions ─────────────────────────────────────────────

export async function generateTopicList(apiKey, inf, count = 10, customPrompt) {
  const defaults = buildTopicListPrompt(inf, count)
  const system   = customPrompt?.system ?? defaults.system
  const user     = customPrompt?.user   ?? defaults.user
  const raw = await geminiText(apiKey, { system, user })
  const parsed = extractJSON(raw)
  const topics = Array.isArray(parsed) ? parsed : parsed.topics
  if (!Array.isArray(topics)) throw new Error('Unexpected response format from AI.')
  return topics.map(t =>
    typeof t === 'string' ? t : t.title || t.topic || t.text || t.description || JSON.stringify(t)
  )
}

export async function generateVideoIdea(apiKey, inf, customPrompt) {
  const defaults = buildVideoIdeaPrompt(inf)
  const system = customPrompt?.system ?? defaults.system
  const user   = customPrompt?.user   ?? defaults.user
  const raw = await geminiText(apiKey, { system, user })
  return extractJSON(raw)
}

export async function generateVideoPrompts(apiKey, inf, idea, customPrompt) {
  const defaults = buildVideoPromptsPrompt(inf, idea)
  const system = customPrompt?.system ?? defaults.system
  const user   = customPrompt?.user   ?? defaults.user
  const raw = await geminiText(apiKey, { system, user })
  return extractJSON(raw)
}

export async function generateCaption(apiKey, inf, idea, hashtagCount = 5, customPrompt) {
  const defaults = buildCaptionPrompt(inf, idea, hashtagCount)
  const system   = customPrompt?.system ?? defaults.system
  const user     = customPrompt?.user   ?? defaults.user
  const raw = await geminiText(apiKey, { system, user })
  return extractJSON(raw)
}

export async function ideateCarousel(apiKey, inf, customPrompt) {
  const defaults = buildIdeationPrompt(inf)
  const system   = customPrompt?.system ?? defaults.system
  const user     = customPrompt?.user   ?? defaults.user
  const raw = await geminiText(apiKey, { system, user, temperature: 1.5 })
  return extractJSON(raw)
}

export async function generateSlidePrompts(apiKey, inf, idea, slideCount, aspectRatio, customPrompt) {
  const defaults = buildSlidePromptsPrompt(inf, idea, slideCount, aspectRatio)
  const system   = customPrompt?.system ?? defaults.system
  const user     = customPrompt?.user   ?? defaults.user
  const raw = await geminiText(apiKey, { system, user })
  return extractJSON(raw)
}
