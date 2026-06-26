import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listConversations, getConversation, listTags, addTag, removeTag, setConversationState, type ConversationFilters, type ConversationState } from '@/lib/services/conversations'
import { createInboxDraft } from '@/lib/services/inbox-drafts'
import { sendReply, linkCustomer } from '@/lib/conversationEngine'
import { can } from '@/lib/permissions'
import type { McpToolContext } from '@/mcp/types'

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
      description: 'Send a reply email on a conversation NOW (it goes to the customer immediately). Provide bodyText and/or bodyHtml. Prefer create_draft if a human should review first.',
      inputSchema: {
        conversationId: z.string(),
        bodyText: z.string().optional(),
        bodyHtml: z.string().optional(),
        subject: z.string().optional(),
        to: z.string().optional(),
        cc: z.string().optional(),
        bcc: z.string().optional(),
      },
    },
    async (args: { conversationId: string; bodyText?: string; bodyHtml?: string; subject?: string; to?: string; cc?: string; bcc?: string }) => {
      if (!can.replyToTickets(ctx.role)) return fail('Your role cannot send replies.')
      if (!args.bodyText && !args.bodyHtml) return fail('Provide bodyText and/or bodyHtml.')
      try {
        const result = await sendReply(ctx.workspaceId, args.conversationId, '', {
          to: args.to ? [{ email: args.to }] : [],
          cc: args.cc ? [{ email: args.cc }] : [],
          bcc: args.bcc ? [{ email: args.bcc }] : [],
          subject: args.subject ?? '',
          bodyHtml: args.bodyHtml ?? '',
          bodyText: args.bodyText ?? '',
        }, undefined)
        return ok({ sent: true, result })
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
}
