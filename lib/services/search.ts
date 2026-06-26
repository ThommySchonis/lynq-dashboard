export interface SearchParams { q?: string; types?: string[]; limit?: number; status?: string[]; assignee?: string[]; dateFrom?: string; dateTo?: string }
export interface SearchDb { rpc(fn: 'api_search', args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> }

export async function searchWorkspace(db: SearchDb, workspaceId: string, params: SearchParams): Promise<unknown> {
  const { data, error } = await db.rpc('api_search', {
    p_workspace_id: workspaceId,
    p_q: params.q ?? null,
    p_types: params.types ?? ['conversations', 'messages', 'contacts'],
    p_status: params.status ?? null,
    p_assignee: params.assignee ?? null,
    p_date_from: params.dateFrom ?? null,
    p_date_to: params.dateTo ?? null,
    p_limit: params.limit ?? 5,
  })
  if (error) throw new Error(`searchWorkspace failed: ${error.message}`)
  return data
}
