export type DraftStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'edited'
  | 'auto_sent'
  | 'regenerated'

export type FeedbackCategory =
  | 'wrong_tone'
  | 'incorrect_info'
  | 'not_relevant'
  | 'too_long'
  | 'too_short'
  | 'missing_context'
  | 'other'

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  wrong_tone: 'Wrong tone',
  incorrect_info: 'Incorrect info',
  not_relevant: 'Not relevant',
  too_long: 'Too long',
  too_short: 'Too short',
  missing_context: 'Missing context',
  other: 'Other',
}

export interface AiDraft {
  id: string
  conversation_id: string
  store_id: string | null
  suggested_text: string
  prompt_path: 'emma' | 'fallback'
  model: string | null
  status: DraftStatus
  generated_at: string
  auto_sent_at: string | null
  auto_send_blocked_reason: string | null
}

export interface ResolvedDraft extends AiDraft {
  edited_text: string | null
  feedback_category: FeedbackCategory | null
  feedback_comment: string | null
  resolved_by: string | null
  resolved_at: string | null
  promoted_to_lesson_id: string | null
  promoted_to_example_id: string | null
  conversation_subject: string | null
  customer_email: string | null
}

export interface UpdateDraftStatusInput {
  draftId: string
  status: DraftStatus
  editedText?: string
  feedbackCategory?: FeedbackCategory
  feedbackComment?: string
}

export interface PromoteToDraftInput {
  draftId: string
  text: string
  appliesToScenario?: string
}
