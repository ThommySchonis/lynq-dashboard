'use client'

import { useMembers } from '@/hooks/settings/use-settings-data'
import { useAuthStore } from '@/stores/auth'
import {
  type SearchFilters,
  type StatusFilterValue,
  type DatePreset,
  STATUS_OPTIONS,
  DATE_PRESETS,
  UNASSIGNED,
  activeFilterCount,
  emptyFilters,
  presetToRange,
} from './search-filters'
import type { SearchTab } from '@/hooks/use-global-search'
import { cn } from '@/lib/utils'

const FACET_SCOPES: SearchTab[] = ['all', 'conversations', 'messages']

const SCOPES: { value: SearchTab; label: string }[] = [
  { value: 'all',           label: 'All' },
  { value: 'conversations', label: 'Conversations' },
  { value: 'messages',      label: 'Messages' },
  { value: 'contacts',      label: 'Contacts' },
  { value: 'shopify',       label: 'Shopify customers' },
]

function Chip({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-sm rounded-full border whitespace-nowrap transition-colors',
        active
          ? 'border-primary text-primary bg-accent-soft'
          : 'border-border text-foreground-2 hover:border-border-hover',
      )}
    >
      {active ? '✓ ' : ''}{children}
    </button>
  )
}

export function FilterPanel({
  scope,
  onScopeChange,
  staged,
  onChange,
  onApply,
}: {
  scope: SearchTab
  onScopeChange: (s: SearchTab) => void
  staged: SearchFilters
  onChange: (next: SearchFilters) => void
  onApply: () => void
}) {
  const { data: members = [] } = useMembers()
  const myMemberId = useAuthStore((s) => s.memberId)
  const showFacets = FACET_SCOPES.includes(scope)
  const count = activeFilterCount(staged)

  const assigneeOptions: { value: string; label: string }[] = [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...(myMemberId ? [{ value: myMemberId, label: 'Assigned to me' }] : []),
    ...members
      .filter((m) => m.id !== myMemberId)
      .map((m) => ({ value: m.id, label: m.display_name ?? m.email })),
  ]

  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  function toggleStatus(value: StatusFilterValue) {
    onChange({ ...staged, status: toggle(staged.status, value) })
  }
  function toggleAssignee(value: string) {
    onChange({ ...staged, assignee: toggle(staged.assignee, value) })
  }
  function selectPreset(preset: DatePreset) {
    onChange({ ...staged, ...presetToRange(preset) })
  }

  const datePresetActive = (preset: Exclude<DatePreset, 'custom'>): boolean => {
    if (!staged.dateFrom || !staged.dateTo) return false
    const r = presetToRange(preset)
    return r.dateFrom?.slice(0, 10) === staged.dateFrom.slice(0, 10)
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs uppercase tracking-wide text-foreground-3">Filter by</span>
        {count > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-primary font-medium">{count} SELECTED</span>
            <button
              type="button"
              onClick={() => onChange(emptyFilters())}
              className="text-xs text-foreground-3 hover:text-foreground-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="flex">
        <div className="flex flex-col gap-1 p-3 border-r border-border min-w-[160px]">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onScopeChange(s.value)}
              className={cn(
                'text-left px-3 py-1.5 text-sm rounded-md',
                scope === s.value
                  ? 'text-primary bg-accent-soft'
                  : 'text-foreground-2 hover:bg-accent/50',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 space-y-4 max-h-[360px] overflow-y-auto">
          {showFacets ? (
            <>
              <section>
                <p className="text-xs uppercase tracking-wide text-foreground-3 mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((o) => (
                    <Chip key={o.value} active={staged.status.includes(o.value)} onClick={() => toggleStatus(o.value)}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-xs uppercase tracking-wide text-foreground-3 mb-2">Assignee</p>
                <div className="flex flex-wrap gap-2">
                  {assigneeOptions.map((o) => (
                    <Chip key={o.value} active={staged.assignee.includes(o.value)} onClick={() => toggleAssignee(o.value)}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-xs uppercase tracking-wide text-foreground-3 mb-2">Date</p>
                <div className="flex flex-wrap gap-2">
                  {DATE_PRESETS.map((o) => (
                    <Chip key={o.value} active={datePresetActive(o.value)} onClick={() => selectPreset(o.value)}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <p className="text-sm text-foreground-3">
              Status, assignee and date filters don&apos;t apply to this scope.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <span className="text-xs text-foreground-3">↑↓ to navigate · ↵ to select</span>
        <button
          type="button"
          onClick={onApply}
          className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90"
        >
          {count > 0 ? `Apply ${count} filters` : 'Apply'}
        </button>
      </div>
    </div>
  )
}
