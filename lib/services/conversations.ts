const PAGE_SIZE = 50

export interface ConversationFilters {
  search?: string
  status?: string
  storeId?: string
  emailAccountId?: string
  unlinked?: boolean
  spam?: boolean
  page?: number
}

export interface ConversationTag {
  id: string
  name: string
  color: string | null
}

export interface ConversationMessage {
  id: string
  from_email: string | null
  from_name: string | null
  body_text: string | null
  body_html: string | null
  is_outbound: boolean
  created_at: string
}

export interface ConversationSummary {
  id: string
  subject: string | null
  customer_email: string | null
  customer_name: string | null
  status: string
  last_message_at: string | null
  store_name: string | null
  tags: ConversationTag[]
}

export interface ConversationDetail extends ConversationSummary {
  shopify_customer_id: string | null
  assigned_to: string | null
  snoozed_until: string | null
  messages: ConversationMessage[]
}

interface QueryChain {
  select(cols: string): QueryChain
  eq(col: string, val: unknown): QueryChain
  neq(col: string, val: unknown): QueryChain
  is(col: string, val: null): QueryChain
  order(col: string, opts: { ascending: boolean }): QueryChain
  range(from: number, to: number): QueryChain
  then(
    onfulfilled: (r: { data: Record<string, unknown>[] | null; error: { message: string } | null }) => unknown,
  ): Promise<unknown>
}

export type ConversationState =
  | { status: 'open' | 'pending' | 'resolved' | 'closed' }
  | { status: 'snoozed'; snoozedUntil: string }
  | { assignedTo: string | null }

export interface ConversationsDb {
  from(table: 'email_conversations'): {
    select(cols: string): {
      eq(col: string, val: unknown): {
        eq(col: string, val: unknown): {
          maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
        }
        neq(col: string, val: unknown): QueryChain
        is(col: string, val: null): QueryChain
        order(col: string, opts: { ascending: boolean }): QueryChain
        range(from: number, to: number): QueryChain
      }
    }
    then(onfulfilled: (r: { data: Record<string, unknown>[] | null; error: { message: string } | null }) => unknown): Promise<unknown>
    update(patch: Record<string, unknown>): {
      eq(col: string, val: unknown): {
        eq(col: string, val: unknown): Promise<{ error: { message: string } | null }>
      }
    }
  }
  from(table: 'email_messages'): {
    select(cols: string): {
      eq(col: string, val: unknown): {
        eq(col: string, val: unknown): {
          order(col: string, opts: { ascending: boolean }): Promise<{ data: ConversationMessage[] | null; error: { message: string } | null }>
        }
      }
    }
  }
  from(table: 'email_conversation_tags'): {
    select(cols: string): {
      eq(col: string, val: unknown): {
        in(col: string, vals: string[]): Promise<{ data: { conversation_id: string; tag_id: string }[] | null; error: { message: string } | null }>
      }
    }
    upsert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>
    delete(): {
      eq(col: string, val: unknown): {
        eq(col: string, val: unknown): {
          eq(col: string, val: unknown): Promise<{ error: { message: string } | null }>
        }
      }
    }
  }
  from(table: 'tags'): {
    select(cols: string): {
      eq(col: string, val: unknown): {
        in(col: string, vals: string[]): Promise<{ data: ConversationTag[] | null; error: { message: string } | null }>
        order(col: string, opts: { ascending: boolean }): Promise<{ data: ConversationTag[] | null; error: { message: string } | null }>
      }
    }
    insert(row: Record<string, unknown>): {
      select(cols: string): {
        single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }
    delete(): {
      eq(col: string, val: unknown): {
        eq(col: string, val: unknown): Promise<{ error: { message: string } | null }>
      }
    }
  }
}

export async function listConversations(
  db: ConversationsDb,
  workspaceId: string,
  filters: ConversationFilters,
): Promise<ConversationSummary[]> {
  const page = filters.page ?? 0
  let query = db
    .from('email_conversations')
    .select('id, subject, customer_email, customer_name, status, last_message_at, stores(name)')
    .eq('workspace_id', workspaceId)
    .order('last_message_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.spam === true) query = query.eq('is_spam', true)
  else query = query.neq('is_spam', true)
  if (filters.unlinked === true) query = query.is('shopify_customer_id', null).neq('status', 'closed')
  if (filters.storeId) query = query.eq('store_id', filters.storeId)
  if (filters.emailAccountId) query = query.eq('email_account_id', filters.emailAccountId)

  const { data, error } = (await query) as unknown as {
    data: Record<string, unknown>[] | null
    error: { message: string } | null
  }
  if (error) throw new Error(`listConversations failed: ${error.message}`)

  const rows = data ?? []
  const ids = rows.map((r) => r.id as string)
  const tagsByConv = await loadTags(db, workspaceId, ids)

  return rows.map((row): ConversationSummary => {
    const store = row.stores as { name: string } | null
    return {
      id: row.id as string,
      subject: (row.subject as string | null) ?? null,
      customer_email: (row.customer_email as string | null) ?? null,
      customer_name: (row.customer_name as string | null) ?? null,
      status: row.status as string,
      last_message_at: (row.last_message_at as string | null) ?? null,
      store_name: store?.name ?? null,
      tags: tagsByConv[row.id as string] ?? [],
    }
  })
}

export async function loadTags(
  db: ConversationsDb,
  workspaceId: string,
  conversationIds: string[],
): Promise<Record<string, ConversationTag[]>> {
  if (conversationIds.length === 0) return {}
  const links = (await db
    .from('email_conversation_tags')
    .select('conversation_id, tag_id')
    .eq('workspace_id', workspaceId)
    .in('conversation_id', conversationIds)) as unknown as { data: { conversation_id: string; tag_id: string }[] | null; error: { message: string } | null }
  if (links.error || !links.data?.length) return {}

  const tagIds = [...new Set(links.data.map((l) => l.tag_id))]
  const tagRows = (await db
    .from('tags')
    .select('id, name, color')
    .eq('workspace_id', workspaceId)
    .in('id', tagIds)) as unknown as { data: ConversationTag[] | null; error: { message: string } | null }
  const byId = new Map((tagRows.data ?? []).map((t) => [t.id, t]))

  const out: Record<string, ConversationTag[]> = {}
  for (const link of links.data) {
    const tag = byId.get(link.tag_id)
    if (!tag) continue
    ;(out[link.conversation_id] ??= []).push(tag)
  }
  return out
}

export async function getConversation(
  db: ConversationsDb,
  workspaceId: string,
  id: string,
): Promise<ConversationDetail | null> {
  const conv = (await db
    .from('email_conversations')
    .select('id, subject, customer_email, customer_name, status, last_message_at, shopify_customer_id, assigned_to, snoozed_until')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .maybeSingle()) as unknown as { data: Record<string, unknown> | null; error: { message: string } | null }
  if (conv.error || !conv.data) return null
  const row = conv.data

  const msgs = (await db
    .from('email_messages')
    .select('id, from_email, from_name, body_text, body_html, is_outbound, created_at')
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })) as unknown as { data: ConversationMessage[] | null; error: { message: string } | null }

