import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../../lib/auth'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

// Forcibly remove orphaned (status='unverified') MFA factors for the
// authenticated user. Required because the user-scoped
// supabase.auth.mfa.unenroll() call does not always purge unverified
// factors at AAL1, leaving a row with friendly_name='' that blocks the
// next mfa.enroll() call with a UNIQUE-constraint error.
//
// Uses the admin SDK (deleteFactor) — available in @supabase/supabase-js
// v2.103.x. Refuses to delete verified factors as a safety guard, even
// though the UI never sends them here: this endpoint is for cleanup only.
export async function DELETE(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.mfa.listFactors({
    userId: ctx.user.id,
  })

  if (listErr) {
    console.error('[mfa/cleanup] listFactors failed', {
      message: listErr.message, code: listErr.code, status: listErr.status,
    })
    const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
    return NextResponse.json(
      isProd ? { error: 'Could not read factors' } : { error: listErr.message, code: listErr.code },
      { status: 500 }
    )
  }

  const unverified = (list?.factors || []).filter(f => f.status === 'unverified')
  if (unverified.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  let deleted = 0
  const failures = []

  for (const factor of unverified) {
    const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: ctx.user.id,
    })
    if (error) {
      console.error('[mfa/cleanup] deleteFactor failed', {
        factorId: factor.id, message: error.message, code: error.code, status: error.status,
      })
      failures.push({ id: factor.id, message: error.message })
    } else {
      deleted += 1
    }
  }

  if (failures.length > 0 && deleted === 0) {
    const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
    return NextResponse.json(
      isProd ? { error: 'Cleanup failed' } : { error: failures[0].message, failures },
      { status: 500 }
    )
  }

  return NextResponse.json({ deleted, attempted: unverified.length, failures: failures.length || undefined })
}
