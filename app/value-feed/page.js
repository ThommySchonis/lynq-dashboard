'use client'

import { useEffect, useState } from 'react'
import { Instrument_Serif, DM_Sans } from 'next/font/google'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import PostCard from './components/PostCard'

// /value-feed — editorial light feed met /login brand DNA. Eén
// consistent card pattern, type alleen via subtle tracked-out caps
// label. Strikt palette, ademend ritme.

const display = Instrument_Serif({
  subsets:  ['latin'],
  weight:   '400',
  display:  'swap',
  fallback: ['Cormorant Garamond', 'Georgia', 'Cambria', 'serif'],
})
const body = DM_Sans({
  subsets:  ['latin'],
  weight:   ['400', '500', '600'],
  display:  'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
})

const FILTERS = [
  { id: 'all',         label: 'All'           },
  { id: 'tip',         label: 'Tips'          },
  { id: 'masterclass', label: 'Masterclasses' },
  { id: 'update',      label: 'Updates'       },
]

// ─── Helpers ────────────────────────────────────────────────

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
  const p     = new URLSearchParams({
    action:   'TEMPLATE',
    text:     mc.title,
    details:  mc.description || '',
    dates:    `${fmt(start)}/${fmt(end)}`,
    location: mc.zoom_url || '',
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

function initialsOf(name) {
  if (!name) return ''
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]).join('').toUpperCase()
}

// type='tip' / 'industry' / 'video' → kind 'tip'; type='update' → kind 'update'
function classifyBroadcast(post) {
  return post.type === 'update' ? 'update' : 'tip'
}

// ─── Page styles ────────────────────────────────────────────

const CSS = `
  /* Orbs (matched aan /login, lichter qua opacity) */
  @keyframes orbDriftA {
    0%,100% { transform: translate(0, 0)        scale(1);    }
    50%     { transform: translate(240px, 180px) scale(1.10); }
  }
  @keyframes orbDriftB {
    0%,100% { transform: translate(0, 0)         scale(1);    }
    50%     { transform: translate(-280px, 140px) scale(1.08); }
  }
  @keyframes orbDriftC {
    0%,100% { transform: translate(0, 0)         scale(1);    }
    50%     { transform: translate(-200px, -220px) scale(1.10); }
  }

  /* Word reveal — same pattern als /login */
  @keyframes wordReveal {
    from { opacity: 0; transform: translateY(20px); filter: blur(10px); }
    to   { opacity: 1; transform: translateY(0);    filter: blur(0);    }
  }
  .word-reveal {
    display:    inline-block;
    opacity:    0;
    animation:  wordReveal 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    will-change: opacity, transform, filter;
  }

  /* Generic stagger fade */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  .vf-fade { opacity: 0; animation: fadeUp 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }

  /* Filter tabs (Linear underline-style) */
  .vf-tab {
    background:    transparent;
    border:        none;
    padding:       8px 0;
    font-size:     14px;
    font-weight:   400;
    color:         #6B6B66;
    cursor:        pointer;
    font-family:   inherit;
    border-bottom: 1px solid transparent;
    transition:    color 150ms ease, border-color 150ms ease, opacity 150ms ease, font-weight 150ms ease;
    opacity:       0.5;
    display:       inline-flex;
    align-items:   center;
    gap:           6px;
  }
  .vf-tab:hover  { opacity: 1; color: #0A0612; }
  .vf-tab.active {
    opacity:       1;
    color:         #0A0612;
    font-weight:   500;
    border-bottom-color: #0A0612;
  }
  .vf-tab-count {
    font-size:    11px;
    color:        #999893;
    font-variant-numeric: tabular-nums;
  }
  .vf-tab.active .vf-tab-count { color: #6B6B66; }

  /* Mobile */
  @media (max-width: 640px) {
    .vf-headline { font-size: clamp(36px, 9vw, 48px) !important; }
    .vf-hero     { margin-bottom: 56px !important; }
    .vf-tabs     { margin-bottom: 32px !important; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .vf-orb { animation: none !important; }
    .word-reveal, .vf-fade {
      opacity: 1 !important;
      animation: none !important;
      transform: none !important;
      filter: none !important;
    }
  }
`

// ─── Main page ──────────────────────────────────────────────

