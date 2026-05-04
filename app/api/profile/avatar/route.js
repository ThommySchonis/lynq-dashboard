import { NextResponse } from 'next/server'
import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'

const MAX_BYTES = 500 * 1024  // 500 KB
const ALLOWED   = { 'image/png': 'png', 'image/jpeg': 'jpg' }
const BUCKET    = 'avatars'

function avatarPath(userId, ext) {
  return `${userId}/avatar.${ext}`
}

function publicUrlFor(path) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  if (!base) return null
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`
}

// POST /api/profile/avatar — multipart upload, max 500KB, png/jpg only
export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await getUserFromToken(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData
  try {
    formData = await request.formData()
  } catch (_) {
    return NextResponse.json({ error: 'Invalid upload', code: 'invalid_upload' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file received', code: 'no_file' }, { status: 400 })
  }
  if (!ALLOWED[file.type]) {
    return NextResponse.json({ error: 'Only PNG or JPG images are allowed.', code: 'invalid_type' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File is larger than 500KB.', code: 'too_large' }, { status: 400 })
  }

  const ext  = ALLOWED[file.type]
  const path = avatarPath(user.id, ext)

  // Read into a Buffer so the Supabase JS client can upload it server-side
  const buffer = Buffer.from(await file.arrayBuffer())

  // Remove any existing avatar (different ext, e.g. user previously uploaded
  // png then now jpg) to avoid orphaned files.
  await supabaseAdmin.storage.from(BUCKET).remove([
    avatarPath(user.id, 'png'),
    avatarPath(user.id, 'jpg'),
  ]).catch(() => null)  // best-effort cleanup

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert:      true,
    })

  if (uploadError) {
    console.error('[profile avatar POST] upload failed:', uploadError.message)
    return NextResponse.json({ error: uploadError.message, code: 'upload_failed' }, { status: 500 })
  }

  const url = publicUrlFor(path)
  // Append a cache-buster so the same URL repaints in browsers that cache
  // the previous avatar bytes for an active session.
  const versionedUrl = url ? `${url}?v=${Date.now()}` : null

  // Persist the URL in user_profiles + mirror to auth.users.raw_user_meta_data
  // so existing UI (e.g. workspace_member_details) picks it up.
  const { error: upsertError } = await supabaseAdmin
    .from('user_profiles')
    .upsert({ user_id: user.id, avatar_url: versionedUrl }, { onConflict: 'user_id' })

  if (upsertError) {
    console.error('[profile avatar POST] db upsert failed:', upsertError.message)
    // Storage already has the file; surface the error so the client can retry
    return NextResponse.json({ error: upsertError.message, code: 'db_failed' }, { status: 500 })
  }

  const newMeta = { ...(user.user_metadata || {}), avatar_url: versionedUrl }
  await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: newMeta }).catch(() => null)

  return NextResponse.json({ ok: true, avatar_url: versionedUrl })
}

// DELETE /api/profile/avatar — remove avatar file + clear URL
export async function DELETE(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await getUserFromToken(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Remove both possible extensions
  await supabaseAdmin.storage.from(BUCKET).remove([
    avatarPath(user.id, 'png'),
    avatarPath(user.id, 'jpg'),
  ]).catch(() => null)

  const { error: upsertError } = await supabaseAdmin
    .from('user_profiles')
    .upsert({ user_id: user.id, avatar_url: null }, { onConflict: 'user_id' })

  if (upsertError) {
    console.error('[profile avatar DELETE] db upsert failed:', upsertError.message)
    return NextResponse.json({ error: upsertError.message, code: 'db_failed' }, { status: 500 })
  }

  const newMeta = { ...(user.user_metadata || {}) }
  delete newMeta.avatar_url
  await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: newMeta }).catch(() => null)

  return NextResponse.json({ ok: true })
}
