'use client'

import type { FormEvent } from 'react'
import { Clock, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ModalService {
  id: string
  title: string
  icon: LucideIcon | null
}

interface InquiryFormProps {
  service: ModalService
  phone: string
  setPhone: (v: string) => void
  message: string
  setMessage: (v: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  submitting: boolean
  formError: string
}

export function InquiryForm({
  service,
  phone,
  setPhone,
  message,
  setMessage,
  onSubmit,
  submitting,
  formError,
}: InquiryFormProps) {
  const isGeneral = service.id === 'general'
  const Icon = service.icon

  return (
    <>
      <div className="mb-6">
        {!isGeneral && Icon ? (
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/8 border border-[#E5E0EB] flex items-center justify-center shrink-0">
              <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-[.07em] mb-0.5">
                Service Inquiry
              </div>
              <h3 className="text-[18px] font-extrabold text-foreground tracking-[-0.03em] leading-tight">
                {service.title}
              </h3>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-[22px] font-extrabold text-foreground tracking-[-0.04em] mb-1.5">
              Let&apos;s talk
            </h3>
            <p className="text-[13.5px] text-foreground-2">
              Tell us what you&apos;re looking for and we&apos;ll find the right fit.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[9px] bg-secondary border border-border mb-6">
        <Clock className="size-3 text-muted-foreground shrink-0" />
        <span className="text-[12.5px] text-foreground-2">
          We reply within <strong className="text-foreground-2">24 hours</strong>
        </span>
      </div>

      <form onSubmit={onSubmit}>
        <label className="block text-[10.5px] font-bold text-foreground-2 uppercase tracking-[.07em] mb-1.5">
          WhatsApp number <span className="text-[#f87171] font-extrabold">*</span>
        </label>
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+31 6 12345678"
          className="w-full px-3.5 py-3 bg-input border border-border rounded-[10px] text-foreground text-[13.5px] outline-none transition-colors duration-150 focus:border-(--border-hover) placeholder:text-muted-foreground mb-4 box-border"
        />

        <label className="block text-[10.5px] font-bold text-foreground-2 uppercase tracking-[.07em] mb-1.5">
          Your question{' '}
          <span className="font-normal normal-case tracking-normal">(optional)</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            isGeneral
              ? "What are you looking for? Any specific roles or challenges you're facing…"
              : 'What would you like to know about this service?'
          }
          className="w-full px-3.5 py-3 bg-input border border-border rounded-[10px] text-foreground text-[13.5px] outline-none transition-colors duration-150 focus:border-(--border-hover) placeholder:text-muted-foreground resize-none min-h-[90px] leading-[1.65] box-border"
        />

        {formError && (
          <div className="flex items-center gap-1.5 text-[12.5px] text-[#f87171] mt-2">
            <X className="size-3 shrink-0" strokeWidth={2} />
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-4 py-3.5 px-5 rounded-[11px] border-none bg-[#111111] text-white text-[13.5px] font-bold cursor-pointer tracking-[.015em] transition-colors duration-150 hover:enabled:bg-[#333333] disabled:opacity-55 disabled:cursor-not-allowed"
        >
          {submitting ? 'Sending…' : 'Send Request →'}
        </button>
      </form>
    </>
  )
}
