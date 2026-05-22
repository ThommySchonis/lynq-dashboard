'use client'

interface SuspensionBannerProps {
  reason: string | null
}

export function SuspensionBanner({ reason }: SuspensionBannerProps) {
  return (
    <div className="border-b border-amber-500/20 bg-amber-50 px-4 py-2.5 dark:bg-amber-950/30">
      <p className="text-center text-[13px] font-medium text-amber-800 dark:text-amber-200">
        This workspace has been suspended.
        {reason ? ` Reason: ${reason}.` : ''}
        {' '}Contact support or resolve your billing to restore access.
      </p>
    </div>
  )
}
