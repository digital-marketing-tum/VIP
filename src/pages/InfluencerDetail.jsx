import { useState, useRef, useCallback, useEffect } from 'react'
import { Store } from '../store'
import { supabase } from '../supabase'

const PLATFORM_LABELS = { ig: 'Instagram', tt: 'TikTok', yt: 'YouTube' }

// ── Account Section ───────────────────────────────────────────────────────────
function AccountSection({ platforms, accounts, onChange }) {
  const [show, setShow] = useState({})

  function update(platform, field, value) {
    const existing = accounts.find(a => a.platform === platform) || { platform }
    const rest     = accounts.filter(a => a.platform !== platform)
    onChange([...rest, { ...existing, [field]: value }])
  }

  function get(platform, field) {
    return accounts.find(a => a.platform === platform)?.[field] || ''
  }

  if (!platforms?.length) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No platforms selected for this influencer.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {platforms.map(p => (
        <div key={p} style={{
          background: 'var(--surface2)', borderRadius: 12,
          border: '1px solid var(--border)', padding: '16px 18px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
            {PLATFORM_LABELS[p] || p}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                value={get(p, 'username')}
                onChange={e => update(p, 'username', e.target.value)}
                placeholder="@username"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={show[p] ? 'text' : 'password'}
                  value={get(p, 'password')}
                  onChange={e => update(p, 'password', e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingRight: 36 }}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => ({ ...s, [p]: !s[p] }))}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 0, display: 'flex',
                  }}
                >
                  {show[p]
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}


// ── Pipeline Modal ────────────────────────────────────────────────────────────
function PipelineModal({ onSave, onClose }) {
  const [name, setName]       = useState('')
  const [format, setFormat]   = useState('video')
  const [duration, setDur]    = useState('60')
  const [vstyle, setVstyle]   = useState('animated')
  const [slides, setSlides]   = useState('5')
  const [layout, setLayout]   = useState('editorial')
  const [idea, setIdea]       = useState('auto')
  const [brief, setBrief]     = useState('')

  function handleSave() {
    if (!name.trim()) return
    const pip = format === 'video'
      ? { name: name.trim(), format, duration, style: vstyle, idea, brief }
      : { name: name.trim(), format, slides, layout, idea, brief }
    onSave(pip)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Add Pipeline</div>
            <div className="modal-sub">Configure format, style, and idea generation</div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Pipeline Name</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekly Lifestyle Reel" />
            </div>
            <div className="form-group">
              <label className="form-label">Format</label>
              <div className="toggle-row">
                <button className={`toggle-btn ${format === 'video' ? 'active' : ''}`} onClick={() => setFormat('video')}>Video</button>
                <button className={`toggle-btn ${format === 'carousel' ? 'active' : ''}`} onClick={() => setFormat('carousel')}>Carousel</button>
              </div>
            </div>
          </div>

          {format === 'video' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Duration</label>
                <select className="form-select" value={duration} onChange={e => setDur(e.target.value)}>
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">60 seconds</option>
                  <option value="90">90 seconds</option>
                  <option value="180">3 minutes</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Video Style</label>
                <select className="form-select" value={vstyle} onChange={e => setVstyle(e.target.value)}>
                  <option value="animated">Image-to-Video (Animated)</option>
                  <option value="fullgen">Full AI Generation</option>
                  <option value="template">Template-Based</option>
                </select>
              </div>
            </div>
          )}

          {format === 'carousel' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Number of Slides</label>
                <select className="form-select" value={slides} onChange={e => setSlides(e.target.value)}>
                  <option value="3">3 slides</option>
                  <option value="5">5 slides</option>
                  <option value="7">7 slides</option>
                  <option value="10">10 slides</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Layout Style</label>
                <select className="form-select" value={layout} onChange={e => setLayout(e.target.value)}>
                  <option value="editorial">Editorial</option>
                  <option value="minimal">Minimal Text</option>
                  <option value="tutorial">Tutorial / Steps</option>
                </select>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Idea Generation</label>
            <div className="toggle-row" style={{ marginTop: 4 }}>
              <button className={`toggle-btn ${idea === 'auto' ? 'active' : ''}`} onClick={() => setIdea('auto')}>Automatic (LLM)</button>
              <button className={`toggle-btn ${idea === 'manual' ? 'active' : ''}`} onClick={() => setIdea('manual')}>Manual Brief</button>
            </div>
          </div>

          {idea === 'manual' && (
            <div className="form-group">
              <label className="form-label">Content Brief</label>
              <textarea className="form-textarea" value={brief} onChange={e => setBrief(e.target.value)} placeholder="Describe the content idea or theme..." style={{ minHeight: 70 }} />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Add Pipeline
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Collapsible Section ───────────────────────────────────────────────────────
function Section({ id, title, sub, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div id={id} className="detail-section">
      <div className="detail-section-header" onClick={() => setOpen(o => !o)}>
        <div>
          <div className="detail-section-title">{title}</div>
          {sub && <div className="detail-section-sub">{sub}</div>}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', flexShrink: 0, color: 'var(--text-muted)' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && <div className="detail-section-body">{children}</div>}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function InfluencerDetail({ id, onBack, onOpenPipeline, onNewPipeline, onNewCarousel }) {
  const [inf, setInf]           = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saved, setSaved]       = useState(true)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({})
  const [pipelines, setPipelines]   = useState([])
  const [accounts, setAccounts]     = useState([])
  const [workflows, setWorkflows]   = useState([])
  const [images, setImages]         = useState([])
  const [executions, setExecutions]   = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [activeTab, setActiveTab]   = useState('persona')
  const [postFilter, setPostFilter] = useState('all')
  const [hoveredImg, setHoveredImg] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    Store.get(id).then(data => {
      if (data) {
        setInf(data)
        setForm({
          personality: data.personality || '',
          visualStyle: data.visualStyle || '',
          tone:        data.tone        || '',
          audience:    data.audience    || '',
          avoid:       data.avoid       || '',
          freqIg:      data.freqIg      || '',
          freqTt:      data.freqTt      || '',
          freqYt:      data.freqYt      || '',
        })
        setPipelines(data.pipelines  || [])
        setAccounts(data.accounts    || [])
        setImages(data.refImages     || [])
      }
      setLoading(false)
    })
    supabase.from('workflows').select('id, name, nodes, updated_at')
      .eq('influencer_id', id).order('created_at').then(({ data }) => setWorkflows(data || []))
    supabase.from('carousel_executions').select('id, title, topic, images, created_at, posted, caption, hashtags')
      .eq('influencer_id', id).order('created_at', { ascending: false })
      .then(({ data }) => setExecutions(data || []))
  }, [id])

  const handleField = useCallback((key, val) => {
    setForm(f => ({ ...f, [key]: val }))
    setSaved(false)
  }, [])

  async function saveAll() {
    setSaving(true)
    await Store.update(id, { ...form, pipelines, accounts, refImages: images })
    setSaving(false)
    setSaved(true)
  }

  async function handleAccountsChange(next) {
    setAccounts(next)
    setSaved(false)
  }

  async function addPipeline(pip) {
    const next = [...pipelines, pip]
    setPipelines(next)
    await Store.update(id, { pipelines: next })
  }

  async function deletePipeline(i) {
    const next = pipelines.filter((_, idx) => idx !== i)
    setPipelines(next)
    await Store.update(id, { pipelines: next })
  }

  async function handleImageUpload(files) {
    const newImgs = []
    for (const f of Array.from(files)) {
      try { newImgs.push(await Store.uploadRefImage(f, id)) } catch {}
    }
    const next = [...images, ...newImgs]
    setImages(next)
    await Store.update(id, { refImages: next })
  }

  async function removeImage(i) {
    const next = images.filter((_, idx) => idx !== i)
    setImages(next)
    await Store.update(id, { refImages: next })
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding: 80, color:'var(--text-muted)', fontSize:14 }}>
        Loading...
      </div>
    )
  }

  if (!inf) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <div className="empty-title">Influencer not found</div>
        <div className="empty-sub">The ID doesn't match any saved influencer.</div>
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onBack}>Go back</button>
      </div>
    )
  }

  const postedCount    = executions.filter(e => e.posted).length
  const notPostedCount = executions.length - postedCount

  const filteredExecutions = postFilter === 'posted'
    ? executions.filter(e => e.posted)
    : postFilter === 'unposted'
    ? executions.filter(e => !e.posted)
    : executions

  async function togglePosted(exId, current) {
    const posted = !current
    setExecutions(prev => prev.map(e => e.id === exId ? { ...e, posted } : e))
    if (selectedPost?.id === exId) setSelectedPost(s => ({ ...s, posted }))
    await supabase.from('carousel_executions').update({ posted }).eq('id', exId)
  }

  // Derive a readable RGB from hex for CSS rgba() usage
  function hexAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16)
    const g = parseInt(hex.slice(3,5),16)
    const b = parseInt(hex.slice(5,7),16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  const color = inf.color || '#2563EB'

  const TABS = [
    { id: 'persona',   label: 'Persona',   icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
    { id: 'account',   label: 'Account',   icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L21 8l-3-3"/></svg> },
    { id: 'images',    label: 'Ref Images',icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
    { id: 'pipelines', label: 'Pipelines', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
    { id: 'posts',     label: 'Posts',     icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>, count: executions.length || null },
  ]

  // Field card — labeled block with influencer color left border
  function FieldCard({ label, children }) {
    return (
      <div style={{
        background: 'var(--surface)', borderRadius: '0 10px 10px 0',
        border: '1px solid var(--border)', borderLeft: `3px solid ${color}`,
        padding: '14px 18px', marginBottom: 12,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: hexAlpha(color, 0.9), textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
        {children}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', margin: '-28px -32px', minHeight: 'calc(100vh - 58px)' }}>

      {/* ── Hero Header ── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Color wash gradient */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(135deg, ${hexAlpha(color, 0.18)} 0%, transparent 55%)`,
        }} />
        {/* Thin top color bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />

        <div style={{ position: 'relative', padding: '22px 32px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
            {/* Avatar with color ring */}
            <div style={{
              width: 64, height: 64, borderRadius: 18, flexShrink: 0,
              background: color, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, color: 'white',
              boxShadow: `0 0 0 3px var(--surface), 0 0 0 5px ${hexAlpha(color, 0.45)}`,
            }}>
              {images[0]
                ? <img src={images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : inf.name.charAt(0).toUpperCase()
              }
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.15, letterSpacing: '-0.01em' }}>{inf.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                {inf.niche && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                    background: hexAlpha(color, 0.15), color: color, border: `1px solid ${hexAlpha(color, 0.3)}`,
                  }}>{inf.niche}</span>
                )}
                <span className={`badge ${inf.status}`}>{inf.status}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {workflows.length + (inf.pipelines?.length || 0)} pipelines · {executions.length} posts
                </span>
              </div>
            </div>

            {/* Save area */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {saved
                ? <span className="save-indicator show"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Saved</span>
                : <span style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 500 }}>Unsaved changes</span>
              }
              <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSelectedPost(null) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '9px 16px',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    color: active ? color : 'var(--text-muted)',
                    borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
                    transition: 'color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ opacity: active ? 1 : 0.6 }}>{tab.icon}</span>
                  {tab.label}
                  {tab.count ? (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                      background: active ? hexAlpha(color, 0.15) : 'var(--surface2)',
                      color: active ? color : 'var(--text-muted)',
                    }}>{tab.count}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', background: 'var(--bg)' }}>

        {/* ── Persona ── */}
        {activeTab === 'persona' && (
          <div style={{ maxWidth: 780 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 0 }}>
              <FieldCard label="Personality">
                <textarea className="form-textarea" value={form.personality} onChange={e => handleField('personality', e.target.value)} placeholder="Describe the influencer's personality traits..." style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none', resize: 'vertical', minHeight: 80 }} />
              </FieldCard>
              <FieldCard label="Visual Style">
                <textarea className="form-textarea" value={form.visualStyle} onChange={e => handleField('visualStyle', e.target.value)} placeholder="Aesthetic, color palette, lighting preferences..." style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none', resize: 'vertical', minHeight: 80 }} />
              </FieldCard>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FieldCard label="Tone of Voice">
                <input className="form-input" value={form.tone} onChange={e => handleField('tone', e.target.value)} placeholder="e.g. Playful and relatable, professional..." style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }} />
              </FieldCard>
              <FieldCard label="Target Audience">
                <input className="form-input" value={form.audience} onChange={e => handleField('audience', e.target.value)} placeholder="e.g. Women 18–28, fashion enthusiasts..." style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }} />
              </FieldCard>
            </div>
            <FieldCard label="Topics to Avoid">
              <input className="form-input" value={form.avoid} onChange={e => handleField('avoid', e.target.value)} placeholder="e.g. Politics, explicit content, competitor brands..." style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }} />
            </FieldCard>
            <FieldCard label="Posting Frequency">
              <div style={{ display: 'flex', gap: 24 }}>
                {[['freqIg','Instagram'],['freqTt','TikTok'],['freqYt','YouTube']].map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input className="form-input" style={{ width: 56, textAlign: 'center', border: 'none', background: 'var(--surface2)', padding: '4px 8px', boxShadow: 'none' }} value={form[key] || ''} onChange={e => handleField(key, e.target.value)} placeholder="0" type="number" min="0" />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ wk</span>
                    </div>
                  </div>
                ))}
              </div>
            </FieldCard>
          </div>
        )}

        {/* ── Account ── */}
        {activeTab === 'account' && (
          <div style={{ maxWidth: 640 }}>
            <AccountSection platforms={inf.platforms} accounts={accounts} onChange={handleAccountsChange} />
          </div>
        )}

        {/* ── Reference Images ── */}
        {activeTab === 'images' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
              {images.map((src, i) => {
                const hovered = hoveredImg === i
                return (
                  <div
                    key={i}
                    style={{ position: 'relative', paddingTop: '150%', borderRadius: 12, overflow: 'hidden', border: `1px solid ${hovered ? hexAlpha(color, 0.5) : 'var(--border)'}`, background: 'var(--surface)', transition: 'border-color 0.2s, box-shadow 0.2s', boxShadow: hovered ? `0 6px 20px rgba(0,0,0,0.35)` : 'none', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredImg(i)}
                    onMouseLeave={() => setHoveredImg(null)}
                  >
                    <img
                      src={src} alt=""
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s, filter 0.2s', transform: hovered ? 'scale(1.04)' : 'scale(1)', filter: hovered ? 'brightness(0.65)' : 'brightness(1)' }}
                    />
                    {/* Delete button — trash icon */}
                    <button
                      onClick={() => removeImage(i)}
                      style={{
                        position: 'absolute', top: 8, right: 8, width: 28, height: 28,
                        borderRadius: 8, border: 'none', background: 'rgba(15,15,15,0.75)',
                        color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(4px)',
                        opacity: hovered ? 1 : 0, transform: hovered ? 'scale(1)' : 'scale(0.8)',
                        transition: 'opacity 0.2s, transform 0.2s',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
            {images.length < 10 && (
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${hexAlpha(color, 0.4)}`, borderRadius: 12,
                  padding: '24px 20px', textAlign: 'center', cursor: 'pointer',
                  background: hexAlpha(color, 0.04), transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = hexAlpha(color, 0.08); e.currentTarget.style.borderColor = hexAlpha(color, 0.7) }}
                onMouseLeave={e => { e.currentTarget.style.background = hexAlpha(color, 0.04); e.currentTarget.style.borderColor = hexAlpha(color, 0.4) }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Upload reference photos</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{10 - images.length} slots remaining</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleImageUpload(e.target.files)} />
          </>
        )}

        {/* ── Pipelines ── */}
        {activeTab === 'pipelines' && (
          <>
            {/* Carousel Pipeline — glass card */}
            <div
              onClick={() => onNewCarousel?.()}
              style={{
                position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '18px 20px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                transition: 'transform 0.12s, box-shadow 0.12s',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)' }}
            >
              {/* Glow blob */}
              <div style={{ position: 'absolute', top: -20, right: 40, width: 120, height: 120, borderRadius: '50%', background: hexAlpha(color, 0.2), filter: 'blur(40px)', pointerEvents: 'none' }} />
              <div style={{
                width: 40, height: 40, borderRadius: 11, background: hexAlpha(color, 0.2),
                border: `1px solid ${hexAlpha(color, 0.3)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
                  <rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 3 }}>Carousel Pipeline</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>idea → prompts → images → caption</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>

            {/* Node workflows */}
            <div className="pipeline-list">
              {workflows.map(wf => (
                <div key={wf.id} className="pipeline-item" style={{ borderLeft: `3px solid ${hexAlpha(color, 0.5)}`, paddingLeft: 14, borderRadius: '0 8px 8px 0' }}>
                  <div className="pipeline-info">
                    <div className="pipeline-name">{wf.name}</div>
                    <div className="pipeline-detail">{wf.nodes?.length || 0} nodes · Updated {new Date(wf.updated_at).toLocaleDateString()}</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => onOpenPipeline?.(wf.id)}>Open</button>
                </div>
              ))}
              {workflows.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No node pipelines yet</div>
              )}
            </div>
            <button className="add-pipeline-btn" style={{ marginTop: 12 }} onClick={() => onNewPipeline?.()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Node Pipeline
            </button>
          </>
        )}

        {/* ── Posts ── */}
        {activeTab === 'posts' && (
          <>
            {selectedPost ? (
              <>
                <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPost(null)} style={{ gap: 5, paddingLeft: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    All Posts
                  </button>
                  <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedPost.title}</div>
                    {selectedPost.topic && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedPost.topic}</div>}
                  </div>
                  <button
                    onClick={() => togglePosted(selectedPost.id, selectedPost.posted)}
                    style={{
                      flexShrink: 0, padding: '4px 10px', borderRadius: 20, border: '1px solid',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      background: selectedPost.posted ? 'rgba(74,222,128,0.12)' : 'transparent',
                      borderColor: selectedPost.posted ? '#4ade80' : 'var(--border)',
                      color: selectedPost.posted ? '#4ade80' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedPost.posted ? '#4ade80' : 'var(--text-muted)', flexShrink: 0 }} />
                    {selectedPost.posted ? 'Posted' : 'Not posted'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                  {(selectedPost.images || []).map(img => (
                    <div key={img.position} style={{ position: 'relative', paddingTop: '125%', background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={img.src} alt={`Slide ${img.position}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: 6, left: 6, width: 18, height: 18, borderRadius: 4, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white' }}>{img.position}</div>
                      <a href={img.src} download={`slide-${img.position}.png`} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 5, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </a>
                    </div>
                  ))}
                </div>
                {selectedPost.caption && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Caption</span>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, gap: 5, padding: '3px 8px' }} onClick={() => navigator.clipboard.writeText(selectedPost.caption)}>Copy</button>
                    </div>
                    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6, border: '1px solid var(--border)' }}>
                      {selectedPost.caption}
                    </div>
                  </div>
                )}
                {selectedPost.hashtags?.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hashtags</span>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, gap: 5, padding: '3px 8px' }} onClick={() => navigator.clipboard.writeText(selectedPost.hashtags.join(' '))}>Copy all</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedPost.hashtags.map((tag, i) => (
                        <span key={i} style={{ background: 'var(--accent-bg)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Filter pills */}
                {executions.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
                    {[
                      { id: 'all',     label: `All (${executions.length})` },
                      { id: 'posted',  label: `Posted (${postedCount})` },
                      { id: 'unposted',label: `Not posted (${notPostedCount})` },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setPostFilter(f.id)}
                        style={{
                          padding: '5px 13px', borderRadius: 20, border: '1px solid',
                          fontSize: 12, fontWeight: postFilter === f.id ? 600 : 400,
                          cursor: 'pointer', transition: 'all 0.15s',
                          background: postFilter === f.id ? hexAlpha(color, 0.12) : 'transparent',
                          borderColor: postFilter === f.id ? hexAlpha(color, 0.5) : 'var(--border)',
                          color: postFilter === f.id ? color : 'var(--text-muted)',
                        }}
                      >{f.label}</button>
                    ))}
                  </div>
                )}

                {executions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.3, marginBottom: 12 }}>
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    <div style={{ fontSize: 13 }}>No posts yet — run a Carousel Pipeline to generate content.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
                    {filteredExecutions.map(ex => {
                      const thumb = ex.images?.[0]?.src
                      return (
                        <div
                          key={ex.id}
                          onClick={() => setSelectedPost(ex)}
                          style={{ background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', transition: 'transform 0.12s, box-shadow 0.12s' }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)' }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                        >
                          {/* Thumbnail — 4:5 ratio */}
                          <div style={{ position: 'relative', paddingTop: '125%', background: 'var(--surface2)' }}>
                            {thumb
                              ? <img src={thumb} alt={ex.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', opacity: 0.4 }}>
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                </div>
                            }
                            {/* Slide count badge */}
                            <div style={{ position: 'absolute', bottom: 7, right: 7, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(0,0,0,0.6)', color: 'white' }}>
                              {ex.images?.length || 0} slides
                            </div>
                            {/* Posted status dot */}
                            <div style={{
                              position: 'absolute', top: 7, left: 7,
                              width: 8, height: 8, borderRadius: '50%',
                              background: ex.posted ? '#4ade80' : 'rgba(255,255,255,0.25)',
                              border: '1.5px solid rgba(0,0,0,0.4)',
                              boxShadow: ex.posted ? '0 0 6px rgba(74,222,128,0.6)' : 'none',
                            }} />
                          </div>
                          {/* Info */}
                          <div style={{ padding: '9px 11px 11px' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.title}</div>
                            {ex.topic && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.topic}</div>}
                            {/* Posted toggle */}
                            <button
                              onClick={e => { e.stopPropagation(); togglePosted(ex.id, ex.posted) }}
                              style={{
                                marginTop: 8, padding: '3px 9px', borderRadius: 20, border: '1px solid',
                                fontSize: 9, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: ex.posted ? 'rgba(74,222,128,0.1)' : 'transparent',
                                borderColor: ex.posted ? '#4ade80' : 'var(--border)',
                                color: ex.posted ? '#4ade80' : 'var(--text-muted)',
                                transition: 'all 0.15s',
                              }}
                            >
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: ex.posted ? '#4ade80' : 'var(--text-muted)', flexShrink: 0 }} />
                              {ex.posted ? 'Posted' : 'Not posted'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>
  )
}

const IconKey = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L21 8l-3-3"/>
  </svg>
)
const IconPerson = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)
const IconImage = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)
const IconPipeline = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
)
