import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'info@lynqagency.com'

// POST body: { users: [{ id, email, password }] }
// Creates each user in the main Supabase project with the same UUID
// so all existing data (integrations, shopify_orders, etc.) stays linked
export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { users } = await request.json().catch(() => ({ users: [] }))
  if (!users?.length) return NextResponse.json({ error: 'No users provided' }, { status: 400 })

  const results = []
  for (const u of users) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      user_metadata: {},
      email: u.email,
      password: u.password,
      email_confirm: true,
      ...(u.id ? { id: u.id } : {}),
    })

    results.push({
      email: u.email,
      id: data?.user?.id ?? null,
      error: error?.message ?? null,
    })
  }

  return NextResponse.json({ results })
}
