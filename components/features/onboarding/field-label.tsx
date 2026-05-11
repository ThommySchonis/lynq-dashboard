import type { ReactNode } from 'react'

interface FieldLabelProps {
  children: ReactNode
  htmlFor?: string
}

export function FieldLabel({ children, htmlFor }: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-semibold text-white/45 mb-1.5 tracking-[0.06em] uppercase"
    >
      {children}
    </label>
  )
}
