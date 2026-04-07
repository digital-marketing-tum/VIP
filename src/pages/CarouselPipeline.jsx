import { useState, useEffect, useRef } from 'react'
import { Store } from '../store'
import { supabase } from '../supabase'
import { uploadImage } from '../storage'
import { ideateCarousel, generateSlidePrompts, generateTopicList, generateSlideImage, generateCaption, buildIdeationPrompt, buildSlidePromptsPrompt, buildTopicListPrompt, buildCaptionPrompt } from '../services/generator'

// ── Supabase mappers ──────────────────────────────────────────────────────────
function fromDbPip(row) {
  return {
    id:            row.id,
    name:          row.name,
    ideaMode:      row.idea_mode,
    idea:          row.idea,
    slideCount:    row.slide_count,
    aspectRatio:   row.aspect_ratio,
    promptsResult: row.prompts_result,
    topicList:     row.topic_list || [],
    p1Prompt:      row.p1_prompt,
    p2Prompt:      row.p2_prompt,
    hashtagCount:  row.hashtag_count || 20,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  }
}

function toDbPip(pip) {
  return {
    name:           pip.name,
    idea_mode:      pip.ideaMode,
    idea:           pip.idea ?? null,
    slide_count:    pip.slideCount,
    aspect_ratio:   pip.aspectRatio,
    prompts_result: pip.promptsResult ?? null,
    topic_list:     pip.topicList || [],
    p1_prompt:      pip.p1Prompt ?? null,
    p2_prompt:      pip.p2Prompt ?? null,
    hashtag_count:  pip.hashtagCount || 20,
    updated_at:     new Date().toISOString(),
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

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

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    idle:    { label: 'Waiting', bg: 'var(--surface2)', color: 'var(--text-muted)' },
    loading: { label: 'Running', bg: '#fff8e1',         color: '#b45309'           },
    done:    { label: 'Done',    bg: 'var(--green-bg)', color: 'var(--green)'      },
    error:   { label: 'Error',   bg: 'var(--red-bg)',   color: 'var(--red)'        },
  }
  const { label, bg, color } = cfg[status] || cfg.idle
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: bg, color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {status === 'loading' && <SpinnerIcon size={10} />}
      {label}
    </span>
  )
}

function StepCircle({ n, done, active }) {
  const bg    = done ? 'var(--accent)' : active ? 'var(--text)' : 'var(--surface)'
  const color = (done || active) ? 'white' : 'var(--text-muted)'
  const border = (done || active) ? 'none' : '1.5px solid var(--border)'
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      background: bg, color, border,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, flexShrink: 0, zIndex: 1,
    }}>
      {done
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
        : n
      }
    </div>
  )
}

function ErrorBar({ msg, onRetry }) {
  return (
    <div style={{
      background: 'var(--red-bg)', border: '1px solid #fca5a5',
      borderRadius: 9, padding: '10px 14px', marginTop: 14,
      display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style={{ color: 'var(--red)', flex: 1 }}>{msg}</span>
      {onRetry && <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={onRetry}>Retry</button>}
    </div>
  )
}

function PhaseCard({ title, sub, status, locked, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden',
      opacity: locked ? 0.42 : 1,
      transition: 'opacity 0.2s',
      pointerEvents: locked ? 'none' : 'all',
    }}>
      <div
        style={{
          padding: '15px 20px', borderBottom: open ? '1px solid var(--border)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.2px' }}>{title}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusBadge status={locked ? 'idle' : status} />
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.18s' }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>
      {open && <div style={{ padding: 20 }}>{children}</div>}
    </div>
  )
}

function IdeaCard({ idea, onEdit }) {
  return (
    <div style={{
      background: 'var(--surface2)', borderRadius: 10,
      border: '1px solid var(--border)', borderLeft: '2px solid var(--accent)',
      padding: '14px 16px', marginTop: 16,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        Topic
      </div>
      <textarea
        className="form-textarea"
        value={idea.topic}
        onChange={e => onEdit({ ...idea, topic: e.target.value })}
        style={{ minHeight: 'auto', padding: '7px 10px', fontSize: 13, fontWeight: 500, resize: 'none', lineHeight: 1.5 }}
        rows={2}
      />
    </div>
  )
}

function SlideCard({ slide, visible }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{
      border: '1px solid var(--border)', background: 'var(--surface2)',
      borderRadius: 9, overflow: 'hidden',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.28s ease, transform 0.28s ease',
    }}>
      <div
        style={{ padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 5, background: 'var(--surface)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0,
        }}>
          {slide.position}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {slide.headline}
          </div>
          {slide.body && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {slide.body}
            </div>
          )}
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {expanded && (
        <div style={{ padding: '0 15px 13px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Image Prompt
          </div>
          <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 7, padding: '9px 11px', fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.7, fontFamily: 'monospace' }}>
            {slide.prompt}
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, fontSize: 11 }} onClick={() => navigator.clipboard.writeText(slide.prompt)}>
            Copy Prompt
          </button>
        </div>
      )}
    </div>
  )
}

function Stepper({ value, min, max, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden', width: 'fit-content' }}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        style={{
          width: 34, height: 34, border: 'none', borderRight: '1px solid var(--border)',
          background: 'var(--surface)', cursor: value > min ? 'pointer' : 'default',
          color: value > min ? 'var(--text)' : 'var(--text-muted)', fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'inherit',
        }}
      >−</button>
      <div style={{ minWidth: 38, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text)', padding: '0 6px', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {value}
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        style={{
          width: 34, height: 34, border: 'none', borderLeft: '1px solid var(--border)',
          background: 'var(--surface)', cursor: value < max ? 'pointer' : 'default',
          color: value < max ? 'var(--text)' : 'var(--text-muted)', fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'inherit',
        }}
      >+</button>
    </div>
  )
}

