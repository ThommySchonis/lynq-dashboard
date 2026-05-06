'use client'

// One card style for all post types. Type wordt aangegeven door het
// kleine tracked-out caps text-label linksboven (geen background, geen
// badge — alleen text color). Masterclass krijgt 3 subtle uitbreidingen:
// dunne 1px gradient line bovenaan, iets meer padding, prominenter label.

import { useEffect, useRef, useState } from 'react'
import { Instrument_Serif } from 'next/font/google'

const display = Instrument_Serif({
  subsets:  ['latin'],
  weight:   '400',
  display:  'swap',
  fallback: ['Cormorant Garamond', 'Georgia', 'Cambria', 'serif'],
})

const TYPE_LABELS = {
  tip:         { text: 'TIP',         color: '#8A6420' },
  masterclass: { text: 'MASTERCLASS', color: '#5C4FB8' },
  update:      { text: 'UPDATE',      color: '#0F6E56' },
}

export default function PostCard({
  kind,         // 'tip' | 'masterclass' | 'update'
  title,
  dateText,     // 'May 6, 2026' of 'In 1 week'
  body,         // optional
  author,       // optional: { initials, name, scheduledText } — masterclass only
  zoomUrl,      // optional — masterclass only
  calUrl,       // optional — masterclass only
  youtubeUrl,   // optional — voor video-posts (geclassificeerd als TIP)
}) {
  const isMasterclass = kind === 'masterclass'
  const meta = TYPE_LABELS[kind] || TYPE_LABELS.tip

  const [expanded,   setExpanded]   = useState(false)
  const [overflows,  setOverflows]  = useState(false)
  const bodyRef                     = useRef(null)

  // Detecteer overflow nadat de browser de eerste render heeft uitgevoerd.
  // Vereist clamped state om scrollHeight zinvol te vergelijken.
  useEffect(() => {
    if (!body || expanded) return
    const el = bodyRef.current
    if (!el) return
    setOverflows(el.scrollHeight > el.clientHeight + 2)
  }, [body, expanded])

  return (
    <article
      style={{
        position:     'relative',
        background:   '#FFFFFF',
        border:       '1px solid rgba(10, 6, 18, 0.08)',
        borderRadius: 16,
        padding:      isMasterclass ? 40 : 32,
        boxShadow:    '0 1px 2px rgba(10, 6, 18, 0.03)',
        overflow:     'hidden',
        transition:   'box-shadow 200ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(10, 6, 18, 0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(10, 6, 18, 0.03)' }}
    >
      {/* Masterclass-only: 1px gradient line bovenaan als visuele upgrade */}
      {isMasterclass && (
        <div
          aria-hidden="true"
          style={{
            position:   'absolute',
            top:        0,
            left:       0,
            right:      0,
            height:     1,
            background: 'linear-gradient(90deg, #7F77DD 0%, #6366F1 50%, transparent 100%)',
          }}
        />
      )}

      {/* Type label (top-left) + date (top-right) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span
          style={{
            color:          meta.color,
            fontSize:       11,
            fontWeight:     isMasterclass ? 600 : 500,
            letterSpacing:  '0.15em',
            textTransform:  'uppercase',
          }}
        >
          {meta.text}
        </span>
        {dateText && (
          <span style={{ fontSize: 13, color: '#999893' }}>
            {dateText}
          </span>
        )}
      </div>

      {/* Title — Instrument Serif. Inline fontFamily forceert de
          serif (className alone werd in productie soms door body's
          DM Sans cascade overgenomen — inline = highest specificity). */}
      <h3
        className={display.className}
        style={{
          fontFamily:    display.style.fontFamily,
          fontSize:      isMasterclass ? 28 : 24,
          fontWeight:    400,
          lineHeight:    1.3,
          letterSpacing: '-0.01em',
          color:         '#0A0612',
          margin:        '0 0 12px',
        }}
      >
        {title}
      </h3>

      {/* Author block — masterclass only */}
      {author && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 16px' }}>
          <div
            aria-hidden="true"
            style={{
              width:          28,
              height:         28,
              borderRadius:   '50%',
              background:     'linear-gradient(135deg, #7F77DD 0%, #6366F1 100%)',
              color:          '#FFFFFF',
              fontSize:       11,
              fontWeight:     600,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
              letterSpacing:  '0.02em',
            }}
          >
            {author.initials}
          </div>
          <div style={{ fontSize: 14, color: '#6B6B66', lineHeight: 1.5 }}>
            <span style={{ color: '#0A0612', fontWeight: 500 }}>{author.name}</span> · Lynq &amp; Flow
            {author.scheduledText && (
              <div style={{ fontSize: 13, color: '#6B6B66', marginTop: 2 }}>
                {author.scheduledText}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Body — clamp tot 3 regels, "Read more" als langer */}
      {body && (
        <>
          <p
            ref={bodyRef}
            style={{
              fontSize:     15,
              color:        '#2A2825',
              lineHeight:   1.7,
              margin:       0,
              whiteSpace:   'pre-wrap',
              overflowWrap: 'break-word',
              display:      '-webkit-box',
              WebkitLineClamp: expanded ? 'unset' : 3,
              WebkitBoxOrient: 'vertical',
              overflow:     expanded ? 'visible' : 'hidden',
            }}
          >
            {body}
          </p>
          {overflows && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              style={{
                marginTop:  10,
                background: 'transparent',
                border:     'none',
                padding:    0,
                color:      '#6B6B66',
                fontSize:   13,
                fontWeight: 500,
                cursor:     'pointer',
                fontFamily: 'inherit',
                transition: 'color 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#0A0612' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6B6B66' }}
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </>
      )}

      {/* Inline YouTube link — voor video-posts (TIP variant met youtubeUrl) */}
      {youtubeUrl && (
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            6,
            marginTop:      14,
            fontSize:       13,
            fontWeight:     500,
            color:          '#6B6B66',
            textDecoration: 'none',
            transition:     'color 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#0A0612' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6B6B66' }}
        >
          Watch on YouTube
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"/>
            <polyline points="7 7 17 7 17 17"/>
          </svg>
        </a>
      )}

      {/* CTAs — masterclass only */}
      {(zoomUrl !== undefined || calUrl) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
          {zoomUrl ? (
            <a
              href={zoomUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                gap:            7,
                height:         40,
                padding:        '0 16px',
                borderRadius:   10,
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
                borderRadius: 10,
                background:   '#FAFAF9',
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
          {calUrl && (
            <a
              href={calUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                gap:            7,
                height:         40,
                padding:        '0 16px',
                borderRadius:   10,
                background:     'transparent',
                border:         '1px solid #EFEDE8',
                color:          '#2A2825',
                fontSize:       14,
                fontWeight:     500,
                textDecoration: 'none',
                fontFamily:     'inherit',
                transition:     'background-color 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F5F4F0' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Add to calendar
            </a>
          )}
        </div>
      )}
    </article>
  )
}
