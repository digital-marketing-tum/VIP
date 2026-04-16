import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import Auth from './pages/Auth'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Influencers from './pages/Influencers'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import InfluencerDetail from './pages/InfluencerDetail'
import PipelineBuilder from './pages/PipelineBuilder'
import CarouselPipeline from './pages/CarouselPipeline'
import SimpleVideoPipeline from './pages/SimpleVideoPipeline'
import Instagram from './pages/Instagram'

// ── Mobile nav ────────────────────────────────────────────────────────────────
function MobileHeader({ page, setPage, count, onSignOut, title, onBack, backLabel }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const navItems = [
    { id: 'dashboard',   label: 'Dashboard',   icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
    { id: 'influencers', label: 'Influencers',  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg> },
    { id: 'analytics',   label: 'Analytics',   icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { id: 'instagram',   label: 'Instagram',   icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg> },
    { id: 'settings',    label: 'Settings',    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> },
  ]

  function navigate(id) { setPage(id); setOpen(false) }

  return (
    <header className="mobile-header">
      {onBack ? (
        <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ gap: 4, paddingLeft: 2, flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          {backLabel}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(145deg, #1a8fff, #0055c8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 28 28" fill="none" width="17" height="17">
              <circle cx="14" cy="10" r="4" fill="white"/>
              <path d="M6 22c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M20 7a7.5 7.5 0 0 1 0 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.6"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px' }}>
            Influence<span style={{ color: 'var(--accent)', fontWeight: 500 }}>OS</span>
          </span>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, textAlign: onBack ? 'left' : 'center', paddingLeft: onBack ? 8 : 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
      </div>

      <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: open ? 'var(--surface2)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
          </svg>
        </button>

        {open && (
          <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', padding: 6, minWidth: 180, animation: 'fadeIn 0.12s ease' }}>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', background: (page === item.id || (page === 'detail' && item.id === 'influencers')) ? 'var(--nav-active)' : 'transparent', color: (page === item.id || (page === 'detail' && item.id === 'influencers')) ? 'white' : 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <span style={{ opacity: 0.7 }}>{item.icon}</span>
                {item.label}
                {item.id === 'influencers' && count > 0 && (
                  <span style={{ marginLeft: 'auto', background: 'var(--accent)', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>{count}</span>
                )}
              </button>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <button
              onClick={() => { onSignOut(); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

const PAGE_TITLES = {
  dashboard:           'Dashboard',
  influencers:         'Virtual Influencers',
  analytics:           'Analytics',
  instagram:           'Instagram',
  settings:            'Settings',
  'carousel-pipeline': 'Carousel Pipeline',
  'video-pipeline':    'Simple Video Pipeline',
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [page, setPage]       = useState('dashboard')
  const [detailId, setDetailId] = useState(null)
  const [pipelineCtx, setPipelineCtx] = useState(null)   // { influencerId, workflowId }
  const [carouselInfId, setCarouselInfId] = useState(null)
  const [carouselPipId, setCarouselPipId] = useState(null)
  const [videoInfId, setVideoInfId]       = useState(null)
  const [videoPipId, setVideoPipId]       = useState(null)
  const [influencerCount, setInfluencerCount] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  function openDetail(id) { setDetailId(id); setPage('detail') }
  function closeDetail()  { setDetailId(null); setPage('influencers') }

  function openPipelineBuilder(influencerId, workflowId = null) {
    setPipelineCtx({ influencerId, workflowId })
    setPage('pipeline-builder')
  }
  function closePipelineBuilder() {
    const influencerId = pipelineCtx?.influencerId
    setPipelineCtx(null)
    if (influencerId) { setDetailId(influencerId); setPage('detail') }
    else setPage('influencers')
  }

  function openCarouselPipeline(influencerId, pipelineId) {
    setCarouselInfId(influencerId)
    setCarouselPipId(pipelineId)
    setPage('carousel-pipeline')
  }
  function closeCarouselPipeline() {
    const infId = carouselInfId
    setCarouselInfId(null)
    setCarouselPipId(null)
    if (infId) { setDetailId(infId); setPage('detail') }
    else setPage('influencers')
  }

  function openVideoPipeline(influencerId, pipelineId) {
    setVideoInfId(influencerId)
    setVideoPipId(pipelineId)
    setPage('video-pipeline')
  }
  function closeVideoPipeline() {
    const infId = videoInfId
    setVideoInfId(null)
    setVideoPipId(null)
    if (infId) { setDetailId(infId); setPage('detail') }
    else setPage('influencers')
  }

  async function handleSignOut() { await supabase.auth.signOut() }

  if (session === undefined) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
        <div style={{ color:'var(--text-muted)', fontSize:14 }}>Loading...</div>
      </div>
    )
  }
  if (!session) return <Auth />

  const isPipelineBuilder  = page === 'pipeline-builder'
  const isCarouselPipeline = page === 'carousel-pipeline'
  const isVideoPipeline    = page === 'video-pipeline'
  const title = page === 'detail' ? 'Influencer' : PAGE_TITLES[page] || ''

  const mobileBackLabel = page === 'detail' ? 'Influencers' : (isCarouselPipeline || isVideoPipeline) ? 'Back' : null
  const mobileOnBack    = page === 'detail' ? closeDetail : isCarouselPipeline ? closeCarouselPipeline : isVideoPipeline ? closeVideoPipeline : null

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        setPage={p => { setDetailId(null); setPipelineCtx(null); setPage(p) }}
        count={influencerCount}
      />
      <div className="main-area">
        {/* Mobile header — visible only on small screens */}
        {!isPipelineBuilder && (
          <MobileHeader
            page={page}
            setPage={p => { setDetailId(null); setPipelineCtx(null); setPage(p) }}
            count={influencerCount}
            onSignOut={handleSignOut}
            title={title}
            onBack={mobileOnBack}
            backLabel={mobileBackLabel}
          />
        )}

        {/* Hide topbar in pipeline builder — it has its own */}
        {!isPipelineBuilder && (
          <header className="topbar">
            {page === 'detail' && (
              <button className="btn btn-secondary btn-sm" onClick={closeDetail} style={{ gap:5, marginRight:8, flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Influencers
              </button>
            )}
            {isCarouselPipeline && (
              <button className="btn btn-secondary btn-sm" onClick={closeCarouselPipeline} style={{ gap:5, marginRight:8, flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
            )}
            {isVideoPipeline && (
              <button className="btn btn-secondary btn-sm" onClick={closeVideoPipeline} style={{ gap:5, marginRight:8, flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
            )}
            <div className="topbar-title">{title}</div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:13, color:'var(--text-muted)' }}>{session.user.email}</span>
              <button className="btn btn-secondary btn-sm" onClick={handleSignOut}>Sign out</button>
            </div>
          </header>
        )}

        <div className={isPipelineBuilder ? 'page-content-full' : 'page-content'}>
          {page === 'dashboard'    && <Dashboard onOpenDetail={openDetail} />}
          {page === 'influencers'  && <Influencers onOpenDetail={openDetail} onCountChange={setInfluencerCount} />}
          {page === 'analytics'    && <Analytics />}
          {page === 'instagram'    && <Instagram onGoToSettings={() => setPage('settings')} />}
          {page === 'settings'     && <Settings />}
          {page === 'detail' && detailId && (
            <InfluencerDetail
              id={detailId}
              onBack={closeDetail}
              onOpenPipeline={(wfId) => openPipelineBuilder(detailId, wfId)}
              onOpenCarousel={(pipId) => openCarouselPipeline(detailId, pipId)}
              onOpenVideo={(pipId) => openVideoPipeline(detailId, pipId)}
              onNewNodePipeline={() => openPipelineBuilder(detailId, null)}
            />
          )}
          {page === 'carousel-pipeline' && carouselInfId && carouselPipId && (
            <CarouselPipeline
              influencerId={carouselInfId}
              pipelineId={carouselPipId}
              onBack={closeCarouselPipeline}
            />
          )}
          {page === 'video-pipeline' && videoInfId && videoPipId && (
            <SimpleVideoPipeline
              influencerId={videoInfId}
              pipelineId={videoPipId}
              onBack={closeVideoPipeline}
            />
          )}
          {page === 'pipeline-builder' && pipelineCtx && (
            <PipelineBuilder
              influencerId={pipelineCtx.influencerId}
              workflowId={pipelineCtx.workflowId}
              onBack={closePipelineBuilder}
            />
          )}
        </div>
      </div>
    </div>
  )
}
