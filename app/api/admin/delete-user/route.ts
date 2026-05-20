import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { getAuthContext } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { deleteUserQuery } from '@/lib/schemas/admin'

const ADMIN_EMAIL = 'info@lynqagency.com'

// `id` query param is the user_id (= auth.users.id). Same value that
// team_members.id stored pre-refactor, so the mutation contract is unchanged.
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Scope the delete to the admin's own workspace — guards against
  // accidentally removing a membership from a different workspace via a
  // crafted id. The admin can only remove members from their own workspace
  // through this endpoint.
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, err] = validateQuery(request, deleteUserQuery)
  if (err) return err

  await supabaseAdmin
    .from('workspace_members')
    .delete()
    .eq('user_id', query.id)
    .eq('workspace_id', ctx.workspaceId)

  await supabaseAdmin.auth.admin.deleteUser(query.id)

  return NextResponse.json({ ok: true })
}
