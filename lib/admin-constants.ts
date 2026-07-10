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
  TrendingUp, Info, Play, Building2, RefreshCw,
} from 'lucide-react'

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
  { group: 'SYSTEM', items: [
    { id: 'webhooks', label: 'Webhooks', icon: RefreshCw, href: '/admin/webhooks' },
    { id: 'cron-jobs', label: 'Cron Jobs', icon: Clock, href: '/admin/cron-jobs' },
  ]},
]

export const FEEDBACK_NAV = {
  id: 'feedback',
  label: 'Feedback',
  icon: Inbox,
  href: '/lynq-admin/feedback',
}

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
  webhooks: { title: 'Webhooks', sub: 'Failed and dead-lettered webhook events' },
  'cron-jobs': { title: 'Cron Jobs', sub: 'Scheduled job monitoring and alerting' },
}

export interface BroadcastTypeConfig {
  label: string
  desc: string
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  colorClass: string
  bgClass: string
  borderClass: string
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

export const SERVICE_COLORS: Record<string, string> = {
  'Customer Service Agent': 'text-violet-600',
  'Dispute Manager': 'text-emerald-600',
  'Supply Chain Manager': 'text-blue-600',
  'Senior Backend Manager': 'text-amber-600',
  'Train Your Existing Team': 'text-orange-600',
  'General Inquiry': 'text-violet-600',
}

export const INITIAL_CLIENT_FORM: CreateClientForm = {
  company_name: '', email: '', password: '',
  shopify_domain: '', shopify_api_key: '', parcel_panel_api_key: '',
}

export const INITIAL_BROADCAST_FORM: BroadcastForm = {
  title: '', body: '', type: 'update', youtube_url: '', topic: '', image_url: '',
}

export const INITIAL_NOTIFICATION_FORM: NotificationForm = {
  title: '', body: '', type: 'info',
}

export const INITIAL_TEAM_FORM: TeamMemberForm = {
  name: '', email: '', password: '', role: 'agent',
}

export const INITIAL_MASTERCLASS_FORM: MasterclassForm = {
  title: '', speaker: '', description: '', scheduled_at: '', zoom_url: '',
}
