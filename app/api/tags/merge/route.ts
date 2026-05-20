import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { can } from '@/lib/permissions'
import type { Role } from '@/types/database'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateBody } from '@/lib/validation'
import { mergeTagsBody } from '@/lib/schemas/tags'

interface MacroTagLink {
  macro_id: string
  tag_id: string
}

interface TagRow {
  id: string
  name: string
}

// POST /api/tags/merge — body: { winner_id, loser_ids: [] }
// Reassigns all macro_tags from losers -> winner, then deletes losers.
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.deleteTags(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only owners and admins can merge tags.', code: 'permission_denied' }, { status: 403 })
  }

  const [body, err] = await validateBody(request, mergeTagsBody)
  if (err) return err

  const winnerId = body.winner_id
  const loserIds = body.loser_ids.filter(id => id !== winnerId)

  if (loserIds.length === 0) {
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
  const macrosAlreadyOnWinner = new Set((existingWinnerLinks || []).map((r: { macro_id: string }) => r.macro_id))

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
  const newWinnerLinks: { macro_id: string; tag_id: string }[] = []
  const seenMacros     = new Set<string>()
  for (const link of (loserLinks || []) as MacroTagLink[]) {
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

  const winner = ((workspaceTags || []) as TagRow[]).find(t => t.id === winnerId)
  console.log(`[tags merge] workspace=${ctx.workspaceId} winner="${winner?.name}" merged=${loserIds.length}`)

  return NextResponse.json({
    ok:        true,
    winner_id: winnerId,
    merged_count: loserIds.length,
    reassigned_links: newWinnerLinks.length,
  })
}
