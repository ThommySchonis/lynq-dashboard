'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useResendConfirmation } from '@/hooks/auth/use-auth-mutations'

const COOLDOWN_SECONDS = 60

interface ResendConfirmationButtonProps {
  email: string
  variant?: 'panel' | 'inline'
}

export default function ResendConfirmationButton({
  email,
  variant = 'panel',
}: ResendConfirmationButtonProps) {
  const [cooldown, setCooldown] = useState(0)
  const resend = useResendConfirmation()

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const disabled = cooldown > 0 || resend.isPending

  function handleResend() {
    if (disabled) return
    resend.mutate(
      { email },
      {
        onSuccess: () => {
          toast.success('Confirmation email sent')
          setCooldown(COOLDOWN_SECONDS)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Could not resend email')
        },
      },
    )
  }

  const label = resend.isPending
    ? 'Sending…'
    : cooldown > 0
      ? `Resend in ${cooldown}s`
      : "Didn't get it? Resend"

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleResend}
        disabled={disabled}
        className="text-[13px] font-medium text-primary hover:underline transition-colors duration-150 disabled:opacity-60 disabled:no-underline disabled:cursor-default"
      >
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={disabled}
      className="mt-6 w-full h-12 rounded-xl text-[14px] font-medium text-white transition-all duration-200 hover:not-disabled:brightness-110 active:not-disabled:scale-[0.99] disabled:opacity-60 disabled:cursor-default"
      style={{
        background: 'linear-gradient(135deg, #7F77DD 0%, #6366F1 100%)',
        boxShadow: '0 8px 28px rgba(127,119,221,0.35)',
      }}
    >
      {label}
    </button>
  )
}
