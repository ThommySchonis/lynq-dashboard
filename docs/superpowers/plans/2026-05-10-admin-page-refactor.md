# Admin Page Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the 3,417-line monolithic `app/admin/page.js` into modular TypeScript components with TanStack React Query, Zustand, Tailwind, and Next.js sub-routes — mirroring the inbox refactoring patterns.

**Architecture:** Shared admin layout with auth guard and sidebar wraps 10 sub-route pages. Each page composes small feature components from `components/features/admin/`. Server data flows through TanStack hooks (`hooks/admin/`), UI state through a minimal Zustand store, and all styling uses Tailwind + shadcn components.

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript, TanStack React Query, Zustand, Tailwind CSS, shadcn/base-ui, Lucide icons, Supabase client SDK, sonner (toasts).

**Spec:** `docs/superpowers/specs/2026-05-10-admin-page-refactor-design.md`

---

## Task 1: Types

**Files:**
- Create: `types/admin.ts`

- [ ] **Step 1: Create types file**

```typescript
// types/admin.ts

export interface Client {
  id: string
  company_name: string
  email: string
  shopify_domain: string | null
  shopify_api_key: string | null
  parcel_panel_api_key: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export interface Broadcast {
  id: string
  title: string
  body: string | null
  type: BroadcastType
  youtube_url: string | null
  topic: string | null
  is_pinned: boolean
  created_at: string
}

export type BroadcastType = 'update' | 'tip' | 'video' | 'industry'

export interface Notification {
  id: string
  title: string
  body: string
  type: NotificationType
  created_at: string
}

export type NotificationType = 'info' | 'warning' | 'alert'

export interface Inquiry {
  id: string
  service: string
  client_email: string | null
  phone_number: string | null
  message: string | null
  status: 'new' | 'read'
  created_at: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'developer' | 'manager'
  created_at: string
}

export interface Masterclass {
  id: string
  title: string
  speaker: string | null
  description: string | null
  scheduled_at: string
  zoom_url: string | null
}

export interface BroadcastReaction {
  broadcast_id: string
  emoji: string
}

export interface FinanceData {
  finance: {
    mrr: number
    totalCostMonth: number
    fixedCosts: number
    netMargin: number
    marginPct: number
    activeClients: number
    aiCostMonth: number
  }
  ai: {
    today: { cost: number; calls: number }
    week: { cost: number; calls: number; input_tokens: number; output_tokens: number }
    month: { cost: number; calls: number; input_tokens: number; output_tokens: number }
    lastMonth: { cost: number }
    daily: Array<{ date: string; cost: number; calls: number }>
    byRoute: Record<string, { cost: number; calls: number; input_tokens: number; output_tokens: number }>
  }
  subscriptions: Array<{ name: string; cost: number; note: string | null }>
}

export interface TimeSession {
  id: string
  member_name: string
  member_email: string
  clocked_in_at: string
  clocked_out_at: string | null
  active_seconds: number
  paused_seconds: number
  eod_report: string | null
}

export interface TimeMember {
  name: string
  email: string
  worked_seconds: number
  paused_seconds: number
  sessions_count: number
  is_active: boolean
  is_paused: boolean
}

export interface TimeData {
  sessions: TimeSession[]
  members: TimeMember[]
  active_count: number
  paused_count: number
}

export interface CreateClientForm {
  company_name: string
  email: string
  password: string
  shopify_domain: string
  shopify_api_key: string
  parcel_panel_api_key: string
}

export interface BroadcastForm {
  title: string
  body: string
  type: BroadcastType
  youtube_url: string
  topic: string
}

export interface NotificationForm {
  title: string
  body: string
  type: NotificationType
}

export interface TeamMemberForm {
  name: string
  email: string
  password: string
  role: 'developer' | 'manager'
}

export interface MasterclassForm {
  title: string
  speaker: string
  description: string
  scheduled_at: string
  zoom_url: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `types/admin.ts`

---

## Task 2: Constants

**Files:**
- Create: `lib/admin-constants.ts`
- Create: `lib/admin-utils.ts`

- [ ] **Step 1: Create constants file**

```typescript
// lib/admin-constants.ts
import type { ComponentType } from 'react'
import type {
  BroadcastForm,
  BroadcastType,
  CreateClientForm,
  MasterclassForm,
  NotificationForm,
  NotificationType,
  TeamMemberForm,
} from '@/types/admin'
import {
  LayoutDashboard, Users, UserPlus, Radio, Bell, MessageSquare,
  UserCheck, Clock, BarChart2, Calendar, Inbox,
  TrendingUp, Info, Play, Building2,
} from 'lucide-react'

// ── Auth ──
export const ADMIN_EMAILS = ['info@lynqagency.com', 'denver9523@gmail.com']

// ── Sidebar navigation ──
export interface NavItem {
  id: string
  label: string
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  href: string
  badge?: 'clientCount' | 'newInquiries'
}

export interface NavGroup {
  group: string
  items: NavItem[]
}

