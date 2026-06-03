// ── Template resolver ─────────────────────────────────────────────────────────
function resolveTemplate(template, results) {
  if (!template) return ''
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const [nodeId, ...rest] = path.trim().split('.')
    const field = rest.join('.') || 'output'
    const val = results[nodeId]?.[field]
    return val !== undefined ? String(val) : match
  })
}

// ── Topological sort ──────────────────────────────────────────────────────────
function topoSort(nodes, edges) {
  const graph = {}, inDegree = {}
  for (const n of nodes) { graph[n.id] = []; inDegree[n.id] = 0 }
  for (const e of edges) {
    graph[e.source].push(e.target)
    inDegree[e.target] = (inDegree[e.target] || 0) + 1
  }
  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id)
  const order = []
  while (queue.length) {
    const id = queue.shift()
    order.push(id)
    for (const nb of graph[id]) {
      inDegree[nb]--
      if (inDegree[nb] === 0) queue.push(nb)
    }
  }
  return order
}

// ── Gemini text call ──────────────────────────────────────────────────────────
async function callGeminiText(apiKey, model, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const body = {
    contents: [{ parts: [{ text: userPrompt }] }],
  }
  if (systemPrompt?.trim()) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Gemini text error')
  return { output: data.candidates[0].content.parts[0].text, type: 'text' }
}

// ── Gemini image call (Nano Banana) ───────────────────────────────────────────
async function callGeminiImage(apiKey, model, prompt, config) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      imageConfig: {
        aspectRatio: config.aspectRatio || '9:16',
      },
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Gemini image error')

  const parts = data.candidates[0].content.parts
  const imgPart = parts.find(p => p.inlineData)
  if (!imgPart) throw new Error('No image returned')
  const { mimeType, data: b64 } = imgPart.inlineData
  return { output: `data:${mimeType};base64,${b64}`, type: 'image' }
}

// ── Execute single node ───────────────────────────────────────────────────────
async function executeNode(node, results, apiKeys) {
  if (node.type === 'trigger') {
    return { output: node.data.config?.input || '', type: 'text' }
  }
  if (node.type === 'llm') {
    const { model = 'gemini-2.5-flash', systemPrompt = '', prompt = '' } = node.data.config || {}
    const resolvedPrompt = resolveTemplate(prompt, results)
    const resolvedSystem = resolveTemplate(systemPrompt, results)
    return await callGeminiText(apiKeys.geminiKey, model, resolvedSystem, resolvedPrompt)
  }
  if (node.type === 'image_gen') {
    const { model = 'gemini-3.1-flash-image-preview', prompt = '', aspectRatio = '9:16' } = node.data.config || {}
    const resolvedPrompt = resolveTemplate(prompt, results)
    return await callGeminiImage(apiKeys.geminiKey, model, resolvedPrompt, { aspectRatio })
  }
  return { output: '', type: 'text' }
}

// ── Main executor ─────────────────────────────────────────────────────────────
export async function executeWorkflow(nodes, edges, apiKeys, onNodeUpdate) {
  const key = apiKeys.geminiKey
  if (!key) {
    throw new Error('Gemini API key not set. Go to Settings to add it.')
  }
  if (!key.startsWith('AIza')) {
    throw new Error('Invalid Gemini API key format. Go to Settings and enter the key from aistudio.google.com (starts with AIza…).')
  }
  const order = topoSort(nodes, edges)
  const results = {}

  for (const nodeId of order) {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) continue
    onNodeUpdate(nodeId, { status: 'running' })
    try {
      const result = await executeNode(node, results, apiKeys)
      results[nodeId] = result
      onNodeUpdate(nodeId, { status: 'success', ...result })
    } catch (err) {
      onNodeUpdate(nodeId, { status: 'error', error: err.message })
      throw err
    }
  }
  return results
}
