import { cn } from '@/lib/utils'
import { LanguageSelector } from './language-selector'
import { AccountChip } from './account-chip'

interface WizardShellProps {
  /** Identity chip in the header — shown on later steps once an account exists. */
  account?: { name: string; email: string }
  /** Footer slot (progress bar + navigation buttons). */
  footer: React.ReactNode
  /** Wider container for the pricing step (3 plan cards). */
  wide?: boolean
  children: React.ReactNode
}

/** Full-page chrome for the onboarding wizard: decorative background, header, content + footer slots. */
export function WizardShell({ account, footer, wide, children }: WizardShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decorative ambient blur circles (Figma background) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-10 size-[28rem] rounded-full bg-accent-soft blur-3xl" />
        <div className="absolute -right-40 top-1/3 size-[32rem] rounded-full bg-info-soft blur-3xl" />
        <div className="absolute bottom-0 left-1/4 size-[26rem] rounded-full bg-accent-soft blur-3xl" />
      </div>

      <div
        className={cn(
          'relative mx-auto flex min-h-screen w-full flex-col px-6 py-12',
          wide ? 'max-w-[1040px]' : 'max-w-[600px]',
        )}
      >
        <header className="flex items-center justify-between gap-4">
          {/* Pre-account steps (1–4) show the full wordmark; once the account
              exists (5–7) the header's left slot becomes the account chip, whose
              compact brand mark is the only logo — matching the Figma header. */}
          {account ? (
            <AccountChip name={account.name} email={account.email} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo.png" alt="Lynq & Flow" className="h-[14px] w-[127px]" />
          )}
          <LanguageSelector />
        </header>

        <main className="flex flex-1 flex-col justify-center py-12">{children}</main>

        <div className="shrink-0">{footer}</div>
      </div>
    </div>
  )
}
