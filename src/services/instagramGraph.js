const BASE = 'https://graph.instagram.com/v21.0'

export async function fetchIgProfile({ igUserId, accessToken }) {
  const fields = 'biography,followers_count,follows_count,media_count,name,profile_picture_url,username,website'
  const res = await fetch(
    `${BASE}/${igUserId}?fields=${fields}&access_token=${accessToken}`
  )
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data
}

export async function fetchIgMedia({ igUserId, accessToken, limit = 12 }) {
  const fields = 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink'
  const res = await fetch(
    `${BASE}/${igUserId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`
  )
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.data || []
}

export async function publishPhoto({ igUserId, accessToken, imageUrl, caption }) {
  const containerRes = await fetch(
    `${BASE}/${igUserId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${accessToken}`,
    { method: 'POST' }
  )
  const container = await containerRes.json()
  if (container.error) throw new Error(container.error.message)

  const publishRes = await fetch(
    `${BASE}/${igUserId}/media_publish?creation_id=${container.id}&access_token=${accessToken}`,
    { method: 'POST' }
  )
  const result = await publishRes.json()
  if (result.error) throw new Error(result.error.message)
  return result
}

async function waitForContainer(containerId, accessToken, { maxAttempts = 20, intervalMs = 3000 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    )
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    if (data.status_code === 'FINISHED') return
    if (data.status_code === 'ERROR')    throw new Error(`Container ${containerId} failed processing.`)
    if (data.status_code === 'EXPIRED')  throw new Error(`Container ${containerId} expired before publishing.`)
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error('Timed out waiting for Instagram to process media. Try again in a few seconds.')
}

export async function publishCarousel({ igUserId, accessToken, imageUrls, caption }) {
  if (imageUrls.length < 2 || imageUrls.length > 10)
    throw new Error('Instagram carousel requires 2–10 images.')

  // Step 1: create an item container for each image (sequentially to avoid rate limits)
  const childIds = []
  for (const url of imageUrls) {
    const res = await fetch(
      `${BASE}/${igUserId}/media?image_url=${encodeURIComponent(url)}&is_carousel_item=true&access_token=${accessToken}`,
      { method: 'POST' }
    )
    const data = await res.json()
    if (data.error) throw new Error(`Container error: ${data.error.message}`)
    childIds.push(data.id)
  }

  // Step 2: wait for all item containers to finish processing
  await Promise.all(childIds.map(id => waitForContainer(id, accessToken)))

  // Step 3: create carousel container
  const carouselRes = await fetch(
    `${BASE}/${igUserId}/media?media_type=CAROUSEL&caption=${encodeURIComponent(caption)}&children=${childIds.join(',')}&access_token=${accessToken}`,
    { method: 'POST' }
  )
  const carousel = await carouselRes.json()
  if (carousel.error) throw new Error(carousel.error.message)

  // Step 4: wait for carousel container to finish processing
  await waitForContainer(carousel.id, accessToken)

  // Step 5: publish
  const publishRes = await fetch(
    `${BASE}/${igUserId}/media_publish?creation_id=${carousel.id}&access_token=${accessToken}`,
    { method: 'POST' }
  )
  const result = await publishRes.json()
  if (result.error) throw new Error(result.error.message)
  return result
}
