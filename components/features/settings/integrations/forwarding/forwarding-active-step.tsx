'use client'

import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ForwardingActiveStepProps {
  email: string
  onClose: () => void
}

export function ForwardingActiveStep({ email, onClose }: ForwardingActiveStepProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
        <Check className="size-6 text-success" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{email}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Emails are now being received and you can send replies through Lynq.
        </p>
      </div>
      <Button onClick={onClose} className="mt-2">Done</Button>
    </div>
  )
}
