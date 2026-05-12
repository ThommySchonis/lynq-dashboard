'use client'

import { Phone, MapPin } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

// ── Props ────────────────────────────────────────────────────────────────────

interface CustomerCardProps {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string | null
  city?: string
  country?: string
  tags?: string
  note?: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(first?: string, last?: string): string {
  const f = (first?.[0] ?? '').toUpperCase()
  const l = (last?.[0] ?? '').toUpperCase()
  return (f + l) || '?'
}

function fullName(first?: string, last?: string): string {
  return [first, last].filter(Boolean).join(' ') || 'Unknown customer'
}

// ── Component ────────────────────────────────────────────────────────────────

export function CustomerCard({
  firstName,
  lastName,
  email,
  phone,
  city,
  country,
  tags,
  note,
}: CustomerCardProps) {
  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="size-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {getInitials(firstName, lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">
            {fullName(firstName, lastName)}
          </p>
          {email && (
            <a
              href={`mailto:${email}`}
              className="text-xs text-primary hover:underline truncate block"
            >
              {email}
            </a>
          )}
        </div>
      </div>

      {/* Contact details */}
      <div className="space-y-1">
        {phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone size={11} className="shrink-0" />
            <span>{phone}</span>
          </div>
        )}
        {(city || country) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin size={11} className="shrink-0" />
            <span>{[city, country].filter(Boolean).join(', ')}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags && tags.trim() && (
        <div className="flex flex-wrap gap-1">
          {tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean)
            .map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {tag}
              </Badge>
            ))}
        </div>
      )}

      {/* Customer note */}
      {note && (
        <div className="rounded-lg border border-border bg-muted/20 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
            Note
          </p>
          <p className="text-xs italic text-muted-foreground leading-relaxed">
            {note}
          </p>
        </div>
      )}
    </div>
  )
}
