'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthenticateMigration } from '@/hooks/useMigrations'
import type { SourcePlatform, SourceMailbox } from '@/types/migrations'

interface Props {
  migrationId: string
  platform: SourcePlatform
  onSuccess: (mailboxes: SourceMailbox[]) => void
}

export function Authenticate({ migrationId, platform, onSuccess }: Props) {
  const [subdomain, setSubdomain] = useState('')
  const [username, setUsername] = useState('')
  const [apiKey, setApiKey] = useState('')
  const authMut = useAuthenticateMigration(migrationId)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    void authMut.mutateAsync({
      auth_method: 'api_key',
      subdomain,
      username,
      api_key: apiKey,
    }).then((r) => {
      onSuccess(r.mailboxes)
    })
  }

  const subdomainHelp = platform === 'gorgias'
    ? 'e.g. brand.gorgias.com'
    : 'e.g. brand (your *.zendesk.com subdomain)'

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-semibold">Connect your {platform === 'gorgias' ? 'Gorgias' : 'Zendesk'} account</h2>

      <div className="space-y-1">
        <Label>Subdomain / host</Label>
        <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder={subdomainHelp} required />
      </div>

      <div className="space-y-1">
        <Label>Email / username</Label>
        <Input type="email" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>

      <div className="space-y-1">
        <Label>API key / token</Label>
        <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
        <p className="text-xs text-foreground-4">
          Generated in {platform === 'gorgias' ? 'Settings → REST API' : 'Admin → API → Token Access'}.
        </p>
      </div>

      {authMut.error && <p className="text-sm text-destructive">{authMut.error.message}</p>}

      <Button type="submit" disabled={authMut.isPending} className="w-full">
        {authMut.isPending ? 'Verifying…' : 'Continue'}
      </Button>
    </form>
  )
}
