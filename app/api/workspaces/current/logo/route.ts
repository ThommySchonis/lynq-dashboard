import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext } from '../../../../../lib/auth'
import { can } from '../../../../../lib/permissions'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const BUCKET = 'workspace-assets'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageWorkspace(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File must be PNG, JPG, or WebP' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be under 2 MB' }, { status: 400 })
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `logos/${ctx.workspaceId}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path)

  // Bust CDN cache by appending a timestamp
  const logoUrl = `${publicUrl}?t=${Date.now()}`

  const { error: updateError } = await supabaseAdmin
    .from('workspaces')
    .update({ logo_url: logoUrl })
    .eq('id', ctx.workspaceId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ logo_url: logoUrl })
}

export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageWorkspace(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Remove all possible extensions
  for (const ext of ['png', 'jpg', 'webp']) {
    await supabaseAdmin.storage
      .from(BUCKET)
      .remove([`logos/${ctx.workspaceId}.${ext}`])
  }

  await supabaseAdmin
    .from('workspaces')
    .update({ logo_url: null })
    .eq('id', ctx.workspaceId)

  return NextResponse.json({ ok: true })
}
