import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { AutoSendBlockedReason } from '@/lib/services/ai-autonomy'
import type { ReplyIntent } from '@/lib/schemas/ai'
import { logger } from '@/lib/logger'

/**
 * Persist an MCP-composed reply as an ai_drafts row tagged prompt_path='mcp'.
 * Append-only and best-effort: it must NEVER throw into the tool handler — a
 * failed insert just means the reply isn't reflected in AI activity. No
 * ai_usage row is written; MCP replies are the user's own agent, not Emma,
 * so they never count toward Emma cost.
 */
export async function recordMcpDraft(params: {
  workspaceId: string
  storeId: string | null
  conversationId: string
  userId: string
  text: string
  intent: ReplyIntent | null
  confidence: number | null
  shouldEscalate: boolean | null
  autoSent: boolean
  blockedReason: AutoSendBlockedReason | null
}): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('ai_drafts')
      .insert({
        workspace_id: params.workspaceId,
        store_id: params.storeId,
        conversation_id: params.conversationId,
        user_id: params.userId,
        prompt_path: 'mcp',
        suggested_text: params.text,
        model: 'mcp-agent',
        intent: params.intent,
        confidence: params.confidence,
        should_escalate: params.shouldEscalate,
        auto_sent_at: params.autoSent ? new Date().toISOString() : null,
        auto_send_blocked_reason: params.autoSent ? null : params.blockedReason,
        status: params.autoSent ? 'auto_sent' : 'pending',
      })
      .select('id')
      .single<{ id: string }>()
    return data?.id ?? null
  } catch (err) {
    logger.error('[mcp/reply]', 'ai_drafts insert failed', err)
    return null
  }
}
