'use client'

import { Switch } from '@/components/ui/switch'
import { SignatureEditor } from './signature-editor'
import { EmailDisplayCard, EmailDisplayField, EmailDisplayToggleRow, INPUT_CLASS } from './email-display-card'

const VARIABLES = ['{{agent.first_name}}', '{{store.name}}', '{{order.number}}']

interface SignatureCardProps {
  signatureHtml: string
  closingText: string
  appendSignature: boolean
  onChange: (updates: { signatureHtml?: string; closingText?: string; isActive?: boolean }) => void
  disabled?: boolean
}

export function SignatureCard({
  signatureHtml,
  closingText,
  appendSignature,
  onChange,
  disabled,
}: SignatureCardProps) {
  function insertVariable(variable: string) {
    onChange({ signatureHtml: `${signatureHtml}${variable}` })
  }

  return (
    <EmailDisplayCard
      title="Email signature"
      description="Automatically added to the bottom of every reply."
    >
      <div className="flex flex-col gap-4">
        <EmailDisplayField label="Closing text" htmlFor="closing-text">
          <input
            id="closing-text"
            className={INPUT_CLASS}
            value={closingText}
            onChange={(e) => onChange({ closingText: e.target.value })}
            placeholder="Best regards,"
            disabled={disabled}
          />
        </EmailDisplayField>

        <div className="flex flex-col">
        <SignatureEditor
          value={signatureHtml}
          onChange={(html) => onChange({ signatureHtml: html })}
          disabled={disabled}
        />

        <span className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-foreground-4">
          Insert variable
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {VARIABLES.map((variable) => (
            <button
              key={variable}
              type="button"
              onClick={() => insertVariable(variable)}
              disabled={disabled}
              className="rounded-[7px] bg-accent-soft px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-accent-soft/70 disabled:opacity-50"
            >
              {variable}
            </button>
          ))}
        </div>

        <EmailDisplayToggleRow
          title="Append signature to all outgoing replies"
          control={
            <Switch
              checked={appendSignature}
              onCheckedChange={(v) => onChange({ isActive: v })}
              disabled={disabled}
            />
          }
        />
        </div>
      </div>
    </EmailDisplayCard>
  )
}
