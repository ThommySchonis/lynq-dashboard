# Inbox Functionality & Unified Task System Design

**Date:** 2026-04-30
**Status:** Approved
**Covers:** `tasks/inbox-functionallity.md`, `tasks/task-generator-engine.md`, `tasks/task-management.md`, `tasks/task-statuses-validator.md`

---

## Context

The inbox currently stores conversation statuses in localStorage and has no persistent internal notes or cross-client email visibility. A separate `ActionBoard` component in `app/analytics/page.js` generates tasks locally from refund pattern analysis, persisting them via `/api/analytics/actions` with a localStorage fallback. Three task files (`task-generator-engine.md`, `task-management.md`, `task-statuses-validator.md`) share the same underlying requirement: a persistent, rule-driven task system that surfaces actionable signals to agents.

This spec covers:
1. Three inbox gaps: status persistence, internal notes, "All" folder
2. A unified `tasks` Supabase table replacing all local task computation
3. Inline task triggers: AI complaint detection + high-value order detection
4. Scheduled sweep: repeated refund pattern detection
5. Configurable thresholds per client
6. ActionBoard migration to live DB queries

### Existing Infrastructure Relevant to This Spec

- `app/inbox/page.js` — statuses stored in `lynq_statuses` localStorage key; `.msg-note` CSS class exists but is unused
- `PATCH /api/email/conversations/[id]` — already exists, updates `email_conversations.status`
- `GET /api/email/conversations` — returns conversation list with folder filtering
- `GET /api/email/conversations/[id]/messages` — returns messages for a conversation; will be extended to include `type` and `agent_name` fields
- `email_messages` table — stores messages per conversation; no `type` or `agent_id` column yet
- `app/analytics/page.js` — contains `ActionBoard` component with Open/Picked Up/Done tabs; tasks generated from local refund analysis; uses `/api/analytics/actions` for persistence
- `shopify_orders` table — has `customer_email`, `client_id`, `subtotal_price`, `refund_amount`, `processed_at` per order; one row per order; `refund_amount` is numeric, defaults to 0 for unrefunded orders
- `clients` table — no `thresholds` column yet
- `agents` table — exists in Supabase with fields: `id` (UUID), `name`, `email`, `role`; agents are global (no `client_id` column) — all clients share the same agent pool
- `stores` table — defined in the multi-store spec (`2026-04-30-multi-store-design.md`); `tasks.store_id` is a plain nullable uuid in this migration; FK to `stores.id` is added when multi-store is implemented

---

## Feature 1 — Inbox Status Persistence

**Current state:** conversation statuses are written to and read from localStorage (`lynq_statuses`). The PATCH route already exists.

**Change:** inbox reads the initial status from `email_conversations.status` (via the existing GET conversations route). On status change, the inbox calls `PATCH /api/email/conversations/[id]` immediately (fire-and-forget from the UI — no blocking spinner). The localStorage `lynq_statuses` key is removed entirely.

No schema changes required. No new routes required.

---

## Feature 2 — Internal Notes

Two new columns are added to `email_messages`:

| Column | Type | Notes |
|--------|------|-------|
| `type` | text | `'message'` (default) \| `'note'` |
| `agent_id` | uuid | nullable; FK → agents.id; populated on notes, null for inbound customer messages |

Notes are never sent to the customer. They are stored identically to messages but excluded from all outbound logic.

### New Route

`POST /api/email/conversations/[id]/notes`:
- Auth: Bearer token → `getUserFromToken` → resolves `client_id` and the auth user's email. `agent_id` is resolved server-side by looking up `agents.id` where `agents.email = user.email`. If no matching agent row exists, the note is inserted with `agent_id = null` (graceful degradation — note is saved without attribution). `agent_id` is not accepted from the request body.
- Body: `{ body: string }`
- Inserts a row into `email_messages` with `type: 'note'`, `body`, `agent_id` (resolved server-side or null), `created_at`

### Display

`GET /api/email/conversations/[id]/messages` is extended to include `type` and `agent_name` (joined from `agents.name` via `agent_id`; null if `agent_id` is null) in each row. Both message rows (`type = 'message'`) and note rows (`type = 'note'`) include these fields — message rows will have `agent_name: null`, which is expected and not rendered. The inbox thread view applies `.msg-note` CSS class only to rows where `type = 'note'`, displaying the author when `agent_name` is non-null. No new CSS required.

---

## Feature 3 — "All" Folder

A new **All** tab in the inbox sidebar shows all conversations regardless of whether the sender matches a known Shopify customer.

