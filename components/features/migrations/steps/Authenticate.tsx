'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthenticateMigration } from '@/hooks/useMigrations'
import { PLATFORM_CONFIG } from '@/components/features/migrations/platforms'
import type { SourcePlatform, SourceMailbox } from '@/types/migrations'

interface Props {
  migrationId: string
  platform: SourcePlatform
  onSuccess: (mailboxes: SourceMailbox[]) => void
}

export function Authenticate({ migrationId, platform, onSuccess }: Props) {
  const cfg = PLATFORM_CONFIG[platform]
  const [subdomain, setSubdomain] = useState('')
  const [username, setUsername] = useState('')
  const [apiKey, setApiKey] = useState('')
  const authMut = useAuthenticateMigration(migrationId)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    void authMut.mutateAsync({
      auth_method: 'api_key',
      subdomain:  cfg.needsSubdomain ? subdomain : undefined,
      username:   cfg.needsUsername  ? username  : undefined,
      api_key:    apiKey,
      // CommSlayer's adapter reads creds.accessToken for the Bearer header,
      // so mirror api_key into access_token when there's no Basic-auth pair.
      access_token: cfg.needsUsername ? undefined : apiKey,
    }).then((r) => {
      onSuccess(r.mailboxes)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-semibold">Connect your {cfg.label} account</h2>

      {cfg.needsSubdomain && (
        <div className="space-y-1">
          <Label>Subdomain / host</Label>
          <Input
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
            placeholder={cfg.subdomainHint}
            required
          />
        </div>
      )}

      {cfg.needsUsername && (
        <div className="space-y-1">
          <Label>Email / username</Label>
          <Input type="email" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
      )}

      <div className="space-y-1">
        <Label>{cfg.needsUsername ? 'API key / token' : 'Integration token'}</Label>
        <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
        <p className="text-xs text-foreground-4">{cfg.apiKeyHint}</p>
      </div>

      {authMut.error && <p className="text-sm text-destructive">{authMut.error.message}</p>}

      <Button type="submit" disabled={authMut.isPending} className="w-full">
        {authMut.isPending ? 'Verifying…' : 'Continue'}
      </Button>
    </form>
  )
}
