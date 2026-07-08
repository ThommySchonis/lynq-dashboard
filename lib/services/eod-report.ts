import { generateText } from 'ai'
import { getAiModel } from '@/lib/ai/model'
import { resilientSdkCall } from '@/lib/resilient-fetch'

export interface GenerateEodReportParams {
  metrics: {
    tickets_resolved:    number
    messages_sent:       number
    emma_drafts_handled: number
  }
  hoursTracked:  string
  breakDuration: string
  shiftWindow:   string
}

const EOD_SYSTEM_PROMPT = `You write a brief, first-person end-of-day summary for a customer-support agent's own shift log.

Rules:
- 2-3 sentences, plain conversational language, first person ("I").
- Use ONLY the numbers you are given. Never invent tickets, names, or details.
- If every number is zero, write a short, honest note about a quiet shift.
- No greeting, no sign-off, no bullet points — just the summary paragraph.`

export async function generateEodReport(
  params: GenerateEodReportParams,
): Promise<string> {
  const { metrics, hoursTracked, breakDuration, shiftWindow } = params

  const userPrompt = `Write my end-of-day summary from these shift facts:
- Shift: ${shiftWindow}
- Time tracked: ${hoursTracked}
- Break: ${breakDuration}
- Tickets resolved: ${metrics.tickets_resolved}
- Messages sent: ${metrics.messages_sent}
- Emma AI drafts I handled: ${metrics.emma_drafts_handled}`

  const result = await resilientSdkCall('anthropic', () =>
    generateText({
      model: getAiModel(),
      messages: [
        { role: 'system', content: EOD_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      maxOutputTokens: 220,
    }),
  )

  return result.text.trim()
}
