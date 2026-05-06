'use client'

// Editorial TIP card — italic Instrument Serif title, amber TIP badge.
// Renders ook 'industry' en 'video' types in dezelfde editorial stijl
// (een 'video' krijgt een Watch-on-YouTube link in de body als youtube_url
// gezet is).

import { Instrument_Serif } from 'next/font/google'

const display = Instrument_Serif({
  subsets:  ['latin'],
  weight:   '400',
  style:    ['normal', 'italic'],
  display:  'swap',
  fallback: ['Cormorant Garamond', 'Georgia', 'Cambria', 'serif'],
})

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

export default function TipPostCard({ post, indexLabel }) {
  return (
    <article
      style={{
        background:   '#FFFFFF',
        border:       '1px solid #EFEDE8',
        borderRadius: 12,
        padding:      28,
        transition:   'box-shadow 200ms ease, border-color 200ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Header: TIP badge left, date right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            padding:        '3px 9px',
            borderRadius:   100,
            background:     '#FAF1E0',
            color:          '#8A6420',
            fontSize:       10,
            fontWeight:     600,
            letterSpacing:  '0.10em',
            textTransform:  'uppercase',
          }}
        >
          Tip
        </span>
        <span style={{ fontSize: 12, color: '#999893' }}>
          {fmtDate(post.created_at)}
        </span>
      </div>

      {/* Title — Instrument Serif italic, editorial */}
      <h3
        className={display.className}
        style={{
          fontSize:      22,
          fontWeight:    400,
          fontStyle:     'italic',
          lineHeight:    1.25,
          letterSpacing: '-0.01em',
          color:         '#0A0612',
          margin:        '0 0 12px',
        }}
      >
        {post.title}
      </h3>

      {/* Body */}
      {post.body && (
        <p style={{
          fontSize:    15,
          color:       '#2A2825',
          lineHeight:  1.7,
          margin:      0,
          whiteSpace:  'pre-wrap',
          overflowWrap:'break-word',
        }}>
          {post.body}
        </p>
      )}

      {/* Optional video link (voor type='video' posts) */}
      {post.youtube_url && getYouTubeId(post.youtube_url) && (
        <a
          href={post.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            6,
            marginTop:      16,
            fontSize:       13,
            fontWeight:     500,
            color:          '#5C5852',
            textDecoration: 'none',
            transition:     'color 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#0A0612' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#5C5852' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Watch on YouTube
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"/>
            <polyline points="7 7 17 7 17 17"/>
          </svg>
        </a>
      )}

      {/* Optional "Tip N of M" indicator (mono font, opacity 0.5) */}
      {indexLabel && (
        <div
          style={{
            marginTop:    20,
            paddingTop:   12,
            borderTop:    '1px solid #F5F4F0',
            fontSize:     11,
            color:        '#999893',
            opacity:      0.7,
            fontFamily:   '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace',
            letterSpacing:'0.02em',
          }}
        >
          {indexLabel}
        </div>
      )}
    </article>
  )
}