export const ADMIN_NAV: NavGroup[] = [
  { group: 'OVERVIEW', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' },
  ]},
  { group: 'CLIENTS', items: [
    { id: 'clients', label: 'Clients', icon: Users, href: '/admin/clients', badge: 'clientCount' },
    { id: 'create-client', label: 'Create Client', icon: UserPlus, href: '/admin/create-client' },
  ]},
  { group: 'COMMUNICATION', items: [
    { id: 'broadcasts', label: 'Broadcasts', icon: Radio, href: '/admin/broadcasts' },
    { id: 'notifications', label: 'Notifications', icon: Bell, href: '/admin/notifications' },
    { id: 'inquiries', label: 'Inquiries', icon: MessageSquare, href: '/admin/inquiries', badge: 'newInquiries' },
  ]},
  { group: 'TEAM', items: [
    { id: 'team', label: 'Team Members', icon: UserCheck, href: '/admin/team' },
    { id: 'time', label: 'Time Tracking', icon: Clock, href: '/admin/time' },
  ]},
  { group: 'FINANCE', items: [
    { id: 'finance', label: 'Finance', icon: BarChart2, href: '/admin/finance' },
    { id: 'events', label: 'Events', icon: Calendar, href: '/admin/events' },
  ]},
]

export const FEEDBACK_NAV = {
  id: 'feedback',
  label: 'Feedback',
  icon: Inbox,
  href: '/lynq-admin/feedback',
}

// ── Topbar tab meta ──
// Subtitle can be a static string or null (dynamic subtitles are computed in AdminTopbar)
export const TAB_META: Record<string, { title: string; sub: string | null }> = {
  dashboard: { title: 'Dashboard', sub: 'Overview of your platform' },
  clients: { title: 'Clients', sub: null },
  'create-client': { title: 'Create Client', sub: 'Add a new client account' },
  broadcasts: { title: 'Broadcasts', sub: null },
  notifications: { title: 'Notifications', sub: null },
  inquiries: { title: 'Inquiries', sub: null },
  team: { title: 'Team Members', sub: null },
  time: { title: 'Time Tracking', sub: 'Session overview' },
  finance: { title: 'Finance', sub: 'P&L and AI costs' },
  events: { title: 'Events', sub: null },
}

// ── Broadcast types ──
export interface BroadcastTypeConfig {
  label: string
  desc: string
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  colorClass: string       // Tailwind text color: "text-green-600"
  bgClass: string          // Tailwind bg: "bg-green-500/6"
  borderClass: string      // Tailwind border: "border-green-500/20"
}

export const BROADCAST_TYPES: Record<BroadcastType, BroadcastTypeConfig> = {
  update: {
    label: 'Update', desc: 'News or announcements', icon: TrendingUp,
    colorClass: 'text-green-600', bgClass: 'bg-green-500/6', borderClass: 'border-green-500/20',
  },
  tip: {
    label: 'Tip', desc: 'Strategy or trick', icon: Info,
    colorClass: 'text-amber-600', bgClass: 'bg-amber-500/6', borderClass: 'border-amber-500/20',
  },
  video: {
    label: 'Video', desc: 'Embed a YouTube video', icon: Play,
    colorClass: 'text-violet-600', bgClass: 'bg-violet-500/6', borderClass: 'border-violet-500/20',
  },
  industry: {
    label: 'Industry', desc: 'Market insights', icon: Building2,
    colorClass: 'text-blue-600', bgClass: 'bg-blue-500/6', borderClass: 'border-blue-500/20',
  },
}

export const BROADCAST_TOPICS = [
  'Media Buying', 'Creative Strategy', 'Supply Chain',
  'Customer Service', 'Email Marketing', 'Analytics',
]

// ── Notification types ──
export const NOTIFICATION_TYPES: Array<{ type: NotificationType; label: string }> = [
  { type: 'info', label: '💬 Info' },
  { type: 'warning', label: '⚠️ Warning' },
  { type: 'alert', label: '🔴 Alert' },
]

export const NOTIFICATION_COLORS: Record<NotificationType, { bgClass: string; colorClass: string; borderClass: string }> = {
  info: { bgClass: 'bg-blue-500/8', colorClass: 'text-blue-600', borderClass: 'border-blue-500/20' },
  warning: { bgClass: 'bg-amber-500/8', colorClass: 'text-amber-600', borderClass: 'border-amber-500/20' },
  alert: { bgClass: 'bg-red-500/8', colorClass: 'text-red-600', borderClass: 'border-red-500/20' },
}

// ── Inquiry service colors ──
export const SERVICE_COLORS: Record<string, string> = {
  'Customer Service Agent': 'text-violet-600',
  'Dispute Manager': 'text-emerald-600',
  'Supply Chain Manager': 'text-blue-600',
  'Senior Backend Manager': 'text-amber-600',
  'Train Your Existing Team': 'text-orange-600',
  'General Inquiry': 'text-violet-600',
}

