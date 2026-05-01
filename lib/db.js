/**
 * Workspace-scoping helper for Supabase queries.
 *
 * Every query on workspace-owned tables MUST include a workspace_id filter
 * to prevent cross-workspace data leakage. Use scoped() to apply it.
 *
 * Usage:
 *   const { data } = await scoped(
 *     supabaseAdmin.from('tickets').select('*').order('created_at', { ascending: false }),
 *     ctx.workspaceId
 *   )
 *
 * Workspace-owned tables:
 *   tickets, agents, macros, workspace_members, workspace_invites,
 *   ai_settings, integrations, and any future resource table.
 */
export const scoped = (query, workspaceId) => query.eq('workspace_id', workspaceId)
