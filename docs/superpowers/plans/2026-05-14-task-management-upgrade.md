# Task Management — Action Board Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Action Board from ephemeral in-memory actions to a persistent database-backed task system with member assignment, order/customer linking, and manual task creation.

**Architecture:** New `tasks` table in Supabase → service layer (`lib/services/tasks.ts`) → thin API routes → TanStack hooks (`hooks/tasks/`) → refactored Action Board component. Pattern detection moves from client-side to server-side with dedup via `trigger_key`.

**Tech Stack:** Supabase (PostgreSQL + RLS), Next.js API routes, TanStack React Query, react-hook-form + zod, Tailwind + shadcn components.

**Spec:** `docs/superpowers/specs/2026-05-14-task-management-upgrade-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/20260517_tasks.sql` | Tasks table, indexes, RLS, trigger |
| Create | `types/tasks.ts` | Task, CreateTaskInput, UpdateTaskInput, TaskFilters interfaces |
| Modify | `lib/permissions.ts` | Add `can.viewTasks`, `can.manageTasks`, `can.deleteTasks` |
| Create | `lib/services/tasks.ts` | getTasks, createTask, updateTask, deleteTask, generatePatternTasks |
| Create | `app/api/tasks/route.ts` | GET (list) + POST (create) |
| Create | `app/api/tasks/[id]/route.ts` | PATCH (update) + DELETE (soft-delete) |
| Create | `app/api/tasks/generate/route.ts` | POST (pattern detection → upsert) |
| Create | `hooks/tasks/use-tasks-data.ts` | useTasksQuery, useWorkspaceMembers |
| Create | `hooks/tasks/use-tasks-mutations.ts` | useCreateTask, useUpdateTask, useDeleteTask, useGeneratePatternTasks |
| Create | `hooks/tasks/index.ts` | Barrel re-export |
| Create | `components/shared/modals/create-task-modal.tsx` | Create Task form (react-hook-form + zod) |
| Modify | `components/features/analytics/action-board.tsx` | Refactor to read from useTasksQuery, new card design |
| Modify | `components/features/analytics/analytics-page.tsx` | Remove old pattern generation, wire new hooks |
| Modify | `components/features/inbox/orders-section.tsx` | Add "Create Task" button |
| Modify | `app/inbox/page.tsx` | Import CreateTaskModal, handle `?customer=` query param |
| Remove | Old hooks/routes after migration: `useActionStatuses`, `useUpdateActionStatus` from `hooks/analytics/`, `app/api/analytics/actions/route.ts` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260517_tasks.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================================
-- Tasks table — persistent action board items
-- ============================================================

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,

  -- Content
  title         text not null,
  description   text,
  category      text,
  priority      text not null default 'medium' check (priority in ('high', 'medium', 'low')),

  -- Status flow: open → picked_up → done
  status        text not null default 'open' check (status in ('open', 'picked_up', 'done')),

  -- Assignment
  assigned_to   uuid references public.workspace_members(id) on delete set null,
  picked_up_at  timestamptz,
  completed_at  timestamptz,
  result_note   text,

  -- Links
  shopify_order_id     text,
  shopify_order_name   text,
  shopify_customer_id  text,
  customer_name        text,
  customer_email       text,

  -- Origin
  trigger_type  text not null default 'manual' check (trigger_type in ('manual', 'pattern', 'ai_insight')),
  trigger_key   text,
  created_by    uuid references public.workspace_members(id) on delete set null,

  -- Metadata (for pattern-generated tasks)
  refund_count  int,
  total_amount  numeric,

  -- Soft delete
  deleted_at    timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Indexes
create index idx_tasks_workspace on public.tasks(workspace_id);
create unique index idx_tasks_trigger_key on public.tasks(workspace_id, trigger_key) where trigger_key is not null;
create index idx_tasks_status on public.tasks(workspace_id, status) where deleted_at is null;

-- Auto-update updated_at (reuses shared function from 20260508_workspace_settings)
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- RLS
alter table public.tasks enable row level security;

