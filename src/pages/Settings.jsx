import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Settings() {
  const [geminiKey, setGeminiKey] = useState('')
  const [rapidKey,  setRapidKey]  = useState('')
  const [show, setShow]           = useState(false)
  const [showRapid, setShowRapid] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    supabase.from('api_keys').select('gemini_key, rapid_key').single()
      .then(({ data }) => {
        if (data) {
          setGeminiKey(data.gemini_key || '')
          setRapidKey(data.rapid_key   || '')
        }
        setLoading(false)
      })
  }, [])

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('api_keys').upsert({
      user_id:    user.id,
      gemini_key: geminiKey,
      rapid_key:  rapidKey,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <>
      <div className="section-header">
        <div className="section-sub">Configure API integrations</div>
      </div>

      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Google / Gemini API</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
              Used for both LLM nodes (text generation) and Image Gen nodes (Nano Banana). Get your key at{' '}
              <strong>aistudio.google.com</strong>.
            </p>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">API Key</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={show ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder={loading ? 'Loading…' : 'AIza…'}
                  disabled={loading}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 0, display: 'flex',
                  }}
                >
                  {show
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
          </div>
          <div style={{ padding: '0 24px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save Key'}
            </button>
            {saved && (
              <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Saved
              </span>
            )}
          </div>
        </div>

        {/* RapidAPI */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">RapidAPI — Instagram Analytics</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
              Used to fetch live Instagram profile data in Analytics. Subscribe to{' '}
              <strong>Instagram Looter 2</strong> on RapidAPI — free tier available.
            </p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">API Key</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showRapid ? 'text' : 'password'}
                  value={rapidKey}
                  onChange={e => setRapidKey(e.target.value)}
                  placeholder={loading ? 'Loading…' : 'Paste your RapidAPI key…'}
                  disabled={loading}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowRapid(s => !s)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 0, display: 'flex',
                  }}
                >
                  {showRapid
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
          </div>
          <div style={{ padding: '0 24px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save Key'}
            </button>
            {saved && (
              <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Saved
              </span>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
