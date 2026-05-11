import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  trend?: { value: number; label: string }
  className?: string
}

export function StatCard({ label, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary to-purple-400" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-3)]">
            {label}
          </p>
          {Icon && <Icon size={16} className="text-[var(--text-4)]" />}
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-1)]">
          {value}
        </p>
        {trend && (
          <p
            className={cn(
              'mt-1 text-xs font-medium',
              trend.value >= 0 ? 'text-emerald-600' : 'text-red-600',
            )}
          >
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
