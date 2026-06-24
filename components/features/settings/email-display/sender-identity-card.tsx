'use client'

import { Check, Lock } from 'lucide-react'
import { EmailDisplayCard, EmailDisplayField, INPUT_CLASS } from './email-display-card'

interface SenderIdentityCardProps {
  displayName: string
  replyToEmail: string
  sendingAddress: string
  onChange: (updates: { displayName?: string; replyToEmail?: string }) => void
  disabled?: boolean
}

export function SenderIdentityCard({
  displayName,
  replyToEmail,
  sendingAddress,
  onChange,
  disabled,
}: SenderIdentityCardProps) {
  return (
    <EmailDisplayCard
      title="Sender identity"
      description="How your name and address appear in the customer's inbox."
    >
      <div className="flex flex-col gap-4">
        <EmailDisplayField label="From name" htmlFor="from-name">
          <input
            id="from-name"
            className={INPUT_CLASS}
            value={displayName}
            onChange={(e) => onChange({ displayName: e.target.value })}
            placeholder="Acme Store Support"
            disabled={disabled}
          />
        </EmailDisplayField>

        <EmailDisplayField label="Reply-to email" htmlFor="reply-to">
          <input
            id="reply-to"
            type="email"
            className={INPUT_CLASS}
            value={replyToEmail}
            onChange={(e) => onChange({ replyToEmail: e.target.value })}
            placeholder="support@acmestore.com"
            disabled={disabled}
          />
        </EmailDisplayField>

        <EmailDisplayField label="Lynq sending address">
          <div className="flex items-center gap-2 rounded-[10px] border border-settings-border bg-settings-surface px-3.5 py-[11px]">
            <span className="flex-1 truncate text-sm text-foreground-3">{sendingAddress}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft py-[3px] pl-2 pr-[9px] text-xs font-semibold text-success-strong">
              <Check size={12} strokeWidth={2.5} />
              Verified
            </span>
            <Lock size={14} strokeWidth={1.75} className="text-foreground-4" />
          </div>
        </EmailDisplayField>
      </div>
    </EmailDisplayCard>
  )
}
