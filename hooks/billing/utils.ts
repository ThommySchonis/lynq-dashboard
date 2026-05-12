'use client'

import { useAuthStore } from '@/stores/auth'

export function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}
