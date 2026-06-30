import { describe, it, expect, vi, beforeEach } from 'vitest'

const listConversations = vi.fn()
const getConversation = vi.fn()
const listTags = vi.fn()
const addTag = vi.fn()
const removeTag = vi.fn()
const createTag = vi.fn()
const deleteTag = vi.fn()
const setConversationState = vi.fn()
const createInboxDraft = vi.fn()
const sendReply = vi.fn()
const linkCustomer = vi.fn()
const evaluateMcpSend = vi.fn()
const recordMcpDraft = vi.fn()
const getEnrichedMembers = vi.fn()
vi.mock('@/lib/services/mcp-autonomy-gate', () => ({
  evaluateMcpSend: (...a: unknown[]): unknown => evaluateMcpSend(...a),
}))
vi.mock('@/lib/services/mcp-reply-record', () => ({
  recordMcpDraft: (...a: unknown[]): unknown => recordMcpDraft(...a),
}))
vi.mock('@/lib/services/conversations', () => ({
  listConversations: (...a: unknown[]): unknown => listConversations(...a),
  getConversation: (...a: unknown[]): unknown => getConversation(...a),
  listTags: (...a: unknown[]): unknown => listTags(...a),
  addTag: (...a: unknown[]): unknown => addTag(...a),
  removeTag: (...a: unknown[]): unknown => removeTag(...a),
  createTag: (...a: unknown[]): unknown => createTag(...a),
  deleteTag: (...a: unknown[]): unknown => deleteTag(...a),
  setConversationState: (...a: unknown[]): unknown => setConversationState(...a),
}))
vi.mock('@/lib/services/inbox-drafts', () => ({
  createInboxDraft: (...a: unknown[]): unknown => createInboxDraft(...a),
}))
vi.mock('@/lib/conversationEngine', () => ({
  sendReply: (...a: unknown[]): unknown => sendReply(...a),
  linkCustomer: (...a: unknown[]): unknown => linkCustomer(...a),
}))
vi.mock('@/lib/services/workspace-members', () => ({
  getEnrichedMembers: (...a: unknown[]): unknown => getEnrichedMembers(...a),
}))
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: {} }))
vi.mock('@/lib/permissions', () => ({
  can: {
    manageTags: (role: string) => ['owner', 'admin', 'agent'].includes(role),
    deleteTags: (role: string) => ['owner', 'admin'].includes(role),
    manageConversations: (role: string) => ['owner', 'admin', 'agent'].includes(role),
    replyToTickets: (role: string) => ['owner', 'admin', 'agent'].includes(role),
  },
}))

import { registerInboxTools } from '@/mcp/tools/inbox'
import type { McpToolContext } from '@/mcp/types'

interface Reg { handler: (args: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }> }
function fakeServer() {
  const tools: Record<string, Reg> = {}
  const server = {
    registerTool: (n: string, _c: unknown, h: Reg['handler']) => { tools[n] = { handler: h } },
    tool: (n: string, _s: unknown, h: Reg['handler']) => { tools[n] = { handler: h } },
  }
  return { server, tools }
}
const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'agent' }
beforeEach(() => {
  listConversations.mockReset()
  getConversation.mockReset()
  listTags.mockReset()
  addTag.mockReset()
  removeTag.mockReset()
  createTag.mockReset()
  deleteTag.mockReset()
  setConversationState.mockReset()
  createInboxDraft.mockReset()
  sendReply.mockReset()
  linkCustomer.mockReset()
  evaluateMcpSend.mockReset()
  recordMcpDraft.mockReset()
  getEnrichedMembers.mockReset()
})

describe('registerInboxTools / list_conversations', () => {
  it('registers list_conversations', () => {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, ctx)
    expect(tools.list_conversations).toBeDefined()
  })
  it('calls the service scoped to ctx workspace', async () => {
    const { server, tools } = fakeServer()
    listConversations.mockResolvedValue([{ id: 'c1' }])
    registerInboxTools(server as never, ctx)
    const res = await tools.list_conversations.handler({ status: 'open' })
    expect(listConversations).toHaveBeenCalledWith(expect.anything(), 'w1', { status: 'open' })
    expect(res.content[0].text).toContain('c1')
  })
})