**Implementation:** `GET /api/email/conversations` gains an optional `?folder=all` query param. When `?folder=all` is present, the `customer_email` Shopify filter is removed. If `?folder=all` is supplied alongside another folder param, `all` takes precedence and the other folder param is ignored. Other query params (status, pagination, sort) continue to apply normally.

No schema changes required.

---

## Feature 4 — `tasks` Table & Threshold Configuration

### `tasks` Table Schema

Migration prerequisites (run before the table migration):
```sql
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
```
(`pg_net` is required for `net.http_post` in the pg_cron schedule.)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `client_id` | uuid | FK → clients.id |
| `store_id` | uuid | nullable; no FK constraint in this migration — plain nullable uuid until multi-store is implemented |
| `type` | text | `complaint` \| `high_value_order` \| `repeated_refund` |
| `status` | text | `open` \| `in_progress` \| `resolved` |
| `priority` | text | `low` \| `medium` \| `high` |
| `title` | text | Short human-readable label |
| `description` | text | Context detail |
| `metadata` | jsonb | e.g. `{ thread_id, order_id, customer_email, refund_count }` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | maintained by: `CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at)` |
| `resolved_at` | timestamptz | nullable |
| `assigned_to` | uuid | nullable; FK → agents.id |

Index on `(client_id, status)` for ActionBoard queries.

Partial unique index to prevent duplicate open complaint tasks per thread:
```sql
CREATE UNIQUE INDEX tasks_complaint_thread_dedup
  ON tasks (client_id, (metadata->>'thread_id'))
  WHERE type = 'complaint' AND status != 'resolved';
```
Complaint inserts use `INSERT ... ON CONFLICT DO NOTHING` to handle race conditions (two agents opening the same conversation simultaneously).

All auto-created tasks (`complaint`, `high_value_order`, `repeated_refund`) have `assigned_to = null` — agents assign tasks manually via the ActionBoard.

### Threshold Configuration

A `thresholds` jsonb column is added to the `clients` table. Default values are applied server-side when the column is null:

```json
{
  "high_value_order_amount": 500,
  "repeated_refund_count": 3,
  "repeated_refund_window_days": 30
}
```

New routes:
- `GET /api/settings/thresholds` — returns current thresholds for authenticated client
- `PATCH /api/settings/thresholds` — updates `clients.thresholds` jsonb column

A threshold configuration form is added to the Settings page with three numeric inputs:

| Field | Label | Default |
|-------|-------|---------|
| `high_value_order_amount` | High-value order threshold (€) | 500 |
| `repeated_refund_count` | Refund count to trigger alert | 3 |
| `repeated_refund_window_days` | Refund lookback window (days) | 30 |

On save, calls `PATCH /api/settings/thresholds` with the updated values. Shows inline success or error feedback.

`PATCH /api/settings/thresholds` performs server-side validation: all three fields must be present and must be positive integers (> 0). Non-integer, zero, negative, or missing values return HTTP 400 with a descriptive error. The UI also validates before submitting, but the server-side check is authoritative.

---

## Feature 5 — Inline Task Triggers

Both inline triggers are fire-and-forget within their parent route — a task insertion failure never blocks the primary operation.

### Complaint Detection

When an agent opens a conversation, the inbox UI calls the Next.js API route `POST /api/ai/analyze` (server-side). The Claude API key is only used server-side inside this route and never exposed to the browser. If the call fails (network drop, JS error), no task is created — no retry is expected in MVP.

**Important constraint:** complaint detection is conversation-open-triggered, not ingest-triggered. Complaints in conversations that are never opened will not generate tasks. This is intentional for MVP — reliable ingest-time detection is a future enhancement.

Before calling the route, the inbox UI checks the already-loaded tasks list for an existing open or in-progress `complaint` task with the same `thread_id`. If one exists, the route is not called — this avoids unnecessary Claude API spend on repeated opens of the same conversation.

