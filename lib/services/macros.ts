export interface MacroSummary { id: string; name: string; body: string; language: string; tags: string[]; archived: boolean }
export interface MacroFilters { search?: string; language?: string; includeArchived?: boolean }

interface MacroRow { id: string; name: string; body: string; language: string | null; tags: string[] | null; archived_at: string | null }

interface MacrosQuery {
  select(cols: string): MacrosQuery
  eq(col: string, val: unknown): MacrosQuery
  is(col: string, val: null): MacrosQuery
  ilike(col: string, val: string): MacrosQuery
  order(col: string, opts: { ascending: boolean }): MacrosQuery
  maybeSingle(): Promise<{ data: MacroRow | null; error: { message: string } | null }>
  then(onfulfilled: (r: { data: MacroRow[] | null; error: { message: string } | null }) => unknown): Promise<unknown>
}
export interface MacrosDb { from(table: 'macros'): MacrosQuery }

function mapRow(r: MacroRow): MacroSummary {
  return { id: r.id, name: r.name, body: r.body, language: r.language ?? 'auto', tags: r.tags ?? [], archived: r.archived_at !== null }
}

export async function listMacros(db: MacrosDb, workspaceId: string, filters: MacroFilters): Promise<MacroSummary[]> {
  let q = db.from('macros').select('id, name, body, language, tags, archived_at').eq('workspace_id', workspaceId)
  if (!filters.includeArchived) q = q.is('archived_at', null)
  if (filters.language) q = q.eq('language', filters.language)
  if (filters.search) q = q.ilike('name', `%${filters.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)
  q = q.order('name', { ascending: true })
  const { data, error } = (await q) as unknown as { data: MacroRow[] | null; error: { message: string } | null }
  if (error) throw new Error(`listMacros failed: ${error.message}`)
  return (data ?? []).map(mapRow)
}

export async function getMacro(db: MacrosDb, workspaceId: string, id: string): Promise<MacroSummary | null> {
  const { data, error } = await db.from('macros').select('id, name, body, language, tags, archived_at').eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (error || !data) return null
  return mapRow(data)
}
