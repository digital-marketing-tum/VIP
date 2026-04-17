import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { fetchIgProfile, fetchIgMedia } from '../services/instagramGraph'

// ── Palette ──────────────────────────────────────────────────────────────────
const COLORS = ['#a78bfa','#60a5fa','#34d399','#fbbf24','#f472b6','#38bdf8','#fb923c','#c084fc']

// ── Shared icons ─────────────────────────────────────────────────────────────
const IgIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
  </svg>
)
const HeartIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)
const CommentIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

// ── Shared components ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon, sub, accent }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 140 }}>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon} {label}
        </span>
        <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', color: accent || 'var(--text)' }}>
          {value === null || value === undefined ? '—' : typeof value === 'string' ? value : Number(value).toLocaleString()}
        </span>
        {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -2 }}>{sub}</span>}
      </div>
    </div>
  )
}

function SectionTitle({ children, style }) {
  return (
    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', letterSpacing: '-0.2px', marginBottom: 14, ...style }}>
      {children}
    </div>
  )
}

function BarChart({ items, maxValue, height = 18 }) {
  const max = maxValue || Math.max(...items.map(i => i.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 110, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </div>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 5, height, overflow: 'hidden', minWidth: 0 }}>
            <div style={{
              width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%`,
              height: '100%',
              background: item.color,
              borderRadius: 5,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ width: 70, fontSize: 12, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>
            {item.format ? item.format(item.value) : item.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}

function LineChart({ series, height = 200 }) {
  if (!series.length) return null
  const allMonths = [...new Set(series.flatMap(s => s.points.map(p => p.month)))].sort()
  if (allMonths.length < 2) return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Not enough data to plot a trend.</div>
  )
  const allValues = series.flatMap(s => s.points.map(p => p.value))
  const maxVal = Math.max(...allValues, 1)
  const W = 600, H = height, PAD_L = 40, PAD_R = 16, PAD_T = 12, PAD_B = 32
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const xPos = month => PAD_L + (allMonths.indexOf(month) / (allMonths.length - 1)) * innerW
  const yPos = val => PAD_T + innerH - (val / maxVal) * innerH
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(t => ({ y: PAD_T + innerH * (1 - t), val: Math.round(maxVal * t) }))
  const labelStep = Math.ceil(allMonths.length / 8)
  const fmtMonth = m => { const [y, mo] = m.split('-'); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo-1]} ${y.slice(2)}` }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        {/* Grid */}
        {gridLines.map(gl => (
          <g key={gl.y}>
            <line x1={PAD_L} y1={gl.y} x2={W - PAD_R} y2={gl.y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 3" />
            <text x={PAD_L - 6} y={gl.y + 4} fill="var(--text-muted)" fontSize="9" textAnchor="end">{gl.val.toLocaleString()}</text>
          </g>
        ))}
        {/* X labels */}
        {allMonths.map((m, i) => i % labelStep === 0 && (
          <text key={m} x={xPos(m)} y={H - 4} fill="var(--text-muted)" fontSize="9" textAnchor="middle">{fmtMonth(m)}</text>
        ))}
        {/* Lines + dots */}
        {series.map(s => {
          const pts = allMonths.map(m => {
            const pt = s.points.find(p => p.month === m)
            return pt ? { x: xPos(m), y: yPos(pt.value), v: pt.value } : null
          })
          const segments = []
          let cur = []
          pts.forEach(p => {
            if (p) { cur.push(p) }
            else if (cur.length) { segments.push(cur); cur = [] }
          })
          if (cur.length) segments.push(cur)
          return (
            <g key={s.id}>
              {segments.map((seg, si) => seg.length > 1 && (
                <polyline key={si} points={seg.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
              ))}
              {pts.filter(Boolean).map((p, pi) => (
                <circle key={pi} cx={p.x} cy={p.y} r="3" fill={s.color} stroke="var(--surface)" strokeWidth="1.5" />
              ))}
            </g>
          )
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 8 }}>
        {series.map(s => (
          <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Dashboard view ────────────────────────────────────────────────────────────
function Dashboard({ influencers }) {
  const [data, setData] = useState({})  // { [infId]: { profile, media } | 'loading' | 'error:<msg>' }

  useEffect(() => {
    if (!influencers.length) return
    const init = {}
    influencers.forEach(inf => { init[inf.id] = 'loading' })
    setData(init)
    influencers.forEach(inf => {
      Promise.all([
        fetchIgProfile({ igUserId: inf.igUserId, accessToken: inf.accessToken }),
        fetchIgMedia({ igUserId: inf.igUserId, accessToken: inf.accessToken, limit: 100 }),
      ])
        .then(([profile, media]) => setData(prev => ({ ...prev, [inf.id]: { profile, media } })))
        .catch(err => setData(prev => ({ ...prev, [inf.id]: `error:${err.message}` })))
    })
  }, [influencers.map(i => i.id).join(',')])

  const ready = influencers
    .map((inf, idx) => {
      const d = data[inf.id]
      if (!d || typeof d !== 'object') return null
      const media = d.media || []
      const avgLikes    = media.length ? Math.round(media.reduce((s, p) => s + (p.like_count ?? 0), 0) / media.length) : 0
      const avgComments = media.length ? Math.round(media.reduce((s, p) => s + (p.comments_count ?? 0), 0) / media.length) : 0
      const engRate     = d.profile.followers_count
        ? +((media.reduce((s, p) => s + (p.like_count ?? 0) + (p.comments_count ?? 0), 0) / Math.max(media.length, 1)) / d.profile.followers_count * 100).toFixed(2)
        : 0
      const topPost     = media.reduce((best, p) => (p.like_count ?? 0) > (best?.like_count ?? -1) ? p : best, null)
      const monthBuckets = {}
      media.forEach(p => {
        if (!p.timestamp) return
        const mo = p.timestamp.slice(0, 7)
        if (!monthBuckets[mo]) monthBuckets[mo] = { sum: 0, count: 0 }
        monthBuckets[mo].sum += p.like_count ?? 0
        monthBuckets[mo].count++
      })
      const monthlyPoints = Object.entries(monthBuckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, { sum, count }]) => ({ month, value: Math.round(sum / count) }))
      return { id: inf.id, name: inf.name, color: COLORS[idx % COLORS.length], profile: d.profile, media, avgLikes, avgComments, engRate, monthlyPoints, topPost }
    })
    .filter(Boolean)

  const loading = influencers.some(inf => data[inf.id] === 'loading')
  const totalFollowers  = ready.reduce((s, r) => s + (r.profile.followers_count ?? 0), 0)
  const totalPosts      = ready.reduce((s, r) => s + r.media.length, 0)
  const bestEngaged     = ready.length ? ready.reduce((a, b) => a.engRate > b.engRate ? a : b) : null

  return (
    <>
      {loading && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          Loading all accounts…
        </div>
      )}

      {/* Errors */}
      {influencers.map(inf => typeof data[inf.id] === 'string' && data[inf.id].startsWith('error:') ? (
        <div key={inf.id} style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>
          {inf.name}: {data[inf.id].slice(6)}
        </div>
      ) : null)}

      {ready.length > 0 && (
        <>
          {/* ── Summary ── */}
          <SectionTitle>Overview</SectionTitle>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <StatCard
              label="Total followers"
              value={totalFollowers}
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>}
              sub={`across ${ready.length} account${ready.length > 1 ? 's' : ''}`}
            />
            <StatCard
              label="Posts analysed"
              value={totalPosts}
              icon={<IgIcon size={13} />}
              sub="last 100 per account"
            />
            {bestEngaged && (
              <StatCard
                label="Best engagement"
                value={bestEngaged.name}
                icon={<HeartIcon size={13} />}
                sub={`${bestEngaged.engRate}% eng. rate`}
                accent="var(--accent)"
              />
            )}
          </div>

          {/* ── Follower comparison ── */}
          <SectionTitle>Followers</SectionTitle>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <BarChart
                items={ready.sort((a, b) => b.profile.followers_count - a.profile.followers_count).map(r => ({
                  id: r.id, name: r.name, color: r.color,
                  value: r.profile.followers_count ?? 0,
                }))}
              />
            </div>
          </div>

          {/* ── Engagement comparison ── */}
          <SectionTitle>Engagement per post</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div className="card">
              <div className="card-body">
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <HeartIcon size={12} /> Avg likes / post
                </div>
                <BarChart
                  height={14}
                  items={ready.sort((a, b) => b.avgLikes - a.avgLikes).map(r => ({
                    id: r.id, name: r.name, color: r.color, value: r.avgLikes,
                  }))}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-body">
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CommentIcon size={12} /> Avg comments / post
                </div>
                <BarChart
                  height={14}
                  items={ready.sort((a, b) => b.avgComments - a.avgComments).map(r => ({
                    id: r.id, name: r.name, color: r.color, value: r.avgComments,
                  }))}
                />
              </div>
            </div>
          </div>

          {/* ── Engagement rate ── */}
          <SectionTitle>Engagement rate</SectionTitle>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <BarChart
                items={ready.sort((a, b) => b.engRate - a.engRate).map(r => ({
                  id: r.id, name: r.name, color: r.color, value: r.engRate,
                  format: v => `${v}%`,
                }))}
              />
            </div>
          </div>

          {/* ── Engagement over time ── */}
          <SectionTitle>Avg likes per post — over time</SectionTitle>
          <div className="card" style={{ marginBottom: 28 }}>
            <div className="card-body">
              <LineChart
                series={ready.map(r => ({ id: r.id, name: r.name, color: r.color, points: r.monthlyPoints }))}
              />
            </div>
          </div>

          {/* ── Top post per influencer ── */}
          <SectionTitle>Best performing post per account</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 8 }}>
            {ready.map(r => r.topPost ? (
              <a
                key={r.id}
                href={r.topPost.permalink}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'none', borderRadius: 12, overflow: 'hidden', border: `1px solid ${r.color}40`, display: 'block', background: 'var(--surface)' }}
              >
                {(r.topPost.media_url || r.topPost.thumbnail_url) && (
                  <div style={{ aspectRatio: '1', overflow: 'hidden', position: 'relative' }}>
                    <img
                      src={r.topPost.media_type === 'VIDEO' ? r.topPost.thumbnail_url : r.topPost.media_url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 20, background: r.color, color: 'white', fontSize: 11, fontWeight: 700 }}>
                      {r.name}
                    </div>
                  </div>
                )}
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <HeartIcon size={11} /> {(r.topPost.like_count ?? 0).toLocaleString()}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <CommentIcon size={11} /> {(r.topPost.comments_count ?? 0).toLocaleString()}
                    </span>
                  </div>
                  {r.topPost.caption && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {r.topPost.caption}
                    </div>
                  )}
                </div>
              </a>
            ) : null)}
          </div>
        </>
      )}
    </>
  )
}

