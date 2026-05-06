'use client'

import { useState, useEffect } from 'react'
import { Instrument_Serif, DM_Sans } from 'next/font/google'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'
import EventPostCard from './components/EventPostCard'
import TipPostCard from './components/TipPostCard'
import UpdatePostCard from './components/UpdatePostCard'

// Editorial light feed — same brand DNA als /signup en /login (Instrument
// Serif + DM Sans, word-stagger headline, paars/indigo gamma) maar
// vertaald naar warm off-white. Drie post-treatments per spec v1.2:
// EventPostCard (masterclass / Q&A), TipPostCard (tip / industry / video),
// UpdatePostCard (changelog).

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

const TYPE_FILTERS = [
  { id: 'all',    label: 'All'     },
  { id: 'tip',    label: 'Tips'    },
  { id: 'update', label: 'Updates' },
]

// type='tip' / 'industry' / 'video' krijgen TIP-treatment, type='update' UPDATE
function isTipLike(post) { return post && post.type !== 'update' }

const CSS = `
  /* ─── Word reveal (matched aan /signup) ─── */
  @keyframes wordReveal {
    from {
      opacity: 0;
      transform: translateY(20px);
      filter: blur(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }
  .word-reveal {
    display: inline-block;
    opacity: 0;
    animation: wordReveal 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    will-change: opacity, transform, filter;
  }

  /* ─── Generic stagger fade ─── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  .vf-fade { opacity: 0; animation: fadeUp 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }

  /* ─── Filter tabs (underline-style, Linear/Attio) ─── */
  .vf-tab {
    background:    transparent;
    border:        none;
    padding:       8px 0;
    font-size:     14px;
    font-weight:   500;
    color:         #6B6B66;
    cursor:        pointer;
    font-family:   inherit;
    border-bottom: 1px solid transparent;
    transition:    color 150ms ease, border-color 150ms ease, opacity 150ms ease;
    opacity:       0.6;
    display:       inline-flex;
    align-items:   center;
    gap:           6px;
  }
  .vf-tab:hover    { opacity: 1; color: #0A0612; }
  .vf-tab.active   {
    opacity:       1;
    color:         #0A0612;
    font-weight:   600;
    border-bottom-color: #0A0612;
  }
  .vf-tab-count {
    font-size:    11px;
    font-weight:  500;
    color:        #999893;
    font-variant-numeric: tabular-nums;
  }
  .vf-tab.active .vf-tab-count { color: #6B6B66; }

  .vf-topic-tab {
    background:    transparent;
    border:        none;
    padding:       4px 8px;
    font-size:     12px;
    font-weight:   500;
    color:         #999893;
    cursor:        pointer;
    font-family:   inherit;
    border-radius: 6px;
    transition:    color 150ms ease, background-color 150ms ease;
  }
  .vf-topic-tab:hover                  { color: #2A2825; background: #F5F4F0; }
  .vf-topic-tab.active                 { color: #0A0612; background: #F5F4F0; font-weight: 600; }

  /* Mobile: smaller hero, tighter spacing */
  @media (max-width: 640px) {
    .vf-headline { font-size: clamp(32px, 8vw, 44px) !important; }
    .vf-hero     { margin-bottom: 48px !important; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .word-reveal, .vf-fade {
      opacity: 1 !important;
      animation: none !important;
      transform: none !important;
      filter: none !important;
    }
  }
`