// ── Initial form states ──
export const INITIAL_CLIENT_FORM: CreateClientForm = {
  company_name: '', email: '', password: '',
  shopify_domain: '', shopify_api_key: '', parcel_panel_api_key: '',
}

export const INITIAL_BROADCAST_FORM: BroadcastForm = {
  title: '', body: '', type: 'update', youtube_url: '', topic: '',
}

export const INITIAL_NOTIFICATION_FORM: NotificationForm = {
  title: '', body: '', type: 'info',
}

export const INITIAL_TEAM_FORM: TeamMemberForm = {
  name: '', email: '', password: '', role: 'developer',
}

export const INITIAL_MASTERCLASS_FORM: MasterclassForm = {
  title: '', speaker: '', description: '', scheduled_at: '', zoom_url: '',
}
```

- [ ] **Step 2: Create utils file**

```typescript
// lib/admin-utils.ts
import type { TimeSession } from '@/types/admin'

/** Format seconds as "1h 23m", "45m", or "2h" */
export function fmtSec(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

/** Format ISO string to "14:30" (HH:MM) */
export function fmtT(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** Format ISO string to "Mon, Jan 15" */
export function fmtD(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Format ISO string to "Mon, Jan 15 14:30" */
export function fmtDT(iso: string): string {
  return `${fmtD(iso)} ${fmtT(iso)}`
}

/** Get total worked seconds for a session */
export function workedSec(s: TimeSession): number {
  const end = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : Date.now()
  const start = new Date(s.clocked_in_at).getTime()
  return Math.max(0, Math.floor((end - start) / 1000) - (s.paused_seconds || 0))
}

/** Format number as "$X.XXXX" */
export function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`
}

/** Format number as "€X" */
export function fmtEur(n: number): string {
  return `€${Math.round(n)}`
}

/** Format number with locale thousands separator */
export function fmtNum(n: number): string {
  return n.toLocaleString()
}

/** Check if ISO date is in the past */
export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

/** Extract YouTube video ID from URL */
export function getYoutubeId(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

/** Export time sessions as CSV download */
export function exportTimeCSV(sessions: TimeSession[]): void {
  const rows = sessions.map((s) => [
    s.member_name,
    fmtD(s.clocked_in_at),
    fmtT(s.clocked_in_at),
    s.clocked_out_at ? fmtT(s.clocked_out_at) : 'Active',
    (workedSec(s) / 3600).toFixed(2),
    ((s.paused_seconds || 0) / 3600).toFixed(2),
    (s.eod_report || '').replace(/"/g, '""'),
  ])
  const header = 'Name,Date,Clock In,Clock Out,Worked (h),Break (h),Report'
  const csv = [header, ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `time-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to admin files

---

## Task 3: Zustand Store

**Files:**
- Create: `stores/admin-ui.ts`

- [ ] **Step 1: Create the store**

```typescript
// stores/admin-ui.ts
import { create } from 'zustand'

interface AdminUIState {
  editingZoomId: string | null
  setEditingZoomId: (id: string | null) => void
}

export const useAdminUI = create<AdminUIState>()((set) => ({
  editingZoomId: null,
  setEditingZoomId: (id) => set({ editingZoomId: id }),
}))
```

---

## Task 4: TanStack Data Hooks

**Files:**
- Create: `hooks/admin/use-admin-data.ts`
- Create: `hooks/admin/index.ts`

- [ ] **Step 1: Create data hooks**

```typescript
// hooks/admin/use-admin-data.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Client, Broadcast, Notification, Inquiry, TeamMember, Masterclass, BroadcastReaction, FinanceData, TimeData } from '@/types/admin'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const adminKeys = {
  all: ['admin'] as const,
  clients: () => [...adminKeys.all, 'clients'] as const,
  broadcasts: () => [...adminKeys.all, 'broadcasts'] as const,
  notifications: () => [...adminKeys.all, 'notifications'] as const,
  inquiries: () => [...adminKeys.all, 'inquiries'] as const,
  team: () => [...adminKeys.all, 'team'] as const,
  time: (filter: string) => [...adminKeys.all, 'time', filter] as const,
  finance: () => [...adminKeys.all, 'finance'] as const,
  masterclasses: () => [...adminKeys.all, 'masterclasses'] as const,
  broadcastReactions: () => [...adminKeys.all, 'broadcast-reactions'] as const,
  feedbackCount: () => [...adminKeys.all, 'feedback-count'] as const,
}

export function useClients() {
  return useQuery<Client[]>({
    queryKey: adminKeys.clients(),
    queryFn: async () => {
      const { data } = await supabase
        .from('clients').select('*')
        .order('created_at', { ascending: false })
      return (data as Client[]) ?? []
    },
  })
}

export function useBroadcasts() {
  return useQuery<Broadcast[]>({
    queryKey: adminKeys.broadcasts(),
    queryFn: async () => {
      const { data } = await supabase
        .from('broadcasts').select('*')
        .order('created_at', { ascending: false })
      return (data as Broadcast[]) ?? []
    },
  })
}

export function useBroadcastReactions() {
  return useQuery<BroadcastReaction[]>({
    queryKey: adminKeys.broadcastReactions(),
    queryFn: async () => {
      const { data } = await supabase
        .from('broadcast_reactions').select('broadcast_id, emoji')
      return (data as BroadcastReaction[]) ?? []
    },
  })
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: adminKeys.notifications(),
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications').select('*')
        .order('created_at', { ascending: false })
      return (data as Notification[]) ?? []
    },
  })
}

export function useInquiries() {
  return useQuery<Inquiry[]>({
    queryKey: adminKeys.inquiries(),
    queryFn: async () => {
      const { data } = await supabase
        .from('service_inquiries').select('*')
        .order('created_at', { ascending: false })
      return (data as Inquiry[]) ?? []
    },
  })
}

export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: adminKeys.team(),
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members').select('*')
        .order('created_at', { ascending: false })
      return (data as TeamMember[]) ?? []
    },
  })
}

export function useMasterclasses() {
  return useQuery<Masterclass[]>({
    queryKey: adminKeys.masterclasses(),
    queryFn: async () => {
      const { data } = await supabase
        .from('masterclasses').select('*')
        .order('scheduled_at', { ascending: false })
      return (data as Masterclass[]) ?? []
    },
  })
}

export function useTimeData(filter: string) {
  const token = useToken()
  return useQuery<TimeData>({
    queryKey: adminKeys.time(filter),
    queryFn: async () => {
      const res = await fetch(`/api/time?filter=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch time data')
      return res.json()
    },
    enabled: !!token,
  })
}

