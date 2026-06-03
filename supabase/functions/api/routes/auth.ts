import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { getAdminClient } from '../lib/supabase.ts'
import { isPlatformAdmin } from '../lib/platform-admin.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()

// ── Impersonation status (needs cookie access) ──────────────────────

app.get('/impersonation-status', authMiddleware, async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const sessionId = c.req.header('Cookie')?.match(/x-impersonate-session=([^;]+)/)?.[1]
  if (!sessionId) return c.json({ active: false })

  const isAdmin = await isPlatformAdmin(ctx.user.email)
  if (!isAdmin) return c.json({ active: false })

  const { data: session } = await sb
    .from('impersonation_sessions')
    .select('id, target_workspace_id')
    .eq('id', sessionId)
    .eq('admin_user_id', ctx.user.id)
    .is('ended_at', null)
    .maybeSingle()

  if (!session) return c.json({ active: false })

  const typedSession = session as { id: string; target_workspace_id: string }
  const { data: workspace } = await sb
    .from('workspaces')
    .select('*')
    .eq('id', typedSession.target_workspace_id)
    .single()

  return c.json({ active: true, workspace, sessionId: typedSession.id })
})

// ── Consent sync ────────────────────────────────────────────────────

app.post('/consent-sync', authMiddleware, async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const body = await c.req.json()

  if (!body.level) return c.json({ error: 'Consent level required' }, 400)

  const { error } = await sb
    .from('user_profiles')
    .update({
      consent_level: body.level,
      consented_at: new Date().toISOString(),
    })
    .eq('user_id', ctx.user.id)

  if (error) return c.json({ error: 'Failed to sync consent' }, 500)

  return c.json({ ok: true })
})

// ── MFA cleanup ─────────────────────────────────────────────────────

app.delete('/mfa/cleanup', authMiddleware, async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const { data: list, error: listErr } = await sb.auth.admin.mfa.listFactors({
    userId: ctx.user.id,
  })

  if (listErr) return c.json({ error: 'Could not read factors' }, 500)

  const unverified = (list?.factors || []).filter(f => f.status === 'unverified')
  if (unverified.length === 0) return c.json({ deleted: 0 })

  let deleted = 0
  const failures: { id: string; message: string }[] = []

  for (const factor of unverified) {
    const { error } = await sb.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: ctx.user.id,
    })
    if (error) {
      failures.push({ id: factor.id, message: error.message })
    } else {
      deleted += 1
    }
  }

  if (failures.length > 0 && deleted === 0) {
    return c.json({ error: 'Cleanup failed' }, 500)
  }

  return c.json({ deleted, attempted: unverified.length, failures: failures.length || undefined })
})

// ── Recovery codes ──────────────────────────────────────────────────

function generateCodes(count = 10): string[] {
  const buf = new Uint8Array(count * 4)
  crypto.getRandomValues(buf)
  return Array.from({ length: count }, (_, i) => {
    const hex = Array.from(buf.slice(i * 4, i * 4 + 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    return `${hex.slice(0, 4)}-${hex.slice(4)}`
  })
}

app.get('/recovery-codes', authMiddleware, async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const { data, error } = await sb
    .from('user_profiles')
    .select('recovery_codes')
    .eq('user_id', ctx.user.id)
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ recovery_codes: (data as { recovery_codes?: string[] } | null)?.recovery_codes ?? [] })
})

app.post('/recovery-codes', authMiddleware, async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const body = await c.req.json().catch(() => ({}))

  const codes = body.clear ? [] : generateCodes(10)

  const update: Record<string, unknown> = { user_id: ctx.user.id, recovery_codes: codes }
  if (!body.clear) update.mfa_enabled_at = new Date().toISOString()

  const { error } = await sb
    .from('user_profiles')
    .upsert(update, { onConflict: 'user_id' })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ recovery_codes: codes })
})

export { app as authRoutes }
