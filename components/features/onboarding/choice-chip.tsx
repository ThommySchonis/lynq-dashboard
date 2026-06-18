'use client'

import { cn } from '@/lib/utils'
import { SELECT_SURFACE_SELECTED, SELECT_SURFACE_UNSELECTED } from "@/lib/onboarding-constants";

interface ChoiceChipProps {
  /** Brand SVG URL served from /public. */
  icon: string
  label: string
  selected: boolean
  onSelect: () => void
}

/** Icon + label tile (step 6 — how did you hear about us). */
export function ChoiceChip({ icon, label, selected, onSelect }: ChoiceChipProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex h-[70px] w-[100px] flex-col items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors",
        selected ? SELECT_SURFACE_SELECTED : SELECT_SURFACE_UNSELECTED,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className="size-5" />
      {label}
    </button>
  );
}
