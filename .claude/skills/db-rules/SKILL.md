---
name: db-rules
description: MUST invoke before any database change — new tables, column changes, stored functions, RLS policies, or indexes in supabase/migrations/
---

# Database Migration & SQL Rules

## Creating Migrations
- Always generate the file: `supabase migration new <descriptive-name>`
- Write SQL in `supabase/migrations/<timestamp>_<name>.sql`
- **Never** run SQL directly in the Supabase SQL Editor, psql, or any SQL terminal
- Naming: descriptive kebab-case (`add-draft-orders-table`, `update-get-kpis-function`, `add-rls-policy-tickets`)

## Applying Migrations
- Remote: `supabase db push`
- Local: `supabase db reset` (or `supabase migration up --local`)
- Remote and local are independent — pushing to remote does NOT apply locally and vice versa.
- Test locally before pushing. For the deploy sequence, see `deployment-rules`.

## Table Requirements
- All new tables MUST have a `workspace_id` column.
- All new tables MUST have RLS enabled with appropriate policies.
- See `supabase-auth-rules` for the workspace-scoping rule and the full list of workspace-scoped tables.

## Writing RLS Policies
- Scope by membership subquery, NOT a helper that can RAISE:
  ```sql
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  )
  ```
- Do **not** use `get_user_workspace_id()` in a policy predicate — it RAISEs for non-members and breaks the policy for admins. (See `supabase-auth-rules`.)

## Stored Functions
- Heavy aggregations (e.g. over `shopify_orders`) belong in PostgreSQL stored functions, not app code.
- Always `CREATE OR REPLACE FUNCTION` so migrations are idempotent.

### SETOF → JSON aggregation pitfall
When wrapping a table-returning function inside `json_build_object` (the `api_*` wrapper pattern), you MUST aggregate explicitly. The naive form silently returns only the first row, or errors with "more than one row returned by a subquery used as an expression":
```sql
-- WRONG
return (select json_build_object('data', my_setof_function(...)));

-- RIGHT
return (select json_build_object('data',
  coalesce(
    (select json_agg(row_to_json(t)) from my_setof_function(...) t),
    '[]'::json
  )
));
```

## AI-settings RPC pattern (SECURITY DEFINER)
CRUD for AI agent settings tables (`ai_policies`, `ai_scenarios`, `ai_autonomy_rules`, `ai_lessons`, `ai_examples`) is done with Postgres `SECURITY DEFINER` functions in `supabase/migrations/`, called from the frontend via `lib/rpc.ts` — NOT via Hono routes. New endpoints for this area follow the same RPC pattern. Such functions must enforce workspace scoping internally (they run with elevated privilege).
