'use client'

import { useEffect } from 'react'
import { X, Send, ExternalLink } from 'lucide-react'
import { initialsFor } from '@/lib/feedback-utils'
import { TYPE_META } from '@/lib/feedback-constants'
import type { FeedbackType } from '@/lib/feedback-constants'
import type { FeedbackSubmission } from '@/hooks/lynq-admin'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-[#F0EDF4]">
      <div className="text-[11px] font-semibold tracking-[.08em] uppercase text-foreground-4 mb-2.5">
        {title}
      </div>
      {children}
    </div>
  )
}

interface FeedbackDetailPanelProps {
  row: FeedbackSubmission
  onClose: () => void
}

export function FeedbackDetailPanel({ row, onClose }: FeedbackDetailPanelProps) {
  const meta = TYPE_META[row.type as FeedbackType] ?? TYPE_META.other
  const { Icon } = meta
  const replyHref = row.user?.email
    ? `mailto:${row.user.email}?subject=${encodeURIComponent('Re: Your Lynq & Flow feedback')}`
    : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[rgba(28,15,54,0.25)] z-[60]"
      />

      {/* Panel */}
      <aside
        className="fixed top-0 right-0 bottom-0 w-[480px] max-w-full z-[61] bg-white shadow-[-8px_0_24px_rgba(28,15,54,0.12)] flex flex-col"
        style={{ animation: 'fbPanel .2s cubic-bezier(.16,1,.3,1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EDF4]">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[12px] font-medium uppercase tracking-[.04em] ${meta.badgeBg} ${meta.badgeText}`}>
              <Icon size={12} strokeWidth={1.75} />
              {meta.label}
            </span>
            <span className="text-[13px] text-foreground-4">
              {new Date(row.created_at).toLocaleString()}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="bg-transparent border-none cursor-pointer p-1 text-foreground-4 flex items-center"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6">
          <Section title="Message">
            <div className="bg-secondary rounded-lg p-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {row.message}
            </div>
          </Section>

          <Section title="From">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[13px] font-semibold shrink-0">
                {initialsFor(row.user)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {row.user?.name ?? row.user?.email?.split('@')[0] ?? 'Unknown user'}
                </div>
                <div className="text-[13px] text-muted-foreground">{row.user?.email ?? '—'}</div>
                <div className="text-[12px] text-foreground-4 mt-0.5">
                  Workspace: {row.workspace?.name ?? '—'}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Context">
            <div className="flex flex-col gap-2">
              <div>
                <div className="text-[11px] font-semibold tracking-[.08em] uppercase text-foreground-4 mb-1">Page</div>
                {row.page_url ? (
                  <a
                    href={row.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-primary font-mono inline-flex items-center gap-1 break-all"
                  >
                    {row.page_url}
                    <ExternalLink size={12} strokeWidth={1.75} />
                  </a>
                ) : (
                  <span className="text-[13px] text-foreground-4">—</span>
                )}
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-[.08em] uppercase text-foreground-4 mb-1">User agent</div>
                <div className="text-[12px] text-foreground-4 font-mono break-all">
                  {row.user_agent ?? '—'}
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#F0EDF4]">
          <a
            href={replyHref ?? '#'}
            onClick={(e) => { if (!replyHref) e.preventDefault() }}
            className={[
              'inline-flex items-center gap-1.5 h-9 px-3.5',
              'bg-white border border-[#1C0F36] text-foreground rounded-lg',
              'text-[13px] font-medium no-underline',
              replyHref ? 'opacity-100 cursor-pointer' : 'opacity-50 cursor-not-allowed',
            ].join(' ')}
          >
            <Send size={14} strokeWidth={1.75} />
            Reply via email
          </a>
        </div>
      </aside>
    </>
  )
}