  // Mark read (best-effort).
  await db.from('email_conversations').update({ is_unread: false }).eq('workspace_id', workspaceId).eq('id', id)

  const tagsByConv = await loadTags(db, workspaceId, [id])

  return {
    id: row.id as string,
    subject: (row.subject as string | null) ?? null,
    customer_email: (row.customer_email as string | null) ?? null,
    customer_name: (row.customer_name as string | null) ?? null,
    status: row.status as string,
    last_message_at: (row.last_message_at as string | null) ?? null,
    store_name: null,
    shopify_customer_id: (row.shopify_customer_id as string | null) ?? null,
    assigned_to: (row.assigned_to as string | null) ?? null,
    snoozed_until: (row.snoozed_until as string | null) ?? null,
    tags: tagsByConv[id] ?? [],
    messages: msgs.data ?? [],
  }
}

export async function listTags(
  db: ConversationsDb,
  workspaceId: string,
): Promise<ConversationTag[]> {
  const res = (await db
    .from('tags')
    .select('id, name, color')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true })) as unknown as { data: ConversationTag[] | null; error: { message: string } | null }
  if (res.error) throw new Error(`listTags failed: ${res.error.message}`)
  return res.data ?? []
}

export async function addTag(
  db: ConversationsDb,
  workspaceId: string,
  conversationId: string,
  tagId: string,
): Promise<void> {
  const { error } = await db
    .from('email_conversation_tags')
    .upsert({ workspace_id: workspaceId, conversation_id: conversationId, tag_id: tagId })
  if (error) throw new Error(`addTag failed: ${error.message}`)
}

export async function removeTag(
  db: ConversationsDb,
  workspaceId: string,
  conversationId: string,
  tagId: string,
): Promise<void> {
  const { error } = await db
    .from('email_conversation_tags')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', conversationId)
    .eq('tag_id', tagId)
  if (error) throw new Error(`removeTag failed: ${error.message}`)
}

export async function setConversationState(
  db: ConversationsDb,
  workspaceId: string,
  conversationId: string,
  state: ConversationState,
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if ('assignedTo' in state) patch.assigned_to = state.assignedTo
  else if (state.status === 'snoozed') {
    patch.status = 'snoozed'
    patch.snoozed_until = state.snoozedUntil
  } else patch.status = state.status

  const { error } = await db.from('email_conversations').update(patch).eq('workspace_id', workspaceId).eq('id', conversationId)
  if (error) throw new Error(`setConversationState failed: ${error.message}`)
}

export async function createTag(
  db: ConversationsDb,
  workspaceId: string,
  userId: string,
  input: { name: string; color?: string },
): Promise<ConversationTag> {
  const result = await db
    .from('tags')
    .insert({ workspace_id: workspaceId, name: input.name, color: input.color ?? 'slate', created_by: userId })
    .select('id, name, color')
    .single()
  const { data, error } = result as { data: ConversationTag | null; error: { message: string } | null }
  if (error || !data) throw new Error(`createTag failed: ${error?.message ?? 'no row'}`)
  return data
}

export async function deleteTag(db: ConversationsDb, workspaceId: string, tagId: string): Promise<void> {
  // FK cascade removes email_conversation_tags / macro_tags references.
  const { error } = await db.from('tags').delete().eq('workspace_id', workspaceId).eq('id', tagId)
  if (error) throw new Error(`deleteTag failed: ${error.message}`)
}
