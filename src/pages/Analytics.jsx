import { useState, useEffect } from 'react'
import { Store } from '../store'
import { supabase } from '../supabase'
import { fetchInstagramData } from '../services/instagram'


function proxyImg(url) {
  if (!url) return url
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}`
}

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function calcER(profile, media) {
  if (!profile.followers_count || !media.length) return 0
  const avgLikes    = media.reduce((s, p) => s + (p.like_count || 0), 0) / media.length
  const avgComments = media.reduce((s, p) => s + (p.comments_count || 0), 0) / media.length
  return ((avgLikes + avgComments) / profile.followers_count) * 100
}

// ── Donut ─────────────────────────────────────────────────────────────────────
const DONUT_COLORS = {
  active: '#1d1d1f',
  paused: '#aeaeb2',
  draft:  '#e5e5ea',
}

function renderDonutSegments(influencers) {
  const total    = influencers.length || 1
  const active   = influencers.filter(i => i.status === 'active').length
  const paused   = influencers.filter(i => i.status === 'paused').length
  const draft    = influencers.length - active - paused
  const segments = [
    { val: active, color: DONUT_COLORS.active },
    { val: paused, color: DONUT_COLORS.paused },
    { val: draft,  color: DONUT_COLORS.draft  },
  ]
  const r = 15.9155, circ = 100
  let offset = 25
  return segments.map((s, i) => {
    const pct = (s.val / total) * circ
    const el = (
      <circle key={i} cx="18" cy="18" r={r}
        fill="none" stroke={s.color} strokeWidth="3.5"
        strokeDasharray={`${pct} ${circ - pct}`}
        strokeDashoffset={100 - offset} strokeLinecap="round"
      />
    )
    offset -= pct
    return el
  })
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ values, width = 220, height = 36 }) {
  if (!values || values.length < 2) return null
  const max = Math.max(...values, 1)
  const pad = 2
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2)
    const y = pad + (1 - v / max) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <polyline fill="none" stroke="var(--text)" strokeWidth="1.5" strokeOpacity="0.5"
        strokeLinecap="round" strokeLinejoin="round" points={pts}
      />
    </svg>
  )
}

// ── IG Summary Row ────────────────────────────────────────────────────────────
function IgSummaryRow({ igInfluencers, igData }) {
  const loaded = igInfluencers.filter(inf => igData[inf.id]?.profile)
  if (!loaded.length) return null

  const totalReach = loaded.reduce((s, inf) => s + (igData[inf.id].profile.followers_count || 0), 0)

  const best = loaded.reduce((acc, inf) => {
    const er = calcER(igData[inf.id].profile, igData[inf.id].media)
    return er > acc.er ? { er, name: inf.name } : acc
  }, { er: 0, name: '—' })

  const topPost = loaded.flatMap(inf =>
    igData[inf.id].media.map(p => ({ ...p, infName: inf.name }))
  ).reduce((b, p) => (p.like_count > b.like_count ? p : b), { like_count: 0, infName: '—' })

  const items = [
    {
      label: 'Total Reach',
      value: fmt(totalReach),
      sub: `${loaded.length} account${loaded.length !== 1 ? 's' : ''}`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      label: 'Best Engagement',
      value: best.er.toFixed(2) + '%',
      sub: best.name,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
      ),
    },
    {
      label: 'Top Post',
      value: fmt(topPost.like_count) + ' likes',
      sub: topPost.infName,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ),
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
      {items.map(({ label, value, sub, icon }) => (
        <div key={label} style={{
          background: 'var(--surface2)', borderRadius: 12, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text-mid)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 3 }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── IG Comparison Chart ───────────────────────────────────────────────────────
function IgComparisonChart({ igInfluencers, igData }) {
  const loaded = igInfluencers.filter(inf => igData[inf.id]?.profile)
  if (loaded.length < 2) return null

  const maxFollowers = Math.max(...loaded.map(inf => igData[inf.id].profile.followers_count), 1)

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Audience Comparison
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loaded.map(inf => {
          const d   = igData[inf.id]
          const pct = (d.profile.followers_count / maxFollowers) * 100
          const er  = calcER(d.profile, d.media)

          return (
            <div key={inf.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 100, fontSize: 12, fontWeight: 600, color: 'var(--text)', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {inf.name}
              </div>
              <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: pct + '%',
                  background: 'var(--text)',
                  borderRadius: 99, transition: 'width 0.6s ease',
                  opacity: 0.75,
                }} />
              </div>
              <div style={{ width: 56, fontSize: 12, fontWeight: 600, color: 'var(--text)', textAlign: 'right', flexShrink: 0 }}>
                {fmt(d.profile.followers_count)}
              </div>
              <div style={{ width: 56, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
                {er.toFixed(1)}% ER
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Post Thumbnail ────────────────────────────────────────────────────────────
function PostThumbnail({ post, isTop }) {
  const [hover, setHover] = useState(false)
  const src = proxyImg(post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url)

  return (
    <div
      style={{
        position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
        background: 'var(--surface2)', cursor: 'pointer',
        outline: isTop ? '2px solid var(--text)' : 'none',
        outlineOffset: isTop ? '1px' : '0',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {src
        ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: '100%', height: '100%', background: 'var(--surface2)' }} />
      }

      {isTop && (
        <div style={{
          position: 'absolute', top: 5, left: 5,
          background: 'var(--text)', borderRadius: 4,
          padding: '2px 5px', fontSize: 9, fontWeight: 700,
          color: 'white', letterSpacing: '0.06em',
        }}>
          TOP
        </div>
      )}

      {post.media_type === 'VIDEO' && (
        <div style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.45)', borderRadius: 4, padding: '2px 5px' }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      )}

      {hover && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          borderRadius: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'white', fontSize: 11, fontWeight: 600 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {fmt(post.like_count)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'white', fontSize: 11, fontWeight: 600 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {fmt(post.comments_count)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stat Pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--surface2)', borderRadius: 10, padding: '10px 16px', minWidth: 72,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.3px' }}>{value}</span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  )
}

// ── IG Influencer Card ────────────────────────────────────────────────────────
function IgInfluencerCard({ inf, igData }) {
  const { profile, media } = igData

  const avgLikes    = media.length ? media.reduce((s, p) => s + (p.like_count || 0), 0) / media.length : 0
  const avgComments = media.length ? media.reduce((s, p) => s + (p.comments_count || 0), 0) / media.length : 0
  const er          = calcER(profile, media)
  const erStr       = profile.followers_count > 0 ? er.toFixed(2) + '%' : '—'

  const topPostId   = media.length ? media.reduce((b, p) => p.like_count > b.like_count ? p : b, media[0]).id : null
  const photoCount  = media.filter(p => p.media_type === 'IMAGE').length
  const videoCount  = media.filter(p => p.media_type === 'VIDEO').length

  const sparkValues = [...media].reverse().map(p => p.like_count)

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" style={{ background: inf.color, width: 40, height: 40, fontSize: 15, flexShrink: 0, borderRadius: 10 }}>
            {profile.profile_pic_url
              ? <img src={proxyImg(profile.profile_pic_url)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} alt="" />
              : inf.refImages?.[0]
                ? <img src={inf.refImages[0]} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} alt="" />
                : inf.name[0].toUpperCase()
            }
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
              {inf.name}
              {profile.is_verified && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--accent)">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                </svg>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{profile.username}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
          <StatPill label="Followers"    value={fmt(profile.followers_count)} />
          <StatPill label="Following"    value={fmt(profile.following_count)} />
          <StatPill label="Posts"        value={fmt(profile.media_count)} />
          <StatPill label="Avg Likes"    value={fmt(Math.round(avgLikes))} />
          <StatPill label="Avg Comments" value={fmt(Math.round(avgComments))} />
          <StatPill label="Engagement"   value={erStr} />
        </div>
      </div>

      {/* Posts grid + sparkline */}
      {media.length > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
            {media.map(post => (
              <PostThumbnail key={post.id} post={post} isTop={post.id === topPostId && post.like_count > 0} />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {photoCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  {photoCount} photo{photoCount !== 1 ? 's' : ''}
                </span>
              )}
              {videoCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  {videoCount} video{videoCount !== 1 ? 's' : ''}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                (last {media.length} posts)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Likes trend
              </span>
              <Sparkline values={sparkValues} />
            </div>
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>No posts found.</div>
      )}
    </div>
  )
}

// ── API Key Setup ─────────────────────────────────────────────────────────────
function ApiKeySetup({ onSave }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
        Enter your RapidAPI key to fetch Instagram analytics automatically.<br />
        Subscribe to <strong style={{ color: 'var(--text)' }}>Instagram Looter 2</strong> on RapidAPI — free tier available.
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          className="form-input" style={{ maxWidth: 420 }}
          placeholder="Paste your RapidAPI key here…"
          value={val}
          onChange={e => setVal(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={() => val.trim() && onSave(val.trim())}>
          Save & Connect
        </button>
      </div>
    </div>
  )
}

// ── IG Analytics Section ──────────────────────────────────────────────────────
function IgAnalyticsSection({ influencers }) {
  const [apiKey, setApiKey]       = useState('')
  const [igData, setIgData]       = useState({})
  const [editKey, setEditKey]     = useState(false)
  const [drafts, setDrafts]       = useState({}) // inf.id -> draft username string

  // Load key from Supabase on mount
  useEffect(() => {
    supabase.from('api_keys').select('rapid_key').single()
      .then(({ data }) => { if (data?.rapid_key) setApiKey(data.rapid_key) })
  }, [])

  function getConfiguredUsername(inf) {
    return inf.accounts?.find(a => a.platform === 'ig')?.username || ''
  }

  // Auto-fetch for influencers that already have a username in accounts
  useEffect(() => {
    if (!apiKey || !influencers.length) return
    influencers.forEach(inf => {
      const username = getConfiguredUsername(inf)
      if (!username) return
      if (igData[inf.id] !== undefined) return // already loading or loaded
      setIgData(prev => ({ ...prev, [inf.id]: null }))
      fetchInstagramData(username, apiKey)
        .then(data => {
          setIgData(prev => ({ ...prev, [inf.id]: data }))
          if (data?.profile?.media_count != null) {
            Store.update(inf.id, { postsGenerated: data.profile.media_count })
          }
        })
        .catch(err => setIgData(prev => ({ ...prev, [inf.id]: { error: err.message } })))
    })
  }, [apiKey, influencers.map(i => i.id + getConfiguredUsername(i)).join(',')])

  async function handleManualFetch(inf) {
    const username = (drafts[inf.id] || '').trim().replace(/^@/, '')
    if (!username) return
    // Save username to influencer accounts
    const accounts = inf.accounts || []
    const igAcc = accounts.find(a => a.platform === 'ig')
    const newAccounts = igAcc
      ? accounts.map(a => a.platform === 'ig' ? { ...a, username } : a)
      : [...accounts, { platform: 'ig', username }]
    Store.update(inf.id, { accounts: newAccounts })
    // Fetch
    setIgData(prev => ({ ...prev, [inf.id]: null }))
    fetchInstagramData(username, apiKey)
      .then(data => {
        setIgData(prev => ({ ...prev, [inf.id]: data }))
        if (data?.profile?.media_count != null) {
          Store.update(inf.id, { postsGenerated: data.profile.media_count })
        }
      })
      .catch(err => setIgData(prev => ({ ...prev, [inf.id]: { error: err.message } })))
  }

  async function saveKey(key) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('api_keys').upsert({ user_id: user.id, rapid_key: key, updated_at: new Date().toISOString() })
    setApiKey(key)
    setEditKey(false)
  }

  async function removeKey() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('api_keys').upsert({ user_id: user.id, rapid_key: '', updated_at: new Date().toISOString() })
    setApiKey('')
    setIgData({})
  }

  const loadedInfluencers = influencers.filter(inf => igData[inf.id]?.profile)
  const connectedCount = influencers.filter(inf => getConfiguredUsername(inf)).length

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-header">
        <span className="card-title">Instagram Analytics</span>
        {apiKey && !editKey && (
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {connectedCount} of {influencers.length} connected
            </span>
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setEditKey(true)}>
              Change key
            </button>
          </div>
        )}
      </div>
      <div className="card-body" style={{ paddingTop: 8 }}>
        {(!apiKey || editKey) && <ApiKeySetup onSave={saveKey} />}

        {apiKey && !editKey && influencers.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
            No influencers yet. Create one first.
          </div>
        )}

        {apiKey && !editKey && influencers.length > 0 && (
          <>
            <IgSummaryRow igInfluencers={loadedInfluencers} igData={igData} />
            <IgComparisonChart igInfluencers={loadedInfluencers} igData={igData} />

            {influencers.map(inf => {
              const d = igData[inf.id]
              const hasUsername = !!getConfiguredUsername(inf)

              // Not configured yet — show inline username input
              if (!hasUsername && d === undefined) return (
                <div key={inf.id} style={{ borderTop: '1px solid var(--border)', padding: '14px 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div className="avatar" style={{ background: inf.color, width: 32, height: 32, fontSize: 12, flexShrink: 0, borderRadius: 8 }}>
                    {inf.refImages?.[0]
                      ? <img src={inf.refImages[0]} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} alt="" />
                      : inf.name[0].toUpperCase()
                    }
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 13, minWidth: 80 }}>{inf.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No Instagram username set</span>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
                    <input
                      className="form-input"
                      style={{ width: 180, fontSize: 12, padding: '5px 10px' }}
                      placeholder="@username"
                      value={drafts[inf.id] || ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [inf.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleManualFetch(inf)}
                    />
                    <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => handleManualFetch(inf)}>
                      Load
                    </button>
                  </div>
                </div>
              )

              // Loading
              if (d === null || d === undefined) return (
                <div key={inf.id} style={{ padding: '14px 0', color: 'var(--text-muted)', fontSize: 13, borderTop: '1px solid var(--border)' }}>
                  Loading {inf.name}…
                </div>
              )

              // Error
              if (d.error) return (
                <div key={inf.id} style={{ padding: '14px 0', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <div className="avatar" style={{ background: inf.color, width: 28, height: 28, fontSize: 11 }}>
                    {inf.name[0].toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{inf.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--red)' }}>
                    {d.error.includes('401') || d.error.includes('403')
                      ? 'Invalid API key — check your RapidAPI key'
                      : `Error: ${d.error}`}
                  </span>
                  <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={removeKey}>
                    Reset key
                  </button>
                </div>
              )

              return <IgInfluencerCard key={inf.id} inf={inf} igData={d} />
            })}
          </>
        )}
      </div>
    </div>
  )
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ influencers }) {
  const values = influencers.map(inf => Math.max(inf.postsGenerated || 0, 0))
  const max    = Math.max(...values, 1)

  return (
    <div style={{ marginTop: 16 }}>
      {/* Grid lines */}
      <div style={{ position: 'relative', height: 120 }}>
        {[0.25, 0.5, 0.75, 1].map(t => (
          <div key={t} style={{
            position: 'absolute', bottom: `${t * 100}%`, left: 0, right: 0,
            borderTop: '1px solid var(--border)',
          }} />
        ))}
        {/* Bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: '100%', padding: '0 2px', position: 'relative', zIndex: 1 }}>
          {influencers.map((inf, idx) => {
            const h = max > 0 ? (values[idx] / max) * 100 : 8
            return (
              <div key={inf.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                <div style={{
                  width: '100%', maxWidth: 36,
                  height: `${Math.max(h, 5)}%`,
                  background: 'var(--text)',
                  opacity: inf.status === 'active' ? 0.8 : 0.15,
                  borderRadius: '4px 4px 0 0',
                  transition: 'opacity 0.15s',
                }} />
              </div>
            )
          })}
        </div>
      </div>
      {/* Labels */}
      <div style={{ display: 'flex', gap: 8, padding: '6px 2px 0' }}>
        {influencers.map(inf => (
          <div key={inf.id} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {inf.name.split(' ')[0].slice(0, 7)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [influencers, setInfluencers] = useState([])
  const [workflows, setWorkflows]     = useState([])

  useEffect(() => {
    Promise.all([
      Store.getAll(),
      supabase.from('workflows').select('id, name, influencer_id, nodes, updated_at').order('updated_at', { ascending: false }),
    ]).then(([infs, { data: wfRows }]) => {
      setInfluencers(infs)
      setWorkflows(wfRows || [])
    })
  }, [])

  if (influencers.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 40 }}>
        <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <div className="empty-title">No data yet</div>
        <div className="empty-sub">Analytics will populate once you create influencers and generate content.</div>
      </div>
    )
  }

  const active = influencers.filter(i => i.status === 'active').length
  const paused = influencers.filter(i => i.status === 'paused').length
  const draft  = influencers.length - active - paused
  const infMap = Object.fromEntries(influencers.map(i => [i.id, i]))

  return (
    <>
      <div className="section-header">
        <div className="section-sub">Performance overview across all influencers</div>
        <button className="btn btn-secondary btn-sm">Export CSV</button>
      </div>

      <div className="analytics-grid">

        {/* Status Distribution */}
        <div className="card">
          <div className="card-header"><span className="card-title">Status Distribution</span></div>
          <div className="card-body">
            <div className="donut-wrap">
              <div className="donut">
                <svg viewBox="0 0 36 36" width="90" height="90">
                  {renderDonutSegments(influencers)}
                </svg>
                <div className="donut-label">{influencers.length}</div>
              </div>
              <div className="donut-legend">
                {[
                  ['Active', DONUT_COLORS.active, active],
                  ['Paused', DONUT_COLORS.paused, paused],
                  ['Draft',  DONUT_COLORS.draft,  draft],
                ].map(([label, dotColor, count]) => (
                  <div key={label} className="legend-item">
                    <div className="legend-dot" style={{ background: dotColor, border: dotColor === DONUT_COLORS.draft ? '1px solid var(--border)' : 'none' }} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-mid)' }}>{label}</span>
                    <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Posts Generated */}
        <div className="card">
          <div className="card-header"><span className="card-title">Posts Generated</span></div>
          <div className="card-body">
            <BarChart influencers={influencers} />
          </div>
        </div>

        {/* Instagram Analytics — full width */}
        <IgAnalyticsSection influencers={influencers} />

        {/* Pipeline Overview */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header"><span className="card-title">Pipeline Overview</span></div>
          <div className="card-body" style={{ paddingTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Influencer</th><th>Pipeline</th><th>Nodes</th><th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map(wf => {
                  const inf = infMap[wf.influencer_id]
                  if (!inf) return null
                  return (
                    <tr key={wf.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar" style={{ background: inf.color, width: 24, height: 24, fontSize: 10, borderRadius: 6 }}>
                            {inf.refImages?.[0]
                              ? <img src={inf.refImages[0]} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} alt="" />
                              : inf.name[0].toUpperCase()
                            }
                          </div>
                          <span style={{ fontWeight: 500 }}>{inf.name}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{wf.name}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{wf.nodes?.length || 0} nodes</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(wf.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
                {workflows.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px 16px', fontSize: 13 }}>
                      No pipelines yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  )
}
