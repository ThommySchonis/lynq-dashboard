import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { startCronRun, endCronRun } from '../_shared/cron-logger.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const GMAIL_PUSH_TOPIC = Deno.env.get('GMAIL_PUSH_TOPIC')!

// EMAIL_ENCRYPTION_KEY is the same 64-hex-char key used by lib/encryption.ts
const ENCRYPTION_KEY_HEX = Deno.env.get('EMAIL_ENCRYPTION_KEY')!

interface EmailAccountRow {
  id: string
  email_address: string
  access_token: string | null
  refresh_token: string | null
  workspaces: { suspended_at: string | null } | null
}

interface TokenRefreshResponse {
  access_token?: string
  expires_in?: number
}

// Deno-compatible AES-256-GCM decrypt (matches lib/encryption.ts format: "iv:tag:ciphertext")
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

async function decrypt(payload: string): Promise<string> {
  const [ivHex, tagHex, encryptedHex] = payload.split(':')
  const iv = hexToBytes(ivHex)
  const tag = hexToBytes(tagHex)
  const encrypted = hexToBytes(encryptedHex)
  const keyBytes = hexToBytes(ENCRYPTION_KEY_HEX)

  // AES-256-GCM: ciphertext + tag concatenated for Web Crypto
  const ciphertextWithTag = new Uint8Array(encrypted.length + tag.length)
  ciphertextWithTag.set(encrypted)
  ciphertextWithTag.set(tag, encrypted.length)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    cryptoKey,
    ciphertextWithTag
  )

  return new TextDecoder().decode(decrypted)
}

async function refreshAccessToken(encryptedRefreshToken: string): Promise<string | null> {
  const refreshToken = await decrypt(encryptedRefreshToken)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) return null
  const data: TokenRefreshResponse = await res.json()
  return data.access_token ?? null
}

async function registerWatch(accessToken: string): Promise<boolean> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicName: GMAIL_PUSH_TOPIC,
      labelIds: ['INBOX'],
    }),
  })
  return res.ok
}

Deno.serve(async () => {
  const runId = await startCronRun('gmail-watch-renewal', 'edge-function')

  try {
    // Find Gmail accounts needing Watch renewal:
    // - watch_expiry is null (never registered) or expiring within 1 day
    const { data: accounts, error } = await supabase
      .from('email_accounts')
      .select('id, email_address, access_token, refresh_token, workspaces(suspended_at)')
      .eq('provider', 'gmail')
      .eq('status', 'active')
      .or('watch_expiry.is.null,watch_expiry.lt.' + new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())

    if (error || !accounts) {
      console.error('[gmail-watch-renewal] Failed to fetch accounts:', error?.message)
      await endCronRun(runId, { status: 'failure', errorMessage: error?.message ?? 'Failed to fetch accounts' })
      return new Response(JSON.stringify({ error: error?.message }), { status: 500 })
    }

    let renewed = 0
    let failed = 0
    let skipped = 0

    for (const account of accounts as EmailAccountRow[]) {
      const ws = account.workspaces
      if (ws?.suspended_at) {
        const suspendedMs = Date.now() - new Date(ws.suspended_at).getTime()
        const gracePeriodMs = 7 * 24 * 60 * 60 * 1000
        if (suspendedMs > gracePeriodMs) {
          console.log('[gmail-watch-renewal] skipping', account.email_address, '— workspace suspended beyond grace period')
          skipped++
          continue
        }
      }

      if (!account.refresh_token) {
        console.warn(`[gmail-watch-renewal] No refresh_token for account ${account.id} (${account.email_address}), skipping`)
        skipped++
        continue
      }

      try {
        // Refresh the access token
        const freshToken = await refreshAccessToken(account.refresh_token)
        if (!freshToken) {
          console.error(`[gmail-watch-renewal] Token refresh failed for ${account.email_address}`)
          failed++
          continue
        }

        // Register/renew the Watch
        const watchOk = await registerWatch(freshToken)
        if (!watchOk) {
          console.error(`[gmail-watch-renewal] Watch registration failed for ${account.email_address}`)
          failed++
          continue
        }

        // Encrypt the fresh token before storing (same format as lib/encryption.ts)
        const keyBytes = hexToBytes(ENCRYPTION_KEY_HEX)
        const iv = crypto.getRandomValues(new Uint8Array(16))
        const cryptoKey = await crypto.subtle.importKey(
          'raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']
        )
        const encResult = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv, tagLength: 128 }, cryptoKey,
          new TextEncoder().encode(freshToken)
        )
        const encBytes = new Uint8Array(encResult)
        // Web Crypto appends tag to ciphertext — split last 16 bytes as tag
        const ciphertext = encBytes.slice(0, encBytes.length - 16)
        const tag = encBytes.slice(encBytes.length - 16)
        const toHex = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2, '0')).join('')
        const encryptedToken = `${toHex(iv)}:${toHex(tag)}:${toHex(ciphertext)}`

        // Update account with encrypted token and watch expiry
        const watchExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        await supabase
          .from('email_accounts')
          .update({
            access_token: encryptedToken,
            watch_expiry: watchExpiry,
          })
          .eq('id', account.id)

        console.log(`[gmail-watch-renewal] Renewed Watch for ${account.email_address}, expires ${watchExpiry}`)
        renewed++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[gmail-watch-renewal] Error for ${account.email_address}:`, msg)
        failed++
      }
    }

    const summary = { renewed, failed, skipped, total: accounts.length }
    console.log('[gmail-watch-renewal] Summary:', JSON.stringify(summary))
    await endCronRun(runId, { status: failed > 0 ? 'warning' : 'success', summary: { renewed, failed, skipped, total: accounts.length } })
    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[gmail-watch-renewal] Fatal error:', errorMessage)
    await endCronRun(runId, { status: 'failure', errorMessage })
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 })
  }
})
