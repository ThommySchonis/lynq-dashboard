---
name: supabase-auth-rules
description: MUST invoke before touching auth, Supabase clients, workspace scoping, or RLS reasoning — lib/auth.ts, lib/supabase*.ts, supabase/functions/api/middleware/auth.ts, or any query against a workspace-scoped table
---

# Supabase Auth & Workspace Scoping

## Two Supabase clients — never mix them up
- **Admin client** — service-role key, **bypasses RLS**. Server-only. Used for writes and privileged reads.
  - Next.js: `supabaseAdmin` from `lib/supabaseAdmin.ts`
  - Hono: `getAdminClient()` from `supabase/functions/api/lib/supabase.ts`
- **Auth client** — anon key, used ONLY for JWT validation (`auth.getUser(token)`), never for DB ops.
  - Hono: `getAuthClient()` / `getUserFromToken()`
- **Public client** — `lib/supabase.ts`, anon key, browser-side session handling only.

## The auth flow (end to end)
1. Client signs in via Supabase Auth; session persists in the browser. Components read it via `useAuthStore(s => s.session)`.
2. Frontend sends `Authorization: Bearer <token>` on every API request.
3. Server validates the token:
   - **Next.js routes:** `getAuthContext(request)` (`lib/auth.ts`)
   - **Hono routes:** `authMiddleware` (`supabase/functions/api/middleware/auth.ts`) → sets `c.set('authContext', ctx)`
4. Workspace membership is resolved (two paths):
   - **Existing member:** join `workspace_members` → `workspaces`, get workspace id + role.
   - **New user:** RPC `provision_workspace` atomically creates workspace + membership + profile, returns it.
5. User deletion status loaded from `user_profiles.scheduled_for_deletion_at`.
6. Admin-only impersonation: if an impersonation cookie is present and the caller is admin, the `impersonation_sessions` table is checked and context is swapped.

## Always use the auth context helper
- Next.js routes: `const ctx = await getAuthContext(request)` → `{ user, workspace, workspaceId, role, memberId }`. Returns null when unauthorized.
- Hono routes: `const ctx = c.get('authContext') as AuthContext`.
- **Never** call `getUserFromToken()` directly in a route — always go through `getAuthContext` / `authMiddleware`.

## Roles
Four roles in `workspace_members.role`: `owner`, `admin`, `agent`, `observer`. Use `can.*` capability checks — `lib/permissions.ts` (Next.js) / `supabase/functions/api/lib/permissions.ts` (Hono). Never compare role strings inline.

## Workspace Scoping (THE mandatory rule — single source of truth)
Every table with a `workspace_id` column MUST be queried with a `workspace_id` filter. Omitting it leaks data across workspaces. Use `ctx.workspaceId` via `scoped()` from `lib/db.ts` or an explicit `.eq("workspace_id", ctx.workspaceId)`.

**Workspace-scoped tables:** `workspace_members`, `workspace_invites`, `clients`, `integrations`, `email_accounts`, `email_conversations`, `email_messages`, `conversation_notes`, `shopify_orders`, `shipments`, `analytics_actions`, `ai_settings`, `time_sessions`, `time_session_edits`, `macros`, `macro_onboarding`, `tags`, `team_members`, `tasks`, `feedback_submissions`, `workspace_subscriptions`, `usage_counters`, `invoices`, `billing_info`, `payment_methods`, `workspace_addons`, `workspace_deletion_log`, `oauth_states`, `stores`. **Any new table with `workspace_id` follows the same rule.**

## RLS gotchas (reasoning, not authoring — for authoring see db-rules)
- **Do not call `get_user_workspace_id()` inside RLS predicates.** It RAISEs for non-members (e.g. the admin), which makes every policy throw. Use a `workspace_members` subquery instead: `workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())`.
- The admin client bypasses RLS entirely — if a server query "works" but the same query fails client-side, suspect a missing/incorrect RLS policy, not the query.
