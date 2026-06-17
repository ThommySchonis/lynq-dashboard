import { cn } from '@/lib/utils'

interface StepHeadingProps {
  title: string
  description?: React.ReactNode
  center?: boolean
  className?: string
}

/** Shared title + description block at the top of each wizard step. */
export function StepHeading({ title, description, center, className }: StepHeadingProps) {
  return (
    <div className={cn(center && 'text-center', className)}>
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-foreground-2">{description}</p>
      )}
    </div>
  )
}
