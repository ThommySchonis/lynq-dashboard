# Task Management System — Action Board Upgrade

**Date:** 2026-05-14
**Status:** Approved
**Scope:** Upgrade the existing Action Board on the analytics page from ephemeral in-memory actions to a persistent, database-backed task management system with member assignment, order/customer linking, and manual task creation.

## Context

The analytics page has an Action Board component (`components/features/analytics/action-board.tsx`) that displays tasks generated from refund pattern detection and AI insights. Current limitations:

- Tasks are ephemeral — generated on-the-fly from refund data each page load
- Status is stored in localStorage with API fallback
- Assignment is a freeform text input (no workspace member integration)
- No link to specific Shopify orders or customers
- No way to create tasks manually
- No persistent history of completed tasks

The three task specs (`tasks/task-management.md`, `tasks/task-generator-engine.md`, `tasks/task-statuses-validator.md`) describe the target state. This design covers Phase 1: board UI + manual creation + persistent storage. Automation triggers (complaints, high-risk orders) are deferred to a future phase.

## Database

### `tasks` table

```sql
create table tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id),

  -- Content
  title         text not null,
  description   text,
  category      text,
  priority      text default 'medium' check (priority in ('high', 'medium', 'low')),

  -- Status flow: open → picked_up → done
  status        text default 'open' check (status in ('open', 'picked_up', 'done')),

  -- Assignment
  assigned_to   uuid references workspace_members(id),
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
  trigger_type  text default 'manual' check (trigger_type in ('manual', 'pattern', 'ai_insight')),
  trigger_key   text,
  created_by    uuid references workspace_members(id),

  -- Metadata (for pattern-generated tasks)
  refund_count  int,
  total_amount  numeric,

  -- Soft delete
  deleted_at    timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Workspace scoping index
create index idx_tasks_workspace on tasks(workspace_id);
-- Dedup index for auto-generated tasks
create unique index idx_tasks_trigger_key on tasks(workspace_id, trigger_key) where trigger_key is not null;
-- Status filter index
create index idx_tasks_status on tasks(workspace_id, status) where deleted_at is null;

-- Auto-update updated_at (reuses shared function from billing migration)
create trigger tasks_updated_at
  before update on tasks
  for each row
  execute function public.set_updated_at();

-- RLS
alter table tasks enable row level security;

create policy "tasks_select" on tasks for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "tasks_insert" on tasks for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "tasks_update" on tasks for update
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- No DELETE policy: hard-deletes are intentionally blocked at the RLS level.
-- The application uses soft-delete (setting deleted_at) via UPDATE, which is covered by tasks_update.
```

Key decisions:

- **`trigger_key`** with a unique partial index prevents duplicate auto-generated tasks for the same pattern. Manual tasks have `trigger_key = null` and are unaffected by the constraint.
- **`assigned_to`** references `workspace_members(id)` — assignment is tied to real team members.
- **`created_by`** references `workspace_members(id)` — tracks who created the task (distinct from assignee). Set to `null` for auto-generated tasks.
- **Denormalized `customer_name` and `shopify_order_name`** avoid joins for card display.
- **`trigger_type`** distinguishes manual tasks from pattern-generated and AI insight tasks.
- **Soft delete** via `deleted_at` — tasks are never hard-deleted. All queries filter `WHERE deleted_at IS NULL`.
- **RLS policies** scope all operations to workspace members. The `supabaseAdmin` client bypasses RLS for server-side operations, but policies protect against direct Supabase access.
- **`updated_at` trigger** uses `moddatetime` to auto-update on every row change.

### Trigger key format

| trigger_type | Format | Example |
|---|---|---|
| `pattern` | `pattern:{category}:{product_slug}:{YYYY-MM}` | `pattern:Sizing:nike-air-max-90:2026-05` |
| `ai_insight` | `ai:{category_slug}:{YYYY-MM}` | `ai:sizing-issues:2026-05` |
| `manual` | `null` (no dedup) | — |

