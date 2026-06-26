import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { verifyPkceS256, generateAuthCode } from '@/lib/oauth/pkce'

function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

describe('verifyPkceS256', () => {
  it('accepts a verifier whose S256 hash matches the challenge', () => {
    const verifier = 'a'.repeat(64)
    expect(verifyPkceS256(verifier, challengeFor(verifier))).toBe(true)
  })
  it('rejects a mismatched verifier', () => {
    expect(verifyPkceS256('wrong-verifier', challengeFor('a'.repeat(64)))).toBe(false)
  })
  it('rejects empty inputs', () => {
    expect(verifyPkceS256('', '')).toBe(false)
  })
})

describe('generateAuthCode', () => {
  it('produces a prefixed, unique, long code', () => {
    const a = generateAuthCode()
    const b = generateAuthCode()
    expect(a.startsWith('lynq_ac_')).toBe(true)
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(40)
  })
})