describe('registerInboxTools / get_conversation', () => {
  it('registers get_conversation', () => {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, ctx)
    expect(tools.get_conversation).toBeDefined()
  })
  it('returns not-found error when service returns null', async () => {
    const { server, tools } = fakeServer()
    getConversation.mockResolvedValue(null)
    registerInboxTools(server as never, ctx)
    const res = await tools.get_conversation.handler({ id: 'missing' })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain('not found')
  })
  it('returns detail data when service returns a conversation', async () => {
    const { server, tools } = fakeServer()
    getConversation.mockResolvedValue({ id: 'c1', subject: 'Hi', customer_email: 'a@b.c', customer_name: 'A', status: 'open', last_message_at: 't', store_name: null, tags: [], shopify_customer_id: null, assigned_to: null, snoozed_until: null, messages: [{ id: 'm1', from_email: 'a@b.c', from_name: 'A', body_text: 'hello', body_html: null, is_outbound: false, created_at: 't' }] })
    registerInboxTools(server as never, ctx)
    const res = await tools.get_conversation.handler({ id: 'c1' })
    expect(res.isError).toBeUndefined()
    expect(res.content[0].text).toContain('c1')
    expect(res.content[0].text).toContain('hello')
  })
})

describe('registerInboxTools / tags', () => {
  describe('list_tags', () => {
    it('registers list_tags', () => {
      const { server, tools } = fakeServer()
      registerInboxTools(server as never, ctx)
      expect(tools.list_tags).toBeDefined()
    })
    it('calls the service and returns tags', async () => {
      const { server, tools } = fakeServer()
      listTags.mockResolvedValue([{ id: 't1', name: 'VIP', color: 'red' }])
      registerInboxTools(server as never, ctx)
      const res = await tools.list_tags.handler({})
      expect(listTags).toHaveBeenCalledWith(expect.anything(), 'w1')
      expect(res.content[0].text).toContain('t1')
      expect(res.content[0].text).toContain('VIP')
    })
  })

  describe('add_tag', () => {
    it('registers add_tag', () => {
      const { server, tools } = fakeServer()
      registerInboxTools(server as never, ctx)
      expect(tools.add_tag).toBeDefined()
    })
    it('agent can add a tag', async () => {
      const { server, tools } = fakeServer()
      addTag.mockResolvedValue(undefined)
      registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'agent' })
      const res = await tools.add_tag.handler({ conversationId: 'c1', tagId: 't1' })
      expect(addTag).toHaveBeenCalledWith(expect.anything(), 'w1', 'c1', 't1')
      expect(res.isError).toBeUndefined()
    })
    it('observer cannot add a tag', async () => {
      const { server, tools } = fakeServer()
      registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'observer' })
      const res = await tools.add_tag.handler({ conversationId: 'c1', tagId: 't1' })
      expect(res.isError).toBe(true)
      expect(addTag).not.toHaveBeenCalled()
    })
  })

  describe('remove_tag', () => {
    it('registers remove_tag', () => {
      const { server, tools } = fakeServer()
      registerInboxTools(server as never, ctx)
      expect(tools.remove_tag).toBeDefined()
    })
    it('agent can remove a tag', async () => {
      const { server, tools } = fakeServer()
      removeTag.mockResolvedValue(undefined)
      registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'agent' })
      const res = await tools.remove_tag.handler({ conversationId: 'c1', tagId: 't1' })
      expect(removeTag).toHaveBeenCalledWith(expect.anything(), 'w1', 'c1', 't1')
      expect(res.isError).toBeUndefined()
    })
    it('observer cannot remove a tag', async () => {
      const { server, tools } = fakeServer()
      registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'observer' })
      const res = await tools.remove_tag.handler({ conversationId: 'c1', tagId: 't1' })
      expect(res.isError).toBe(true)
      expect(removeTag).not.toHaveBeenCalled()
    })
  })

  describe('create_tag', () => {
    it('registers create_tag', () => {
      const { server, tools } = fakeServer()
      registerInboxTools(server as never, ctx)
      expect(tools.create_tag).toBeDefined()
    })
    it('observer cannot create a tag', async () => {
      const { server, tools } = fakeServer()
      registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'observer' })
      const res = await tools.create_tag.handler({ name: 'VIP' })
      expect(res.isError).toBe(true)
      expect(createTag).not.toHaveBeenCalled()
    })
    it('agent can create a tag', async () => {
      const { server, tools } = fakeServer()
      createTag.mockResolvedValue({ id: 't1', name: 'VIP', color: 'red' })
      registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'agent' })
      const res = await tools.create_tag.handler({ name: 'VIP' })
      expect(createTag).toHaveBeenCalledWith(expect.anything(), 'w1', 'u1', { name: 'VIP' })
      expect(res.isError).toBeUndefined()
      expect(res.content[0].text).toContain('t1')
    })
  })

  describe('delete_tag', () => {
    it('registers delete_tag', () => {
      const { server, tools } = fakeServer()
      registerInboxTools(server as never, ctx)
      expect(tools.delete_tag).toBeDefined()
    })
    it('agent cannot delete a tag', async () => {
      const { server, tools } = fakeServer()
      registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'agent' })
      const res = await tools.delete_tag.handler({ tagId: 't1' })
      expect(res.isError).toBe(true)
      expect(deleteTag).not.toHaveBeenCalled()
    })
    it('admin can delete a tag', async () => {
      const { server, tools } = fakeServer()
      deleteTag.mockResolvedValue(undefined)
      registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'admin' })
      const res = await tools.delete_tag.handler({ tagId: 't1' })
      expect(deleteTag).toHaveBeenCalledWith(expect.anything(), 'w1', 't1')
      expect(res.isError).toBeUndefined()
      expect(res.content[0].text).toContain('deleted')
    })
  })
})

