'use client'

import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ForwardingEmailStepProps {
  email: string
  onEmailChange: (email: string) => void
  error: string
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function ForwardingEmailStep({ email, onEmailChange, error, isPending, onSubmit }: ForwardingEmailStepProps) {
  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-col gap-3">
        <div>
          <Label htmlFor="fwd-email" className="mb-1.5 text-xs font-semibold">
            Your business email
          </Label>
          <Input
            id="fwd-email"
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEmailChange(e.target.value)}
            placeholder="you@yourdomain.com"
            autoFocus
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-3.5 flex-shrink-0" />
            {error}
          </div>
        )}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          {isPending ? 'Setting up...' : 'Continue'}
        </Button>
      </div>
    </form>
  )
}