The month component (`YYYY-MM`) means the same pattern in a new month creates a new task. This matches the analytics date range behavior — each period gets its own action items.

## Authorization

Task operations are gated by workspace role via `lib/permissions.ts`:

| Operation | Allowed roles |
|---|---|
| View tasks | owner, admin, agent, observer |
| Create task | owner, admin, agent |
| Pick up / assign task | owner, admin, agent |
| Mark done / re-open | owner, admin, agent |
| Delete task (soft) | owner, admin |

Add `can.viewTasks` and `can.manageTasks` to `lib/permissions.ts`. Observers can see the board but cannot interact with it.

## API Layer

### Service file: `lib/services/tasks.ts`

| Function | Purpose |
|---|---|
| `getTasks(workspaceId, filters?)` | List tasks where `deleted_at IS NULL`, filterable by status, assignee, priority. Default limit: 100, supports `offset` for pagination. |
| `createTask(workspaceId, createdBy, data)` | Insert a new task (manual or auto-generated) |
| `updateTask(workspaceId, id, updates)` | Update any mutable field: status, assigned_to, result_note, title, description, priority, category. Sets `picked_up_at` on transition to `picked_up`, `completed_at` on transition to `done`. |
| `deleteTask(workspaceId, id)` | Soft-delete: set `deleted_at = now()` |
| `generatePatternTasks(workspaceId, credentials)` | Run pattern detection on refund data, upsert tasks using `trigger_key` for dedup (`INSERT ... ON CONFLICT DO NOTHING`). Skips generation if last run was < 5 minutes ago (tracked via a `last_tasks_generated_at timestamptz` column added to the `workspaces` table). |

### API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/tasks` | List tasks (query params: status, assignee, priority, limit, offset) |
| POST | `/api/tasks` | Create task (manual or from inbox) |
| PATCH | `/api/tasks/[id]` | Update task fields (status, assignment, title, description, priority, category, result_note) |
| DELETE | `/api/tasks/[id]` | Soft-delete task |
| POST | `/api/tasks/generate` | Trigger pattern detection → upsert tasks (5-min cooldown per workspace) |

All routes follow the standard pattern: `getAuthContext()` → permission check → service function → JSON response. The `generate` route also requires Shopify credentials.

### Frontend hooks: `hooks/tasks/`

Following `hooks/<feature>/` convention with barrel re-export:

**`hooks/tasks/use-tasks-data.ts`:**

| Hook | Type | Purpose |
|---|---|---|
| `useTasksQuery(filters?)` | `useQuery` | Fetch task list |

**`hooks/tasks/use-tasks-mutations.ts`:**

| Hook | Type | Purpose |
|---|---|---|
| `useCreateTask()` | `useMutation` | Create task → invalidate tasks query |
| `useUpdateTask()` | `useMutation` | Update task → invalidate tasks query |
| `useDeleteTask()` | `useMutation` | Soft-delete → invalidate tasks query |
| `useGeneratePatternTasks()` | `useMutation` | Trigger pattern generation |

**`hooks/tasks/index.ts`:** Barrel re-export.

Query keys defined as `TaskKeys` object in `use-tasks-data.ts`.

### Types: `types/tasks.ts`

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
  assignedMemberName: string | null  // joined from workspace_members for display
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

## UI Changes

### Action Board upgrade

The existing `ActionBoard` component is refactored:

- **Data source changes:** Instead of receiving `patternActions` and `aiInsights` as props, the board reads from `useTasksQuery()`. The analytics page calls `useGeneratePatternTasks()` on load to ensure pattern tasks are up-to-date (with 5-min server-side cooldown).
- **Card design (compact style):** Each task card shows:
  - Priority badge (URGENT for high) + category badge + impact stats (for pattern tasks)
  - Title + description
  - Linked order row: clickable order number (`#1042`) + customer name in a subtle background row. Clicking navigates to the inbox with that customer's context.
  - Assignment: member avatar + name (from workspace_members dropdown). Pick Up / Mark Done / Re-open buttons for status transitions.
