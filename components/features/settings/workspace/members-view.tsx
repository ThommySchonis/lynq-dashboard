'use client'

import { useState, useEffect } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMembersPage } from '@/hooks/settings'
import { useAuthStore } from '@/stores/auth'
import { can } from '@/lib/permissions'
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

  const { data, isLoading } = useMembersPage(debouncedSearch)

  const currentUserRole = data?.currentUserRole ?? useAuthStore.getState().role ?? null
  const isOwner = data?.isOwner ?? false
  const canManage = (currentUserRole && can.inviteMembers(currentUserRole)) || isOwner

  const seatsUsed = data?.seatsUsed ?? 0
  const seatLimit = data?.seatLimit ?? null

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage who has access to this workspace and their roles
          </p>
        </div>
        <Button
          onClick={() => setShowInvite(true)}
          disabled={!canManage}
        >
          <UserPlus size={16} strokeWidth={1.75} />
          Invite user
        </Button>
      </div>

      {/* Seat counter */}
      <div className="flex items-center gap-2.5">
        <span className="text-xs text-muted-foreground">
          {seatsUsed} {seatsUsed === 1 ? 'user' : 'users'}
          {seatLimit != null ? ` / ${seatLimit}` : ''}
        </span>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: seatLimit ? `${Math.min((seatsUsed / seatLimit) * 100, 100)}%` : '100%',
            }}
          />
        </div>
      </div>

      {/* Members table */}
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

      {/* Invite modal */}
      <InviteModal open={showInvite} onOpenChange={setShowInvite} />
    </div>
  )
}
