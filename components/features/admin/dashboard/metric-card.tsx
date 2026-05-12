import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface MetricCardProps {
  icon: LucideIcon
  value: number
  label: string
}

export function MetricCard({ icon: Icon, value, label }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/8">
            <Icon size={18} strokeWidth={1.75} className="text-muted-foreground" />
          </div>
        </div>
        <div>
          <div className="text-[28px] font-extrabold leading-none tracking-tight text-foreground">
            {value}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
