'use client'

interface EmailPreviewProps {
  displayName: string
  emailAddress: string
  accentColor: string
  logoUrl: string | null
  showLogoInHeader: boolean
  signatureHtml: string
  poweredByFooter: boolean
  storeDomain: string
}

const SUBJECT = 'Re: Where is my order? (#1024)'
const BODY =
  'Thanks for reaching out! Good news — your order #1024 shipped this morning and is on its way. You can follow it with the tracking link below; it should arrive in 2–3 business days.'

export function EmailPreview({
  displayName,
  emailAddress,
  accentColor,
  logoUrl,
  showLogoInHeader,
  signatureHtml,
  poweredByFooter,
  storeDomain,
}: EmailPreviewProps) {
  const initials = (displayName || 'Acme').slice(0, 4)

  return (
    <div className="flex w-[352px] shrink-0 flex-col gap-2.5">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-4">Live preview</span>

      <div className="overflow-hidden rounded-[14px] border border-settings-border bg-card shadow-[0px_8px_24px_-6px_rgba(28,15,54,0.08)]">
        {/* Accent strip */}
        <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

        {/* Sender header */}
        <div className="flex items-center gap-[11px] px-5 pb-4 pt-[18px]">
          {showLogoInHeader && (
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-accent-soft">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="size-full object-contain" />
              ) : (
                <span className="text-xs font-bold text-primary">{initials}</span>
              )}
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-px">
            <span className="truncate text-sm font-semibold text-foreground">
              {displayName || 'Acme Store Support'}
            </span>
            <span className="truncate text-xs font-medium text-foreground-3">{emailAddress}</span>
          </div>
        </div>

        <div className="h-px w-full bg-settings-border" />

        {/* Email body */}
        <div className="flex flex-col px-5 py-[18px]">
          <p className="text-sm font-semibold text-foreground">{SUBJECT}</p>
          <p className="mt-3 text-sm text-foreground-2">Hi Sarah,</p>
          <p className="mt-2 text-sm text-foreground-2">{BODY}</p>
          <button
            type="button"
            className="mt-3.5 w-fit rounded-lg px-4 py-[9px] text-xs font-semibold text-white"
            style={{ backgroundColor: accentColor }}
          >
            Track my order
          </button>
          {signatureHtml ? (
            <div
              className="mt-4 text-xs text-foreground-3 [&_a]:text-primary"
              dangerouslySetInnerHTML={{ __html: signatureHtml }}
            />
          ) : (
            <p className="mt-4 text-xs text-foreground-3">
              Thanks for shopping with us, Mia · Acme Store Customer Care
            </p>
          )}
        </div>

        <div className="h-px w-full bg-settings-border" />

        {/* Footer */}
        <div className="flex flex-col items-center gap-[3px] bg-foreground/[0.02] px-5 pb-4 pt-3.5">
          <span className="text-xs font-medium text-foreground-4">{storeDomain}</span>
          {poweredByFooter && (
            <span className="text-xs font-medium text-foreground-4">Powered by Lynq &amp; Flow</span>
          )}
        </div>
      </div>
    </div>
  )
}
