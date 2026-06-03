'use client'

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/api-client'
import { parseJson } from '@/lib/utils/typed-json'

interface ErrorResponse {
  error?: string
}

interface ShopifyOAuthResponse {
  url?: string
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export interface BrandSetupForm {
  brandName: string
  language: string
  tone: string
}

export interface ParcelPanelForm {
  parcelpanel_api_key: string
}

export function useSaveBrand() {
  return useMutation({
    mutationFn: async (form: BrandSetupForm) => {
      return rpc('api_save_brand_settings', {
        p_brand_name: form.brandName,
        p_language: form.language,
        p_tone: form.tone,
      })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useConnectParcelPanel() {
  const token = useToken()
  return useMutation({
    mutationFn: async (form: ParcelPanelForm) => {
      const res = await fetch(apiUrl('settings/integrations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to connect ParcelPanel')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      toast.success('ParcelPanel connected')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useConnectShopify() {
  const token = useToken()

  return useMutation({
    mutationFn: async (shop: string) => {
      const res = await fetch('/api/auth/shopify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shop }),
      })
      if (!res.ok) throw new Error('Failed to connect Shopify')
      return parseJson<ShopifyOAuthResponse>(res)
    },
  })
}

export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, onboarding_completed: true })
      if (error) throw new Error(error.message)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
