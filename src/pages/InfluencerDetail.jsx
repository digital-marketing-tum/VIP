import { useState, useRef, useCallback, useEffect } from 'react'
import { Store } from '../store'
import { supabase } from '../supabase'
import { getToken, listFolders, savePostToDrive } from '../services/drive'
import { publishCarousel } from '../services/instagramGraph'

const PLATFORM_LABELS = { ig: 'Instagram', tt: 'TikTok', yt: 'YouTube' }

function downloadAllImages(slideImages) {
  slideImages.filter(img => img.src && img.status === 'done').forEach((img, i) => {
    setTimeout(() => {
      const a = document.createElement('a')
      a.href = img.src
      a.download = `slide-${img.position}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }, i * 150)
  })
}

function ExecutionTitleInput({ execution, onSave }) {
  const [val, setVal] = useState(execution.title)
  return (
    <input
      className="form-input"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
      style={{ fontWeight: 600, fontSize: 14, border: 'none', background: 'transparent', padding: '4px 0', boxShadow: 'none', outline: 'none', flex: 1 }}
      onFocus={e => { e.target.style.background = 'var(--surface2)' }}
    />
  )
}

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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
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
          {p === 'ig' && (
            <>
              <div className="form-group" style={{ marginTop: 4 }}>
                <label className="form-label">Instagram User ID</label>
                <input
                  className="form-input"
                  type="text"
                  value={get(p, 'ig_user_id')}
                  onChange={e => update(p, 'ig_user_id', e.target.value)}
                  placeholder="Numeric Business/Creator User ID"
                />
              </div>
              <div className="form-group" style={{ marginTop: 4 }}>
                <label className="form-label">Access Token</label>
                <input
                  className="form-input"
                  type="password"
                  value={get(p, 'ig_access_token')}
                  onChange={e => update(p, 'ig_access_token', e.target.value)}
                  placeholder="Long-lived user access token"
                />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Required to post via the Instagram Graph API
              </span>
            </>
          )}
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

// ── Schedule constants ────────────────────────────────────────────────────────
const DAYS = [
  { key: 'mon', label: 'Mon', full: 'Monday' },
  { key: 'tue', label: 'Tue', full: 'Tuesday' },
  { key: 'wed', label: 'Wed', full: 'Wednesday' },
  { key: 'thu', label: 'Thu', full: 'Thursday' },
  { key: 'fri', label: 'Fri', full: 'Friday' },
  { key: 'sat', label: 'Sat', full: 'Saturday' },
  { key: 'sun', label: 'Sun', full: 'Sunday' },
]
// backward compat: old slots stored 'morning'|'noon'|'evening'
const LEGACY_TIME = { morning: '09:00', noon: '12:00', evening: '18:00' }
const EMPTY_SCHEDULE = { mon:[], tue:[], wed:[], thu:[], fri:[], sat:[], sun:[] }

function normalizeTime(t) { return LEGACY_TIME[t] ?? t }

// ── SlotCard ──────────────────────────────────────────────────────────────────
function SlotCard({ slot, onRemove, onNavigate }) {
  const [hovered, setHovered] = useState(false)

  const isCarousel = slot.pipFormat === 'carousel'
  const isWorkflow = slot.pipFormat === 'workflow'
  const iconColor  = isCarousel ? 'var(--purple)' : isWorkflow ? 'var(--text-mid)' : 'var(--blue)'
  const bg         = isCarousel ? 'var(--purple-bg)' : isWorkflow ? 'var(--surface2)' : 'var(--blue-bg)'
  const border     = isCarousel ? 'rgba(124,58,237,0.18)' : isWorkflow ? 'var(--border)' : 'rgba(0,113,227,0.18)'
  const canNav     = !!onNavigate

  return (
    <div
      onClick={e => { e.stopPropagation(); onNavigate?.() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', background: bg, border: `1px solid ${hovered && canNav ? iconColor : border}`, borderRadius: 9, padding: '8px 10px', transition: 'box-shadow 0.12s, border-color 0.12s', boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.08)' : 'none', cursor: canNav ? 'pointer' : 'default' }}
    >
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        style={{
          position: 'absolute', top: 5, right: 5,
          width: 16, height: 16, borderRadius: '50%',
          background: 'rgba(0,0,0,0.18)', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0, transform: hovered ? 'scale(1)' : 'scale(0.6)',
          transition: 'opacity 0.12s, transform 0.12s', color: 'white',
        }}
      >
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: hovered ? 14 : 0, marginBottom: 5 }}>
        {slot.pipName}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.06)' }}>
          {isCarousel
            ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5"><rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/></svg>
            : isWorkflow
            ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            : <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          }
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: iconColor, letterSpacing: '0.02em' }}>
          {normalizeTime(slot.time)}
        </span>
      </div>
    </div>
  )
}

// ── AddSlotModal ──────────────────────────────────────────────────────────────
function AddSlotModal({ dayFull, allPipelines, onClose, onConfirm }) {
  const [selKey, setSelKey] = useState(allPipelines[0]?.key || null)
  const [time, setTime]     = useState('09:00')

  function handleConfirm() {
    const pip = allPipelines.find(p => p.key === selKey)
    if (!pip) return
    onConfirm({ pipName: pip.name, pipFormat: pip.format, pipId: pip.id ?? null, time })
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 380 }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.2px' }}>Schedule Post</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{dayFull}</div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {allPipelines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No pipelines yet. Create one in the Pipelines tab first.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Pipeline</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {allPipelines.map(p => {
                    const sel = selKey === p.key
                    const ic  = p.format === 'carousel' ? 'var(--purple)' : p.format === 'workflow' ? 'var(--text-mid)' : 'var(--blue)'
                    const ibg = p.format === 'carousel' ? 'var(--purple-bg)' : p.format === 'workflow' ? 'var(--surface2)' : 'var(--blue-bg)'
                    return (
                      <button
                        key={p.key}
                        onClick={() => setSelKey(p.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 11px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                          border: sel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                          background: sel ? 'var(--accent-bg)' : 'var(--surface)',
                          transition: 'all 0.1s',
                        }}
                      >
                        <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ibg }}>
                          {p.format === 'carousel'
                            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ic} strokeWidth="2"><rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/></svg>
                            : p.format === 'workflow'
                            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ic} strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ic} strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, textTransform: 'capitalize' }}>{p.format}</div>
                        </div>
                        {sel && <svg style={{ color: 'var(--accent)', flexShrink: 0 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Time</div>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '12px 20px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={!selKey}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ScheduleTab ───────────────────────────────────────────────────────────────
function ScheduleTab({ schedule, pipelines, workflows, carouselPips, onAddSlot, onRemoveSlot, onOpenCarousel, onOpenPipeline }) {
  const [addingDay, setAddingDay]   = useState(null)
  const [hoveredDay, setHoveredDay] = useState(null)

  const allPipelines = [
    ...pipelines.map((p, i)        => ({ key: `pip_${i}`,    name: p.name, format: p.format || 'carousel', id: null })),
    ...(carouselPips || []).map(cp => ({ key: `cp_${cp.id}`, name: cp.name, format: 'carousel',            id: cp.id })),
    ...workflows.map(w             => ({ key: `wf_${w.id}`,  name: w.name, format: 'workflow',             id: w.id })),
  ]

  function getNavigate(slot) {
    if (!slot.pipId) return undefined
    if (slot.pipFormat === 'carousel') return () => onOpenCarousel?.(slot.pipId)
    if (slot.pipFormat === 'workflow') return () => onOpenPipeline?.(slot.pipId)
    return undefined
  }

  const today  = new Date()
  const dow    = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))

  const weekDates = DAYS.map((_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  function isToday(date) {
    const t = new Date()
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear()
  }

  function addSlot(dayKey, slotData)    { onAddSlot(dayKey, slotData) }
  function removeSlot(dayKey, slotId)   { onRemoveSlot(dayKey, slotId) }

  const totalSlots = DAYS.reduce((n, d) => n + (schedule[d.key]?.length || 0), 0)

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px' }}>Weekly Schedule</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            {' – '}
            {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {totalSlots} post{totalSlots !== 1 ? 's' : ''} this week
        </div>
      </div>

      {/* Grid card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
          {DAYS.map((day, i) => {
            const date   = weekDates[i]
            const active = isToday(date)
            return (
              <div
                key={day.key}
                style={{
                  textAlign: 'center', padding: '12px 6px',
                  background: active ? 'var(--accent-bg)' : 'transparent',
                  borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {day.label}
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', margin: '4px auto 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'white' : 'var(--text)',
                }}>
                  {date.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Day columns body */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', alignItems: 'start' }}>
          {DAYS.map((day, i) => {
            const slots  = [...(schedule[day.key] || [])].sort((a, b) => normalizeTime(a.time).localeCompare(normalizeTime(b.time)))
            const active = isToday(weekDates[i])
            const isHov  = hoveredDay === day.key

            return (
              <div
                key={day.key}
                onClick={() => setAddingDay(day.key)}
                onMouseEnter={() => setHoveredDay(day.key)}
                onMouseLeave={() => setHoveredDay(null)}
                style={{
                  height: 220, padding: '10px 8px',
                  background: active ? 'rgba(0,113,227,0.025)' : 'transparent',
                  borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  cursor: 'pointer', transition: 'background 0.12s',
                  overflowY: 'auto',
                }}
              >
                {slots.map(slot => (
                  <SlotCard key={slot.id} slot={slot} onRemove={() => removeSlot(day.key, slot.id)} onNavigate={getNavigate(slot)} />
                ))}

                {/* Ghost add — only on hover, always at bottom */}
                <div style={{
                  marginTop: 'auto',
                  flexShrink: 0,
                  opacity: isHov ? 1 : 0,
                  transition: 'opacity 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '7px 0', borderRadius: 8,
                  border: `1.5px dashed ${isHov ? 'var(--accent)' : 'transparent'}`,
                  color: 'var(--accent)', fontSize: 11, fontWeight: 500,
                  background: isHov ? 'var(--accent-bg)' : 'transparent',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {addingDay && (
        <AddSlotModal
          dayFull={DAYS.find(d => d.key === addingDay)?.full}
          allPipelines={allPipelines}
          onClose={() => setAddingDay(null)}
          onConfirm={slotData => { addSlot(addingDay, slotData); setAddingDay(null) }}
        />
      )}
    </>
  )
}

// ── FieldCard ─────────────────────────────────────────────────────────────────
function FieldCard({ label, children }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 10,
      border: '1px solid var(--border)',
      padding: '14px 18px', marginBottom: 12,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}

// ── Save to Drive Modal ───────────────────────────────────────────────────────
const DriveIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 256 229" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M19.354,196.034 L30.644,215.535 C32.99,219.64 36.362,222.866 40.321,225.212 C51.66,210.818 59.553,199.773 64.001,192.075 C68.514,184.264 74.061,172.045 80.642,155.42 C62.906,153.085 49.466,151.918 40.321,151.918 C31.545,151.918 18.105,153.085 0,155.42 C0,159.965 1.173,164.51 3.519,168.616 Z" fill="#0066DA"/>
    <path d="M215.681,225.212 C219.64,222.866 223.013,219.64 225.358,215.535 L230.05,207.471 L252.484,168.616 C254.829,164.51 256.002,159.965 256.002,155.42 C237.793,153.085 224.377,151.918 215.755,151.918 C206.489,151.918 193.073,153.085 175.507,155.42 C182.01,172.136 187.484,184.355 191.929,192.075 C196.412,199.864 204.33,210.909 215.681,225.212 Z" fill="#EA4335"/>
    <path d="M128.001,73.311 C141.121,57.466 150.163,45.247 155.126,36.656 C159.123,29.738 163.522,18.692 168.322,3.519 C164.363,1.173 159.818,0 155.126,0 L100.876,0 C96.184,0 91.639,1.32 87.68,3.519 C93.786,20.921 98.968,33.306 103.224,40.673 C107.928,48.815 116.187,59.694 128.001,73.311 Z" fill="#00832D"/>
    <path d="M175.36,155.42 L80.642,155.42 L40.321,225.212 C44.28,227.558 48.825,228.731 53.517,228.731 L202.485,228.731 C207.177,228.731 211.723,227.411 215.681,225.212 Z" fill="#2684FC"/>
    <path d="M128.001,73.311 L87.68,3.519 C83.721,5.865 80.349,9.09 78.003,13.196 L3.519,142.224 C1.173,146.329 0,150.874 0,155.42 L80.642,155.42 Z" fill="#00AC47"/>
    <path d="M215.242,77.71 L177.999,13.196 C175.654,9.09 172.281,5.865 168.322,3.519 L128.001,73.311 L175.36,155.42 L255.856,155.42 C255.856,150.874 254.683,146.329 252.337,142.224 Z" fill="#FFBA00"/>
  </svg>
)

function SaveToDriveModal({ post, onClose }) {
  const [token,    setToken]    = useState(null)
  const [folders,  setFolders]  = useState([])
  const [path,     setPath]     = useState([{ id: 'root', name: 'My Drive' }])
  const [loading,  setLoading]  = useState(true)   // starts loading (auto-connect attempt)
  const [saving,   setSaving]   = useState(false)
  const [progress, setProgress] = useState('')
  const [doneUrl,  setDoneUrl]  = useState(null)
  const [error,    setError]    = useState('')

  const currentParent = path[path.length - 1]

  // Auto-connect on open using cache/silent — only shows popup if truly needed
  useEffect(() => {
    getToken().then(t => {
      setToken(t)
      return listFolders(t, 'root')
    }).then(list => {
      setFolders(list)
    }).catch(() => {
      // Silent failed — wait for user to click "Sign in"
    }).finally(() => setLoading(false))
  }, [])

  async function signIn() {
    setLoading(true); setError('')
    try {
      const t = await getToken(true)   // force interactive popup
      setToken(t)
      const list = await listFolders(t, 'root')
      setFolders(list)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadFolders(t, parentId) {
    setLoading(true)
    try {
      setFolders(await listFolders(t, parentId))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function navigate(folder) {
    setPath(p => [...p, { id: folder.id, name: folder.name }])
    await loadFolders(token, folder.id)
  }

  async function goBack(idx) {
    const newPath = path.slice(0, idx + 1)
    setPath(newPath)
    await loadFolders(token, newPath[newPath.length - 1].id)
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const url = await savePostToDrive(token, post, currentParent.id, msg => setProgress(msg))
      setDoneUrl(url)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <DriveIcon size={20} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Save to Google Drive</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{post.topic || post.title}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {doneUrl ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Saved successfully
              </div>
              <a href={doneUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ fontSize: 12 }}>
                Open in Drive
              </a>
            </div>
          ) : loading ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>Connecting…</div>
          ) : !token ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Sign in with Google to pick a folder.
              </div>
              {error && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{error}</div>}
              <button className="btn btn-primary" onClick={signIn}>
                Sign in with Google
              </button>
            </div>
          ) : (
            <>
              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {path.map((p, i) => (
                  <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {i > 0 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><polyline points="9 18 15 12 9 6"/></svg>}
                    <button
                      onClick={() => i < path.length - 1 && goBack(i)}
                      style={{ fontSize: 12, fontWeight: i === path.length - 1 ? 600 : 400, color: i === path.length - 1 ? 'var(--text)' : 'var(--accent)', background: 'none', border: 'none', cursor: i < path.length - 1 ? 'pointer' : 'default', padding: 0, fontFamily: 'inherit' }}
                    >{p.name}</button>
                  </span>
                ))}
              </div>

              {/* Folder list */}
              {loading ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Loading…</div>
              ) : folders.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>No sub-folders here.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
                  {folders.map(f => (
                    <button
                      key={f.id}
                      onClick={() => navigate(f)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#ffba00', flexShrink: 0 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      {f.name}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  ))}
                </div>
              )}

              {error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 10 }}>{error}</div>}
            </>
          )}
        </div>

        {/* Footer */}
        {token && !doneUrl && !loading && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Save into: <strong style={{ color: 'var(--text)' }}>{currentParent.name}</strong>
              </div>
              {saving && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>{progress}</div>}
            </div>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save here'}
            </button>
          </div>
        )}
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
export default function InfluencerDetail({ id, onBack, onOpenPipeline, onOpenCarousel, onOpenVideo, onNewNodePipeline }) {
  const [inf, setInf]           = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saved, setSaved]       = useState(true)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({})
  const [pipelines, setPipelines]       = useState([])
  const [accounts, setAccounts]         = useState([])
  const [workflows, setWorkflows]       = useState([])
  const [carouselPips, setCarouselPips] = useState([])
  const [videoPips, setVideoPips]       = useState([])
  const [showNewPipeline, setShowNewPipeline] = useState(false)
  const [creatingCarousel, setCreatingCarousel] = useState(false)
  const [creatingVideo, setCreatingVideo]       = useState(false)
  const [images, setImages]         = useState([])
  const [executions, setExecutions]   = useState([])
  const [schedule, setSchedule]       = useState(EMPTY_SCHEDULE)
  const [selectedPost, setSelectedPost] = useState(null)
  const [datePreset,   setDatePreset]   = useState('all')
  const [postedFilter, setPostedFilter] = useState('all')  // 'all' | 'posted' | 'not-posted'
  const [drivePost, setDrivePost] = useState(null)
  const [editImages, setEditImages] = useState([])
  const [igPosting, setIgPosting]   = useState(false)
  const [igStatus,  setIgStatus]    = useState(null)  // null | 'success' | error string
  const [cardIgState, setCardIgState] = useState({})  // { [exId]: null | 'posting' | 'error:<msg>' }
  const [activeTab, setActiveTab]   = useState('persona')
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
    supabase.from('schedule_slots').select('*')
      .eq('influencer_id', id)
      .then(({ data }) => {
        if (!data?.length) return
        const rebuilt = { mon:[], tue:[], wed:[], thu:[], fri:[], sat:[], sun:[] }
        for (const row of data) {
          rebuilt[row.day_key]?.push({ id: row.id, pipName: row.pip_name, pipFormat: row.pip_format, pipId: row.pip_id, time: row.time })
        }
        setSchedule(rebuilt)
      })
    supabase.from('workflows').select('id, name, nodes, updated_at')
      .eq('influencer_id', id).order('created_at').then(({ data }) => setWorkflows(data || []))
    supabase.from('carousel_pipelines').select('id, name, slide_count, aspect_ratio, updated_at')
      .eq('influencer_id', id).order('created_at', { ascending: false }).then(({ data }) => setCarouselPips(data || []))
    supabase.from('video_pipelines').select('id, name, updated_at')
      .eq('influencer_id', id).order('created_at', { ascending: false }).then(({ data }) => setVideoPips(data || []))
    supabase.from('carousel_executions').select('id, title, topic, images, created_at, posted, caption, hashtags')
      .eq('influencer_id', id).order('created_at', { ascending: false })
      .then(({ data }) => setExecutions(data || []))
  }, [id])

  useEffect(() => {
    setEditImages(selectedPost?.images || [])
    setIgStatus(null)
  }, [selectedPost?.id])

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

  async function deleteExecution(exId) {
    if (!confirm('Delete this post?')) return
    await supabase.from('carousel_executions').delete().eq('id', exId)
    setExecutions(prev => prev.filter(e => e.id !== exId))
    if (selectedPost?.id === exId) setSelectedPost(null)
  }

  async function persistSlides(newImages) {
    setEditImages(newImages)
    setSelectedPost(s => ({ ...s, images: newImages }))
    setExecutions(prev => prev.map(e => e.id === selectedPost.id ? { ...e, images: newImages } : e))
    await supabase.from('carousel_executions').update({ images: newImages }).eq('id', selectedPost.id)
  }

  function moveSlide(idx, dir) {
    const imgs = [...editImages]
    const to = idx + dir
    if (to < 0 || to >= imgs.length) return
    ;[imgs[idx], imgs[to]] = [imgs[to], imgs[idx]]
    persistSlides(imgs)
  }

  async function deleteSlide(idx) {
    if (!confirm('Remove this slide from the post?')) return
    persistSlides(editImages.filter((_, i) => i !== idx))
  }

  async function postToInstagram() {
    if (!editImages.length) return
    setIgPosting(true)
    setIgStatus(null)
    try {
      const igAcc = accounts.find(a => a.platform === 'ig')
      if (!igAcc?.ig_user_id)
        throw new Error('No Instagram User ID set for this influencer. Add it in the Account tab.')
      if (!igAcc?.ig_access_token)
        throw new Error('No access token set for this influencer. Add it in the Account tab.')
      const caption = [selectedPost.caption, (selectedPost.hashtags || []).join(' ')].filter(Boolean).join('\n\n')
      await publishCarousel({
        igUserId:    igAcc.ig_user_id,
        accessToken: igAcc.ig_access_token,
        imageUrls:   editImages.map(img => img.src),
        caption,
      })
      await supabase.from('carousel_executions').update({ posted: true }).eq('id', selectedPost.id)
      setSelectedPost(s => ({ ...s, posted: true }))
      setExecutions(prev => prev.map(e => e.id === selectedPost.id ? { ...e, posted: true } : e))
      setIgStatus('success')
    } catch (err) {
      setIgStatus(err.message)
    }
    setIgPosting(false)
  }

  async function postToInstagramCard(ex) {
    const images = (ex.images || []).filter(img => img.src)
    if (images.length < 2) {
      setCardIgState(s => ({ ...s, [ex.id]: 'error:At least 2 slides are required.' }))
      return
    }
    setCardIgState(s => ({ ...s, [ex.id]: 'posting' }))
    try {
      const igAcc = accounts.find(a => a.platform === 'ig')
      if (!igAcc?.ig_user_id)
        throw new Error('No Instagram User ID set. Add it in the Account tab.')
      if (!igAcc?.ig_access_token)
        throw new Error('No access token set. Add it in the Account tab.')
      const caption = [ex.caption, (ex.hashtags || []).join(' ')].filter(Boolean).join('\n\n')
      await publishCarousel({
        igUserId:    igAcc.ig_user_id,
        accessToken: igAcc.ig_access_token,
        imageUrls:   images.map(i => i.src),
        caption,
      })
      await togglePosted(ex.id, false)
      setCardIgState(s => ({ ...s, [ex.id]: null }))
    } catch (err) {
      setCardIgState(s => ({ ...s, [ex.id]: `error:${err.message}` }))
    }
  }

  async function updateTitle(exId, title) {
    setExecutions(prev => prev.map(e => e.id === exId ? { ...e, title } : e))
    await supabase.from('carousel_executions').update({ title }).eq('id', exId)
  }

  async function handleAddSlot(dayKey, slotData) {
    const slotId = Math.random().toString(36).slice(2, 9)
    const slot = { id: slotId, pipName: slotData.pipName, pipFormat: slotData.pipFormat, pipId: slotData.pipId ?? null, time: slotData.time }
    setSchedule(prev => ({ ...prev, [dayKey]: [...(prev[dayKey] || []), slot] }))
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('schedule_slots').insert({
      id:            slotId,
      influencer_id: id,
      user_id:       user.id,
      day_key:       dayKey,
      pip_name:      slotData.pipName,
      pip_format:    slotData.pipFormat,
      pip_id:        slotData.pipId ?? null,
      time:          slotData.time,
    })
  }

  async function handleRemoveSlot(dayKey, slotId) {
    setSchedule(prev => ({ ...prev, [dayKey]: (prev[dayKey] || []).filter(s => s.id !== slotId) }))
    await supabase.from('schedule_slots').delete().eq('id', slotId)
  }

  async function createCarouselPipeline() {
    setCreatingCarousel(true)
    const { data: { user } } = await supabase.auth.getUser()
    const n = carouselPips.length + 1
    const row = {
      id:             Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      influencer_id:  id,
      user_id:        user.id,
      name:           `Carousel #${n}`,
      idea_mode:      'auto',
      idea:           null,
      slide_count:    5,
      aspect_ratio:   '4:5',
      prompts_result: null,
      topic_list:     [],
      p1_prompt:      null,
      p2_prompt:      null,
    }
    const { data, error } = await supabase.from('carousel_pipelines').insert(row).select().single()
    setCreatingCarousel(false)
    if (error || !data) { console.error(error); return }
    setCarouselPips(prev => [data, ...prev])
    setShowNewPipeline(false)
    onOpenCarousel?.(data.id)
  }

  async function deleteCarouselPipeline(pipId) {
    if (!confirm('Delete this pipeline?')) return
    await supabase.from('carousel_pipelines').delete().eq('id', pipId)
    setCarouselPips(prev => prev.filter(p => p.id !== pipId))
  }

  async function createVideoPipeline() {
    setCreatingVideo(true)
    const { data: { user } } = await supabase.auth.getUser()
    const n = videoPips.length + 1
    const row = {
      id:            Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      influencer_id: id,
      user_id:       user.id,
      name:          `Video #${n}`,
      idea_mode:     'auto',
      idea:          null,
      prompts:       null,
    }
    const { data, error } = await supabase.from('video_pipelines').insert(row).select().single()
    setCreatingVideo(false)
    if (error || !data) { console.error(error); return }
    setVideoPips(prev => [data, ...prev])
    setShowNewPipeline(false)
    onOpenVideo?.(data.id)
  }

  async function deleteVideoPipeline(pipId) {
    if (!confirm('Delete this pipeline?')) return
    await supabase.from('video_pipelines').delete().eq('id', pipId)
    setVideoPips(prev => prev.filter(p => p.id !== pipId))
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
    { id: 'scheduling', label: 'Schedule',  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { id: 'posts',     label: 'Posts',     icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>, count: executions.length || null },
  ]

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', margin: '-28px -32px', minHeight: 'calc(100vh - 58px)' }}>

      {/* ── Header ── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '20px 32px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: color, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: 'white',
            }}>
              {images[0]
                ? <img src={images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : inf.name.charAt(0).toUpperCase()
              }
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>{inf.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {inf.niche && (
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--text-mid)', border: '1px solid var(--border)' }}>
                    {inf.niche}
                  </span>
                )}
                <span className={`badge ${inf.status}`}>{inf.status}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {carouselPips.length + videoPips.length + workflows.length} pipelines · {executions.length} posts
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
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ opacity: active ? 1 : 0.6 }}>{tab.icon}</span>
                  {tab.label}
                  {tab.count ? (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                      background: active ? 'var(--accent-bg)' : 'var(--surface2)',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
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
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, alignItems: 'start' }}>
            <div>
              <FieldCard label="Personality">
                <textarea className="form-textarea" value={form.personality} onChange={e => handleField('personality', e.target.value)} placeholder="Describe the influencer's personality traits..." style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none', resize: 'vertical', minHeight: 100 }} />
              </FieldCard>
              <FieldCard label="Visual Style">
                <textarea className="form-textarea" value={form.visualStyle} onChange={e => handleField('visualStyle', e.target.value)} placeholder="Aesthetic, color palette, lighting preferences..." style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none', resize: 'vertical', minHeight: 100 }} />
              </FieldCard>
            </div>
            <div>
              <FieldCard label="Tone of Voice">
                <input className="form-input" value={form.tone} onChange={e => handleField('tone', e.target.value)} placeholder="e.g. Playful and relatable, professional..." style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }} />
              </FieldCard>
              <FieldCard label="Target Audience">
                <input className="form-input" value={form.audience} onChange={e => handleField('audience', e.target.value)} placeholder="e.g. Women 18–28, fashion enthusiasts..." style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }} />
              </FieldCard>
              <FieldCard label="Topics to Avoid">
                <input className="form-input" value={form.avoid} onChange={e => handleField('avoid', e.target.value)} placeholder="e.g. Politics, explicit content, competitor brands..." style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }} />
              </FieldCard>
            </div>
          </div>
        )}

        {/* ── Account ── */}
        {activeTab === 'account' && (
          <AccountSection platforms={inf.platforms} accounts={accounts} onChange={handleAccountsChange} />
        )}

        {/* ── Reference Images ── */}
        {activeTab === 'images' && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px' }}>Reference Photos</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Used by AI pipelines to match visual style · {images.length} / 10
                </div>
              </div>
              {images.length > 0 && images.length < 10 && (
                <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} style={{ gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload
                </button>
              )}
            </div>

            {images.length === 0 ? (
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)', borderRadius: 16,
                  padding: '64px 24px', textAlign: 'center', cursor: 'pointer',
                  background: 'transparent', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <div style={{ width: 54, height: 54, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Add reference photos</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>Up to 10 images · JPG, PNG, WEBP</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', padding: '6px 16px', borderRadius: 20, background: 'var(--accent-bg)', border: '1px solid rgba(0,113,227,0.2)' }}>
                  Browse files
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {images.map((src, i) => {
                  const hovered = hoveredImg === i
                  return (
                    <div
                      key={i}
                      style={{ position: 'relative', paddingTop: '130%', borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface2)', transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: hovered ? 'var(--shadow-md)' : 'none', cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredImg(i)}
                      onMouseLeave={() => setHoveredImg(null)}
                    >
                      <img
                        src={src} alt=""
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.25s, filter 0.15s', transform: hovered ? 'scale(1.05)' : 'scale(1)', filter: hovered ? 'brightness(0.55)' : 'brightness(1)' }}
                      />
                      {/* Index badge */}
                      <div style={{ position: 'absolute', top: 8, left: 8, minWidth: 22, height: 22, borderRadius: 6, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', padding: '0 5px' }}>
                        {i + 1}
                      </div>
                      {/* Delete */}
                      <button
                        onClick={() => removeImage(i)}
                        style={{
                          position: 'absolute', top: 8, right: 8, width: 28, height: 28,
                          borderRadius: 8, border: 'none', background: 'rgba(15,15,15,0.7)',
                          color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backdropFilter: 'blur(4px)',
                          opacity: hovered ? 1 : 0, transform: hovered ? 'scale(1)' : 'scale(0.75)',
                          transition: 'opacity 0.15s, transform 0.15s',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                  )
                })}

                {/* Upload slot inside grid */}
                {images.length < 10 && (
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{
                      position: 'relative', paddingTop: '130%', borderRadius: 12,
                      border: '2px dashed var(--border)', background: 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Add photo</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleImageUpload(e.target.files)} />
          </>
        )}

        {/* ── Pipelines ── */}
        {activeTab === 'pipelines' && (
          <div>
            {(carouselPips.length === 0 && videoPips.length === 0 && workflows.length === 0) ? (
              <div className="empty-state" style={{ padding: '60px 20px' }}>
                <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                <div className="empty-title">No pipelines yet</div>
                <div className="empty-sub">Create your first pipeline to start generating content.</div>
                <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setShowNewPipeline(true)}>
                  New Pipeline
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {carouselPips.map(cp => (
                  <div
                    key={cp.id}
                    onClick={() => onOpenCarousel?.(cp.id)}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                      padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12,
                      cursor: 'pointer', transition: 'box-shadow 0.12s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--purple-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2">
                          <rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/>
                        </svg>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px 5px', color: 'var(--text-muted)' }}
                        onClick={e => { e.stopPropagation(); deleteCarouselPipeline(cp.id) }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{cp.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cp.slide_count} slides · {cp.aspect_ratio}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--purple-bg)', color: 'var(--purple)' }}>Carousel</span>
                      {cp.updated_at && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(cp.updated_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}

                {videoPips.map(vp => (
                  <div
                    key={vp.id}
                    onClick={() => onOpenVideo?.(vp.id)}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                      padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12,
                      cursor: 'pointer', transition: 'box-shadow 0.12s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                        </svg>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px 5px', color: 'var(--text-muted)' }}
                        onClick={e => { e.stopPropagation(); deleteVideoPipeline(vp.id) }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{vp.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>8-second · Veo 3</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Simple Video</span>
                      {vp.updated_at && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(vp.updated_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}

                {workflows.map(wf => (
                  <div
                    key={wf.id}
                    onClick={() => onOpenPipeline?.(wf.id)}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                      padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12,
                      cursor: 'pointer', transition: 'box-shadow 0.12s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                        </svg>
                      </div>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" style={{ marginTop: 6 }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{wf.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wf.nodes?.length || 0} nodes</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--blue-bg)', color: 'var(--blue)' }}>Node Workflow</span>
                      {wf.updated_at && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(wf.updated_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}

                {/* New Pipeline card */}
                <button
                  onClick={() => setShowNewPipeline(true)}
                  style={{
                    background: 'transparent', border: '2px dashed var(--border)', borderRadius: 14,
                    padding: '18px 16px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 10,
                    cursor: 'pointer', minHeight: 148, transition: 'all 0.12s', color: 'var(--text-muted)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px dashed currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>New Pipeline</span>
                </button>
              </div>
            )}

            {/* New Pipeline type picker */}
            {showNewPipeline && (
              <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowNewPipeline(false)}>
                <div className="modal" style={{ width: 480 }}>
                  <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px' }}>New Pipeline</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Choose a pipeline type to create</div>
                    </div>
                    <button className="close-btn" onClick={() => setShowNewPipeline(false)}>&#x2715;</button>
                  </div>
                  <div style={{ padding: '18px 22px 22px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>

                    {/* Carousel */}
                    <button
                      onClick={createCarouselPipeline}
                      disabled={creatingCarousel}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                        padding: '18px 12px', borderRadius: 12, cursor: creatingCarousel ? 'default' : 'pointer',
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        transition: 'all 0.12s', textAlign: 'center',
                      }}
                      onMouseEnter={e => { if (!creatingCarousel) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)' } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--purple-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.8">
                          <rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/>
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                          {creatingCarousel ? 'Creating…' : 'Carousel'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>AI image slides with caption</div>
                      </div>
                    </button>

                    {/* Simple Video */}
                    <button
                      onClick={createVideoPipeline}
                      disabled={creatingVideo}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                        padding: '18px 12px', borderRadius: 12, cursor: creatingVideo ? 'default' : 'pointer',
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        transition: 'all 0.12s', textAlign: 'center',
                      }}
                      onMouseEnter={e => { if (!creatingVideo) { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)' } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8">
                          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                          {creatingVideo ? 'Creating…' : 'Simple Video'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>8-second Veo 3 video</div>
                      </div>
                    </button>

                    {/* Node Workflow */}
                    <button
                      onClick={() => { setShowNewPipeline(false); onNewNodePipeline?.() }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                        padding: '18px 12px', borderRadius: 12, cursor: 'pointer',
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        transition: 'all 0.12s', textAlign: 'center',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>Node Workflow</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>Custom node-based pipeline</div>
                      </div>
                    </button>

                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Schedule ── */}
        {activeTab === 'scheduling' && (
          <ScheduleTab
            schedule={schedule}
            pipelines={pipelines}
            workflows={workflows}
            carouselPips={carouselPips}
            onAddSlot={handleAddSlot}
            onRemoveSlot={handleRemoveSlot}
            onOpenCarousel={onOpenCarousel}
            onOpenPipeline={onOpenPipeline}
          />
        )}

        {/* ── Posts ── */}
        {activeTab === 'posts' && (
          <div>
            {selectedPost ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPost(null)} style={{ gap: 5, paddingLeft: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    Posts
                  </button>
                  <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ExecutionTitleInput
                      execution={selectedPost}
                      onSave={title => { updateTitle(selectedPost.id, title); setSelectedPost(s => ({ ...s, title })) }}
                    />
                    {selectedPost.topic && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedPost.topic}</div>
                    )}
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
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => downloadAllImages(editImages.map(img => ({ ...img, status: 'done' })))}
                    style={{ gap: 6, flexShrink: 0 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Save All
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDrivePost(selectedPost)}
                    style={{ gap: 6, flexShrink: 0 }}
                  >
                    <DriveIcon size={14} />
                    Save in Drive
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={postToInstagram}
                    disabled={igPosting || editImages.length < 2}
                    style={{ gap: 6, flexShrink: 0 }}
                  >
                    {igPosting ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="40 20"/></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                    )}
                    {igPosting ? 'Posting…' : 'Post to Instagram'}
                  </button>
                </div>

                {igStatus === 'success' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', fontSize: 13, color: '#4ade80', marginBottom: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Posted to Instagram successfully!
                  </div>
                )}
                {igStatus && igStatus !== 'success' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 13, color: '#f87171', marginBottom: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {igStatus}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {editImages.map((img, idx) => (
                    <div key={img.src + idx} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ position: 'relative', paddingTop: '125%', background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img src={img.src} alt={`Slide ${idx + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />

                        {/* Position badge */}
                        <div style={{ position: 'absolute', top: 7, left: 7, width: 20, height: 20, borderRadius: 5, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>
                          {idx + 1}
                        </div>

                        {/* Controls: top-right cluster */}
                        <div style={{ position: 'absolute', top: 7, right: 7, display: 'flex', gap: 4 }}>
                          <button
                            title="Move up"
                            disabled={idx === 0}
                            onClick={() => moveSlide(idx, -1)}
                            style={{ width: 24, height: 24, borderRadius: 5, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', border: 'none', color: 'white', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
                          </button>
                          <button
                            title="Move down"
                            disabled={idx === editImages.length - 1}
                            onClick={() => moveSlide(idx, 1)}
                            style={{ width: 24, height: 24, borderRadius: 5, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', border: 'none', color: 'white', cursor: idx === editImages.length - 1 ? 'default' : 'pointer', opacity: idx === editImages.length - 1 ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          <button
                            title="Delete slide"
                            onClick={() => deleteSlide(idx)}
                            style={{ width: 24, height: 24, borderRadius: 5, background: 'rgba(180,0,0,0.65)', backdropFilter: 'blur(4px)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>

                        {/* Download */}
                        <a href={img.src} download={`slide-${idx + 1}.png`} style={{ position: 'absolute', bottom: 7, right: 7, width: 26, height: 26, borderRadius: 6, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedPost.caption && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Caption</span>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, gap: 5, padding: '3px 8px' }} onClick={() => navigator.clipboard.writeText(selectedPost.caption)}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
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
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
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
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>Posts</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 10 }}>
                      {executions.length === 0 ? 'No posts yet' : (
                        <>
                          <span style={{ color: '#4ade80' }}>{executions.filter(e => e.posted).length} posted</span>
                          <span>·</span>
                          <span>{executions.filter(e => !e.posted).length} not posted</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Posted filter */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[['all','All'],['posted','Posted'],['not-posted','Not posted']].map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setPostedFilter(val)}
                          style={{
                            padding: '4px 10px', borderRadius: 20, border: '1px solid',
                            fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            background: postedFilter === val ? 'var(--accent)' : 'transparent',
                            borderColor: postedFilter === val ? 'var(--accent)' : 'var(--border)',
                            color: postedFilter === val ? 'white' : 'var(--text-muted)',
                            transition: 'all 0.12s',
                          }}
                        >{label}</button>
                      ))}
                    </div>
                    <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
                    {/* Date filter */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[['all','All'],['7d','7d'],['30d','30d'],['3m','3m'],['1y','1y']].map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setDatePreset(val)}
                          style={{
                            padding: '4px 10px', borderRadius: 20, border: '1px solid',
                            fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            background: datePreset === val ? 'var(--accent)' : 'transparent',
                            borderColor: datePreset === val ? 'var(--accent)' : 'var(--border)',
                            color: datePreset === val ? 'white' : 'var(--text-muted)',
                            transition: 'all 0.12s',
                          }}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {executions.filter(e => {
                  const d = new Date(e.created_at), now = new Date()
                  if (datePreset === '7d')  { if (d < new Date(now - 7  * 864e5))  return false }
                  if (datePreset === '30d') { if (d < new Date(now - 30 * 864e5))  return false }
                  if (datePreset === '3m')  { if (d < new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()))  return false }
                  if (datePreset === '1y')  { if (d < new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())) return false }
                  if (postedFilter === 'posted')     return  e.posted
                  if (postedFilter === 'not-posted') return !e.posted
                  return true
                }).length === 0 && executions.length > 0 ? (
                  <div className="empty-state" style={{ padding: '40px 20px' }}>
                    <div className="empty-title" style={{ fontSize: 14 }}>No posts match this filter</div>
                    <div className="empty-sub">Try a different range or status.</div>
                  </div>
                ) : null}

                {executions.length === 0 ? (
                  <div className="empty-state" style={{ padding: '60px 20px' }}>
                    <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <div className="empty-title">No posts yet</div>
                    <div className="empty-sub">Run a carousel pipeline to generate your first post.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {executions.filter(e => {
                      const d = new Date(e.created_at), now = new Date()
                      if (datePreset === '7d')  { if (d < new Date(now - 7  * 864e5))  return false }
                      if (datePreset === '30d') { if (d < new Date(now - 30 * 864e5))  return false }
                      if (datePreset === '3m')  { if (d < new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()))  return false }
                      if (datePreset === '1y')  { if (d < new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())) return false }
                      if (postedFilter === 'posted')     return  e.posted
                      if (postedFilter === 'not-posted') return !e.posted
                      return true
                    }).map(ex => {
                      const thumb = ex.images?.[0]?.src
                      return (
                        <div
                          key={ex.id}
                          onClick={() => setSelectedPost(ex)}
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.12s' }}
                          onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                          <div style={{ position: 'relative', paddingTop: '75%', background: 'var(--surface2)' }}>
                            {thumb
                              ? <img src={thumb} alt={ex.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                </div>
                            }
                            <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 20, background: 'rgba(0,0,0,0.55)', color: 'white', backdropFilter: 'blur(4px)' }}>
                              {ex.images?.length || 0} slides
                            </div>
                          </div>
                          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.title}</div>
                                {ex.topic && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.topic}</div>}
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{new Date(ex.created_at).toLocaleDateString()}</div>
                              </div>
                              <button
                                className="btn btn-ghost btn-sm"
                                title="Save all images"
                                style={{ padding: '4px 6px', color: 'var(--text-muted)', flexShrink: 0 }}
                                onClick={e => { e.stopPropagation(); downloadAllImages((ex.images || []).map(img => ({ ...img, status: 'done' }))) }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                title="Save in Drive"
                                style={{ padding: '4px 6px', flexShrink: 0 }}
                                onClick={e => { e.stopPropagation(); setDrivePost(ex) }}
                              >
                                <DriveIcon size={13} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '4px 6px', color: 'var(--text-muted)', flexShrink: 0 }}
                                onClick={e => { e.stopPropagation(); deleteExecution(ex.id) }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
                                </svg>
                              </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                onClick={e => { e.stopPropagation(); togglePosted(ex.id, ex.posted) }}
                                style={{
                                  padding: '3px 9px', borderRadius: 20, border: '1px solid',
                                  fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                                  background: ex.posted ? 'rgba(74,222,128,0.12)' : 'transparent',
                                  borderColor: ex.posted ? '#4ade80' : 'var(--border)',
                                  color: ex.posted ? '#4ade80' : 'var(--text-muted)',
                                  transition: 'all 0.15s',
                                }}
                              >
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: ex.posted ? '#4ade80' : 'var(--text-muted)', flexShrink: 0 }} />
                                {ex.posted ? 'Posted' : 'Not posted'}
                              </button>
                              {!ex.posted && (
                                <button
                                  title="Post to Instagram"
                                  onClick={e => { e.stopPropagation(); if (cardIgState[ex.id] !== 'posting') postToInstagramCard(ex) }}
                                  disabled={cardIgState[ex.id] === 'posting'}
                                  style={{
                                    padding: '3px 6px', borderRadius: 20, border: '1px solid var(--border)',
                                    background: 'transparent', cursor: cardIgState[ex.id] === 'posting' ? 'default' : 'pointer',
                                    display: 'flex', alignItems: 'center', flexShrink: 0,
                                    color: cardIgState[ex.id]?.startsWith('error:') ? '#f87171' : 'var(--text-muted)',
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {cardIgState[ex.id] === 'posting' ? (
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                                      <circle cx="12" cy="12" r="10" strokeDasharray="40 20"/>
                                    </svg>
                                  ) : (
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                                    </svg>
                                  )}
                                </button>
                              )}
                            </div>
                            {cardIgState[ex.id]?.startsWith('error:') && (
                              <div style={{ fontSize: 10, color: '#f87171', marginTop: 2, lineHeight: 1.4 }}>
                                {cardIgState[ex.id].slice(6)}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>

    {drivePost && (
      <SaveToDriveModal
        post={drivePost}
        onClose={() => setDrivePost(null)}
      />
    )}
    </>
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