export function useFinance() {
  const token = useToken()
  const email = useAuthStore((s) => s.user?.email ?? '')
  return useQuery<FinanceData>({
    queryKey: adminKeys.finance(),
    queryFn: async () => {
      const res = await fetch('/api/admin/finance', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-admin-email': email,
        },
      })
      if (!res.ok) throw new Error('Failed to fetch finance data')
      return res.json()
    },
    enabled: !!token && !!email,
  })
}

export function useFeedbackCount() {
  const token = useToken()
  return useQuery<number>({
    queryKey: adminKeys.feedbackCount(),
    queryFn: async () => {
      const res = await fetch('/api/lynq-admin/feedback/count', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!res.ok) return 0
      const d = await res.json().catch(() => ({}))
      return typeof d.count === 'number' ? d.count : 0
    },
    enabled: !!token,
  })
}
```

- [ ] **Step 2: Create index file (data hooks only for now)**

```typescript
// hooks/admin/index.ts
export * from './use-admin-data'
```

Note: `use-admin-mutations` re-export will be added in Task 5 after that file is created.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to admin hooks

---

## Task 5: TanStack Mutation Hooks

**Files:**
- Create: `hooks/admin/use-admin-mutations.ts`

- [ ] **Step 1: Create mutations file**

```typescript
// hooks/admin/use-admin-mutations.ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { adminKeys } from './use-admin-data'
import type { CreateClientForm, BroadcastForm, NotificationForm, TeamMemberForm, MasterclassForm } from '@/types/admin'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: CreateClientForm) => {
      const { error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (authError) throw authError

      const { error: dbError } = await supabase.from('clients').insert({
        company_name: form.company_name,
        email: form.email,
        shopify_domain: form.shopify_domain || null,
        shopify_api_key: form.shopify_api_key || null,
        parcel_panel_api_key: form.parcel_panel_api_key || null,
        status: 'active',
      })
      if (dbError) throw dbError
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.clients() })
    },
  })
}

export function useCreateBroadcast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: BroadcastForm) => {
      const { error } = await supabase.from('broadcasts').insert({
        title: form.title,
        body: form.body || null,
        type: form.type,
        youtube_url: form.youtube_url?.trim() || null,
        topic: form.topic?.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.broadcasts() })
      qc.invalidateQueries({ queryKey: adminKeys.broadcastReactions() })
    },
  })
}

export function useDeleteBroadcast() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('broadcasts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.broadcasts() })
      qc.invalidateQueries({ queryKey: adminKeys.broadcastReactions() })
    },
  })
}

export function useTogglePin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      if (!isPinned) {
        await supabase.from('broadcasts').update({ is_pinned: false }).eq('is_pinned', true)
      }
      const { error } = await supabase.from('broadcasts').update({ is_pinned: !isPinned }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.broadcasts() })
    },
  })
}

export function useCreateNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: NotificationForm) => {
      const { error } = await supabase.from('notifications').insert({
        title: form.title,
        body: form.body,
        type: form.type,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.notifications() })
    },
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.notifications() })
    },
  })
}

export function useMarkInquiryRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_inquiries').update({ status: 'read' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.inquiries() })
    },
  })
}

export function useCreateTeamMember() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: TeamMemberForm) => {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Something went wrong')
      return d
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.team() })
    },
  })
}

