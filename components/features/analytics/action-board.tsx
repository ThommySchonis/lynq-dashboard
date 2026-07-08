'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, ListChecks, Loader2, Plus, Zap } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useTasksQuery, useUpdateTask, useWorkspaceMembers } from '@/hooks/tasks'
import { CreateTaskModal } from '@/components/shared/modals/create-task-modal'
import { useAuthStore } from '@/stores/auth'
import type { Task } from '@/types/tasks'
import { ActionBoardRow } from './action-board-row'
import { CardEmptyState } from './card-empty-state'
import { TablePagination } from '@/components/shared/table-pagination'

const PAGE_SIZE = 10
const TABS = ['open', 'picked_up', 'done'] as const
type TabId = (typeof TABS)[number]
const TAB_LABELS: Record<TabId, string> = { open: 'Open', picked_up: 'Picked Up', done: 'Done' }
const COLUMNS = ['Name', 'Details', 'Order', 'Assign', 'Tags', 'Actions'] as const

interface ActionBoardProps {
  demoMode: boolean
}

export function ActionBoard({ demoMode }: ActionBoardProps) {
  const router = useRouter()
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const [activeTab, setActiveTab] = useState<TabId>('open')
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const tasksQuery = useTasksQuery()
  const updateTask = useUpdateTask()
  const membersQuery = useWorkspaceMembers()

  const tasks: Task[] = tasksQuery.data ?? []
  const members = membersQuery.data ?? []

  const counts: Record<TabId, number> = {
    open: tasks.filter(t => t.status === 'open').length,
    picked_up: tasks.filter(t => t.status === 'picked_up').length,
    done: tasks.filter(t => t.status === 'done').length,
  }
  const tabItems = tasks.filter(t => t.status === activeTab)
  const pageItems = tabItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function selectTab(tab: TabId) {
    setActiveTab(tab)
    setPage(1)
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (!demoMode && tasksQuery.isPending) {
    return (
      <div className="mb-6 rounded-2xl border border-black/[0.06] bg-white p-[30px_40px] shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
          <div className="text-sm font-bold text-foreground-2">Loading tasks…</div>
        </div>
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      </div>
    )
  }

  // ── Demo mode placeholder ─────────────────────────────────────────────────
  if (demoMode) {
    return (
      <div className="mb-6 animate-fade-up rounded-2xl border border-black/[0.06] bg-white p-[30px_40px] shadow-sm">
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

  // ── Mutation handlers ─────────────────────────────────────────────────────
  function handlePickUp(task: Task) {
    updateTask.mutate({ id: task.id, status: 'picked_up' })
  }
  function handleReopen(task: Task) {
    updateTask.mutate({ id: task.id, status: 'open', assignedTo: null })
  }
  function handleMarkDone(task: Task, note: string) {
    updateTask.mutate({ id: task.id, status: 'done', resultNote: note || undefined })
  }
  function handleAssign(task: Task, memberId: string) {
    updateTask.mutate({ id: task.id, assignedTo: memberId })
  }
  function handleOpenOrder(email: string) {
    router.push(`/inbox?customer_email=${encodeURIComponent(email)}`)
  }

  const noTasks = tasks.length === 0

  return (
    <>
      <div className="mb-6 animate-fade-up rounded-2xl border border-black/[0.06] bg-white p-[30px_40px] shadow-sm transition-shadow duration-200 hover:shadow-md">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-orange-500" />
            <span className="text-[15px] font-bold text-foreground">Action Board</span>
            <span className="text-[12px] text-muted-foreground">
              Tasks based on your refund data — assign to your team
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="text-[12px] text-muted-foreground">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={isSuspended}
              className="flex items-center gap-1.5 rounded-[10px] border border-gray-900 px-4 py-2 text-[13px] font-semibold text-gray-900 transition-colors hover:bg-gray-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={14} />
              New Task
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-black/[0.07]">
          {/* Toolbar: tabs */}
          <div className="flex items-center gap-1 px-4 py-3">
            {TABS.map(tab => {
              const isAct = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => selectTab(tab)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    isAct ? 'bg-secondary text-foreground' : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {TAB_LABELS[tab]}
                  {counts[tab] > 0 && <span className="ml-1.5 opacity-65">({counts[tab]})</span>}
                </button>
              )
            })}
          </div>

          {noTasks ? (
            <div className="border-t border-black/[0.07]">
              <CardEmptyState icon={ListChecks} title="No action items yet" size="lg" />
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-black/[0.07]">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.07] bg-gray-50">
                    {COLUMNS.map((c, i) => (
                      <th
                        key={c}
                        className={`whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.06em] text-gray-400 ${i === 0 ? 'pl-4' : ''}`}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(task => (
                    <ActionBoardRow
                      key={task.id}
                      task={task}
                      members={members}
                      isSuspended={isSuspended}
                      onPickUp={handlePickUp}
                      onReopen={handleReopen}
                      onMarkDone={handleMarkDone}
                      onAssign={handleAssign}
                      onOpenOrder={handleOpenOrder}
                    />
                  ))}
                </tbody>
              </table>

              {tabItems.length === 0 && (
                <div className="py-9 text-center text-[13px] text-muted-foreground">
                  {activeTab === 'open'
                    ? 'All tasks picked up or done'
                    : activeTab === 'picked_up'
                      ? 'No tasks currently in progress'
                      : 'No completed tasks yet'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!noTasks && tabItems.length > 0 && (
          <TablePagination page={page} pageSize={PAGE_SIZE} total={tabItems.length} onPageChange={setPage} />
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && <CreateTaskModal onClose={() => setShowCreateModal(false)} />}
    </>
  )
}
