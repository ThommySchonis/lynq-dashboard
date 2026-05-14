import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'

// PATCH /api/time/[sessionId]
// Manual edit by an owner/admin of the workspace this session lives in.
// Every edit lands an immutable audit row in time_session_edits.

interface EditPayload {
  clocked_in_at?:  string
  clocked_out_at?: string | null
  emails_answered?: number | null
  what_went_well?:  string | null
  needs_attention?: string | null
  reason:          string
}

// Fields the editor is allowed to touch. Anything else in the body is ignored.
const EDITABLE_FIELDS = [
  'clocked_in_at',
  'clocked_out_at',
  'emails_answered',
  'what_went_well',
  'needs_attention',
] as const
type EditableField = (typeof EDITABLE_FIELDS)[number]

interface RouteContext {
  params: Promise<{ sessionId: string }>
}

export async function PATCH(request: NextRequest, ctxParam: RouteContext) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['owner', 'admin'].includes(ctx.role)) {
    return NextResponse.json({ error: 'Only owners and admins can edit sessions' }, { status: 403 })
  }

  const { sessionId } = await ctxParam.params
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

  let body: EditPayload
  try {
    body = (await request.json()) as EditPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.reason || body.reason.trim().length < 3) {
    return NextResponse.json({ error: 'Reason for edit is required (min. 3 characters)' }, { status: 400 })
  }

  // Pull the existing session — must belong to this workspace.
  const { data: current, error: readErr } = await supabaseAdmin
    .from('time_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (readErr || !current) {
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
      const currentVal = (current as Record<string, unknown>)[field]
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

  // Type-narrow before validation.
  if ('clocked_out_at' in patch && patch.clocked_out_at != null && typeof patch.clocked_out_at !== 'string') {
    return NextResponse.json({ error: 'clocked_out_at must be an ISO string or null' }, { status: 400 })
  }
  if ('emails_answered' in patch && patch.emails_answered != null) {
    const n = patch.emails_answered
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
      return NextResponse.json({ error: 'emails_answered must be a non-negative integer' }, { status: 400 })
    }
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('time_sessions')
    .update(patch)
    .eq('id', sessionId)
    .eq('workspace_id', ctx.workspaceId)
    .select()
    .single()

  if (updateErr) {
    console.error('[time/[sessionId]] update failed', { message: updateErr.message, code: updateErr.code })
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
    console.error('[time/[sessionId]] audit log insert failed', auditErr.message)
  }

  return NextResponse.json({ session: updated, audited: !auditErr })
}
