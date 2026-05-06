'use client'

// Compact UPDATE / changelog card. Utility-feel (DM Sans title, geen
// editorial serif), 4px teal accent links, snel scanbaar.

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function UpdatePostCard({ post }) {
  return (
    <article
      style={{
        position:     'relative',
        background:   '#FFFFFF',
        border:       '1px solid #EFEDE8',
        borderLeft:   '4px solid #5DCAA5',
        borderRadius: 12,
        padding:      24,
        transition:   'box-shadow 200ms ease, border-color 200ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Header: UPDATE badge left, date right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <span
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            padding:        '3px 9px',
            borderRadius:   100,
            background:     '#E1F5EE',
            color:          '#0F6E56',
            fontSize:       10,
            fontWeight:     600,
            letterSpacing:  '0.10em',
            textTransform:  'uppercase',
          }}
        >
          Update
        </span>
        <span style={{ fontSize: 12, color: '#6B6B66', fontWeight: 500 }}>
          {fmtDate(post.created_at)}
        </span>
      </div>

      {/* Title — DM Sans 600, NIET serif (utility feel) */}
      <h3 style={{
        fontSize:      18,
        fontWeight:    600,
        lineHeight:    1.3,
        letterSpacing: '-0.01em',
        color:         '#0A0612',
        margin:        '0 0 8px',
      }}>
        {post.title}
      </h3>

      {/* Body — compact, scanbaar */}
      {post.body && (
        <p style={{
          fontSize:    14.5,
          color:       '#2A2825',
          lineHeight:  1.6,
          margin:      0,
          whiteSpace:  'pre-wrap',
          overflowWrap:'break-word',
        }}>
          {post.body}
        </p>
      )}
    </article>
  )
}
