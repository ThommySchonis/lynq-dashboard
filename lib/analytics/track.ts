import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { EventType } from './events'

export async function trackEvent(
  workspaceId: string,
  eventType: EventType,
  conversationId: string,
  source: string,
  agentId?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabaseAdmin.from('support_events').insert({
      workspace_id: workspaceId,
      event_type: eventType,
      conversation_id: conversationId,
      source,
      agent_id: agentId || null,
      metadata: metadata || {},
    })
  } catch (err) {
    console.error('[analytics] trackEvent failed:', eventType, conversationId, err)
  }
}
