'use client'

// Premium event card — masterclass of Q&A. Editorial Instrument Serif
// title + paars/indigo gradient accent boven de card als visuele
// heritage van /signup. Avatar met initials voor speaker.

import { Instrument_Serif } from 'next/font/google'

const display = Instrument_Serif({
  subsets:  ['latin'],
  weight:   '400',
  display:  'swap',
  fallback: ['Cormorant Garamond', 'Georgia', 'Cambria', 'serif'],
})

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

export default function EventPostCard({ event }) {
  const until = timeUntil(event.scheduled_at)
  const hasZoom = !!event.zoom_url

  return (
    <article
      style={{
        position:     'relative',
        background:   '#FFFFFF',
        border:       '1px solid #EFEDE8',
        borderRadius: 16,
        padding:      32,
        overflow:     'hidden',
        transition:   'box-shadow 200ms ease, border-color 200ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Top gradient accent (paars/indigo, brand heritage van /signup) */}
      <div
        aria-hidden="true"
        style={{
          position:   'absolute',
          top:        0,
          left:       0,
          right:      0,
          height:     4,
          background: 'linear-gradient(90deg, #7F77DD 0%, #6366F1 50%, transparent 100%)',
        }}
      />

      {/* Header: status badge + time indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <span
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            padding:        '4px 10px',
            borderRadius:   100,
            background:     '#F5F4F0',
            color:          '#5C5852',
            fontSize:       10,
            fontWeight:     600,
            letterSpacing:  '0.10em',
            textTransform:  'uppercase',
          }}
        >
          Upcoming masterclass
        </span>
        {until && (
          <span style={{ fontSize: 13, color: '#999893', fontWeight: 500 }}>
            {until}
          </span>
        )}
      </div>

      {/* Title — Instrument Serif editorial */}
      <h2
        className={display.className}
        style={{
          fontSize:      26,
          fontWeight:    400,
          lineHeight:    1.15,
          letterSpacing: '-0.02em',
          color:         '#0A0612',
          margin:        '0 0 16px',
        }}
      >
        {event.title}
      </h2>

      {/* Author block: avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width:          32,
            height:         32,
            borderRadius:   '50%',
            background:     'linear-gradient(135deg, #7F77DD 0%, #6366F1 100%)',
            color:          '#FFFFFF',
            fontSize:       12,
            fontWeight:     600,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
            letterSpacing:  '0.02em',
          }}
        >
          {initialsOf(event.speaker) || 'L'}
        </div>
        <div style={{ fontSize: 13, color: '#6B6B66' }}>
          {event.speaker
            ? <>with <span style={{ color: '#0A0612', fontWeight: 500 }}>{event.speaker}</span> · Lynq &amp; Flow</>
            : <span style={{ color: '#0A0612', fontWeight: 500 }}>Lynq &amp; Flow</span>}
        </div>
      </div>

      {/* Date + body */}
      <p style={{ fontSize: 13, color: '#999893', margin: '0 0 16px' }}>
        {fmtEventDate(event.scheduled_at)}
      </p>
      {event.description && (
        <p style={{ fontSize: 16, color: '#2A2825', lineHeight: 1.7, margin: '0 0 24px' }}>
          {event.description}
        </p>
      )}

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {hasZoom ? (
          <a
            href={event.zoom_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            7,
              height:         40,
              padding:        '0 16px',
              borderRadius:   8,
              background:     '#0A0612',
              color:          '#FFFFFF',
              fontSize:       14,
              fontWeight:     500,
              textDecoration: 'none',
              fontFamily:     'inherit',
              transition:     'background-color 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1a0f26' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0A0612' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.87v6.26a1 1 0 0 1-1.447.894L15 14"/>
              <rect x="3" y="6" width="12" height="12" rx="2"/>
            </svg>
            Join Zoom session
          </a>
        ) : (
          <span
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          7,
              height:       40,
              padding:      '0 16px',
              borderRadius: 8,
              background:   '#F5F4F0',
              border:       '1px solid #EFEDE8',
              color:        '#999893',
              fontSize:     14,
              fontWeight:   500,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Zoom link coming soon
          </span>
        )}
        <a
          href={googleCalUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            7,
            height:         40,
            padding:        '0 16px',
            borderRadius:   8,
            background:     '#FFFFFF',
            border:         '1px solid #EFEDE8',
            color:          '#2A2825',
            fontSize:       14,
            fontWeight:     500,
            textDecoration: 'none',
            fontFamily:     'inherit',
            transition:     'background-color 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FAFAF9' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Add to calendar
        </a>
      </div>
    </article>
  )
}