export function useDeleteTeamMember() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/admin/delete-user?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.team() })
    },
  })
}

export function useCreateMasterclass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: MasterclassForm) => {
      const { error } = await supabase.from('masterclasses').insert({
        title: form.title,
        speaker: form.speaker?.trim() || null,
        description: form.description?.trim() || null,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        zoom_url: form.zoom_url?.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.masterclasses() })
    },
  })
}

export function useDeleteMasterclass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('masterclasses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.masterclasses() })
    },
  })
}

export function useUpdateZoomUrl() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      const { error } = await supabase
        .from('masterclasses')
        .update({ zoom_url: url?.trim() || null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.masterclasses() })
    },
  })
}
```

- [ ] **Step 2: Update index.ts to re-export mutations**

Add the mutations re-export to `hooks/admin/index.ts`:

```typescript
// hooks/admin/index.ts
export * from './use-admin-data'
export * from './use-admin-mutations'
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

---

## Task 6: Admin Sidebar & Topbar

**Files:**
- Create: `components/features/admin/admin-sidebar.tsx`
- Create: `components/features/admin/admin-topbar.tsx`
- Modify: `app/lynq-admin/layout.js` — update import path

- [ ] **Step 1: Create AdminSidebar component**

Port `app/components/AdminSidebar.js` to TypeScript + Tailwind. Use `usePathname()` for active state, `<Link>` for navigation, TanStack hooks for badge counts. Replace CSS template string and inline styles with Tailwind classes. Remove tabs-mode/links-mode duality — always use links. Reference `ADMIN_NAV` and `FEEDBACK_NAV` from `lib/admin-constants.ts`.

**Important:** Export as both named AND default export so that `app/lynq-admin/layout.js` (default import) and `app/admin/layout.tsx` (named import) both work:
```typescript
export function AdminSidebar() { ... }
export default AdminSidebar
```

The sidebar should:
- Show the "ADMIN / Lynq & Flow" header
- Render all nav groups from `ADMIN_NAV` with Lucide icons
- Highlight active item by matching `usePathname()` against `item.href`
- Show badge counts via `useClients()` and `useInquiries()` TanStack hooks
- Show Feedback link with count via `useFeedbackCount()`
- Show "Back to Dashboard" footer link

- [ ] **Step 2: Create AdminTopbar component**

The topbar derives its subtitle from the current route segment. For segments with dynamic subtitles (e.g. "5 total" for clients), it conditionally fetches only the data needed for the current segment — not all 6 queries at once. Use a helper component or conditional hook pattern:

```typescript
// components/features/admin/admin-topbar.tsx
'use client'

import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TAB_META } from '@/lib/admin-constants'
import { Button } from '@/components/ui/button'

// Import individual hooks — each is called conditionally via a sub-component
// to avoid firing unnecessary queries on unrelated tabs.
import { useClients, useBroadcasts, useNotifications, useInquiries, useTeamMembers, useMasterclasses } from '@/hooks/admin'

// Sub-component per dynamic subtitle to isolate hook calls
function ClientsSub() { const { data } = useClients(); return <>{data?.length ?? 0} total</> }
function BroadcastsSub() { const { data } = useBroadcasts(); return <>{data?.length ?? 0} published</> }
function NotificationsSub() { const { data } = useNotifications(); return <>{data?.length ?? 0} sent</> }
function InquiriesSub() {
  const { data } = useInquiries()
  const n = data?.filter((i) => i.status === 'new').length ?? 0
  return <>{n > 0 ? `${n} new` : 'All read'}</>
}
function TeamSub() { const { data } = useTeamMembers(); return <>{data?.length ?? 0} members</> }
function EventsSub() { const { data } = useMasterclasses(); return <>{data?.length ?? 0} masterclasses</> }

const DYNAMIC_SUB: Record<string, () => React.JSX.Element> = {
  clients: ClientsSub, broadcasts: BroadcastsSub, notifications: NotificationsSub,
  inquiries: InquiriesSub, team: TeamSub, events: EventsSub,
}

export function AdminTopbar() {
  const pathname = usePathname() || ''
  const segment = pathname.split('/').pop() || 'dashboard'
  const meta = TAB_META[segment] || { title: 'Admin', sub: null }

  const DynamicSub = DYNAMIC_SUB[segment]

  return (
    <div className="h-[46px] bg-white border-b border-black/7 px-6 flex items-center gap-3 shrink-0">
      <div className="text-sm font-semibold text-foreground">{meta.title}</div>
      {meta.sub && <div className="text-[13px] text-muted-foreground">{meta.sub}</div>}
      {!meta.sub && DynamicSub && <div className="text-[13px] text-muted-foreground"><DynamicSub /></div>}
      <div className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        className="text-xs font-semibold"
        onClick={async () => {
          await supabase.auth.signOut()
          window.location.href = '/admin/login'
        }}
      >
        Log out
      </Button>
    </div>
  )
}
```