- **Board header:** "+ New Task" button opens the Create Task modal. Visible to owner/admin/agent roles only.
- **Tabs remain:** Open / Picked Up / Done with counts and progress bar.

### Create Task modal

A new `components/shared/modals/create-task-modal.tsx`. Uses `react-hook-form` with `zodResolver` and a zod schema for validation:

```typescript
const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  category: z.string().optional(),
  assignedTo: z.string().optional(), // workspace_member ID
})
```

Linked order data (`shopifyOrderId`, `shopifyOrderName`, `shopifyCustomerId`, `customerName`) is passed as props to the modal and included in the mutation payload — not part of the form schema since it's pre-filled and not user-editable.

| Field | Type | Notes |
|---|---|---|
| Title | Text input | Required |
| Description | Textarea | Optional |
| Priority | Select (High / Medium / Low) | Default: Medium |
| Category | Select (Sizing, Quality, Damaged, Wrong Item, Late Delivery, Other) | Optional |
| Assign to | Select (workspace members) | Default: Unassigned |
| Linked order | Pre-filled display with remove button | Only shown when pre-filled from inbox |

**Entry points:**
1. Action Board header — "+ New Task" button. All fields empty.
2. Inbox orders panel — "Create Task" button on each order (alongside Cancel / Refund / Duplicate). Pre-fills order + customer data.

### Inbox orders panel

A "Create Task" button is added to the action buttons row in `components/features/inbox/orders-section.tsx` for each order. It opens the Create Task modal with order + customer data pre-filled.

### Task card → Inbox navigation

Clicking the order link on a task card navigates to `/inbox?customer_email={email}`. This requires the inbox page to support a `customer_email` query parameter:

- On load, if `customer_email` param is present, find the first conversation matching that `customer_email` and select it (opens customer sidebar with orders).
- If no conversation exists for that customer, show an empty state with the customer panel open (orders visible via Shopify API lookup).
- This is new behavior for the inbox — the implementation must add query param handling to the inbox page.
- **Note:** The `Thread` type has `customer_email` (not `shopifyCustomerId`), so linking is email-based. The `tasks` table includes a `customer_email` column for this purpose.

## Pattern Detection Migration

### Current flow (removed)
1. Analytics page loads → `generatePatternActions()` + `generateRepeatRefunderActions()` run client-side
2. Returns in-memory `PatternAction[]` objects
3. Status stored in localStorage / `useActionStatuses()` API

### New flow
1. Analytics page loads → calls `POST /api/tasks/generate` (mutation, fires once per load, 5-min server-side cooldown)
2. Server-side: `generatePatternTasks()` runs the same detection logic against refund data from the database
3. Each pattern gets a `trigger_key` — upsert uses `ON CONFLICT DO NOTHING`
4. AI insights also become tasks with `trigger_type: 'ai_insight'`
5. Board reads all tasks via `GET /api/tasks`

### What gets removed
- `generatePatternActions()` and `generateRepeatRefunderActions()` move from client-side (`analytics-page.tsx`) to `lib/services/tasks.ts`
- localStorage fallback for action statuses is deleted
- `useActionStatuses()` and `useUpdateActionStatus()` hooks are replaced by task hooks
- `ActionBoard` props simplify — no longer receives `patternActions` + `aiInsights` arrays

## Out of Scope (Future Phases)

- **Auto-assignment rules** — configurable rules for routing tasks to specific members
- **Additional triggers** — customer complaints, high-risk orders, repeated refund patterns detected in real-time
- **Task status validator** — automated status transition rules
- **Related tasks in inbox sidebar** — mini task list in the customer panel
- **Notifications** — alerting assigned members of new tasks
- **Category constraint** — category is freeform text for now; a CHECK constraint can be added once categories stabilize through usage
