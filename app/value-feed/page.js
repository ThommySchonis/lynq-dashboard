'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

const CSS = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shimmer { from{background-position:-400% 0} to{background-position:400% 0} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes pulse   { 0%,100%{opacity:.6} 50%{opacity:1} }
  @keyframes liveDot { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(1.7);opacity:0} }

  @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}

  .vf-root *  { box-sizing:border-box;margin:0;padding:0 }
  .vf-root    { font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased }
  .vf-scroll::-webkit-scrollbar       { width:3px }
  .vf-scroll::-webkit-scrollbar-track { background:transparent }
  .vf-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1);border-radius:2px }

  .feed-card {
    background:rgba(255,255,255,0.048);
    border:1px solid rgba(255,255,255,0.09);
    border-radius:14px;overflow:hidden;
    box-shadow:0 4px 24px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.06);
    transition:border-color .2s,transform .25s,box-shadow .25s;
  }
  .feed-card:hover {
    border-color:rgba(255,255,255,0.15);
    transform:translateY(-3px);
    box-shadow:0 12px 40px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.09);
  }

  .mc-card {
    border-radius:16px;overflow:hidden;position:relative;
    background:linear-gradient(135deg,rgba(161,117,252,0.1) 0%,rgba(99,102,241,0.06) 50%,rgba(255,255,255,0.03) 100%);
    border:1px solid rgba(161,117,252,0.25);
    box-shadow:0 8px 40px rgba(161,117,252,0.15),inset 0 1px 0 rgba(255,255,255,0.08);
    transition:border-color .2s,transform .25s,box-shadow .25s;
  }
  .mc-card:hover {
    border-color:rgba(161,117,252,0.45);
    transform:translateY(-2px);
    box-shadow:0 16px 48px rgba(161,117,252,0.2),inset 0 1px 0 rgba(255,255,255,0.1);
  }

  .vid-thumb { position:relative;width:100%;padding-top:56.25%;background:#0d0620;overflow:hidden }
  .vid-thumb img { position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .5s }
  .feed-card:hover .vid-thumb img { transform:scale(1.04) }
  .vid-grad  { position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(13,6,32,0.88) 100%);pointer-events:none }
  .play-ring { position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none }
  .play-circle {
    width:52px;height:52px;border-radius:50%;
    background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.25);
    backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;
    transition:background .2s,border-color .2s,transform .2s;
  }
  .feed-card:hover .play-circle { background:rgba(161,117,252,0.45);border-color:rgba(161,117,252,0.7);transform:scale(1.1) }

  .type-badge { display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:100px;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase }
  .topic-tag  { display:inline-flex;align-items:center;padding:3px 9px;border-radius:100px;font-size:10px;font-weight:600;letter-spacing:.04em;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5) }

  .f-pill { padding:6px 16px;border-radius:100px;font-size:12px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all .15s }
  .t-pill { padding:5px 14px;border-radius:100px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid;font-family:inherit;transition:all .15s }

  .watch-link { display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;text-decoration:none;transition:gap .2s }
  .watch-link:hover { gap:10px }

  .sk { background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%);background-size:400% 100%;animation:shimmer 1.8s ease-in-out infinite;border-radius:8px }

  .join-btn {
    display:inline-flex;align-items:center;gap:8px;
    padding:11px 22px;border-radius:10px;border:none;
    background:#A175FC;color:#fff;font-size:13px;font-weight:700;
    cursor:pointer;font-family:inherit;letter-spacing:.01em;
    box-shadow:0 4px 18px rgba(161,117,252,0.45);
    transition:background .15s,transform .15s,box-shadow .15s;text-decoration:none;
  }
  .join-btn:hover { background:#b88fff;transform:translateY(-1px);box-shadow:0 6px 24px rgba(161,117,252,0.55) }

  .cal-btn {
    display:inline-flex;align-items:center;gap:7px;
    padding:11px 18px;border-radius:10px;
    border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);
    color:rgba(255,255,255,0.65);font-size:13px;font-weight:600;
    cursor:pointer;font-family:inherit;text-decoration:none;
    transition:background .15s,border-color .15s;
  }
  .cal-btn:hover { background:rgba(255,255,255,0.09);border-color:rgba(255,255,255,0.2) }
