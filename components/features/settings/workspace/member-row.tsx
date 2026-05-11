'use client'

import {
  MoreHorizontal,
  Mail,
  Check,
  Loader2,
  ChevronDown,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { TableRow, TableCell } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import {
  ROLE_LABELS,
  ROLE_DESCS_FULL,
} from '@/lib/settings-constants'
import type { Member, MemberRole, Invite } from '@/types/settings'

function getInitials(name: string | null, email: string): string {
  const src = name || email || '?'
  return src.slice(0, 2).toUpperCase()
}

function expiryLabel(expiresAt: string | null): { text: string; tone: 'expired' | 'today' | 'normal' } | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return { text: 'Expired', tone: 'expired' }
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  if (days === 0) return { text: 'Expires today', tone: 'today' }
  if (days === 1) return { text: 'Expires tomorrow', tone: 'normal' }
  return { text: `Expires in ${days} days`, tone: 'normal' }
}

export const ROLE_BADGE_CLASSES: Record<MemberRole, string> = {
  owner: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  admin: 'bg-muted text-muted-foreground',
  agent: 'bg-muted text-muted-foreground',
  observer: 'bg-muted text-muted-foreground',
}

/* ── Active member row ─────────────────────── */

interface MemberRowProps {
  member: Member
  isMe: boolean
  editable: boolean
  canRemove: boolean
  roleOptions: MemberRole[]
  isRoleUpdating: boolean
  onRoleSelect: (role: MemberRole) => void
  onRemove: () => void
}

export function MemberRow({
  member,
  isMe,
  editable,
  canRemove,
  roleOptions,
  isRoleUpdating,
  onRoleSelect,
  onRemove,
}: MemberRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar>
            {member.avatar_url ? (
              <AvatarImage src={member.avatar_url} alt="" />
            ) : null}
            <AvatarFallback>
              {getInitials(member.display_name, member.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">
                {member.display_name || member.email?.split('@')[0] || '\u2014'}
              </span>
              {isMe && (
                <span className="text-xs text-muted-foreground">(you)</span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {member.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {editable ? (
          <RoleBadgeDropdown
            currentRole={member.role}
            options={roleOptions}
            onSelect={onRoleSelect}
            isUpdating={isRoleUpdating}
          />
        ) : (
          <Badge
            variant="secondary"
            className={ROLE_BADGE_CLASSES[member.role]}
          >
            {ROLE_LABELS[member.role] || member.role}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {(member as Member & { two_factor_enabled?: boolean }).two_factor_enabled ? (
          <Check size={14} strokeWidth={2} className="text-green-500" />
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </TableCell>
      <TableCell>
        {canRemove && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-xs" />}
            >
              <MoreHorizontal size={16} strokeWidth={1.75} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={onRemove}>
                <Trash2 size={14} strokeWidth={1.75} />
                Remove from workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  )
}

/* ── Pending invite row ────────────────────── */

interface InviteRowProps {
  invite: Invite
  canManage: boolean
  isResending: boolean
  isRevoking: boolean
  onResend: () => void
  onRevoke: () => void
}

export function InviteRow({
  invite,
  canManage,
  isResending,
  isRevoking,
  onResend,
  onRevoke,
}: InviteRowProps) {
  const exp = expiryLabel(invite.expires_at)
  const inviter = invite.inviter_name || invite.inviter_email
  const isBusy = isResending || isRevoking

  return (
    <TableRow className="bg-amber-50/50 dark:bg-amber-950/10">
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Mail size={14} strokeWidth={1.75} />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {invite.email}
              </span>
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              >
                Pending
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {inviter ? `Invited by ${inviter}` : null}
              {inviter && exp ? ' \u00b7 ' : null}
              {exp ? (
                <span
                  className={
                    exp.tone === 'expired'
                      ? 'font-medium text-destructive'
                      : exp.tone === 'today'
                        ? 'font-medium text-amber-600'
                        : ''
                  }
                >
                  {exp.text}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={ROLE_BADGE_CLASSES[invite.role]}
        >
          {ROLE_LABELS[invite.role]}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground">&mdash;</span>
      </TableCell>
      <TableCell>
        {canManage && (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onResend}
              disabled={isBusy}
              title="Resend invite"
            >
              {isResending ? (
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              ) : (
                <RefreshCw size={14} strokeWidth={1.75} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-destructive hover:text-destructive"
              onClick={onRevoke}
              disabled={isBusy}
              title="Revoke invite"
            >
              {isRevoking ? (
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              ) : (
                <Trash2 size={14} strokeWidth={1.75} />
              )}
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

/* ── Role badge with dropdown ──────────────── */

function RoleBadgeDropdown({
  currentRole,
  options,
  onSelect,
  isUpdating,
}: {
  currentRole: MemberRole
  options: MemberRole[]
  onSelect: (role: MemberRole) => void
  isUpdating: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isUpdating}
        render={
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${ROLE_BADGE_CLASSES[currentRole]}`}
          />
        }
      >
        {isUpdating && <Loader2 size={11} strokeWidth={1.75} className="animate-spin" />}
        {ROLE_LABELS[currentRole] || currentRole}
        {!isUpdating && <ChevronDown size={11} strokeWidth={2} className="opacity-60" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[240px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Change role</DropdownMenuLabel>
          {options.map((role) => {
            const active = currentRole === role
            return (
              <DropdownMenuItem
                key={role}
                onClick={() => onSelect(role)}
                className={active ? 'text-primary' : ''}
              >
                <span className="flex w-3.5 shrink-0 items-center">
                  {active && <Check size={14} strokeWidth={2} className="text-primary" />}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_DESCS_FULL[role]}
                  </span>
                </div>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
