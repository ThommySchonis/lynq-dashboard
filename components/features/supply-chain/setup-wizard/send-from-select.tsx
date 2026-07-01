'use client'

import { useState } from 'react'
import { useStoreStore } from '@/stores/store'
import { useEmailAccountsForStore, type EmailAccountForStore } from '@/hooks/inbox/use-inbox-data'
import { SEND_FROM_LABEL } from '@/lib/supply-chain-constants'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function label(account: EmailAccountForStore): string {
  // Always show "Support" as the sender name (matches Figma); the mailbox
  // display name is ignored here.
  return `Support · ${account.email_address}`
}

/**
 * Demo control for "Send updates from": lists the store's connected mailboxes
 * but does not persist. The chosen sender only takes effect once shipment
 * emails ship (BE-4/BE-5).
 */
export function SendFromSelect() {
  const storeId = useStoreStore((s) => s.activeStoreId)
  const { data: accounts = [] } = useEmailAccountsForStore(storeId)
  const [value, setValue] = useState<string | null>(null)

  if (accounts.length === 0) {
    return (
      <span className="shrink-0 rounded-[9px] border border-border bg-card px-3 py-2 text-sm text-foreground-4">
        {SEND_FROM_LABEL}
      </span>
    )
  }

  const selected = value ?? accounts.find((a) => a.is_default)?.id ?? accounts[0].id

  return (
    <Select value={selected} onValueChange={setValue}>
      <SelectTrigger className="shrink-0 rounded-[9px] border-border bg-card py-2 pr-2.5 pl-3 text-foreground-3 data-[size=default]:h-auto">
        <SelectValue>
          {(v: string | null) => {
            const account = accounts.find((a) => a.id === v)
            return account ? label(account) : SEND_FROM_LABEL
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {label(account)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