export default function ValueFeedPage() {
  const [posts, setPosts]                 = useState([])
  const [masterclasses, setMasterclasses] = useState([])
  const [loading, setLoading]             = useState(true)
  const [typeFilter, setTypeFilter]       = useState('all')
  const [topicFilter, setTopicFilter]     = useState('all')

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

  // Pinned post: highest priority, sticky top
  const pinnedPost   = posts.find(p => p.is_pinned) || null
  const activeTopics = [...new Set(posts.map(p => p.topic).filter(Boolean))]

  // Visible posts after filters
  const visible = posts.filter(p => {
    if (typeFilter === 'tip'    && p.type === 'update') return false
    if (typeFilter === 'update' && p.type !== 'update') return false
    if (topicFilter !== 'all' && p.topic !== topicFilter) return false
    return true
  })
  const feedPosts = visible.filter(p => !p.is_pinned)

  // Tip-numbering: "Tip N of M" indexes ALL tip-like posts chronologically
  // (oldest = 1) zodat het label niet meebeweegt met filters.
  const allTipsAsc = posts
    .filter(p => isTipLike(p))
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const tipIndexById = new Map(allTipsAsc.map((p, idx) => [p.id, idx + 1]))
  const totalTips    = allTipsAsc.length

  function tipIndexLabel(post) {
    const n = tipIndexById.get(post.id)
    if (!n || totalTips === 0) return null
    return `Tip ${n} of ${totalTips}`
  }

  const totalPostCount = posts.length + masterclasses.length

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
        {/* Subtle hero orb — visuele heritage van /signup, lichter */}
        <div
          aria-hidden="true"
          style={{
            position:     'absolute',
            top:          -120,
            right:        -80,
            width:        500,
            height:       500,
            borderRadius: '50%',
            background:   'radial-gradient(circle, rgba(127, 119, 221, 0.08) 0%, transparent 65%)',
            filter:       'blur(100px)',
            pointerEvents:'none',
            zIndex:       0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto' }}>

          {/* ─── HERO ─── */}
          <header className="vf-hero" style={{ marginBottom: 72, paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <h1
                className={`vf-headline ${display.className}`}
                style={{
                  fontSize:      'clamp(40px, 5vw, 56px)',
                  fontWeight:    400,
                  lineHeight:    1.05,
                  letterSpacing: '-0.02em',
                  color:         '#0A0612',
                  margin:        0,
                }}
              >
                <span className="word-reveal" style={{ animationDelay: '0ms' }}>Value</span>{' '}
                <span className="word-reveal" style={{ animationDelay: '100ms' }}>Feed</span>
              </h1>

              {!loading && totalPostCount > 0 && (
                <span
                  className="vf-fade"
                  style={{
                    animationDelay: '300ms',
                    flexShrink:     0,
                    marginTop:      12,
                    padding:        '4px 10px',
                    borderRadius:   100,
                    background:     '#F5F4F0',
                    color:          '#6B6B66',
                    fontSize:       12,
                    fontWeight:     500,
                  }}
                >
                  {totalPostCount} {totalPostCount === 1 ? 'post' : 'posts'}
                </span>
              )}
            </div>

            <p
              className="vf-fade"
              style={{
                animationDelay: '300ms',
                fontSize:       16,
                color:          '#6B6B66',
                lineHeight:     1.55,
                maxWidth:       560,
                margin:         0,
              }}
            >
              Exclusive tips, strategies and videos from the Lynq &amp; Flow team.
            </p>
          </header>

          {/* ─── FILTER TABS (underline-style) ─── */}
          <div
            className="vf-fade"
            style={{
              animationDelay: '450ms',
              borderBottom:   '1px solid #EFEDE8',
              marginBottom:   activeTopics.length > 0 ? 16 : 32,
              display:        'flex',
              gap:            24,
              flexWrap:       'wrap',
            }}
          >
            {TYPE_FILTERS.map(f => {
              const count = f.id === 'all'
                ? posts.length
                : f.id === 'tip'
                  ? posts.filter(p => isTipLike(p)).length
                  : posts.filter(p => p.type === 'update').length
              return (
                <button
                  key={f.id}
                  className={`vf-tab${typeFilter === f.id ? ' active' : ''}`}
                  onClick={() => setTypeFilter(f.id)}
                >
                  {f.label}
                  <span className="vf-tab-count">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Topic filter (secondary, smaller) */}
          {activeTopics.length > 0 && (
            <div
              className="vf-fade"
              style={{
                animationDelay: '530ms',
                display:        'flex',
                alignItems:     'center',
                gap:            6,
                flexWrap:       'wrap',
                marginBottom:   32,
              }}
            >
              <span style={{ fontSize: 11, color: '#999893', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 4 }}>Topic</span>
              {['all', ...activeTopics].map(t => (
                <button
                  key={t}
                  className={`vf-topic-tab${topicFilter === t ? ' active' : ''}`}
                  onClick={() => setTopicFilter(t)}
                >
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>
          )}

          {/* ─── PINNED POST ─── */}
          {!loading && pinnedPost && (
            <div className="vf-fade" style={{ animationDelay: '600ms', marginBottom: 24 }}>
              <div
                style={{
                  fontSize:      10,
                  fontWeight:    600,
                  color:         '#999893',
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  marginBottom:  10,
                  display:       'flex',
                  alignItems:    'center',
                  gap:           6,
                }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M16 9V4l1-1V2H7v1l1 1v5l-2 3h4v7l1 1 1-1v-7h4l-2-3z"/>
                </svg>
                Pinned
              </div>
              {pinnedPost.type === 'update'
                ? <UpdatePostCard post={pinnedPost} />
                : <TipPostCard post={pinnedPost} indexLabel={tipIndexLabel(pinnedPost)} />}
            </div>
          )}

          {/* ─── UPCOMING MASTERCLASSES ─── */}
          {!loading && masterclasses.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
              {masterclasses.map((mc, i) => (
                <div
                  key={mc.id}
                  className="vf-fade"
                  style={{ animationDelay: `${680 + i * 100}ms` }}
                >
                  <EventPostCard event={mc} />
                </div>
              ))}
            </div>
          )}

          {/* ─── FEED ─── */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {[0, 1, 2].map(i => <SkeletonCard key={i} delay={i * 80} />)}
            </div>
          ) : feedPosts.length === 0 && !pinnedPost && masterclasses.length === 0 ? (
            <EmptyState
              hasFilter={typeFilter !== 'all' || topicFilter !== 'all'}
              onClear={() => { setTypeFilter('all'); setTopicFilter('all') }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {feedPosts.map((post, i) => {
                const baseDelay = 680 + masterclasses.length * 100
                return (
                  <div
                    key={post.id}
                    className="vf-fade"
                    style={{ animationDelay: `${baseDelay + i * 100}ms` }}
                  >
                    {post.type === 'update'
                      ? <UpdatePostCard post={post} />
                      : <TipPostCard post={post} indexLabel={tipIndexLabel(post)} />}
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

function SkeletonCard({ delay = 0 }) {
  return (
    <div
      className="vf-fade"
      style={{
        animationDelay: `${delay}ms`,
        background:     '#FFFFFF',
        border:         '1px solid #EFEDE8',
        borderRadius:   12,
        padding:        24,
        display:        'flex',
        flexDirection:  'column',
        gap:            12,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ height: 16, width: 50, background: '#F5F4F0', borderRadius: 100 }}/>
        <div style={{ height: 12, width: 80, background: '#F5F4F0', borderRadius: 4, marginLeft: 'auto' }}/>
      </div>
      <div style={{ height: 22, width: '70%', background: '#F5F4F0', borderRadius: 4 }}/>
      <div style={{ height: 14, width: '100%', background: '#F5F4F0', borderRadius: 4 }}/>
      <div style={{ height: 14, width: '60%', background: '#F5F4F0', borderRadius: 4 }}/>
    </div>
  )
}

function EmptyState({ hasFilter, onClear }) {
  return (
    <div className="vf-fade" style={{ animationDelay: '700ms', textAlign: 'center', padding: '64px 24px' }}>
      <div style={{
        width:          48,
        height:         48,
        margin:         '0 auto 16px',
        borderRadius:   '50%',
        background:     '#F5F4F0',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999893" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </div>
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
            borderRadius: 8,
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
