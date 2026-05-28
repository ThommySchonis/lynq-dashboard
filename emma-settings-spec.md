# Emma settings — field-by-field spec vs. current codebase

> **Scope.** Maps the 6-phase prototype design of *Settings → AI agent* to the
> actual state of `origin/main` at commit `f473a02` (2026-05-28). Per field:
> does it already exist? If yes, where? If no, what shape would a workspace-
> scoped column take, and in which build step does it land?
>
> **Read-only.** No code is changed by this spec; it only points at what is
> there and what is missing.

## 0 · Prototype design vs. production reality (one paragraph)

The prototype frames "Emma" as a six-phase onboarding/training surface:
fundament, policies, scenarios, emotion, train-via-chat, lessons. The repo on
`origin/main` does **not** have an "AI agent" UI surface. The only AI-suggest
implementation is one button (*AI Reply* in the composer) that calls
`POST /api/ai/reply`, which reads a single `ai_settings` row (system_prompt +
brand_name + tone + language) and produces a draft via Claude Haiku. About
**half of Phase 1's fields exist** in `ai_settings` (+ partial mirrors in
`macro_onboarding`), **everything from Phase 2 onward is net new**, and the
existing `ai_settings` table is still **keyed by `user_id`** (`onConflict:
'user_id'`) — fixing that is a prerequisite to scoping any of these new fields
to a workspace, and it's explicitly tagged in the codebase as deferred *until
Phase 4 swaps the unique key*. The good news: the patterns we need for the
new work (zod-validated bodies via `validateBody`, the workspace-scoped RLS
template, `requireWriteAccess` gate, the `ws:<id>:ai` rate limiter, the
`tasks` + `support_events` + `macros` tables) already exist and just need to
be wired up around new Emma columns.

---

## 1 · Existing on-disk inventory (the building blocks)

Confirmed by inspection of `origin/main`:

