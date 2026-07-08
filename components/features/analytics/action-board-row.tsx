'use client'

import { useState } from 'react'
import { ExternalLink, RotateCcw, User } from 'lucide-react'
import { CatBadge } from './cat-badge'
import type { Task } from '@/types/tasks'

interface Member {
  id: string
  displayName: string
}

interface ActionBoardRowProps {
  task: Task
  members: Member[]
  isSuspended: boolean
  onPickUp: (task: Task) => void
  onReopen: (task: Task) => void
  onMarkDone: (task: Task, note: string) => void
  onAssign: (task: Task, memberId: string) => void
  onOpenOrder: (email: string) => void
}

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ActionBoardRow({
  task,
  members,
  isSuspended,
  onPickUp,
  onReopen,
  onMarkDone,
  onAssign,
  onOpenOrder,
}: ActionBoardRowProps) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [note, setNote] = useState('')
  const isDone = task.status === 'done'

  return (
    <tr className="border-b border-black/[0.05] align-top last:border-0 hover:bg-gray-50/60">
      {/* Name */}
      <td className="w-[180px] py-3 pr-3 pl-4">
        <div className={`text-[13px] font-semibold leading-snug ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {task.title}
        </div>
        {isDone && task.resultNote ? (
          <div className="mt-1 text-[11px] text-gray-400">{task.resultNote}</div>
        ) : null}
      </td>

      {/* Details */}
      <td className="min-w-[220px] max-w-[320px] px-3 py-3">
        <div className="line-clamp-2 text-[12px] leading-relaxed text-gray-600">
          {task.description || '—'}
        </div>
      </td>

      {/* Order */}
      <td className="w-[130px] px-3 py-3">
        {task.shopifyOrderName && task.customerEmail ? (
          <button
            onClick={() => onOpenOrder(task.customerEmail!)}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1 text-[11.5px] font-medium text-primary transition-colors hover:bg-gray-100"
          >
            <ExternalLink size={11} className="shrink-0 text-gray-400" />
            {task.shopifyOrderName}
          </button>
        ) : (
          <span className="text-[12px] text-gray-300">&mdash;</span>
        )}
      </td>

      {/* Assign */}
      <td className="w-[170px] px-3 py-3">
        {task.status === 'open' ? (
          <div className="relative">
            <button
              onClick={() => setAssignOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-md border border-black/[0.06] bg-gray-50 px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-gray-100"
            >
              <User size={11} />
              {task.assignedMemberName || 'Assign'}
            </button>
            {assignOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-black/[0.08] bg-white py-1 shadow-lg">
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { onAssign(task, m.id); setAssignOpen(false) }}
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
        ) : (
          <span className="text-[12px] text-gray-300">&mdash;</span>
        )}
      </td>

      {/* Tags (derived from priority + category) */}
      <td className="w-[180px] px-3 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {task.priority === 'high' && (
            <span className="inline-block rounded-md border border-red-500/15 bg-red-500/[0.08] px-[7px] py-0.5 text-[10px] font-semibold text-red-600">
              URGENT
            </span>
          )}
          {task.category && <CatBadge cat={task.category} small />}
          {task.priority !== 'high' && !task.category && (
            <span className="text-[12px] text-gray-300">&mdash;</span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="py-3 pl-3 pr-4">
        <div className="flex items-center justify-start gap-1.5">
          {task.status === 'open' && (
            <button
              onClick={() => onPickUp(task)}
              disabled={isSuspended}
              className="rounded-md border border-black/[0.08] bg-gray-100 px-3.5 py-[5px] text-xs font-medium text-gray-700 transition-all duration-150 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Pick Up
            </button>
          )}
          {task.status === 'picked_up' && (
            <>
              <input
                className="w-[140px] rounded-[7px] border border-black/[0.08] bg-gray-100 px-2.5 py-1 text-[11.5px] text-gray-900 placeholder:text-gray-300 focus:border-black/[0.18] focus:outline-none disabled:opacity-50"
                placeholder="Result note (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                disabled={isSuspended}
              />
              <button
                onClick={() => onReopen(task)}
                disabled={isSuspended}
                className="rounded-full border border-black/[0.08] bg-transparent px-[11px] py-1 text-[11px] font-medium text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Re-Open
              </button>
              <button
                onClick={() => onMarkDone(task, note)}
                disabled={isSuspended}
                className="rounded-full border border-green-700/25 bg-green-50 px-3.5 py-[5px] text-xs font-semibold text-green-700 transition-all duration-150 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark Done
              </button>
            </>
          )}
          {isDone && (
            <button
              onClick={() => onReopen(task)}
              disabled={isSuspended}
              className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-transparent px-[11px] py-1 text-[11px] font-medium text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw size={10} />
              Re-Open
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
