'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fmtDate, timeUntil } from '@/lib/date-utils'
import { googleCalUrl, initialsOf, classifyBroadcast } from '@/lib/value-feed-utils'
import type { Broadcast, Masterclass } from '@/types/admin'

// ─── Types ──────────────────────────────────────────────────────────────────

export type FeedItemKind = 'tip' | 'masterclass' | 'update'

export interface NormalizedFeedItem {
  id: string
  kind: FeedItemKind
  title: string
  dateText: string
  body: string | null
  author: {
    initials: string
    name: string
    scheduledText?: string
  } | null
  /** undefined = no CTA section; null = "Zoom link coming soon" */
  zoomUrl: string | null | undefined
  calUrl: string | null
  youtubeUrl: string | null
  sortKey: number
  isPinned: boolean
}

// ─── Query keys ─────────────────────────────────────────────────────────────

export const valueFeedKeys = {
  all: ['value-feed'] as const,
  broadcasts: () => [...valueFeedKeys.all, 'broadcasts'] as const,
  masterclasses: () => [...valueFeedKeys.all, 'masterclasses'] as const,
}

// ─── Individual queries ──────────────────────────────────────────────────────

function useBroadcasts() {
  return useQuery<Broadcast[]>({
    queryKey: valueFeedKeys.broadcasts(),
    queryFn: async () => {
      const { data } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
      return (data as Broadcast[]) ?? []
    },
    staleTime: 5 * 60_000,
  })
}

function useUpcomingMasterclasses() {
  return useQuery<Masterclass[]>({
    queryKey: valueFeedKeys.masterclasses(),
    queryFn: async () => {
      const { data } = await supabase
        .from('masterclasses')
        .select('*')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
      return (data as Masterclass[]) ?? []
    },
    staleTime: 5 * 60_000,
  })
}

// ─── Format helpers (local — not exported from date-utils) ───────────────────

function fmtEventDate(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  )
}

// ─── Composed hook ───────────────────────────────────────────────────────────

export interface UseValueFeedResult {
  items: NormalizedFeedItem[]
  isLoading: boolean
  isError: boolean
}

export function useValueFeedData(): UseValueFeedResult {
  const { data: broadcasts = [], isLoading: loadingB, isError: errorB } = useBroadcasts()
  const { data: masterclasses = [], isLoading: loadingM, isError: errorM } = useUpcomingMasterclasses()

  const isLoading = loadingB || loadingM
  const isError = errorB || errorM

  // Normalize masterclasses
  const mcItems: NormalizedFeedItem[] = masterclasses.map(mc => ({
    id:         'm-' + mc.id,
    kind:       'masterclass' as FeedItemKind,
    title:      mc.title,
    dateText:   timeUntil(mc.scheduled_at) ?? fmtDate(mc.scheduled_at),
    body:       mc.description ?? null,
    author: {
      initials:      initialsOf(mc.speaker ?? '') || 'L',
      name:          mc.speaker ?? 'Lynq & Flow',
      scheduledText: fmtEventDate(mc.scheduled_at),
    },
    zoomUrl:    mc.zoom_url ?? null,
    calUrl:     googleCalUrl(mc.title, mc.scheduled_at, 60),
    youtubeUrl: null,
    sortKey:    new Date(mc.scheduled_at).getTime(),
    isPinned:   false,
  }))

  // Normalize broadcasts
  const bItems: NormalizedFeedItem[] = broadcasts.map(p => ({
    id:         'b-' + p.id,
    kind:       classifyBroadcast(p as unknown as Record<string, unknown>),
    title:      p.title,
    dateText:   fmtDate(p.created_at),
    body:       p.body ?? null,
    author:     null,
    zoomUrl:    undefined,
    calUrl:     null,
    youtubeUrl: p.youtube_url ?? null,
    sortKey:    new Date(p.created_at).getTime(),
    isPinned:   !!p.is_pinned,
  }))

  // Sort: masterclasses first (chronological), then pinned posts, then recent posts
  const items = [...mcItems, ...bItems].sort((a, b) => {
    if (a.kind === 'masterclass' && b.kind !== 'masterclass') return -1
    if (b.kind === 'masterclass' && a.kind !== 'masterclass') return 1
    if (a.kind === 'masterclass' && b.kind === 'masterclass') return a.sortKey - b.sortKey
    if (a.isPinned && !b.isPinned) return -1
    if (b.isPinned && !a.isPinned) return 1
    return b.sortKey - a.sortKey
  })

  return { items, isLoading, isError }
}
