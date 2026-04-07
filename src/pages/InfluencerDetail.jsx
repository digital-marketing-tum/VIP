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

  return (
    <div style={{ display: 'flex', gap: 0, margin: '-28px -32px', minHeight: 'calc(100vh - 58px)' }}>
      {/* Left sidenav */}
      <nav className="detail-sidenav">
        <div className="detail-sidenav-profile">
          <div className="detail-sidenav-avatar" style={{ background: inf.color }}>
            {images[0]
              ? <img src={images[0]} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:12 }} alt="" />
              : inf.name.charAt(0).toUpperCase()
            }
          </div>
          <div className="detail-sidenav-name">{inf.name}</div>
          <div className="detail-sidenav-niche">{inf.niche || 'No niche set'}</div>
          <span className={`badge ${inf.status}`} style={{ marginTop: 6 }}>{inf.status}</span>
        </div>

        <div className="nav-label" style={{ marginTop: 4 }}>Sections</div>
        {[
          ['Account',         'section-account',  IconKey],
          ['Persona Context', 'section-persona',  IconPerson],
          ['Reference Images','section-images',   IconImage],
          ['Pipelines',       'section-pipelines',IconPipeline],
        ].map(([label, sectionId, Icon]) => (
          <div
            key={label}
            className="nav-item"
            style={{ fontSize: 13 }}
            onClick={() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <Icon />{label}
          </div>
        ))}
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', background: 'var(--bg)' }}>
        {/* Save bar */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <span style={{ fontSize:16, fontWeight:700, flex:1 }}>{inf.name}</span>
          {saved && (
            <span className="save-indicator show">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Saved
            </span>
          )}
          {!saved && <span style={{ fontSize:12, color:'var(--amber)', fontWeight:500 }}>Unsaved changes</span>}
          <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Account Credentials */}
        <Section id="section-account" title="Account" sub="Login credentials for each platform">
          <AccountSection
            platforms={inf.platforms}
            accounts={accounts}
            onChange={handleAccountsChange}
          />
        </Section>

        {/* Persona Context */}
        <Section id="section-persona" title="Persona Context" sub="Define personality, style, and target audience">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Personality</label>
              <textarea className="form-textarea" value={form.personality} onChange={e => handleField('personality', e.target.value)} placeholder="Describe the influencer's personality traits..." />
            </div>
            <div className="form-group">
              <label className="form-label">Visual Style</label>
              <textarea className="form-textarea" value={form.visualStyle} onChange={e => handleField('visualStyle', e.target.value)} placeholder="Aesthetic, color palette, lighting preferences..." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tone of Voice</label>
              <input className="form-input" value={form.tone} onChange={e => handleField('tone', e.target.value)} placeholder="e.g. Playful and relatable, professional..." />
            </div>
            <div className="form-group">
              <label className="form-label">Target Audience</label>
              <input className="form-input" value={form.audience} onChange={e => handleField('audience', e.target.value)} placeholder="e.g. Women 18–28, fashion enthusiasts..." />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Topics to Avoid</label>
            <input className="form-input" value={form.avoid} onChange={e => handleField('avoid', e.target.value)} placeholder="e.g. Politics, explicit content, competitor brands..." />
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: 8, display:'block' }}>Posting Frequency</label>
            <div className="freq-row">
              {[['freqIg','Instagram'],['freqTt','TikTok'],['freqYt','YouTube']].map(([key,label]) => (
                <div key={key} className="freq-group">
                  <label>{label}</label>
                  <input
                    className="form-input" style={{ width: 70 }}
                    value={form[key] || ''}
                    onChange={e => handleField(key, e.target.value)}
                    placeholder="0" type="number" min="0"
                  />
                  <span>/ week</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Reference Images */}
        <Section id="section-images" title="Reference Images" sub="Upload photos to define the visual identity">
          <div className="ref-images-grid">
            {images.map((src, i) => (
              <div key={i} className="ref-img-slot">
                <img src={src} alt="" />
                <button className="remove-img" onClick={() => removeImage(i)}>✕</button>
              </div>
            ))}
            {images.length < 10 && (
              <div className="ref-img-slot" onClick={() => fileRef.current?.click()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e => handleImageUpload(e.target.files)} />
        </Section>

        {/* Pipelines */}
        <Section id="section-pipelines" title="Pipelines" sub="AI content generation workflows" defaultOpen={true}>
          {/* Carousel Pipeline quick-access */}
          <div
            onClick={() => onNewCarousel?.()}
            style={{
              background: 'var(--accent-bg)', border: '1px solid #bfdbfe',
              borderRadius: 10, padding: '14px 18px', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-bg)'}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Carousel Pipeline</div>
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>Generate full AI carousels — idea → prompts → images</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>

          {/* Node-based workflows */}
          <div className="pipeline-list">
            {workflows.map(wf => (
              <div key={wf.id} className="pipeline-item">
                <div className="pipeline-type-icon video">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="17" x2="21" y2="17"/><line x1="17" y1="14" x2="17" y2="21"/>
                  </svg>
                </div>
                <div className="pipeline-info">
                  <div className="pipeline-name">{wf.name}</div>
                  <div className="pipeline-detail">
                    {wf.nodes?.length || 0} nodes · Updated {new Date(wf.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => onOpenPipeline?.(wf.id)}>
                  Open
                </button>
              </div>
            ))}
            {workflows.length === 0 && (
              <div style={{ color:'var(--text-muted)', fontSize:13, textAlign:'center', padding:'12px 0' }}>
                No node pipelines yet
              </div>
            )}
          </div>
          <button className="add-pipeline-btn" style={{ marginTop: 12 }} onClick={() => onNewPipeline?.()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Node Pipeline
          </button>
        </Section>

        {/* Posts */}
        {(() => {
          const postedCount    = executions.filter(e => e.posted).length
          const notPostedCount = executions.length - postedCount

          async function togglePosted(exId, current) {
            const posted = !current
            setExecutions(prev => prev.map(e => e.id === exId ? { ...e, posted } : e))
            if (selectedPost?.id === exId) setSelectedPost(s => ({ ...s, posted }))
            await supabase.from('carousel_executions').update({ posted }).eq('id', exId)
          }

          const sub = executions.length === 0
            ? 'No posts yet'
            : `${postedCount} posted · ${notPostedCount} not posted`

          if (selectedPost) {
            const imgs = selectedPost.images || []
            return (
              <Section id="section-posts" title="Posts" sub={sub} defaultOpen={true}>
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedPost(null)}
                    style={{ gap: 5, paddingLeft: 6 }}
                  >
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
                  {imgs.map(img => (
                    <div key={img.position} style={{ position: 'relative', paddingTop: '125%', background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={img.src} alt={`Slide ${img.position}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: 6, left: 6, width: 18, height: 18, borderRadius: 4, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white' }}>
                        {img.position}
                      </div>
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
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, gap: 5, padding: '3px 8px' }} onClick={() => navigator.clipboard.writeText(selectedPost.caption)}>
                        Copy
                      </button>
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
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, gap: 5, padding: '3px 8px' }} onClick={() => navigator.clipboard.writeText(selectedPost.hashtags.join(' '))}>
                        Copy all
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedPost.hashtags.map((tag, i) => (
                        <span key={i} style={{ background: 'var(--accent-bg)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )
          }

          return (
            <Section id="section-posts" title="Posts" sub={sub}>
              {executions.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  No posts yet — run a Carousel Pipeline to generate content.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {executions.map(ex => {
                    const thumb = ex.images?.[0]?.src
                    return (
                      <div
                        key={ex.id}
                        onClick={() => setSelectedPost(ex)}
                        style={{ background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', transition: 'box-shadow 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                      >
                        <div style={{ position: 'relative', paddingTop: '100%', background: 'var(--surface)' }}>
                          {thumb
                            ? <img src={thumb} alt={ex.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                              </div>
                          }
                          <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(0,0,0,0.55)', color: 'white' }}>
                            {ex.images?.length || 0}
                          </div>
                        </div>
                        <div style={{ padding: '8px 10px' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.title}</div>
                          {ex.topic && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.topic}</div>}
                          <div style={{ marginTop: 6 }}>
                            <button
                              onClick={e => { e.stopPropagation(); togglePosted(ex.id, ex.posted) }}
                              style={{
                                padding: '2px 8px', borderRadius: 20, border: '1px solid',
                                fontSize: 9, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: ex.posted ? 'rgba(74,222,128,0.12)' : 'transparent',
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
                      </div>
                    )
                  })}
                </div>
              )}
            </Section>
          )
        })()}
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
