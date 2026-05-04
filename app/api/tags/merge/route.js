import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../lib/auth'
import { can } from '../../../../lib/permissions'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// POST /api/tags/merge — body: { winner_id, loser_ids: [] }
// Reassigns all macro_tags from losers → winner, then deletes losers.
export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.deleteTags(ctx.role)) {
    return NextResponse.json({ error: 'Only owners and admins can merge tags.', code: 'permission_denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const winnerId = typeof body.winner_id === 'string' ? body.winner_id : null
  const loserIds = Array.isArray(body.loser_ids)
    ? body.loser_ids.filter(id => typeof id === 'string' && id !== winnerId)
    : []

  if (!winnerId || loserIds.length === 0) {
    return NextResponse.json({ error: 'winner_id and at least one loser_id required', code: 'invalid_input' }, { status: 400 })
  }

  // Verify all referenced tags belong to this workspace
  const allIds = [winnerId, ...loserIds]
  const { data: workspaceTags, error: lookupError } = await supabaseAdmin
    .from('tags')
    .select('id, name')
    .eq('workspace_id', ctx.workspaceId)
    .in('id', allIds)

  if (lookupError) {
    console.error('[tags merge] lookup failed:', lookupError.message)
    return NextResponse.json({ error: lookupError.message, code: 'lookup_failed' }, { status: 500 })
  }
  if (!workspaceTags || workspaceTags.length !== allIds.length) {
    return NextResponse.json({ error: 'One or more tags not found in this workspace', code: 'not_found' }, { status: 404 })
  }

  // Find macros that ALREADY link to the winner — we cannot insert duplicate
  // (macro_id, tag_id) PK rows. For those, we just delete the loser links.
  const { data: existingWinnerLinks } = await supabaseAdmin
    .from('macro_tags')
    .select('macro_id')
    .eq('tag_id', winnerId)
  const macrosAlreadyOnWinner = new Set((existingWinnerLinks || []).map(r => r.macro_id))

  // Pull all loser links
  const { data: loserLinks, error: loserError } = await supabaseAdmin
    .from('macro_tags')
    .select('macro_id, tag_id')
    .in('tag_id', loserIds)

  if (loserError) {
    console.error('[tags merge] loser-link lookup failed:', loserError.message)
    return NextResponse.json({ error: loserError.message, code: 'lookup_failed' }, { status: 500 })
  }

  // Insert winner links for macros that don't already have it
  const newWinnerLinks = []
  const seenMacros     = new Set()
  for (const link of loserLinks || []) {
    if (macrosAlreadyOnWinner.has(link.macro_id)) continue
    if (seenMacros.has(link.macro_id)) continue
    seenMacros.add(link.macro_id)
    newWinnerLinks.push({ macro_id: link.macro_id, tag_id: winnerId })
  }

  if (newWinnerLinks.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('macro_tags')
      .insert(newWinnerLinks)
    if (insertError) {
      console.error('[tags merge] winner-link insert failed:', insertError.message)
      return NextResponse.json({ error: insertError.message, code: 'merge_failed' }, { status: 500 })
    }
  }

  // Delete the losers — FK cascade removes their macro_tags rows
  const { error: deleteError } = await supabaseAdmin
    .from('tags')
    .delete()
    .eq('workspace_id', ctx.workspaceId)
    .in('id', loserIds)

  if (deleteError) {
    console.error('[tags merge] loser delete failed:', deleteError.message)
    return NextResponse.json({ error: deleteError.message, code: 'merge_failed' }, { status: 500 })
  }

  const winner = workspaceTags.find(t => t.id === winnerId)
  console.log(`[tags merge] workspace=${ctx.workspaceId} winner="${winner?.name}" merged=${loserIds.length}`)

  return NextResponse.json({
    ok:        true,
    winner_id: winnerId,
    merged_count: loserIds.length,
    reassigned_links: newWinnerLinks.length,
  })
}
