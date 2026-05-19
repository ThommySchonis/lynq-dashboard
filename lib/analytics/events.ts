export const EVENT_TYPES = {
  TICKET_OPENED: 'ticket_opened',
  MESSAGE_RECEIVED: 'message_received',
  MESSAGE_SENT: 'message_sent',
  TICKET_RESOLVED: 'ticket_resolved',
  TICKET_CLOSED: 'ticket_closed',
  TICKET_ASSIGNED: 'ticket_assigned',
} as const

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES]
