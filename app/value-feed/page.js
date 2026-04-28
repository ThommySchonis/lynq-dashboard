'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

const CSS = `
  @keyframes fadeUp   { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
  @keyframes shimmer  { from { background-position:-400% 0 } to { background-position:400% 0 } }
  @keyframes spin     { to { transform:rotate(360deg) } }
  @keyframes glowDot  { 0%,100%{opacity:.6} 50%{opacity:1} }

  @media(prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
  }

  .vf-root *  { box-sizing:border-box; margin:0; padding:0 }
  .vf-root    { font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif; -webkit-font-smoothing:antialiased }
  .vf-scroll::-webkit-scrollbar       { width:3px }
  .vf-scroll::-webkit-scrollbar-track { background:transparent }
  .vf-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px }

  .feed-card {
    background:rgba(255,255,255,0.048);
    border:1px solid rgba(255,255,255,0.09);
    border-radius:14px; overflow:hidden;
    box-shadow:0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06);
    transition:border-color .2s ease, transform .25s ease, box-shadow .25s ease;
    cursor:default;
  }
  .feed-card:hover {
    border-color:rgba(255,255,255,0.15);
    transform:translateY(-3px);
    box-shadow:0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.09);
  }

  /* Video thumbnail */
  .vid-thumb {
    position:relative; width:100%; padding-top:56.25%;
    background:linear-gradient(135deg,#1a0835 0%,#0d0620 100%);
    overflow:hidden; flex-shrink:0;
  }
  .vid-thumb img {
    position:absolute; inset:0; width:100%; height:100%;
    object-fit:cover; transition:transform .5s ease;
  }
  .feed-card:hover .vid-thumb img { transform:scale(1.04); }
  .vid-grad {
    position:absolute; inset:0;
    background:linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(13,6,32,0.9) 100%);
    pointer-events:none;
  }
  .play-ring {
    position:absolute; inset:0;
    display:flex; align-items:center; justify-content:center;
    pointer-events:none;
  }
  .play-circle {
    width:54px; height:54px; border-radius:50%;
    background:rgba(255,255,255,0.12);
    border:2px solid rgba(255,255,255,0.25);
    backdrop-filter:blur(12px);
    display:flex; align-items:center; justify-content:center;
    transition:background .2s ease, border-color .2s ease, transform .2s ease;
  }
  .feed-card:hover .play-circle {
    background:rgba(161,117,252,0.45);
    border-color:rgba(161,117,252,0.7);
    transform:scale(1.1);
  }

  /* Type badge */
  .type-badge {
    display:inline-flex; align-items:center; gap:4px;
    padding:3px 10px; border-radius:100px;
    font-size:10px; font-weight:700; letter-spacing:.07em; text-transform:uppercase;
  }

  /* Filter pill */
  .f-pill {
    padding:6px 18px; border-radius:100px;
    font-size:12px; font-weight:600;
    cursor:pointer; border:none; font-family:inherit;
    transition:all .15s ease;
  }

  /* Watch link */
  .watch-link {
    display:inline-flex; align-items:center; gap:6px;
    font-size:12.5px; font-weight:700; text-decoration:none;
    transition:gap .2s ease;
  }
  .watch-link:hover { gap:10px; }

  .sk { background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%); background-size:400% 100%; animation:shimmer 1.8s ease-in-out infinite; border-radius:8px }
`

const TYPE = {
  video:    { label: 'Video',    accent: '#A175FC', bg: 'rgba(161,117,252,0.12)', border: 'rgba(161,117,252,0.25)' },
  tip:      { label: 'Tip',      accent: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.22)' },
  update:   { label: 'Update',   accent: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.22)' },
  industry: { label: 'Industry', accent: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.22)' },
}

const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'video',    label: 'Videos' },
  { id: 'tip',      label: 'Tips & Tricks' },
  { id: 'update',   label: 'Updates' },
  { id: 'industry', label: 'Industry' },
]

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Spinner() {
  return <div style={{ width:24, height:24, border:'2px solid rgba(255,255,255,0.08)', borderTop:'2px solid #A175FC', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
}

function PageBg() {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'-5%', right:'5%', width:'55%', height:'65%', background:'radial-gradient(ellipse, rgba(161,117,252,0.08) 0%, transparent 65%)', filter:'blur(50px)' }} />
      <div style={{ position:'absolute', bottom:'5%', left:'-5%', width:'45%', height:'50%', background:'radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 60%)', filter:'blur(60px)' }} />
    </div>
  )
}

