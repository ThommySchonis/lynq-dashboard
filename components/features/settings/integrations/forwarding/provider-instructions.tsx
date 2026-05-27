'use client'

import { ChevronDown } from 'lucide-react'

export function ProviderInstructions() {
  return (
    <details className="mt-3 text-xs">
      <summary className="flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground">
        <ChevronDown className="size-3" />
        How to set up forwarding in your email provider
      </summary>
      <div className="mt-2 flex flex-col gap-2 pl-4 text-muted-foreground">
        <div>
          <strong className="text-foreground">Gmail:</strong> Settings &gt; Forwarding and POP/IMAP &gt; Add a forwarding address &gt; paste the address above
        </div>
        <div>
          <strong className="text-foreground">Outlook:</strong> Settings &gt; Mail &gt; Forwarding &gt; Enable forwarding &gt; paste the address above
        </div>
        <div>
          <strong className="text-foreground">Namecheap / Privateemail:</strong> Email Forwarding settings in your hosting control panel &gt; add forward rule
        </div>
        <div>
          <strong className="text-foreground">Other:</strong> Look for &quot;Email forwarding&quot; or &quot;Mail rules&quot; in your provider settings and forward all incoming mail to the address above
        </div>
      </div>
    </details>
  )
}
