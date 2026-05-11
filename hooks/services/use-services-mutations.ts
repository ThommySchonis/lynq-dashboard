'use client'

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

interface InquiryPayload {
  service: string
  phone: string
  message?: string
}

export function useSubmitInquiry() {
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ service, phone, message }: InquiryPayload) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('service_inquiries').insert({
        user_id: user.id,
        client_email: user.email ?? '',
        service,
        phone_number: phone.trim() || null,
        message: message?.trim() || null,
      })
      if (error) throw error
    },
  })
}
