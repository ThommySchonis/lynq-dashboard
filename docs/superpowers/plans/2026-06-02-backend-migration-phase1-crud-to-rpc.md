# Phase 1: CRUD Routes → Postgres DB Functions (RPC)

## Goal
Migrate simple CRUD API routes from Next.js to Postgres DB Functions called directly from the frontend via `supabase.rpc()`. This eliminates the HTTP layer entirely for straightforward operations.

## Architecture Decision

**Frontend → `supabase.rpc()` directly** (not through Hono).

Each DB function uses `SECURITY DEFINER` + `auth.uid()` to:
1. Identify the authenticated user from the JWT
2. Look up workspace membership (where needed)
3. Perform the CRUD operation
4. Return JSON result

The frontend Supabase client already has the user's session token — no Bearer header plumbing needed.

**Pattern:**
```sql
CREATE OR REPLACE FUNCTION api_create_tag(p_name text, p_color text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_result json;
BEGIN
  -- Get workspace from membership
  SELECT workspace_id INTO v_workspace_id
  FROM workspace_members
  WHERE user_id = v_user_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'No workspace membership found';
  END IF;

  -- Do the work
  INSERT INTO tags (workspace_id, name, color)
  VALUES (v_workspace_id, p_name, p_color)
  RETURNING json_build_object('id', id, 'name', name, 'color', color) INTO v_result;

  RETURN v_result;
END;
$$;
```

**Frontend hook pattern:**
```ts
// Before (Next.js API route)
const res = await fetch('/api/tags', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name, color }),
})

// After (direct RPC)
const { data, error } = await supabase.rpc('api_create_tag', { p_name: name, p_color: color })
```

## Scope

### Phase 1a: Simplest CRUD (3 route groups, ~4 routes)
Low-risk, establish the pattern.

| Route | Methods | DB Function(s) |
|-------|---------|----------------|
| `feedback` | POST | `api_submit_feedback` |
| `settings/brand` | GET, POST | `api_get_brand_settings`, `api_save_brand_settings` |
| `onboarding/status` | GET | `api_get_onboarding_status` |

### Phase 1b: Tags (5 routes CRUD + 1 merge → Hono)

| Route | Methods | Target |
|-------|---------|--------|
| `tags` | GET | `api_list_tags` (DB Function) |
| `tags` | POST | `api_create_tag` (DB Function) |
| `tags/[id]` | GET | `api_get_tag` (DB Function) |
| `tags/[id]` | PATCH | `api_update_tag` (DB Function) |
| `tags/[id]` | DELETE | `api_delete_tag` (DB Function) |
| `tags/merge` | POST | Hono route (multi-step transaction logic) |

### Phase 1c: Tasks (4 routes CRUD)
`tasks/generate` stays in Next.js (algorithmic but complex, move later).

| Route | Methods | DB Function(s) |
|-------|---------|----------------|
| `tasks` | GET | `api_list_tasks` |
| `tasks` | POST | `api_create_task` |
| `tasks/[id]` | PATCH | `api_update_task` |
| `tasks/[id]` | DELETE | `api_delete_task` (soft delete) |

### Phase 1d: Profile (2 routes RPC + 2 avatar → Hono)

| Route | Methods | Target |
|-------|---------|--------|
| `profile` | GET | `api_get_profile` (DB Function) |
| `profile` | PATCH | `api_update_profile` (DB Function) |
| `profile/avatar` | POST | Hono route (Supabase Storage upload) |
| `profile/avatar` | DELETE | Hono route (Supabase Storage delete) |

### Phase 1e: Marketplace (5 routes RPC)

| Route | Methods | DB Function(s) |
|-------|---------|----------------|
| `marketplace/candidates` | GET | `api_list_candidates` |
| `marketplace/candidates/[id]` | GET | `api_get_candidate` |
| `marketplace/profile` | GET | `api_get_marketplace_profile` |
| `marketplace/profile` | POST | `api_save_marketplace_profile` |
| `marketplace/purchase` | POST | `api_purchase_candidate` |

### Phase 1f: Macros CRUD (7 routes RPC, excluding generate)
`macros/generate` stays in Next.js (Claude API).

| Route | Methods | DB Function(s) |
|-------|---------|----------------|
| `macros` | GET | `api_list_macros` |
| `macros` | POST | `api_create_macro` |
| `macros/[id]` | GET | `api_get_macro` |
| `macros/[id]` | PATCH | `api_update_macro` |
| `macros/[id]` | DELETE | `api_delete_macro` |
| `macros/[id]/archive` | POST | `api_archive_macro` |
| `macros/[id]/restore` | POST | `api_restore_macro` |
| `macros/[id]/duplicate` | POST | `api_duplicate_macro` |
| `macros/onboarding` | GET | `api_get_macro_onboarding` |
| `macros/onboarding` | POST | `api_save_macro_onboarding` |

**Note:** Tag sync during macro create/update (`ensureTagsByName` + `syncMacroTags`) will be handled inside the DB function. This is actually cleaner in SQL — a single transaction with INSERT ON CONFLICT for tag creation and DELETE+INSERT for junction table sync.

### Hono routes (Phase 1 scope)
These move to the Hono Edge Function because they need file I/O or external HTTP calls:

