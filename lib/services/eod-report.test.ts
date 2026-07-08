import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateText = vi.fn()

vi.mock('ai', () => ({
  generateText: (...a: unknown[]): unknown => generateText(...a),
  Output: { object: vi.fn() },
}))
vi.mock('@/lib/resilient-fetch', () => ({
  resilientSdkCall: (_s: string, fn: () => unknown): unknown => fn(),
}))
vi.mock('@/lib/ai/model', () => ({
  getAiModel: (): string => 'mock-model',
}))

import { generateEodReport } from '@/lib/services/eod-report'

beforeEach(() => {
  generateText.mockReset()
})

describe('generateEodReport', () => {
  it('passes the real metrics into the prompt and returns trimmed text', async () => {
    generateText.mockResolvedValue({
      text: '  I resolved 12 tickets and sent 34 messages today.  ',
      usage: { inputTokens: 10, outputTokens: 20 },
    })

    const report = await generateEodReport({
      metrics: { tickets_resolved: 12, messages_sent: 34, emma_drafts_handled: 5 },
      hoursTracked: '6h 12m',
      breakDuration: '24m',
      shiftWindow: '09:03 – 15:39',
    })

    expect(report).toBe('I resolved 12 tickets and sent 34 messages today.')
    const call = generateText.mock.calls[0][0] as { messages: { content: string }[] }
    const userMsg = call.messages[1].content
    expect(userMsg).toContain('12')
    expect(userMsg).toContain('34')
    expect(userMsg).toContain('5')
    expect(userMsg).toContain('09:03 – 15:39')
  })

  it('handles a zero-activity shift (passes zeros through)', async () => {
    generateText.mockResolvedValue({
      text: 'A quiet shift today with no tickets closed.',
      usage: {},
    })

    const report = await generateEodReport({
      metrics: { tickets_resolved: 0, messages_sent: 0, emma_drafts_handled: 0 },
      hoursTracked: '2h 0m',
      breakDuration: '0s',
      shiftWindow: '09:00 – 11:00',
    })

    expect(report).toBe('A quiet shift today with no tickets closed.')
    const call = generateText.mock.calls[0][0] as { messages: { content: string }[] }
    const userMsg = call.messages[1].content
    expect(userMsg).toContain('Tickets resolved: 0')
  })
})
