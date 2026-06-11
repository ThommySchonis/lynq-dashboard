'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSetMailboxLinks } from '@/hooks/useMigrations'
import type { SourceMailbox } from '@/types/migrations'

interface EmailAccount { id: string; email: string }

interface Props {
  migrationId: string
  sourceMailboxes: SourceMailbox[]
  emailAccounts: EmailAccount[]
  onSuccess: () => void
}

export function LinkMailboxes({ migrationId, sourceMailboxes, emailAccounts, onSuccess }: Props) {
  const initial = useMemo(() => {
    const map: Record<string, string> = {}
    for (const sm of sourceMailboxes) {
      const match = emailAccounts.find((ea) => ea.email.toLowerCase() === sm.email.toLowerCase())
      if (match) map[sm.source_id] = match.id
    }
    return map
  }, [sourceMailboxes, emailAccounts])

  const [links, setLinks] = useState<Record<string, string>>(initial)
  const setLinksMut = useSetMailboxLinks(migrationId)

  const linkedCount = Object.keys(links).length

  function submit() {
    void setLinksMut.mutateAsync({ mailbox_links: links }).then(() => {
      onSuccess()
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Connect your mailboxes</h2>
        <p className="text-sm text-foreground-3">Match each source mailbox to a Lynq email account. Unlinked mailboxes are skipped.</p>
      </div>

      <div className="space-y-3">
        {sourceMailboxes.map((sm) => (
          <div key={sm.source_id} className="grid grid-cols-2 items-center gap-3 rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">{sm.email}</p>
              {sm.display_name && <p className="text-xs text-foreground-4">{sm.display_name}</p>}
            </div>
            <Select
              value={links[sm.source_id] ?? ''}
              onValueChange={(v) => {
                setLinks((cur) => {
                  const next = { ...cur }
                  if (v === '__skip__') delete next[sm.source_id]
                  else next[sm.source_id] = v
                  return next
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose Lynq email…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__skip__">Skip this mailbox</SelectItem>
                {emailAccounts.map((ea) => (
                  <SelectItem key={ea.id} value={ea.id}>{ea.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {linkedCount === 0 && <p className="text-sm text-warning">Link at least one mailbox to continue.</p>}

      <Button onClick={submit} disabled={linkedCount === 0 || setLinksMut.isPending} className="w-full">
        {setLinksMut.isPending ? 'Saving…' : `Continue with ${linkedCount} mailbox${linkedCount === 1 ? '' : 'es'}`}
      </Button>
    </div>
  )
}
