'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap,
  CheckCircle,
  CircleAlert,
  Loader2,
  Plus,
  RotateCcw,
  User,
  ExternalLink,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { BADGE_COLORS, fmtEur } from '@/lib/analytics-constants'
import { useTasksQuery, useUpdateTask, useWorkspaceMembers } from '@/hooks/tasks'
import { CreateTaskModal } from '@/components/shared/modals/create-task-modal'
import { useAuthStore } from '@/stores/auth'
import type { Task } from '@/types/tasks'

// ── CatBadge ────────────────────────────────────────────────────────────────

interface CatBadgeProps {
  cat: string
  small?: boolean
}

export function CatBadge({ cat, small }: CatBadgeProps) {
  const c = BADGE_COLORS[cat] || BADGE_COLORS['Other']
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full font-bold uppercase tracking-[.05em]"
      style={{
        fontSize: small ? 9.5 : 10.5,
        color: c.color,
        background: c.bg,
        border: c.border || 'none',
        padding: small ? '1px 7px' : '2px 9px',
      }}
    >
      {cat}
    </span>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Component ───────────────────────────────────────────────────────────────

interface ActionBoardProps {
  demoMode: boolean
}

export function ActionBoard({ demoMode }: ActionBoardProps) {
  const router = useRouter()
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const [activeTab, setActiveTab] = useState<'open' | 'picked_up' | 'done'>('open')
  const [noteInps, setNoteInps] = useState<Record<string, string>>({})
  const [assignDropdown, setAssignDropdown] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const tasksQuery = useTasksQuery()
  const updateTask = useUpdateTask()
  const membersQuery = useWorkspaceMembers()

  const tasks: Task[] = tasksQuery.data ?? []
  const members = membersQuery.data ?? []

  const openItems = tasks.filter(t => t.status === 'open')
  const pickupItems = tasks.filter(t => t.status === 'picked_up')
  const doneItems = tasks.filter(t => t.status === 'done')
  const allItems = tasks
  const tabItems = activeTab === 'open' ? openItems : activeTab === 'picked_up' ? pickupItems : doneItems

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (!demoMode && tasksQuery.isPending) {
    return (
      <div className="mb-6 rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2.5">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
          <div className="text-sm font-bold text-foreground-2">Loading tasks...</div>
        </div>
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    )
  }

  // ── Demo mode empty state ─────────────────────────────────────────────────

  if (demoMode) {
    return (
      <div className="mb-6 animate-fade-up rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Zap size={16} className="text-orange-500" />
          <span className="text-[15px] font-bold text-foreground">Action Board</span>
        </div>
        <div className="py-9 text-center">
          <CircleAlert size={32} className="mx-auto mb-2.5 text-muted-foreground/35" />
          <div className="text-[13px] text-muted-foreground">
            Connect Shopify to see real tasks based on your refund data
          </div>
        </div>
      </div>
    )
  }

  // ── Status change handlers ────────────────────────────────────────────────

  function handlePickUp(task: Task) {
    updateTask.mutate({ id: task.id, status: 'picked_up' })
  }

  function handleReopen(task: Task) {
    updateTask.mutate({ id: task.id, status: 'open', assignedTo: null })
  }

  function handleMarkDone(task: Task) {
    updateTask.mutate({
      id: task.id,
      status: 'done',
      resultNote: noteInps[task.id] || undefined,
    })
    setNoteInps(p => {
      const next = { ...p }
      delete next[task.id]
      return next
    })
  }

  function handleAssign(task: Task, memberId: string) {
    updateTask.mutate({ id: task.id, assignedTo: memberId })
    setAssignDropdown(null)
  }

  const TABS = ['open', 'picked_up', 'done'] as const
  const TAB_LABELS: Record<string, string> = { open: 'Open', picked_up: 'Picked Up', done: 'Done' }
  const noTasks = allItems.length === 0

  return (
    <>
      <div className="mb-6 animate-fade-up rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl transition-shadow duration-200 hover:shadow-lg">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              {noTasks
                ? <CheckCircle size={16} className="text-green-500" />
                : <Zap size={16} className="text-orange-500" />}
              <span className="text-[15px] font-bold text-foreground">
                {noTasks ? 'No tasks — all clear' : 'Action Board'}
              </span>
              {!noTasks && (
                <span className="text-[11px] text-muted-foreground">
                  — {allItems.length} task{allItems.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {noTasks ? 'No open tasks right now' : 'Tasks based on your refund data — assign to your team'}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={isSuspended}
              className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11.5px] font-semibold text-primary transition-all duration-150 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={12} />
              New Task
            </button>
            {!noTasks && TABS.map(tab => {
              const cnt = tab === 'open' ? openItems.length : tab === 'picked_up' ? pickupItems.length : doneItems.length
              const isAct = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full border px-3.5 py-1 text-[11.5px] font-semibold transition-all duration-150 ${
                    isAct
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-black/[0.08] bg-transparent text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {TAB_LABELS[tab]}
                  {cnt > 0 && <span className="ml-1.5 text-[10px] opacity-65">{cnt}</span>}
                </button>
              )
            })}
            {noTasks && (
              <div className="rounded-md border border-green-600/20 bg-green-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[.05em] text-green-700">
                All clear
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {!noTasks && allItems.length > 0 && (
          <div className="mb-4 h-[3px] overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gray-900 transition-[width] duration-400"
              style={{ width: `${(doneItems.length / allItems.length) * 100}%` }}
            />
          </div>
        )}

        {/* Empty state per tab */}
        {tabItems.length === 0 && !noTasks && (
          <div className="py-9 text-center">
            {activeTab === 'done'
              ? <CheckCircle size={32} className="mx-auto mb-2.5 text-green-700/35" />
              : <CircleAlert size={32} className="mx-auto mb-2.5 text-gray-300" />}
            <div className="text-[13px] text-muted-foreground">
              {activeTab === 'open'
                ? 'All tasks picked up or done'
                : activeTab === 'picked_up'
                  ? 'No tasks currently in progress'
                  : 'No completed tasks yet'}
            </div>
          </div>
        )}

        {/* Task cards */}
        <div className="flex flex-col gap-2.5">
          {tabItems.map(task => {
            const isDone = task.status === 'done'
            const isPattern = task.triggerType === 'pattern'

            return (
              <div
                key={task.id}
                className={`rounded-lg border border-white/60 bg-white/75 p-3 shadow-sm backdrop-blur-[10px] transition-all duration-150 hover:-translate-y-px hover:border-white/85 hover:bg-white/90 hover:shadow-md ${isDone ? 'opacity-45' : ''}`}
              >
                {/* Top row: badges + impact stats */}
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {task.priority === 'high' && (
                    <span className="inline-block rounded border border-red-500/15 bg-red-500/[0.08] px-[7px] py-0.5 text-[10px] font-semibold text-red-600">
                      URGENT
                    </span>
                  )}
                  {task.category && <CatBadge cat={task.category} small />}
                  {isPattern && task.refundCount && (
                    <span className="text-[10.5px] tabular-nums text-gray-400">
                      {task.refundCount}&times; &middot; {fmtEur(Number(task.totalAmount ?? 0))} lost
                    </span>
                  )}
                </div>

                {/* Title + description */}
                <div className={`mb-1.5 text-[13px] font-semibold leading-snug ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {task.title}
                </div>
                {task.description && (
                  <div className={`text-xs leading-relaxed text-gray-600 ${task.status !== 'open' ? 'mb-2' : ''}`}>
                    {task.description}
                  </div>
                )}

                {/* Order link row */}
                {task.customerEmail && task.shopifyOrderName && (
                  <button
                    onClick={() => router.push(`/inbox?customer_email=${encodeURIComponent(task.customerEmail!)}`)}
                    className="mt-1.5 mb-2 flex w-full items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-left transition-colors hover:bg-gray-100"
                  >
                    <ExternalLink size={11} className="shrink-0 text-gray-400" />
                    <span className="text-[11.5px] font-medium text-primary">
                      {task.shopifyOrderName}
                    </span>
                    {task.customerName && (
                      <span className="text-[11px] text-gray-400">
                        {task.customerName}
                      </span>
                    )}
                  </button>
                )}

                {/* Bottom row: assignment + action buttons */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  {/* Left: member assignment */}
                  <div className="flex items-center gap-1.5">
                    {task.status === 'open' ? (
                      <div className="relative">
                        <button
                          onClick={() => setAssignDropdown(assignDropdown === task.id ? null : task.id)}
                          className="flex items-center gap-1.5 rounded-md border border-black/[0.06] bg-gray-50 px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-gray-100"
                        >
                          <User size={11} />
                          {task.assignedMemberName || 'Assign'}
                        </button>
                        {assignDropdown === task.id && (
                          <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-black/[0.08] bg-white py-1 shadow-lg">
                            {members.map(m => (
                              <button
                                key={m.id}
                                onClick={() => handleAssign(task, m.id)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-gray-700 hover:bg-gray-50"
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                                  {memberInitials(m.displayName)}
                                </span>
                                {m.displayName}
                              </button>
                            ))}
                            {members.length === 0 && (
                              <div className="px-3 py-1.5 text-[11px] text-gray-400">No members found</div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : task.assignedMemberName ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                          {memberInitials(task.assignedMemberName)}
                        </span>
                        {task.assignedMemberName}
                      </div>
                    ) : null}

                    {/* Done: completion info */}
                    {isDone && (
                      <div className="text-[11px] text-gray-400">
                        {task.resultNote && <span className="text-gray-500">{task.resultNote}</span>}
                      </div>
                    )}
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex items-center gap-[5px]">
                    {task.status === 'open' && (
                      <button
                        onClick={() => handlePickUp(task)}
                        disabled={isSuspended}
                        className="rounded-md border border-black/[0.08] bg-gray-100 px-3.5 py-[5px] text-xs font-medium text-gray-700 transition-all duration-150 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Pick Up
                      </button>
                    )}
                    {task.status === 'picked_up' && (
                      <>
                        <input
                          className="w-[130px] rounded-[7px] border border-black/[0.08] bg-gray-100 px-2.5 py-1 text-[11.5px] text-gray-900 placeholder:text-gray-300 focus:border-black/[0.18] focus:outline-none disabled:opacity-50"
                          placeholder="Result note (optional)"
                          value={noteInps[task.id] || ''}
                          onChange={e => setNoteInps(p => ({ ...p, [task.id]: e.target.value }))}
                          disabled={isSuspended}
                        />
                        <button
                          onClick={() => handleReopen(task)}
                          disabled={isSuspended}
                          className="rounded-full border border-black/[0.08] bg-transparent px-[11px] py-1 text-[11px] font-medium text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Re-open
                        </button>
                        <button
                          onClick={() => handleMarkDone(task)}
                          disabled={isSuspended}
                          className="rounded-full border border-green-700/25 bg-green-50 px-3.5 py-[5px] text-xs font-semibold text-green-700 transition-all duration-150 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Mark Done
                        </button>
                      </>
                    )}
                    {isDone && (
                      <button
                        onClick={() => handleReopen(task)}
                        disabled={isSuspended}
                        className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-transparent px-[11px] py-1 text-[11px] font-medium text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RotateCcw size={10} />
                        Re-open
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </>
  )
}
