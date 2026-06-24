import { assertEquals, assertStringIncludes } from '@std/assert'
import { sendInviteEmail } from '../lib/email.ts'

const ORIGINAL_FETCH = globalThis.fetch
const VALID_INVITE = {
  to: 'invitee@example.com',
  workspaceName: 'Acme',
  inviterEmail: 'owner@example.com',
  role: 'agent',
  link: 'https://app.example.com/invites/tok',
}

function clearEnv() {
  Deno.env.delete('RESEND_API_KEY')
  Deno.env.delete('INVITE_EMAIL_FROM')
}

Deno.test('returns not_configured and never calls Resend when INVITE_EMAIL_FROM is unset', async () => {
  clearEnv()
  Deno.env.set('RESEND_API_KEY', 'test-key')
  let called = false
  globalThis.fetch = (() => {
    called = true
    return Promise.resolve(new Response('{}', { status: 200 }))
  }) as typeof fetch
  try {
    const result = await sendInviteEmail(VALID_INVITE)
    assertEquals(result.status, 'not_configured')
    assertEquals(called, false)
  } finally {
    globalThis.fetch = ORIGINAL_FETCH
    clearEnv()
  }
})

Deno.test('returns sent with the Resend message id on success', async () => {
  clearEnv()
  Deno.env.set('RESEND_API_KEY', 'test-key')
  Deno.env.set('INVITE_EMAIL_FROM', 'Lynq & Flow <no-reply@lynqflow.co>')
  globalThis.fetch = (() =>
    Promise.resolve(new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 }))
  ) as typeof fetch
  try {
    const result = await sendInviteEmail(VALID_INVITE)
    assertEquals(result.status, 'sent')
    assertEquals((result as { id: string | null }).id, 'msg_123')
  } finally {
    globalThis.fetch = ORIGINAL_FETCH
    clearEnv()
  }
})

Deno.test('returns failed with the response-body snippet on a non-2xx', async () => {
  clearEnv()
  Deno.env.set('RESEND_API_KEY', 'test-key')
  Deno.env.set('INVITE_EMAIL_FROM', 'Lynq & Flow <no-reply@lynqflow.co>')
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response('You can only send testing emails to your own email address', { status: 403 }),
    )
  ) as typeof fetch
  try {
    const result = await sendInviteEmail(VALID_INVITE)
    assertEquals(result.status, 'failed')
    assertStringIncludes((result as { error: string }).error, '403')
    assertStringIncludes((result as { error: string }).error, 'testing emails')
  } finally {
    globalThis.fetch = ORIGINAL_FETCH
    clearEnv()
  }
})