`

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_CFG = {
  video:    { label: 'Video',    accent: '#A175FC', bg: 'rgba(161,117,252,0.12)', border: 'rgba(161,117,252,0.25)' },
  tip:      { label: 'Tip',      accent: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.22)' },
  update:   { label: 'Update',   accent: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.22)' },
  industry: { label: 'Industry', accent: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.22)' },
}

const TYPE_FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'video',    label: 'Videos' },
  { id: 'tip',      label: 'Tips' },
  { id: 'update',   label: 'Updates' },
  { id: 'industry', label: 'Industry' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

function isNew(iso) {
  return (Date.now() - new Date(iso)) < 7 * 86400000
}

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

function PageBg() {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'-5%', right:'5%',  width:'55%', height:'65%', background:'radial-gradient(ellipse,rgba(161,117,252,0.08) 0%,transparent 65%)', filter:'blur(50px)' }} />
      <div style={{ position:'absolute', bottom:'5%', left:'-5%', width:'45%', height:'50%', background:'radial-gradient(ellipse,rgba(99,102,241,0.06) 0%,transparent 60%)',  filter:'blur(60px)' }} />
    </div>
  )
}

function MasterclassCard({ mc, i }) {
  const until = timeUntil(mc.scheduled_at)
  const isImminent = until === 'Starting soon' || until?.startsWith('Today')

  return (
    <div className="mc-card" style={{ padding:'28px 30px', animation:`fadeUp .4s ease ${i * 80}ms both` }}>
      {/* Decorative glow */}
      <div style={{ position:'absolute', top:'-30%', right:'-10%', width:'50%', height:'160%', background:'radial-gradient(ellipse,rgba(161,117,252,0.12) 0%,transparent 65%)', pointerEvents:'none' }} />

      <div style={{ position:'relative', zIndex:1 }}>
        {/* Top row */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:100, background:'rgba(161,117,252,0.15)', border:'1px solid rgba(161,117,252,0.3)' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#A175FC', boxShadow:'0 0 8px rgba(161,117,252,0.8)', animation:'pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize:10.5, fontWeight:800, color:'#A175FC', letterSpacing:'.07em', textTransform:'uppercase' }}>Upcoming Masterclass</span>
          </div>
          {until && (
            <span style={{ fontSize:11.5, fontWeight:700, color: isImminent ? '#4ade80' : 'rgba(255,255,255,0.45)', background: isImminent ? 'rgba(74,222,128,0.1)' : 'transparent', padding: isImminent ? '3px 10px' : '0', borderRadius:100, border: isImminent ? '1px solid rgba(74,222,128,0.2)' : 'none' }}>
              {until}
            </span>
          )}
        </div>

        {/* Title + speaker */}
        <h2 style={{ fontSize:22, fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.035em', lineHeight:1.25, marginBottom:8 }}>
          {mc.title}
        </h2>
        {mc.speaker && (
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:6, fontWeight:500 }}>
            with <span style={{ color:'rgba(255,255,255,0.75)', fontWeight:600 }}>{mc.speaker}</span>
          </p>
        )}
        <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.38)', marginBottom: mc.description ? 10 : 20, letterSpacing:'.01em' }}>
          {fmtEventDate(mc.scheduled_at)}
        </p>
        {mc.description && (
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.48)', lineHeight:1.65, marginBottom:22 }}>
            {mc.description}
          </p>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {mc.zoom_url ? (
            <a href={mc.zoom_url} target="_blank" rel="noopener noreferrer" className="join-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.87v6.26a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg>
              Join Zoom session
            </a>
          ) : (
            <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'11px 18px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.35)', fontSize:13, fontWeight:600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Zoom link coming soon
            </div>
          )}
          <a href={googleCalUrl(mc)} target="_blank" rel="noopener noreferrer" className="cal-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Add to calendar
          </a>
        </div>
      </div>
    </div>
  )
}

function TopicTag({ topic }) {
  if (!topic) return null
  return <span className="topic-tag">{topic}</span>
}

function VideoCard({ item, i }) {
  const ytId = getYouTubeId(item.youtube_url)
  const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : null
  const cfg = TYPE_CFG.video

  return (
    <div className="feed-card" style={{ animation:`fadeUp .45s ease ${i*60}ms both` }}>
      <a href={item.youtube_url || '#'} target="_blank" rel="noopener noreferrer" style={{ display:'block', textDecoration:'none' }}>
        <div className="vid-thumb">
          {thumb && <img src={thumb} alt={item.title} />}
          {!thumb && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(161,117,252,0.3)" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>}
          <div className="vid-grad" />
          <div className="play-ring"><div className="play-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft:2 }}><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div>
          <div style={{ position:'absolute', top:12, left:12 }}>
            <span className="type-badge" style={{ background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', backdropFilter:'blur(8px)' }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="#A175FC"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              YouTube
            </span>
          </div>
        </div>
      </a>
      <div style={{ padding:'18px 22px 22px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10, flexWrap:'wrap' }}>
          <span className="type-badge" style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.accent }}>Video</span>
          <TopicTag topic={item.topic} />
          {isNew(item.created_at) && (
            <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase', background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.25)', color:'#4ade80' }}>New</span>
          )}
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.28)', marginLeft:'auto' }}>{fmtDate(item.created_at)}</span>
        </div>
        <h3 style={{ fontSize:16.5, fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.028em', lineHeight:1.3, marginBottom:8 }}>{item.title}</h3>
        {item.body && <p style={{ fontSize:13, color:'rgba(255,255,255,0.48)', lineHeight:1.65, marginBottom:16, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{item.body}</p>}
        {item.youtube_url && (
          <a href={item.youtube_url} target="_blank" rel="noopener noreferrer" className="watch-link" style={{ color:cfg.accent }}>
            Watch now
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
        )}
      </div>
    </div>
  )
}

function TextCard({ item, i }) {
  const cfg = TYPE_CFG[item.type] || TYPE_CFG.update
  const icons = {
    tip:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    update:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
    industry: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20M4 20V10l8-6 8 6v10"/><path d="M10 20v-6h4v6"/></svg>,
  }
  return (
    <div className="feed-card" style={{ animation:`fadeUp .45s ease ${i*60}ms both`, position:'relative' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${cfg.accent}80,${cfg.accent}20,transparent)` }} />
      <div style={{ padding:'22px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12, flexWrap:'wrap' }}>
          <span className="type-badge" style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.accent }}>
            <span style={{ color:cfg.accent, display:'flex' }}>{icons[item.type] || icons.update}</span>
            {cfg.label}
          </span>
          <TopicTag topic={item.topic} />
          {isNew(item.created_at) && (
            <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase', background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.25)', color:'#4ade80' }}>New</span>
          )}
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.28)', marginLeft:'auto' }}>{fmtDate(item.created_at)}</span>
        </div>
        <h3 style={{ fontSize:15.5, fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.025em', lineHeight:1.35, marginBottom:10 }}>{item.title}</h3>
        {item.body && <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', lineHeight:1.7, whiteSpace:'pre-wrap', overflowWrap:'break-word' }}>{item.body}</p>}
      </div>
    </div>
  )
}

function SkeletonCard({ i }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, overflow:'hidden', animation:`fadeUp .3s ease ${i*50}ms both` }}>
      <div className="sk" style={{ height:190 }} />
      <div style={{ padding:'18px 22px 22px', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', gap:8 }}><div className="sk" style={{ height:20, width:60 }} /><div className="sk" style={{ height:20, width:80 }} /></div>
        <div className="sk" style={{ height:22, width:'80%' }} />
        <div className="sk" style={{ height:14, width:'100%' }} />
        <div className="sk" style={{ height:14, width:'65%' }} />
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

  useEffect(() => {
    Promise.all([
      supabase.from('broadcasts').select('*').order('created_at', { ascending: false }),
      supabase.from('masterclasses').select('*').gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true }),
    ]).then(([{ data: p }, { data: mc }]) => {
      setPosts(p || [])
      setMasterclasses(mc || [])
      setLoading(false)
    })
  }, [])

  // Active topics from existing posts only
  const activeTopics = [...new Set(posts.map(p => p.topic).filter(Boolean))]

  const visible = posts.filter(p => {
    if (typeFilter  !== 'all' && p.type  !== typeFilter)  return false
    if (topicFilter !== 'all' && p.topic !== topicFilter) return false
    return true
  })

  return (
    <div className="vf-root" style={{ display:'flex', minHeight:'100vh', background:'#1C0F36', color:'#F8FAFC' }}>
      <style>{CSS}</style>
      <PageBg />
      <Sidebar />

      <main className="vf-scroll" style={{ flex:1, overflowY:'auto', padding:'36px 44px', position:'relative' }}>
        <div style={{ position:'relative', zIndex:1, maxWidth:760, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ animation:'fadeUp .4s ease both', marginBottom:28 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div>
                <h1 style={{ fontSize:28, fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.04em', lineHeight:1.15, marginBottom:6 }}>Value Feed</h1>
                <p style={{ fontSize:13.5, color:'rgba(255,255,255,0.38)', fontWeight:500, lineHeight:1.55 }}>
                  Exclusive tips, strategies and videos from the Lynq & Flow team.
                </p>
              </div>
              {!loading && posts.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 14px', borderRadius:100, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#A175FC', boxShadow:'0 0 8px rgba(161,117,252,0.7)', animation:'pulse 2s ease-in-out infinite' }} />
                  <span style={{ fontSize:11.5, fontWeight:600, color:'rgba(255,255,255,0.5)' }}>{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'20px 0 16px' }} />

            {/* Type filters */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom: activeTopics.length > 0 ? 10 : 0 }}>
              {TYPE_FILTERS.filter(f => f.id === 'all' || posts.some(p => p.type === f.id)).map(f => {
                const count = f.id === 'all' ? posts.length : posts.filter(p => p.type === f.id).length
                return (
                  <button key={f.id} className="f-pill" onClick={() => setTypeFilter(f.id)} style={{
                    background: typeFilter === f.id ? '#A175FC' : 'rgba(255,255,255,0.05)',
                    color:      typeFilter === f.id ? '#fff' : 'rgba(255,255,255,0.42)',
                    border:    `1px solid ${typeFilter === f.id ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow:  typeFilter === f.id ? '0 2px 12px rgba(161,117,252,0.35)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {f.label}
                    <span style={{ fontSize:10, opacity: typeFilter === f.id ? 0.7 : 0.45, background: typeFilter === f.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)', borderRadius:100, padding:'1px 6px', fontWeight:700 }}>{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Topic filters — only shown if posts have topics */}
            {activeTopics.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.2)', letterSpacing:'.07em', textTransform:'uppercase', marginRight:2 }}>Topic</span>
                <button className="t-pill" onClick={() => setTopicFilter('all')} style={{
                  borderColor: topicFilter === 'all' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)',
                  background:  topicFilter === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color:       topicFilter === 'all' ? '#fff' : 'rgba(255,255,255,0.38)',
                }}>All</button>
                {activeTopics.map(t => (
                  <button key={t} className="t-pill" onClick={() => setTopicFilter(t)} style={{
                    borderColor: topicFilter === t ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)',
                    background:  topicFilter === t ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color:       topicFilter === t ? '#fff' : 'rgba(255,255,255,0.38)',
                  }}>{t}</button>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming masterclasses */}
          {!loading && masterclasses.length > 0 && (
            <div style={{ marginBottom:24, animation:'fadeUp .4s ease .05s both' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {masterclasses.map((mc, i) => <MasterclassCard key={mc.id} mc={mc} i={i} />)}
              </div>
            </div>
          )}

          {/* Feed */}
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {[0,1,2].map(i => <SkeletonCard key={i} i={i} />)}
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign:'center', padding:'64px 0' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin:'0 auto 12px', display:'block' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <div style={{ fontSize:15, fontWeight:700, color:'rgba(255,255,255,0.3)', marginBottom:4 }}>Nothing here yet</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.2)' }}>
                {typeFilter !== 'all' || topicFilter !== 'all' ? 'No posts match this filter.' : 'Your Lynq team will post exclusive content here soon.'}
              </div>
              {(typeFilter !== 'all' || topicFilter !== 'all') && (
                <button onClick={() => { setTypeFilter('all'); setTopicFilter('all') }} style={{ marginTop:14, padding:'8px 20px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.45)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {visible.map((item, i) =>
                item.type === 'video'
                  ? <VideoCard key={item.id} item={item} i={i} />
                  : <TextCard  key={item.id} item={item} i={i} />
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
