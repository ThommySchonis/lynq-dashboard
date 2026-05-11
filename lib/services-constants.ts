/**
 * Shared constants for the Services module.
 * Extracted from app/services/page.js.
 */

import type { LucideIcon } from 'lucide-react'
import { Headphones, ShieldCheck, Package, BarChart2, GraduationCap } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceBadge {
  label: string
  color: string
  bg: string
  border?: string
}

export interface ServiceDef {
  id: string
  icon: LucideIcon
  title: string
  description: string
  features: string[]
  badge?: ServiceBadge
  iconBg: string
  iconColor: string
  topGradient: string
}

// ── Service definitions ───────────────────────────────────────────────────────

export const SERVICES: ServiceDef[] = [
  {
    id: 'customer_service_agent',
    title: 'Customer Service Agent',
    badge: { label: 'Most Popular', color: '#FFFFFF', bg: '#0F0F10' },
    topGradient: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
    iconBg: 'rgba(99,102,241,0.07)',
    iconColor: '#6366F1',
    icon: Headphones,
    description:
      'A trained specialist who handles all incoming customer inquiries — tracking, refunds, returns, and general support. Fully onboarded to your brand voice and policies.',
    features: [
      '100+ tickets handled daily',
      'Trained on your brand voice & policies',
      'Zendesk & Re:amaze certified',
    ],
  },
  {
    id: 'dispute_manager',
    title: 'Dispute Manager',
    topGradient: 'linear-gradient(90deg, #EF4444, #F87171)',
    iconBg: 'rgba(239,68,68,0.07)',
    iconColor: '#EF4444',
    icon: ShieldCheck,
    description:
      'An expert in handling chargebacks, payment disputes, and escalated cases. Protects your revenue and keeps your chargeback rate under control.',
    features: [
      'Chargeback & dispute resolution',
      'Revenue protection strategy',
      'Stripe, PayPal & Klarna specialist',
    ],
  },
  {
    id: 'supply_chain_manager',
    title: 'Supply Chain Manager',
    topGradient: 'linear-gradient(90deg, #10B981, #34D399)',
    iconBg: 'rgba(16,185,129,0.07)',
    iconColor: '#10B981',
    icon: Package,
    description:
      'Oversees supplier relationships, order fulfillment, stock management, and shipping performance. Keeps your operations running without bottlenecks.',
    features: [
      'Supplier & vendor management',
      'Inventory & stock optimization',
      'Fulfillment & shipping oversight',
    ],
  },
  {
    id: 'senior_backend_manager',
    title: 'Senior Backend Manager',
    topGradient: 'linear-gradient(90deg, #F59E0B, #FCD34D)',
    iconBg: 'rgba(245,158,11,0.07)',
    iconColor: '#F59E0B',
    icon: BarChart2,
    description:
      'Manages your entire CS operation end-to-end. Sets up systems, leads the team, handles escalations, and reports directly to you.',
    features: [
      'Full CS operation ownership',
      'Team setup, lead & escalation mgmt',
      'Weekly direct-to-you reporting',
    ],
  },
]

export const TRAIN_SERVICE: ServiceDef = {
  id: 'train_existing_team',
  title: 'Train Your Existing Team',
  badge: { label: 'New', color: '#2563EB', bg: '#EFF6FF', border: 'rgba(59,130,246,0.2)' },
  topGradient: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
  iconBg: 'rgba(59,130,246,0.07)',
  iconColor: '#3B82F6',
  icon: GraduationCap,
  description:
    "Upskill your in-house team with Lynq & Flow's proven e-commerce CS frameworks. We deliver structured training sessions, battle-tested playbooks, and ongoing coaching to bring your team to agency-level performance.",
  features: [
    'Custom training program built for your brand',
    'Proven e-commerce CS playbooks & frameworks',
    'Live training sessions with your team',
    'Ongoing coaching & performance tracking',
  ],
}

export const GUARANTEE_ITEMS: string[] = [
  'Dedicated trainer assigned to your account',
  '2-week personal onboarding included',
  'Daily performance report sent directly to you',
]
