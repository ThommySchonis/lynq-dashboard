'use client'

import { useState, useEffect, useMemo } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { SettingsEmptyState } from '@/components/features/settings/settings-empty-state'
import { useMembersPage } from '@/hooks/settings'
import { useAuthStore } from '@/stores/auth'
import { can } from '@/lib/permissions'
import { DEFAULT_SEAT_LIMIT } from '@/lib/settings-constants'
import type { Role } from '@/types'
import type { MembersPageData } from '@/types/settings'
import { MembersTable } from './members-table'
import { InviteModal } from './invite-modal'

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function MembersView() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [showInvite, setShowInvite] = useState(false)

  const { data: rawData, isLoading } = useMembersPage(debouncedSearch)
  const data = rawData as MembersPageData | undefined

  const currentUserRole: Role | null = data?.currentUserRole ?? useAuthStore.getState().role ?? null
  const isOwner = data?.isOwner ?? false
  const isImpersonating = useAuthStore((s) => s.isImpersonating)
  const canManage = (currentUserRole != null && can.inviteMembers(currentUserRole)) || isOwner

  const seatsUsed = data?.seatsUsed ?? 0
  const seatLimit = data?.seatLimit ?? null
  // Backend has no real seat cap yet → use a constant so the bar fills
  // proportionally (e.g. 1/10) instead of showing a misleading full bar.
  const effectiveSeatLimit = seatLimit ?? DEFAULT_SEAT_LIMIT

  // "Invite user" lives in the full-width section header bar (Figma node 964-29377).
  const headerActions = useMemo(
    () => (
      <Button
        onClick={() => setShowInvite(true)}
        disabled={!canManage || isImpersonating}
        title={isImpersonating ? 'Not available during impersonation' : undefined}
      >
        <UserPlus size={16} strokeWidth={1.75} />
        Invite user
      </Button>
    ),
    [canManage, isImpersonating],
  )

  // Truly empty workspace (no members/invites and no active search) → show just
  // the centered empty card (Figma node 964-29635), no seat counter or search.
  // A search that returns nothing keeps the normal search + table layout.
  const isTrulyEmpty =
    !isLoading &&
    (data?.members?.length ?? 0) === 0 &&
    (data?.invites?.length ?? 0) === 0 &&
    search.trim() === ''

  return (
    <div className="mx-auto flex min-h-full max-w-[800px] flex-col px-6 py-10">
      <SettingsPageHeader
        title="Users"
        description="Manage who has access to this workspace and their roles"
        actions={headerActions}
      />

      {isTrulyEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <UsersEmptyState />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Seat counter */}
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-sm font-semibold text-foreground">
              {seatsUsed} {seatsUsed === 1 ? 'user' : 'users'}
              {seatLimit != null ? ` / ${seatLimit}` : ''}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min((seatsUsed / effectiveSeatLimit) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          <MembersTable
            members={data?.members ?? []}
            invites={data?.invites ?? []}
            isLoading={isLoading}
            search={search}
            onSearchChange={setSearch}
            currentUserRole={currentUserRole}
            isOwner={isOwner}
            workspaceName={data?.workspaceName ?? ''}
          />
        </div>
      )}

      {/* Invite modal */}
      <InviteModal open={showInvite} onOpenChange={setShowInvite} />
    </div>
  )
}

/** Centered empty state shown when the workspace has no members (Figma 964-29635). */
function UsersEmptyState() {
  return (
    <div className="w-[440px] max-w-full rounded-2xl border bg-card px-10 py-7">
      <SettingsEmptyState
        Icon={Users}
        title="No team members yet"
        description="Invite teammates to collaborate on your support inbox and assign roles."
      />
    </div>
  )
}
