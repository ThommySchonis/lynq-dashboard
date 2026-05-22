import { getConsent } from '@/lib/cookies/consent'

export function shouldSendPii(): boolean {
  const consent = getConsent()
  // Only send PII if user explicitly accepted all cookies
  return consent?.level === 'all'
}