Route contract:
- Auth: Bearer token → `getUserFromToken` → resolves `client_id`. The token is the same Supabase session token the inbox already uses for all other authenticated API calls. `agent_id` is not captured — complaint tasks have `assigned_to = null` by design.
- Body: `{ thread_id: string, body: string }` — `body` is the text of the latest message, which is already displayed in the thread view when the conversation is opened.
- Calls Claude API server-side, returns `{ isComplaint: bool, confidence: float, summary: string }`
- If `isComplaint: true`: insert task using `INSERT INTO tasks (...) VALUES (...) ON CONFLICT DO NOTHING` — the partial unique index on `(client_id, metadata->>'thread_id')` where `type='complaint' AND status != 'resolved'` is the conflict target. A plain `INSERT` must NOT be used here; the `ON CONFLICT DO NOTHING` is required to avoid errors on concurrent opens.
- Task fields: `type: 'complaint'`, `priority: 'high'`, `assigned_to: null`, `metadata: { thread_id, summary }`
- Route always returns HTTP 200 with `{ isComplaint: bool, confidence: float, summary: string, taskCreated: bool }`. `taskCreated: false` when `ON CONFLICT DO NOTHING` fires (task already existed). The UI uses `taskCreated` to decide whether to refresh the task list.

### High-Value Order Detection

Fires inside the order sync route (`POST /api/shopify/sync`) during the upsert loop.

After each order is upserted:
- Compare `subtotal_price` against `clients.thresholds.high_value_order_amount` (default: 500)
- If order exceeds threshold: dedup check — query `tasks` where `type='high_value_order' AND metadata->>'order_id' = ?` (all statuses, including resolved)
- If no task exists for this order at any status: insert task with `type: 'high_value_order'`, `priority: 'medium'`, `assigned_to: null`, `metadata: { order_id, order_name, customer_email, amount }`
- Once a task for a given `order_id` has been created at any status, no further task is created for that order. Un-resolving a high-value task (via ActionBoard) is a valid agent action but does not reset the dedup gate.
- **Intentional asymmetry with complaint dedup:** complaint tasks can be re-created after resolution (the partial unique index excludes resolved rows); high-value order tasks cannot (dedup covers all statuses). Rationale: a high-value order is a one-time event per order; a complaint is a signal that can recur. Do not "fix" these to match each other.

---

## Feature 6 — Scheduled Sweep (Repeated Refund Pattern)

A new Supabase Edge Function `task-sweep` runs on a pg_cron schedule every 30 minutes.

**Logic per execution:**
1. Fetch all active clients from `clients` table (`status = 'active'`)
2. For each client, process inside a try/catch — a failure for one client logs the error and continues to the next client without aborting the sweep
3. Read `thresholds.repeated_refund_count` (default 3) and `thresholds.repeated_refund_window_days` (default 30)
4. Query `shopify_orders` grouped by `customer_email` where `refund_amount > 0` and `processed_at >= now() - interval` — count distinct orders with any refund. `refund_amount > 0` at query time is the sole signal; historical refund reversals (amount reset to 0) are not tracked and would correctly exclude the order from the count.
5. For any customer whose refund count ≥ threshold: check if an open or in-progress `repeated_refund` task already exists for that `customer_email` + `client_id`. Resolved tasks are excluded from this check — if the pattern recurs after an agent resolves the task, a new task is created. This is intentional: refund patterns can legitimately recur; unlike high-value orders (one-time event per order), a repeated-refund pattern can resurface after resolution.
6. If not: insert task with `type: 'repeated_refund'`, `priority: 'high'`, `assigned_to: null`, `metadata: { customer_email, refund_count, window_days }`

**Auto-resolution:** tasks are resolved manually by agents. The sweep does not auto-resolve tasks when a customer's refund count drops below threshold.

**Error handling:** per-client try/catch ensures a single client failure does not abort the sweep. Errors are logged via `console.error` with `client_id` for debuggability.

**Schedule:** pg_cron invokes the Edge Function via HTTP every 30 minutes. Both settings are set as database-level settings at deploy time via `ALTER DATABASE postgres SET app.edge_function_url = '...'` and `ALTER DATABASE postgres SET app.service_role_key = '...'`. The deploy script must assert both values are non-empty strings before running the cron schedule — `current_setting` will throw if the GUC key is absent entirely, but will silently return an empty string if set to `''`, producing a malformed URL. Empty-value assertion is a deploy-time responsibility, not a runtime check:
```sql
SELECT cron.schedule('task-sweep', '*/30 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.edge_function_url') || '/task-sweep',
    headers := json_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);
```
Deployed to `supabase/functions/task-sweep/`.

---

## Feature 7 — ActionBoard Migration

### API Routes

`GET /api/tasks`:
- Auth: Bearer token → `getUserFromToken`
- Query params: `status` (default: `open`), `type` (optional filter), `page` (default: 1)
- Returns: `{ tasks: [...], total, page, pageSize: 100 }` — page size is 100 for MVP; pagination UI is deferred

