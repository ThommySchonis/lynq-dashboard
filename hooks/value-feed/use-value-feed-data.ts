'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fmtDate, timeUntil } from '@/lib/date-utils'
import { googleCalUrl, initialsOf, classifyBroadcast } from '@/lib/value-feed-utils'
import type { FeedItemKind } from '@/lib/value-feed-utils'
import type { Broadcast, Masterclass } from '@/types/admin'

// ─── Types ──────────────────────────────────────────────────────────────────

export type { FeedItemKind }

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
  /** Cover image for the featured card — broadcasts only; null otherwise. */
  imageUrl: string | null
  /** Event details for the modal event card — masterclasses only. */
  event: {
    month: string
    day: string
    datetimeText: string
  } | null
  /** Topic tags shown in the modal footer (from broadcast topic). */
  tags: string[]
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

const fmtMonth = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
const fmtDay = (iso: string) => String(new Date(iso).getDate()).padStart(2, '0')

function fmtEventDate(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  )
}

/** Full event datetime for the modal event card, e.g. "Thursday, May 21, 2026 · 3:00 PM". */
function fmtEventFull(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
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
    imageUrl:   null,
    event: {
      month:        fmtMonth(mc.scheduled_at),
      day:          fmtDay(mc.scheduled_at),
      datetimeText: fmtEventFull(mc.scheduled_at) + (mc.zoom_url ? ' · Online (Zoom)' : ''),
    },
    tags:       [],
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
    imageUrl:   p.image_url ?? null,
    event:      null,
    tags:       p.topic ? p.topic.split(',').map(t => t.trim()).filter(Boolean) : [],
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

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export interface SidebarEvent {
  id: string
  month: string
  day: string
  title: string
  timeText: string
  calUrl: string
  zoomUrl: string | null
}

export interface SidebarVideo {
  id: string
  title: string
  youtubeUrl: string
}

export interface SidebarPopularItem {
  id: string
  title: string
  kindLabel: string
}

export interface ValueFeedSidebarData {
  events: SidebarEvent[]
  videos: SidebarVideo[]
  popular: SidebarPopularItem[]
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/**
 * Sidebar data derived from the same broadcasts/masterclasses queries (shared
 * cache). Popular is top-N by recency — no real read counts exist (see plan).
 */
export function useValueFeedSidebar(): ValueFeedSidebarData {
  const { data: broadcasts = [] } = useBroadcasts()
  const { data: masterclasses = [] } = useUpcomingMasterclasses()

  const events: SidebarEvent[] = masterclasses.slice(0, 3).map(mc => ({
    id:       'm-' + mc.id,
    month:    fmtMonth(mc.scheduled_at),
    day:      fmtDay(mc.scheduled_at),
    title:    mc.title,
    timeText: fmtTime(mc.scheduled_at) + (mc.zoom_url ? ' · Online' : ''),
    calUrl:   googleCalUrl(mc.title, mc.scheduled_at, 60),
    zoomUrl:  mc.zoom_url ?? null,
  }))

  const videos: SidebarVideo[] = broadcasts
    .filter(b => !!b.youtube_url)
    .slice(0, 3)
    .map(b => ({ id: 'b-' + b.id, title: b.title, youtubeUrl: b.youtube_url as string }))

  const popular: SidebarPopularItem[] = [
    ...masterclasses.map(mc => ({
      id:        'm-' + mc.id,
      title:     mc.title,
      kindLabel: 'Masterclass',
      sortKey:   new Date(mc.scheduled_at).getTime(),
    })),
    ...broadcasts.map(b => ({
      id:        'b-' + b.id,
      title:     b.title,
      kindLabel: cap(classifyBroadcast(b as unknown as Record<string, unknown>)),
      sortKey:   new Date(b.created_at).getTime(),
    })),
  ]
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 4)
    .map(({ id, title, kindLabel }) => ({ id, title, kindLabel }))

  return { events, videos, popular }
}
