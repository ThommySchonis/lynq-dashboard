'use client'

import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SuccessStateProps {
  serviceName: string
  onClose: () => void
}

export function SuccessState({ serviceName, onClose }: SuccessStateProps) {
  return (
    <div className="text-center py-3">
      <div className="w-[68px] h-[68px] rounded-full bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.3)] flex items-center justify-center mx-auto mb-5 animate-[checkPop_.45s_cubic-bezier(.16,1,.3,1)_both]">
        <CheckCircle2 className="size-7 text-[#4ade80]" strokeWidth={2.5} />
      </div>
      <h3 className="text-[22px] font-extrabold text-foreground tracking-[-0.04em] mb-2">
        Request sent!
      </h3>
      {serviceName && serviceName !== 'General Inquiry' && (
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-secondary border border-border text-[12px] text-foreground-2 mb-3.5">
          {serviceName}
        </div>
      )}
      <p className="text-[14px] text-foreground-2 leading-[1.7] max-w-[320px] mx-auto mb-7">
        Your inquiry is with the Lynq & Flow team. We&apos;ll reach out within{' '}
        <strong className="text-foreground-2">24 hours</strong>.
      </p>
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
    </div>
  )
}
