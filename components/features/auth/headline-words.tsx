'use client'

interface HeadlineWordsProps {
  className?: string
}

export function HeadlineWords({ className }: HeadlineWordsProps) {
  return (
    <span className={className}>
      <span className="word-reveal" style={{ animationDelay: '0ms' }}>Start</span>{' '}
      <span className="word-reveal" style={{ animationDelay: '100ms' }}>your</span>{' '}
      <span className="word-reveal" style={{ animationDelay: '200ms', whiteSpace: 'nowrap' }}>7-day</span>
      <br />
      <span className="word-reveal" style={{ animationDelay: '300ms' }}>
        <em style={{ fontStyle: 'italic' }}>free</em>
      </span>{' '}
      <span className="word-reveal" style={{ animationDelay: '400ms' }}>trial</span>
    </span>
  )
}
