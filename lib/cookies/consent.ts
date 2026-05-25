const STORAGE_KEY = 'lynq-cookie-consent'
const CURRENT_VERSION = 1

export type ConsentLevel = 'essential' | 'all'

interface ConsentRecord {
  level: ConsentLevel
  timestamp: string
  version: number
}

export function getConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConsentRecord
    return parsed
  } catch {
    return null
  }
}

export function setConsent(level: ConsentLevel): void {
  const record: ConsentRecord = {
    level,
    timestamp: new Date().toISOString(),
    version: CURRENT_VERSION,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // localStorage unavailable (private browsing) — fail silently
  }
}

export function hasConsented(): boolean {
  const consent = getConsent()
  if (!consent) return false
  return consent.version === CURRENT_VERSION
}
