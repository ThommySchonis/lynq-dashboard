'use client'

import { ArrowLeft, ArrowRight, BadgeCheck } from 'lucide-react'

interface WizardFooterProps {
  canPrev: boolean
  onPrev: () => void
  onNext: () => void
  nextLabel: string
  nextDisabled: boolean
}

export function WizardFooter({ canPrev, onPrev, onNext, nextLabel, nextDisabled }: WizardFooterProps) {
  return (
    <footer className="shrink-0 border-t border-border">
      <div className="relative flex items-center justify-between gap-4 px-10 py-3.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="flex items-center gap-2 rounded-[11px] border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground-2 transition-opacity disabled:opacity-40"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Previous
        </button>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-xl border border-border bg-card px-[18px] py-2.5 lg:flex">
          <BadgeCheck className="h-3.5 w-3.5 text-foreground-3" />
          <span className="text-sm font-medium text-foreground-2">Included in your plan · Unlimited tracking</span>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex items-center gap-1.5 rounded-[10px] bg-foreground px-10 py-3 text-sm font-semibold text-background transition-opacity disabled:opacity-40"
        >
          {nextLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </footer>
  )
}
