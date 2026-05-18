'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'
import type { WorkspaceSettings, Member, UserProfile, MacroFilter, MacroOnboarding, Tag, EmailAccount, ShopifyIntegration, MembersPageData } from '@/types/settings'
import type { Macro } from '@/types/inbox'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const settingsKeys = {
  all: ['settings'] as const,
  workspace: () => [...settingsKeys.all, 'workspace'] as const,
  members: () => [...settingsKeys.all, 'members'] as const,
  profile: () => [...settingsKeys.all, 'profile'] as const,
  macros: (filter: MacroFilter) => [...settingsKeys.all, 'macros', filter] as const,
  macroOnboarding: () => [...settingsKeys.all, 'macro-onboarding'] as const,
  tags: () => [...settingsKeys.all, 'tags'] as const,
  emailAccounts: () => [...settingsKeys.all, 'email-accounts'] as const,
  shopify: (storeId: string | null) => [...settingsKeys.all, 'shopify', storeId] as const,
}

export function useWorkspace() {
  const token = useToken()
  return useQuery<WorkspaceSettings>({
    queryKey: settingsKeys.workspace(),
    queryFn: async () => {
      const res = await fetch('/api/workspaces/current', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load workspace')
      const { workspace } = await res.json()
      return workspace as WorkspaceSettings
    },
    enabled: !!token,
  })
}

export function useMembers() {
  const token = useToken()
  return useQuery<Member[]>({
    queryKey: settingsKeys.members(),
    queryFn: async () => {
      const res = await fetch('/api/workspaces/current/members', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load members')
      const data = await res.json()
      return (data.members ?? data) as Member[]
    },
    enabled: !!token,
  })
}

export function useMembersPage(search = '') {
  const token = useToken()
  return useQuery<MembersPageData>({
    queryKey: [...settingsKeys.members(), search],
    queryFn: async () => {
      const params = search ? `?q=${encodeURIComponent(search)}` : ''
      const res = await fetch(`/api/workspaces/current/members${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load members')
      const data = await res.json()
      return {
        members: data.members ?? [],
        invites: data.invites ?? [],
        currentUserRole: data.currentUserRole ?? null,
        isOwner: data.isOwner === true,
        workspaceName: data.workspaceName ?? '',
        seatsUsed: data.seatsUsed ?? 0,
        seatLimit: data.seatLimit ?? null,
      } as MembersPageData
    },
    enabled: !!token,
  })
}

export function useProfile() {
  const token = useToken()
  return useQuery<UserProfile>({
    queryKey: settingsKeys.profile(),
    queryFn: async () => {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load profile')
      const { profile } = await res.json()
      return profile as UserProfile
    },
    enabled: !!token,
  })
}

export function useMacros(filter: MacroFilter) {
  const token = useToken()
  return useQuery<Macro[]>({
    queryKey: settingsKeys.macros(filter),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filter.archived) params.set('archived', 'true')
      if (filter.search) params.set('search', filter.search)
      if (filter.language) params.set('language', filter.language)
      if (filter.tags.length > 0) params.set('tags', filter.tags.join(','))
      const url = `/api/macros${params.toString() ? `?${params}` : ''}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load macros')
      const data = await res.json()
      return (data.macros ?? []) as Macro[]
    },
    enabled: !!token,
  })
}

export function useMacroOnboarding() {
  const token = useToken()
  return useQuery<MacroOnboarding>({
    queryKey: settingsKeys.macroOnboarding(),
    queryFn: async () => {
      const res = await fetch('/api/macros/onboarding', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load macro onboarding')
      const { onboarding } = await res.json()
      return onboarding as MacroOnboarding
    },
    enabled: !!token,
  })
}

export function useTags() {
  const token = useToken()
  return useQuery<Tag[]>({
    queryKey: settingsKeys.tags(),
    queryFn: async () => {
      const res = await fetch('/api/tags', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load tags')
      const data = await res.json()
      return (data.tags ?? []) as Tag[]
    },
    enabled: !!token,
  })
}

export function useEmailAccounts() {
  const token = useToken()
  return useQuery<EmailAccount[]>({
    queryKey: settingsKeys.emailAccounts(),
    queryFn: async () => {
      const res = await fetch('/api/inbox/accounts', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to load email accounts')
      const data = await res.json()
      return (Array.isArray(data) ? data : (data.accounts ?? [])) as EmailAccount[]
    },
    enabled: !!token,
  })
}

export function useShopifyIntegration() {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  return useQuery<ShopifyIntegration>({
    queryKey: settingsKeys.shopify(activeStoreId),
    queryFn: async () => {
      const storeParam = activeStoreId ? `?store_id=${activeStoreId}` : ''
      const res = await fetch(`/api/settings/integrations/shopify${storeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to load Shopify integration')
      return res.json() as Promise<ShopifyIntegration>
    },
    enabled: !!token,
  })
}