describe('registerInboxTools / set_state', () => {
  it('registers set_state', () => {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, ctx)
    expect(tools.set_state).toBeDefined()
  })
  it('observer cannot change state', async () => {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'observer' })
    const res = await tools.set_state.handler({ conversationId: 'c1', status: 'resolved' })
    expect(res.isError).toBe(true)
    expect(setConversationState).not.toHaveBeenCalled()
  })
  it('agent can change status', async () => {
    const { server, tools } = fakeServer()
    setConversationState.mockResolvedValue(undefined)
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'agent' })
    const res = await tools.set_state.handler({ conversationId: 'c1', status: 'resolved' })
    expect(setConversationState).toHaveBeenCalledWith(expect.anything(), 'w1', 'c1', { status: 'resolved' })
    expect(res.isError).toBeUndefined()
  })
})

describe('registerInboxTools / create_draft', () => {
  it('registers create_draft', () => {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, ctx)
    expect(tools.create_draft).toBeDefined()
  })
  it('observer cannot draft', async () => {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'observer' })
    const res = await tools.create_draft.handler({ conversationId: 'c1', text: 'hello' })
    expect(res.isError).toBe(true)
    expect(createInboxDraft).not.toHaveBeenCalled()
  })
  it('agent can create a draft', async () => {
    const { server, tools } = fakeServer()
    createInboxDraft.mockResolvedValue({ id: 'd1' })
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'agent' })
    const res = await tools.create_draft.handler({ conversationId: 'c1', text: 'hello there' })
    expect(createInboxDraft).toHaveBeenCalledWith(expect.anything(), { workspaceId: 'w1', conversationId: 'c1', userId: 'u1', text: 'hello there' })
    expect(res.isError).toBeUndefined()
    expect(res.content[0].text).toContain('d1')
  })
})

