import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await supabaseAdmin
      .from('analytics_actions')
      .select('id, status, picked_up_by, picked_up_at, result_note, updated_at')
      .eq('workspace_id', ctx.workspaceId)

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
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, status, pickedUpBy, resultNote } = await request.json()
    if (!id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Transition: write both client_id (legacy) AND workspace_id. Keep
    // existing onConflict until Phase 4 swaps the unique key.
    const row = {
      id,
      client_id:    ctx.user.id,
      workspace_id: ctx.workspaceId,
      status,
      picked_up_by: pickedUpBy || null,
      picked_up_at: status === 'picked_up' ? new Date().toISOString() : null,
      result_note:  resultNote || null,
      updated_at:   new Date().toISOString(),
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
