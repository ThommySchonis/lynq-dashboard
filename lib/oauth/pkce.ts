import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** Verify a PKCE code_verifier against an S256 code_challenge (RFC 7636). */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false
  const computed = createHash('sha256').update(verifier).digest('base64url')
  const a = Buffer.from(computed)
  const b = Buffer.from(challenge)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Opaque single-use authorization code. */
export function generateAuthCode(): string {
  return `lynq_ac_${randomBytes(32).toString('base64url')}`
}
