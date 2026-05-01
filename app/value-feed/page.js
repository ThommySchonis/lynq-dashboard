'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

const CSS = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shimmer { from{background-position:-400% 0} to{background-position:400% 0} }

  @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}

  .vf-root *  { box-sizing:border-box;margin:0;padding:0 }
  .vf-root    { font-family:'Switzer',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased }
  .vf-scroll::-webkit-scrollbar       { width:3px }
  .vf-scroll::-webkit-scrollbar-track { background:transparent }
  .vf-scroll::-webkit-scrollbar-thumb { background:var(--scrollbar);border-radius:2px }

  .feed-card {
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.07);
    border-radius:10px;
    transition:border-color .15s;
    overflow:hidden;
  }
  .feed-card:hover { border-color:rgba(0,0,0,0.12) }

  .mc-card {
    background:#FFFFFF;
    border:1px solid rgba(0,0,0,0.07);
    border-radius:10px;
    padding:24px;
    transition:border-color .15s;
  }
  .mc-card:hover { border-color:rgba(0,0,0,0.12) }

  .vid-thumb { position:relative;width:100%;padding-top:56.25%;background:#111111;overflow:hidden }
  .vid-thumb img { position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .4s }
  .feed-card:hover .vid-thumb img { transform:scale(1.03) }
  .vid-grad  { position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(0,0,0,0.7) 100%);pointer-events:none }
  .play-ring { position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none }
  .play-circle {
    width:48px;height:48px;border-radius:50%;
    background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.3);
    backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;
    transition:background .15s,transform .15s;
  }
  .feed-card:hover .play-circle { background:rgba(255,255,255,0.25);transform:scale(1.08) }

  .f-pill { padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;display:inline-flex;align-items:center;gap:5px }

  .join-btn {
    display:inline-flex;align-items:center;gap:7px;
    height:36px;padding:0 16px;border-radius:7px;border:none;
    background:#111111;color:#fff;font-size:13px;font-weight:600;
    cursor:pointer;font-family:inherit;transition:background .15s;text-decoration:none;
  }
  .join-btn:hover { background:#333333 }

  .cal-btn {
    display:inline-flex;align-items:center;gap:7px;
    height:36px;padding:0 16px;border-radius:7px;
    border:1px solid rgba(0,0,0,0.09);background:#FFFFFF;
    color:#555555;font-size:13px;font-weight:500;
    cursor:pointer;font-family:inherit;text-decoration:none;
    transition:background .15s;
  }
  .cal-btn:hover { background:#F5F5F5 }

  .react-btn {
    display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:6px;
    font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;
    border:1px solid transparent;background:transparent;transition:all .15s;line-height:1;color:#888888;
  }
  .react-btn:hover { background:#F5F5F5;border-color:rgba(0,0,0,0.07) }
  .react-btn.active { color:#111111;background:#F5F5F5;border-color:rgba(0,0,0,0.09) }

  .sk { background:linear-gradient(90deg,var(--skeleton-from) 25%,var(--skeleton-to) 50%,var(--skeleton-from) 75%);background-size:400% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:6px }
`

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_CFG = {
  video:    { label:'Video',    borderColor:'#BDBDBD', badgeBg:'#F5F5F5',   badgeColor:'#555555', badgeBorder:'rgba(0,0,0,0.08)'         },
  tip:      { label:'Tip',      borderColor:'#D97706', badgeBg:'#FFFBEB',   badgeColor:'#D97706', badgeBorder:'rgba(215,163,6,0.15)'     },
  update:   { label:'Update',   borderColor:'#16A34A', badgeBg:'#F0FDF4',   badgeColor:'#16A34A', badgeBorder:'rgba(22,163,74,0.15)'     },
  industry: { label:'Industry', borderColor:'#555555', badgeBg:'#F5F5F5',   badgeColor:'#555555', badgeBorder:'rgba(0,0,0,0.08)'         },
}

const TYPE_FILTERS = [
  { id: 'all',      label: 'All'      },
  { id: 'video',    label: 'Videos'   },
  { id: 'tip',      label: 'Tips'     },
  { id: 'update',   label: 'Updates'  },
  { id: 'industry', label: 'Industry' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

function isNew(iso) { return (Date.now() - new Date(iso)) < 7 * 86400000 }

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtEventDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function timeUntil(iso) {
  const diff = new Date(iso) - Date.now()
  if (diff <= 0) return null
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days === 0 && hours < 2) return 'Starting soon'
  if (days === 0) return `Today in ${hours}h`
  if (days === 1) return 'Tomorrow'
  if (days < 7)  return `In ${days} days`
  if (days < 30) return `In ${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''}`
  return `In ${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''}`
}

function googleCalUrl(mc) {
  const start = new Date(mc.scheduled_at)
  const end   = new Date(start.getTime() + 3600000)
  const fmt   = d => d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const p     = new URLSearchParams({ action: 'TEMPLATE', text: mc.title, details: mc.description || '', dates: `${fmt(start)}/${fmt(end)}`, location: mc.zoom_url || '' })
  return `https://calendar.google.com/calendar/render?${p}`
}

// ── Components ───────────────────────────────────────────────────────────────

function MasterclassCard({ mc, i }) {
  const until = timeUntil(mc.scheduled_at)

  return (
    <div className="mc-card" style={{ animation:`fadeUp .4s ease ${i * 80}ms both` }}>
      {/* Badge row */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'2px 8px', borderRadius:4, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#16A34A', flexShrink:0 }} />
          <span style={{ fontSize:10, fontWeight:600, color:'#555555', letterSpacing:'.06em', textTransform:'uppercase' }}>Upcoming Masterclass</span>
        </div>
        {until && (
          <span style={{ fontSize:12, fontWeight:500, color:'#888888' }}>{until}</span>
        )}
      </div>

      {/* Title + speaker */}
      <h2 style={{ fontSize:20, fontWeight:700, color:'#111111', lineHeight:1.25, margin:'12px 0 6px' }}>
        {mc.title}
      </h2>
      {mc.speaker && (
        <p style={{ fontSize:13, color:'#555555', marginBottom:0 }}>
          with <strong style={{ fontWeight:600 }}>{mc.speaker}</strong>
        </p>
      )}
      <p style={{ fontSize:13, color:'#888888', marginTop:4, marginBottom: mc.description ? 10 : 20 }}>
        {fmtEventDate(mc.scheduled_at)}
      </p>
      {mc.description && (
        <p style={{ fontSize:13, color:'#555555', lineHeight:1.6, marginBottom:20 }}>
          {mc.description}
        </p>
      )}

      {/* Actions */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {mc.zoom_url ? (
          <a href={mc.zoom_url} target="_blank" rel="noopener noreferrer" className="join-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.87v6.26a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg>
            Join Zoom session
          </a>
        ) : (
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, height:36, padding:'0 16px', borderRadius:7, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.08)', color:'#888888', fontSize:13, fontWeight:500 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Zoom link coming soon
          </div>
        )}
        <a href={googleCalUrl(mc)} target="_blank" rel="noopener noreferrer" className="cal-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Add to calendar
        </a>
      </div>
    </div>
  )
}

function Reactions({ item, reactions, userId, onReact }) {
  const TYPES = [
    { id:'thumbs_up',
      svg: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88z"/></svg>
    },
    { id:'fire',
      svg: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
    },
  ]
  return (
    <div style={{ borderTop:'1px solid rgba(0,0,0,0.06)', marginTop:14, paddingTop:10, display:'flex', gap:3 }}>
      {TYPES.map(({ id, svg }) => {
        const count = reactions.filter(r => r.broadcast_id === item.id && r.emoji === id).length
        const active = !!userId && reactions.some(r => r.broadcast_id === item.id && r.user_id === userId && r.emoji === id)
        return (
          <button key={id} className={`react-btn${active?' active':''}`} onClick={() => onReact(item.id, id)}>
            {svg}
            {count > 0 && <span style={{ fontSize:11, fontVariantNumeric:'tabular-nums' }}>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

function VideoCard({ item, i, reactions, userId, onReact }) {
  const ytId = getYouTubeId(item.youtube_url)
  const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : null
  const cfg = TYPE_CFG.video

  return (
    <div className="feed-card" style={{ animation:`fadeUp .4s ease ${i*60}ms both` }}>
      <a href={item.youtube_url || '#'} target="_blank" rel="noopener noreferrer" style={{ display:'block', textDecoration:'none' }}>
        <div className="vid-thumb">
          {thumb && <img src={thumb} alt={item.title} />}
          {!thumb && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>}
          <div className="vid-grad" />
          <div className="play-ring"><div className="play-circle"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft:2 }}><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div>
        </div>
      </a>
      <div style={{ padding:'16px 20px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:cfg.badgeColor, background:cfg.badgeBg, border:`1px solid ${cfg.badgeBorder}`, borderRadius:4, padding:'2px 7px' }}>Video</span>
          {isNew(item.created_at) && (
            <span style={{ fontSize:10, fontWeight:600, color:'#555555', background:'#F5F5F5', borderRadius:4, padding:'2px 7px' }}>NEW</span>
          )}
          <span style={{ fontSize:12, color:'#BDBDBD', marginLeft:'auto' }}>{fmtDate(item.created_at)}</span>
        </div>
        <h3 style={{ fontSize:14, fontWeight:600, color:'#111111', lineHeight:1.35, marginBottom:8 }}>{item.title}</h3>
        {item.body && <p style={{ fontSize:13, color:'#555555', lineHeight:1.6, marginBottom:12, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{item.body}</p>}
        {item.youtube_url && (
          <a href={item.youtube_url} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12.5, fontWeight:600, color:'#555555', textDecoration:'none', transition:'gap .15s' }}>
            Watch now
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
        )}
        <Reactions item={item} reactions={reactions} userId={userId} onReact={onReact} />
      </div>
    </div>
  )
}

function TextCard({ item, i, reactions, userId, onReact }) {
  const cfg = TYPE_CFG[item.type] || TYPE_CFG.update

  const updateIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>

  return (
    <div className="feed-card" style={{ animation:`fadeUp .4s ease ${i*60}ms both`, borderLeft:`3px solid ${cfg.borderColor}` }}>
      <div style={{ padding:'20px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10, flexWrap:'wrap' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:cfg.badgeColor, background:cfg.badgeBg, border:`1px solid ${cfg.badgeBorder}`, borderRadius:4, padding:'2px 7px' }}>
            {item.type === 'update' && <span style={{ color:cfg.badgeColor, display:'flex' }}>{updateIcon}</span>}
            {cfg.label}
          </span>
          {isNew(item.created_at) && (
            <span style={{ fontSize:10, fontWeight:600, color:'#555555', background:'#F5F5F5', borderRadius:4, padding:'2px 7px' }}>NEW</span>
          )}
          <span style={{ fontSize:12, color:'#BDBDBD', marginLeft:'auto' }}>{fmtDate(item.created_at)}</span>
        </div>
        <h3 style={{ fontSize:14, fontWeight:600, color:'#111111', lineHeight:1.35, marginBottom:8 }}>{item.title}</h3>
        {item.body && <p style={{ fontSize:13, color:'#555555', lineHeight:1.6, whiteSpace:'pre-wrap', overflowWrap:'break-word' }}>{item.body}</p>}
        <Reactions item={item} reactions={reactions} userId={userId} onReact={onReact} />
      </div>
    </div>
  )
}

function SkeletonCard({ i }) {
  return (
    <div style={{ background:'#FFFFFF', border:'1px solid rgba(0,0,0,0.07)', borderRadius:10, overflow:'hidden', animation:`fadeUp .3s ease ${i*50}ms both` }}>
      <div style={{ padding:'16px 20px 18px', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', gap:8 }}><div className="sk" style={{ height:18, width:50 }}/><div className="sk" style={{ height:18, width:40 }}/></div>
        <div className="sk" style={{ height:18, width:'75%' }}/>
        <div className="sk" style={{ height:13, width:'100%' }}/>
        <div className="sk" style={{ height:13, width:'60%' }}/>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ValueFeedPage() {
  const [posts, setPosts]               = useState([])
  const [masterclasses, setMasterclasses] = useState([])
  const [loading, setLoading]           = useState(true)
  const [typeFilter, setTypeFilter]     = useState('all')
  const [topicFilter, setTopicFilter]   = useState('all')
  const [reactions, setReactions]       = useState([])
  const [userId, setUserId]             = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.auth.getSession(),
      supabase.from('broadcasts').select('*').order('created_at', { ascending: false }),
      supabase.from('masterclasses').select('*').gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true }),
      supabase.from('broadcast_reactions').select('broadcast_id, user_id, emoji'),
    ]).then(([{ data: { session } }, { data: p }, { data: mc }, { data: r }]) => {
      setUserId(session?.user?.id || null)
      setPosts(p || [])
      setMasterclasses(mc || [])
      setReactions(r || [])
      setLoading(false)
    })
  }, [])

  async function toggleReaction(broadcastId, emoji) {
    if (!userId) return
    const has = reactions.some(r => r.broadcast_id === broadcastId && r.user_id === userId && r.emoji === emoji)
    if (has) {
      setReactions(prev => prev.filter(r => !(r.broadcast_id === broadcastId && r.user_id === userId && r.emoji === emoji)))
      await supabase.from('broadcast_reactions').delete().eq('broadcast_id', broadcastId).eq('user_id', userId).eq('emoji', emoji)
    } else {
      setReactions(prev => [...prev, { broadcast_id: broadcastId, user_id: userId, emoji }])
      await supabase.from('broadcast_reactions').insert({ broadcast_id: broadcastId, user_id: userId, emoji })
    }
  }

  const pinnedPost   = posts.find(p => p.is_pinned) || null
  const activeTopics = [...new Set(posts.map(p => p.topic).filter(Boolean))]

  const visible = posts.filter(p => {
    if (typeFilter  !== 'all' && p.type  !== typeFilter)  return false
    if (topicFilter !== 'all' && p.topic !== topicFilter) return false
    return true
  })
  const feedPosts = visible.filter(p => !p.is_pinned)

  return (
    <div className="vf-root" style={{ display:'flex', minHeight:'100vh', background:'#FAFAFA' }}>
      <style>{CSS}</style>
      <Sidebar />

      <main className="vf-scroll" style={{ flex:1, overflowY:'auto', padding:'24px', position:'relative' }}>
        <div style={{ position:'relative', zIndex:1, maxWidth:760, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ animation:'fadeUp .4s ease both', marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div>
                <h1 style={{ fontSize:20, fontWeight:700, color:'#111111', lineHeight:1.2, marginBottom:4 }}>Value Feed</h1>
                <p style={{ fontSize:13, color:'#888888', lineHeight:1.5 }}>
                  Exclusive tips, strategies and videos from the Lynq & Flow team.
                </p>
              </div>
              {!loading && posts.length > 0 && (
                <span style={{ display:'inline-block', padding:'4px 10px', borderRadius:6, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.08)', fontSize:12, fontWeight:500, color:'#555555', flexShrink:0 }}>
                  {posts.length} post{posts.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div style={{ height:1, background:'rgba(0,0,0,0.06)', margin:'16px 0 12px' }} />

            {/* Type filters */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom: activeTopics.length > 0 ? 10 : 0 }}>
              {TYPE_FILTERS.filter(f => f.id === 'all' || posts.some(p => p.type === f.id)).map(f => {
                const count = f.id === 'all' ? posts.length : posts.filter(p => p.type === f.id).length
                const isAct = typeFilter === f.id
                return (
                  <button key={f.id} className="f-pill" onClick={() => setTypeFilter(f.id)} style={{
                    background: isAct ? '#111111' : '#FAFAFA',
                    color:      isAct ? '#ffffff' : '#888888',
                    border:     isAct ? '1px solid transparent' : '1px solid rgba(0,0,0,0.08)',
                  }}>
                    {f.label}
                    <span style={{ fontSize:10, fontWeight:600, color: isAct ? 'rgba(255,255,255,0.6)' : '#888888', background: isAct ? 'rgba(255,255,255,0.18)' : '#EBEBEB', borderRadius:4, padding:'1px 5px' }}>{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Topic filters */}
            {activeTopics.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:600, color:'#BDBDBD', letterSpacing:'.07em', textTransform:'uppercase', marginRight:2 }}>Topic</span>
                {['all', ...activeTopics].map(t => (
                  <button key={t} onClick={() => setTopicFilter(t)} style={{
                    padding:'3px 10px', borderRadius:6, fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .15s',
                    background: topicFilter === t ? '#111111' : 'transparent',
                    color:      topicFilter === t ? '#ffffff' : '#888888',
                    border:     topicFilter === t ? 'none' : '1px solid rgba(0,0,0,0.08)',
                  }}>{t === 'all' ? 'All' : t}</button>
                ))}
              </div>
            )}
          </div>

          {/* Pinned post */}
          {!loading && pinnedPost && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:600, color:'#BDBDBD', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#BDBDBD" stroke="none"><path d="M16 9V4l1-1V2H7v1l1 1v5l-2 3h4v7l1 1 1-1v-7h4l-2-3z"/></svg>
                Pinned
              </div>
              {pinnedPost.type === 'video'
                ? <VideoCard item={pinnedPost} i={0} reactions={reactions} userId={userId} onReact={toggleReaction} />
                : <TextCard  item={pinnedPost} i={0} reactions={reactions} userId={userId} onReact={toggleReaction} />
              }
            </div>
          )}

          {/* Upcoming masterclasses */}
          {!loading && masterclasses.length > 0 && (
            <div style={{ marginBottom:16, animation:'fadeUp .4s ease .05s both' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {masterclasses.map((mc, i) => <MasterclassCard key={mc.id} mc={mc} i={i} />)}
              </div>
            </div>
          )}

          {/* Feed */}
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[0,1,2].map(i => <SkeletonCard key={i} i={i} />)}
            </div>
          ) : feedPosts.length === 0 && !pinnedPost ? (
            <div style={{ textAlign:'center', padding:'56px 0' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin:'0 auto 12px', display:'block' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <div style={{ fontSize:14, fontWeight:600, color:'#111111', marginBottom:4 }}>Nothing here yet</div>
              <div style={{ fontSize:13, color:'#888888' }}>
                {typeFilter !== 'all' || topicFilter !== 'all' ? 'No posts match this filter.' : 'Your Lynq team will post exclusive content here soon.'}
              </div>
              {(typeFilter !== 'all' || topicFilter !== 'all') && (
                <button onClick={() => { setTypeFilter('all'); setTopicFilter('all') }} style={{ marginTop:14, padding:'6px 16px', borderRadius:6, border:'1px solid rgba(0,0,0,0.08)', background:'#F5F5F5', color:'#555555', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {feedPosts.map((item, i) =>
                item.type === 'video'
                  ? <VideoCard key={item.id} item={item} i={i} reactions={reactions} userId={userId} onReact={toggleReaction} />
                  : <TextCard  key={item.id} item={item} i={i} reactions={reactions} userId={userId} onReact={toggleReaction} />
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
