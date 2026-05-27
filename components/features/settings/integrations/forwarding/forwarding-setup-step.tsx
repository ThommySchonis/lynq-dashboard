'use client'

import { Check, Loader2, RefreshCw, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/features/settings/integrations/forwarding/copy-button'
import { DnsRecordTable } from '@/components/features/settings/integrations/forwarding/dns-record-table'
import { ProviderInstructions } from '@/components/features/settings/integrations/forwarding/provider-instructions'
import type { DnsRecord } from '@/types/forwarding'

interface ForwardingSetupStepProps {
  forwardingAddress: string
  forwardingVerified: boolean
  domainVerified: boolean
  dnsRecords: DnsRecord[]
  accountId: string
  onVerifyForwarding: () => void
  onVerifyDns: () => void
  isVerifyingForwarding: boolean
  isVerifyingDns: boolean
}

export function ForwardingSetupStep({
  forwardingAddress,
  forwardingVerified,
  domainVerified,
  dnsRecords,
  accountId,
  onVerifyForwarding,
  onVerifyDns,
  isVerifyingForwarding,
  isVerifyingDns,
}: ForwardingSetupStepProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Forwarding instructions */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="size-4" />
            1. Set up email forwarding
            {forwardingVerified && <Check className="size-4 text-success" />}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Forward all incoming emails to this address:
        </p>
        <div className="flex items-center gap-2 rounded-md bg-muted/50 border border-border px-3 py-2">
          <code className="text-xs font-mono flex-1 truncate">{forwardingAddress}</code>
          <CopyButton value={forwardingAddress} />
        </div>

        <ProviderInstructions />

        {!forwardingVerified && accountId && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={isVerifyingForwarding}
            onClick={onVerifyForwarding}
          >
            {isVerifyingForwarding && <Loader2 className="size-3 animate-spin" />}
            Send test email
          </Button>
        )}
        {forwardingVerified && (
          <p className="text-xs text-success mt-2">Forwarding verified</p>
        )}
      </div>

      {/* DNS records */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            2. Add DNS records
            {domainVerified && <Check className="size-4 text-success" />}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Add these records to your domain&apos;s DNS settings:
        </p>

        <DnsRecordTable records={dnsRecords} />

        {!domainVerified && accountId && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={isVerifyingDns}
              onClick={onVerifyDns}
            >
              {isVerifyingDns ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Verify DNS
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              DNS propagation can take up to 48 hours. Click Verify to re-check.
            </p>
          </>
        )}
        {domainVerified && (
          <p className="text-xs text-success mt-2">DNS verified</p>
        )}
      </div>
    </div>
  )
}
