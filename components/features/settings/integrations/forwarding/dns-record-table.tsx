'use client'

import { Check } from 'lucide-react'
import { CopyButton } from '@/components/features/settings/integrations/forwarding/copy-button'
import type { DnsRecord } from '@/types/forwarding'

function DnsRecordRow({ record }: { record: DnsRecord }) {
  const isVerified = record.status === 'verified'
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-3 text-xs font-mono text-muted-foreground">{record.type}</td>
      <td className="py-2 pr-3 text-xs font-mono truncate max-w-[120px]">{record.name}</td>
      <td className="py-2 pr-2 text-xs font-mono truncate max-w-[200px]">
        <div className="flex items-center gap-1.5">
          <span className="truncate">{record.value}</span>
          <CopyButton value={record.value} />
        </div>
      </td>
      <td className="py-2 text-xs">
        {isVerified ? (
          <span className="flex items-center gap-1 text-success"><Check className="size-3" /> Verified</span>
        ) : (
          <span className="text-muted-foreground">Pending</span>
        )}
      </td>
    </tr>
  )
}

export function DnsRecordTable({ records }: { records: DnsRecord[] }) {
  if (records.length === 0) {
    return <p className="text-xs text-muted-foreground">Loading DNS records...</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-1.5 text-xs font-semibold text-muted-foreground">Type</th>
            <th className="pb-1.5 text-xs font-semibold text-muted-foreground">Name</th>
            <th className="pb-1.5 text-xs font-semibold text-muted-foreground">Value</th>
            <th className="pb-1.5 text-xs font-semibold text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, i) => (
            <DnsRecordRow key={i} record={record} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