`PATCH /api/tasks/[id]`:
- Auth: Bearer token → `getUserFromToken`
- Body: `{ status?, assigned_to? }`
- Validation: `status` must be one of `open`, `in_progress`, `resolved` if supplied; `assigned_to` must be `null` or a UUID that matches an existing row in `agents` — a well-formed UUID that does not exist in `agents` returns HTTP 400 (not a 500 FK violation); agents are global (no client scoping)
- Sets `resolved_at = now()` whenever `status` is set to `'resolved'` — unconditional, applies on any transition including re-resolve
- Sets `resolved_at = null` unconditionally whenever `status` is set to `'open'` or `'in_progress'` (no-op if already null). This permanently discards the prior `resolved_at` timestamp — this is an intentional trade-off. No audit history of resolution timestamps is preserved in this phase.
- Returns updated task

### ActionBoard Component

The `ActionBoard` component is extracted from `app/analytics/page.js` into `app/components/ActionBoard.js`. The analytics page imports and renders it unchanged — no visible change to the analytics page.

**Tab mapping** (all task types are shown mixed within each tab — no type filtering by tab):
- Open → `GET /api/tasks?status=open`
- Picked Up → `GET /api/tasks?status=in_progress`
- Done → `GET /api/tasks?status=resolved`

Dragging or clicking a task to change status calls `PATCH /api/tasks/[id]` with the new status.

**Migration:** existing localStorage/`analytics_actions` data is not migrated. Tasks are regenerated organically as the sweep runs and inline triggers fire. The `/api/analytics/actions` route is left in place but ActionBoard stops writing to it.

---

## Implementation Plan & Estimates

Estimates assume a human developer with minimal AI assistance. Schema migrations for `email_messages` (`type`, `agent_id` columns) are included within the "Internal notes" line item.

| Task | Hours |
|------|-------|
| Add `tasks` table SQL migration (including `moddatetime` extension, `updated_at` trigger, partial unique index) | 1h |
| Add `thresholds` jsonb column to `clients` table | 1h |
| `GET/PATCH /api/settings/thresholds` routes | 2h |
| `POST /api/ai/analyze` route (Claude API server-side, complaint detection) | 3h |
| Inline complaint task trigger — `INSERT ON CONFLICT DO NOTHING` in inbox AI analysis flow | 2h |
| Inline high-value order task trigger — inside order sync upsert loop | 2h |
| `task-sweep` Edge Function — repeated refund pattern sweep, pg_cron schedule | 5h |
| `GET /api/tasks` + `PATCH /api/tasks/[id]` routes | 3h |
| Migrate ActionBoard to live DB queries, extract to `app/components/ActionBoard.js` | 4h |
| Inbox: remove localStorage status, wire PATCH on status change | 2h |
| Internal notes: DB migration (`type` + `agent_id` on `email_messages`), POST notes route, extend GET messages route, render in thread | 4h |
| "All" folder: `?folder=all` param on conversations GET, tab in inbox sidebar | 2h |
| Settings UI: threshold configuration form | 3h |
| Empty/loading/error states across ActionBoard and inbox changes | 2h |
| **Total** | **36h** |

---

## Constraints

- Task insertion failures are always fire-and-forget — they never block the originating operation (sync, refund, conversation load)
- Tasks are resolved manually by agents — no auto-resolution logic
- All auto-created tasks have `assigned_to = null`; assignment is a manual agent action
- `task-statuses-validator.md` and `task-generator-engine.md` contain identical requirements and are treated as a single task covered by this spec
- The `/api/analytics/actions` route is not deleted in this phase — ActionBoard simply stops writing to it
- Complaint detection fires per conversation open — partial unique index + `INSERT ON CONFLICT DO NOTHING` prevents duplicates even in concurrent multi-agent scenarios
- High-value order tasks are not re-created after resolution — dedup check covers all statuses; un-resolving a task does not reset the dedup gate
- `refund_amount > 0` at query time is the sole refund signal in the sweep — refund reversals are not tracked
- Threshold defaults (500 / 3 refunds / 30 days) are applied server-side; clients without a `thresholds` value behave as if defaults are set
- ActionBoard shows all task types mixed within each status tab — no per-type tab filtering in this phase
- ActionBoard page size is 100 for MVP; pagination UI is deferred
- Claude API key is server-side only — the inbox UI calls the Next.js API route, never Claude directly
- `SERVICE_ROLE_KEY` in the pg_cron job is stored as a Supabase app setting (`current_setting`), not hardcoded in SQL