function VideoCard({ item, i }) {
  const ytId = getYouTubeId(item.youtube_url)
  const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : null
  const cfg = TYPE.video

  return (
    <div className="feed-card" style={{ animation:`fadeUp .45s ease ${i * 60}ms both` }}>
      <a href={item.youtube_url || '#'} target="_blank" rel="noopener noreferrer" style={{ display:'block', textDecoration:'none' }}>
        <div className="vid-thumb">
          {thumb && <img src={thumb} alt={item.title} />}
          {!thumb && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(161,117,252,0.3)" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          )}
          <div className="vid-grad" />
          <div className="play-ring">
            <div className="play-circle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft:2 }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
          {/* Duration/type badge on thumb */}
          <div style={{ position:'absolute', top:12, left:12 }}>
            <span className="type-badge" style={{ background:'rgba(0,0,0,0.6)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', backdropFilter:'blur(8px)' }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="#A175FC"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              YouTube
            </span>
          </div>
        </div>
      </a>

      <div style={{ padding:'18px 22px 22px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <span className="type-badge" style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.accent }}>
            Video
          </span>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.28)', marginLeft:'auto' }}>{fmtDate(item.created_at)}</span>
        </div>
        <h3 style={{ fontSize:16.5, fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.028em', lineHeight:1.3, marginBottom:8 }}>
          {item.title}
        </h3>
        {item.body && (
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.48)', lineHeight:1.65, marginBottom:16, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
            {item.body}
          </p>
        )}
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
  const cfg = TYPE[item.type] || TYPE.update

  const icons = {
    tip: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    update: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
    industry: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20M4 20V10l8-6 8 6v10"/><path d="M10 20v-6h4v6"/></svg>,
  }

  return (
    <div className="feed-card" style={{ animation:`fadeUp .45s ease ${i * 60}ms both`, position:'relative' }}>
      {/* Top accent line */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${cfg.accent}80, ${cfg.accent}20, transparent)` }} />

      <div style={{ padding:'22px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <span className="type-badge" style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.accent }}>
            <span style={{ color:cfg.accent, display:'flex' }}>{icons[item.type] || icons.update}</span>
            {cfg.label}
          </span>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.28)', marginLeft:'auto' }}>{fmtDate(item.created_at)}</span>
        </div>

        <h3 style={{ fontSize:15.5, fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.025em', lineHeight:1.35, marginBottom:10 }}>
          {item.title}
        </h3>

        {item.body && (
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
            {item.body}
          </p>
        )}
      </div>
    </div>
  )
}

function SkeletonCard({ i }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, overflow:'hidden', animation:`fadeUp .3s ease ${i*50}ms both` }}>
      <div className="sk" style={{ height:200 }} />
      <div style={{ padding:'18px 22px 22px', display:'flex', flexDirection:'column', gap:10 }}>
        <div className="sk" style={{ height:20, width:'30%' }} />
        <div className="sk" style={{ height:22, width:'85%' }} />
        <div className="sk" style={{ height:14, width:'100%' }} />
        <div className="sk" style={{ height:14, width:'70%' }} />
      </div>
    </div>
  )
}

export default function ValueFeedPage() {
  const [posts, setPosts]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')

  useEffect(() => {
    supabase
      .from('broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPosts(data || [])
        setLoading(false)
      })
  }, [])

  const visible = filter === 'all' ? posts : posts.filter(p => p.type === filter)

  return (
    <div className="vf-root" style={{ display:'flex', minHeight:'100vh', background:'#1C0F36', color:'#F8FAFC' }}>
      <style>{CSS}</style>
      <PageBg />
      <Sidebar />

      <main className="vf-scroll" style={{ flex:1, overflowY:'auto', padding:'36px 44px', position:'relative' }}>
        <div style={{ position:'relative', zIndex:1, maxWidth:760, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ animation:'fadeUp .4s ease both', marginBottom:32 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div>
                <h1 style={{ fontSize:28, fontWeight:800, color:'#F8FAFC', letterSpacing:'-0.04em', lineHeight:1.15, marginBottom:6 }}>
                  Value Feed
                </h1>
                <p style={{ fontSize:13.5, color:'rgba(255,255,255,0.38)', fontWeight:500, maxWidth:480, lineHeight:1.55 }}>
                  Exclusive tips, strategies, and videos from the Lynq & Flow team — curated to keep you ahead.
                </p>
              </div>
              {!loading && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:100, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#A175FC', boxShadow:'0 0 8px rgba(161,117,252,0.7)', animation:'glowDot 2s ease-in-out infinite' }} />
                  <span style={{ fontSize:11.5, fontWeight:600, color:'rgba(255,255,255,0.5)' }}>
                    {posts.length} post{posts.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'20px 0 16px' }} />

            {/* Filter pills */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {FILTERS.filter(f => f.id === 'all' || posts.some(p => p.type === f.id)).map(f => (
                <button key={f.id} className="f-pill" onClick={() => setFilter(f.id)} style={{
                  background: filter === f.id ? '#A175FC' : 'rgba(255,255,255,0.05)',
                  color: filter === f.id ? '#fff' : 'rgba(255,255,255,0.42)',
                  border: `1px solid ${filter === f.id ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: filter === f.id ? '0 2px 12px rgba(161,117,252,0.35)' : 'none',
                }}>
                  {f.label}
                  {f.id !== 'all' && !loading && (
                    <span style={{ marginLeft:5, opacity:.55, fontSize:10.5 }}>
                      {posts.filter(p => p.type === f.id).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Feed */}
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {[0,1,2].map(i => <SkeletonCard key={i} i={i} />)}
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign:'center', padding:'64px 0' }}>
              <div style={{ fontSize:32, marginBottom:12, opacity:.3 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin:'0 auto', display:'block' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div style={{ fontSize:15, fontWeight:700, color:'rgba(255,255,255,0.35)', marginBottom:4 }}>Nothing here yet</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.22)' }}>
                {filter === 'all' ? 'Your Lynq team will post exclusive content here soon.' : `No ${FILTERS.find(f=>f.id===filter)?.label.toLowerCase()} posts yet.`}
              </div>
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
