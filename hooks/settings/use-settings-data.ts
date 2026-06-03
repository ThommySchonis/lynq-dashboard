'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'
import { useStoreStore } from '@/stores/store'
import type { WorkspaceSettings, Member, UserProfile, MacroFilter, MacroOnboarding, Tag, EmailAccount, ShopifyIntegration, MembersPageData } from '@/types/settings'
import type { Macro } from '@/types/inbox'

interface WorkspaceResponse {
  workspace: WorkspaceSettings
}

interface MembersResponse {
  members?: Member[]
}

interface MembersPageResponse {
  members?: MembersPageData['members']
  invites?: MembersPageData['invites']
  currentUserRole?: MembersPageData['currentUserRole']
  isOwner?: boolean
  workspaceName?: string
  seatsUsed?: number
  seatLimit?: number | null
}

interface ProfileResponse {
  profile: UserProfile
}

interface MacrosResponse {
  macros?: Macro[]
}

interface MacroOnboardingResponse {
  onboarding: MacroOnboarding
}

interface TagsResponse {
  tags?: Tag[]
}

interface EmailAccountsResponse {
  accounts?: EmailAccount[]
}

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
      const data = await rpc<{ workspace: WorkspaceSettings; role: string }>('api_get_workspace')
      return data.workspace
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useMembers() {
  const token = useToken()
  return useQuery<Member[]>({
    queryKey: settingsKeys.members(),
    queryFn: async () => {
      const data = await rpc<MembersPageResponse>('api_list_workspace_members')
      return data.members as Member[] ?? []
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useMembersPage(search = '') {
  const token = useToken()
  return useQuery<MembersPageData>({
    queryKey: [...settingsKeys.members(), search],
    queryFn: async () => {
      const data = await rpc<MembersPageResponse>('api_list_workspace_members', {
        p_search: search || null,
      })
      return {
        members: data.members ?? [],
        invites: data.invites ?? [],
        currentUserRole: data.currentUserRole ?? null,
        isOwner: data.isOwner === true,
        workspaceName: data.workspaceName ?? '',
        seatsUsed: data.seatsUsed ?? 0,
        seatLimit: data.seatLimit ?? null,
      }
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useProfile() {
  const token = useToken()
  return useQuery<UserProfile>({
    queryKey: settingsKeys.profile(),
    queryFn: async () => {
      const data = await rpc<ProfileResponse>('api_get_profile')
      return data.profile
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useMacros(filter: MacroFilter) {
  const token = useToken()
  return useQuery<Macro[]>({
    queryKey: settingsKeys.macros(filter),
    queryFn: async () => {
      const data = await rpc<{ macros: Macro[] }>('api_list_macros', {
        p_archived: filter.archived ? 'true' : 'false',
        p_search: filter.search || null,
        p_language: filter.language || null,
        p_tags: filter.tags.length > 0 ? filter.tags.join(',') : null,
      })
      return data.macros ?? []
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useMacroOnboarding() {
  const token = useToken()
  return useQuery<MacroOnboarding>({
    queryKey: settingsKeys.macroOnboarding(),
    queryFn: async () => {
      const data = await rpc<{ onboarding: MacroOnboarding }>('api_get_macro_onboarding')
      return data.onboarding
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useTags() {
  const token = useToken()
  return useQuery<Tag[]>({
    queryKey: settingsKeys.tags(),
    queryFn: async () => {
      const data = await rpc<{ tags: Tag[] }>('api_list_tags')
      return data.tags ?? []
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useEmailAccounts() {
  const token = useToken()
  return useQuery<EmailAccount[]>({
    queryKey: settingsKeys.emailAccounts(),
    queryFn: async () => {
      const data = await rpc<EmailAccountsResponse>('api_list_email_accounts')
      return data.accounts ?? []
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}

export function useShopifyIntegration() {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  return useQuery<ShopifyIntegration>({
    queryKey: settingsKeys.shopify(activeStoreId),
    queryFn: async () => {
      return rpc<ShopifyIntegration>('api_get_shopify_integration', {
        p_store_id: activeStoreId ?? null,
      })
    },
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
}
