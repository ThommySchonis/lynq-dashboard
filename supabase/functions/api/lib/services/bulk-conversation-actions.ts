export type BulkAction =
  | 'mark_read'
  | 'resolve'
  | 'snooze'
  | 'assign'
  | 'move'
  | 'spam'
  | 'delete'
  | 'add_tag'
  | 'remove_tag'
  | 'emma_handoff'

export interface BulkPayload {
  until?: string | null
  memberId?: string | null
  status?: string
  tagId?: string
}

export type BulkPlan =
  | { kind: 'update'; updates: Record<string, unknown> }
  | { kind: 'tag'; op: 'add' | 'remove'; tagId: string }
  | { kind: 'emma' }

export class BulkActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BulkActionError'
  }
}

const MOVE_STATUSES = new Set(['open', 'pending', 'resolved'])

export function resolveBulkAction(action: BulkAction, payload: BulkPayload = {}): BulkPlan {
  switch (action) {
    case 'mark_read':
      return { kind: 'update', updates: { is_unread: false } }
    case 'resolve':
      return { kind: 'update', updates: { status: 'resolved' } }
    case 'snooze':
      return { kind: 'update', updates: { status: 'snoozed', snoozed_until: payload.until ?? null } }
    case 'assign':
      if (!('memberId' in payload)) throw new BulkActionError('memberId required for assign')
      return { kind: 'update', updates: { assigned_to: payload.memberId || null } }
    case 'move':
      if (!payload.status || !MOVE_STATUSES.has(payload.status)) {
        throw new BulkActionError('move requires status open|pending|resolved')
      }
      return { kind: 'update', updates: { status: payload.status } }
    case 'spam':
      return { kind: 'update', updates: { is_spam: true } }
    case 'delete':
      return { kind: 'update', updates: { status: 'closed' } }
    case 'add_tag':
      if (!payload.tagId) throw new BulkActionError('tagId required for add_tag')
      return { kind: 'tag', op: 'add', tagId: payload.tagId }
    case 'remove_tag':
      if (!payload.tagId) throw new BulkActionError('tagId required for remove_tag')
      return { kind: 'tag', op: 'remove', tagId: payload.tagId }
    case 'emma_handoff':
      return { kind: 'emma' }
    default:
      throw new BulkActionError(`unknown action: ${action as string}`)
  }
}
