/**
 * Shared constants for the Analytics / Refund Intelligence module.
 * Extracted from app/analytics/page.js.
 */

import type {
  DateRangeId,
  DateRange,
  Refund,
  PatternAction,
  WeeklyReportRow,
  ProductMatrixRow,
  RepeatRefunder,
  Delta,
  RefundCategory,
  CategoryColorConfig,
} from '@/types/analytics'

// ── Date range presets ───────────────────────────────────────────────────────

export const RANGES: { id: DateRangeId; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
]

// ── Date range helpers ───────────────────────────────────────────────────────

export function getDateRange(id: DateRangeId): DateRange {
  const now = new Date(), today = now.toISOString().slice(0, 10)
  if (id === '7d') return { from: new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10), to: today }
  if (id === '30d') return { from: new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10), to: today }
  if (id === 'lastMonth') { const f = new Date(now.getFullYear(), now.getMonth() - 1, 1), l = new Date(now.getFullYear(), now.getMonth(), 0); return { from: f.toISOString().slice(0, 10), to: l.toISOString().slice(0, 10) } }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: today }
}

export function getPrevDateRange(id: DateRangeId): DateRange {
  const now = new Date()
  if (id === '7d') return { from: new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10), to: new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10) }
  if (id === '30d') return { from: new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10), to: new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10) }
  if (id === 'lastMonth') { const f = new Date(now.getFullYear(), now.getMonth() - 2, 1), l = new Date(now.getFullYear(), now.getMonth() - 1, 0); return { from: f.toISOString().slice(0, 10), to: l.toISOString().slice(0, 10) } }
  const f = new Date(now.getFullYear(), now.getMonth() - 1, 1), l = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from: f.toISOString().slice(0, 10), to: l.toISOString().slice(0, 10) }
}

// ── Formatters ───────────────────────────────────────────────────────────────

export function fmtEur(n: number): string {
  return `\u20AC${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtDate(str: string): string {
  if (!str) return '\u2014'
  return new Date(str).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateShort(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Delta computation ────────────────────────────────────────────────────────

export function computeDelta(cur: number, prev: number): Delta | null {
  const c = parseFloat(String(cur || 0)), p = parseFloat(String(prev || 0))
  if (p === 0 || isNaN(c) || isNaN(p)) return null
  const pct = ((c - p) / Math.abs(p)) * 100
  return { pct, label: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` }
}

// ── Reason categorization ────────────────────────────────────────────────────

export const CATEGORIES: RefundCategory[] = ['All', 'Sizing', 'Damaged', 'Quality', 'Not as described', 'Changed mind', 'Other']

export const CAT_COLORS: Record<string, CategoryColorConfig> = {
  'Sizing': { color: '#B45309', bg: '#FFFBEB', border: 'rgba(245,158,11,0.22)', chartColor: '#F59E0B' },
  'Damaged': { color: '#B91C1C', bg: '#FEF2F2', border: 'rgba(239,68,68,0.22)', chartColor: '#EF4444' },
  'Quality': { color: '#6D28D9', bg: '#F5F3FF', border: 'rgba(139,92,246,0.22)', chartColor: '#8B5CF6' },
  'Not as described': { color: '#065F46', bg: '#ECFDF5', border: 'rgba(16,185,129,0.22)', chartColor: '#10B981' },
  'Changed mind': { color: '#374151', bg: '#F9FAFB', border: 'rgba(107,114,128,0.22)', chartColor: '#6B7280' },
  'Other': { color: '#6B7280', bg: '#F9FAFB', border: 'rgba(107,114,128,0.15)', chartColor: '#9CA3AF' },
  'Customer Outreach': { color: '#1D4ED8', bg: '#EFF6FF', border: 'rgba(59,130,246,0.22)', chartColor: '#3B82F6' },
  'Supplier': { color: '#B45309', bg: '#FFFBEB', border: 'rgba(245,158,11,0.22)', chartColor: '#F59E0B' },
  'Listing Fix': { color: '#065F46', bg: '#ECFDF5', border: 'rgba(16,185,129,0.22)', chartColor: '#10B981' },
  'Quality Control': { color: '#6D28D9', bg: '#F5F3FF', border: 'rgba(139,92,246,0.22)', chartColor: '#8B5CF6' },
  'Operations': { color: '#374151', bg: '#F9FAFB', border: 'rgba(107,114,128,0.2)', chartColor: '#9CA3AF' },
}

export interface BadgeColorConfig {
  bg: string
  color: string
  border: string
}

