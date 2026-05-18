import { supabaseAdmin } from '../supabaseAdmin'
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from '@/types/tasks'
import type { Refund } from '@/types/analytics'
import { categorizeReason } from '../analytics-constants'

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '')
}

/** Convert a snake_case DB row to camelCase Task. */
function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    category: (row.category as string) ?? null,
    priority: row.priority as Task['priority'],
    status: row.status as Task['status'],
    assignedTo: (row.assigned_to as string) ?? null,
    assignedMemberName: (row.member_name as string) ?? null,
    pickedUpAt: (row.picked_up_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    resultNote: (row.result_note as string) ?? null,
    shopifyOrderId: (row.shopify_order_id as string) ?? null,
    shopifyOrderName: (row.shopify_order_name as string) ?? null,
    shopifyCustomerId: (row.shopify_customer_id as string) ?? null,
    customerName: (row.customer_name as string) ?? null,
    customerEmail: (row.customer_email as string) ?? null,
    triggerType: row.trigger_type as Task['triggerType'],
    triggerKey: (row.trigger_key as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    refundCount: (row.refund_count as number) ?? null,
    totalAmount: (row.total_amount as number) ?? null,
    deletedAt: (row.deleted_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getTasks(workspaceId: string, filters: TaskFilters = {}): Promise<Task[]> {
  const limit = Math.min(filters.limit ?? 100, 200)
  const offset = filters.offset ?? 0

  let q = supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters.status) q = q.eq('status', filters.status)
  if (filters.priority) q = q.eq('priority', filters.priority)
  if (filters.assignee) q = q.eq('assigned_to', filters.assignee)

  const queryResult = await q

  if (queryResult.error) throw new Error(`Failed to fetch tasks: ${queryResult.error.message}`)

  type TaskRow = Record<string, unknown>
  const rows = (queryResult.data as TaskRow[]) || []

  // Resolve member display names via workspace_member_details view
  const memberIds = [...new Set(rows.map(r => r.assigned_to as string | null).filter(Boolean))] as string[]
  let memberNameMap: Record<string, string> = {}

  if (memberIds.length > 0) {
    const membersResult = await supabaseAdmin
      .from('workspace_member_details')
      .select('id, display_name, email')
      .in('id', memberIds)

    const members = membersResult.data as Array<{ id: string; display_name?: string; email?: string }> | null
    if (members) {
      memberNameMap = Object.fromEntries(
        members.map(m => [m.id, m.display_name || m.email || 'Unknown'])
      )
    }
  }

  return rows.map(row => ({
    ...rowToTask(row),
    assignedMemberName: (row.assigned_to as string | null) ? (memberNameMap[row.assigned_to as string] ?? null) : null,
  }))
}

export async function createTask(
  workspaceId: string,
  createdBy: string | null,
  input: CreateTaskInput
): Promise<Task> {
  const createResult = await supabaseAdmin
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      created_by: createdBy,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      priority: input.priority ?? 'medium',
      assigned_to: input.assignedTo ?? null,
      shopify_order_id: input.shopifyOrderId ?? null,
      shopify_order_name: input.shopifyOrderName ?? null,
      shopify_customer_id: input.shopifyCustomerId ?? null,
      customer_name: input.customerName ?? null,
      customer_email: input.customerEmail ?? null,
      trigger_type: 'manual',
    })
    .select()
    .single()

  if (createResult.error) throw new Error(`Failed to create task: ${createResult.error.message}`)
  return rowToTask(createResult.data as Record<string, unknown>)
}

export async function updateTask(
  workspaceId: string,
  taskId: string,
  updates: UpdateTaskInput
): Promise<Task> {
  const row: Record<string, unknown> = {}

  if (updates.title !== undefined) row.title = updates.title
  if (updates.description !== undefined) row.description = updates.description
  if (updates.category !== undefined) row.category = updates.category
  if (updates.priority !== undefined) row.priority = updates.priority
  if (updates.assignedTo !== undefined) row.assigned_to = updates.assignedTo
  if (updates.resultNote !== undefined) row.result_note = updates.resultNote

  if (updates.status !== undefined) {
    row.status = updates.status
    if (updates.status === 'picked_up') row.picked_up_at = new Date().toISOString()
    if (updates.status === 'done') row.completed_at = new Date().toISOString()
    if (updates.status === 'open') {
      row.picked_up_at = null
      row.completed_at = null
    }
  }

  const updateResult = await supabaseAdmin
    .from('tasks')
    .update(row)
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .select()
    .single()

  if (updateResult.error) throw new Error(`Failed to update task: ${updateResult.error.message}`)
  return rowToTask(updateResult.data as Record<string, unknown>)
}

export async function deleteTask(workspaceId: string, taskId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)

  if (error) throw new Error(`Failed to delete task: ${error.message}`)
}

// ── Pattern Generation ───────────────────────────────────────────────────────

interface WorkspaceCooldownRow {
  last_tasks_generated_at?: string | null
}

const GENERATION_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