function RatioPicker({ value, onChange }) {
  const options = [
    { value: '4:5',  label: '4:5',  sub: 'Portrait' },
    { value: '1:1',  label: '1:1',  sub: 'Square'   },
    { value: '9:16', label: '9:16', sub: 'Story'     },
  ]
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid',
            background: value === o.value ? 'var(--text)' : 'var(--surface)',
            borderColor: value === o.value ? 'var(--text)' : 'var(--border)',
            color: value === o.value ? 'white' : 'var(--text-mid)',
            cursor: 'pointer', transition: 'all 0.12s', textAlign: 'center',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1 }}>{o.label}</div>
          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{o.sub}</div>
        </button>
      ))}
    </div>
  )
}

// ── Prompt Editor Card ────────────────────────────────────────────────────────
function PromptEditor({ prompt, onChange, onReset, open, onToggle }) {
  return (
    <div style={{ marginTop: 12 }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={onToggle}
        style={{ fontSize: 11, gap: 6, color: open ? 'var(--accent)' : 'var(--text-muted)' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        {open ? 'Hide prompt' : 'Edit prompt'}
      </button>

      {open && (
        <div style={{
          marginTop: 10, background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Prompt
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, color: 'var(--text-muted)' }}
              onClick={onReset}
            >
              Reset to default
            </button>
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* System */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: 11 }}>System</label>
              <textarea
                className="form-textarea"
                value={prompt.system}
                onChange={e => onChange({ ...prompt, system: e.target.value })}
                style={{ minHeight: 110, fontSize: 12, lineHeight: 1.65, fontFamily: 'monospace', resize: 'vertical' }}
              />
            </div>
            {/* User */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>User</label>
              <textarea
                className="form-textarea"
                value={prompt.user}
                onChange={e => onChange({ ...prompt, user: e.target.value })}
                style={{ minHeight: 180, fontSize: 12, lineHeight: 1.65, fontFamily: 'monospace', resize: 'vertical' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Topic List Panel ──────────────────────────────────────────────────────────
function TopicListPanel({ topics, onTopicsChange, geminiKey, inf }) {
  const [newText, setNewText]           = useState('')
  const [genCount, setGenCount]         = useState(10)
  const [genStatus, setGenStatus]       = useState('idle')
  const [genError, setGenError]         = useState('')
  const [genPrompt, setGenPrompt]       = useState(buildTopicListPrompt(inf, 10))
  const [genPromptOpen, setGenPromptOpen] = useState(false)

  const nextIdx = topics.findIndex(t => !t.used)

  function addManual() {
    if (!newText.trim()) return
    onTopicsChange([...topics, { id: Date.now().toString(36), text: newText.trim(), used: false }])
    setNewText('')
  }

  function deleteTopic(id) {
    onTopicsChange(topics.filter(t => t.id !== id))
  }

  function resetAll() {
    onTopicsChange(topics.map(t => ({ ...t, used: false, usedAt: undefined })))
  }

  async function generateList() {
    if (!geminiKey) { setGenError('No Gemini API key — go to Settings.'); return }
    setGenStatus('loading'); setGenError('')
    try {
      const result = await generateTopicList(geminiKey, inf, genCount, genPrompt)
      const newItems = result.map(text => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2,5), text, used: false }))
      onTopicsChange([...topics, ...newItems])
      setGenStatus('done')
    } catch (err) {
      setGenError(err.message); setGenStatus('error')
    }
  }

  const usedCount = topics.filter(t => t.used).length

  return (
    <div>
      {/* Topic list */}
      {topics.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Topics · {usedCount}/{topics.length} used
            </span>
            {usedCount > 0 && (
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--text-muted)' }} onClick={resetAll}>
                Reset used
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
            {topics.map((t, i) => {
              const isNext = i === nextIdx
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 11px', borderRadius: 8,
                    border: `1px solid ${isNext ? 'var(--accent)' : 'var(--border)'}`,
                    background: t.used ? 'transparent' : isNext ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'var(--surface2)',
                    opacity: t.used ? 0.45 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {/* Status dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: t.used ? 'var(--text-muted)' : isNext ? 'var(--accent)' : 'var(--border)',
                    border: t.used ? 'none' : isNext ? 'none' : '1.5px solid var(--text-muted)',
                  }} />
                  <span style={{
                    flex: 1, fontSize: 13, color: t.used ? 'var(--text-muted)' : 'var(--text)',
                    textDecoration: t.used ? 'line-through' : 'none',
                    lineHeight: 1.4,
                  }}>
                    {t.text}
                  </span>
                  {isNext && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em' }}>NEXT</span>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 4px', flexShrink: 0, color: 'var(--text-muted)' }}
                    onClick={() => deleteTopic(t.id)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{
          padding: '18px 16px', borderRadius: 9, border: '1px dashed var(--border)',
          textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 14,
        }}>
          No topics yet — add manually or generate with AI
        </div>
      )}

      {/* Add manually */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 16 }}>
        <input
          className="form-input"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addManual()}
          placeholder="Add a topic..."
          style={{ flex: 1, fontSize: 13 }}
        />
        <button className="btn btn-secondary btn-sm" onClick={addManual} disabled={!newText.trim()}>
          Add
        </button>
      </div>

      {/* AI generation section */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Generate with AI</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Count</span>
            <Stepper value={genCount} min={3} max={30} onChange={c => { setGenCount(c); setGenPrompt(buildTopicListPrompt(inf, c)) }} />
          </div>
          <button
            className="btn btn-primary"
            onClick={generateList}
            disabled={genStatus === 'loading'}
          >
            {genStatus === 'loading' ? <><SpinnerIcon /> Generating</> : 'Generate List'}
          </button>
        </div>
        <PromptEditor
          prompt={genPrompt}
          onChange={p => setGenPrompt(p)}
          onReset={() => setGenPrompt(buildTopicListPrompt(inf, genCount))}
          open={genPromptOpen}
          onToggle={() => setGenPromptOpen(o => !o)}
        />
        {genError && <ErrorBar msg={genError} onRetry={generateList} />}
      </div>
    </div>
  )
}

// ── Image Grid ────────────────────────────────────────────────────────────────
const AR_PADDING = { '4:5': '125%', '1:1': '100%', '9:16': '177.78%' }
const AR_COLS    = { '4:5': 2, '1:1': 3, '9:16': 2 }

function ImageGrid({ slideImages, slides, aspectRatio, onRegenerate, busy }) {
  const cols    = AR_COLS[aspectRatio] || 2
  const padTop  = AR_PADDING[aspectRatio] || '125%'

  return (
    <div style={{
      marginTop: 18,
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 10,
    }}>
      {slideImages.map(img => {
        const slide = slides.find(s => s.position === img.position)
        return (
          <div key={img.position} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Image box */}
            <div style={{
              position: 'relative', paddingTop: padTop,
              background: 'var(--surface2)', borderRadius: 10,
              border: '1px solid var(--border)', overflow: 'hidden',
            }}>
              {img.status === 'done' && img.src ? (
                <img
                  src={img.src}
                  alt={`Slide ${img.position}`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : img.status === 'loading' ? (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  color: 'var(--text-muted)',
                }}>
                  <SpinnerIcon size={20} />
                  <span style={{ fontSize: 11 }}>Generating…</span>
                </div>
              ) : img.status === 'error' ? (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: 12, textAlign: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ fontSize: 10, color: 'var(--red)', lineHeight: 1.4 }}>{img.error}</span>
                </div>
              ) : (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              )}

              {/* Slide number badge */}
              <div style={{
                position: 'absolute', top: 7, left: 7,
                width: 20, height: 20, borderRadius: 5,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'white',
              }}>
                {img.position}
              </div>

              {/* Download button (visible on hover via CSS-in-JS workaround) */}
              {img.status === 'done' && img.src && (
                <a
                  href={img.src}
                  download={`slide-${img.position}.png`}
                  style={{
                    position: 'absolute', top: 7, right: 7,
                    width: 26, height: 26, borderRadius: 6,
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', textDecoration: 'none',
                  }}
                  title="Download"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </a>
              )}
            </div>

            {/* Caption + regen */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {slide?.headline && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {slide.headline}
                  </div>
                )}
              </div>
              {slide && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 5px', flexShrink: 0, color: 'var(--text-muted)' }}
                  disabled={busy}
                  onClick={() => onRegenerate(slide)}
                  title="Regenerate this slide"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PersonaBar({ inf }) {
  const fields = [inf.niche, inf.tone && `Tone: ${inf.tone}`, inf.audience].filter(Boolean)
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '9px 14px', marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6, background: inf.color || 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: 10, flexShrink: 0,
      }}>
        {inf.name?.[0]?.toUpperCase()}
      </div>
      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{inf.name}</span>
      {fields.map((f, i) => (
        <span key={i} style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ opacity: 0.35 }}>·</span>{f}
        </span>
      ))}
      {!inf.personality && !inf.tone && !inf.audience && (
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--amber)', fontWeight: 500 }}>
          Add Persona Context for better results
        </span>
      )}
    </div>
  )
}

// ── Pipeline List View ────────────────────────────────────────────────────────
function PipelineStatusLabel({ pip }) {
  if (pip.promptsResult?.slides?.length) return (
    <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>
      {pip.promptsResult.slides.length} slides ready
    </span>
  )
  if (pip.idea) return (
    <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 500 }}>Idea ready</span>
  )
  return (
    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Empty</span>
  )
}

function ListView({ pips, onOpen, onCreate, onDelete, onOpenExecutions }) {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>Carousel Pipelines</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {pips.length === 0 ? 'No pipelines yet' : `${pips.length} pipeline${pips.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onOpenExecutions} style={{ gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            Posts
          </button>
          <button className="btn btn-primary" onClick={onCreate}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Carousel
          </button>
        </div>
      </div>

      {pips.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/>
          </svg>
          <div className="empty-title">No carousels yet</div>
          <div className="empty-sub">Create your first carousel pipeline to generate AI content for this influencer.</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onCreate}>New Carousel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pips.map(pip => (
            <div
              key={pip.id}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 14,
                cursor: 'pointer', transition: 'box-shadow 0.12s',
              }}
              onClick={() => onOpen(pip.id)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 9, background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-mid)" strokeWidth="1.8">
                  <rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{pip.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  <PipelineStatusLabel pip={pip} />
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>·</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(pip.updatedAt).toLocaleDateString()}
                  </span>
                  {pip.slideCount && (
                    <>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>·</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pip.slideCount} slides · {pip.aspectRatio}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: '5px 6px', flexShrink: 0 }}
                onClick={e => { e.stopPropagation(); onDelete(pip.id) }}
                title="Delete"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Editor View ───────────────────────────────────────────────────────────────
function EditorView({ pip, inf, geminiKey, onUpdate, onBack }) {
  // Phase 1 — settings persist, generated output always starts fresh
  const [ideaMode, setIdeaMode]   = useState(pip.ideaMode || 'auto')
  const [manualTopic, setManualTopic] = useState(pip.idea?.topic || '')
  const [p1Status, setP1Status]   = useState('idle')
  const [idea, setIdea]           = useState(null)
  const [p1Error, setP1Error]     = useState('')
  const [p1Prompt, setP1Prompt]   = useState(pip.p1Prompt || buildIdeationPrompt(inf))
  const [p1PromptOpen, setP1PromptOpen] = useState(false)

  // Topic list mode
  const [topicList, setTopicList] = useState(pip.topicList || [])

  // Phase 2 — settings persist, results start fresh
  const [slideCount, setSlideCount]   = useState(pip.slideCount || 5)
  const [aspectRatio, setAspectRatio] = useState(pip.aspectRatio || '4:5')
  const [p2Status, setP2Status]       = useState('idle')
  const [promptsResult, setPromptsResult] = useState(null)
  const [visibleSlides, setVisibleSlides] = useState(0)
  const [p2Error, setP2Error]         = useState('')
  const [p2Prompt, setP2Prompt]       = useState(null)
  const [p2PromptOpen, setP2PromptOpen] = useState(false)

  // Phase 3 — always fresh
  const [slideImages, setSlideImages] = useState([])
  const [p3Status, setP3Status]       = useState('idle')
  const [p3Error, setP3Error]         = useState('')

  // Phase 4 — caption + hashtags, always fresh
  const [p4Status, setP4Status]       = useState('idle')
  const [p4Error, setP4Error]         = useState('')
  const [captionResult, setCaptionResult] = useState(null)
  const [hashtagCount, setHashtagCount]   = useState(pip.hashtagCount || 20)

  // Pipeline name
  const [name, setName]               = useState(pip.name)
  const [workflowRunning, setWorkflowRunning] = useState(false)
  const [elapsed, setElapsed]         = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const staggerRef  = useRef(null)
  const timerRef    = useRef(null)
  const cancelRef   = useRef(false)
  const execKeyRef  = useRef(null)   // folder key for current execution's Storage files

  function startTimer() {
    setElapsed(0); setTimerActive(true)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }
  function stopTimer() {
    clearInterval(timerRef.current); setTimerActive(false)
  }

  // Compute p2 prompt (always from current slideCount/aspectRatio even without idea)
  const p2PromptDefault = buildSlidePromptsPrompt(inf, idea || { topic: '' }, slideCount, aspectRatio)
  const p2PromptDisplay = p2Prompt || p2PromptDefault

  // Auto-save helper
  function save(patch) {
    onUpdate({ ...pip, ...patch, updatedAt: new Date().toISOString() })
  }

  // ── Topic list helpers ─────────────────────────────────────────────────────
  function updateTopicList(next) {
    setTopicList(next)
    save({ topicList: next })
  }

  // ── Core executors (return result, throw on error) ─────────────────────────
  async function executePhase1() {
    if (!geminiKey) throw new Error('No Gemini API key — go to Settings.')
    setP1Status('loading'); setP1Error(''); setIdea(null)
    setP2Status('idle'); setPromptsResult(null); setVisibleSlides(0)

    let result
    if (ideaMode === 'auto') {
      result = await ideateCarousel(geminiKey, inf, p1Prompt)
      save({ idea: result, promptsResult: null, ideaMode: 'auto', p1Prompt, p2Prompt: null })
    } else if (ideaMode === 'manual') {
      if (!manualTopic.trim()) throw new Error('Enter a topic first.')
      result = { topic: manualTopic.trim() }
      save({ idea: result, promptsResult: null, ideaMode: 'manual', p2Prompt: null })
    } else if (ideaMode === 'list') {
      const next = topicList.find(t => !t.used)
      if (!next) throw new Error('All topics have been used. Add more or reset the list.')
      result = { topic: next.text }
      const updatedList = topicList.map(t => t.id === next.id ? { ...t, used: true, usedAt: new Date().toISOString() } : t)
      setTopicList(updatedList)
      save({ idea: result, promptsResult: null, ideaMode: 'list', topicList: updatedList, p2Prompt: null })
    }

    setP2Prompt(null)  // reset so p2PromptDisplay recomputes from the new idea
    setIdea(result)
    setP1Status('done')
    return result
  }

  async function executePhase2(ideaOverride) {
    const currentIdea = ideaOverride || idea
    if (!currentIdea?.topic) throw new Error('Generate an idea first.')
    if (!geminiKey) throw new Error('No Gemini API key — go to Settings.')
    const promptToUse = p2Prompt || buildSlidePromptsPrompt(inf, currentIdea, slideCount, aspectRatio)
    setP2Status('loading'); setP2Error(''); setPromptsResult(null); setVisibleSlides(0)
    if (staggerRef.current) clearInterval(staggerRef.current)
    const result = await generateSlidePrompts(geminiKey, inf, currentIdea, slideCount, aspectRatio, promptToUse)
    setPromptsResult(result); setP2Status('done')
    save({ promptsResult: result, slideCount, aspectRatio, p2Prompt: promptToUse })
    let count = 0
    staggerRef.current = setInterval(() => {
      count++; setVisibleSlides(count)
      if (count >= result.slides.length) clearInterval(staggerRef.current)
    }, 260)
    return result
  }

  // ── Phase 3 executor ──────────────────────────────────────────────────────
  async function executePhase3(slidesOverride) {
    const slides = slidesOverride || promptsResult?.slides
    if (!slides?.length) throw new Error('Generate slide prompts first.')
    if (!geminiKey) throw new Error('No Gemini API key — go to Settings.')
    const refImages = inf.refImages || []
    setP3Status('loading'); setP3Error('')
    const initial = slides.map(s => ({ position: s.position, src: null, status: 'loading', error: null }))
    setSlideImages(initial)
    const final = [...initial]

    // Generate a unique folder key for this execution's Storage files
    const { data: { user } } = await supabase.auth.getUser()
    const execKey = genId()
    execKeyRef.current = execKey
    const storageFolder = `${user.id}/${pip.id}/${execKey}`

    for (const slide of slides) {
      if (cancelRef.current) {
        for (let i = final.findIndex(img => img.position === slide.position); i < final.length; i++) {
          final[i] = { ...final[i], status: 'idle' }
        }
        setSlideImages([...final])
        break
      }
      const idx = final.findIndex(img => img.position === slide.position)
      try {
        const base64 = await generateSlideImage(geminiKey, slide.prompt, refImages, aspectRatio)
        const src = await uploadImage(base64, 'carousel-images', `${storageFolder}/slide-${slide.position}`)
        final[idx] = { ...final[idx], src, status: 'done' }
      } catch (err) {
        final[idx] = { ...final[idx], status: 'error', error: err.message }
      }
      setSlideImages([...final])
    }
    setP3Status(cancelRef.current ? 'idle' : 'done')
    return final
  }

  async function saveExecution(images, capData = null) {
    const doneImages = images.filter(img => img.status === 'done' && img.src)
    if (!doneImages.length) return
    const { data: { user } } = await supabase.auth.getUser()
    const { count } = await supabase
      .from('carousel_executions')
      .select('*', { count: 'exact', head: true })
      .eq('influencer_id', inf.id)
    const { data: inserted } = await supabase.from('carousel_executions').insert({
      id:             genId(),
      pipeline_id:    pip.id,
      influencer_id:  inf.id,
      user_id:        user.id,
      title:          `Post #${(count || 0) + 1}`,
      topic:          idea?.topic || '',
      images:         doneImages.map(img => ({ position: img.position, src: img.src })),
      caption:        capData?.caption  || null,
      hashtags:       capData?.hashtags || null,
    }).select('id').single()
    return inserted?.id
  }

  // ── Phase 4 executor ──────────────────────────────────────────────────────
  async function executePhase4() {
    if (!idea) throw new Error('Generate an idea first (Phase 1).')
    if (!geminiKey) throw new Error('No Gemini API key — go to Settings.')
    setP4Status('loading'); setP4Error('')
    const result = await generateCaption(geminiKey, inf, idea, hashtagCount)
    setCaptionResult(result)
    setP4Status('done')
    return result
  }

  async function regenerateSingleImage(slide) {
    const refImages = inf.refImages || []
    setSlideImages(prev => prev.map(img =>
      img.position === slide.position ? { ...img, status: 'loading', error: null } : img
    ))
    try {
      const base64 = await generateSlideImage(geminiKey, slide.prompt, refImages, aspectRatio)
      // Upload — reuse the same execKey so it overwrites the existing file
      const { data: { user } } = await supabase.auth.getUser()
      const execKey = execKeyRef.current || genId()
      const src = await uploadImage(base64, 'carousel-images', `${user.id}/${pip.id}/${execKey}/slide-${slide.position}`)
      setSlideImages(prev => prev.map(img =>
        img.position === slide.position ? { ...img, src, status: 'done' } : img
      ))
      // Update the latest execution for this pipeline in Supabase
      const { data: latestExec } = await supabase
        .from('carousel_executions')
        .select('id, images')
        .eq('pipeline_id', pip.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (latestExec) {
        const updatedImages = (latestExec.images || []).map(img =>
          img.position === slide.position ? { position: img.position, src } : img
        )
        await supabase.from('carousel_executions').update({ images: updatedImages }).eq('id', latestExec.id)
      }
    } catch (err) {
      setSlideImages(prev => prev.map(img =>
        img.position === slide.position ? { ...img, status: 'error', error: err.message } : img
      ))
    }
  }

  // ── Individual run handlers ────────────────────────────────────────────────
  async function runPhase1() {
    try { await executePhase1() }
    catch (err) { setP1Error(err.message); setP1Status('error') }
  }

  async function runPhase2() {
    try { await executePhase2() }
    catch (err) { setP2Error(err.message); setP2Status('error') }
  }

  async function runPhase3() {
    cancelRef.current = false
    try {
      const images = await executePhase3()
      if (!cancelRef.current) await saveExecution(images, captionResult)
    } catch (err) { setP3Error(err.message); setP3Status('error') }
  }

  async function runPhase4() {
    try {
      const result = await executePhase4()
      // Update latest execution for this pipeline if one exists
      const { data: latestExec } = await supabase
        .from('carousel_executions')
        .select('id')
        .eq('pipeline_id', pip.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (latestExec) {
        await supabase.from('carousel_executions')
          .update({ caption: result.caption, hashtags: result.hashtags })
          .eq('id', latestExec.id)
      }
    } catch (err) { setP4Error(err.message); setP4Status('error') }
  }

  // ── Run full workflow ──────────────────────────────────────────────────────
  async function runWorkflow() {
    cancelRef.current = false
    setWorkflowRunning(true)
    startTimer()
    try {
      const ideaResult  = await executePhase1()
      if (cancelRef.current) return
      const promptsRes  = await executePhase2(ideaResult)
      if (cancelRef.current) return
      const finalImages = await executePhase3(promptsRes.slides)
      if (cancelRef.current) return
      let capData = null
      try { capData = await executePhase4() } catch {}  // phase 4 failure doesn't block save
      if (!cancelRef.current) await saveExecution(finalImages, capData)
    } catch (err) {
      // errors already set inside executors
    } finally {
      stopTimer()
      setWorkflowRunning(false)
    }
  }

  function updateIdea(next) {
    setIdea(next)
    save({ idea: next })
  }

  useEffect(() => () => {
    if (staggerRef.current) clearInterval(staggerRef.current)
    if (timerRef.current)   clearInterval(timerRef.current)
  }, [])

  const p1Done = p1Status === 'done'
  const busy   = workflowRunning || p1Status === 'loading' || p2Status === 'loading' || p3Status === 'loading' || p4Status === 'loading'

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>

      {/* Back + name + run row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onBack}
          style={{ gap: 5, paddingLeft: 6, flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          All Pipelines
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />
        <input
          className="form-input"
          value={name}
          onChange={e => { setName(e.target.value); save({ name: e.target.value }) }}
          style={{ fontWeight: 600, fontSize: 14, border: 'none', background: 'transparent', padding: '4px 0', boxShadow: 'none', outline: 'none', flex: 1 }}
          onFocus={e => e.target.style.background = 'var(--surface2)'}
          onBlur={e => e.target.style.background = 'transparent'}
        />
        {(timerActive || elapsed > 0) && (
          <span style={{ fontSize: 12, color: timerActive ? 'var(--text-muted)' : 'var(--green)', fontFamily: 'monospace', letterSpacing: '0.04em', flexShrink: 0 }}>
            {formatTime(elapsed)}
          </span>
        )}
        {busy && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { cancelRef.current = true }}
            style={{ flexShrink: 0, color: 'var(--red)' }}
          >
            Cancel
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={runWorkflow}
          disabled={busy}
          style={{ flexShrink: 0, gap: 7 }}
        >
          {workflowRunning
            ? <><SpinnerIcon /> Running</>
            : <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Run
              </>
          }
        </button>
      </div>

      {/* Persona bar */}
      <PersonaBar inf={inf} />

      {/* Timeline */}
      <div>

        {/* Phase 1 row */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Timeline column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 26, flexShrink: 0, paddingTop: 18 }}>
            <StepCircle n={1} done={p1Status === 'done'} active={p1Status === 'loading' || p1Status === 'idle'} />
            <div style={{ width: 1.5, background: 'var(--border)', flex: 1, minHeight: 28, marginTop: 8 }} />
          </div>
          {/* Card */}
          <div style={{ flex: 1, paddingBottom: 16 }}>
            <PhaseCard
              title="Ideation"
              sub="Define or generate a content idea using the persona"
              status={p1Status}
              locked={false}
            >
              {/* Mode toggle */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Mode</div>
                <div className="toggle-row" style={{ maxWidth: 360 }}>
                  <button className={`toggle-btn ${ideaMode === 'auto' ? 'active' : ''}`} onClick={() => setIdeaMode('auto')}>
                    Auto-generate
                  </button>
                  <button className={`toggle-btn ${ideaMode === 'manual' ? 'active' : ''}`} onClick={() => setIdeaMode('manual')}>
                    Manual
                  </button>
                  <button className={`toggle-btn ${ideaMode === 'list' ? 'active' : ''}`} onClick={() => setIdeaMode('list')}>
                    Topic List
                  </button>
                </div>
              </div>

              {ideaMode === 'manual' && (
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Topic</label>
                  <textarea
                    className="form-textarea"
                    value={manualTopic}
                    onChange={e => setManualTopic(e.target.value)}
                    placeholder="e.g. 5 morning habits for glowing skin"
                    style={{ minHeight: 64 }}
                  />
                </div>
              )}

              {ideaMode === 'auto' && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                  The AI will generate a content idea using <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{inf.name}</strong>'s persona — niche, tone, and audience.
                </p>
              )}

              {ideaMode === 'list' && (
                <div style={{ marginBottom: 14 }}>
                  <TopicListPanel
                    topics={topicList}
                    onTopicsChange={updateTopicList}
                    geminiKey={geminiKey}
                    inf={inf}
                  />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {ideaMode === 'auto' && (
                  <button className="btn btn-primary" onClick={runPhase1} disabled={busy}>
                    {p1Status === 'loading' ? <><SpinnerIcon /> Generating</> : 'Generate Idea'}
                  </button>
                )}
                {ideaMode === 'manual' && (
                  <button className="btn btn-primary" onClick={runPhase1} disabled={busy || !manualTopic.trim()}>
                    Use This Topic
                  </button>
                )}
                {ideaMode === 'list' && (
                  <button
                    className="btn btn-primary"
                    onClick={runPhase1}
                    disabled={busy || !topicList.some(t => !t.used)}
                  >
                    Use Next Topic
                  </button>
                )}
                {p1Done && ideaMode === 'auto' && (
                  <button className="btn btn-secondary btn-sm" onClick={runPhase1} disabled={busy}>
                    Regenerate
                  </button>
                )}
                {p1Done && ideaMode === 'list' && (
                  <button className="btn btn-secondary btn-sm" onClick={runPhase1} disabled={busy || !topicList.some(t => !t.used)}>
                    Use Next
                  </button>
                )}
              </div>

              {ideaMode === 'auto' && (
                <PromptEditor
                  prompt={p1Prompt}
                  onChange={p => { setP1Prompt(p); save({ p1Prompt: p }) }}
                  onReset={() => { const d = buildIdeationPrompt(inf); setP1Prompt(d); save({ p1Prompt: d }) }}
                  open={p1PromptOpen}
                  onToggle={() => setP1PromptOpen(o => !o)}
                />
              )}

              {p1Status === 'error' && <ErrorBar msg={p1Error} onRetry={ideaMode === 'auto' ? runPhase1 : null} />}
              {p1Done && idea && <IdeaCard idea={idea} onEdit={updateIdea} />}
            </PhaseCard>
          </div>
        </div>

        {/* Phase 2 row */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Timeline column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 26, flexShrink: 0, paddingTop: 18 }}>
            <StepCircle n={2} done={p2Status === 'done'} active={p2Status === 'loading' || p2Status === 'idle'} />
            <div style={{ width: 1.5, background: 'var(--border)', flex: 1, minHeight: 28, marginTop: 8 }} />
          </div>
          {/* Card */}
          <div style={{ flex: 1 }}>
            <PhaseCard
              title="Slide Prompts"
              sub="Generate an image generation prompt for each slide"
              status={p2Status}
            >
              {/* Config row */}
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>Slides</div>
                  <Stepper value={slideCount} min={1} max={10} onChange={setSlideCount} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 7 }}>Aspect ratio</div>
                  <RatioPicker value={aspectRatio} onChange={setAspectRatio} />
                </div>
              </div>

              {/* Topic recap */}
              {idea && (
                <div style={{
                  background: 'var(--surface2)', borderRadius: 7, padding: '7px 11px',
                  fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5,
                }}>
                  Topic: <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{idea.topic}</strong>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={runPhase2}
                  disabled={busy || !idea?.topic}
                  title={!idea?.topic ? 'Generate an idea first' : undefined}
                >
                  {p2Status === 'loading' ? <><SpinnerIcon /> Generating</> : 'Generate Prompts'}
                </button>
                {p2Status === 'done' && (
                  <button className="btn btn-secondary btn-sm" onClick={runPhase2} disabled={busy}>
                    Regenerate
                  </button>
                )}
              </div>

              {p2PromptDisplay && (
                <PromptEditor
                  prompt={p2PromptDisplay}
                  onChange={p => { setP2Prompt(p); save({ p2Prompt: p }) }}
                  onReset={() => { setP2Prompt(null); save({ p2Prompt: null }) }}
                  open={p2PromptOpen}
                  onToggle={() => setP2PromptOpen(o => !o)}
                />
              )}

              {p2Status === 'error' && <ErrorBar msg={p2Error} onRetry={runPhase2} />}

              {promptsResult && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {promptsResult.slides.map((slide, i) => (
                      <SlideCard key={i} slide={slide} visible={i < visibleSlides} />
                    ))}
                  </div>

                  {visibleSlides >= promptsResult.slides.length && (
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                        {promptsResult.slides.length} prompts ready
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const all = promptsResult.slides
                            .map(s => `Slide ${s.position}\nHeadline: ${s.headline}\n${s.body ? `Body: ${s.body}\n` : ''}Prompt: ${s.prompt}`)
                            .join('\n\n---\n\n')
                          navigator.clipboard.writeText(all)
                        }}
                      >
                        Copy All Prompts
                      </button>
                    </div>
                  )}
                </div>
              )}
            </PhaseCard>
          </div>
        </div>

        {/* Phase 3 row */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Timeline column — with line to phase 4 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 26, flexShrink: 0, paddingTop: 18 }}>
            <StepCircle n={3} done={p3Status === 'done'} active={p3Status === 'loading' || p3Status === 'idle'} />
            <div style={{ width: 1.5, background: 'var(--border)', flex: 1, minHeight: 28, marginTop: 8 }} />
          </div>
          {/* Card */}
          <div style={{ flex: 1 }}>
            <PhaseCard
              title="Image Generation"
              sub="Generate images for each slide using reference photos"
              status={p3Status}
            >
              {/* Ref images warning */}
              {(!inf.refImages || inf.refImages.length === 0) && (
                <div style={{
                  background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
                  borderRadius: 8, padding: '9px 13px', marginBottom: 14,
                  fontSize: 12, color: 'var(--amber)',
                }}>
                  No reference images uploaded for this influencer. Add them in the Influencer tab for better results.
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={runPhase3}
                  disabled={busy || !promptsResult?.slides?.length}
                  title={!promptsResult?.slides?.length ? 'Generate slide prompts first' : undefined}
                >
                  {p3Status === 'loading' ? <><SpinnerIcon /> Generating</> : 'Generate Images'}
                </button>
                {p3Status === 'done' && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={runPhase3} disabled={busy}>
                      Regenerate All
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => downloadAllImages(slideImages)} style={{ gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Save All
                    </button>
                  </>
                )}
              </div>

              {p3Status === 'error' && <ErrorBar msg={p3Error} onRetry={runPhase3} />}

              {slideImages.length > 0 && (
                <ImageGrid
                  slideImages={slideImages}
                  slides={promptsResult?.slides || []}
                  aspectRatio={aspectRatio}
                  onRegenerate={slide => regenerateSingleImage(slide)}
                  busy={busy}
                />
              )}
            </PhaseCard>
          </div>
        </div>

        {/* Phase 4 — Caption & Hashtags */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 26, flexShrink: 0, paddingTop: 18 }}>
            <StepCircle n={4} done={p4Status === 'done'} active={p4Status === 'loading' || p4Status === 'idle'} />
          </div>
          <div style={{ flex: 1, paddingBottom: 16 }}>
            <PhaseCard
              title="Caption & Hashtags"
              sub="Generate Instagram caption and hashtags aligned with the persona"
              status={p4Status}
            >
              {/* Settings */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Hashtag count</label>
                <div className="toggle-row" style={{ maxWidth: 300 }}>
                  {[10, 20, 30].map(n => (
                    <button
                      key={n}
                      className={`toggle-btn ${hashtagCount === n ? 'active' : ''}`}
                      onClick={() => { setHashtagCount(n); save({ hashtagCount: n }) }}
                    >
                      {n} hashtags
                    </button>
                  ))}
                </div>
              </div>

              {/* Generated output */}
              {captionResult && (
                <div style={{ marginBottom: 14 }}>
                  {/* Caption */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Caption</label>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, gap: 5, padding: '3px 8px' }}
                        onClick={() => navigator.clipboard.writeText(captionResult.caption)}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Copy
                      </button>
                    </div>
                    <textarea
                      className="form-textarea"
                      value={captionResult.caption}
                      onChange={e => setCaptionResult(prev => ({ ...prev, caption: e.target.value }))}
                      style={{ minHeight: 110, fontSize: 13, lineHeight: 1.6 }}
                    />
                  </div>
                  {/* Hashtags */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <label className="form-label" style={{ margin: 0 }}>Hashtags</label>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, gap: 5, padding: '3px 8px' }}
                        onClick={() => navigator.clipboard.writeText((captionResult.hashtags || []).join(' '))}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Copy all
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(captionResult.hashtags || []).map((tag, i) => (
                        <span key={i} style={{
                          background: 'var(--accent-bg)', color: 'var(--accent)',
                          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {p4Error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{p4Error}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={runPhase4}
                  disabled={busy || !idea}
                  title={!idea ? 'Generate an idea first (Phase 1)' : undefined}
                >
                  {p4Status === 'loading' ? <><SpinnerIcon /> Generating</> : captionResult ? 'Regenerate' : 'Generate Caption'}
                </button>
              </div>
            </PhaseCard>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Executions View ───────────────────────────────────────────────────────────
function ExecutionsView({ influencerId, onBack }) {
  const [executions, setExecutions] = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)  // null = list, obj = detail

  useEffect(() => {
    supabase
      .from('carousel_executions')
      .select('id, title, topic, images, posted, caption, hashtags, created_at')
      .eq('influencer_id', influencerId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setExecutions(data || []); setLoading(false) })
  }, [influencerId])

  async function deleteExecution(id) {
    if (!confirm('Delete this post?')) return
    await supabase.from('carousel_executions').delete().eq('id', id)
    setExecutions(prev => prev.filter(e => e.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  async function updateTitle(id, title) {
    setExecutions(prev => prev.map(e => e.id === id ? { ...e, title } : e))
    await supabase.from('carousel_executions').update({ title }).eq('id', id)
  }

  async function togglePosted(id, current) {
    const posted = !current
    setExecutions(prev => prev.map(e => e.id === id ? { ...e, posted } : e))
    if (selected?.id === id) setSelected(s => ({ ...s, posted }))
    await supabase.from('carousel_executions').update({ posted }).eq('id', id)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: 'var(--text-muted)', fontSize: 14 }}>
      Loading...
    </div>
  )

  if (selected) {
    const imgs = selected.images || []
    return (
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} style={{ gap: 5, paddingLeft: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Posts
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <ExecutionTitleInput execution={selected} onSave={title => { updateTitle(selected.id, title); setSelected(s => ({ ...s, title })) }} />
            {selected.topic && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.topic}</div>
            )}
          </div>
          <button
            onClick={() => togglePosted(selected.id, selected.posted)}
            style={{
              flexShrink: 0, padding: '4px 10px', borderRadius: 20, border: '1px solid',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              background: selected.posted ? 'rgba(74,222,128,0.12)' : 'transparent',
              borderColor: selected.posted ? '#4ade80' : 'var(--border)',
              color: selected.posted ? '#4ade80' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: selected.posted ? '#4ade80' : 'var(--text-muted)', flexShrink: 0 }} />
            {selected.posted ? 'Posted' : 'Not posted'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadAllImages(imgs.map(img => ({ ...img, status: 'done' })))} style={{ gap: 6, flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Save All
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {imgs.map(img => (
            <div key={img.position} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ position: 'relative', paddingTop: '125%', background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={img.src} alt={`Slide ${img.position}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: 7, left: 7, width: 20, height: 20, borderRadius: 5, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>
                  {img.position}
                </div>
                <a href={img.src} download={`slide-${img.position}.png`} style={{ position: 'absolute', top: 7, right: 7, width: 26, height: 26, borderRadius: 6, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Caption */}
        {selected.caption && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Caption</span>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, gap: 5, padding: '3px 8px' }} onClick={() => navigator.clipboard.writeText(selected.caption)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
              </button>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6, border: '1px solid var(--border)' }}>
              {selected.caption}
            </div>
          </div>
        )}

        {/* Hashtags */}
        {selected.hashtags?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hashtags</span>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, gap: 5, padding: '3px 8px' }} onClick={() => navigator.clipboard.writeText(selected.hashtags.join(' '))}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy all
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selected.hashtags.map((tag, i) => (
                <span key={i} style={{ background: 'var(--accent-bg)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const postedCount    = executions.filter(e => e.posted).length
  const notPostedCount = executions.length - postedCount

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>Posts</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 10 }}>
            {executions.length === 0 ? 'No posts yet' : (
              <>
                <span style={{ color: '#4ade80' }}>{postedCount} posted</span>
                <span>·</span>
                <span>{notPostedCount} not posted</span>
              </>
            )}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ gap: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Pipelines
        </button>
      </div>

      {executions.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          <div className="empty-title">No posts yet</div>
          <div className="empty-sub">Run a carousel pipeline to generate your first post.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {executions.map(ex => {
            const thumb = ex.images?.[0]?.src
            return (
              <div
                key={ex.id}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.12s' }}
                onClick={() => setSelected(ex)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                {/* Thumbnail */}
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
                {/* Info */}
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.title}</div>
                      {ex.topic && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.topic}</div>
                      )}
                      {!ex.topic && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(ex.created_at).toLocaleDateString()}</div>
                      )}
                    </div>
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
                  <button
                    onClick={e => { e.stopPropagation(); togglePosted(ex.id, ex.posted) }}
                    style={{
                      alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 20, border: '1px solid',
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
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
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
      onFocus={e => e.target.style.background = 'var(--surface2)'}
    />
  )
}

// ── Icon helpers ──────────────────────────────────────────────────────────────
function SpinnerIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: 'carousel-spin 0.8s linear infinite', flexShrink: 0 }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CarouselPipeline({ influencerId, onBack }) {
  const [inf, setInf]               = useState(null)
  const [geminiKey, setGeminiKey]   = useState('')
  const [loadingInit, setLoadingInit] = useState(true)
  const [pips, setPips]             = useState([])
  const [currentId, setCurrentId]   = useState(null)
  const [showExecutions, setShowExecutions] = useState(false)
  const saveTimerRef                = useRef(null)

  useEffect(() => {
    async function init() {
      const [infData, { data: keyData }, { data: pipData }] = await Promise.all([
        Store.get(influencerId),
        supabase.from('api_keys').select('gemini_key').single(),
        supabase.from('carousel_pipelines').select('*').eq('influencer_id', influencerId).order('created_at', { ascending: false }),
      ])
      setInf(infData)
      setGeminiKey(keyData?.gemini_key || '')
      setPips((pipData || []).map(fromDbPip))
      setLoadingInit(false)
    }
    init()
  }, [influencerId])

  async function createPipeline() {
    const { data: { user } } = await supabase.auth.getUser()
    const n = pips.length + 1
    const id = genId()
    const row = {
      id,
      influencer_id: influencerId,
      user_id:       user.id,
      name:          `Carousel #${n}`,
      idea_mode:     'auto',
      idea:          null,
      slide_count:   5,
      aspect_ratio:  '4:5',
      prompts_result: null,
      topic_list:    [],
      p1_prompt:     null,
      p2_prompt:     null,
    }
    const { data, error } = await supabase.from('carousel_pipelines').insert(row).select().single()
    if (error) { console.error(error); return }
    setPips(prev => [fromDbPip(data), ...prev])
    setCurrentId(data.id)
  }

  async function deletePipeline(id) {
    if (!confirm('Delete this pipeline?')) return
    await supabase.from('carousel_pipelines').delete().eq('id', id)
    setPips(prev => prev.filter(p => p.id !== id))
    if (currentId === id) setCurrentId(null)
  }

  function updatePipeline(updated) {
    // Immediate UI update
    setPips(prev => prev.map(p => p.id === updated.id ? updated : p))
    // Debounced Supabase write (800 ms)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      await supabase.from('carousel_pipelines').update(toDbPip(updated)).eq('id', updated.id)
    }, 800)
  }

  if (loadingInit) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: 'var(--text-muted)', fontSize: 14 }}>
        Loading...
      </div>
    )
  }

  if (!inf) {
    return (
      <div className="empty-state" style={{ marginTop: 60 }}>
        <div className="empty-title">Influencer not found</div>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={onBack}>Go back</button>
      </div>
    )
  }

  const currentPip = pips.find(p => p.id === currentId) || null

  return (
    <>
      <style>{`@keyframes carousel-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {showExecutions ? (
        <ExecutionsView
          influencerId={influencerId}
          onBack={() => setShowExecutions(false)}
        />
      ) : currentPip ? (
        <EditorView
          pip={currentPip}
          inf={inf}
          geminiKey={geminiKey}
          onUpdate={updatePipeline}
          onBack={() => setCurrentId(null)}
        />
      ) : (
        <ListView
          pips={pips}
          onOpen={id => setCurrentId(id)}
          onCreate={createPipeline}
          onDelete={deletePipeline}
          onOpenExecutions={() => setShowExecutions(true)}
        />
      )}
    </>
  )
}