export default function ValueFeedPage() {
  const [posts, setPosts]                 = useState([])
  const [masterclasses, setMasterclasses] = useState([])
  const [loading, setLoading]             = useState(true)
  const [filter, setFilter]               = useState('all')

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

  // Normalize naar één unified item shape
  const items = [
    ...masterclasses.map(mc => ({
      id:        'm-' + mc.id,
      kind:      'masterclass',
      title:     mc.title,
      dateText:  timeUntil(mc.scheduled_at) || fmtDate(mc.scheduled_at),
      body:      mc.description || null,
      author: {
        initials:       initialsOf(mc.speaker) || 'L',
        name:           mc.speaker || 'Lynq & Flow',
        scheduledText:  fmtEventDate(mc.scheduled_at),
      },
      zoomUrl:    mc.zoom_url || null,  // null is "Zoom link coming soon" placeholder
      calUrl:     googleCalUrl(mc),
      youtubeUrl: null,
      sortKey:    new Date(mc.scheduled_at).getTime(),
      isPinned:   false,
    })),
    ...posts.map(p => ({
      id:         'b-' + p.id,
      kind:       classifyBroadcast(p),
      title:      p.title,
      dateText:   fmtDate(p.created_at),
      body:       p.body || null,
      author:     null,
      zoomUrl:    undefined,  // undefined = geen CTA section, vs null = "coming soon"
      calUrl:     null,
      youtubeUrl: p.youtube_url || null,
      sortKey:    new Date(p.created_at).getTime(),
      isPinned:   !!p.is_pinned,
    })),
  ]

  // Sort: masterclasses always first (chronological), dan pinned posts,
  // dan recent posts. Filter applied later.
  const sorted = items.sort((a, b) => {
    if (a.kind === 'masterclass' && b.kind !== 'masterclass') return -1
    if (b.kind === 'masterclass' && a.kind !== 'masterclass') return 1
    if (a.kind === 'masterclass' && b.kind === 'masterclass') return a.sortKey - b.sortKey
    if (a.isPinned && !b.isPinned) return -1
    if (b.isPinned && !a.isPinned) return 1
    return b.sortKey - a.sortKey
  })

  const filtered = filter === 'all' ? sorted : sorted.filter(it => it.kind === filter)

  const counts = {
    all:         items.length,
    tip:         items.filter(it => it.kind === 'tip').length,
    masterclass: items.filter(it => it.kind === 'masterclass').length,
    update:      items.filter(it => it.kind === 'update').length,
  }

  return (
    <div
      className={body.className}
      style={{
        display:    'flex',
        minHeight:  '100vh',
        background: '#FAFAF9',
        color:      '#2A2825',
      }}
    >
      <style>{CSS}</style>
      <Sidebar />

      <main style={{ flex: 1, overflowY: 'auto', padding: '24px', position: 'relative' }}>

        {/* ─── Background orbs (visible, light versie van /login) ─── */}
        <Orb
          style={{
            top:        '-10%',
            left:       '-12%',
            width:      800,
            height:     800,
            background: 'radial-gradient(circle, rgba(127, 119, 221, 0.18) 0%, rgba(127, 119, 221, 0.06) 45%, transparent 75%)',
            filter:     'blur(200px)',
            animation:  'orbDriftA 75s ease-in-out infinite',
          }}
        />
        <Orb
          style={{
            top:        '-6%',
            right:      '-14%',
            width:      700,
            height:     700,
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.14) 0%, rgba(99, 102, 241, 0.05) 45%, transparent 75%)',
            filter:     'blur(220px)',
            animation:  'orbDriftB 90s ease-in-out infinite',
          }}
        />
        <Orb
          style={{
            bottom:     '-25%',
            left:       '15%',
            width:      750,
            height:     750,
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.10) 0%, rgba(6, 182, 212, 0.04) 45%, transparent 75%)',
            filter:     'blur(240px)',
            animation:  'orbDriftC 80s ease-in-out infinite',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>

          {/* ─── HERO ─── */}
          <header className="vf-hero" style={{ marginBottom: 80, paddingTop: 8, textAlign: 'center' }}>
            <div
              className="vf-fade"
              style={{
                animationDelay: '0ms',
                fontSize:       12,
                fontWeight:     600,
                letterSpacing:  '0.20em',
                textTransform:  'uppercase',
                color:          'rgba(107, 107, 102, 0.55)',
                marginBottom:   24,
              }}
            >
              Value Feed
            </div>

            <h1
              className={`vf-headline ${display.className}`}
              style={{
                fontSize:      'clamp(48px, 5.5vw, 68px)',
                fontWeight:    400,
                lineHeight:    1.05,
                letterSpacing: '-0.02em',
                color:         '#0A0612',
                margin:        0,
              }}
            >
              <span className="word-reveal" style={{ animationDelay: '0ms'   }}>Value,</span>{' '}
              <span className="word-reveal" style={{ animationDelay: '100ms' }}>weekly.</span>
            </h1>

            <div
              className="vf-fade"
              aria-hidden="true"
              style={{
                animationDelay: '320ms',
                width:          140,
                height:         1,
                margin:         '24px auto 18px',
                background:     'linear-gradient(90deg, transparent 0%, rgba(127, 119, 221, 0.45) 50%, transparent 100%)',
              }}
            />

            <p
              className="vf-fade"
              style={{
                animationDelay: '420ms',
                fontSize:       16,
                color:          '#6B6B66',
                lineHeight:     1.7,
                margin:         '0 auto',
                maxWidth:       480,
              }}
            >
              Tips, masterclasses, and updates from Lynq &amp; Flow.
            </p>
          </header>

          {/* ─── FILTER TABS ─── */}
          <div
            className="vf-fade vf-tabs"
            style={{
              animationDelay: '540ms',
              display:        'flex',
              gap:            32,
              flexWrap:       'wrap',
              borderBottom:   '1px solid #EFEDE8',
              marginBottom:   48,
            }}
          >
            {FILTERS.map(f => (
              <button
                key={f.id}
                className={`vf-tab${filter === f.id ? ' active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <span className="vf-tab-count">{counts[f.id] ?? 0}</span>
              </button>
            ))}
          </div>

          {/* ─── FEED ─── */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[0, 1, 2].map(i => <Skeleton key={i} delay={i * 60} />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              hasFilter={filter !== 'all'}
              onClear={() => setFilter('all')}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filtered.map((item, i) => (
                <div
                  key={item.id}
                  className="vf-fade"
                  style={{ animationDelay: `${640 + i * 60}ms` }}
                >
                  <PostCard
                    kind={item.kind}
                    title={item.title}
                    dateText={item.dateText}
                    body={item.body}
                    author={item.author}
                    zoomUrl={item.zoomUrl}
                    calUrl={item.calUrl}
                    youtubeUrl={item.youtubeUrl}
                  />
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────

function Orb({ style }) {
  return (
    <div
      aria-hidden="true"
      className="vf-orb"
      style={{
        position:      'absolute',
        borderRadius:  '50%',
        pointerEvents: 'none',
        zIndex:        0,
        ...style,
      }}
    />
  )
}

function Skeleton({ delay = 0 }) {
  return (
    <div
      className="vf-fade"
      style={{
        animationDelay: `${delay}ms`,
        background:     '#FFFFFF',
        border:         '1px solid rgba(10, 6, 18, 0.08)',
        borderRadius:   16,
        padding:        32,
        boxShadow:      '0 1px 2px rgba(10, 6, 18, 0.03)',
        display:        'flex',
        flexDirection:  'column',
        gap:            14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ height: 12, width: 60, background: '#F5F4F0', borderRadius: 4 }}/>
        <div style={{ height: 12, width: 80, background: '#F5F4F0', borderRadius: 4 }}/>
      </div>
      <div style={{ height: 26, width: '70%', background: '#F5F4F0', borderRadius: 4 }}/>
      <div style={{ height: 14, width: '100%', background: '#F5F4F0', borderRadius: 4 }}/>
      <div style={{ height: 14, width: '60%', background: '#F5F4F0', borderRadius: 4 }}/>
    </div>
  )
}

function EmptyState({ hasFilter, onClear }) {
  return (
    <div className="vf-fade" style={{ animationDelay: '700ms', textAlign: 'center', padding: '72px 24px' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#0A0612', marginBottom: 6 }}>
        Nothing here yet
      </div>
      <div style={{ fontSize: 14, color: '#6B6B66', maxWidth: 360, margin: '0 auto' }}>
        {hasFilter
          ? 'No posts match this filter.'
          : 'Your Lynq team will post exclusive content here soon.'}
      </div>
      {hasFilter && (
        <button
          onClick={onClear}
          style={{
            marginTop:    20,
            padding:      '8px 16px',
            borderRadius: 10,
            border:       '1px solid #EFEDE8',
            background:   '#FFFFFF',
            color:        '#2A2825',
            fontSize:     13,
            fontWeight:   500,
            cursor:       'pointer',
            fontFamily:   'inherit',
            transition:   'background-color 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F5F4F0' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