export async function generatePatternTasks(
  workspaceId: string,
  refunds: Refund[]
): Promise<{ generated: number; skipped: boolean }> {
  // Check cooldown
  const wsResult = await supabaseAdmin
    .from('workspaces')
    .select('last_tasks_generated_at')
    .eq('id', workspaceId)
    .single()

  const ws = wsResult.data as WorkspaceCooldownRow | null
  if (ws?.last_tasks_generated_at) {
    const elapsed = Date.now() - new Date(ws.last_tasks_generated_at).getTime()
    if (elapsed < GENERATION_COOLDOWN_MS) {
      return { generated: 0, skipped: true }
    }
  }

  // Generate pattern actions (same logic as client-side generatePatternActions)
  const patternTasks = buildPatternTasks(refunds)
  const repeatTasks = buildRepeatRefunderTasks(refunds)
  const allTasks = [...patternTasks, ...repeatTasks]

  let generated = 0
  for (const task of allTasks) {
    const { error } = await supabaseAdmin
      .from('tasks')
      .upsert(
        {
          workspace_id: workspaceId,
          trigger_key: task.triggerKey,
          trigger_type: task.triggerType,
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          refund_count: task.refundCount,
          total_amount: task.totalAmount,
        },
        { onConflict: 'workspace_id,trigger_key', ignoreDuplicates: true }
      )

    if (!error) generated++
  }

  // Update cooldown timestamp
  await supabaseAdmin
    .from('workspaces')
    .update({ last_tasks_generated_at: new Date().toISOString() })
    .eq('id', workspaceId)

  return { generated, skipped: false }
}

// ── Pattern detection logic (migrated from lib/analytics-constants.ts) ───────

interface GeneratedTask {
  triggerKey: string
  triggerType: 'pattern' | 'ai_insight'
  title: string
  description: string
  category: string
  priority: 'high' | 'medium' | 'low'
  refundCount: number
  totalAmount: number
}

function fmtEur(n: number): string {
  return `€${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function buildPatternTasks(refunds: Refund[]): GeneratedTask[] {
  const map: Record<string, { name: string; refunds: Refund[]; catCounts: Record<string, number> }> = {}
  refunds.forEach(r => {
    const cat = categorizeReason(r.reason)
    ;(r.products || []).forEach(p => {
      if (!map[p]) map[p] = { name: p, refunds: [], catCounts: {} }
      map[p].refunds.push(r)
      map[p].catCounts[cat] = (map[p].catCounts[cat] || 0) + 1
    })
  })

  const tasks: GeneratedTask[] = []
  const month = currentMonth()

  Object.values(map).forEach(prod => {
    if (prod.refunds.length < 2) return
    const dom = Object.entries(prod.catCounts).sort((a, b) => b[1] - a[1])[0][0]
    const amt = prod.refunds.reduce((s, r) => s + parseFloat(String(r.refundAmount || 0)), 0)
    const n = prod.refunds.length
    const a = fmtEur(amt)
    const slug = slugify(prod.name)

    const copies: Record<string, { title: string; desc: string }> = {
      'Sizing': { title: `Fix size guide: ${prod.name}`, desc: `${n} customers returned "${prod.name}" for size issues (${a} lost). Add measurements in cm and request supplier ships 1 size up on flagged orders.` },
      'Damaged': { title: `Improve packaging: ${prod.name}`, desc: `${n} items arrived damaged (${a} lost). Switch to double-walled boxes and add Fragile labels for "${prod.name}".` },
      'Quality': { title: `Quality review: ${prod.name}`, desc: `${n} refunds for quality issues on "${prod.name}" (${a} lost). Contact supplier for a formal quality review and inspect next shipment before shipping.` },
      'Not as described': { title: `Update listing: ${prod.name}`, desc: `${n} customers said "${prod.name}" looked different in person (${a} lost). Add natural-light photos and a color accuracy disclaimer.` },
      'Changed mind': { title: `Offer exchanges: ${prod.name}`, desc: `${n} changed-mind returns on "${prod.name}" (${a} lost). Auto-email before refund to offer free exchange — converts ~30% of returns.` },
      'Other': { title: `Investigate: ${prod.name}`, desc: `${n} refunds on "${prod.name}" (${a} lost). Review order notes for a root cause.` },
    }
    const copy = copies[dom] || copies['Other']

    tasks.push({
      triggerKey: `pattern:${dom}:${slug}:${month}`,
      triggerType: 'pattern',
      title: copy.title,
      description: copy.desc,
      category: dom,
      priority: n >= 3 ? 'high' : 'medium',
      refundCount: n,
      totalAmount: amt,
    })
  })

  return tasks
}

function buildRepeatRefunderTasks(refunds: Refund[]): GeneratedTask[] {
  const map: Record<string, { customer: string; email: string; refunds: Refund[]; totalAmount: number }> = {}
  refunds.forEach(r => {
    const k = r.customerEmail || r.customer
    if (!k) return
    if (!map[k]) map[k] = { customer: r.customer, email: r.customerEmail, refunds: [], totalAmount: 0 }
    map[k].refunds.push(r)
    map[k].totalAmount += parseFloat(String(r.refundAmount || 0))
  })

  const month = currentMonth()

  return Object.values(map)
    .filter(c => c.refunds.length >= 2)
    .sort((a, b) => b.refunds.length - a.refunds.length)
    .slice(0, 3)
    .map(c => {
      const name = c.customer || c.email || 'Unknown customer'
      const n = c.refunds.length
      const slug = slugify(c.email || c.customer || 'unknown')

      return {
        triggerKey: `pattern:repeat:${slug}:${month}`,
        triggerType: 'pattern' as const,
        title: `Contact repeat refunder: ${name}`,
        description: `${name} has refunded ${n} times (${fmtEur(c.totalAmount)} total lost). Reach out personally — offer store credit or a free exchange to retain the customer and eliminate chargeback risk.`,
        category: 'Customer Outreach',
        priority: (n >= 3 ? 'high' : 'medium') as 'high' | 'medium',
        refundCount: n,
        totalAmount: c.totalAmount,
      }
    })
}
