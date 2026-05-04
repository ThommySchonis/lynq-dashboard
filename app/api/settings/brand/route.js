import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { brandName, language, tone } = await request.json()

  // Transition: write both user_id (legacy) AND workspace_id. Keep
  // existing onConflict until Phase 4 swaps the unique key.
  await supabaseAdmin
    .from('ai_settings')
    .upsert({
      user_id:      ctx.user.id,
      workspace_id: ctx.workspaceId,
      brand_name:   brandName,
      language,
      tone,
    }, { onConflict: 'user_id' })

  return NextResponse.json({ success: true })
}

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('ai_settings')
    .select('brand_name, language, tone, system_prompt')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  return NextResponse.json({ settings: data || {} })
}
