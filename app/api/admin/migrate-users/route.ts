import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateBody } from '@/lib/validation'
import { migrateUsersBody } from '@/lib/schemas/admin'
import { isPlatformAdmin } from '@/lib/platformAdmin'

// POST body: { users: [{ id, email, password }] }
// Creates each user in the main Supabase project with the same UUID
// so all existing data (integrations, shopify_orders, etc.) stays linked
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  const isAdmin = await isPlatformAdmin(user?.email)
  if (!user || !isAdmin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const [body, err] = await validateBody(request, migrateUsersBody)
  if (err) return err

  const results = []
  for (const u of body.users) {
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
