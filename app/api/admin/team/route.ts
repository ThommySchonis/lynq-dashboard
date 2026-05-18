import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { getEnrichedMembers } from '../../../../lib/services/workspace-members'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAIL = 'info@lynqagency.com'

// GET /api/admin/team
//
// Returns workspace_members for the admin's own workspace, enriched with
// email + display_name. Replaces the anon-client query against the
// (now-deprecated) team_members table — the anon client can't join with
// auth.users so we need a server-side route.
//
// Response shape stays {id, name, email, role, created_at} so the admin
// UI doesn't need restructuring. `id` aliases workspace_members.user_id
// (= auth.users.id), matching the old team_members.id contract.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const enriched = await getEnrichedMembers({ workspaceId: ctx.workspaceId })

  const members = enriched.map(m => ({
    id:         m.id,           // = auth.users.id
    name:       m.name,
    email:      m.email,
    role:       m.role,
    created_at: m.joined_at,    // keep field name compatible with the old shape
  }))

  // Reverse-chrono order (matches old `.order('created_at', { ascending: false })`).
  members.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  // Lightweight cache hint for downstream — TanStack manages the real cache.
  return NextResponse.json(members, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
