'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Mail, Plus, ArrowUpRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SettingsSection } from '@/components/features/settings/settings-section'
import { EmailAccountRow } from '@/components/features/settings/integrations/email-account-row'
import { CustomEmailModal } from '@/components/features/settings/integrations/custom-email-modal'
import { useEmailAccounts, useDisconnectEmail } from '@/hooks/settings'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'

function useOAuthRedirectToast() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('status') === 'connected') {
      toast.success('Email account connected successfully!')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams])
}

export function EmailSettings() {
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const { data: accounts, isLoading } = useEmailAccounts()
  const disconnectMutation = useDisconnectEmail()

  useOAuthRedirectToast()

  function connectGmail() {
    const storeParam = activeStoreId ? `&store_id=${activeStoreId}` : ''
    window.location.href = `/api/auth/gmail?t=${token}${storeParam}`
  }

  function connectOutlook() {
    const storeParam = activeStoreId ? `&store_id=${activeStoreId}` : ''
    window.location.href = `/api/auth/outlook?t=${token}${storeParam}`
  }

  return (
    <div className="max-w-3xl mx-auto px-10 py-12 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Email accounts
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Connect email accounts to receive customer emails as support tickets.
        </p>
      </div>

      {/* Add account */}
      <SettingsSection title="Add an account">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Gmail */}
          <button
            type="button"
            onClick={connectGmail}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-left text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:shadow-sm"
          >
            <span className="flex size-7 items-center justify-center flex-shrink-0">
              <Image src="/icons/gmail.svg" alt="Gmail" width={22} height={16} />
            </span>
            <span className="flex-1">Gmail</span>
            <ArrowUpRight className="size-3.5 text-muted-foreground flex-shrink-0" />
          </button>

          {/* Outlook */}
          <button
            type="button"
            onClick={connectOutlook}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-left text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:shadow-sm"
          >
            <span className="flex size-7 items-center justify-center flex-shrink-0">
              <Image src="/icons/outlook.svg" alt="Outlook" width={22} height={22} />
            </span>
            <span className="flex-1">Outlook</span>
            <ArrowUpRight className="size-3.5 text-muted-foreground flex-shrink-0" />
          </button>

          {/* Custom */}
          <button
            type="button"
            onClick={() => setCustomModalOpen(true)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-left text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:shadow-sm"
          >
            <span className="flex size-7 items-center justify-center flex-shrink-0">
              <Mail className="size-5 text-muted-foreground" />
            </span>
            <span className="flex-1">Custom (IMAP)</span>
            <Plus className="size-3.5 text-muted-foreground flex-shrink-0" />
          </button>
        </div>
      </SettingsSection>

      {/* Connected accounts */}
      <SettingsSection title="Connected accounts">
        {isLoading ? (
          <div className="flex items-center gap-2.5 py-5 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin flex-shrink-0" />
            Loading accounts...
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground leading-relaxed">
            <Mail className="size-8 mx-auto mb-2.5 opacity-40" />
            No accounts connected yet.
            <br />
            Add one above to get started.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {accounts.map((account) => (
              <EmailAccountRow
                key={account.id}
                account={account}
                disconnectMutation={disconnectMutation}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      {/* Custom email modal */}
      <CustomEmailModal
        open={customModalOpen}
        onOpenChange={setCustomModalOpen}
      />
    </div>
  )
}
