'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { getInitials, relTime, sanitizeHtml } from '@/lib/inbox-utils'
import type { Message } from '@/types'
import { Loader2 } from 'lucide-react'

interface MessageBubbleProps {
  message: Message
  translation?: string
  onTranslate: (msgId: string, text: string) => void
}

export function MessageBubble({ message, translation, onTranslate }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound'
  const isNote = false // Notes are handled separately via Note type; Message direction only has inbound/outbound

  const senderName = message.from_name || message.from_email || message.from || 'Unknown'
  const senderEmail = message.from_email || message.from || ''
  const showEmail = senderEmail && senderEmail !== senderName
  const initials = getInitials(senderName)
  const timestamp = relTime(message.sent_at || message.date || message.created_at)

  // Determine which body to render
  const rawBody = message.body_html || message.body || ''
  const sanitized = sanitizeHtml(rawBody)

  const isLoading = translation === '__loading__'
  const hasTranslation = !!translation && !isLoading

  return (
    <div
      className={[
        'flex gap-3',
        isOutbound ? 'flex-row-reverse items-end' : 'flex-row items-start',
      ].join(' ')}
    >
      {/* Avatar */}
      <Avatar size="sm" className="shrink-0">
        <AvatarFallback
          className={
            isOutbound
              ? 'bg-primary/15 text-primary text-[10px] font-semibold'
              : 'bg-muted text-muted-foreground text-[10px] font-semibold'
          }
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Bubble + meta */}
      <div className={['flex flex-col gap-1 max-w-[72%]', isOutbound ? 'items-end' : 'items-start'].join(' ')}>
        {/* Sender + time */}
        <div
          className={[
            'flex items-center gap-1.5 text-xs text-muted-foreground',
            isOutbound ? 'flex-row-reverse' : 'flex-row',
          ].join(' ')}
        >
          <span className="font-medium text-foreground/80">{senderName}</span>
          {showEmail && <span className="text-muted-foreground/60">{senderEmail}</span>}
          <span>{timestamp}</span>
        </div>

        {/* Message body */}
        <div
          className={[
            'rounded-xl px-4 py-3 text-sm leading-relaxed break-words word-break shadow-sm',
            isOutbound
              ? 'rounded-tr-sm bg-primary/10 border border-primary/15 text-foreground'
              : 'rounded-tl-sm bg-card border border-border text-foreground shadow-sm',
          ].join(' ')}
        >
          <div
            className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_img]:rounded [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
        </div>

        {/* Translation area — only for inbound messages */}
        {!isOutbound && (
          <div className="flex flex-col gap-1">
            {isLoading ? (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Translating…
              </span>
            ) : hasTranslation ? (
              <>
                <div className="rounded-xl rounded-tl-sm bg-muted/60 border border-border px-4 py-3 text-sm leading-relaxed text-foreground/90 italic">
                  {translation}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground self-start"
                  onClick={() => onTranslate(message.id, '')}
                >
                  Show original
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground self-start"
                onClick={() => onTranslate(message.id, message.body || '')}
              >
                Translate
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface NoteBubbleProps {
  body: string
  authorName?: string
  createdAt?: string
}

/**
 * Internal note variant — centered, muted, italic.
 * Separate from MessageBubble because Note objects have a different shape.
 */
export function NoteBubble({ body, authorName, createdAt }: NoteBubbleProps) {
  const timestamp = relTime(createdAt)

  return (
    <div className="flex flex-col items-center gap-1 px-6">
      <div className="w-full max-w-xl rounded-xl border border-amber-200/40 bg-amber-50/10 px-4 py-3 dark:border-amber-400/20 dark:bg-amber-400/5">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
          Internal note
        </p>
        <p className="text-sm italic leading-relaxed text-foreground/80">{body}</p>
      </div>
      {(authorName || timestamp) && (
        <p className="text-[11px] text-muted-foreground">
          {authorName && <span className="font-medium">{authorName}</span>}
          {authorName && timestamp && ' · '}
          {timestamp}
        </p>
      )}
    </div>
  )
}