| Asset | Where on origin/main | Use it for |
|---|---|---|
| `ai_settings` table | RLS at [supabase/migrations/20260505000005_rls_workspace_aware_policies.sql:34, 264-281](supabase/migrations/20260505000005_rls_workspace_aware_policies.sql#L34). `CREATE TABLE` is **not in the repo** — table was provisioned manually in Supabase. Columns referenced in code: `user_id`, `workspace_id`, `brand_name`, `language`, `tone`, `system_prompt`. | Phase 1 fundament fields. **But** see §4: keyed by `user_id` today. |
| `macros` table | [supabase/migrations/20260505000002_macros.sql:13-26](supabase/migrations/20260505000002_macros.sql#L13-L26) — `workspace_id` FK, `name`, `body`, `language`, `tags[]`, `archived_at`, `created_by`. Already workspace-scoped + RLS-protected. | Phase 3 *response templates* per scenario. Reuse — don't build a parallel table. |
| `macro_onboarding` table | Referenced in [app/api/macros/onboarding/route.ts:18, 46](app/api/macros/onboarding/route.ts#L18) and [app/api/macros/generate/route.ts:42, 170](app/api/macros/generate/route.ts#L42). Schema in [lib/schemas/macros.ts:14-44](lib/schemas/macros.ts#L14-L44): collects `store_name`, `what_sells`, `brand_voice`, `support_email`, `signature`, `return_days`, `return_shipping`, `damage_policy`, `tracking_link`, `extra_notes`. | Already collects ~60% of Phase 1 + early Phase 2 inputs (return / damage policy). Migrate or mirror these into the new Emma table. |
| `tasks` table | [supabase/migrations/20260517000000_tasks.sql:5-50](supabase/migrations/20260517000000_tasks.sql#L5-L50) — workspace-scoped, status `open`/`picked_up`/`done`, `assigned_to workspace_members(id)`, `trigger_type in ('manual','pattern','ai_insight')`, plus `shopify_order_id`/`customer_email`. | Phase 4: when Emma escalates, create a `tasks` row with `trigger_type='ai_insight'` and `assigned_to` a human team member. Don't invent an "escalation queue" table. |
| `support_events` table | [supabase/migrations/20260519100000_support_events.sql:5-15](supabase/migrations/20260519100000_support_events.sql#L5-L15) — workspace + conversation + agent + `event_type` + `metadata jsonb`. RLS at lines 32-44. Designed for "future ClickHouse migration". | Phase 5/6: log every Approve/Edit/Reject decision and every Emma decision (handled / escalated / refused) as a typed event. Don't add a new "ai_feedback" table — extend `event_type` values. |
| `email_conversations.assigned_to` | [supabase/migrations/20260519100001_conversation_assigned_to.sql:4-6](supabase/migrations/20260519100001_conversation_assigned_to.sql#L4-L6) — `uuid references workspace_members(id) on delete set null`. | Phase 4: when Emma escalates, `assigned_to` is the obvious place to drop the human owner. |
| `email_conversations.status` | Validated values: `'open' \| 'pending' \| 'resolved' \| 'closed'` ([lib/conversationEngine.ts:`updateConversationStatus`](lib/conversationEngine.ts)). | Reuse for "Emma deferred / awaiting human". Don't add a new status enum unless you really need one. |
| `integrations.parcelpanel_api_key` | [app/api/parcel-panel/connect/route.ts:49](app/api/parcel-panel/connect/route.ts#L49), [app/api/parcel-panel/tracking/route.ts:32-36](app/api/parcel-panel/tracking/route.ts#L32-L36). Tracking is fetched via the ParcelPanel API, **not** a stored URL. | Phase 2 "tracking-platform URL" already has a credential storage path. A customer-facing URL (e.g. `tracking.brand.com`) is not stored yet — that's a new field. |
| `workspaces` columns (Phase 1 candidates) | [supabase/migrations/20260508000005_workspace_settings.sql:4-15](supabase/migrations/20260508000005_workspace_settings.sql#L4-L15) — `slug`, `logo_url`, `timezone`, `locale`, `date_format`, `time_format`, `first_day_of_week`, `show_order_data`, `auto_translate`. Plus `name`. | Workspace identity. Use `workspaces.name`/`logo_url`/`locale` as fallbacks; brand_description / website_url do not exist there. |
| `stores` table | Multi-store rolled out via [supabase/migrations/20260518000002_store_isolation_redesign.sql](supabase/migrations/20260518000002_store_isolation_redesign.sql). `integrations.store_id` added. | **Coupling risk for Emma: per-workspace vs. per-store config** — see §4. |
| `lib/schemas/ai.ts` zod | `aiChatBody`, `aiReplyBody`, `aiAnalyzeBody` already there. | Drop new `emmaSettingsBody`, `emmaScenarioBody`, `emmaLessonBody` next to these. |
| `lib/validation.ts` `validateBody` | Tuple-returning helper `[T, null] \| [null, NextResponse]` at [lib/validation.ts:24-40](lib/validation.ts#L24-L40). | House-style validator. Use for every new Emma route. |
| `lib/auth.ts` `requireWriteAccess(ctx)` | At [lib/auth.ts:140](lib/auth.ts#L140). Returns `NextResponse \| null`. | Workspace-write gate on every mutating Emma route. |
| `lib/rate-limit.ts` `checkRateLimit` | Used in `/api/ai/reply` as `checkRateLimit('ws:${ctx.workspaceId}:ai', 10, 60_000)` ([app/api/ai/reply/route.ts:45](app/api/ai/reply/route.ts#L45)). | Already applied to the AI surface; Emma routes inherit the same bucket. Don't add a new limiter. |
| `lib/usage.ts` `incrementAISuggestUsage(workspaceId)` | Defined at [lib/usage.ts:291](lib/usage.ts#L291). **Still zero callers on origin/main** (`git grep` confirms only the export + its own logger). | Plan-limit gating is unenforced — call this after every successful `generateText`/`streamText` on the AI surface before launching the autonomous Emma. |
| `app/api/ai/analyze` triage tags | Produces `urgency`, `intent`, `tags` including `'chargeback' \| 'angry' \| 'urgent' \| 'refund'`. Result is currently client-only ([stores/ai.ts](stores/ai.ts)). | Phase 2 + 4: server-side triage is the natural Emma "what may I handle" pre-check. Move analyze output into `support_events.metadata` and persist. |
| `app/api/ai/chat` streaming | Streams via `streamText` for the Lynq AI business-analyst tab. | Phase 5: lift the streaming pattern for "train via chat" — same shape, new system prompt + new persistence target. |
| `app/api/macros/generate` + `lib/aiMacros.ts` | Uses macros generation via `@anthropic-ai/sdk` directly. | Reference for Anthropic SDK direct calls; Emma scenarios should follow the AI SDK v6 pattern in `/api/ai/reply` (cheaper, integrated). |

---

## 2 · Mapping table — every Emma field × current state

Build-step legend used in the last column:
* **B1 — Schema migration**: `ai_settings` workspace-scoping + new Emma tables.
* **B2 — Settings → AI agent (Fundament + Policies)**: Phases 1 + 2 UI / routes.
* **B3 — Scenarios**: Phase 3 UI / routes + macro linkage.
* **B4 — Emotion & escalation wiring**: Phase 4 + triage persistence + `tasks` integration.
* **B5 — Train via chat + Lessons learned**: Phases 5 + 6 streaming + `support_events` lessons.

| # | Field | Phase | Exists today? (where) | New? (proposed table.column) | UI surface | Build step |
|---|---|---|---|---|---|---|
| 1 | brand_name | 1 | **Yes** — `ai_settings.brand_name` ([app/api/settings/brand/route.ts:25, 39](app/api/settings/brand/route.ts#L25)). Also collected in `macro_onboarding.answers.store_name`. | reuse | Settings → AI agent → Fundament | B2 (no new column) |
| 2 | brand_description | 1 | **No.** `macro_onboarding.answers.what_sells` is the closest, free-text. | `ai_settings.brand_description text` | Settings → AI agent → Fundament | B1 (migration) + B2 (UI) |
| 3 | website_url | 1 | **No.** `integrations.shopify_domain` exists; that's the shop, not a marketing site. | `ai_settings.website_url text` | Settings → AI agent → Fundament | B1 + B2 |
| 4 | tone_of_voice | 1 | **Yes** — `ai_settings.tone` (free text on write; zod enum on onboarding is `friendly\|professional\|luxury`; on macros it's a 5-value enum `Warm/Professional/Casual/Luxury/Playful`). Inconsistent vocabulary — see §4. | reuse but **canonicalise** | Settings → AI agent → Fundament | B2 (consolidate enum) |
| 5 | sign_off | 1 | **Partial.** Used implicitly as `brandName` in [app/api/ai/reply/route.ts:87, 100-107](app/api/ai/reply/route.ts#L87) (`Sign off as "${brandName}"`). `macro_onboarding.answers.signature` collects a multiline signature. | `ai_settings.sign_off text` (so brand_name can be the company, sign_off the human name + role) | Settings → AI agent → Fundament | B1 + B2 |
| 6 | languages | 1 | **Partial.** `ai_settings.language` is a single string; UI enum is `English/Dutch/French/German/Spanish`. Prototype wants multiple. | `ai_settings.languages text[]` (drop the singular column once migrated) | Settings → AI agent → Fundament | B1 (rename/replace) + B2 |
| 7 | shipping_policy | 2 | **No persistent storage.** Default refund/shipping policy is hardcoded into `DEFAULT_SYSTEM_PROMPT` at [app/api/ai/reply/route.ts:16-27](app/api/ai/reply/route.ts#L16) ("offer 30% partial refund…"). | `ai_policies.shipping text` (new table — see §3) | Settings → AI agent → Policies | B1 + B2 |
| 8 | refund_policy | 2 | **No persistent storage** — see #7. `macro_onboarding.answers.return_shipping` and `.return_days` collect a slice during macro generation. | `ai_policies.refund text`, `ai_policies.return_days int` | Settings → AI agent → Policies | B1 + B2 |
| 9 | customs_policy | 2 | **No.** No reference in `lib/` or `app/api/`. | `ai_policies.customs text` | Settings → AI agent → Policies | B1 + B2 |
| 10 | may_decide (allowlist) | 2 | **No.** Nothing in the repo enumerates "what Emma may handle". | `ai_autonomy_rules` (workspace-scoped) — see §3 | Settings → AI agent → Policies | B1 + B2 + B4 (enforcement) |
| 11 | may_not_decide (denylist) | 2 | **No.** Defacto: triage tags `chargeback`/`angry`/`urgent` are computed but never block anything. | `ai_autonomy_rules.kind in ('must_escalate','must_defer','allowed')` | Settings → AI agent → Policies | B1 + B2 + B4 |
| 12 | escalation_triggers | 2 / 4 | **No persistent storage.** `app/api/ai/analyze` produces the tags client-side. | `ai_autonomy_rules` rows with `match: { tag, customer_signal, threshold }` | Settings → AI agent → Policies + Emotion | B1 + B4 |
| 13 | tracking_platform_url (Parcel Panel) | 2 | **Partial.** Credential storage exists (`integrations.parcelpanel_api_key`); a customer-facing tracking URL template (e.g. `https://track.brand.com/{tracking}`) does not. | `ai_settings.tracking_url_template text` | Settings → AI agent → Policies | B1 + B2 |
| 14 | scenario.approach | 3 | **No.** | `ai_scenarios.approach text` | Settings → AI agent → Scenarios | B1 + B3 |
| 15 | scenario.questions[] | 3 | **No.** | `ai_scenarios.questions text[]` | Settings → AI agent → Scenarios | B1 + B3 |
| 16 | scenario.response_template | 3 | **Reuse `macros`.** `macros(workspace_id, name, body, language, tags[])` is exactly the response-template shape. Add an FK from `ai_scenarios.macro_id → macros.id`. | `ai_scenarios.macro_id uuid references macros(id)` | Settings → AI agent → Scenarios + Inbox (macros panel) | B3 |
| 17 | scenario.escalate_when | 3 | **No.** | `ai_scenarios.escalate_when jsonb` (rule expression) | Settings → AI agent → Scenarios | B1 + B3 |
| 18 | scenario.autonomy_percent | 3 | **No.** | `ai_scenarios.autonomy_pct int check (0..100)` | Settings → AI agent → Scenarios | B1 + B3 + B4 |
| 19 | seven scenario rows (WISMO, long delivery, lost package, wrong/damaged, refund/cancellation, customs, angry/chargeback) | 3 | **No.** Triage `intent` strings overlap (`Refund request`, `Order not received`, `Wrong item`, `Tracking request`, `Exchange request`, `Delivery delay`, `Complaint`, `Damaged item`) but are not persisted. | Seed `ai_scenarios` with seven rows per workspace at first save. | Settings → AI agent → Scenarios | B3 |
| 20 | angry_customer_approach | 4 | **No.** Hardcoded "acknowledge frustration first" in `DEFAULT_SYSTEM_PROMPT`. | `ai_policies.angry_approach text` (or as a `ai_scenarios` row dedicated to angry) | Settings → AI agent → Emotion + Inbox banner | B1 + B4 |
| 21 | threats/chargebacks → always escalate | 4 | **Partial signal only.** `analyze` returns `tags: ['chargeback']` ([app/api/ai/analyze/route.ts:33](app/api/ai/analyze/route.ts#L33)). No enforcement. | Hard-coded `ai_autonomy_rules` seed: `{ kind:'must_escalate', match:{ tag:'chargeback' }}` + `{ tag:'fraud' }` + `{ tag:'legal-threat' }`. Plus a `support_events.event_type = 'auto_escalated'` row. Drop a `tasks` row with `trigger_type='ai_insight'`. | Inbox (forced banner) + AI-agent → Performance tab | B4 |
| 22 | train-via-chat session | 5 | **No.** `app/api/ai/chat` exists but serves the home-tab business analyst Q&A — different system prompt, different target. | New route `app/api/ai/train/route.ts` (mirror `chat` route streaming pattern) + `ai_training_messages(workspace_id, role, content, decision in ('good','bad','neutral'), created_at)`. Per-decision rows feed Phase 6. | Settings → AI agent → Train tab | B5 |
| 23 | training_feedback (good/bad on each Emma turn) | 5 | **No.** | Same table as #22; or `support_events.event_type = 'training_feedback'` with `metadata: { decision, message_id }` — pick one. **Recommend support_events** for analytics homogeneity. | Settings → AI agent → Train | B5 |
| 24 | lessons_learned (auto-accumulated) | 6 | **No.** No table. `ai_usage` tracks tokens only, no FK to conversation. | `ai_lessons(id, workspace_id, source_event_id references support_events(id), summary text, evidence_thread_id uuid, created_at, archived_at)`. Background job (Vercel Cron) compresses N support_events into a lesson. | Settings → AI agent → Lessons + Inbox sidebar ("Emma recently learned…") + AI-agent Performance | B5 |
| 25 | lesson application in next reply prompt | 6 | **No.** Reply prompt today reads only `ai_settings.system_prompt`. | At reply time, fetch top-K lessons by recency / tag-match and prepend to `system`. Single place: [app/api/ai/reply/route.ts:79-88](app/api/ai/reply/route.ts#L79-L88). | (server side, no UI) | B5 |

---

## 3 · Proposed new tables (one shape, four tables)

All tables follow the existing house pattern: `workspace_id` FK + four
`<table>_<verb>_workspace_members` RLS policies modelled on [supabase/migrations/20260505000005_rls_workspace_aware_policies.sql:265-281](supabase/migrations/20260505000005_rls_workspace_aware_policies.sql#L265-L281).

```sql
-- B1 migration sketch — DO NOT run; design only.

-- 1) ai_settings: workspace-scope swap + new Phase-1/2 columns.
alter table public.ai_settings
  add column if not exists brand_description    text,
  add column if not exists website_url          text,
  add column if not exists sign_off             text,
  add column if not exists languages            text[],
  add column if not exists tracking_url_template text;
-- (Unique-constraint swap discussed in §4 — separate step.)

-- 2) ai_policies — 1 row per workspace.
create table if not exists public.ai_policies (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null unique references public.workspaces(id) on delete cascade,
  shipping        text,
  refund          text,
  return_days     int,
  customs         text,
  angry_approach  text,
  updated_at      timestamptz not null default now()
);

-- 3) ai_scenarios — seven rows per workspace.
create table if not exists public.ai_scenarios (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  scenario_key    text not null check (scenario_key in
                    ('wismo','long_delivery','lost_package','wrong_or_damaged',
                     'refund_cancellation','customs_fees','angry_or_chargeback')),
  approach        text,
  questions       text[] not null default '{}',
  macro_id        uuid references public.macros(id) on delete set null,
  escalate_when   jsonb,
  autonomy_pct    int not null default 0 check (autonomy_pct between 0 and 100),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, scenario_key)
);

-- 4) ai_autonomy_rules — Phase 2 may / may-not + Phase 4 hard rules.
create table if not exists public.ai_autonomy_rules (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  kind          text not null check (kind in ('allowed','must_escalate','must_defer')),
  match         jsonb not null,   -- e.g. { "tag": "chargeback" } | { "intent": "Refund request", "amount_gt": 200 }
  priority      int not null default 100,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 5) ai_lessons — Phase 6 corpus.
create table if not exists public.ai_lessons (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  source_event_id    uuid references public.support_events(id) on delete set null,
  summary            text not null,
  tags               text[] not null default '{}',
  evidence_thread_id uuid,
  created_at         timestamptz not null default now(),
  archived_at        timestamptz
);
```

Training messages (#22, #23) reuse `support_events` (do not add a 6th table) —
`event_type in ('emma_draft','emma_decision','training_feedback')` with
`metadata jsonb` for the payload.

---

## 4 · What already exists / don't rebuild

* **Workspace-scoped RLS template.** Copy lines 265-281 of the RLS migration for each new table. The `user_workspace_ids()` SECURITY DEFINER helper exists.
* **zod schemas folder.** Drop `lib/schemas/emma.ts` next to `lib/schemas/ai.ts`. The existing `lib/schemas/settings.ts` already uses the same idiom (`z.object`, `.optional()`, `.max()`).
* **`validateBody(request, schema)`.** Tuple-returning helper at [lib/validation.ts:24-40](lib/validation.ts#L24-L40). The brand route uses it ([app/api/settings/brand/route.ts:15-16](app/api/settings/brand/route.ts#L15-L16)). All new Emma routes should use it.
* **Per-workspace AI rate limiter.** `checkRateLimit('ws:${ctx.workspaceId}:ai', 10, 60_000)` — already applied in `/api/ai/reply` ([line 45](app/api/ai/reply/route.ts#L45)) and `/api/ai/analyze` and `/api/ai/chat`. New Emma generation routes get this for free as long as they share the bucket name.
* **`requireWriteAccess(ctx)` gate.** [lib/auth.ts:140](lib/auth.ts#L140). Use on every Emma POST/PATCH.
* **Streaming pattern.** [app/api/ai/chat/route.ts:75-105](app/api/ai/chat/route.ts) — `streamText({ model: anthropic(...), system, messages })` + `toTextStreamResponse()` + `onFinish` cost log. Train-via-chat is a 90% copy.
* **`tasks` for escalation.** [supabase/migrations/20260517000000_tasks.sql:5-50](supabase/migrations/20260517000000_tasks.sql#L5-L50). `trigger_type='ai_insight'` slot already exists.
* **`support_events` for any decision log.** [supabase/migrations/20260519100000_support_events.sql:5-15](supabase/migrations/20260519100000_support_events.sql#L5-L15). Generic `event_type` + `metadata jsonb` — extend with new event names; do not invent a parallel table.
* **`macros` for response templates.** Workspace-scoped, `body text`, `language`, `tags[]`. The seven Phase-3 templates should be created as `macros` rows with FKs from `ai_scenarios`.
* **Triage tag vocabulary.** `[refund, not-received, wrong-item, damaged, tracking, exchange, complaint, angry, urgent, chargeback]` ([app/api/ai/analyze/route.ts:33](app/api/ai/analyze/route.ts#L33)). Use the same string set in `ai_autonomy_rules.match.tag` so the analyze output can be matched directly.
* **`incrementAISuggestUsage(workspaceId)`.** Already defined at [lib/usage.ts:291](lib/usage.ts#L291) — currently zero callers, plug it into the reply path before Emma generation goes live so the plan cap actually trips.
* **Settings tree mounting point.** [app/(protected)/settings/workspace/](app/(protected)/settings/workspace/) — `billing/`, `general/`, `macros/`, `members/`, `stores/`, `tags/` are siblings. Add `ai-agent/` next to them. Layout pattern from [app/(protected)/settings/layout.tsx](app/(protected)/settings/layout.tsx).

---

## 5 · Open questions / coupling risks

### 5.1 The Phase-4 unique-key swap on `ai_settings` (highest-risk dependency)

Quote from current code, [app/api/settings/brand/route.ts:18-29](app/api/settings/brand/route.ts#L18-L29):

```ts
// Transition: write both user_id (legacy) AND workspace_id. Keep
// existing onConflict until Phase 4 swaps the unique key.
await supabaseAdmin
  .from('ai_settings')
  .upsert({
    user_id:      ctx.user.id,
    workspace_id: ctx.workspaceId,
    brand_name:   brandName,
    language,
    tone,
  }, { onConflict: 'user_id' })
```

**What code today *depends* on the `user_id` uniqueness:**

1. **`POST /api/settings/brand`** — the upsert at line 29 uses `onConflict: 'user_id'`. Swap to `workspace_id` and existing rows for users in the same workspace start colliding instead of updating in place.
2. **`POST /api/ai/reply`** — reads `ai_settings.system_prompt + brand_name` via [.eq('user_id', user.id)](app/api/ai/reply/route.ts#L82). Until this `.eq` is changed to `.eq('workspace_id', ctx.workspaceId)`, every team member sees the inviting owner's prompt, regardless of whose row is "canonical".
3. **`GET /api/settings/brand`** — already reads by `workspace_id` ([brand/route.ts:39](app/api/settings/brand/route.ts#L39)). After the swap, the POST and the reply route need to match.
4. There is **no CREATE-TABLE migration for `ai_settings` in the repo**. The unique constraint (`unique(user_id)` presumably) was set in Supabase Studio. The B1 migration must (a) inspect prod, (b) drop `unique(user_id)`, (c) add `unique(workspace_id)`, (d) backfill workspace_id where missing, (e) optionally `not null` the column afterwards.

**Recommended sequence inside B1:**

1. Migration: capture current `ai_settings` schema, then `alter table ai_settings add constraint ai_settings_workspace_id_key unique (workspace_id)` (no drop yet).
2. Code: in `POST /api/settings/brand` change `onConflict: 'user_id'` → `'workspace_id'`. In `POST /api/ai/reply` change the read filter. Both in the same PR.
3. Migration: `alter table ai_settings drop constraint <user_id_unique_name>`. Optional: `alter column user_id drop not null` and stop writing it.
4. Only **after** steps 1-3 are stable, add the Phase-1/2 columns from §3.

The old audit (`emma-suggest-architecture.md` §10 point 1, `lynq-conventions-and-security.md` §4) flagged the same dependency. Both audits are still accurate as of `origin/main` — the swap has **not** happened yet.

### 5.2 Per-workspace vs. per-store Emma config

Since [20260518000002_store_isolation_redesign.sql](supabase/migrations/20260518000002_store_isolation_redesign.sql) shipped, a workspace can hold multiple `stores`. The prototype assumes one Emma per workspace, but realistically:

* Brand voice, sign-off, languages — usually per **store**, not per workspace.
* Policies (shipping, refund, customs) — usually per **store**.
* Scenarios & autonomy — could be workspace-wide or per store.

Decision needed before B1: are `ai_settings`/`ai_policies`/`ai_scenarios`
scoped by `workspace_id` only, or `(workspace_id, store_id)` with a default
store-null row? Recommend: keep `workspace_id` for B1/B2, add a nullable
`store_id` later when the team confirms multi-store CS is in scope. The
schema sketches in §3 use `workspace_id` only.

### 5.3 Tone enum mismatch

* Onboarding zod ([lib/onboarding-constants.ts:7](lib/onboarding-constants.ts#L7)): `friendly | professional | luxury` (3 values).
* Macro-onboarding zod ([lib/schemas/macros.ts:17-23](lib/schemas/macros.ts#L17-L23)): `Warm & personal | Professional & efficient | Casual & friendly | Luxury & elegant | Playful & fun` (5 values, different vocabulary).
* `ai_settings.tone` column accepts any `text` on write — there is no DB-level CHECK.

Before B2, pick one canonical enum (recommend the 5-value macro set) and
migrate the onboarding form. Otherwise the prompt-injection of "tone" into
the reply system prompt produces inconsistent results.

### 5.4 Sign-off vs. signature vs. brand_name overlap

Today the reply prompt sends `Sign off as "${brandName}"` ([reply/route.ts:100](app/api/ai/reply/route.ts#L100)).
The onboarding flow has only `brandName`; the macro flow has a separate
`signature` field collecting a multi-line email signature. Decide whether
`brand_name` should be the company (e.g. "Lynq & Flow"), `sign_off` the
human/team name + role ("— Sara, Customer Care"), and `signature` the
full HTML footer (logo + links). The current model conflates all three.

### 5.5 `incrementAISuggestUsage` still dead code

`git grep` on origin/main returns 0 callers. The plan-limit gate
(`checkAiSuggestLimit`) trips on a counter nothing ever increments, so AI
Suggest is effectively unlimited per workspace today. If Emma's autonomous
mode shares this gate, the counter must be wired up **before** any
auto-send goes live — otherwise per-plan caps and `write_locked` will
behave randomly. Single-line fix at the bottom of `/api/ai/reply`.

### 5.6 `lessons learned` cardinality

If we log every Approve/Edit/Reject as a `support_events` row, a busy
workspace generates >>10k rows/day. Lessons must be **compressed**
(N events → 1 lesson summary via Claude) on a schedule. Recommend a
Vercel Cron job at hourly/daily cadence (precedent: `/api/cron/usage-warnings`
hourly). Lessons that don't survive K weeks should auto-archive
(`ai_lessons.archived_at`) to keep the reply-prompt prepend small.

### 5.7 CORS still `*` on `/api/:path*`

Out of scope for this spec but flagged in both prior audits. If Emma's
auto-send route lands while `next.config.ts` still emits
`Access-Control-Allow-Origin: *`, any browser tab can hit the route.
Tighten before B4.

### 5.8 No central Anthropic wrapper

Each AI route imports `anthropic` + calls `generateText`/`streamText`
directly, with its own `ai_usage` insert. Five new Emma routes will
multiply that copy-paste by five. Recommend extracting a thin
`lib/services/claude.ts` (per the conventions doc §18) **at the start of
B2**, then build all Emma generation through it. Otherwise the rate-limit /
plan-cap / cost-log code drifts.

---

## 6 · Build-step plan in one table

| Step | What lands | Touches |
|---|---|---|
| **B1** | Schema-only PR. Swap `ai_settings` unique key user_id → workspace_id (with backfill). Add Phase-1/2 columns to `ai_settings` (#2 #3 #5 #6 #13). Create `ai_policies`, `ai_scenarios`, `ai_autonomy_rules`, `ai_lessons` with RLS policies. Update `POST /api/settings/brand` and `POST /api/ai/reply` to use `workspace_id`. | `supabase/migrations/`, `app/api/settings/brand/`, `app/api/ai/reply/`, `lib/schemas/settings.ts` |
| **B2** | Settings → AI agent surface for **Phase 1 + 2**. zod schemas + routes. Canonicalise tone enum. Extract `lib/services/claude.ts`. Wire `incrementAISuggestUsage` into reply. | `app/(protected)/settings/workspace/ai-agent/`, `app/api/ai-agent/settings/`, `app/api/ai-agent/policies/`, `lib/schemas/emma.ts`, `lib/services/claude.ts`, `lib/usage.ts` callers |
| **B3** | Scenarios CRUD (Phase 3). Seed seven `ai_scenarios` rows on first save. Link to `macros` via `macro_id`. Per-scenario autonomy slider. | `app/(protected)/settings/workspace/ai-agent/scenarios/`, `app/api/ai-agent/scenarios/`, `lib/schemas/emma.ts` |
| **B4** | Emotion + escalation enforcement (Phase 4). Server-side triage persistence (`/api/ai/analyze` writes a `support_events` row). Hard-coded `ai_autonomy_rules` seeds for chargeback/fraud/legal-threat. Auto-create `tasks` rows with `trigger_type='ai_insight'` + set `email_conversations.assigned_to` on escalation. Inbox banner showing Emma decision (handled / awaiting human). | `app/api/ai/analyze/`, `app/api/ai/reply/`, `lib/services/claude.ts`, `components/features/inbox/`, `app/api/ai-agent/rules/` |
| **B5** | Train-via-chat + lessons (Phases 5 + 6). New `app/api/ai/train/` streaming route. Approve/Edit/Reject UI in the composer (was absent — see prior audit §1). Vercel Cron compressor that turns N `support_events` into `ai_lessons`. Reply prompt prepends top-K lessons. AI-agent → Performance page. | `app/(protected)/settings/workspace/ai-agent/train/`, `app/(protected)/settings/workspace/ai-agent/lessons/`, `app/api/ai/train/`, `app/api/cron/ai-lessons-compress/`, `vercel.json`, `app/api/ai/reply/` |

Cross-cutting work (CORS lockdown, single Claude wrapper, central spend
log, structured logging tags) is hooked at B2 and reused B3-B5.
