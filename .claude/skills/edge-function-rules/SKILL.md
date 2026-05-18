---
name: edge-function-rules
description: MUST invoke before creating or editing any Supabase Edge Function in supabase/functions/
---

# Edge Function Rules

## Runtime
- Deno runtime — not Node.js, not Next.js
- TypeScript with Deno-compatible imports: `https://esm.sh/` for npm packages, `https://deno.land/x/` for Deno-native modules (both are valid)
- Supabase client: `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` (project convention — `esm.sh`, not `jsr:`)
- Environment variables via `Deno.env.get('VAR_NAME')`

## Structure
- Self-contained — never import from `lib/`, `app/`, or any Next.js code
- Each function in its own directory: `supabase/functions/<function-name>/index.ts`
- Excluded from project `tsconfig.json` (Deno TS is incompatible with Next.js TS)

## HTTP
- Handle CORS headers for HTTP-triggered functions
- Error responses as JSON with appropriate HTTP status codes

## When to Use
- Use for: webhook receivers, cron/scheduled jobs, operations independent of Next.js
- Do NOT use for: user-initiated requests (use Next.js API routes instead)

## Deployment
- Test locally with `supabase functions serve`
- Deploy with `supabase functions deploy <function-name>`
