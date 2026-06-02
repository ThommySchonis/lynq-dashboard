import Link from 'next/link'

export function PublicFooter() {
  const year = new Date().getFullYear()
  return (
    <p className="mt-8 text-center text-xs text-white/45 opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none delay-[720ms]">
      © {year} Lynq &amp; Flow ·{' '}
      <Link
        href="/terms"
        className="hover:text-white/75 transition-colors"
      >
        Terms
      </Link>
      {' · '}
      <Link
        href="/privacy"
        className="hover:text-white/75 transition-colors"
      >
        Privacy
      </Link>
    </p>
  )
}
