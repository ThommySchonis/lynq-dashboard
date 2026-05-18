---
name: migration-rules
description: MUST invoke before any database schema change — new tables, column changes, stored functions, RLS policies, indexes
---

# Database Migration Rules

## Creating Migrations
- Always generate migration file: `supabase migration new <descriptive-name>`
- Write SQL in the generated file at `supabase/migrations/<timestamp>_<name>.sql`
- Never run SQL directly in Supabase SQL Editor, psql, or any SQL terminal

## Applying Migrations
- Apply to remote: `supabase db push`
- Apply to local: `supabase db reset`
- Test migrations locally before pushing to remote

## Naming
- Use descriptive kebab-case (e.g., `add-draft-orders-table`, `update-get-kpis-function`, `add-rls-policy-tickets`)

## Table Requirements
- All new tables must have a `workspace_id` column
- All new tables must have RLS enabled with appropriate policies

## Best Practices
- Heavy aggregations should use PostgreSQL stored functions (see existing examples in `supabase/migrations/`)
- For stored functions: include `CREATE OR REPLACE FUNCTION` so migrations are idempotent
