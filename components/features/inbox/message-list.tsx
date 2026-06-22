'use client'

import type { RefObject } from 'react'
import type { Message } from '@/types/inbox'
import { AvatarFallback, Avatar as ShadAvatar } from '@/components/ui/avatar'
import { extractName, relTime as formatDate } from '@/lib/inbox-utils'
import { useInboxUI } from '@/stores/inbox-ui'
import { useAIStore } from '@/stores/ai'
import { useAuthStore } from '@/stores/auth'
import { useConversation } from '@/hooks/inbox/use-inbox-data'
import { useAutoSentDraftTimes } from '@/hooks/ai'
import { AutoSentBadge } from './auto-sent-badge'
import { useMemo } from 'react'

interface MessageListProps {
  msgEndRef: RefObject<HTMLDivElement | null>
}

export function MessageList({ msgEndRef }: MessageListProps) {
  const selectedThreadId = useInboxUI((s) => s.selectedThreadId)
  const msgTranslations = useAIStore((s) => s.translations)
  const setTranslation = useAIStore((s) => s.setTranslation)
  const translateMessage = useAIStore((s) => s.translateMessage)
  const session = useAuthStore((s) => s.session)
  const token = session?.access_token ?? ''

  const { data: conversationData, isLoading: loadingMsgs } = useConversation(selectedThreadId)
  const messages = useMemo(() => conversationData?.messages || [], [conversationData?.messages])
  const { data: autoSentTimes = [] } = useAutoSentDraftTimes(selectedThreadId)

  const autoSentMsgIds = useMemo(() => {
    if (!autoSentTimes.length) return new Set<string>()
    const ids = new Set<string>()
    for (const msg of messages) {
      if (msg.direction !== 'outbound') continue
      const msgTime = new Date(msg.date || msg.created_at).getTime()
      for (const t of autoSentTimes) {
        if (Math.abs(msgTime - new Date(t).getTime()) < 120_000) {
          ids.add(msg.id)
          break
        }
      }
    }
    return ids
  }, [messages, autoSentTimes])

  return (
    <>
      {loadingMsgs &&
        [0, 1].map((i) => (
          <div
            key={i}
            className={`flex gap-3 ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'} mb-5`}
            style={{ animation: `fadeUp .3s ease ${i * 0.1}s both` }}
          >
            <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md w-[34px] h-[34px] rounded-full shrink-0" />
            <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-20 w-[60%] rounded-[18px]" />
          </div>
        ))}
      {messages.map((msg: Message & { isNote?: boolean; snippet?: string }, idx: number) => {
        const isAgent = msg.from?.toLowerCase().includes(session?.user?.email?.split('@')[0]?.toLowerCase() || '')
        const isNote = msg.isNote
        const name = extractName(msg.from)
        const ini = (name || '?')
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
        return (
          <div
            key={msg.id || idx}
            className="mb-5 flex gap-3"
            style={{ animation: 'msgIn .3s cubic-bezier(.16,1,.3,1) both' }}
          >
            {!isNote && (
              <ShadAvatar className="shrink-0" style={{ width: 26, height: 26 }}>
                <AvatarFallback className={isAgent ? 'bg-primary text-primary-foreground' : 'bg-[#F0F0F0] text-foreground-2'} style={{ fontSize: 26 * 0.34 }}>
                  {ini}
                </AvatarFallback>
              </ShadAvatar>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs mb-[5px] flex items-center gap-1.5">
                <span className="text-[10.5px] text-foreground-2 font-bold tracking-[.01em]">{name}</span>
                <span className="text-[10px] text-muted-foreground font-normal">{formatDate(msg.date)}</span>
                {autoSentMsgIds.has(msg.id) && <AutoSentBadge />}
              </div>
              <div className={isNote ? 'bg-[#FFFBEB] border border-[#FDE68A] border-l-[3px] border-l-[#F59E0B] rounded-[2px_14px_14px_14px] px-[18px] py-[14px] text-[13.5px] leading-[1.75] text-[#0F172A] whitespace-pre-wrap break-words dark:bg-[rgba(251,191,36,0.08)] dark:border-[rgba(251,191,36,0.2)] dark:border-l-[rgba(251,191,36,0.5)] dark:text-(--foreground)' : isAgent ? 'bg-(--secondary) border border-[rgba(0,0,0,0.06)] rounded-[4px_14px_14px_14px] px-4 py-3 text-sm leading-[1.6] text-(--foreground) whitespace-pre-wrap break-words dark:bg-[rgba(255,255,255,0.06)] dark:border-[rgba(255,255,255,0.1)] dark:shadow-none dark:backdrop-blur-[12px]' : 'bg-(--card) border border-(--border) rounded-[4px_14px_14px_14px] px-4 py-3 text-sm leading-[1.6] text-(--foreground) whitespace-pre-wrap break-words dark:bg-[rgba(255,255,255,0.06)] dark:border-[rgba(255,255,255,0.1)] dark:shadow-none dark:backdrop-blur-[12px]'}>
                {isNote && (
                  <div className="text-[10px] font-bold text-[rgba(251,191,36,0.75)] tracking-[.07em] uppercase mb-[7px]">Internal note</div>
                )}
                {(() => {
                  const content =
                    msgTranslations[msg.id] && msgTranslations[msg.id] !== '__loading__' ? msgTranslations[msg.id] : msg.body || msg.snippet || ''
                  const isHtml = /<[a-z][\s\S]*>/i.test(content)
                  if (!isHtml) return <span>{content}</span>
                  return (
                    <iframe
                      sandbox="allow-same-origin"
                      srcDoc={
                        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:8px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;font-size:14px;color:#1a1a1a;word-wrap:break-word;overflow-wrap:break-word}img{max-width:100%;height:auto}a{color:#6d28d9}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#666}pre{white-space:pre-wrap;overflow-x:auto}</style></head><body>' +
                        content +
                        '</body></html>'
                      }
                      className="w-full border-none min-h-[60px] rounded-[6px] bg-white"
                      title="Email content"
                      onLoad={(e) => {
                        try {
                          const iframe = e.target as HTMLIFrameElement
                          const h = iframe.contentDocument!.body.scrollHeight
                          iframe.style.height = h + 16 + 'px'
                        } catch {}
                      }}
                    />
                  )
                })()}
              </div>
              {!isAgent && !isNote && (
                <div className="text-left mt-1">
                  {msgTranslations[msg.id] === '__loading__' ? (
                    <span className="text-[10px] text-muted-foreground">Translating…</span>
                  ) : msgTranslations[msg.id] ? (
                    <button
                      className="text-[10px] font-semibold text-muted-foreground bg-transparent cursor-pointer px-[7px] py-[2px] rounded-[5px] transition-all hover:text-foreground hover:bg-secondary"
                      onClick={() => setTranslation(msg.id, undefined)}
                    >
                      Show original
                    </button>
                  ) : (
                    <button
                      className="text-[10px] font-semibold text-muted-foreground bg-transparent cursor-pointer px-[7px] py-[2px] rounded-[5px] transition-all hover:text-foreground hover:bg-secondary"
                      onClick={() => void translateMessage(msg.id, msg.body || msg.snippet || '', token)}
                    >
                      Translate
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
      <div ref={msgEndRef} />
    </>
  )
}
