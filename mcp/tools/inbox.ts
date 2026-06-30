import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listConversations, getConversation, listTags, addTag, removeTag, createTag, deleteTag, setConversationState, type ConversationFilters, type ConversationState } from '@/lib/services/conversations'
import { createInboxDraft } from '@/lib/services/inbox-drafts'
import { sendReply, linkCustomer } from '@/lib/conversationEngine'
import { can } from '@/lib/permissions'
import type { McpToolContext } from '@/mcp/types'
import { evaluateMcpSend } from '@/lib/services/mcp-autonomy-gate'
import { recordMcpDraft } from '@/lib/services/mcp-reply-record'
import { REPLY_INTENTS, type ReplyIntent } from '@/lib/schemas/ai'
import { getEnrichedMembers } from '@/lib/services/workspace-members'

export function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

export function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const }
}

export function registerInboxTools(server: McpServer, ctx: McpToolContext): void {
  server.registerTool(
    'list_conversations',
    {
      description: 'List inbox conversations in the workspace. Filter by status, store, email account, search text, or unlinked/spam flags.',
      inputSchema: {
        status: z.string().optional(),
        search: z.string().optional(),
        storeId: z.string().optional(),
        emailAccountId: z.string().optional(),
        unlinked: z.boolean().optional(),
        spam: z.boolean().optional(),
        page: z.number().int().min(0).optional(),
      },
    },
    async (args: ConversationFilters) => {
      try {
        return ok(await listConversations(supabaseAdmin as never, ctx.workspaceId, args))
      } catch (e) {
        return fail(`list_conversations failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'get_conversation',
    {
      description: 'Get a single conversation with its full message thread, tags, assignee, and linked Shopify customer id. Marks it read.',
      inputSchema: { id: z.string() },
    },
    async (args: { id: string }) => {
      try {
        const detail = await getConversation(supabaseAdmin as never, ctx.workspaceId, args.id)
        if (!detail) return fail(`Conversation ${args.id} not found in this workspace.`)
        return ok(detail)
      } catch (e) {
        return fail(`get_conversation failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'list_tags',
    { description: 'List all tags in the workspace (id, name, color) so you can tag conversations.', inputSchema: {} },
    async () => {
      try {
        return ok(await listTags(supabaseAdmin as never, ctx.workspaceId))
      } catch (e) {
        return fail(`list_tags failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'add_tag',
    { description: 'Add a tag (by tag id) to a conversation.', inputSchema: { conversationId: z.string(), tagId: z.string() } },
    async (args: { conversationId: string; tagId: string }) => {
      if (!can.manageTags(ctx.role)) return fail('Your role cannot manage tags.')
      try {
        await addTag(supabaseAdmin as never, ctx.workspaceId, args.conversationId, args.tagId)
        return ok({ added: true })
      } catch (e) {
        return fail(`add_tag failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'remove_tag',
    { description: 'Remove a tag (by tag id) from a conversation.', inputSchema: { conversationId: z.string(), tagId: z.string() } },
    async (args: { conversationId: string; tagId: string }) => {
      if (!can.manageTags(ctx.role)) return fail('Your role cannot manage tags.')
      try {
        await removeTag(supabaseAdmin as never, ctx.workspaceId, args.conversationId, args.tagId)
        return ok({ removed: true })
      } catch (e) {
        return fail(`remove_tag failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'create_tag',
    { description: 'Create a new tag in the workspace. Returns the tag (use its id with add_tag).', inputSchema: { name: z.string().min(1), color: z.string().optional() } },
    async (args: { name: string; color?: string }) => {
      if (!can.manageTags(ctx.role)) return fail('Your role cannot create tags.')
      try {
        return ok(await createTag(supabaseAdmin as never, ctx.workspaceId, ctx.userId, args))
      } catch (e) {
        return fail(`create_tag failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'delete_tag',
    { description: 'Delete a tag from the workspace (removes it from all conversations and macros). Owner/admin only.', inputSchema: { tagId: z.string() } },
    async (args: { tagId: string }) => {
      if (!can.deleteTags(ctx.role)) return fail('Your role cannot delete tags (owner/admin only).')
      try {
        await deleteTag(supabaseAdmin as never, ctx.workspaceId, args.tagId)
        return ok({ deleted: true })
      } catch (e) {
        return fail(`delete_tag failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'set_state',
    {
      description: 'Change a conversation\'s state: set status (open/pending/resolved/closed), snooze until an ISO timestamp, or assign to a member id (or null to unassign).',
      inputSchema: {
        conversationId: z.string(),
        status: z.enum(['open', 'pending', 'resolved', 'closed', 'snoozed']).optional(),
        snoozedUntil: z.string().optional(),
        assignedTo: z.string().nullable().optional(),
      },
    },
    async (args: { conversationId: string; status?: string; snoozedUntil?: string; assignedTo?: string | null }) => {
      if (!can.manageConversations(ctx.role)) return fail('Your role cannot change conversation state.')
      let state: ConversationState
      if (args.assignedTo !== undefined) state = { assignedTo: args.assignedTo }
      else if (args.status === 'snoozed') {
        if (!args.snoozedUntil) return fail('snoozedUntil (ISO timestamp) is required when status is snoozed.')
        state = { status: 'snoozed', snoozedUntil: args.snoozedUntil }
      } else if (args.status) state = { status: args.status as 'open' | 'pending' | 'resolved' | 'closed' }
      else return fail('Provide a status, snoozedUntil, or assignedTo.')

      try {
        await setConversationState(supabaseAdmin as never, ctx.workspaceId, args.conversationId, state)
        return ok({ updated: true })
      } catch (e) {
        return fail(`set_state failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'create_draft',
    {
      description: 'Save a reply draft (your written text) for a conversation. A human reviews and sends it from the Lynq inbox. Use this when you should not send directly.',
      inputSchema: { conversationId: z.string(), text: z.string().min(1) },
    },
    async (args: { conversationId: string; text: string }) => {
      if (!can.replyToTickets(ctx.role)) return fail('Your role cannot draft replies.')
      try {
        const d = await createInboxDraft(supabaseAdmin as never, { workspaceId: ctx.workspaceId, conversationId: args.conversationId, userId: ctx.userId, text: args.text })
        return ok({ draftId: d.id, status: 'pending' })
      } catch (e) {
        return fail(`create_draft failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'send_reply',
    {
      description:
        'Send a reply email on a conversation. Provide bodyText and/or bodyHtml, plus the intent you are handling and your confidence (0-1). The server enforces the workspace autonomy rules: if this reply may not auto-send, it is saved as a draft for human review instead and the response tells you why. Prefer create_draft when a human should always review.',
      inputSchema: {
        conversationId: z.string(),
        bodyText: z.string().optional(),
        bodyHtml: z.string().optional(),
        subject: z.string().optional(),
        to: z.string().optional(),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        intent: z.enum(REPLY_INTENTS).optional(),
        confidence: z.number().min(0).max(1).optional(),
        should_escalate: z.boolean().optional(),
      },
    },
    async (args: {
      conversationId: string
      bodyText?: string
      bodyHtml?: string
      subject?: string
      to?: string
      cc?: string
      bcc?: string
      intent?: ReplyIntent
      confidence?: number
      should_escalate?: boolean
    }) => {
      if (!can.replyToTickets(ctx.role)) return fail('Your role cannot send replies.')
      if (!args.bodyText && !args.bodyHtml) return fail('Provide bodyText and/or bodyHtml.')

      const intent: ReplyIntent = args.intent ?? 'unknown'
      const confidence = args.confidence ?? 0
      const shouldEscalate = args.should_escalate ?? false
      const draftText = args.bodyText ?? args.bodyHtml ?? ''

      let decision: Awaited<ReturnType<typeof evaluateMcpSend>>
      try {
        decision = await evaluateMcpSend({
          workspaceId: ctx.workspaceId,
          conversationId: args.conversationId,
          intent,
          confidence,
          shouldEscalate,
        })
      } catch (e) {
        return fail(`send_reply failed during autonomy check: ${e instanceof Error ? e.message : 'unknown error'}`)
      }

      if (!decision.allowed) {
        const draftId = await recordMcpDraft({
          workspaceId: ctx.workspaceId,
          storeId: decision.storeId,
          conversationId: args.conversationId,
          userId: ctx.userId,
          text: draftText,
          intent,
          confidence,
          shouldEscalate,
          autoSent: false,
          blockedReason: decision.reason,
        })
        return ok({
          sent: false,
          drafted: true,
          draftId,
          blockedReason: decision.reason,
          message: `Workspace autonomy rules do not allow auto-sending this reply (${decision.reason}). Saved as a draft for human review.`,
        })
      }

      try {
        const result = await sendReply(ctx.workspaceId, args.conversationId, '', {
          to: args.to ? [{ email: args.to }] : [],
          cc: args.cc ? [{ email: args.cc }] : [],
          bcc: args.bcc ? [{ email: args.bcc }] : [],
          subject: args.subject ?? '',
          bodyHtml: args.bodyHtml ?? '',
          bodyText: args.bodyText ?? '',
        }, undefined)
        const draftId = await recordMcpDraft({
          workspaceId: ctx.workspaceId,
          storeId: decision.storeId,
          conversationId: args.conversationId,
          userId: ctx.userId,
          text: draftText,
          intent,
          confidence,
          shouldEscalate,
          autoSent: true,
          blockedReason: null,
        })
        return ok({ sent: true, draftId, result })
      } catch (e) {
        return fail(`send_reply failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'link_customer',
    {
      description: 'Link a conversation to a Shopify customer id so order context resolves.',
      inputSchema: { conversationId: z.string(), shopifyCustomerId: z.string() },
    },
    async (args: { conversationId: string; shopifyCustomerId: string }) => {
      if (!can.manageConversations(ctx.role)) return fail('Your role cannot link customers.')
      try {
        return ok(await linkCustomer(ctx.workspaceId, args.conversationId, args.shopifyCustomerId))
      } catch (e) {
        return fail(`link_customer failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )

  server.registerTool(
    'list_members',
    {
      description: 'List workspace members (id, name, email, role) so you can assign or escalate a conversation. Use a member id with set_state (assignedTo).',
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await getEnrichedMembers({ workspaceId: ctx.workspaceId }))
      } catch (e) {
        return fail(`list_members failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )
}
