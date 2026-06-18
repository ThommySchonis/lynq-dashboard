'use client'

import ResendConfirmationButton from '@/components/features/auth/resend-confirmation-button'

interface VerifyPanelProps {
  email: string
}

export function VerifyPanel({ email }: VerifyPanelProps) {
  return (
    <div
      className="opacity-0 animate-fade-up motion-reduce:opacity-100 motion-reduce:animate-none rounded-3xl px-10 py-12 text-center backdrop-blur-xl"
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: [
          '0 0 100px rgba(127,119,221,0.25)',
          '0 8px 32px rgba(0,0,0,0.45)',
          'inset 0 1px 0 rgba(255,255,255,0.10)',
        ].join(', '),
      }}
    >
      <div className="text-4xl mb-3">✉️</div>
      <div className="text-lg font-medium mb-2">Check your email</div>
      <p className="text-sm text-white/60 leading-relaxed">
        We sent a confirmation link to{' '}
        <strong className="text-white">{email}</strong>.{' '}
        Click it to activate your account.
      </p>
      <ResendConfirmationButton email={email} variant="panel" />
    </div>
  )
}
