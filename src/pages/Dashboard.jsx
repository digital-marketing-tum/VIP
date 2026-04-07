import { useState, useEffect } from 'react'
import { Store } from '../store'
import { supabase } from '../supabase'
import PlatformLogo from '../components/PlatformLogo'

function PlatIcons({ platforms }) {
  return (
    <div className="platform-icons">
      {(platforms || []).map(p => (
        <PlatformLogo key={p} platform={p} size={20} />
      ))}
    </div>
  )
}

function MetricCard({ label, value, sub, iconClass, icon }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${iconClass}`}>{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  )
}

function EmptyState({ title, sub }) {
  return (
    <div className="empty-state">
      <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>
      </svg>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
    </div>
  )
}

export default function Dashboard({ onOpenDetail }) {
  const [influencers, setInfluencers]           = useState([])
  const [workflowCounts, setWorkflowCounts]     = useState({})
  const [carouselPipCounts, setCarouselPipCounts] = useState({})
  const [executionCounts, setExecutionCounts]   = useState({})

  useEffect(() => {
    Promise.all([
      Store.getAll(),
      supabase.from('workflows').select('influencer_id'),
      supabase.from('carousel_pipelines').select('influencer_id'),
      supabase.from('carousel_executions').select('influencer_id').eq('posted', true),
    ]).then(([infs, { data: wfRows }, { data: cpRows }, { data: exRows }]) => {
      setInfluencers(infs)
      const wfC = {}, cpC = {}, exC = {}
      for (const { influencer_id } of wfRows || [])
        wfC[influencer_id] = (wfC[influencer_id] || 0) + 1
      for (const { influencer_id } of cpRows || [])
        cpC[influencer_id] = (cpC[influencer_id] || 0) + 1
      for (const { influencer_id } of exRows || [])
        exC[influencer_id] = (exC[influencer_id] || 0) + 1
      setWorkflowCounts(wfC)
      setCarouselPipCounts(cpC)
      setExecutionCounts(exC)
    })
  }, [])

  const active          = influencers.filter(i => i.status === 'active').length
  const totalN8nPosts   = influencers.reduce((s, i) => s + (i.postsGenerated || 0), 0)
  const totalOsPosts    = Object.values(executionCounts).reduce((s, n) => s + n, 0)
  const totalPips       = influencers.reduce((s, i) =>
    s + (workflowCounts[i.id] || 0) + (carouselPipCounts[i.id] || 0), 0)
  const platforms       = new Set(influencers.flatMap(i => i.platforms || []))

  return (
    <>
      <div className="metrics-row">
        <MetricCard
          label="Total Influencers" value={influencers.length} sub={`${active} active`}
          iconClass="blue"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4"/><path d="M16 11l2 2 4-4"/></svg>}
        />
        <MetricCard
          label="Posts via n8n" value={totalN8nPosts} sub="From Instagram analytics"
          iconClass="green"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        />
        <MetricCard
          label="Posts via InfluenceOS" value={totalOsPosts} sub="Posted from platform"
          iconClass="green"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/></svg>}
        />
        <MetricCard
          label="Total Pipelines" value={totalPips} sub="Workflows + carousels"
          iconClass="orange"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="m8 21 4-4 4 4M12 17v4"/></svg>}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Influencer Overview</span>
        </div>
        <div className="card-body" style={{ paddingTop: 16 }}>
          {influencers.length === 0 ? (
            <EmptyState
              title="No influencers yet"
              sub="Create your first virtual influencer to see metrics here."
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="dash-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Influencer</th>
                      <th>Niche</th>
                      <th>Platforms</th>
                      <th>Pipelines</th>
                      <th>Posts</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {influencers.map(inf => (
                      <tr key={inf.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="avatar" style={{ background: inf.color }}>
                              {inf.refImages?.[0]
                                ? <img src={inf.refImages[0]} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} alt="" />
                                : inf.name.charAt(0).toUpperCase()
                              }
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{inf.name}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{inf.niche || '—'}</td>
                        <td><PlatIcons platforms={inf.platforms} /></td>
                        <td style={{ fontSize: 13 }}>{(workflowCounts[inf.id] || 0) + (carouselPipCounts[inf.id] || 0)}</td>
                        <td style={{ fontWeight: 700 }}>{(inf.postsGenerated || 0) + (executionCounts[inf.id] || 0)}</td>
                        <td><span className={`badge ${inf.status}`}>{inf.status}</span></td>
                        <td>
                          <button className="btn btn-sm btn-secondary" onClick={() => onOpenDetail(inf.id)}>Open</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <div className="dash-mobile-list">
                {influencers.map(inf => {
                  const pips  = (workflowCounts[inf.id] || 0) + (carouselPipCounts[inf.id] || 0)
                  const posts = (inf.postsGenerated || 0) + (executionCounts[inf.id] || 0)
                  return (
                    <div key={inf.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
                      <div className="avatar" style={{ background: inf.color, flexShrink: 0 }}>
                        {inf.refImages?.[0]
                          ? <img src={inf.refImages[0]} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} alt="" />
                          : inf.name.charAt(0).toUpperCase()
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inf.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {pips} pip{pips !== 1 ? 's' : ''} · {posts} post{posts !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <span className={`badge ${inf.status}`} style={{ flexShrink: 0, fontSize: 10 }}>{inf.status}</span>
                      <button className="btn btn-sm btn-secondary" style={{ flexShrink: 0 }} onClick={() => onOpenDetail(inf.id)}>Open</button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