export const BADGE_COLORS: Record<string, BadgeColorConfig> = {
  'Sizing': { bg: 'rgba(245,158,11,0.08)', color: '#D97706', border: 'none' },
  'Damaged': { bg: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.15)' },
  'Quality': { bg: 'rgba(139,92,246,0.08)', color: '#7C3AED', border: 'none' },
  'Quality Control': { bg: 'rgba(139,92,246,0.08)', color: '#7C3AED', border: 'none' },
  'Not as described': { bg: 'rgba(16,185,129,0.08)', color: '#059669', border: 'none' },
  'Changed mind': { bg: '#F5F5F5', color: '#555555', border: 'none' },
  'Customer Outreach': { bg: 'rgba(59,130,246,0.08)', color: '#2563EB', border: 'none' },
  'Supplier': { bg: 'rgba(16,185,129,0.08)', color: '#059669', border: 'none' },
  'Listing Fix': { bg: 'rgba(16,185,129,0.08)', color: '#059669', border: 'none' },
  'Operations': { bg: '#F5F5F5', color: '#555555', border: 'none' },
  'Other': { bg: '#F5F5F5', color: '#555555', border: 'none' },
}

export function categorizeReason(raw: string): string {
  if (!raw) return 'Other'
  const r = raw.toLowerCase()
  if (/size|maat|small|large|fit|klein|groot|sizing|sized/.test(r)) return 'Sizing'
  if (/damage|damaged|broken|kapot|beschadigd|transit|arrived|cracked|defect/.test(r)) return 'Damaged'
  if (/quality|kwaliteit|expect|verwacht|stitching|fabric|material|poor/.test(r)) return 'Quality'
  if (/described|color|colour|kleur|photo|picture|different|anders|not as|mislead/.test(r)) return 'Not as described'
  if (/changed mind|no longer|changed my|besloten|don.t want|don.t need|by mistake/.test(r)) return 'Changed mind'
  return 'Other'
}

// ── Data builders ────────────────────────────────────────────────────────────

export function generateRepeatRefunderActions(allRefunds: Refund[]): PatternAction[] {
  const map: Record<string, { customer: string; email: string; refunds: Refund[]; totalAmount: number }> = {}
  allRefunds.forEach(r => {
    const k = r.customerEmail || r.customer
    if (!k) return
    if (!map[k]) map[k] = { customer: r.customer, email: r.customerEmail, refunds: [], totalAmount: 0 }
    map[k].refunds.push(r)
    map[k].totalAmount += parseFloat(String(r.refundAmount || 0))
  })
  return Object.values(map)
    .filter(c => c.refunds.length >= 2)
    .sort((a, b) => b.refunds.length - a.refunds.length)
    .slice(0, 3)
    .map(c => {
      const name = c.customer || c.email || 'Unknown customer'
      const n = c.refunds.length
      return {
        id: `repeat-${(c.email || c.customer || String(Math.random())).toString().replace(/\s+|@|\./g, '-').toLowerCase()}`,
        type: 'pattern' as const,
        priority: (n >= 3 ? 'high' : 'medium') as 'high' | 'medium',
        category: 'Customer Outreach',
        refundCount: n,
        totalAmount: c.totalAmount,
        title: `Contact repeat refunder: ${name}`,
        action: `${name} has refunded ${n} times (${fmtEur(c.totalAmount)} total lost). Reach out personally — offer store credit or a free exchange to retain the customer and eliminate chargeback risk.`,
      }
    })
}

export function generatePatternActions(allRefunds: Refund[]): PatternAction[] {
  const map: Record<string, { name: string; refunds: Refund[]; catCounts: Record<string, number> }> = {}
  allRefunds.forEach(r => {
    const cat = categorizeReason(r.reason)
    ;(r.products || []).forEach(p => {
      if (!map[p]) map[p] = { name: p, refunds: [], catCounts: {} }
      map[p].refunds.push(r)
      map[p].catCounts[cat] = (map[p].catCounts[cat] || 0) + 1
    })
  })
  const actions: PatternAction[] = []
  Object.values(map).forEach(prod => {
    if (prod.refunds.length < 2) return
    const dom = Object.entries(prod.catCounts).sort((a, b) => b[1] - a[1])[0][0]
    const amt = prod.refunds.reduce((s, r) => s + parseFloat(String(r.refundAmount || 0)), 0)
    const n = prod.refunds.length, a = fmtEur(amt)
    const copies: Record<string, { title: string; action: string }> = {
      'Sizing': { title: `Fix size guide: ${prod.name}`, action: `${n} customers returned "${prod.name}" for size issues (${a} lost). Add measurements in cm and request supplier ships 1 size up on flagged orders.` },
      'Damaged': { title: `Improve packaging: ${prod.name}`, action: `${n} items arrived damaged (${a} lost). Switch to double-walled boxes and add Fragile labels for "${prod.name}".` },
      'Quality': { title: `Quality review: ${prod.name}`, action: `${n} refunds for quality issues on "${prod.name}" (${a} lost). Contact supplier for a formal quality review and inspect next shipment before shipping.` },
      'Not as described': { title: `Update listing: ${prod.name}`, action: `${n} customers said "${prod.name}" looked different in person (${a} lost). Add natural-light photos and a color accuracy disclaimer.` },
      'Changed mind': { title: `Offer exchanges: ${prod.name}`, action: `${n} changed-mind returns on "${prod.name}" (${a} lost). Auto-email before refund to offer free exchange — converts ~30% of returns.` },
      'Other': { title: `Investigate: ${prod.name}`, action: `${n} refunds on "${prod.name}" (${a} lost). Review order notes for a root cause.` },
    }
    const copy = copies[dom] || copies['Other']
    actions.push({
      id: `pattern-${prod.name.replace(/\s+/g, '-').toLowerCase()}`,
      type: 'pattern',
      priority: n >= 3 ? 'high' : 'medium',
      category: dom,
      product: prod.name,
      refundCount: n,
      totalAmount: a,
      ...copy,
    })
  })
  return actions.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] || 2) - ({ high: 0, medium: 1, low: 2 }[b.priority] || 2))
}

