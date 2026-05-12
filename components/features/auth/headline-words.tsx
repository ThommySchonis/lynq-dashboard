'use client'

interface HeadlineWordsProps {
  className?: string
}

export function HeadlineWords({ className }: HeadlineWordsProps) {
  return (
    <span className={className}>
      <span className="inline-block opacity-0 animate-word-reveal motion-reduce:opacity-100 motion-reduce:animate-none" style={{ animationDelay: '0ms' }}>Start</span>{' '}
      <span className="inline-block opacity-0 animate-word-reveal motion-reduce:opacity-100 motion-reduce:animate-none" style={{ animationDelay: '100ms' }}>your</span>{' '}
      <span className="inline-block opacity-0 animate-word-reveal motion-reduce:opacity-100 motion-reduce:animate-none" style={{ animationDelay: '200ms', whiteSpace: 'nowrap' }}>7-day</span>
      <br />
      <span className="inline-block opacity-0 animate-word-reveal motion-reduce:opacity-100 motion-reduce:animate-none" style={{ animationDelay: '300ms' }}>
        <em style={{ fontStyle: 'italic' }}>free</em>
      </span>{' '}
      <span className="inline-block opacity-0 animate-word-reveal motion-reduce:opacity-100 motion-reduce:animate-none" style={{ animationDelay: '400ms' }}>trial</span>
    </span>
  )
}
