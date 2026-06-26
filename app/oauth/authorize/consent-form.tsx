'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

interface ConsentContext {
  clientName: string | null
  workspaceName: string
  role: string
}

export function ConsentForm() {
  const params = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'ready' | 'working' | 'error'>('loading')
  const [message, setMessage] = useState<string>('')
  const [consentCtx, setConsentCtx] = useState<ConsentContext | null>(null)

  const clientId = params.get('client_id') ?? ''
  const redirectUri = params.get('redirect_uri') ?? ''
  const codeChallenge = params.get('code_challenge') ?? ''
  const codeChallengeMethod = params.get('code_challenge_method') ?? 'S256'
  const state = params.get('state') ?? ''
  const scope = params.get('scope') ?? 'mcp'
  const responseType = params.get('response_type') ?? 'code'

  useEffect(() => {
    async function check() {
      if (responseType !== 'code' || !clientId || !redirectUri || !codeChallenge) {
        setStatus('error')
        setMessage('Invalid authorization request.')
        return
      }
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        // Bounce through login, returning to this exact authorize URL.
        const here = window.location.pathname + window.location.search
        window.location.href = `/login?redirect=${encodeURIComponent(here)}`
        return
      }
      const token = data.session.access_token
      const ctxRes = await fetch(`/api/oauth/consent-context?client_id=${encodeURIComponent(clientId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (ctxRes.ok) {
        const json = (await ctxRes.json()) as { client_name: string | null; workspace_name: string; role: string }
        setConsentCtx({ clientName: json.client_name, workspaceName: json.workspace_name, role: json.role })
      }
      setStatus('ready')
    }
    void check()
  }, [responseType, clientId, redirectUri, codeChallenge])

  async function approve() {
    setStatus('working')
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      setStatus('error')
      setMessage('Session expired. Reload and try again.')
      return
    }

    const res = await fetch('/api/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        state,
        scope,
      }),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error_description?: string }
      setStatus('error')
      setMessage(err.error_description ?? 'Authorization failed.')
      return
    }
    const { redirect } = (await res.json()) as { redirect: string }
    window.location.href = redirect
  }

  function deny() {
    const url = new URL(redirectUri)
    url.searchParams.set('error', 'access_denied')
    if (state) url.searchParams.set('state', state)
    window.location.href = url.toString()
  }

  if (status === 'loading') return <main className="mx-auto max-w-md p-8">Checking your session…</main>
  if (status === 'error') return <main className="mx-auto max-w-md p-8 text-destructive">{message}</main>

  const displayName = consentCtx?.clientName ?? clientId

  return (
    <main className="mx-auto max-w-md p-8 space-y-6">
      <h1 className="text-xl font-semibold">Authorize Access</h1>
      <p className="text-foreground-2">
        <span className="font-medium">{displayName}</span> is requesting access to your{' '}
        <span className="font-medium">{consentCtx?.workspaceName ?? ''}</span> workspace.
        It will act with your <span className="font-medium">{consentCtx?.role ?? ''}</span> permissions.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => void approve()} disabled={status === 'working'}>
          {status === 'working' ? 'Authorizing…' : 'Approve'}
        </Button>
        <Button variant="outline" onClick={deny} disabled={status === 'working'}>Deny</Button>
      </div>
    </main>
  )
}