export function buildWeeklyReport(allRefunds: Refund[]): WeeklyReportRow[] {
  const today = new Date(), dow = today.getDay()
  const ws = new Date(today); ws.setDate(today.getDate() - dow); ws.setHours(0, 0, 0, 0)
  return Array.from({ length: 4 }, (_, i) => {
    const wStart = new Date(ws); wStart.setDate(ws.getDate() - i * 7)
    const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate() + 6); wEnd.setHours(23, 59, 59, 999)
    const wr = allRefunds.filter(r => { const d = new Date(r.refundedAt); return d >= wStart && d <= wEnd })
    const amt = wr.reduce((s, r) => s + parseFloat(String(r.refundAmount || 0)), 0)
    const cc: Record<string, number> = {}, pc: Record<string, number> = {}
    wr.forEach(r => { cc[categorizeReason(r.reason)] = (cc[categorizeReason(r.reason)] || 0) + 1; (r.products || []).forEach(p => { pc[p] = (pc[p] || 0) + 1 }) })
    return { label: i === 0 ? 'This week' : i === 1 ? 'Last week' : `${fmtDateShort(wStart.toISOString())} \u2013 ${fmtDateShort(wEnd.toISOString())}`, refundCount: wr.length, totalAmount: amt, topReason: Object.entries(cc).sort((a, b) => b[1] - a[1])[0]?.[0] || null, topProduct: Object.entries(pc).sort((a, b) => b[1] - a[1])[0]?.[0] || null, isCurrentWeek: i === 0 }
  })
}

export function buildMonthlyTrend(allRefunds: Refund[]): { label: string; count: number; amount: number; isCurrentMonth: boolean }[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const mr = allRefunds.filter(r => { const rd = new Date(r.refundedAt); return rd >= d && rd < next })
    return { label: d.toLocaleDateString('en-US', { month: 'short' }), count: mr.length, amount: mr.reduce((s, r) => s + parseFloat(String(r.refundAmount || 0)), 0), isCurrentMonth: i === 5 }
  })
}

export function buildProductMatrix(allRefunds: Refund[]): ProductMatrixRow[] {
  const map: Record<string, { name: string; refunds: Refund[]; amount: number }> = {}
  allRefunds.forEach(r => { (r.products || []).forEach(p => { if (!map[p]) map[p] = { name: p, refunds: [], amount: 0 }; map[p].refunds.push(r); map[p].amount += parseFloat(String(r.refundAmount || 0)) }) })
  return Object.values(map).map(p => ({
    name: p.name, count: p.refunds.length, amount: p.amount,
    avgPct: (p.refunds.reduce((s, r) => s + parseFloat(String(r.refundPct || 0)), 0) / p.refunds.length).toFixed(1),
    topCat: Object.entries(p.refunds.reduce((acc: Record<string, number>, r) => { const c = categorizeReason(r.reason); acc[c] = (acc[c] || 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other',
  })).sort((a, b) => b.count - a.count)
}

export function buildRepeatRefunders(allRefunds: Refund[]): RepeatRefunder[] {
  const map: Record<string, { customer: string; email: string; refunds: Refund[] }> = {}
  allRefunds.forEach(r => { const k = r.customerEmail || r.customer; if (!map[k]) map[k] = { customer: r.customer, email: r.customerEmail, refunds: [] }; map[k].refunds.push(r) })
  return Object.values(map).filter(c => c.refunds.length >= 2).map(c => ({
    ...c, count: c.refunds.length,
    totalAmount: c.refunds.reduce((s, r) => s + parseFloat(String(r.refundAmount || 0)), 0),
    lastRefund: c.refunds.sort((a, b) => new Date(b.refundedAt).getTime() - new Date(a.refundedAt).getTime())[0].refundedAt,
  })).sort((a, b) => b.count - a.count)
}