This pattern ensures only the relevant TanStack query fires per tab — e.g. navigating to `/admin/time` (which has a static subtitle) fires zero extra queries.

- [ ] **Step 3: Update lynq-admin layout import**

In `app/lynq-admin/layout.js`, change the AdminSidebar import from:
```javascript
import AdminSidebar from '../components/AdminSidebar'
```
to:
```javascript
import AdminSidebar from '../../components/features/admin/admin-sidebar'
```

Verify the sidebar still renders correctly at `/lynq-admin/feedback`.

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

---

## Task 7: Admin Layout & Root Redirect

**Files:**
- Rename: `app/admin/page.js` → `app/admin/_page_old.js`
- Move: `app/admin/login/` → `app/(admin-login)/admin/login/` (route group to exclude from layout)
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`

**Important:** The `/admin/login` page must NOT be wrapped by the auth-guarded layout (it needs to be accessible without authentication). We use a Next.js route group `(admin-login)` to place the login page outside the admin layout scope while keeping the same URL path.

- [ ] **Step 1: Rename old page to prevent conflict**

```bash
mv app/admin/page.js app/admin/_page_old.js
```

This prevents the `.js`/`.tsx` conflict. We'll reference the old file during component extraction and delete it in Task 17.

- [ ] **Step 2: Move login page out of admin layout scope**

```bash
mkdir -p "app/(admin-login)/admin/login"
mv app/admin/login/page.js "app/(admin-login)/admin/login/page.js"
rmdir app/admin/login
```

This keeps the URL as `/admin/login` but the login page won't be wrapped by `app/admin/layout.tsx`.

- [ ] **Step 3: Create layout**

```typescript
// app/admin/layout.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ADMIN_EMAILS } from '@/lib/admin-constants'
import { AdminSidebar } from '@/components/features/admin/admin-sidebar'
import { AdminTopbar } from '@/components/features/admin/admin-topbar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
        window.location.href = '/admin/login'
        return
      }
      setAuthorized(true)
    }
    checkAuth()
  }, [])

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#F9F9FB] flex items-center justify-center text-[13px] text-muted-foreground font-sans">
        Checking access…
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#F9F9FB] overflow-hidden font-sans">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar />
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create root redirect page**

```typescript
// app/admin/page.tsx
import { redirect } from 'next/navigation'

export default function AdminRootPage() {
  redirect('/admin/dashboard')
}
```

Note: This is a server component using server-side `redirect()`. The layout is a client component — this is fine in Next.js app router.