// ── Per-influencer view ───────────────────────────────────────────────────────
function InfluencerView({ inf }) {
  const [profile, setProfile] = useState(null)
  const [media, setMedia]     = useState([])
  const [fetching, setFetching] = useState(false)
  const [error, setError]     = useState(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate,   setToDate]   = useState('')

  useEffect(() => {
    if (!inf) return
    setError(null)
    setProfile(null)
    setMedia([])
    setFetching(true)
    Promise.all([
      fetchIgProfile({ igUserId: inf.igUserId, accessToken: inf.accessToken }),
      fetchIgMedia({ igUserId: inf.igUserId, accessToken: inf.accessToken, limit: 100 }),
    ])
      .then(([prof, posts]) => {
        setProfile(prof)
        setMedia(posts)
        if (posts.length > 0) {
          const oldest = posts.map(p => p.timestamp).reduce((a, b) => a < b ? a : b)
          setFromDate(oldest.slice(0, 10))
          setToDate(new Date().toISOString().slice(0, 10))
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setFetching(false))
  }, [inf?.igUserId])

  const oldestDate = media.length > 0
    ? new Date(media.map(p => p.timestamp).reduce((a, b) => a < b ? a : b))
    : null

  const filteredMedia = media.filter(post => {
    if (!post.timestamp) return true
    const d = post.timestamp.slice(0, 10)
    if (fromDate && d < fromDate) return false
    if (toDate   && d > toDate)   return false
    return true
  })
  const postsInRange = filteredMedia.length
  const avgLikes     = postsInRange === 0 ? 0 : Math.round(filteredMedia.reduce((s, p) => s + (p.like_count ?? 0), 0) / postsInRange)
  const avgComments  = postsInRange === 0 ? 0 : Math.round(filteredMedia.reduce((s, p) => s + (p.comments_count ?? 0), 0) / postsInRange)

  if (fetching) return <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>Loading…</div>

  if (error) return (
    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#f87171' }}>
      <strong>API error:</strong> {error}
    </div>
  )

  if (!profile) return null

  return (
    <>
      {/* Profile header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {profile.profile_picture_url && (
            <img src={profile.profile_picture_url} alt={profile.username}
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{profile.name || profile.username}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>@{profile.username}</div>
            {profile.biography && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 420, lineHeight: 1.5 }}>
                {profile.biography}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard label="Followers" value={profile.followers_count}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>} />
        <StatCard label="Following" value={profile.follows_count}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>} />
        <StatCard label="Posts" value={profile.media_count} icon={<IgIcon size={13} />} />
      </div>

      {/* Date range */}
      {media.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            {oldestDate && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
                Active since{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {oldestDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </strong>
              </span>
            )}
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Date range</span>
            <input type="date" className="form-input" style={{ width: 150 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
            <input type="date" className="form-input" style={{ width: 150 }} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <StatCard label="Posts in range" value={postsInRange} icon={<IgIcon size={13} />} />
            <StatCard label="Avg likes"      value={avgLikes}     icon={<HeartIcon size={13} />} />
            <StatCard label="Avg comments"   value={avgComments}  icon={<CommentIcon size={13} />} />
          </div>

          {/* Posts grid */}
          <SectionTitle>Posts</SectionTitle>
          {filteredMedia.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>No posts in this date range.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {filteredMedia.map(post => (
                <a key={post.id} href={post.permalink} target="_blank" rel="noreferrer"
                  style={{ textDecoration: 'none', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', display: 'block', background: 'var(--surface)' }}>
                  {(post.media_url || post.thumbnail_url) && (
                    <div style={{ aspectRatio: '1', overflow: 'hidden' }}>
                      <img src={post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url} alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <HeartIcon size={11} /> {(post.like_count ?? 0).toLocaleString()}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CommentIcon size={11} /> {(post.comments_count ?? 0).toLocaleString()}
                      </span>
                    </div>
                    {post.caption && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {post.caption}
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Instagram({ onGoToSettings }) {
  const [influencers, setInfluencers] = useState([])
  const [activeTab,   setActiveTab]   = useState('dashboard')
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    supabase.from('influencers').select('id, name, accounts').order('name')
      .then(({ data }) => {
        const withIg = (data || [])
          .map(inf => {
            const igAcc = (inf.accounts || []).find(a => a.platform === 'ig')
            return igAcc?.ig_user_id && igAcc?.ig_access_token
              ? { id: inf.id, name: inf.name, igUserId: igAcc.ig_user_id, accessToken: igAcc.ig_access_token }
              : null
          })
          .filter(Boolean)
        setInfluencers(withIg)
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: 32 }}>Loading…</div>

  if (influencers.length === 0) {
    return (
      <div style={{ maxWidth: 480, padding: '48px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, color: 'var(--text-muted)' }}>
          <IgIcon size={20} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>No Instagram accounts linked</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
          Open an influencer → Account tab → fill in the <strong>Instagram User ID</strong> and <strong>Access Token</strong> fields.
        </p>
      </div>
    )
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    ...influencers.map(inf => ({ id: inf.id, label: inf.name })),
  ]

  const selectedInf = influencers.find(i => i.id === activeTab) || null

  return (
    <>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
              borderColor: activeTab === tab.id ? 'var(--accent)' : 'var(--border)',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              transition: 'all 0.12s',
            }}
          >
            {tab.id === 'dashboard' && (
              <span style={{ marginRight: 6, opacity: 0.8 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ verticalAlign: 'middle' }}>
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </span>
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'dashboard'
        ? <Dashboard influencers={influencers} />
        : <InfluencerView key={activeTab} inf={selectedInf} />
      }
    </>
  )
}