| Route | Reason |
|-------|--------|
| `tags/merge` | Multi-step: validate ownership, reassign macros, delete losers |
| `profile/avatar` POST | Supabase Storage upload (multipart form) |
| `profile/avatar` DELETE | Supabase Storage delete |

### Stays in Next.js (not Phase 1)
| Route | Reason |
|-------|--------|
| `macros/generate` | Claude API |
| `tasks/generate` | Complex algorithmic pattern detection |
| `translate` | Claude API |
| `analytics/refund-insights` | Claude API |
| `analytics/export` | PDF/CSV generation |
| `time` | Complex state machine + multi-view auth |
| `stores` DELETE | Shopify token revocation (external HTTP) |
| `academy` | Billing service dependency |

## Implementation Order

### Task 0: Helper — workspace lookup function
Shared helper used by all RPC functions to avoid repeating workspace lookup.

```sql
CREATE OR REPLACE FUNCTION get_user_workspace_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM workspace_members
  WHERE user_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'NO_WORKSPACE' USING HINT = 'User has no active workspace membership';
  END IF;

  RETURN v_workspace_id;
END;
$$;
```

### Task 1: Frontend RPC helper
Create `lib/rpc.ts` — typed wrapper around `supabase.rpc()` with error handling that matches existing hook patterns (throws Error with message).

```ts
import { supabase } from '@/lib/supabase'

export async function rpc<T>(fn: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params)
  if (error) throw new Error(error.message)
  return data as T
}
```

### Task 2: Phase 1a — Simplest DB functions
One migration file with: `api_submit_feedback`, `api_get_brand_settings`, `api_save_brand_settings`, `api_get_onboarding_status`.
Update hooks to use `rpc()`.

### Task 3: Phase 1b — Tags DB functions + Hono merge
Migration with: `api_list_tags`, `api_create_tag`, `api_get_tag`, `api_update_tag`, `api_delete_tag`.
Hono route for `tags/merge`.
Update tag hooks.

### Task 4: Phase 1c — Tasks DB functions
Migration with: `api_list_tasks`, `api_create_task`, `api_update_task`, `api_delete_task`.
Update task hooks.

### Task 5: Phase 1d — Profile DB functions + Hono avatar
Migration with: `api_get_profile`, `api_update_profile`.
Hono routes for avatar upload/delete.
Update profile hooks.

### Task 6: Phase 1e — Marketplace DB functions
Migration with: `api_list_candidates`, `api_get_candidate`, `api_get_marketplace_profile`, `api_save_marketplace_profile`, `api_purchase_candidate`.
Update marketplace hooks (if they exist) or note for future.

### Task 7: Phase 1f — Macros DB functions
Migration with: `api_list_macros`, `api_create_macro`, `api_get_macro`, `api_update_macro`, `api_delete_macro`, `api_archive_macro`, `api_restore_macro`, `api_duplicate_macro`, `api_get_macro_onboarding`, `api_save_macro_onboarding`.
Tag sync logic inside `api_create_macro` and `api_update_macro`.
Update macro hooks.

### Task 8: Hono routes for tags/merge + profile/avatar
Add routes to `supabase/functions/api/`:
- `routes/tags.ts` — merge endpoint only
- `routes/profile.ts` — avatar upload/delete
Update `index.ts` to register routes.
Update `apiUrl()` route map.

### Task 9: Integration testing
- Test each RPC function via frontend hooks
- Verify Hono routes work
- Check that old Next.js routes still work (no breaking changes during transition)

### Task 10: Cleanup (after verification)
- Remove migrated Next.js API route files
- Update `apiUrl()` if any Hono routes were added

## Key Decisions

1. **`SECURITY DEFINER` + `auth.uid()`**: Functions execute with the definer's privileges but use the caller's JWT for auth. This means they bypass RLS (which is fine — the function enforces workspace scoping internally).

2. **`SET search_path = public`**: Required with `SECURITY DEFINER` to prevent search_path injection attacks.

3. **Function naming: `api_*` prefix**: Distinguishes migration-created functions from existing analytics functions (`get_*`). Clear namespace.

4. **Single workspace assumption**: `get_user_workspace_id()` returns the first active workspace. This matches the current app behavior (users belong to one workspace). If multi-workspace support is added later, this becomes a parameter.

5. **Gradual rollout**: Both old Next.js routes and new RPC calls can coexist. Hooks switch one at a time. Old routes are only deleted after verification.

6. **Error handling**: Postgres `RAISE EXCEPTION` maps to `{ error: { message } }` in Supabase client, which hooks already handle via `if (error) throw new Error(error.message)`.

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| RPC function bugs bypass RLS | All functions enforce workspace_id internally; prefix with `api_` for easy auditing |
| Breaking existing functionality | Old routes stay until new path is verified; hooks switch individually |
| Complex SQL for macro tag sync | Test thoroughly; can fall back to Hono route if SQL gets unwieldy |
| `auth.uid()` returns null for anon | Functions check explicitly and raise clear error |
| Multi-workspace users | `get_user_workspace_id()` uses LIMIT 1 — same as current behavior. Parameterize later if needed |

## Success Criteria
- [ ] All Phase 1a-1f DB functions created and deployed
- [ ] Frontend hooks call RPC directly (no fetch to /api/)
- [ ] Hono routes for tags/merge and profile/avatar working
- [ ] Old Next.js routes still functional (parallel operation)
- [ ] No data leaks — workspace scoping verified in every function
