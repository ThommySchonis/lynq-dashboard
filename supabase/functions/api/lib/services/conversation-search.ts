import { getAdminClient } from '../supabase.ts'

// Cap per match source, mirroring the inbox list search. Keeping this identical
// across the list and the counts routes is what guarantees the folder badges
// always equal the list contents for a given search.
const SEARCH_MATCH_CAP = 200

export interface SearchScope {
  storeId?: string
  emailAccountId?: string
}

/**
 * Resolve the set of conversation ids matching a free-text `search` across
 * subject / customer_email / customer_name / message body.
 *
 * Scoped ONLY by workspace + store + email account — deliberately NOT by
 * folder (status / spam / unlinked). The caller applies folder predicates
 * afterwards (the list route in its final query, the counts route per bucket),
 * so both derive their folder numbers from the exact same match set.
 *
 * Returns a de-duplicated array of ids (empty array when nothing matches).
 */
export async function resolveSearchConversationIds(
  sb: ReturnType<typeof getAdminClient>,
  workspaceId: string,
  search: string,
  scope: SearchScope = {},
): Promise<string[]> {
  const sanitized = search.replace(/[%_\\]/g, (ch) => `\\${ch}`)
  const pattern = `%${sanitized}%`

  const convIdQuery = () => {
    let q = sb.from('email_conversations').select('id').eq('workspace_id', workspaceId)
    if (scope.storeId) q = q.eq('store_id', scope.storeId)
    if (scope.emailAccountId) q = q.eq('email_account_id', scope.emailAccountId)
    return q
  }

  const [subjectRes, emailRes, nameRes, bodyRes] = await Promise.all([
    convIdQuery().ilike('subject', pattern).limit(SEARCH_MATCH_CAP),
    convIdQuery().ilike('customer_email', pattern).limit(SEARCH_MATCH_CAP),
    convIdQuery().ilike('customer_name', pattern).limit(SEARCH_MATCH_CAP),
    sb
      .from('email_messages')
      .select('conversation_id')
      .eq('workspace_id', workspaceId)
      .ilike('body_text', pattern)
      .limit(SEARCH_MATCH_CAP),
  ])

  const err = subjectRes.error || emailRes.error || nameRes.error || bodyRes.error
  if (err) throw new Error(err.message)

  const idSet = new Set<string>()
  for (const row of subjectRes.data || []) idSet.add((row as { id: string }).id)
  for (const row of emailRes.data || []) idSet.add((row as { id: string }).id)
  for (const row of nameRes.data || []) idSet.add((row as { id: string }).id)
  for (const row of bodyRes.data || []) idSet.add((row as { conversation_id: string }).conversation_id)

  return [...idSet]
}
