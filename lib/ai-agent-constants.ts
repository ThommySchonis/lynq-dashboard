/** Suggested "Agent can decide" actions shown in the onboarding combobox
 *  (Figma node 1463-406 · SUGGESTED ACTIONS). Category is optional. */
export interface AiActionSuggestion {
  label: string
  category?: string
}

export const AI_CAN_DECIDE_SUGGESTIONS: AiActionSuggestion[] = [
  { label: 'Resend the tracking link' },
  { label: 'Share order status & delivery ETA', category: 'Orders' },
  { label: 'Send return or exchange instructions', category: 'Returns' },
  { label: 'Apply an active discount code', category: 'Promotions' },
  { label: 'Update a shipping address before dispatch' },
  { label: 'Answer product, sizing & stock questions', category: 'Catalog' },
]
