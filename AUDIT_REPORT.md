# Lynq & Flow App Audit
Generated: 2026-05-04

Read-only diagnosis. No code was changed in the commit that adds this file.

## Executive Summary

| Metric | Count |
|---|---|
| Total user-facing pages audited | 26 |
| Fully working (loads + saves persist) | 9 |
| Partially broken (loads but save fake / data legacy-scoped) | 8 |
| Stub / placeholder | 3 |
| Demo-data only (no real backend) | 1 |
| Auth flow pages | 5 |
| Total API routes | 109 |
| API routes still scoped by `client_id = user.id` (legacy single-tenant) | 17 |
| API routes correctly scoped by `workspace_id` | 14 |
| Critical bugs | 3 |
| High-priority issues | 9 |
| Medium-priority issues | 11 |
| Low-priority issues | 8 |

**Headline finding**: the Users / Macros / Tags / Profile / Invites surface is solid (recent work). Everything else — General settings, Inbox, Analytics, Performance, Time, Email settings, Shopify integration — is either a stub, a fake-save, or scoped to the legacy single-tenant `client_id = user.id` model. An invited Agent will see almost nothing.

---

## Critical Issues

### C1. `/settings/workspace/general` — every Save button is a lie
- **Location**: [app/settings/workspace/general/page.js:571-588](app/settings/workspace/general/page.js#L571-L588)
- **Severity**: CRITICAL — user-facing data loss illusion
- **What happens**: Three Save handlers (`handleSaveIdentity`, `handleSaveRegional`, `handleSaveToggles`) only call `setInitX(...)` (local React state) and `showToast('saved')`. **There is zero network activity.** Refresh the page → all changes gone.
- **Real endpoint**: `PATCH /api/workspaces/current` exists but it only persists `name`. URL, logo, timezone, language, date format, time format, first day of week, and the three toggles (showOrderData / autoTranslate / allowDelete) have **no backing column or API**.
- **Suggested fix**: extend `workspaces` table with `logo_url`, `timezone`, `locale`, `date_format`, `time_format`, `first_day_of_week`, `show_order_data`, `auto_translate`, `allow_delete` columns; expand PATCH endpoint; wire the Save handlers to `fetch('/api/workspaces/current', { method: 'PATCH', ...})`.
- **Effort**: half day

### C2. Workspace data is invisible to invited Agents (Block C, half-built)
- **Location**: 17 API routes still scoped by `client_id = user.id`. Examples: [app/api/email/conversations/route.js:18](app/api/email/conversations/route.js#L18), [app/api/shopify/kpis/route.js:14](app/api/shopify/kpis/route.js#L14), [app/api/time/route.js](app/api/time/route.js), [app/api/analytics/actions/route.js](app/api/analytics/actions/route.js), [app/api/parcel-panel/tracking/route.js](app/api/parcel-panel/tracking/route.js).
- **Severity**: CRITICAL — the entire multi-user value proposition doesn't work
- **What happens**: Owner connects Shopify, Gmail, ParcelPanel, accumulates time entries and analytics. Invites Agent. Agent logs in → sees an empty dashboard everywhere because every endpoint queries `where client_id = (Agent's user.id)` instead of `where workspace_id = ctx.workspaceId`. We documented this as "Block C" earlier and shipped Phase 1 of Members + Macros + Tags around it; now it's the elephant.
- **Suggested fix**: separate sprint. SQL: add `workspace_id` to `email_conversations`, `email_accounts`, `email_messages`, `clients`, `integrations`, `ai_settings`, `agent_actions`, `time_entries`, `talent_profiles`. Backfill via `(select id from workspaces where owner_id = client_id)`. Then walk the 17 routes and switch the filter.
- **Effort**: 1+ day (data migration risk + ~20 route refactors)

### C3. `/inbox` runs on demo data + half-built Gmail/Outlook/IMAP fallback chain
- **Location**: [app/inbox/page.js](app/inbox/page.js) (2,820 lines)
- **Severity**: CRITICAL for production readiness
- **What happens**: When a user opens the inbox, the page tries `/api/gmail/threads` → `/api/outlook/threads` → `/api/custom-email/threads` and falls back to a hard-coded `DEMO_THREADS` array (lines 52-78). Demo customer data and demo messages are also hard-coded. Reply via macro inserts macro body into a contentEditable but doesn't persist anything to the workspace's data store. There is no `tickets` table; `email_conversations` is only populated by the inbound IMAP webhook flow (custom mailboxes only). Gmail/Outlook threads have IDs that don't match any database row, so per-thread features (tags, status, assignment, etc.) can't attach to them.
- **Suggested fix**: agree on whether `email_conversations` becomes the universal source-of-truth (with an upsert layer for Gmail/Outlook threads) or whether the inbox stays provider-direct. Either way, the demo-data branch and the inbox's local-storage macros need to go before customers see this.
- **Effort**: needs design discussion (this is the real architecture question)

---

## High Priority

### H1. `/settings/email` is a "Page is being built" stub
- **Location**: [app/settings/email/page.js](app/settings/email/page.js) — 38 lines, just shows a Clock icon and the phrase
- **What's missing**: connect Gmail / Outlook / IMAP buttons, see usage, disconnect, switch primary mailbox. The underlying API routes exist (`/api/auth/gmail`, `/api/auth/outlook`, `/api/custom-email/connect`, `/api/email/connect`, `/api/email/usage`) but no UI surfaces them.
- **Effort**: half day

### H2. `/settings/workspace/billing` and `/settings/personal/security` are stubs
- **Location**: [app/settings/[category]/[page]/page.js](app/settings/[category]/[page]/page.js) — both routes hit the catch-all and render a "page is being built" card
- **Effort per page**: 2-4h each (depending on Stripe / 2FA scope)

### H3. `/onboarding` writes to the legacy `ai_settings` table only
- **Location**: [app/onboarding/page.js:45,61,76,89,95](app/onboarding/page.js#L45)
- **What happens**: New user signs up → onboarding → answers fill `ai_settings` (legacy single-user) and a `profiles.onboarding_completed = true` flag. No relation to the new `workspaces` / `macro_onboarding` flows. Two parallel systems.
- **Suggested fix**: decide: keep onboarding alive and redirect it through `workspaces.name` + `macro_onboarding` (the macros wizard now does the equivalent), OR delete `/onboarding` and let `getAuthContext` auto-provision a workspace on first hit (already works).
- **Effort**: 30min (delete route) or 2h (rewire to new system)

### H4. `/signup` does not provision a workspace
- **Location**: [app/signup/page.js](app/signup/page.js) — only calls `supabase.auth.signUp({email, password})`
- **What happens**: A fresh user from `/signup` (not an invite) has an `auth.users` row but no `workspaces` row. They are auto-provisioned on the **first** workspace API call via `lib/auth.js` Path C, but that only runs on workspace-aware routes. Until they hit one, they're in a half-state.
- **Severity**: low surface (auto-provision works) but confusing
- **Effort**: 15min — call `/api/workspaces/repair-membership` after signup success

### H5. `/api/agents` + `/api/agent-actions` are a parallel invite system
- **Location**: [app/api/agents/route.js:19,39](app/api/agents/route.js#L19), [app/api/agent-actions/route.js](app/api/agent-actions/route.js)
- **What happens**: A pre-Users-system invite flow that writes to its own `agents` table scoped by `invited_by = user.id`. Independent from `workspace_members`. The /performance page reads `agent_actions`, so if you remove this without migrating, /performance breaks.
- **Suggested fix**: migrate `agent_actions.user_id` writes to use `workspace_id`, drop `agents` table + `/api/agents` route, switch /performance to read by workspace.
- **Effort**: half day

### H6. `/performance` page reads from Gorgias, not from the app
- **Location**: [app/performance/page.js:572](app/performance/page.js#L572) calls `/api/gorgias/stats`
- **What happens**: Gorgias was an old integration. Page presumably renders nothing for new customers who don't have Gorgias connected.
- **Effort**: half day (rewrite to read from `agent_actions` once H5 is done)

### H7. `/api/parcel-panel` and `/api/parcelpanel` — duplicate routes
- **Location**: `app/api/parcel-panel/{connect,setup,tracking,webhook}/route.js` AND `app/api/parcelpanel/shipments/route.js`
- **What happens**: Two folders, slightly different paths, slightly different schemas (`integrations.parcelpanel_api_key` vs `clients.parcel_panel_api_key`). One uses underscores in column names, the other dashes.
- **Suggested fix**: pick one (`parcel-panel/` is the more recent style, more complete) and delete the other.
- **Effort**: 30min

### H8. `/api/ai/macros` is dead — has hardcoded macro array
- **Location**: [app/api/ai/macros/route.js:7-15](app/api/ai/macros/route.js#L7-L15)
- **What happens**: 8-macro hardcoded list, falls back to it when no `ANTHROPIC_API_KEY`. Predates the real /api/macros system. Probably called by /inbox suggestions but the list returned doesn't match the real workspace's macros.
- **Suggested fix**: delete; /inbox already calls `/api/macros` (line 1892) for the real ones.
- **Effort**: 15min (delete + remove caller)

### H9. `/inbox` reads macros from BOTH `/api/macros` AND `localStorage` with hardcoded fallbacks
- **Location**: [app/inbox/page.js:45-50](app/inbox/page.js#L45-L50) (`loadMacros`, `saveMacrosToStorage`, `FALLBACK_MACROS`)
- **What happens**: Macros stored in browser localStorage with hardcoded sample IDs (`'quality'`, `'closing'`, `'notfound'`). The applyMacro functions don't even use the real DB IDs from `/api/macros`. So macro→tag transfer (Phase 2.5 of Tags) won't work because the macro objects in localStorage don't have real IDs or `tagObjects`.
- **Effort**: 2h (replace localStorage layer with `/api/macros`-only flow)

---

## Medium Priority

### M1. RBAC: `/settings/workspace/general` has no role check
- **Location**: [app/settings/workspace/general/page.js](app/settings/workspace/general/page.js) — no `can.manageWorkspace(role)` gate. The endpoints don't persist anyway (see C1) but the visual UI appears editable to Agents/Observers.
- **Effort**: 15min once C1 is done

### M2. RBAC: `/api/agents`, `/api/agent-actions`, `/api/agent-performance` have no role check
- All three accept any authenticated user. `agent-actions` lets anyone log a fake action.
- **Effort**: 30min (drop in `can.manageMembers` / `can.viewTickets` checks)

### M3. `/value-feed` page exists, no API calls — is it static demo content?
- **Location**: [app/value-feed/page.js](app/value-feed/page.js) (471 lines), zero `/api/` references
- **Status**: Likely full-static design demo. Not necessarily broken, just empty of real data.
- **Effort**: needs design discussion

### M4. `/supply-chain` page only connects to ParcelPanel — heavy "feature" but one-trick
- **Location**: [app/supply-chain/page.js](app/supply-chain/page.js) (931 lines), calls `/api/parcel-panel/connect` + `/api/parcel-panel/tracking`
- **Status**: Works for users who configured ParcelPanel. Empty otherwise.
- **Effort**: ok-as-is

### M5. `/services` is a contact form
- **Location**: [app/services/page.js](app/services/page.js) (495 lines) — phone + message form, no `/api/` reference. Probably submits via `mailto:` or doesn't submit at all.
- **Effort**: 30min (add Resend email-to-team endpoint OR remove if intentional)

### M6. `/settings/personal/profile` (just shipped) — auth metadata sync is best-effort
- **Location**: [app/api/profile/route.js:96-103](app/api/profile/route.js#L96-L103)
- **What it does**: writes `display_name` to user_profiles AND mirrors to `auth.users.raw_user_meta_data`. The mirror is non-fatal — if Supabase auth admin call fails, the profile is saved but the Users page sidebar may still show the old name until next session refresh. Acceptable for now.
- **Effort**: ok-as-is, document it

### M7. `tickets` table does not exist; CLAUDE.md and `lib/db.js` reference it
- **Location**: [CLAUDE.md](CLAUDE.md) (workspace-owned tables list), [lib/db.js:9](lib/db.js#L9)
- **Effort**: 15min (update docs to say `email_conversations` is the real ticket store, OR resolve with the bigger inbox-architecture decision under C3)

### M8. `macros.tags` text[] column kept as backup, never cleaned up
- **Location**: schema migration `20260505_macros.sql`
- **Status**: known. Phase 4 cleanup once `macro_tags` is fully verified.
- **Effort**: 15min (drop column) — defer until tags-write paths confirmed in production

### M9. `/api/translate` exists alongside `/api/ai/translate`
- **Location**: [app/api/translate/route.js](app/api/translate/route.js) and [app/api/ai/translate/route.js](app/api/ai/translate/route.js)
- **Effort**: 15min (find which is called, delete the other)

### M10. `/admin` (1172 lines) is the agency-side panel — not a customer feature
- **Location**: [app/admin/page.js](app/admin/page.js)
- **Status**: locked to `info@lynqagency.com` by hardcoded email check at line 11. Works in isolation. Not in scope of customer-facing audit.

### M11. `proxy.js` middleware blocks `/api/*` without Bearer — but lets `/api/auth/`, `/api/webhooks/`, `/api/whop/webhook`, `/api/invites/` through
- **Location**: [proxy.js](proxy.js)
- **Status**: working as designed. Worth a sanity-check that no future endpoint is silently public when it shouldn't be.
- **Effort**: 10min audit, no immediate change

---

## Low Priority

### L1. `/privacy` page styled in dark theme only
- **Location**: [app/privacy/page.js](app/privacy/page.js) — hardcoded `background: '#1C0F36'`. Standalone marketing-style page, not part of the dashboard. OK.

### L2. Several `/api/admin/*` routes (`migrate-users`, `seed-demo`) are one-off scripts
- Useful, but they're sitting in `app/api/admin/` for the agency. No customer impact.

### L3. `/api/exams/*` — Academy exam endpoints
- Working as designed for the certification flow. Check that they scope by user (they do). No customer-data risk.

### L4. `/api/whop/webhook/route.js` exists but feature-flagged
- Per CLAUDE.md `PAYMENTS_ENABLED=true` env var. Inactive until enabled. OK.

### L5. `lib/db.js` `scoped()` helper is unused everywhere
- **Location**: [lib/db.js](lib/db.js)
- **Status**: was meant to enforce workspace_id filtering at write-time. Tags + Macros + Members routes write `.eq('workspace_id', ctx.workspaceId)` inline instead. Helper is dead code; keeping it for the documentation value.

### L6. `app/components/Sidebar.js` — themes toggle button at line 319 — does it actually switch CSS?
- Has a `toggle()` handler. Probably client-side only (CSS variables). Profile-page theme is saved but doesn't apply. The sidebar toggle and the profile theme setting are not synchronized — two separate "theme" controls.
- **Effort**: 1h (consolidate)

### L7. `/api/workspaces/current/members/[id]/route.js` DELETE accepts `?type=invite` legacy path
- Only kept for backwards compat. The UI now uses `/api/workspaces/current/invites/[id]` (Feature 1). Could be removed.
- **Effort**: 5min

### L8. `/onboarding` writes `profiles.onboarding_completed = true` but nothing checks the flag
- Dead-write. The check probably moved to `getAuthContext`'s auto-provision.
- **Effort**: 15min (verify + remove if confirmed dead)

---

## Page-by-Page Detail

### `/` (root)
- Status: WORKING — redirects via `app/page.tsx`

### `/home`
- Status: WORKING (for owner with Shopify connected)
- Loads: YES
- Data: `/api/shopify/{kpis,orders,refunds}` + `/api/ai/chat`
- Save flows: N/A (read-only dashboard)
- RBAC: filters by `user.id` in shopify endpoints; Agent sees their own (empty) data — see C2
- Bugs: legacy single-tenant scoping (C2)

### `/inbox`
- Status: PARTIALLY BROKEN (see C3)
- Loads: YES
- Data: `/api/gmail/threads` || `/api/outlook/threads` || `/api/custom-email/threads` || `DEMO_THREADS` hardcoded
- Macros: real `/api/macros` AT line 1892 + localStorage shadow with hardcoded fallback IDs (H9)
- Save flows: send via `/api/gmail/send` etc. — those work for connected mailboxes
- Bugs: 2820 LOC monolith, demo customer/orders, no real ticket persistence

### `/inbox/create`
- Status: WORKING for connected mailboxes
- New thread compose UI inside CreateTicketView; macro insert via DOM mutation

### `/analytics`
- Status: PARTIALLY BROKEN
- Loads: YES
- Data: `/api/shopify/{kpis,refunds,revenue-trend}` (legacy client_id), `/api/analytics/{actions,refund-insights}`
- Bugs: C2 legacy scoping. AI insights via Anthropic work for the connected user but invites won't see anything.

### `/performance`
- Status: PARTIALLY BROKEN (H6)
- Loads: YES
- Data: `/api/gorgias/stats` only
- Bugs: relies entirely on the deprecated Gorgias integration

### `/time-tracking`
- Status: PARTIALLY BROKEN
- Loads: YES, save persists via `/api/time` POST/PATCH/DELETE
- RBAC + scoping: every entry tied to `user.id` (per-user, not per-workspace) — Owner sees only their own time, can't review Agent time

### `/value-feed`
- Status: STUB (M3)
- 471 lines of UI, no API calls — static design

### `/supply-chain`
- Status: WORKING for ParcelPanel users
- Loads: YES, `/api/parcel-panel/{connect,tracking}` (M4)

### `/academy`
- Status: WORKING
- Loads: YES, `/api/exams/{questions,submit,result}` + `/api/academy/{access,purchase}`
- Save flows: exam submission persists, certificate generation works

### `/services`
- Status: STUB (M5)
- Form with no submit endpoint visible

### `/settings/workspace/general`
- Status: BROKEN (C1)
- Save buttons fire toasts only — no persistence
- RBAC: no role gate (M1)

### `/settings/workspace/members` (Users)
- Status: WORKING (Phase 1+2+3+5+6 features all shipped)
- All flows: invite, accept, role change, remove, regenerate

### `/settings/workspace/macros`
- Status: WORKING (Phase 1 + Phase 2 AI generator)
- Bugs: rendering legacy `tags` text[] in some rows pre-Phase 1 migration (M8)

### `/settings/workspace/macros/new` + `/[id]`
- Status: WORKING — shared MacroEditor, contentEditable rich-text, Tag picker (Phase 1)

### `/settings/workspace/macros/generate` (wizard)
- Status: WORKING (4-step wizard, Claude API, ~50 macros generated, store-name prefix)

### `/settings/workspace/tags`
- Status: WORKING (Phase 1: list, search, bulk merge, create/edit/delete modals)

### `/settings/workspace/billing`
- Status: STUB (catch-all "page is being built") (H2)

### `/settings/email`
- Status: STUB ("page is being built") (H1)

### `/settings/integrations/shopify`
- Status: handled by catch-all? Let me re-check. Actually — `personal/profile` and `personal/security` are in VALID set; `integrations/shopify` is VALID too. Both stub.

### `/settings/personal/profile`
- Status: WORKING (just shipped)
- Save persists name/bio/theme to `user_profiles`, mirrors to auth.users.raw_user_meta_data
- Avatar upload to Supabase Storage with public URL
- Theme switching: saved but not visually applied (per spec) (L6)

### `/settings/personal/security`
- Status: STUB (H2)

### `/login`
- Status: WORKING (recently fixed: anon-key auth client + readable inputs)
- Bug: doesn't honor `?redirect=` param — known gap

### `/signup`
- Status: PARTIAL (H4) — creates auth user but no workspace until first workspace API hit

### `/invites/[token]`
- Status: WORKING (Feature 5: 4 states A/B/C/D, public access via proxy.js)

### `/invites/[token]/signup`
- Status: WORKING (Feature 5: signup-via-invite with locked email + auto-accept)

### `/onboarding`
- Status: PARTIAL (H3) — writes to legacy ai_settings + profiles.onboarding_completed; not in current invite/auto-provision flow

### `/admin`
- Status: WORKING (agency-only, locked to info@lynqagency.com)

### `/privacy`
- Status: WORKING (static legal doc)

---

## Dead Code / Cleanup Candidates

| Path | Reason |
|---|---|
| `app/api/agents/route.js` | Pre-Users-system invite flow scoped by `invited_by = user.id`. Consumers (only /performance via agent_actions) should be migrated to workspace_members + a workspace-scoped agent_actions. |
| `app/api/ai/macros/route.js` | Hardcoded 8-macro fallback. Real macros now in `/api/macros`. (H8) |
| `app/api/translate/route.js` | Duplicate of `/api/ai/translate` (M9) |
| `app/api/parcelpanel/shipments/route.js` | Older spelling; conflicts with `/api/parcel-panel/*` (H7) |
| `app/api/gorgias/*` (5 routes) | Deprecated integration. /performance is the only consumer. |
| `lib/db.js` `scoped()` helper | Never imported anywhere (L5) |
| `app/api/workspaces/current/members/[id]/route.js` `?type=invite` branch | Replaced by `/api/workspaces/current/invites/[id]` (L7) |
| `app/onboarding/page.js` | Likely superseded by auto-provision + macros wizard (H3) |

## Database vs Code Mismatches

| Item | Status |
|---|---|
| `tickets` table | Referenced in CLAUDE.md and `lib/db.js` example, doesn't exist (M7) |
| `macros.tags` text[] | Migrated to `macro_tags` join, kept as backup (M8) |
| `client_id = user.id` scoping in 17 routes | Should be `workspace_id = ctx.workspaceId` (C2) |
| `agent_actions.user_id` (legacy single-user) | Should be `workspace_id` |
| `email_conversations.client_id` | Should be `workspace_id` |
| `clients` table | Legacy single-tenant table; data should migrate to `workspaces` + per-workspace integration tables |

## Recommended Sequence

If picking the highest-leverage fix from this report, do them in this order:

1. **C1** — fix `/settings/workspace/general` Save (1/2 day)
2. **H1 + H2** — build out `/settings/email`, `/settings/workspace/billing`, `/settings/personal/security` (1.5 days)
3. **H7 + H8 + M9 + L7** — dead-code sweep (2h)
4. **C2** — Block C: workspace_id migration of all data tables (1+ day, separate sprint)
5. **C3** — inbox architecture decision (design discussion before coding)
6. **H5 + H6** — agents/agent-actions consolidation (half day, after C2)
7. **H9** — inbox macros use the real API, not localStorage (2h)

Total surface that needs fixing before the product is multi-tenant-clean: roughly 4-5 working days plus one architecture conversation.
