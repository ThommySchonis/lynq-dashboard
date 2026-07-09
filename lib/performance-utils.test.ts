import { describe, it, expect } from 'vitest'
import { formatSeconds } from '@/lib/performance-utils'

describe('formatSeconds', () => {
  it('formats sub-minute values as seconds', () => {
    expect(formatSeconds(45)).toBe('45s')
  })
  it('formats minutes with leftover seconds', () => {
    expect(formatSeconds(150)).toBe('2m 30s')
  })
  it('formats whole minutes without a seconds part', () => {
    expect(formatSeconds(120)).toBe('2m')
  })
  it('formats hours and minutes', () => {
    expect(formatSeconds(3720)).toBe('1h 2m')
  })
  it('formats days and hours', () => {
    expect(formatSeconds(90000)).toBe('1d 1h')
  })
})