create policy "tasks_select" on public.tasks for select
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy "tasks_insert" on public.tasks for insert
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy "tasks_update" on public.tasks for update
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- No DELETE policy: hard-deletes are intentionally blocked at RLS level.
-- Soft-delete (setting deleted_at) uses UPDATE, covered by tasks_update.

-- Add cooldown tracking column to workspaces
alter table public.workspaces add column if not exists last_tasks_generated_at timestamptz;

-- Verification
do $$
begin
  assert (select count(*) from information_schema.tables where table_name = 'tasks' and table_schema = 'public') = 1,
    'tasks table was not created';
  raise notice 'tasks migration OK';
end;
$$;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push` or apply via Supabase dashboard SQL editor.
Expected: Migration succeeds, `tasks` table visible in Supabase.

---

## Task 2: TypeScript Types

**Files:**
- Create: `types/tasks.ts`

- [ ] **Step 1: Create the types file**

```typescript
export interface Task {
  id: string
  workspaceId: string
  title: string
  description: string | null
  category: string | null
  priority: 'high' | 'medium' | 'low'
  status: 'open' | 'picked_up' | 'done'
  assignedTo: string | null
  assignedMemberName: string | null
  pickedUpAt: string | null
  completedAt: string | null
  resultNote: string | null
  shopifyOrderId: string | null
  shopifyOrderName: string | null
  shopifyCustomerId: string | null
  customerName: string | null
  customerEmail: string | null
  triggerType: 'manual' | 'pattern' | 'ai_insight'
  triggerKey: string | null
  createdBy: string | null
  refundCount: number | null
  totalAmount: number | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTaskInput {
  title: string
  description?: string
  category?: string
  priority?: 'high' | 'medium' | 'low'
  assignedTo?: string
  shopifyOrderId?: string
  shopifyOrderName?: string
  shopifyCustomerId?: string
  customerName?: string
  customerEmail?: string
}

export interface UpdateTaskInput {
  status?: 'open' | 'picked_up' | 'done'
  assignedTo?: string | null
  resultNote?: string
  title?: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  category?: string
}

export interface TaskFilters {
  status?: 'open' | 'picked_up' | 'done'
  assignee?: string
  priority?: 'high' | 'medium' | 'low'
  limit?: number
  offset?: number
}
```

---

## Task 3: Permissions

**Files:**
- Modify: `lib/permissions.ts:9-38`

- [ ] **Step 1: Add task permissions**

Add these three entries inside the `can` object, after the existing `deleteTags` entry (line 37):

```typescript
  // Tasks — observers can view; agents+ can manage; delete is owner/admin only
  viewTasks:       (_role: Role) => true,
  manageTasks:     (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  deleteTasks:     (role: Role) => ['owner', 'admin'].includes(role),
```

---

## Task 4: Service Layer

**Files:**
- Create: `lib/services/tasks.ts`

This is the core business logic. Read existing pattern from `lib/services/shopify.ts` — pure functions that accept data, return data, throw on error.

- [ ] **Step 1: Create the service file**

```typescript
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

  const { data, error } = await q

  if (error) throw new Error(`Failed to fetch tasks: ${error.message}`)

  // Resolve member display names via workspace_member_details view
  // (PostgREST join gives us the member row, but display_name lives in a view).
  // For simplicity, do a single bulk lookup of assigned member IDs.
  const memberIds = [...new Set((data || []).map(r => r.assigned_to).filter(Boolean))]
  let memberNameMap: Record<string, string> = {}

  if (memberIds.length > 0) {
    const { data: members } = await supabaseAdmin
      .from('workspace_member_details')
      .select('id, display_name, email')
      .in('id', memberIds)

    if (members) {
      memberNameMap = Object.fromEntries(
        members.map(m => [m.id, m.display_name || m.email || 'Unknown'])
      )
    }
  }

  return (data || []).map(row => ({
    ...rowToTask(row),
    assignedMemberName: row.assigned_to ? (memberNameMap[row.assigned_to] ?? null) : null,
  }))
}

export async function createTask(
  workspaceId: string,
  createdBy: string | null,
  input: CreateTaskInput
): Promise<Task> {
  const { data, error } = await supabaseAdmin
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

  if (error) throw new Error(`Failed to create task: ${error.message}`)
  return rowToTask(data)
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

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(row)
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) throw new Error(`Failed to update task: ${error.message}`)
  return rowToTask(data)
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

const GENERATION_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

export async function generatePatternTasks(
  workspaceId: string,
  refunds: Refund[]
): Promise<{ generated: number; skipped: boolean }> {
  // Check cooldown
  const { data: ws } = await supabaseAdmin
    .from('workspaces')
    .select('last_tasks_generated_at')
    .eq('id', workspaceId)
    .single()

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
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit lib/services/tasks.ts` (or check IDE for errors)
Expected: No type errors.

---

## Task 5: API Routes

**Files:**
- Create: `app/api/tasks/route.ts`
- Create: `app/api/tasks/[id]/route.ts`
- Create: `app/api/tasks/generate/route.ts`

- [ ] **Step 1: Create GET + POST route (`app/api/tasks/route.ts`)**

```typescript
import { getAuthContext } from '../../../lib/auth'
import { can } from '../../../lib/permissions'
import { getTasks, createTask } from '../../../lib/services/tasks'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import type { TaskFilters } from '@/types/tasks'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.viewTasks(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const filters: TaskFilters = {}
  const status = searchParams.get('status')
  if (status === 'open' || status === 'picked_up' || status === 'done') filters.status = status
  const priority = searchParams.get('priority')
  if (priority === 'high' || priority === 'medium' || priority === 'low') filters.priority = priority
  const assignee = searchParams.get('assignee')
  if (assignee) filters.assignee = assignee
  const limit = searchParams.get('limit')
  if (limit) filters.limit = parseInt(limit, 10)
  const offset = searchParams.get('offset')
  if (offset) filters.offset = parseInt(offset, 10)

  try {
    const tasks = await getTasks(ctx.workspaceId, filters)
    return NextResponse.json({ tasks })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch tasks'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageTasks(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  try {
    const task = await createTask(ctx.workspaceId, ctx.memberId, body)
    return NextResponse.json({ task }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create task'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create PATCH + DELETE route (`app/api/tasks/[id]/route.ts`)**

```typescript
import { getAuthContext } from '../../../../lib/auth'
import { can } from '../../../../lib/permissions'
import { updateTask, deleteTask } from '../../../../lib/services/tasks'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import type { RouteContext } from '@/types/api'

export async function PATCH(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageTasks(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  try {
    const task = await updateTask(ctx.workspaceId, id, body)
    return NextResponse.json({ task })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update task'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.deleteTasks(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  try {
    await deleteTask(ctx.workspaceId, id)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete task'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create pattern generation route (`app/api/tasks/generate/route.ts`)**

```typescript
import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { can } from '../../../../lib/permissions'
import { generatePatternTasks } from '../../../../lib/services/tasks'
import { getRefunds } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageTasks(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  try {
    // Fetch all refunds (last 365 days) for pattern analysis
    const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    const to = new Date().toISOString().slice(0, 10)
    const refunds = await getRefunds(credentials, { from, to })
    const result = await generatePatternTasks(ctx.workspaceId, refunds)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

**Note:** The function is `getRefunds` from `lib/services/shopify.ts` (line 252). It accepts `(credentials, { from, to })` and returns parsed refund data.

- [ ] **Step 4: Verify routes compile**

Run: `npx next build` (or check IDE for type errors across all 3 route files)
Expected: No type errors.

---

## Task 6: Frontend Hooks

**Files:**
- Create: `hooks/tasks/use-tasks-data.ts`
- Create: `hooks/tasks/use-tasks-mutations.ts`
- Create: `hooks/tasks/index.ts`

- [ ] **Step 1: Create data hooks (`hooks/tasks/use-tasks-data.ts`)**

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import type { Task, TaskFilters } from '@/types/tasks'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters?: TaskFilters) => [...taskKeys.all, 'list', filters ?? {}] as const,
  members: () => ['workspace-members'] as const,
}

export function useTasksQuery(filters?: TaskFilters) {
  const token = useToken()
  return useQuery<Task[]>({
    queryKey: taskKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.priority) params.set('priority', filters.priority)
      if (filters?.assignee) params.set('assignee', filters.assignee)
      if (filters?.limit) params.set('limit', String(filters.limit))
      if (filters?.offset) params.set('offset', String(filters.offset))
      const qs = params.toString()
      const res = await fetch(`/api/tasks${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch tasks')
      const d = await res.json()
      return (d.tasks as Task[]) ?? []
    },
    enabled: !!token,
  })
}

export function useWorkspaceMembers() {
  const token = useToken()
  return useQuery<{ id: string; displayName: string; email: string; role: string }[]>({
    queryKey: taskKeys.members(),
    queryFn: async () => {
      const res = await fetch('/api/workspaces/current/members', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch members')
      const d = await res.json()
      return (d.members || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        displayName: (m.display_name as string) || (m.email as string) || 'Unknown',
        email: m.email as string,
        role: m.role as string,
      }))
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // members don't change often
  })
}
```

- [ ] **Step 2: Create mutation hooks (`hooks/tasks/use-tasks-mutations.ts`)**

```typescript
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { taskKeys } from './use-tasks-data'
import type { CreateTaskInput, UpdateTaskInput } from '@/types/tasks'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useCreateTask() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to create task')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useUpdateTask() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTaskInput & { id: string }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to update task')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useDeleteTask() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to delete task')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useGeneratePatternTasks() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tasks/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Generation failed')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}
```

- [ ] **Step 3: Create barrel export (`hooks/tasks/index.ts`)**

```typescript
export * from './use-tasks-data'
export * from './use-tasks-mutations'
```

---

## Task 7: Create Task Modal

**Files:**
- Create: `components/shared/modals/create-task-modal.tsx`

- [ ] **Step 1: Create the modal component**

Uses `react-hook-form` + `zodResolver` per CLAUDE.md rule 11. Uses shadcn `Dialog`, `Input`, `Button` components. Member list from `useWorkspaceMembers()`.

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Package } from 'lucide-react'
import { useCreateTask, useWorkspaceMembers } from '@/hooks/tasks'
import type { CreateTaskInput } from '@/types/tasks'

const CATEGORIES = ['Sizing', 'Quality', 'Damaged', 'Wrong Item', 'Late Delivery', 'Other'] as const

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  category: z.string().optional(),
  assignedTo: z.string().optional(),
})

type FormValues = z.infer<typeof createTaskSchema>

interface LinkedOrder {
  shopifyOrderId: string
  shopifyOrderName: string
  shopifyCustomerId?: string
  customerName?: string
  customerEmail?: string
}

interface CreateTaskModalProps {
  linkedOrder?: LinkedOrder | null
  onClose: () => void
  onSuccess?: (msg: string, type?: 'success' | 'error') => void
}

export function CreateTaskModal({ linkedOrder, onClose, onSuccess }: CreateTaskModalProps) {
  const createTask = useCreateTask()
  const { data: members } = useWorkspaceMembers()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { priority: 'medium' },
  })

  async function onSubmit(values: FormValues) {
    const input: CreateTaskInput = {
      ...values,
      ...(linkedOrder && {
        shopifyOrderId: linkedOrder.shopifyOrderId,
        shopifyOrderName: linkedOrder.shopifyOrderName,
        shopifyCustomerId: linkedOrder.shopifyCustomerId,
        customerName: linkedOrder.customerName,
      }),
    }

    try {
      await createTask.mutateAsync(input)
      onSuccess?.('Task created', 'success')
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create task'
      onSuccess?.(msg, 'error')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
          {/* Title */}
          <div>
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
              Title
            </label>
            <Input
              {...register('title')}
              placeholder="e.g. Investigate sizing complaints on Nike Air Max"
              className="bg-secondary border border-border"
            />
            {errors.title && (
              <p className="text-[11px] text-destructive mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
              Description
            </label>
            <textarea
              {...register('description')}
              placeholder="Optional details..."
              className="w-full resize-y rounded-xl border border-border bg-secondary px-3.5 py-[11px] text-[13.5px] text-foreground outline-none min-h-[60px]"
            />
          </div>

          {/* Priority + Category row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
                Priority
              </label>
              <select
                {...register('priority')}
                className="w-full rounded-xl border border-border bg-secondary px-3.5 py-[11px] text-[13.5px] text-foreground outline-none cursor-pointer"
              >
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
                Category
              </label>
              <select
                {...register('category')}
                className="w-full rounded-xl border border-border bg-secondary px-3.5 py-[11px] text-[13.5px] text-foreground outline-none cursor-pointer"
              >
                <option value="">Select...</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assign to */}
          <div>
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
              Assign to
            </label>
            <select
              {...register('assignedTo')}
              className="w-full rounded-xl border border-border bg-secondary px-3.5 py-[11px] text-[13.5px] text-foreground outline-none cursor-pointer"
            >
              <option value="">Unassigned</option>
              {(members || []).map(m => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.role})
                </option>
              ))}
            </select>
          </div>

          {/* Linked order (pre-filled from inbox) */}
          {linkedOrder && (
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
                Linked order
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                <Package size={14} className="text-primary" />
                <span className="text-[12px] font-semibold text-primary">
                  {linkedOrder.shopifyOrderName}
                </span>
                {linkedOrder.customerName && (
                  <>
                    <span className="text-[12px] text-muted-foreground">·</span>
                    <span className="text-[12px] text-foreground-2">{linkedOrder.customerName}</span>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Task 8: Refactor Action Board

**Files:**
- Modify: `components/features/analytics/action-board.tsx` (full rewrite)
- Modify: `components/features/analytics/analytics-page.tsx`

This is the largest task — the Action Board changes from prop-driven to hook-driven, and the card design gets the compact layout with member assignment and order links.

- [ ] **Step 1: Rewrite `action-board.tsx`**

Replace the entire file. Key changes:
- Remove all props except `demoMode` (for demo data fallback)
- Use `useTasksQuery()` for data
- Use `useUpdateTask()` for status changes
- Use `useWorkspaceMembers()` for assignee dropdown
- Add "+ New Task" button that opens CreateTaskModal
- New card design: compact with order link row + member avatar
- Clicking order link navigates to `/inbox?customer={shopifyCustomerId}`

The component should import from `@/hooks/tasks` and `@/types/tasks`. Keep the existing `CatBadge` sub-component (export it). Keep the existing tab structure (Open / Picked Up / Done). Keep the progress bar.

Refer to the existing file at `components/features/analytics/action-board.tsx` for the current styling patterns — the new version should match the visual language (rounded cards, subtle borders, glassmorphic bg) but add the order link row and member avatar.

Use `next/navigation`'s `useRouter` for the order link click handler: `router.push(\`/inbox?customer_email=\${encodeURIComponent(task.customerEmail)}\`)`. Only render the link when `task.customerEmail` is present.

**Important:** This is a full rewrite of the component. Read the existing file thoroughly before writing, and preserve the `CatBadge` export that is imported by other files (check with grep first).

- [ ] **Step 2: Update `analytics-page.tsx`**

Changes needed:
1. Remove imports: `generatePatternActions`, `generateRepeatRefunderActions` from `@/lib/analytics-constants`
2. Remove imports: `useActionStatuses` from `@/hooks/analytics/use-analytics-data`
3. Remove imports: `useUpdateActionStatus` from `@/hooks/analytics/use-analytics-mutations`
4. Remove imports: `PatternAction`, `AiInsight` types (no longer needed for ActionBoard)
5. Remove: `actionStatusesQuery`, `updateActionStatus`, `actionStatuses`, `patternActions`, `actionLoaded`, `usingFallback` variables
6. Remove: `handleStatusChange` function
7. Add import: `useGeneratePatternTasks` from `@/hooks/tasks`
8. Add: call `useGeneratePatternTasks` and fire `mutate()` in a `useEffect` on mount (fires once per page load, server-side cooldown handles throttling)
9. Simplify `<ActionBoard />` — pass only `demoMode={demoMode}` instead of the current 7 props

```typescript
// Add near the top of AnalyticsContent:
const generateTasks = useGeneratePatternTasks()

// Add useEffect after queries:
useEffect(() => {
  if (!demoMode) generateTasks.mutate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [demoMode])
```

Replace the `<ActionBoard ... />` JSX with:
```typescript
<ActionBoard demoMode={demoMode} />
```

- [ ] **Step 3: Verify everything renders**

Run: `npm run dev` and navigate to the Analytics page.
Expected: Action Board renders with tasks from the database (empty if no tasks exist yet). "+ New Task" button visible. Tabs work.

---

## Task 9: Inbox Integration

**Files:**
- Modify: `components/features/inbox/orders-section.tsx`
- Modify: `app/inbox/page.tsx`

- [ ] **Step 1: Add "Create Task" button to orders section**

In `components/features/inbox/orders-section.tsx`, add a "Create Task" button alongside the existing Cancel / Refund / Duplicate buttons. Find the action buttons section (around line 175-213) and add a new button after the Duplicate button:

```typescript
// Add import at top:
import { ClipboardList } from 'lucide-react'

// Add button after the Duplicate button (around line 190):
<button
  className="inline-flex items-center gap-1 text-[11px] font-medium px-[9px] py-1 rounded-md border border-border bg-card text-foreground cursor-pointer transition-all hover:border-(--border-hover) hover:bg-secondary"
  onClick={() => setModal({
    type: 'create-task',
    order,
  })}
>
  <ClipboardList size={11} />
  Task
</button>
```

The `setModal` function and modal type need to support `'create-task'`. Check how `setModal` is typed in the inbox UI store (`stores/inbox-ui.ts`) and add `'create-task'` to the modal type union if needed.

**Important:** The `OrdersSection` component receives orders from `customer?.orders` in the `CustomerSidebar`. The customer context (email, name) is available in the parent `CustomerSidebar` but NOT on the order object itself. The `setModal` call needs to include customer data from the parent scope. There are two approaches:

**Approach A (preferred):** Add `customerEmail` and `customerName` props to `OrdersSection` so it can pass them into `setModal`.
**Approach B:** Extend the `setModal` payload type to include extra fields beyond `order`.

Use Approach A — add `customerEmail?: string` and `customerName?: string` to `OrdersSectionProps`, pass them from `CustomerSidebar` where `customer.customer.email` and the computed `customerName` are available.

- [ ] **Step 2: Handle CreateTaskModal in inbox page**

In `app/inbox/page.tsx`:
1. Add import: `import { CreateTaskModal } from '@/components/shared/modals/create-task-modal'`
2. Add a new modal case in the modal rendering section (find where CancelModal, RefundModal etc. are rendered):

```typescript
{modal?.type === 'create-task' && modal.order && (
  <CreateTaskModal
    linkedOrder={{
      shopifyOrderId: String(modal.order.id),
      shopifyOrderName: modal.order.name || `#${modal.order.id}`,
      shopifyCustomerId: modal.customerEmail || undefined,
      customerName: modal.customerName || undefined,
    }}
    onClose={() => setModal(null)}
    onSuccess={(msg) => sonnerToast.success(msg)}
  />
)}
```

**Note:** `modal.customerEmail` and `modal.customerName` come from the extended modal payload. Update the modal type in `stores/inbox-ui.ts` to support these extra fields on the `create-task` type.

- [ ] **Step 3: Add `?customer=` query param handling to inbox page**

In `app/inbox/page.tsx`, the `searchParams` from `useSearchParams()` is already available (line 31). Add logic to auto-select a conversation when `customer` param is present.

**Important:** The `Thread` type has `customer_email` (not `shopifyCustomerId`). The task card links should navigate using email: `/inbox?customer_email={email}`. The inbox then matches on `customer_email`:

```typescript
// After the existing useSearchParams() line:
const customerEmailParam = searchParams?.get('customer_email')

// In a useEffect, after conversations are loaded:
useEffect(() => {
  if (customerEmailParam && conversations?.length) {
    const match = conversations.find(
      (t: Thread) => t.customer_email === customerEmailParam
    )
    if (match) {
      setSelectedThreadId(match.id)
    }
  }
}, [customerEmailParam, conversations, setSelectedThreadId])
```

This also means the task card's order link should navigate to `/inbox?customer_email={email}` instead of `/inbox?customer={shopifyCustomerId}`. The `Task` type stores `customerName` (denormalized) but for inbox linking we need the email. Two options:

**Option A (recommended):** Add a `customerEmail` field to the `tasks` table and `Task` type. Store the customer email at task creation time (available from the inbox context and from refund data). This is a small schema addition.
**Option B:** Use the Shopify customer ID and have the inbox look up conversations by querying the Shopify API first. Over-engineered.

Use Option A — add `customer_email text` to the tasks table (Task 1) and `customerEmail: string | null` to the `Task` type (Task 2). Update the service layer and Create Task modal accordingly.

- [ ] **Step 4: Verify inbox integration**

Run: `npm run dev`, navigate to Inbox, open an order in the customer panel.
Expected: "Task" button visible alongside Cancel/Refund/Duplicate. Clicking it opens Create Task modal with order data pre-filled.

---

## Task 10: Cleanup Old System

**Files:**
- Modify: `hooks/analytics/use-analytics-data.ts` — remove `useActionStatuses`
- Modify: `hooks/analytics/use-analytics-mutations.ts` — remove `useUpdateActionStatus`
- Delete or deprecate: `app/api/analytics/actions/route.ts`
- Clean: `lib/analytics-constants.ts` — keep `categorizeReason` and `BADGE_COLORS` (still used), but `generatePatternActions` and `generateRepeatRefunderActions` can be removed since they're now in `lib/services/tasks.ts`

- [ ] **Step 1: Remove unused hooks from analytics**

In `hooks/analytics/use-analytics-data.ts`:
- Remove the `actionStatuses` key from `analyticsKeys`
- Remove the `useActionStatuses` function entirely

In `hooks/analytics/use-analytics-mutations.ts`:
- Remove the `useUpdateActionStatus` function and the `UpdateActionStatusParams` interface
- If this file becomes empty, remove it and update the barrel export

- [ ] **Step 2: Remove old analytics actions API route**

Delete `app/api/analytics/actions/route.ts` — the `tasks` API routes replace it entirely.

- [ ] **Step 3: Remove client-side pattern generation from analytics-constants**

In `lib/analytics-constants.ts`:
- Remove `generatePatternActions` function
- Remove `generateRepeatRefunderActions` function
- Keep `categorizeReason`, `BADGE_COLORS`, `fmtEur`, `RANGES`, `getDateRange`, `getPrevDateRange` — these are still used

- [ ] **Step 4: Verify no broken imports**

Run: `npx next build`
Expected: Build succeeds with no import errors.

---

## Task 11: End-to-End Verification

- [ ] **Step 1: Manual test — Create task from Action Board**

1. Navigate to Analytics page
2. Click "+ New Task" in the Action Board header
3. Fill in title, priority, category, assign to a member
4. Submit → task appears in the Open tab
5. Click "Pick Up" → task moves to Picked Up tab
6. Click "Mark Done" → task moves to Done tab
7. Click "Re-open" → task returns to Open tab

- [ ] **Step 2: Manual test — Create task from Inbox**

1. Navigate to Inbox
2. Open a conversation with orders in the sidebar
3. Click "Task" on an order
4. Verify order number + customer name are pre-filled
5. Submit → task created

- [ ] **Step 3: Manual test — Task card links to Inbox**

1. On a task card with a linked order, click the order number
2. Verify navigation to `/inbox?customer={id}`
3. Verify the correct conversation / customer panel opens

- [ ] **Step 4: Manual test — Pattern generation**

1. Navigate to Analytics page (with Shopify connected and refund data)
2. Verify pattern-generated tasks appear automatically
3. Reload page — verify no duplicates (dedup via trigger_key)
4. Reload within 5 minutes — verify cooldown works (no regeneration)

- [ ] **Step 5: Manual test — Permissions**

1. Log in as an observer role
2. Verify the Action Board is visible (read-only)
3. Verify "+ New Task" button is hidden
4. Verify Pick Up / Mark Done buttons are hidden
