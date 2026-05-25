import { textLimiter, imageLimiter } from './rateLimiter.js'

// ── JSON extraction (handles ```json...``` wrapping from LLM) ─────────────────
function extractJSON(text) {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const raw   = block ? block[1] : text.trim()
  return JSON.parse(raw)
}

// ── Build persona context string from influencer data ─────────────────────────
export function buildPersonaContext(inf) {
  const fields = [
    ['Name',            inf.name],
    ['Niche',           inf.niche],
    ['Personality',     inf.personality],
    ['Visual Style',    inf.visualStyle],
    ['Tone of Voice',   inf.tone],
    ['Target Audience', inf.audience],
    ['Avoid',           inf.avoid],
  ]
  return fields
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

// ── Base Gemini text call ─────────────────────────────────────────────────────
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

// ── Prompt builders (exported so UI can show/edit them) ───────────────────────
export function buildIdeationPrompt(inf) {
  const persona = buildPersonaContext(inf)
  return {
    system: `You are a creative content strategist for this Instagram creator:\n\n${persona}\n\nAlways think from their brand's unique perspective and audience.`,
    user: `Generate ONE Instagram carousel post idea for this creator.\nBe specific — a concrete place, a concrete experience, a particular moment. Avoid vague or generic phrasing.\n\nReturn ONLY valid JSON (no markdown, no explanation outside the JSON):\n{\n  "topic": "the main topic in one clear, specific sentence"\n}`,
  }
}

export function buildSlidePromptsPrompt(inf, idea, slideCount, aspectRatio) {
  const persona = buildPersonaContext(inf)
  return {
    system: `You are a creative director generating image prompts for an Instagram carousel.\n\nCreator context:\n${persona}\n\nVisual consistency rules:\n- ALL slides must share the same color palette, lighting style, and composition approach\n- Optimized for ${aspectRatio} Instagram format\n- Each prompt must be detailed and self-contained for an AI image generator and should reference the provided reference image of the influencer to guarantee the visual alignment of the new image generation`,
    user: `Create ${slideCount} image generation prompts for a carousel about:\n\nTopic: "${idea.topic}"\n\nEach slide should be a visually distinct scene or moment that tells the story of this topic. Think about what a photographer or art director would frame for each image — different angles, locations, or moments within the same visual universe.\n\nIMPORTANT rules for every prompt:\n- Target ultra-realistic 4K photography quality — describe lighting, lens, camera settings, environment in detail\n- DO NOT describe the subject's physical appearance (face, body, skin tone, etc.) — reference images will be used for that\n- DO NOT use generic terms like "a figure", "a person", or "a silhouette" — always refer to the subject as "the subject from the reference image" so the identity remains clear and tied to the reference photo\n- Focus on: setting/environment, composition, camera angle, lighting quality, color palette, mood, time of day, textures, depth of field\n- NO placeholders of any kind — never write [location], [airport code], [text], or any bracketed instruction; always commit to a specific concrete detail\n\nReturn ONLY valid JSON (no markdown, no explanation outside the JSON):\n{\n  "slides": [\n    {\n      "position": 1,\n      "headline": "short overlay text for this slide",\n      "body": "1-2 supporting lines of text",\n      "prompt": "full detailed image generation prompt for this specific slide"\n    }\n  ]\n}`,
  }
}

// ── Image generation models (Google Nano Banana family) ──────────────────────
// Source: https://ai.google.dev/gemini-api/docs/image-generation
export const IMAGE_MODELS = [
  {
    id:    'gemini-2.5-flash-image',
    label: 'Nano Banana',
    sub:   'Fast · low-latency',
  },
  {
    id:    'gemini-3.1-flash-image-preview',
    label: 'Nano Banana 2',
    sub:   'Balanced · high volume',
  },
  {
    id:    'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro',
    sub:   'Pro · advanced reasoning',
  },
]
export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview'

// ── Generate a single slide image with optional reference images ──────────────
export async function generateSlideImage(apiKey, prompt, refImages = [], aspectRatio = '4:5', model = DEFAULT_IMAGE_MODEL) {
  if (!apiKey || !apiKey.startsWith('AIza')) {
    throw new Error('Invalid Gemini API key. Go to Settings.')
  }
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

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

// ── Topic list prompt ─────────────────────────────────────────────────────────
export function buildTopicListPrompt(inf, count = 10) {
  const persona = buildPersonaContext(inf)
  return {
    system: `You are a content strategist for this Instagram creator:\n\n${persona}\n\nGenerate carousel topic ideas that are authentic to their brand and highly shareable.`,
    user: `Generate ${count} carousel post topic ideas for this creator.\nEach topic should be a clear, specific, actionable idea — not vague.\n\nReturn ONLY valid JSON (no markdown, no explanation outside the JSON):\n{\n  "topics": [\n    "topic 1",\n    "topic 2"\n  ]\n}`,
  }
}

// ── Generate topic list via LLM ───────────────────────────────────────────────
export async function generateTopicList(apiKey, inf, count = 10, customPrompt) {
  const defaults = buildTopicListPrompt(inf, count)
  const system   = customPrompt?.system ?? defaults.system
  const user     = customPrompt?.user   ?? defaults.user
  const raw = await geminiText(apiKey, { system, user })
  const parsed = extractJSON(raw)
  const topics = Array.isArray(parsed) ? parsed : parsed.topics
  if (!Array.isArray(topics)) throw new Error('Unexpected response format from AI.')
  // Normalize: if Gemini returned objects instead of strings, extract the most meaningful field
  return topics.map(t =>
    typeof t === 'string' ? t : t.title || t.topic || t.text || t.description || JSON.stringify(t)
  )
}

// ── Simple Video Pipeline prompts ─────────────────────────────────────────────
export function buildVideoIdeaPrompt(inf) {
  const persona = buildPersonaContext(inf)
  return {
    system: `You are a creative video director for this Instagram creator:\n\n${persona}\n\nCreate short, visually striking 8-second single-shot video concepts that feel authentic to their brand.`,
    user: `Generate ONE compelling 8-second video concept for this creator.
It must be a single continuous shot — no cuts, no text overlays.
Focus on a simple but visually powerful moment.

Return ONLY valid JSON:
{
  "concept": "One clear sentence describing what happens in the video",
  "mood": "The visual mood/atmosphere (e.g. cinematic, dreamy, energetic, intimate)"
}`,
  }
}

export function buildVideoPromptsPrompt(inf, idea) {
  const persona = buildPersonaContext(inf)
  return {
    system: `You are a cinematographer and visual effects artist working for:\n\n${persona}`,
    user: `Create prompts for an 8-second video based on this concept:
"${idea.concept}"
Mood: ${idea.mood}

IMPORTANT rules for every frame prompt:
- Target ultra-realistic 4K photography/cinematography quality
- To reference the person, simply write "A woman (from the reference image)" — do NOT describe physical appearance (face, hair, body, skin tone, clothing, etc.)
- Focus on: setting/environment, composition, camera angle, lens, lighting quality, color palette, mood, time of day, textures, depth of field, background elements

Return ONLY valid JSON:
{
  "firstFramePrompt": "Detailed prompt for the very first frame. Describe environment, composition, camera, lighting, color palette. No physical appearance.",
  "lastFramePrompt": "Detailed prompt for the very last frame. Must be visually connected to the first frame — same scene, different moment. No physical appearance.",
  "motionPrompt": "Precise description of all motion between first and last frame: what moves, how, camera behavior, lighting changes. 2-3 sentences, cinematic."
}`,
  }
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

// ── Phase 4: Caption + Hashtags ───────────────────────────────────────────────
export function buildCaptionPrompt(inf, idea, hashtagCount = 5) {
  const persona = buildPersonaContext(inf)
  return {
    system: `You are a social media copywriter for this Instagram creator:\n\n${persona}\n\nWrite copy that feels authentic to their voice and resonates with their audience.`,
    user: `Write an Instagram caption and ${hashtagCount} hashtags for a carousel post about:\n\n"${idea.topic}"\n\nCaption rules:\n- Match the creator's tone of voice exactly\n- Engaging opening line that hooks the reader\n- 2-4 short paragraphs\n- End with a question or call-to-action to drive comments\n- Use line breaks for readability\n\nHashtag rules:\n- Mix of niche-specific, broad, and mid-range hashtags\n- No spaces within a hashtag\n\nReturn ONLY valid JSON (no markdown, no explanation outside the JSON):\n{\n  "caption": "the full caption text",\n  "hashtags": ["#tag1", "#tag2"]\n}`,
  }
}

export async function generateCaption(apiKey, inf, idea, hashtagCount = 5, customPrompt) {
  const defaults = buildCaptionPrompt(inf, idea, hashtagCount)
  const system   = customPrompt?.system ?? defaults.system
  const user     = customPrompt?.user   ?? defaults.user
  const raw = await geminiText(apiKey, { system, user })
  return extractJSON(raw)
}

// ── Phase 1: Auto-generate a carousel idea ────────────────────────────────────
// customPrompt: optional { system, user } override
export async function ideateCarousel(apiKey, inf, customPrompt) {
  const defaults = buildIdeationPrompt(inf)
  const system   = customPrompt?.system ?? defaults.system
  const user     = customPrompt?.user   ?? defaults.user
  const raw = await geminiText(apiKey, { system, user, temperature: 1.5 })
  return extractJSON(raw)
}

// ── Phase 2: Generate image prompts for each slide ────────────────────────────
// customPrompt: optional { system, user } override
export async function generateSlidePrompts(apiKey, inf, idea, slideCount, aspectRatio, customPrompt) {
  const defaults = buildSlidePromptsPrompt(inf, idea, slideCount, aspectRatio)
  const system   = customPrompt?.system ?? defaults.system
  const user     = customPrompt?.user   ?? defaults.user
  const raw = await geminiText(apiKey, { system, user })
  return extractJSON(raw)
}