describe('send_reply', () => {
  beforeEach(() => {
    sendReply.mockReset()
    evaluateMcpSend.mockResolvedValue({ allowed: true, reason: null, storeId: 's1' })
    recordMcpDraft.mockResolvedValue('d-legacy')
  })
  it('observer cannot send', async () => {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'observer' })
    const res = await tools.send_reply.handler({ conversationId: 'c1', bodyText: 'hi' })
    expect(res.isError).toBe(true)
    expect(sendReply).not.toHaveBeenCalled()
  })
  it('agent sends via the engine scoped to workspace', async () => {
    const { server, tools } = fakeServer()
    sendReply.mockResolvedValue({ messageId: 'm1' })
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'agent' })
    await tools.send_reply.handler({ conversationId: 'c1', bodyText: 'hi', subject: 'Re' })
    expect(sendReply).toHaveBeenCalledWith('w1', 'c1', '', expect.objectContaining({ bodyText: 'hi' }), undefined)
  })
  it('converts to string to EmailAddress array', async () => {
    const { server, tools } = fakeServer()
    sendReply.mockResolvedValue({ messageId: 'm2' })
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'agent' })
    await tools.send_reply.handler({ conversationId: 'c1', bodyText: 'hi', to: 'x@y.com' })
    expect(sendReply).toHaveBeenCalledWith('w1', 'c1', '', expect.objectContaining({ to: [{ email: 'x@y.com' }] }), undefined)
  })
})

describe('link_customer', () => {
  beforeEach(() => linkCustomer.mockReset())
  it('agent links a shopify customer id', async () => {
    const { server, tools } = fakeServer()
    linkCustomer.mockResolvedValue({ success: true })
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'agent' })
    await tools.link_customer.handler({ conversationId: 'c1', shopifyCustomerId: 'cust1' })
    expect(linkCustomer).toHaveBeenCalledWith('w1', 'c1', 'cust1')
  })
})

describe('send_reply autonomy enforcement', () => {
  function getSendReply() {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, ctx)
    return tools.send_reply.handler
  }

  it('sends when the gate allows and records an auto_sent draft', async () => {
    evaluateMcpSend.mockResolvedValue({ allowed: true, reason: null, storeId: 's1' })
    recordMcpDraft.mockResolvedValue('d1')
    sendReply.mockResolvedValue({ ok: true })
    const handler = getSendReply()
    const res = await handler({ conversationId: 'c1', bodyText: 'hello', intent: 'wismo', confidence: 0.95 })
    expect(sendReply).toHaveBeenCalled()
    expect(res.isError).toBeUndefined()
    expect(res.content[0].text).toContain('"sent": true')
    expect(recordMcpDraft).toHaveBeenCalledWith(expect.objectContaining({ autoSent: true }))
  })

  it('does NOT send when blocked and drafts instead with the reason', async () => {
    evaluateMcpSend.mockResolvedValue({ allowed: false, reason: 'blocked_intent', storeId: 's1' })
    recordMcpDraft.mockResolvedValue('d2')
    const handler = getSendReply()
    const res = await handler({ conversationId: 'c1', bodyText: 'a refund for you', intent: 'refund_or_cancel', confidence: 1 })
    expect(sendReply).not.toHaveBeenCalled()
    expect(res.content[0].text).toContain('"drafted": true')
    expect(res.content[0].text).toContain('blocked_intent')
    expect(recordMcpDraft).toHaveBeenCalledWith(expect.objectContaining({ autoSent: false, blockedReason: 'blocked_intent' }))
  })

  it('defaults missing intent/confidence to a safe draft (gate blocks)', async () => {
    evaluateMcpSend.mockResolvedValue({ allowed: false, reason: 'confidence_low', storeId: 's1' })
    recordMcpDraft.mockResolvedValue('d3')
    const handler = getSendReply()
    await handler({ conversationId: 'c1', bodyText: 'hello' })
    expect(evaluateMcpSend).toHaveBeenCalledWith(expect.objectContaining({ intent: 'unknown', confidence: 0, shouldEscalate: false }))
    expect(sendReply).not.toHaveBeenCalled()
  })

  it('rejects a role that cannot reply', async () => {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'observer' })
    const res = await tools.send_reply.handler({ conversationId: 'c1', bodyText: 'hi' })
    expect(res.isError).toBe(true)
    expect(evaluateMcpSend).not.toHaveBeenCalled()
  })
})

describe('list_members', () => {
  it('lists workspace members scoped to the workspace', async () => {
    getEnrichedMembers.mockResolvedValue([{ id: 'u1', workspace_id: 'w1', email: 'a@b.com', name: 'Aya', role: 'agent', joined_at: 't' }])
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, ctx)
    const res = await tools.list_members.handler({})
    expect(getEnrichedMembers).toHaveBeenCalledWith({ workspaceId: 'w1' })
    expect(res.content[0].text).toContain('Aya')
  })
})