- [ ] **Step 5: Verify the layout renders**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds. `/admin` redirects to `/admin/dashboard` (404 expected since dashboard page doesn't exist yet). `/admin/login` still works and is NOT wrapped by the admin layout.

---

## Task 8: Dashboard Tab

**Files:**
- Create: `app/admin/dashboard/page.tsx`
- Create: `components/features/admin/dashboard/dashboard-view.tsx`
- Create: `components/features/admin/dashboard/metric-card.tsx`
- Create: `components/features/admin/dashboard/recent-clients-list.tsx`

- [ ] **Step 1: Create MetricCard component**

A reusable card showing an icon, large number, and label. Uses shadcn Card + Tailwind. Receives `icon` (Lucide component), `value` (number), and `label` (string) as props.

- [ ] **Step 2: Create RecentClientsList component**

Shows the 5 most recent clients in a Card with rows. Each row has an avatar circle (first letter of company name), company name, email, and status badge. Uses `useClients()` hook. Port the client row markup from `app/admin/_page_old.js` lines 617-676, converting inline styles to Tailwind.

- [ ] **Step 3: Create DashboardView component**

Composes 4 MetricCards (Total Clients, Active Clients, Broadcasts, Notifications) in a 4-column grid + RecentClientsList below. Uses `useClients()`, `useBroadcasts()`, `useNotifications()` hooks for counts.

- [ ] **Step 4: Create dashboard page**

```typescript
// app/admin/dashboard/page.tsx
import { DashboardView } from '@/components/features/admin/dashboard/dashboard-view'

export default function DashboardPage() {
  return <DashboardView />
}
```

- [ ] **Step 5: Verify page renders**

Run the dev server: `npx next dev`
Navigate to `/admin/dashboard` — verify KPI cards and recent clients list render.

---

## Task 9: Clients Tab

**Files:**
- Create: `app/admin/clients/page.tsx`
- Create: `components/features/admin/clients/clients-list.tsx`
- Create: `components/features/admin/clients/client-row.tsx`

- [ ] **Step 1: Create ClientRow component**

Props: `client: Client`. Renders avatar circle, company name, email, status badge. All Tailwind, no inline styles. Port from `app/admin/_page_old.js` lines 706-751.

- [ ] **Step 2: Create ClientsList component**

Uses `useClients()`. Renders Card with header showing count + maps ClientRow. Port from lines 682-753.

- [ ] **Step 3: Create clients page**

```typescript
// app/admin/clients/page.tsx
import { ClientsList } from '@/components/features/admin/clients/clients-list'

export default function ClientsPage() {
  return <ClientsList />
}
```

---

## Task 10: Create Client Tab

**Files:**
- Create: `app/admin/create-client/page.tsx`
- Create: `components/features/admin/create-client/create-client-form.tsx`

- [ ] **Step 1: Create CreateClientForm component**

Uses local `useState` for form, `useCreateClient()` mutation, `toast.success()`/`toast.error()`. Uses shadcn Input, Button, Label. Port form from `app/admin/_page_old.js` lines 756-865. Sections: Account Details (company, email, password) + Integrations (Shopify domain, API key, Parcel Panel key).

- [ ] **Step 2: Create create-client page**

Reuses `ClientsList` from Task 9 for the right panel:

```typescript
// app/admin/create-client/page.tsx
import { CreateClientForm } from '@/components/features/admin/create-client/create-client-form'
import { ClientsList } from '@/components/features/admin/clients/clients-list'

export default function CreateClientPage() {
  return (
    <div className="grid grid-cols-[42%_58%] gap-4 items-start">
      <CreateClientForm />
      <ClientsList />
    </div>
  )
}
```

---

## Task 11: Broadcasts Tab

**Files:**
- Create: `app/admin/broadcasts/page.tsx`
- Create: `components/features/admin/broadcasts/broadcast-form.tsx`
- Create: `components/features/admin/broadcasts/broadcast-list.tsx`
- Create: `components/features/admin/broadcasts/broadcast-row.tsx`

- [ ] **Step 1: Create BroadcastRow component**

Props: `broadcast`, `reactions`, `onDelete`, `onTogglePin`. Shows type icon (from `BROADCAST_TYPES`), type label, pinned badge, date, title, body preview, reaction counts, pin/delete action buttons. Uses Lucide `Pin` and `Trash2` icons. Port from `app/admin/_page_old.js` lines 1268-1482.

- [ ] **Step 2: Create BroadcastList component**

Uses `useBroadcasts()`, `useBroadcastReactions()`, `useDeleteBroadcast()`, `useTogglePin()`. Maps BroadcastRow components.

- [ ] **Step 3: Create BroadcastForm component**

Local form state, `useCreateBroadcast()` mutation. Sections: type selector (2x2 grid of BROADCAST_TYPES pills), topic selector (BROADCAST_TOPICS pills), YouTube URL input with thumbnail preview (for video type), title, content/description textarea. Uses `getYoutubeId()` from `lib/admin-utils.ts`. Port from lines 944-1242.

- [ ] **Step 4: Create broadcasts page**

```typescript
// app/admin/broadcasts/page.tsx
import { BroadcastForm } from '@/components/features/admin/broadcasts/broadcast-form'
import { BroadcastList } from '@/components/features/admin/broadcasts/broadcast-list'

export default function BroadcastsPage() {
  return (
    <div className="grid grid-cols-[42%_58%] gap-4 items-start">
      <BroadcastForm />
      <BroadcastList />
    </div>
  )
}
```

---

## Task 12: Notifications Tab

**Files:**
- Create: `app/admin/notifications/page.tsx`
- Create: `components/features/admin/notifications/notification-form.tsx`
- Create: `components/features/admin/notifications/notification-list.tsx`

- [ ] **Step 1: Create NotificationList component**

Uses `useNotifications()`, `useDeleteNotification()`. Renders Card with list of notifications showing type badge, date, title, body, delete button. Port from lines 1562-1657.

- [ ] **Step 2: Create NotificationForm component**

Local form state, `useCreateNotification()` mutation. Type selector (info/warning/alert buttons), title input, message textarea, submit button. Port from lines 1498-1559.

- [ ] **Step 3: Create notifications page**

42/58 grid layout with form on left, list on right.

---

## Task 13: Inquiries Tab

**Files:**
- Create: `app/admin/inquiries/page.tsx`
- Create: `components/features/admin/inquiries/inquiries-view.tsx`
- Create: `components/features/admin/inquiries/inquiry-card.tsx`

- [ ] **Step 1: Create InquiryCard component**

Props: `inquiry`, `onMarkRead`. Shows service pill (with color from `SERVICE_COLORS`), "New" badge, date, email, WhatsApp link (if phone_number), message, "Mark read" button. Port from lines 1741-1909.

- [ ] **Step 2: Create InquiriesView component**

Uses `useInquiries()`, `useMarkInquiryRead()`. Shows 3 metric cards (Total, New, Read) + list of InquiryCard components. Port from lines 1662-1915.

- [ ] **Step 3: Create inquiries page**

```typescript
// app/admin/inquiries/page.tsx
import { InquiriesView } from '@/components/features/admin/inquiries/inquiries-view'

export default function InquiriesPage() {
  return <InquiriesView />
}
```

---

## Task 14: Team Tab

**Files:**
- Create: `app/admin/team/page.tsx`
- Create: `components/features/admin/team/team-form.tsx`
- Create: `components/features/admin/team/team-list.tsx`

- [ ] **Step 1: Create TeamList component**

Uses `useTeamMembers()`, `useDeleteTeamMember()`. Card with header, rows showing avatar, name, email, role badge, delete button. Port from lines 1998-2088.

- [ ] **Step 2: Create TeamForm component**

Local form state, `useCreateTeamMember()` mutation. Fields: name, email, password, role selector (developer/manager buttons). Port from lines 1927-1995.

- [ ] **Step 3: Create team page**

42/58 grid with form + list.

---

## Task 15: Time Tracking Tab

**Files:**
- Create: `app/admin/time/page.tsx`
- Create: `components/features/admin/time/time-view.tsx`

- [ ] **Step 1: Create TimeView component**

Uses `useTimeData(filter)` with local `useState` for filter ('day'/'week'/'month'). Port the time tracking view from lines 2089-2543. Uses utility functions from `lib/admin-utils.ts` (fmtSec, fmtT, fmtD, workedSec, exportTimeCSV). Shows:
- Filter buttons (Today/Week/Month)
- Summary metrics (active now, paused, total hours)
- Team member cards with worked time and status
- Session history list with clock in/out times and reports
- CSV export button

If this component exceeds 300 lines, extract sub-components (e.g., `time-member-card.tsx`, `time-session-row.tsx`).

- [ ] **Step 2: Create time page**

```typescript
// app/admin/time/page.tsx
import { TimeView } from '@/components/features/admin/time/time-view'

export default function TimePage() {
  return <TimeView />
}
```

---

## Task 16: Finance & Events Tabs

**Files:**
- Create: `app/admin/finance/page.tsx`
- Create: `components/features/admin/finance/finance-view.tsx`
- Create: `app/admin/events/page.tsx`
- Create: `components/features/admin/events/event-form.tsx`
- Create: `components/features/admin/events/event-list.tsx`

- [ ] **Step 1: Create FinanceView component**

Uses `useFinance()`. Port from lines 2544-3032. Shows:
- Top metrics (MRR, Total Costs, Net Margin, AI Costs Today)
- AI Credits section (today, 7d, month, last month)
- Usage by route table with progress bars
- Fixed subscriptions list
- P&L breakdown

Uses `fmtUsd`, `fmtEur`, `fmtNum` from `lib/admin-utils.ts`. If exceeds 300 lines, extract sub-components.

- [ ] **Step 2: Create finance page**

```typescript
// app/admin/finance/page.tsx
import { FinanceView } from '@/components/features/admin/finance/finance-view'

export default function FinancePage() {
  return <FinanceView />
}
```

- [ ] **Step 3: Create EventForm component**

Local form state, `useCreateMasterclass()` mutation. Fields: title, speaker, description, scheduled_at (datetime-local), zoom_url. Port from lines 3033-3150.

- [ ] **Step 4: Create EventList component**

Uses `useMasterclasses()`, `useDeleteMasterclass()`, `useUpdateZoomUrl()`, `useAdminUI` (for editingZoomId). Shows list of masterclasses with past/upcoming status, zoom URL inline editing, delete button. Uses `fmtDT`, `isPast` from `lib/admin-utils.ts`. Port from lines 3150-3412.

- [ ] **Step 5: Create events page**

42/58 grid with form + list.

---

## Task 17: Cleanup & Verification

**Files:**
- Delete: `app/admin/_page_old.js` (renamed in Task 7)
- Delete: `app/components/AdminSidebar.js`

- [ ] **Step 1: Delete old files**

```bash
rm app/admin/_page_old.js
rm app/components/AdminSidebar.js
```

- [ ] **Step 2: Search for stale imports**

Search for any remaining references to the old AdminSidebar path or the old `page.js`:

Run: `grep -r "components/AdminSidebar\|admin/page.js" --include="*.js" --include="*.ts" --include="*.tsx" app/ components/ -l`

Verify no remaining imports reference deleted files. The only AdminSidebar import should be from `app/lynq-admin/layout.js` pointing to `components/features/admin/admin-sidebar`.

- [ ] **Step 3: Full build verification**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Manual smoke test**

Navigate through all 10 tabs in the browser and verify:
- `/admin` → redirects to `/admin/dashboard`
- `/admin/dashboard` → KPI cards + recent clients
- `/admin/clients` → client list with status badges
- `/admin/create-client` → form + client list preview
- `/admin/broadcasts` → form with type selector + published list
- `/admin/notifications` → form + sent list
- `/admin/inquiries` → metrics + inquiry cards with mark-read
- `/admin/team` → form + team list
- `/admin/time` → filter buttons + session list + CSV export
- `/admin/finance` → metrics + AI usage + subscriptions
- `/admin/events` → form + masterclass list with zoom editing
- `/admin/login` → login page renders WITHOUT sidebar/topbar (route group works)
- `/lynq-admin/feedback` → sidebar still renders correctly

