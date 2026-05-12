'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth'
import { useSubmitInquiry } from '@/hooks/services'
import { SERVICES, TRAIN_SERVICE } from '@/lib/services-constants'
import type { LucideIcon } from 'lucide-react'
import { ServiceCard } from '@/components/features/services/service-card'
import { InquiryForm } from '@/components/features/services/inquiry-form'
import { SuccessState } from '@/components/features/services/success-state'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModalService {
  id: string
  title: string
  icon: LucideIcon | null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? null

  const [activeService, setActiveService] = useState<ModalService | null>(null)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submitInquiry = useSubmitInquiry()

  // Escape key closes modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveService(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function openModal(svc: ModalService) {
    setActiveService(svc)
    setPhone('')
    setMessage('')
    setFormError('')
    setSubmitted(false)
  }

  function closeModal() {
    setActiveService(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!userId) return
    setFormError('')

    submitInquiry.mutate(
      { service: activeService!.title, phone, message },
      {
        onSuccess: () => setSubmitted(true),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Something went wrong'
          setFormError(msg)
          toast.error(msg)
        },
      },
    )
  }

  return (
    <>
      <main className="flex min-h-screen flex-col overflow-y-auto p-6 bg-[#F9F8FF] text-(--text-1) relative [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/[0.12] [&::-webkit-scrollbar-thumb]:rounded-sm">
        <div className="max-w-[840px] mx-auto">

          {/* Header */}
          <div className="animate-[fadeUp_.4s_ease_both] mb-8">
            <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[.1em] mb-2.5">
              Services
            </div>
            <h1 className="text-[20px] font-bold text-[#0F0F10] tracking-[-0.02em] mb-2">
              Grow Your Team
            </h1>
            <p className="text-[14px] text-[#6B7280] max-w-[480px] leading-relaxed">
              World-class e-commerce specialists, trained to your brand standards and ready to
              perform from day one.
            </p>
          </div>

          {/* 2-column grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {SERVICES.map((svc, i) => (
              <ServiceCard
                key={svc.id}
                svc={svc}
                index={i}
                onRequest={() =>
                  openModal({ id: svc.id, title: svc.title, icon: svc.icon })
                }
              />
            ))}
          </div>

          {/* Train Your Team — full width */}
          <div className="mb-4">
            <ServiceCard
              svc={TRAIN_SERVICE}
              index={4}
              onRequest={() =>
                openModal({
                  id: TRAIN_SERVICE.id,
                  title: TRAIN_SERVICE.title,
                  icon: TRAIN_SERVICE.icon,
                })
              }
            />
          </div>

          {/* Bottom CTA */}
          <div className="animate-[fadeUp_.5s_ease_.42s_both] mb-10">
            <div className="flex items-center justify-between flex-wrap gap-4 px-6 py-5 rounded-xl bg-white border border-black/[0.07]">
              <div>
                <p className="text-[15px] font-semibold text-[#0F0F10] mb-1">
                  Not sure which role you need?
                </p>
                <p className="text-[13px] text-[#6B7280]">
                  We&apos;ll help you figure out the perfect fit.
                </p>
              </div>
              <button
                onClick={() =>
                  openModal({ id: 'general', title: 'General Inquiry', icon: null })
                }
                className="px-5 h-10 rounded-lg bg-[#0F0F10] text-white border-none text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-150 hover:bg-[#1a1a1a]"
              >
                Talk to Us →
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Inquiry Modal */}
      <Dialog open={activeService !== null} onOpenChange={(open) => { if (!open) closeModal() }}>
        <DialogContent
          showCloseButton={!submitted}
          className="max-w-[480px] bg-(--bg-surface) border border-(--border) rounded-[22px] p-9 shadow-[0_32px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]"
        >
          {activeService && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>
                  {submitted ? 'Request sent' : activeService.title}
                </DialogTitle>
              </DialogHeader>
              {submitted ? (
                <SuccessState
                  serviceName={activeService.title}
                  onClose={closeModal}
                />
              ) : (
                <InquiryForm
                  service={activeService}
                  phone={phone}
                  setPhone={setPhone}
                  message={message}
                  setMessage={setMessage}
                  onSubmit={handleSubmit}
                  submitting={submitInquiry.isPending}
                  formError={formError}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
