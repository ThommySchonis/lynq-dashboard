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

export interface ConversationSummary {
  id: string
  subject: string | null
  customer_email: string | null
  customer_name: string | null
  status: string
  last_message_at: string | null
  store_name: string | null
  tags: string[]
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

export interface ConversationsDb {
  from(table: 'email_conversations'): QueryChain
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

  return (data ?? []).map((row): ConversationSummary => {
    const store = row.stores as { name: string } | null
    return {
      id: row.id as string,
      subject: (row.subject as string | null) ?? null,
      customer_email: (row.customer_email as string | null) ?? null,
      customer_name: (row.customer_name as string | null) ?? null,
      status: row.status as string,
      last_message_at: (row.last_message_at as string | null) ?? null,
      store_name: store?.name ?? null,
      tags: [],
    }
  })
}
