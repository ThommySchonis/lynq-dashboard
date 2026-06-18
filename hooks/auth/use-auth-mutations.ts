'use client'

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { parseJson } from '@/lib/utils/typed-json'
import { apiUrl } from '@/lib/api-client'

export interface SignInVariables {
  email: string
  password: string
}

export interface SignUpVariables {
  email: string
  password: string
  first_name: string
  last_name: string
  company_name: string
}

export interface ResetPasswordRequestVariables {
  email: string
}

export interface ResetPasswordVariables {
  password: string
}

export interface ResendConfirmationVariables {
  email: string
}

export interface AcceptInviteResult {
  ok: boolean
}

export interface InviteSignupVariables {
  full_name: string
  password: string
}

export interface InviteSignupResult {
  ok: boolean
}

interface InviteResponse {
  error?: string
  code?: string
  ok?: boolean
}

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, password }: SignInVariables) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      return data
    },
  })
}

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ email, password, first_name, last_name, company_name }: SignUpVariables) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            company_name: company_name.trim(),
          },
        },
      })
      if (error) throw error
      return data
    },
  })
}

export function useResetPasswordRequest() {
  return useMutation({
    mutationFn: async ({ email }: ResetPasswordRequestVariables) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
    },
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ password }: ResetPasswordVariables) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
  })
}

export function useResendConfirmation() {
  return useMutation({
    mutationFn: async ({ email }: ResendConfirmationVariables) => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      })
      if (error) throw error
    },
  })
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      useAuthStore.getState().clearSession()
    },
  })
}

export function useAcceptInvite(token: string) {
  return useMutation({
    mutationFn: async (): Promise<AcceptInviteResult> => {
      const accessToken = useAuthStore.getState().session?.access_token
      const res = await fetch(apiUrl(`invites/${token}/accept`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await parseJson<InviteResponse>(res).catch((): InviteResponse => ({}))
      if (!res.ok) throw Object.assign(new Error(data.error || 'Failed to accept invite'), { code: data.code, ...data })
      return { ok: !!data.ok }
    },
  })
}

export function useInviteSignup(token: string) {
  return useMutation({
    mutationFn: async ({ full_name, password }: InviteSignupVariables): Promise<InviteSignupResult> => {
      const res = await fetch(apiUrl(`invites/${token}/signup`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: full_name.trim(), password }),
      })
      const data = await parseJson<InviteResponse>(res).catch((): InviteResponse => ({}))
      if (!res.ok || !data.ok) throw Object.assign(new Error(data.error || 'Could not create account'), { code: data.code, ...data })
      return { ok: !!data.ok }
    },
  })
}
