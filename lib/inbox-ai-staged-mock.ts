// ─── AI Staged — DEV-ONLY MOCK ────────────────────────────────
// The "AI Staged" tab lists conversations that Emma has auto-drafted/handled,
// sourced from the `emma_draft_queue` table. The conversation list endpoint does
// NOT yet expose that queue as a filter (Backend task #8 in
// docs/inbox-figma-redesign-plan.md), so until it does this mock backs the tab
// purely in development (gated by AI_STAGED_MOCK in lib/inbox-constants.ts).
//
// ⚠️ Never ships to production: with the flag OFF the tab shows an empty state,
// so a real client never sees these fabricated drafts.
//
// When BE #8 lands: delete this file and swap the `ai_staged` branch in
// useConversations() for a real `status=ai_staged` (or equivalent) fetch — the
// rows are already plain Thread objects, so the list renderer is unchanged.

import type { Thread } from '@/types/inbox'

/** One queued Emma draft, mirroring the `emma_draft_queue` row signature
 *  (id / conversation_id / status / created_at) joined with the conversation
 *  display fields the thread-list row needs (customer + subject + preview). */
interface AIStagedMockRow {
  // emma_draft_queue columns
  id: string
  conversation_id: string
  status: 'completed'
  created_at: string // ISO, set relative to now in buildAIStagedMockDrafts()
  // joined conversation display fields
  customer_name: string
  customer_email: string
  subject: string
  snippet: string
  hoursAgo: number
}

// Mirrors the Figma "AI_Staged Tab" frame (8 staged drafts → badge "8").
const ROWS: Omit<AIStagedMockRow, 'created_at'>[] = [
  { id: 'eq-1', conversation_id: 'cv-4820', customer_name: 'Alex Carter',     customer_email: 'alex@celestialsheets.com',  subject: 'Re: [Celestial Sheets] Order #4820 placed by Alex',    snippet: 'Emma drafted a reply about order #4820 — review it or take it back.',    hoursAgo: 1, status: 'completed' },
  { id: 'eq-2', conversation_id: 'cv-4821', customer_name: 'Jessica Reed',    customer_email: 'jessica@nebulaflavors.com', subject: 'Re: [Nebula Flavors] Order #4821 placed by Jessica',   snippet: 'Emma drafted a reply about order #4821 — review it or take it back.',    hoursAgo: 2, status: 'completed' },
  { id: 'eq-3', conversation_id: 'cv-4822', customer_name: 'Michael Stone',   customer_email: 'michael@stellargears.com',  subject: 'Re: [Stellar Gears] Order #4822 placed by Michael',    snippet: 'Emma drafted a reply about order #4822 — review it or take it back.',    hoursAgo: 3, status: 'completed' },
  { id: 'eq-4', conversation_id: 'cv-4823', customer_name: 'Lisa Monroe',     customer_email: 'lisa@galacticgadgets.com',  subject: 'Re: [Galactic Gadgets] Order #4823 placed by Lisa',    snippet: 'Emma drafted a reply about order #4823 — review it or take it back.',    hoursAgo: 4, status: 'completed' },
  { id: 'eq-5', conversation_id: 'cv-4824', customer_name: 'David Park',      customer_email: 'david@quasarlights.com',    subject: 'Re: [Quasar Lights] Order #4824 placed by David',      snippet: 'Emma drafted a reply about order #4824 — review it or take it back.',    hoursAgo: 5, status: 'completed' },
  { id: 'eq-6', conversation_id: 'cv-4825', customer_name: 'Sarah Quinn',     customer_email: 'sarah@cometsupplies.com',   subject: 'Re: [Comet Supplies] Order #4825 placed by Sarah',     snippet: 'Emma drafted a reply about order #4825 — review it or take it back.',    hoursAgo: 6, status: 'completed' },
  { id: 'eq-7', conversation_id: 'cv-4826', customer_name: 'John Mercer',     customer_email: 'john@asteroidtools.com',    subject: 'Re: [Asteroid Tools] Order #4826 placed by John',      snippet: 'Emma drafted a reply about order #4826 — review it or take it back.',    hoursAgo: 7, status: 'completed' },
  { id: 'eq-8', conversation_id: 'cv-4827', customer_name: 'Emma Lindqvist',  customer_email: 'emma@orbitgoods.com',       subject: 'Re: [Orbit Goods] Order #4827 placed by Emma',         snippet: 'Emma drafted a reply about order #4827 — review it or take it back.',    hoursAgo: 8, status: 'completed' },
]

/** Number of staged drafts, used for the tab count badge in dev. */
export const AI_STAGED_MOCK_COUNT = ROWS.length

/** Build the mock staged drafts as plain Thread rows (timestamps relative to now
 *  so "Nh ago" stays fresh). Auto-handled drafts are resolved conversations. */
export function buildAIStagedMockDrafts(): Thread[] {
  const now = Date.now()
  return ROWS.map((r) => {
    const iso = new Date(now - r.hoursAgo * 60 * 60 * 1000).toISOString()
    return {
      id: r.conversation_id,
      subject: r.subject,
      snippet: r.snippet,
      from: `${r.customer_name} <${r.customer_email}>`,
      from_email: r.customer_email,
      from_name: r.customer_name,
      customer_name: r.customer_name,
      customer_email: r.customer_email,
      status: 'resolved',
      created_at: iso,
      updated_at: iso,
      last_message_at: iso,
      date: iso,
      unread: false,
      is_unread: false,
      tags: [],
    }
  })
}
