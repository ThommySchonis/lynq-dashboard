'use client'

import Image from 'next/image'
import { Pin, Trash2 } from 'lucide-react'
import { BROADCAST_TYPES } from '@/lib/admin-constants'
import { getYoutubeId } from '@/lib/admin-utils'
import { Button } from '@/components/ui/button'
import type { Broadcast, BroadcastReaction } from '@/types/admin'

interface BroadcastRowProps {
  broadcast: Broadcast
  reactions: BroadcastReaction[]
  onDelete: () => void
  onTogglePin: () => void
}

export function BroadcastRow({ broadcast, reactions, onDelete, onTogglePin }: BroadcastRowProps) {
  const cfg = BROADCAST_TYPES[broadcast.type] ?? BROADCAST_TYPES.update
  const Icon = cfg.icon
  const ytId = broadcast.type === 'video' ? getYoutubeId(broadcast.youtube_url) : null

  const thumbsUp = reactions.filter(
    (r) => r.broadcast_id === broadcast.id && r.emoji === 'thumbs_up'
  ).length
  const fire = reactions.filter(
    (r) => r.broadcast_id === broadcast.id && r.emoji === 'fire'
  ).length

  return (
    <div className="flex gap-3 items-start px-4 py-3 border-b border-border/50">
      {ytId ? (
        <div className="w-[60px] h-[38px] rounded-md overflow-hidden shrink-0 bg-muted relative">
          <Image
            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
            alt=""
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div
          className={`w-[30px] h-[30px] rounded-[7px] ${cfg.bgClass} border ${cfg.borderClass} flex items-center justify-center ${cfg.colorClass} shrink-0 mt-0.5`}
        >
          <Icon size={14} strokeWidth={1.75} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.colorClass}`}>
            {cfg.label}
          </span>
          {broadcast.is_pinned && (
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-500/8 border border-amber-500/20 rounded px-1.5 py-px">
              Pinned
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(broadcast.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        <div className="text-[13px] font-medium text-foreground leading-tight mb-px truncate">
          {broadcast.title}
        </div>

        {broadcast.body && (
          <div className="text-[11.5px] text-muted-foreground truncate">
            {broadcast.body}
          </div>
        )}

        {(thumbsUp > 0 || fire > 0) && (
          <div className="flex gap-2 mt-1">
            {thumbsUp > 0 && (
              <span className="text-[11px] font-semibold text-blue-600">
                {'👍'} {thumbsUp}
              </span>
            )}
            {fire > 0 && (
              <span className="text-[11px] font-semibold text-orange-600">
                {'🔥'} {fire}
              </span>
            )}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onTogglePin}
        title={broadcast.is_pinned ? 'Unpin' : 'Pin'}
      >
        <Pin
          size={12}
          className={broadcast.is_pinned ? 'text-amber-600 fill-amber-600' : 'text-muted-foreground'}
        />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 hover:text-red-500"
        onClick={onDelete}
      >
        <Trash2 size={13} className="text-muted-foreground" />
      </Button>
    </div>
  )
}
