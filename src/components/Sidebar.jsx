const IconGrid = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const IconUsers = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
  </svg>
)
const IconChart = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const IconSettings = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
  </svg>
)
const IconHelp = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
  </svg>
)
const IconInstagram = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
  </svg>
)

export default function Sidebar({ page, setPage, count }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg viewBox="0 0 28 28" fill="none">
            {/* Person silhouette */}
            <circle cx="14" cy="10" r="4" fill="white"/>
            <path d="M6 22c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            {/* Signal arc */}
            <path d="M20 7a7.5 7.5 0 0 1 0 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.6"/>
            <path d="M22.5 4.5a11 11 0 0 1 0 11" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.35"/>
          </svg>
        </div>
        <span className="sidebar-logo-name">Influence<span>OS</span></span>
      </div>

      <div className="nav-label" style={{ marginTop: 4 }}>Main</div>

      <div
        className={`nav-item ${page === 'dashboard' ? 'active' : ''}`}
        onClick={() => setPage('dashboard')}
      >
        <IconGrid />
        Dashboard
      </div>

      <div
        className={`nav-item ${page === 'influencers' || page === 'detail' ? 'active' : ''}`}
        onClick={() => setPage('influencers')}
      >
        <IconUsers />
        Influencers
        {count > 0 && <span className="nav-badge">{count}</span>}
      </div>

      <div
        className={`nav-item ${page === 'analytics' ? 'active' : ''}`}
        onClick={() => setPage('analytics')}
      >
        <IconChart />
        Analytics
      </div>

      <div
        className={`nav-item ${page === 'instagram' ? 'active' : ''}`}
        onClick={() => setPage('instagram')}
      >
        <IconInstagram />
        Instagram
      </div>

      <div className="sidebar-bottom">
        <div className={`nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}>
          <IconSettings /> Settings
        </div>
        <div className="nav-item"><IconHelp /> Help</div>
      </div>
    </aside>
  )
}
