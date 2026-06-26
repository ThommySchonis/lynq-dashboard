# Lynq MCP Server — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a hosted, token-authenticated MCP server at `/api/v1/mcp` that exposes a first real inbox tool, with a token store and `AuthContext` resolution that the Phase 2 OAuth front door will issue against.

**Architecture:** A self-contained `mcp/` folder holds the MCP server (built with Vercel's `mcp-handler` + `@modelcontextprotocol/sdk`). A thin Next.js route at `app/api/v1/[transport]/route.ts` wraps it with `withMcpAuth`, which verifies an opaque bearer access token via `lib/services/mcp-auth.ts` → the existing workspace-scoped `AuthContext`. Tokens live in a new Supabase token store. Tools call thin `lib/services/*` data-access functions (workspace-scoped), never re-implementing business logic.

**Tech Stack:** Next.js 16 (App Router, route handlers), `mcp-handler`, `@modelcontextprotocol/sdk`, `zod` (already present), Node `crypto`, Supabase (`supabaseAdmin`), Vitest (new, for the Next.js side).

## Global Constraints

- TypeScript only; **no `any`** — use `unknown`/specific interfaces (ESLint-enforced). — verbatim from CLAUDE.md
- Use the `@/` path alias for all imports (e.g. `@/lib/...`); no `../../../` chains. — verbatim from CLAUDE.md
- Every table with a `workspace_id` column must be queried with a `workspace_id` filter; omitting it leaks data across workspaces. — verbatim from CLAUDE.md
- Routes are thin wrappers (auth → call → JSON); all business logic in `lib/services/*` (pure: accept data, return data, throw on error). — verbatim from CLAUDE.md
- Run `npm run lint` after every task and resolve all errors. — verbatim from CLAUDE.md
- `mcp/` must not import from `app/` or any React/UI module. Dependency direction is `app → mcp → lib/services`. — from design spec §4.1
- All tokens are stored **hashed** (SHA-256); plaintext is returned to the caller exactly once. — from design spec §5.2
- Hosting is Vercel; the MCP route must work as a stateless serverless handler (no in-memory session store). — from design spec §4 / repo `vercel.json`

---

## File Structure

**Create:**
- `vitest.config.ts` — Vitest config for the Next.js side
- `supabase/migrations/20260626120000_mcp_oauth_token_store.sql` — token-store tables
- `lib/services/oauth-tokens.ts` — token crypto + store (create/verify/revoke/rotate)
- `lib/services/oauth-tokens.test.ts` — unit tests
- `lib/services/mcp-auth.ts` — `verifyMcpAccessToken(raw) → AuthContext | null`
- `lib/services/mcp-auth.test.ts` — unit tests
- `lib/services/conversations.ts` — `listConversations(db, workspaceId, filters)`
- `lib/services/conversations.test.ts` — unit tests
- `mcp/types.ts` — `McpToolContext`
- `mcp/instructions.ts` — server instructions string
- `mcp/server.ts` — `registerLynqTools(server, ctx)`
- `mcp/server.test.ts` — tool-registration / handler test
- `app/api/v1/[transport]/route.ts` — MCP HTTP handler (thin)
- `app/.well-known/oauth-protected-resource/route.ts` — protected-resource metadata
- `scripts/mint-mcp-token.ts` — dev helper to mint a token for manual/E2E testing

**Modify:**
- `package.json` — add `test` script + dev deps (`vitest`, `mcp-handler`, `@modelcontextprotocol/sdk`)

---

## Interfaces (locked across tasks)

These names/types are produced by early tasks and consumed by later ones. Use them verbatim.

```ts
// lib/services/oauth-tokens.ts
export interface IssuedTokenPair {
  accessToken: string          // plaintext, e.g. "lynq_at_<base64url>"
  refreshToken: string         // plaintext, e.g. "lynq_rt_<base64url>"
  accessExpiresAt: string      // ISO
  refreshExpiresAt: string     // ISO
  tokenId: string
}
export interface VerifiedToken {
  tokenId: string
  clientId: string
  userId: string
  workspaceId: string
  scope: string | null
}
export function hashToken(raw: string): string
export function generateOpaqueToken(prefix: 'lynq_at' | 'lynq_rt'): string
export async function createTokenPair(
  db: TokenStoreDb,
  args: { clientId: string; userId: string; workspaceId: string; scope?: string | null },
): Promise<IssuedTokenPair>
export async function verifyAccessToken(db: TokenStoreDb, raw: string): Promise<VerifiedToken | null>
export async function revokeToken(db: TokenStoreDb, tokenId: string): Promise<void>
// rotateRefreshToken is intentionally NOT in Phase 1 — it is introduced in
// Phase 2 when the /oauth/token refresh grant first needs it.

// TokenStoreDb is the minimal subset of the supabase client these functions use,
// injected so tests can pass a fake. Defined in oauth-tokens.ts.

// lib/services/mcp-auth.ts
import type { AuthContext } from '@/lib/auth'
export async function verifyMcpAccessToken(raw: string): Promise<AuthContext | null>

// lib/services/conversations.ts
export interface ConversationFilters {
  search?: string; status?: string; storeId?: string
  emailAccountId?: string; unlinked?: boolean; spam?: boolean; page?: number
}
export interface ConversationSummary {
  id: string; subject: string | null; customer_email: string | null
  customer_name: string | null; status: string; last_message_at: string | null
  store_name: string | null; tags: string[]
}
export async function listConversations(
  db: ConversationsDb, workspaceId: string, filters: ConversationFilters,
): Promise<ConversationSummary[]>

// mcp/types.ts
export interface McpToolContext { userId: string; workspaceId: string; role: string }

// mcp/server.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
export function registerLynqTools(server: McpServer, ctx: McpToolContext): void
```

---

### Task 1: Vitest setup for the Next.js side

**Files:**
- Modify: `package.json` (scripts + devDependencies)
- Create: `vitest.config.ts`
- Create: `lib/services/__smoke__.test.ts` (temporary, deleted at end of task)

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` command that runs `*.test.ts` under `lib/` and `mcp/`

- [ ] **Step 1: Install Vitest as a dev dependency**

```bash
npm install -D vitest@^3
```

- [ ] **Step 2: Add the test script to package.json**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'mcp/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Write a temporary smoke test**

`lib/services/__smoke__.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('vitest setup', () => {
  it('runs and resolves @ alias config', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run the smoke test**

Run: `npm test`
Expected: PASS (1 test). Confirms the runner + config work.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm lib/services/__smoke__.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test runner for the next.js side"
```

---

### Task 2: Token-store migration

**Files:**
- Create: `supabase/migrations/20260626120000_mcp_oauth_token_store.sql`

**Interfaces:**
- Consumes: nothing
- Produces: tables `oauth_clients`, `oauth_authorization_codes`, `oauth_tokens` used by Tasks 3–4 and Phase 2

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260626120000_mcp_oauth_token_store.sql`:

```sql
-- MCP / OAuth token store. Managed exclusively by the service role
-- (supabaseAdmin bypasses RLS). RLS is enabled with NO policies, so
-- anon/authenticated roles cannot read or write these tables directly.

create table if not exists oauth_clients (
  client_id                  text primary key,
  client_name                text not null,
  redirect_uris              text[] not null default '{}',
  token_endpoint_auth_method text not null default 'none',
  created_at                 timestamptz not null default now()
);

create table if not exists oauth_authorization_codes (
  code_hash             text primary key,
  client_id             text not null references oauth_clients(client_id) on delete cascade,
  user_id               uuid not null,
  workspace_id          uuid not null,
  redirect_uri          text not null,
  code_challenge        text not null,
  code_challenge_method text not null default 'S256',
  scope                 text,
  expires_at            timestamptz not null,
  created_at            timestamptz not null default now()
);

create table if not exists oauth_tokens (
  id                  uuid primary key default gen_random_uuid(),
  client_id           text not null references oauth_clients(client_id) on delete cascade,
  user_id             uuid not null,
  workspace_id        uuid not null,
  access_token_hash   text not null unique,
  refresh_token_hash  text unique,
  scope               text,
  access_expires_at   timestamptz not null,
  refresh_expires_at  timestamptz,
  created_at          timestamptz not null default now(),
  last_used_at        timestamptz,
  revoked_at          timestamptz
);

create index if not exists oauth_tokens_access_hash_idx  on oauth_tokens(access_token_hash);
create index if not exists oauth_tokens_refresh_hash_idx on oauth_tokens(refresh_token_hash);
create index if not exists oauth_tokens_user_idx         on oauth_tokens(user_id);
create index if not exists oauth_codes_expires_idx       on oauth_authorization_codes(expires_at);

alter table oauth_clients              enable row level security;
alter table oauth_authorization_codes  enable row level security;
alter table oauth_tokens               enable row level security;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push` (or `npx supabase migration up` against the local/dev DB per repo convention)
Expected: migration applies with no error; three tables created.

- [ ] **Step 3: Verify the tables exist**

Run: `npx supabase db diff` (expect no pending diff) or query `select to_regclass('public.oauth_tokens');`
Expected: returns `oauth_tokens` (not null).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260626120000_mcp_oauth_token_store.sql
git commit -m "feat: add mcp oauth token store migration"
```

---

### Task 3: Token crypto + store service

**Files:**
- Create: `lib/services/oauth-tokens.ts`
- Test: `lib/services/oauth-tokens.test.ts`

**Interfaces:**
- Consumes: `oauth_tokens` table (Task 2)
- Produces: `hashToken`, `generateOpaqueToken`, `createTokenPair`, `verifyAccessToken`, `revokeToken`, types `IssuedTokenPair`, `VerifiedToken`, `TokenStoreDb` (see locked Interfaces). `rotateRefreshToken` is NOT implemented in Phase 1 (deferred to Phase 2).

- [ ] **Step 1: Write failing tests for the pure helpers**

`lib/services/oauth-tokens.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import {
  hashToken, generateOpaqueToken, createTokenPair, verifyAccessToken,
} from '@/lib/services/oauth-tokens'

describe('hashToken', () => {
  it('is deterministic and 64 hex chars (sha-256)', () => {
    const a = hashToken('lynq_at_abc')
    expect(a).toBe(hashToken('lynq_at_abc'))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
  it('differs for different input', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'))
  })
})

describe('generateOpaqueToken', () => {
  it('uses the prefix and is unguessably long and unique', () => {
    const t1 = generateOpaqueToken('lynq_at')
    const t2 = generateOpaqueToken('lynq_at')
    expect(t1.startsWith('lynq_at_')).toBe(true)
    expect(t1).not.toBe(t2)
    expect(t1.length).toBeGreaterThan(40)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- oauth-tokens`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Implement the pure helpers + DB interface**

`lib/services/oauth-tokens.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto'

const ACCESS_TTL_MS = 60 * 60 * 1000          // 1 hour
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface IssuedTokenPair {
  accessToken: string
  refreshToken: string
  accessExpiresAt: string
  refreshExpiresAt: string
  tokenId: string
}

export interface VerifiedToken {
  tokenId: string
  clientId: string
  userId: string
  workspaceId: string
  scope: string | null
}

interface TokenRow {
  id: string
  client_id: string
  user_id: string
  workspace_id: string
  scope: string | null
  access_expires_at: string
  revoked_at: string | null
}

/** Minimal supabase surface these functions use — injected for testability. */
export interface TokenStoreDb {
  from(table: 'oauth_tokens'): {
    insert(row: Record<string, unknown>): { select(cols: string): { single(): Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
    select(cols: string): {
      eq(col: string, val: string): {
        is(col: string, val: null): { maybeSingle(): Promise<{ data: TokenRow | null; error: { message: string } | null }> }
        maybeSingle(): Promise<{ data: TokenRow | null; error: { message: string } | null }>
      }
    }
    update(row: Record<string, unknown>): { eq(col: string, val: string): Promise<{ error: { message: string } | null }> }
  }
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function generateOpaqueToken(prefix: 'lynq_at' | 'lynq_rt'): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`
}

export async function createTokenPair(
  db: TokenStoreDb,
  args: { clientId: string; userId: string; workspaceId: string; scope?: string | null },
): Promise<IssuedTokenPair> {
  const accessToken = generateOpaqueToken('lynq_at')
  const refreshToken = generateOpaqueToken('lynq_rt')
  const now = Date.now()
  const accessExpiresAt = new Date(now + ACCESS_TTL_MS).toISOString()
  const refreshExpiresAt = new Date(now + REFRESH_TTL_MS).toISOString()

  const { data, error } = await db
    .from('oauth_tokens')
    .insert({
      client_id: args.clientId,
      user_id: args.userId,
      workspace_id: args.workspaceId,
      access_token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(refreshToken),
      scope: args.scope ?? null,
      access_expires_at: accessExpiresAt,
      refresh_expires_at: refreshExpiresAt,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`createTokenPair failed: ${error?.message ?? 'no row'}`)
  return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt, tokenId: data.id }
}

export async function verifyAccessToken(db: TokenStoreDb, raw: string): Promise<VerifiedToken | null> {
  if (!raw.startsWith('lynq_at_')) return null
  const { data, error } = await db
    .from('oauth_tokens')
    .select('id, client_id, user_id, workspace_id, scope, access_expires_at, revoked_at')
    .eq('access_token_hash', hashToken(raw))
    .maybeSingle()

  if (error || !data) return null
  if (data.revoked_at) return null
  if (new Date(data.access_expires_at).getTime() <= Date.now()) return null

  // Best-effort last_used_at bump (non-fatal).
  await db.from('oauth_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)

  return {
    tokenId: data.id,
    clientId: data.client_id,
    userId: data.user_id,
    workspaceId: data.workspace_id,
    scope: data.scope,
  }
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run: `npm test -- oauth-tokens`
Expected: PASS (hashToken + generateOpaqueToken describe blocks).

- [ ] **Step 5: Add failing tests for createTokenPair + verifyAccessToken with a fake db**

Append to `lib/services/oauth-tokens.test.ts`:

```ts
function fakeDb(row: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = []
  const db = {
    from() {
      return {
        insert() { return { select() { return { single: async () => ({ data: { id: 'tok_1' }, error: null }) } } } },
        select() {
          return {
            eq() {
              return {
                is() { return { maybeSingle: async () => ({ data: row, error: null }) } },
                maybeSingle: async () => ({ data: row, error: null }),
              }
            },
          }
        },
        update(u: Record<string, unknown>) { updates.push(u); return { eq: async () => ({ error: null }) } },
      }
    },
  }
  return { db: db as unknown as import('@/lib/services/oauth-tokens').TokenStoreDb, updates }
}

describe('createTokenPair', () => {
  it('returns hashed-stored pair with future expiries', async () => {
    const { db } = fakeDb(null)
    const pair = await createTokenPair(db, { clientId: 'c1', userId: 'u1', workspaceId: 'w1' })
    expect(pair.accessToken.startsWith('lynq_at_')).toBe(true)
    expect(pair.refreshToken.startsWith('lynq_rt_')).toBe(true)
    expect(new Date(pair.accessExpiresAt).getTime()).toBeGreaterThan(Date.now())
    expect(pair.tokenId).toBe('tok_1')
  })
})

describe('verifyAccessToken', () => {
  const base = {
    id: 'tok_1', client_id: 'c1', user_id: 'u1', workspace_id: 'w1',
    scope: null, revoked_at: null,
  }
  it('rejects non-access-token prefixes without a db call', async () => {
    const { db } = fakeDb(null)
    expect(await verifyAccessToken(db, 'lynq_rt_x')).toBeNull()
  })
  it('returns context for a valid token and bumps last_used_at', async () => {
    const { db, updates } = fakeDb({ ...base, access_expires_at: new Date(Date.now() + 1000).toISOString() })
    const v = await verifyAccessToken(db, 'lynq_at_valid')
    expect(v?.workspaceId).toBe('w1')
    expect(updates[0]).toHaveProperty('last_used_at')
  })
  it('returns null for an expired token', async () => {
    const { db } = fakeDb({ ...base, access_expires_at: new Date(Date.now() - 1000).toISOString() })
    expect(await verifyAccessToken(db, 'lynq_at_old')).toBeNull()
  })
  it('returns null for a revoked token', async () => {
    const { db } = fakeDb({ ...base, revoked_at: new Date().toISOString(), access_expires_at: new Date(Date.now() + 1000).toISOString() })
    expect(await verifyAccessToken(db, 'lynq_at_revoked')).toBeNull()
  })
})
```

- [ ] **Step 6: Run tests to verify they fail, then pass**

Run: `npm test -- oauth-tokens`
Expected: the new `createTokenPair`/`verifyAccessToken` tests pass against the Step 3 implementation. If any fail, fix the implementation (not the test). All green.

- [ ] **Step 7: Implement `revokeToken`**

Append to `lib/services/oauth-tokens.ts`:

```ts
export async function revokeToken(db: TokenStoreDb, tokenId: string): Promise<void> {
  const { error } = await db
    .from('oauth_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
  if (error) throw new Error(`revokeToken failed: ${error.message}`)
}
```

> Note: `rotateRefreshToken` is intentionally out of Phase 1. It is introduced in Phase 2 where the `/oauth/token` refresh grant first consumes it. Do not add an unimplemented/unused export for it now.

- [ ] **Step 8: Lint, run all tests, commit**

```bash
npm run lint
npm test -- oauth-tokens
git add lib/services/oauth-tokens.ts lib/services/oauth-tokens.test.ts
git commit -m "feat: oauth token crypto + store service"
```

Expected: lint clean, all oauth-tokens tests pass.

---

### Task 4: Token → AuthContext resolution

**Files:**
- Create: `lib/services/mcp-auth.ts`
- Test: `lib/services/mcp-auth.test.ts`

**Interfaces:**
- Consumes: `verifyAccessToken` + `VerifiedToken` (Task 3); `supabaseAdmin` (`@/lib/supabaseAdmin`); `AuthContext`, `AuthWorkspace` types (`@/lib/auth`)
- Produces: `verifyMcpAccessToken(raw) → Promise<AuthContext | null>`

- [ ] **Step 1: Write the failing test**

`lib/services/mcp-auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const verifyAccessToken = vi.fn()
const membershipMaybeSingle = vi.fn()

vi.mock('@/lib/services/oauth-tokens', () => ({ verifyAccessToken: (...a: unknown[]) => verifyAccessToken(...a) }))
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: membershipMaybeSingle }) }) }),
  },
}))

import { verifyMcpAccessToken } from '@/lib/services/mcp-auth'

beforeEach(() => { verifyAccessToken.mockReset(); membershipMaybeSingle.mockReset() })

describe('verifyMcpAccessToken', () => {
  it('returns null when the token is invalid', async () => {
    verifyAccessToken.mockResolvedValue(null)
    expect(await verifyMcpAccessToken('lynq_at_bad')).toBeNull()
  })

  it('builds an AuthContext from the token workspace + membership role', async () => {
    verifyAccessToken.mockResolvedValue({ tokenId: 't', clientId: 'c', userId: 'u1', workspaceId: 'w1', scope: null })
    membershipMaybeSingle.mockResolvedValue({
      data: { id: 'm1', workspace_id: 'w1', role: 'agent', workspaces: { id: 'w1', name: 'Acme', suspended_at: null } },
      error: null,
    })
    const ctx = await verifyMcpAccessToken('lynq_at_ok')
    expect(ctx?.workspaceId).toBe('w1')
    expect(ctx?.role).toBe('agent')
    expect(ctx?.user.id).toBe('u1')
    expect(ctx?.isSuspended).toBe(false)
  })

  it('returns null when the membership workspace mismatches the token workspace', async () => {
    verifyAccessToken.mockResolvedValue({ tokenId: 't', clientId: 'c', userId: 'u1', workspaceId: 'w1', scope: null })
    membershipMaybeSingle.mockResolvedValue({
      data: { id: 'm1', workspace_id: 'w2', role: 'agent', workspaces: { id: 'w2', name: 'Other', suspended_at: null } },
      error: null,
    })
    expect(await verifyMcpAccessToken('lynq_at_ok')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- mcp-auth`
Expected: FAIL — `verifyMcpAccessToken` not found.

- [ ] **Step 3: Implement `verifyMcpAccessToken`**

`lib/services/mcp-auth.ts`:

```ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAccessToken } from '@/lib/services/oauth-tokens'
import type { AuthContext, AuthWorkspace } from '@/lib/auth'

interface MembershipRow {
  id: string
  workspace_id: string
  role: string
  workspaces: AuthWorkspace
}

/**
 * Resolves an MCP bearer access token to the same workspace-scoped AuthContext
 * used by the JWT path. The token's workspace must match the user's current
 * membership; otherwise the token is treated as invalid.
 */
export async function verifyMcpAccessToken(raw: string): Promise<AuthContext | null> {
  const verified = await verifyAccessToken(supabaseAdmin as never, raw)
  if (!verified) return null

  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('id, workspace_id, role, workspaces(id, name, suspended_at)')
    .eq('user_id', verified.userId)
    .maybeSingle()

  if (error || !data) return null
  const membership = data as unknown as MembershipRow
  if (membership.workspace_id !== verified.workspaceId) return null

  return {
    user: { id: verified.userId } as AuthContext['user'],
    workspace: membership.workspaces,
    workspaceId: membership.workspace_id,
    role: membership.role,
    memberId: membership.id,
    isSuspended: !!membership.workspaces.suspended_at,
    scheduledForDeletion: null,
    isImpersonating: false,
    impersonationSessionId: null,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- mcp-auth`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add lib/services/mcp-auth.ts lib/services/mcp-auth.test.ts
git commit -m "feat: resolve mcp access token to workspace AuthContext"
```

---

### Task 5: Conversations data-access service

**Files:**
- Create: `lib/services/conversations.ts`
- Test: `lib/services/conversations.test.ts`

**Interfaces:**
- Consumes: nothing (defines its own injectable `ConversationsDb`)
- Produces: `listConversations(db, workspaceId, filters)`, types `ConversationFilters`, `ConversationSummary`, `ConversationsDb` (see locked Interfaces). Mirrors the Hono `inbox-conversations` list query: table `email_conversations`, scoped by `workspace_id`, `is_spam` excluded unless `spam`, ordered by `last_message_at` desc, page size 50, joins `stores(name)`.

- [ ] **Step 1: Write the failing test**

`lib/services/conversations.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { listConversations } from '@/lib/services/conversations'

/** Records the query chain calls and returns the seeded rows. */
function fakeDb(rows: Record<string, unknown>[]) {
  const calls: Record<string, unknown> = {}
  const q: Record<string, unknown> = {}
  const chain = {
    select: (c: string) => { calls.select = c; return chain },
    eq: (c: string, v: unknown) => { (q[c] = v); return chain },
    neq: (c: string, v: unknown) => { calls[`neq_${c}`] = v; return chain },
    is: (c: string, v: unknown) => { calls[`is_${c}`] = v; return chain },
    order: () => chain,
    range: () => chain,
    then: (res: (r: { data: unknown[]; error: null }) => void) => res({ data: rows, error: null }),
  }
  const db = { from: (t: string) => { calls.table = t; return chain } }
  return { db: db as never, calls, q }
}

describe('listConversations', () => {
  it('scopes by workspace_id and returns mapped summaries', async () => {
    const { db, q } = fakeDb([
      { id: 'c1', subject: 'Hi', customer_email: 'a@b.c', customer_name: 'A', status: 'open',
        last_message_at: '2026-06-26T00:00:00Z', stores: { name: 'Shop' } },
    ])
    const out = await listConversations(db, 'w1', {})
    expect(q.workspace_id).toBe('w1')
    expect(out[0]).toMatchObject({ id: 'c1', store_name: 'Shop', tags: [] })
    expect(out[0]).not.toHaveProperty('stores')
  })

  it('filters by status when provided', async () => {
    const { db, q } = fakeDb([])
    await listConversations(db, 'w1', { status: 'closed' })
    expect(q.status).toBe('closed')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- conversations`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `listConversations`**

`lib/services/conversations.ts`:

```ts
const PAGE_SIZE = 50

export interface ConversationFilters {
  search?: string
  status?: string
  storeId?: string
  emailAccountId?: string
  unlinked?: boolean
  spam?: boolean
  page?: number
}

export interface ConversationSummary {
  id: string
  subject: string | null
  customer_email: string | null
  customer_name: string | null
  status: string
  last_message_at: string | null
  store_name: string | null
  tags: string[]
}

interface QueryChain {
  select(cols: string): QueryChain
  eq(col: string, val: unknown): QueryChain
  neq(col: string, val: unknown): QueryChain
  is(col: string, val: null): QueryChain
  order(col: string, opts: { ascending: boolean }): QueryChain
  range(from: number, to: number): QueryChain
  then(
    onfulfilled: (r: { data: Record<string, unknown>[] | null; error: { message: string } | null }) => unknown,
  ): Promise<unknown>
}

export interface ConversationsDb {
  from(table: 'email_conversations'): QueryChain
}

export async function listConversations(
  db: ConversationsDb,
  workspaceId: string,
  filters: ConversationFilters,
): Promise<ConversationSummary[]> {
  const page = filters.page ?? 0
  let query = db
    .from('email_conversations')
    .select('id, subject, customer_email, customer_name, status, last_message_at, stores(name)')
    .eq('workspace_id', workspaceId)
    .order('last_message_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.spam === true) query = query.eq('is_spam', true)
  else query = query.neq('is_spam', true)
  if (filters.unlinked === true) query = query.is('shopify_customer_id', null).neq('status', 'closed')
  if (filters.storeId) query = query.eq('store_id', filters.storeId)
  if (filters.emailAccountId) query = query.eq('email_account_id', filters.emailAccountId)

  const { data, error } = (await query) as unknown as {
    data: Record<string, unknown>[] | null
    error: { message: string } | null
  }
  if (error) throw new Error(`listConversations failed: ${error.message}`)

  return (data ?? []).map((row): ConversationSummary => {
    const store = row.stores as { name: string } | null
    return {
      id: row.id as string,
      subject: (row.subject as string | null) ?? null,
      customer_email: (row.customer_email as string | null) ?? null,
      customer_name: (row.customer_name as string | null) ?? null,
      status: row.status as string,
      last_message_at: (row.last_message_at as string | null) ?? null,
      store_name: store?.name ?? null,
      tags: [],
    }
  })
}
```

> Note: tag enrichment (the Hono route's `loadTagsByConversation`) is deferred to the tags tool batch in a later phase; `tags` is returned as `[]` for now. This is an intentional Phase 1 simplification, surfaced here so it is not mistaken for full parity.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- conversations`
Expected: PASS (2 tests).

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add lib/services/conversations.ts lib/services/conversations.test.ts
git commit -m "feat: workspace-scoped listConversations service"
```

---

### Task 6: MCP server module (`mcp/`) with the first tool

**Files:**
- Modify: `package.json` (add `mcp-handler`, `@modelcontextprotocol/sdk`)
- Create: `mcp/types.ts`, `mcp/instructions.ts`, `mcp/server.ts`
- Test: `mcp/server.test.ts`

**Interfaces:**
- Consumes: `listConversations`, `ConversationFilters` (Task 5); `supabaseAdmin`; `McpServer` type from the SDK
- Produces: `registerLynqTools(server, ctx)`, `McpToolContext` (see locked Interfaces), `LYNQ_MCP_INSTRUCTIONS`

- [ ] **Step 1: Install the MCP packages**

```bash
npm install mcp-handler @modelcontextprotocol/sdk
```

- [ ] **Step 2: Confirm the installed SDK tool-registration + McpServer API**

Run: `node -e "console.log(Object.keys(require('@modelcontextprotocol/sdk/server/mcp.js')))"`
Expected: includes `McpServer`. Open `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.d.ts` and confirm the registration method name is `registerTool(name, { description, inputSchema }, handler)` (newer SDK) or `tool(name, schema, handler)` (older). Use whichever the installed version exposes in Step 4. The plan code below uses `registerTool`; if the installed version only has `tool`, adapt the single call accordingly (same args, flatter shape).

- [ ] **Step 3: Create `mcp/types.ts` and `mcp/instructions.ts`**

`mcp/types.ts`:

```ts
export interface McpToolContext {
  userId: string
  workspaceId: string
  role: string
}
```

`mcp/instructions.ts`:

```ts
export const LYNQ_MCP_INSTRUCTIONS = `You are operating a Lynq & Flow customer-support workspace on the user's behalf.

Inbox workflow:
- Use list_conversations to find tickets (filter by status, store, or search).
- Read a ticket fully before acting; never invent order details, tracking numbers, or policies you were not given.

When the Emma AI configuration tools are available, read the workspace's AI settings and write replies that match its brand identity, tone, and policies — you are replacing the cloud AI assist, so the on-brand voice must come from those settings, not a generic one.

All actions run with the connecting user's role; if an action is not permitted, report that plainly rather than working around it.`
```

- [ ] **Step 4: Write the failing test for tool registration + handler**

`mcp/server.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listConversations = vi.fn()
vi.mock('@/lib/services/conversations', () => ({
  listConversations: (...a: unknown[]) => listConversations(...a),
}))
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: {} }))

import { registerLynqTools } from '@/mcp/server'
import type { McpToolContext } from '@/mcp/types'

interface Registered { handler: (args: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }> }

function fakeServer() {
  const tools: Record<string, Registered> = {}
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Registered['handler']) => { tools[name] = { handler } },
    tool: (name: string, _schema: unknown, handler: Registered['handler']) => { tools[name] = { handler } },
  }
  return { server, tools }
}

const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'agent' }

beforeEach(() => listConversations.mockReset())

describe('registerLynqTools', () => {
  it('registers list_conversations', () => {
    const { server, tools } = fakeServer()
    registerLynqTools(server as never, ctx)
    expect(tools.list_conversations).toBeDefined()
  })

  it('list_conversations calls the service scoped to the ctx workspace', async () => {
    const { server, tools } = fakeServer()
    listConversations.mockResolvedValue([{ id: 'c1', subject: 'Hi', status: 'open', tags: [] }])
    registerLynqTools(server as never, ctx)
    const res = await tools.list_conversations.handler({ status: 'open' })
    expect(listConversations).toHaveBeenCalledWith(expect.anything(), 'w1', { status: 'open' })
    expect(res.content[0].type).toBe('text')
    expect(res.content[0].text).toContain('c1')
  })

  it('list_conversations returns an error result when the service throws', async () => {
    const { server, tools } = fakeServer()
    listConversations.mockRejectedValue(new Error('boom'))
    registerLynqTools(server as never, ctx)
    const res = await tools.list_conversations.handler({})
    expect(res.isError).toBe(true)
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -- server`
Expected: FAIL — `@/mcp/server` not found.

- [ ] **Step 6: Implement `mcp/server.ts`**

`mcp/server.ts`:

```ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listConversations, type ConversationFilters } from '@/lib/services/conversations'
import type { McpToolContext } from '@/mcp/types'

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const }
}

export function registerLynqTools(server: McpServer, ctx: McpToolContext): void {
  server.registerTool(
    'list_conversations',
    {
      description: 'List inbox conversations in the workspace. Filter by status, store, email account, search text, or unlinked/spam flags.',
      inputSchema: {
        status: z.string().optional(),
        search: z.string().optional(),
        storeId: z.string().optional(),
        emailAccountId: z.string().optional(),
        unlinked: z.boolean().optional(),
        spam: z.boolean().optional(),
        page: z.number().int().min(0).optional(),
      },
    },
    async (args: ConversationFilters) => {
      try {
        const rows = await listConversations(supabaseAdmin as never, ctx.workspaceId, args)
        return ok(rows)
      } catch (e) {
        return fail(`list_conversations failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- server`
Expected: PASS (3 tests). If the installed SDK exposes `tool` instead of `registerTool`, switch the call to `server.tool('list_conversations', { ...zodShape }, handler)` — the fake server supports both, so adapt to the real SDK and re-run.

- [ ] **Step 8: Lint and commit**

```bash
npm run lint
git add package.json package-lock.json mcp/types.ts mcp/instructions.ts mcp/server.ts mcp/server.test.ts
git commit -m "feat: mcp server module with list_conversations tool"
```

---

### Task 7: MCP HTTP route + protected-resource metadata

**Files:**
- Create: `app/api/v1/[transport]/route.ts`
- Create: `app/.well-known/oauth-protected-resource/route.ts`

**Interfaces:**
- Consumes: `createMcpHandler`, `withMcpAuth` from `mcp-handler`; `registerLynqTools`, `LYNQ_MCP_INSTRUCTIONS` (Task 6); `verifyMcpAccessToken` (Task 4)
- Produces: live endpoints `GET/POST /api/v1/mcp` (token-authenticated) and `GET /.well-known/oauth-protected-resource`

- [ ] **Step 1: Confirm the installed `mcp-handler` exports**

Run: `node -e "console.log(Object.keys(require('mcp-handler')))"`
Expected: includes `createMcpHandler`, `withMcpAuth`, `protectedResourceHandler`, `metadataCorsOptionsRequestHandler`. If `protectedResourceHandler` is absent in the installed version, implement the metadata route by hand (Step 4 alt below).

- [ ] **Step 2: Create the MCP route**

`app/api/v1/[transport]/route.ts`:

```ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { registerLynqTools } from '@/mcp/server'
import { LYNQ_MCP_INSTRUCTIONS } from '@/mcp/instructions'
import { verifyMcpAccessToken } from '@/lib/services/mcp-auth'

// Per-request: authenticate, then build a handler whose tools are bound to ctx.
const authedHandler = withMcpAuth(
  createMcpHandler(
    (server, { authInfo }: { authInfo?: AuthInfo }) => {
      const ctx = authInfo?.extra as { userId: string; workspaceId: string; role: string } | undefined
      if (ctx) registerLynqTools(server, ctx)
    },
    { serverInfo: { name: 'lynq-flow', version: '1.0.0' }, instructions: LYNQ_MCP_INSTRUCTIONS },
    { basePath: '/api/v1' },
  ),
  async (_req, bearer): Promise<AuthInfo | undefined> => {
    if (!bearer) return undefined
    const authContext = await verifyMcpAccessToken(bearer)
    if (!authContext) return undefined
    return {
      token: bearer,
      clientId: 'lynq-mcp',
      scopes: [],
      extra: {
        userId: authContext.user.id,
        workspaceId: authContext.workspaceId,
        role: authContext.role,
      },
    }
  },
  { required: true },
)

export { authedHandler as GET, authedHandler as POST }
```

> Note: if the installed `mcp-handler` signature differs (e.g. the second factory arg is `(server) => void` without `authInfo`, and auth context is read from `extra` differently), follow the package's README for `withMcpAuth` + accessing `authInfo` inside the factory. The contract this task must satisfy: **per request, verify the bearer via `verifyMcpAccessToken`; on success register tools bound to `{userId, workspaceId, role}`; on failure return 401.**

- [ ] **Step 3: Create the protected-resource metadata route**

`app/.well-known/oauth-protected-resource/route.ts`:

```ts
import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from 'mcp-handler'

const handler = protectedResourceHandler({
  // The authorization server that issues tokens for this resource.
  // Phase 2 implements these endpoints; the URL is declared now so clients
  // can discover it.
  authServerUrls: [process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.lynq.app'],
})

export { handler as GET }
export const OPTIONS = metadataCorsOptionsRequestHandler()
```

- [ ] **Step 4 (alt, only if Step 1 showed no `protectedResourceHandler`): hand-roll the metadata**

`app/.well-known/oauth-protected-resource/route.ts`:

```ts
import { NextResponse } from 'next/server'

export function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.lynq.app'
  return NextResponse.json({
    resource: `${base}/api/v1/mcp`,
    authorization_servers: [base],
  })
}
```

- [ ] **Step 5: Build to verify the routes compile**

Run: `npm run build`
Expected: build succeeds; the route `/api/v1/[transport]` and the `.well-known` route appear in the build output with no type errors.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add "app/api/v1/[transport]/route.ts" app/.well-known/oauth-protected-resource/route.ts
git commit -m "feat: token-authenticated mcp http route + resource metadata"
```

---

### Task 8: Dev token-mint helper + end-to-end verification

**Files:**
- Create: `scripts/mint-mcp-token.ts`

**Interfaces:**
- Consumes: `createTokenPair` (Task 3); `supabaseAdmin`
- Produces: a CLI that prints a usable `lynq_at_...` token for a given user+workspace, used to manually verify the live MCP endpoint

- [ ] **Step 1: Write the mint helper**

`scripts/mint-mcp-token.ts`:

```ts
/**
 * Dev-only: mint an MCP access token for manual testing before the Phase 2
 * OAuth flow exists. Usage:
 *   npx tsx scripts/mint-mcp-token.ts <userId> <workspaceId>
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY in the environment.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createTokenPair } from '@/lib/services/oauth-tokens'

async function main() {
  const [userId, workspaceId] = process.argv.slice(2)
  if (!userId || !workspaceId) {
    console.error('Usage: tsx scripts/mint-mcp-token.ts <userId> <workspaceId>')
    process.exit(1)
  }
  // Ensure a dev client row exists (FK target for oauth_tokens.client_id).
  await supabaseAdmin
    .from('oauth_clients')
    .upsert({ client_id: 'lynq-mcp-dev', client_name: 'Lynq MCP Dev', redirect_uris: [] })
  const pair = await createTokenPair(supabaseAdmin as never, {
    clientId: 'lynq-mcp-dev', userId, workspaceId,
  })
  console.log('ACCESS TOKEN:\n' + pair.accessToken)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Mint a token for a real test user/workspace**

Run: `npx tsx scripts/mint-mcp-token.ts <real-user-id> <real-workspace-id>`
Expected: prints `ACCESS TOKEN: lynq_at_...`. (Pick a user/workspace from the dev Supabase project.)

- [ ] **Step 3: Start the app and call the MCP endpoint with the token**

Run (terminal A): `npm run dev`
Run (terminal B), an MCP `initialize` + `tools/list` over Streamable HTTP:

```bash
TOKEN="<paste lynq_at_ token>"
curl -sS -X POST http://localhost:3000/api/v1/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Expected: a JSON-RPC result whose tools array includes `list_conversations`. (mcp-handler may require an `initialize` call first; if so, run the standard `initialize` request before `tools/list` per the package README.)

- [ ] **Step 4: Verify auth rejection**

Run the same curl with `Authorization: Bearer lynq_at_invalid`.
Expected: HTTP 401 with a `WWW-Authenticate` header (no tool list returned).

- [ ] **Step 5: Call the tool end-to-end**

```bash
curl -sS -X POST http://localhost:3000/api/v1/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_conversations","arguments":{"status":"open"}}}'
```

Expected: a tool result whose text is a JSON array of conversation summaries for that workspace (or `[]` if none). Confirms token → AuthContext → workspace-scoped service → MCP output works end-to-end.

- [ ] **Step 6: Commit**

```bash
git add scripts/mint-mcp-token.ts
git commit -m "chore: dev mcp token-mint helper + e2e verification"
```

---

## Self-Review

**Spec coverage (Phase 1 scope only):**
- Hosted MCP at `/api/v1/mcp`, stateless Streamable-HTTP → Tasks 6–7.
- Self-contained `mcp/` folder, `app → mcp → lib/services` direction → Tasks 6–7 (route is the only `app` touch point; `mcp/` imports only `lib/services` + SDK).
- Token store (hashed, expiry, revocable) → Tasks 2–3.
- Token → same `AuthContext`, workspace match enforced → Task 4.
- Workspace-scoped tool calling a pure service → Tasks 5–6.
- Protected-resource metadata for OAuth discovery → Task 7.
- Server instructions (inbox workflow + "read Emma settings, replace cloud AI assist") → Task 6.
- Testing strategy (Vitest, token core, token→ctx, tool scoping/error, E2E smoke) → Tasks 1, 3, 4, 5, 6, 8.
- **Deferred to later phases (explicitly, not gaps):** OAuth front door `/oauth/{register,authorize,token}` + consent UI (Phase 2); `rotateRefreshToken` body (Phase 2); tag enrichment, remaining MVP tools, Emma editing, settings UI (Phase 3+).

**Placeholder scan:** No "TBD"/"add error handling"/"write tests for the above" — every code and test step contains concrete content. The two "Note" blocks (SDK API confirmation, metadata fallback) are real adaptation instructions tied to a verification command, not deferred work.

**Type consistency:** `IssuedTokenPair`, `VerifiedToken`, `TokenStoreDb`, `ConversationFilters`, `ConversationSummary`, `ConversationsDb`, `McpToolContext`, `verifyMcpAccessToken`, `registerLynqTools`, `LYNQ_MCP_INSTRUCTIONS` are defined once (Tasks 3–6) and consumed with matching names/shapes in Tasks 4, 6, 7, 8. `createTokenPair(db, args)` and `verifyAccessToken(db, raw)` signatures match their call sites in Tasks 4 and 8.

---

## Next phases (not in this plan)

- **Phase 2 — OAuth authorization server:** `/oauth/register` (DCR), `/oauth/authorize` (client-rendered consent reusing the browser Supabase session → POST approve with the user's JWT → issue auth code), `/oauth/token` (code+PKCE exchange and refresh rotation using `rotateRefreshToken`), `/.well-known/oauth-authorization-server`. Makes the connector usable from Claude web/ChatGPT without the mint script.
- **Phase 3 — MVP tool batch:** inbox `get_conversation`/`create_draft`/`send_reply`/`set_state`/tags/`link_customer`, macros, orders (read), analytics (read), search; tag enrichment for `listConversations`.
- **Phase 4 — Emma config tools + settings UI:** `get_ai_settings`/`update_policies`/`update_scenario`; wire the existing MCP settings page connect flow; resolve `MCP_PROMPT_GUIDE_URL`.
- **Beyond — parity roadmap** per spec §6.3.
