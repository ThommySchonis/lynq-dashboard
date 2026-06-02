import Link from 'next/link'

export function LegalAcceptance() {
  return (
    <p className="mt-4 text-center text-[12px] text-white/55">
      By creating an account, you agree to our{' '}
      <Link href="/terms" className="text-[#C4B0FF] hover:underline transition-colors duration-150">
        Terms of Service
      </Link>{' '}
      and{' '}
      <Link href="/privacy" className="text-[#C4B0FF] hover:underline transition-colors duration-150">
        Privacy Policy
      </Link>
      .
    </p>
  )
}
