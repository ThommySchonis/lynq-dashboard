import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { RouteContext } from '@/types/api'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { validateBody, validateParams } from '@/lib/validation'
import { timeSessionParams, editSessionBody } from '@/lib/schemas/time'
import { logger } from '@/lib/logger'

// PATCH /api/time/[sessionId]
// Manual edit by an owner/admin of the workspace this session lives in.
// Every edit lands an immutable audit row in time_session_edits.

// Fields the editor is allowed to touch. Anything else in the body is ignored.
const EDITABLE_FIELDS = [
  'clocked_in_at',
  'clocked_out_at',
  'emails_answered',
  'what_went_well',
  'needs_attention',
] as const
type EditableField = (typeof EDITABLE_FIELDS)[number]

export async function PATCH(request: NextRequest, { params: routeParams }: RouteContext<{ sessionId: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  if (!['owner', 'admin'].includes(ctx.role)) {
    return NextResponse.json({ error: 'Only owners and admins can edit sessions' }, { status: 403 })
  }

  const [params, paramErr] = validateParams(await routeParams, timeSessionParams)
  if (paramErr) return paramErr

  const [body, bodyErr] = await validateBody(request, editSessionBody)
  if (bodyErr) return bodyErr

  const { sessionId } = params

  // Pull the existing session — must belong to this workspace.
  const sessionLookup = await supabaseAdmin
    .from('time_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  const current = sessionLookup.data as Record<string, unknown> | null
  if (sessionLookup.error || !current) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Build the patch object: only EDITABLE_FIELDS that the caller sent.
  const patch: Partial<Record<EditableField, unknown>> = {}
  const before: Partial<Record<EditableField, unknown>> = {}
  const after:  Partial<Record<EditableField, unknown>> = {}

  const bodyAsRec = body as unknown as Record<string, unknown>
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      const incoming = bodyAsRec[field]
      const currentVal = current[field]
      // Skip no-op fields (no value change → no audit noise).
      if (incoming === currentVal) continue
      patch[field]  = incoming as never
      before[field] = currentVal as never
      after[field]  = incoming as never
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const updateResult = await supabaseAdmin
    .from('time_sessions')
    .update(patch)
    .eq('id', sessionId)
    .eq('workspace_id', ctx.workspaceId)
    .select()
    .single()

  if (updateResult.error) {
    logger.error('[time]', 'session update failed', { error: updateResult.error.message, code: updateResult.error.code })
    return NextResponse.json({ error: 'Could not update session' }, { status: 500 })
  }

  // Append audit log row. Done after the update so we have the canonical
  // post-state. Best-effort: if it fails we still keep the session change.
  const { error: auditErr } = await supabaseAdmin
    .from('time_session_edits')
    .insert({
      session_id:        sessionId,
      edited_by_user_id: ctx.user.id,
      reason:            body.reason.trim(),
      before_json:       before,
      after_json:        after,
    })
  if (auditErr) {
    logger.error('[time]', 'audit log insert failed', { error: auditErr.message })
  }

  return NextResponse.json({ session: updateResult.data as Record<string, unknown>, audited: !auditErr })
}
