export interface InboxDraftsDb {
  from(table: 'ai_drafts'): {
    insert(row: Record<string, unknown>): {
      select(cols: string): {
        single(): Promise<{ data: { id: string } | null; error: { message: string } | null }>
      }
    }
  }
}

export async function createInboxDraft(
  db: InboxDraftsDb,
  input: { workspaceId: string; conversationId: string; userId: string; text: string },
): Promise<{ id: string }> {
  const { data, error } = await db
    .from('ai_drafts')
    .insert({
      workspace_id: input.workspaceId,
      conversation_id: input.conversationId,
      user_id: input.userId,
      suggested_text: input.text,
      prompt_path: 'emma',
      model: 'mcp-claude',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createInboxDraft failed: ${error?.message ?? 'no row'}`)
  return { id: data.id }
}
