interface AccountChipProps {
  name: string
  email: string
}

/**
 * Account identity chip shown in the header once the user has an account (steps 5–7).
 * Its leading white tile holds the compact Lynq brand mark — the shortened logo in the Figma header.
 */
export function AccountChip({ name, email }: AccountChipProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-[10px] border border-border bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="Lynq" className="h-[24px] w-[22px] object-contain" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-medium text-foreground">{name}</div>
        <div className="text-xs text-foreground-3">{email}</div>
      </div>
    </div>
  )
}
