import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

/*
  SQL to create this table in Supabase:

  create table analytics_actions (
    id text not null,
    client_id uuid not null,
    status text not null default 'open',
    picked_up_by text,
    picked_up_at timestamptz,
    result_note text,
    updated_at timestamptz default now(),
    primary key (id, client_id)
  );
*/

async function auth(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  return await getUserFromToken(token)
}

export async function GET(request) {
  const user = await auth(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await supabaseAdmin
      .from('analytics_actions')
      .select('id, status, picked_up_by, picked_up_at, result_note, updated_at')
      .eq('client_id', user.id)

    if (error) {
      return NextResponse.json({ fallback: true, actions: [] })
    }

    const map = {}
    for (const row of data || []) {
      map[row.id] = {
        status: row.status,
        pickedUpBy: row.picked_up_by,
        pickedUpAt: row.picked_up_at,
        resultNote: row.result_note,
        updatedAt: row.updated_at,
      }
    }

    return NextResponse.json({ actions: map })
  } catch {
    return NextResponse.json({ fallback: true, actions: [] })
  }
}

export async function PATCH(request) {
  const user = await auth(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, status, pickedUpBy, resultNote } = await request.json()
    if (!id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const row = {
      id,
      client_id: user.id,
      status,
      picked_up_by: pickedUpBy || null,
      picked_up_at: status === 'picked_up' ? new Date().toISOString() : null,
      result_note: resultNote || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabaseAdmin
      .from('analytics_actions')
      .upsert(row, { onConflict: 'id,client_id' })

    if (error) return NextResponse.json({ fallback: true })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ fallback: true })
  }
}
