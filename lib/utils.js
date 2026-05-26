export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// Gemini sometimes returns hashtags as one string with newlines/spaces.
// Flatten to a clean array of individual #tags.
export function normalizeHashtags(tags) {
  if (!Array.isArray(tags)) return []
  return tags
    .flatMap(t => t.split(/[\s\n]+/))
    .map(t => t.trim())
    .filter(t => t.startsWith('#'))
}
