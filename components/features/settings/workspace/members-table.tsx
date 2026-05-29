'use client'

import { useState } from 'react'
import { Search, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { useUpdateMemberRole, useRemoveMember, useResendInvite, useRevokeInvite } from '@/hooks/settings'
import { useAuthStore } from '@/stores/auth'
import { can } from '@/lib/permissions'
import { ROLES_FOR_OWNER, ROLES_FOR_ADMIN } from '@/lib/settings-constants'
import { MemberRow, InviteRow } from './member-row'
import type { Member, MemberRole, Invite } from '@/types/settings'

interface MembersTableProps {
  members: Member[]
  invites: Invite[]
  isLoading: boolean
  search: string
  onSearchChange: (value: string) => void
  currentUserRole: MemberRole | null
  isOwner: boolean
  workspaceName: string
}

export function MembersTable({
  members,
  invites,
  isLoading,
  search,
  onSearchChange,
  currentUserRole,
  isOwner,
  workspaceName,
}: MembersTableProps) {
  const userId = useAuthStore((s) => s.user?.id)
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const isImpersonating = useAuthStore((s) => s.isImpersonating)
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()
  const resendInvite = useResendInvite()
  const revokeInvite = useRevokeInvite()

  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const [promoteTarget, setPromoteTarget] = useState<Member | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null)

  const canManage = !isSuspended && !isImpersonating && ((currentUserRole && can.inviteMembers(currentUserRole)) || isOwner)
  const roleOptions = currentUserRole === 'owner' ? ROLES_FOR_OWNER : ROLES_FOR_ADMIN

  function handleRoleSelect(member: Member, newRole: MemberRole) {
    if (member.role === newRole) return
    if (newRole === 'owner' && member.role !== 'owner') {
      setPromoteTarget(member)
      return
    }
    updateRole.mutate({ id: member.id, role: newRole })
  }

  function confirmPromoteToOwner() {
    if (!promoteTarget) return
    updateRole.mutate({ id: promoteTarget.id, role: 'owner' as MemberRole })
    setPromoteTarget(null)
  }

  function handleRemove() {
    if (!removeTarget) return
    removeMember.mutate(removeTarget.id, {
      onSuccess: () => setRemoveTarget(null),
    })
  }

  function confirmRevokeInvite() {
    if (!revokeTarget) return
    revokeInvite.mutate(revokeTarget.id, {
      onSuccess: () => setRevokeTarget(null),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SearchInput value={search} onChange={onSearchChange} />
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>2FA</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-2.5 w-36" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-3 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  const hasRows = members.length > 0 || invites.length > 0

  return (
    <div className="space-y-4">
      <SearchInput value={search} onChange={onSearchChange} />

      <div className="rounded-lg border">
        {!hasRows ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Users size={24} strokeWidth={1.75} className="text-muted-foreground" />
            </div>
            <p className="text-base font-semibold">
              {search ? 'No users match your search' : 'No users yet'}
            </p>
            <p className="max-w-[280px] text-sm text-muted-foreground">
              {search
                ? 'Try a different name or email address.'
                : 'Invite your first teammate to get started.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>2FA</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isMe = member.user_id === userId
                const targetIsOwner = member.role === 'owner'
                const targetIsAdmin = member.role === 'admin'
                const editable =
                  canManage &&
                  !isMe &&
                  !(targetIsOwner && currentUserRole !== 'owner')
                const canRemove =
                  canManage &&
                  !isMe &&
                  !(currentUserRole === 'admin' && (targetIsOwner || targetIsAdmin))

                return (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isMe={isMe}
                    editable={editable}
                    canRemove={canRemove}
                    roleOptions={roleOptions}
                    isRoleUpdating={updateRole.isPending}
                    onRoleSelect={(role) => handleRoleSelect(member, role)}
                    onRemove={() => setRemoveTarget(member)}
                  />
                )
              })}

              {invites.map((invite) => (
                <InviteRow
                  key={`invite-${invite.id}`}
                  invite={invite}
                  canManage={!!canManage}
                  isResending={resendInvite.isPending}
                  isRevoking={revokeInvite.isPending}
                  onResend={() => resendInvite.mutate(invite.id)}
                  onRevoke={() => setRevokeTarget(invite)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Remove member confirmation */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null) }}
        title={`Remove ${removeTarget?.display_name || removeTarget?.email?.split('@')[0] || 'this user'}?`}
        description={`They will lose access to ${workspaceName || 'this workspace'} immediately. Their tickets and activity history will remain but they won't be able to sign in anymore.`}
        confirmLabel="Remove from workspace"
        variant="danger"
        loading={removeMember.isPending}
        onConfirm={handleRemove}
      />

      {/* Promote to owner confirmation */}
      <ConfirmDialog
        open={!!promoteTarget}
        onOpenChange={(open) => { if (!open) setPromoteTarget(null) }}
        title={`Make ${promoteTarget?.display_name || promoteTarget?.email?.split('@')[0] || 'this user'} an owner?`}
        description="Owners have full control of this workspace, including billing and the ability to remove other members. This cannot be undone except by another owner."
        confirmLabel="Make owner"
        onConfirm={confirmPromoteToOwner}
      />

      {/* Revoke invite confirmation */}
      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}
        title="Revoke invite"
        description={`Revoke invite for ${revokeTarget?.email ?? 'this user'}? The invite link will stop working.`}
        confirmLabel="Revoke invite"
        variant="danger"
        loading={revokeInvite.isPending}
        onConfirm={confirmRevokeInvite}
      />
    </div>
  )
}

/* ── Search input ──────────────────────────── */

function SearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative max-w-xs">
      <Search
        size={14}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="text"
        placeholder="Search users\u2026"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="pl-8"
      />
    </div>
  )
}
