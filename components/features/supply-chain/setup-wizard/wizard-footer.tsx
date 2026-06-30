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
    <div className="shrink-0 px-10 pb-8 pt-2">
      <div className="mx-auto flex w-full max-w-[870px] items-center justify-between gap-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="flex items-center gap-2 rounded-[11px] border border-border bg-card px-5 py-[13px] text-sm font-semibold text-foreground-2 transition-opacity disabled:opacity-40"
        >
          <ArrowLeft className="h-3 w-3" />
          Previous
        </button>

        <div className="flex items-center gap-2 rounded-[12px] border border-border bg-card px-[18px] py-[11px]">
          <BadgeCheck className="h-3.5 w-3.5 text-foreground-3" />
          <span className="text-sm font-medium text-foreground-2">Included in your plan · Unlimited tracking</span>
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex items-center gap-1.5 rounded-[10px] bg-foreground px-10 py-[15px] text-sm font-semibold text-background transition-opacity disabled:opacity-40"
        >
          {nextLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
