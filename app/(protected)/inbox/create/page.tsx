'use client'

import { useEffect } from 'react'
import { useCreateTicketForm } from '@/hooks/inbox/use-create-ticket'
import { CreateTicketRecentPanel } from '@/components/features/inbox/create-ticket/recent-panel'
import { CreateTicketComposer } from '@/components/features/inbox/create-ticket/composer'
import { CreateTicketDetailsPanel } from '@/components/features/inbox/create-ticket/details-panel'

// ── Create Ticket page ──
// Thin orchestrator: owns form state via useCreateTicketForm() and composes the
// three columns (recent tickets · composer · ticket details) per Figma.
export default function CreateTicketPage() {
  const form = useCreateTicketForm()
  const { goBack } = form

  // Escape returns to the inbox.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') goBack()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [goBack])

  return (
    <div className="relative flex h-full overflow-hidden bg-background">
      {/* Aurora background (dark mode only, decorative) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hidden dark:block absolute rounded-full animate-aurora-a" style={{ top: '-25%', left: '12%', width: 1000, height: 900, background: 'radial-gradient(ellipse,rgba(161,117,252,0.62) 0%,rgba(124,58,237,0.32) 38%,rgba(109,40,217,0.1) 60%,transparent 74%)', filter: 'blur(55px)' }} />
        <div className="hidden dark:block absolute rounded-full animate-aurora-d" style={{ top: '2%', left: '3%', width: 420, height: 420, background: 'radial-gradient(ellipse,rgba(139,92,246,0.55) 0%,rgba(109,40,217,0.22) 50%,transparent 72%)', filter: 'blur(42px)' }} />
        <div className="hidden dark:block absolute rounded-full animate-aurora-b" style={{ bottom: '10%', left: '30%', width: 500, height: 500, background: 'radial-gradient(ellipse,rgba(107,63,196,0.38) 0%,rgba(75,40,148,0.14) 48%,transparent 70%)', filter: 'blur(58px)', animationDirection: 'reverse' }} />
        <div className="hidden dark:block absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)', backgroundSize: '72px 72px' }} />
      </div>

      <CreateTicketRecentPanel onBack={goBack} />
      <CreateTicketComposer form={form} />
      <CreateTicketDetailsPanel form={form} />
    </div>
  )
}
