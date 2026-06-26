# Lynq MCP Server — Phase 2 (OAuth Authorization Server) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the OAuth 2.1 authorization-server front door so MCP clients (Claude web/Code, ChatGPT) can self-register, get user consent, and obtain the `lynq_at_…` access tokens that Phase 1 already verifies — making the connector usable without the dev mint script.

**Architecture:** Hand-built Next.js route handlers (the SDK's OAuth server is Express-only) backed by the Phase 1 token store. Discovery via `/.well-known/oauth-authorization-server`. Dynamic Client Registration at `/api/oauth/register`. A client-rendered consent page at `/oauth/authorize` reads the browser's Supabase session, and on Approve POSTs the user's JWT to `/api/oauth/authorize` which issues a single-use, PKCE-bound authorization code. `/api/oauth/token` exchanges code+verifier (and refresh tokens) for access/refresh tokens. Authorization inherits the consenting user's workspace role.

**Tech Stack:** Next.js 16 (App Router route handlers + one client page), `@modelcontextprotocol/sdk` zod schemas (`shared/auth.js`) for request/metadata shapes, Node `crypto` (PKCE S256), Supabase (`supabaseAdmin`), the Phase 1 `lib/services/oauth-tokens.ts` store, Vitest.

## Global Constraints

- TypeScript only; **no `any`** — use `unknown`/specific interfaces (ESLint-enforced). — verbatim from CLAUDE.md
- Use the `@/` path alias for all imports; no `../../../` chains. — verbatim from CLAUDE.md
- Every table with `workspace_id` must be queried with a `workspace_id` filter. — verbatim from CLAUDE.md
- Routes are thin wrappers; business logic in pure `lib/services/*` (accept data, return data, throw on error). — verbatim from CLAUDE.md
- Run `npm run lint` after every task; resolve all errors **you introduce** (the repo has ~10 pre-existing unrelated lint errors in `app/components/hooks` — do not touch them). — from CLAUDE.md + Phase 1 finding
- All tokens and authorization codes stored **hashed** (SHA-256); secrets returned to the caller exactly once. — from design spec §5.2
- OAuth clients are **public** (no client secret), **PKCE (S256) is mandatory**, Dynamic Client Registration is **open** (any client may register) — required so Claude/ChatGPT can self-register. — from design spec §5.1 + MCP norms
- Authorization grants the consenting user's **role**; a single implicit scope (no granular scopes this phase). — from design spec §2
- Access-token TTL 1h, refresh-token TTL 30d, refresh rotated on use (consistent with Phase 1 `oauth-tokens.ts`). — from Phase 1
- Do **not** run git commands (no add/commit/push); leave changes in the working tree. — user instruction for this engagement
- New token-authenticated `/api/*` routes MUST be added to `AUTH_BYPASS_PREFIXES` (`proxy.ts`) and `CSRF_EXEMPT_PREFIXES` (`lib/csrf.ts`) or the global middleware blocks them. — Phase 1 finding

---

## Context from Phase 1 (already built, do not rebuild)

- Tables exist: `oauth_clients(client_id, client_name, redirect_uris[], token_endpoint_auth_method, created_at)`, `oauth_authorization_codes(code_hash, client_id, user_id, workspace_id, redirect_uri, code_challenge, code_challenge_method, scope, expires_at, created_at)`, `oauth_tokens(...)`. Migration `20260626120000_mcp_oauth_token_store.sql` is applied to the dev DB.
- `lib/services/oauth-tokens.ts` exports `hashToken`, `generateOpaqueToken('lynq_at'|'lynq_rt')`, `createTokenPair(db, {clientId,userId,workspaceId,scope?})`, `verifyAccessToken(db, raw)`, `revokeToken(db, tokenId)`, types `IssuedTokenPair`, `VerifiedToken`, `TokenStoreDb`. **`rotateRefreshToken` does NOT exist yet — Task 1 adds it.**
- `lib/auth.ts` exports `getAuthContext(request: NextRequest): Promise<AuthContext|null>` (validates a Supabase JWT bearer → `{user, workspace, workspaceId, role, memberId}`).
- `lib/auth-utils.ts` exports `getSafeRedirect(raw)`. Login page is `/login?redirect=<path>`; client session via `supabase.auth.getSession()` from `@/lib/supabase`.
- The MCP endpoint `/api/v1/mcp` (+ `/api/v1/sse`) is already middleware-exempt and verifies `lynq_at_` tokens via `withMcpAuth` → `verifyMcpAccessToken`.
- `@/components/ui/button` exports `Button`.
- `@modelcontextprotocol/sdk/shared/auth.js` exports zod schemas: `OAuthClientMetadataSchema`, `OAuthClientInformationFullSchema`, `OAuthMetadataSchema`, `OAuthTokensSchema`, `OAuthErrorResponseSchema`.

---

## File Structure

**Create:**
- `lib/oauth/pkce.ts` — `verifyPkceS256(verifier, challenge)` + `generateAuthCode()`
- `lib/oauth/pkce.test.ts`
- `lib/services/oauth-clients.ts` — `registerClient`, `getClient`
- `lib/services/oauth-clients.test.ts`
- `lib/services/oauth-codes.ts` — `createAuthCode`, `consumeAuthCode`
- `lib/services/oauth-codes.test.ts`
- `app/.well-known/oauth-authorization-server/route.ts` — AS metadata
- `app/api/oauth/register/route.ts` — Dynamic Client Registration
- `app/api/oauth/authorize/route.ts` — consent approval (issues code), POST
- `app/api/oauth/token/route.ts` — token endpoint (code + refresh grants)
- `app/oauth/authorize/page.tsx` — client-rendered consent page
- `app/oauth/authorize/consent-form.tsx` — client consent component

**Modify:**
- `lib/services/oauth-tokens.ts` — add `rotateRefreshToken` (Task 1)
- `lib/services/oauth-tokens.test.ts` — tests for `rotateRefreshToken`
- `proxy.ts` — add `/api/oauth/` to `AUTH_BYPASS_PREFIXES`
- `lib/csrf.ts` — add `/api/oauth/` to `CSRF_EXEMPT_PREFIXES`
- `app/.well-known/oauth-protected-resource/route.ts` — (verify only) already advertises the AS origin

---

## Interfaces (locked across tasks)

```ts
// lib/oauth/pkce.ts
export function verifyPkceS256(verifier: string, challenge: string): boolean
export function generateAuthCode(): string            // opaque, e.g. "lynq_ac_<base64url>"

// lib/services/oauth-tokens.ts  (added in Task 1)
export async function rotateRefreshToken(db: TokenStoreDb, rawRefresh: string): Promise<IssuedTokenPair | null>

// lib/services/oauth-clients.ts
export interface RegisteredClient {
  clientId: string
  clientName: string
  redirectUris: string[]
  tokenEndpointAuthMethod: 'none'
  createdAt: string
}
export async function registerClient(
  db: OAuthClientsDb,
  input: { clientName: string; redirectUris: string[] },
): Promise<RegisteredClient>
export async function getClient(db: OAuthClientsDb, clientId: string): Promise<RegisteredClient | null>

// lib/services/oauth-codes.ts
export interface AuthCodeRecord {
  clientId: string; userId: string; workspaceId: string
  redirectUri: string; codeChallenge: string; scope: string | null
}
export async function createAuthCode(
  db: OAuthCodesDb,
  data: AuthCodeRecord,
): Promise<string>                                     // returns the plaintext code (stored hashed)
export async function consumeAuthCode(
  db: OAuthCodesDb,
  rawCode: string,
): Promise<AuthCodeRecord | null>                       // single-use: deletes the row; null if missing/expired
```

---

### Task 1: Implement `rotateRefreshToken` (token store)

**Files:**
- Modify: `lib/services/oauth-tokens.ts`
- Test: `lib/services/oauth-tokens.test.ts`

**Interfaces:**
- Consumes: existing `TokenStoreDb`, `hashToken`, `generateOpaqueToken`, `IssuedTokenPair`, `createTokenPair` patterns
- Produces: `rotateRefreshToken(db, rawRefresh)` (see locked Interfaces)

- [ ] **Step 1: Extend `TokenStoreDb` for refresh lookup + write the failing test**

The existing `TokenStoreDb.from('oauth_tokens')` select chain only supports `.eq(...).maybeSingle()`. `rotateRefreshToken` looks up by `refresh_token_hash`, so the same chain shape works. Add this test to `lib/services/oauth-tokens.test.ts`:

```ts
import { rotateRefreshToken } from '@/lib/services/oauth-tokens'

describe('rotateRefreshToken', () => {
  const valid = {
    id: 'tok_old', client_id: 'c1', user_id: 'u1', workspace_id: 'w1',
    scope: null, revoked_at: null,
    refresh_expires_at: new Date(Date.now() + 1000).toISOString(),
  }
  function rotateDb(row: Record<string, unknown> | null) {
    const updates: Record<string, unknown>[] = []
    const inserted: Record<string, unknown>[] = []
    const db = {
      from() {
        return {
          insert(r: Record<string, unknown>) { inserted.push(r); return { select() { return { single: async () => ({ data: { id: 'tok_new' }, error: null }) } } } },
          select() { return { eq() { return { maybeSingle: async () => ({ data: row, error: null }) } } } },
          update(u: Record<string, unknown>) { updates.push(u); return { eq: async () => ({ error: null }) } },
        }
      },
    }
    return { db: db as unknown as import('@/lib/services/oauth-tokens').TokenStoreDb, updates, inserted }
  }

  it('rejects a non-refresh prefix without a db call', async () => {
    const { db } = rotateDb(null)
    expect(await rotateRefreshToken(db, 'lynq_at_x')).toBeNull()
  })
  it('returns a new pair and revokes the old token on valid refresh', async () => {
    const { db, updates } = rotateDb(valid)
    const pair = await rotateRefreshToken(db, 'lynq_rt_valid')
    expect(pair?.accessToken.startsWith('lynq_at_')).toBe(true)
    expect(pair?.refreshToken.startsWith('lynq_rt_')).toBe(true)
    expect(updates.some((u) => 'revoked_at' in u)).toBe(true) // old token revoked (rotation)
  })
  it('returns null for an expired refresh token', async () => {
    const { db } = rotateDb({ ...valid, refresh_expires_at: new Date(Date.now() - 1000).toISOString() })
    expect(await rotateRefreshToken(db, 'lynq_rt_old')).toBeNull()
  })
  it('returns null for a revoked refresh token', async () => {
    const { db } = rotateDb({ ...valid, revoked_at: new Date().toISOString() })
    expect(await rotateRefreshToken(db, 'lynq_rt_revoked')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- oauth-tokens`
Expected: FAIL — `rotateRefreshToken` not exported.

- [ ] **Step 3: Implement `rotateRefreshToken`**

Append to `lib/services/oauth-tokens.ts`. It selects the row by `refresh_token_hash`, validates revoked/expiry, revokes the old row, and issues a fresh pair for the same client/user/workspace via `createTokenPair`:

```ts
interface RefreshRow {
  id: string
  client_id: string
  user_id: string
  workspace_id: string
  scope: string | null
  revoked_at: string | null
  refresh_expires_at: string | null
}

export async function rotateRefreshToken(
  db: TokenStoreDb,
  rawRefresh: string,
): Promise<IssuedTokenPair | null> {
  if (!rawRefresh.startsWith('lynq_rt_')) return null

  const { data, error } = await db
    .from('oauth_tokens')
    .select('id, client_id, user_id, workspace_id, scope, revoked_at, refresh_expires_at')
    .eq('refresh_token_hash', hashToken(rawRefresh))
    .maybeSingle()

  const row = data as RefreshRow | null
  if (error || !row) return null
  if (row.revoked_at) return null
  if (!row.refresh_expires_at || new Date(row.refresh_expires_at).getTime() <= Date.now()) return null

  // Rotation: revoke the old token row, then issue a fresh pair.
  await db.from('oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', row.id)

  return createTokenPair(db, {
    clientId: row.client_id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    scope: row.scope,
  })
}
```

> Note: the `.select(...)` chain here ends in `.eq(...).maybeSingle()`, which the existing `TokenStoreDb` type already models. No type change needed. The `data` is cast to `RefreshRow` locally (the interface's `maybeSingle` returns the Phase 1 `TokenRow` shape; `refresh_expires_at` is selected here, so the local cast is the intentional boundary).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- oauth-tokens`
Expected: PASS (all prior + 4 new rotateRefreshToken tests).

- [ ] **Step 5: Lint**

Run: `npx eslint lib/services/oauth-tokens.ts lib/services/oauth-tokens.test.ts`
Expected: clean.

---

### Task 2: PKCE + auth-code helpers

**Files:**
- Create: `lib/oauth/pkce.ts`
- Test: `lib/oauth/pkce.test.ts`

**Interfaces:**
- Consumes: Node `crypto`
- Produces: `verifyPkceS256(verifier, challenge)`, `generateAuthCode()` (see locked Interfaces)

- [ ] **Step 1: Write the failing test**

`lib/oauth/pkce.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { verifyPkceS256, generateAuthCode } from '@/lib/oauth/pkce'

function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

describe('verifyPkceS256', () => {
  it('accepts a verifier whose S256 hash matches the challenge', () => {
    const verifier = 'a'.repeat(64)
    expect(verifyPkceS256(verifier, challengeFor(verifier))).toBe(true)
  })
  it('rejects a mismatched verifier', () => {
    expect(verifyPkceS256('wrong-verifier', challengeFor('a'.repeat(64)))).toBe(false)
  })
  it('rejects empty inputs', () => {
    expect(verifyPkceS256('', '')).toBe(false)
  })
})

describe('generateAuthCode', () => {
  it('produces a prefixed, unique, long code', () => {
    const a = generateAuthCode()
    const b = generateAuthCode()
    expect(a.startsWith('lynq_ac_')).toBe(true)
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(40)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- pkce`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/oauth/pkce.ts`:

```ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** Verify a PKCE code_verifier against an S256 code_challenge (RFC 7636). */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false
  const computed = createHash('sha256').update(verifier).digest('base64url')
  const a = Buffer.from(computed)
  const b = Buffer.from(challenge)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Opaque single-use authorization code. */
export function generateAuthCode(): string {
  return `lynq_ac_${randomBytes(32).toString('base64url')}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- pkce`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint lib/oauth/pkce.ts lib/oauth/pkce.test.ts`
Expected: clean.

---

### Task 3: OAuth clients service (Dynamic Client Registration store)

**Files:**
- Create: `lib/services/oauth-clients.ts`
- Test: `lib/services/oauth-clients.test.ts`

**Interfaces:**
- Consumes: `oauth_clients` table; Node `crypto`
- Produces: `registerClient`, `getClient`, types `RegisteredClient`, `OAuthClientsDb` (see locked Interfaces)

- [ ] **Step 1: Write the failing test**

`lib/services/oauth-clients.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { registerClient, getClient } from '@/lib/services/oauth-clients'

function fakeDb(existing: Record<string, unknown> | null) {
  const inserted: Record<string, unknown>[] = []
  const db = {
    from() {
      return {
        insert(r: Record<string, unknown>) { inserted.push(r); return { select() { return { single: async () => ({ data: r, error: null }) } } } },
        select() { return { eq() { return { maybeSingle: async () => ({ data: existing, error: null }) } } } },
      }
    },
  }
  return { db: db as unknown as import('@/lib/services/oauth-clients').OAuthClientsDb, inserted }
}

describe('registerClient', () => {
  it('generates a client_id and stores name + redirect_uris', async () => {
    const { db, inserted } = fakeDb(null)
    const c = await registerClient(db, { clientName: 'Claude', redirectUris: ['https://claude.ai/cb'] })
    expect(c.clientId.length).toBeGreaterThan(10)
    expect(c.clientName).toBe('Claude')
    expect(c.redirectUris).toEqual(['https://claude.ai/cb'])
    expect(c.tokenEndpointAuthMethod).toBe('none')
    expect(inserted[0].client_id).toBe(c.clientId)
  })
  it('rejects empty redirect_uris', async () => {
    const { db } = fakeDb(null)
    await expect(registerClient(db, { clientName: 'X', redirectUris: [] })).rejects.toThrow()
  })
})

describe('getClient', () => {
  it('maps a stored row to RegisteredClient', async () => {
    const { db } = fakeDb({ client_id: 'c1', client_name: 'Claude', redirect_uris: ['https://x/cb'], token_endpoint_auth_method: 'none', created_at: '2026-06-26T00:00:00Z' })
    const c = await getClient(db, 'c1')
    expect(c?.clientId).toBe('c1')
    expect(c?.redirectUris).toEqual(['https://x/cb'])
  })
  it('returns null when missing', async () => {
    const { db } = fakeDb(null)
    expect(await getClient(db, 'nope')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- oauth-clients`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/services/oauth-clients.ts`:

```ts
import { randomBytes } from 'node:crypto'

export interface RegisteredClient {
  clientId: string
  clientName: string
  redirectUris: string[]
  tokenEndpointAuthMethod: 'none'
  createdAt: string
}

interface ClientRow {
  client_id: string
  client_name: string
  redirect_uris: string[]
  token_endpoint_auth_method: string
  created_at: string
}

export interface OAuthClientsDb {
  from(table: 'oauth_clients'): {
    insert(row: Record<string, unknown>): { select(cols: string): { single(): Promise<{ data: ClientRow | null; error: { message: string } | null }> } }
    select(cols: string): { eq(col: string, val: string): { maybeSingle(): Promise<{ data: ClientRow | null; error: { message: string } | null }> } }
  }
}

function mapRow(row: ClientRow): RegisteredClient {
  return {
    clientId: row.client_id,
    clientName: row.client_name,
    redirectUris: row.redirect_uris ?? [],
    tokenEndpointAuthMethod: 'none',
    createdAt: row.created_at,
  }
}

export async function registerClient(
  db: OAuthClientsDb,
  input: { clientName: string; redirectUris: string[] },
): Promise<RegisteredClient> {
  if (!input.redirectUris.length) throw new Error('redirect_uris must not be empty')
  for (const uri of input.redirectUris) {
    try { new URL(uri) } catch { throw new Error(`invalid redirect_uri: ${uri}`) }
  }
  const clientId = `lynq_client_${randomBytes(16).toString('base64url')}`
  const row = {
    client_id: clientId,
    client_name: input.clientName || 'MCP Client',
    redirect_uris: input.redirectUris,
    token_endpoint_auth_method: 'none',
  }
  const { data, error } = await db.from('oauth_clients').insert(row).select('*').single()
  if (error || !data) throw new Error(`registerClient failed: ${error?.message ?? 'no row'}`)
  return mapRow(data)
}

export async function getClient(db: OAuthClientsDb, clientId: string): Promise<RegisteredClient | null> {
  const { data, error } = await db.from('oauth_clients').select('*').eq('client_id', clientId).maybeSingle()
  if (error || !data) return null
  return mapRow(data)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- oauth-clients`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint lib/services/oauth-clients.ts lib/services/oauth-clients.test.ts`
Expected: clean.

---

### Task 4: Authorization-code service (single-use, hashed)

**Files:**
- Create: `lib/services/oauth-codes.ts`
- Test: `lib/services/oauth-codes.test.ts`

**Interfaces:**
- Consumes: `oauth_authorization_codes` table; `hashToken` from `@/lib/services/oauth-tokens`; `generateAuthCode` from `@/lib/oauth/pkce`
- Produces: `createAuthCode`, `consumeAuthCode`, types `AuthCodeRecord`, `OAuthCodesDb` (see locked Interfaces)

- [ ] **Step 1: Write the failing test**

`lib/services/oauth-codes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createAuthCode, consumeAuthCode } from '@/lib/services/oauth-codes'

const record = {
  clientId: 'c1', userId: 'u1', workspaceId: 'w1',
  redirectUri: 'https://claude.ai/cb', codeChallenge: 'chal', scope: null,
}

function fakeDb(row: Record<string, unknown> | null) {
  const inserted: Record<string, unknown>[] = []
  const deleted: string[] = []
  const db = {
    from() {
      return {
        insert(r: Record<string, unknown>) { inserted.push(r); return Promise.resolve({ error: null }) },
        select() { return { eq() { return { maybeSingle: async () => ({ data: row, error: null }) } } } },
        delete() { return { eq(_c: string, v: string) { deleted.push(v); return Promise.resolve({ error: null }) } } },
      }
    },
  }
  return { db: db as unknown as import('@/lib/services/oauth-codes').OAuthCodesDb, inserted, deleted }
}

describe('createAuthCode', () => {
  it('returns a plaintext code and stores its hash + metadata', async () => {
    const { db, inserted } = fakeDb(null)
    const code = await createAuthCode(db, record)
    expect(code.startsWith('lynq_ac_')).toBe(true)
    expect(inserted[0]).toHaveProperty('code_hash')
    expect(inserted[0].client_id).toBe('c1')
    expect(inserted[0]).not.toHaveProperty('code') // never store plaintext
  })
})

describe('consumeAuthCode', () => {
  it('returns the record and deletes the row (single-use) for a valid code', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const { db, deleted } = fakeDb({ code_hash: 'h', client_id: 'c1', user_id: 'u1', workspace_id: 'w1', redirect_uri: 'https://claude.ai/cb', code_challenge: 'chal', scope: null, expires_at: future })
    const out = await consumeAuthCode(db, 'lynq_ac_valid')
    expect(out?.clientId).toBe('c1')
    expect(out?.codeChallenge).toBe('chal')
    expect(deleted.length).toBe(1) // row deleted after consumption
  })
  it('returns null for an expired code', async () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const { db } = fakeDb({ code_hash: 'h', client_id: 'c1', user_id: 'u1', workspace_id: 'w1', redirect_uri: 'x', code_challenge: 'c', scope: null, expires_at: past })
    expect(await consumeAuthCode(db, 'lynq_ac_old')).toBeNull()
  })
  it('returns null for a missing code', async () => {
    const { db } = fakeDb(null)
    expect(await consumeAuthCode(db, 'lynq_ac_missing')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- oauth-codes`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/services/oauth-codes.ts`:

```ts
import { hashToken } from '@/lib/services/oauth-tokens'
import { generateAuthCode } from '@/lib/oauth/pkce'

const CODE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface AuthCodeRecord {
  clientId: string
  userId: string
  workspaceId: string
  redirectUri: string
  codeChallenge: string
  scope: string | null
}

interface CodeRow {
  client_id: string
  user_id: string
  workspace_id: string
  redirect_uri: string
  code_challenge: string
  scope: string | null
  expires_at: string
}

export interface OAuthCodesDb {
  from(table: 'oauth_authorization_codes'): {
    insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>
    select(cols: string): { eq(col: string, val: string): { maybeSingle(): Promise<{ data: CodeRow | null; error: { message: string } | null }> } }
    delete(): { eq(col: string, val: string): Promise<{ error: { message: string } | null }> }
  }
}

export async function createAuthCode(db: OAuthCodesDb, data: AuthCodeRecord): Promise<string> {
  const code = generateAuthCode()
  const { error } = await db.from('oauth_authorization_codes').insert({
    code_hash: hashToken(code),
    client_id: data.clientId,
    user_id: data.userId,
    workspace_id: data.workspaceId,
    redirect_uri: data.redirectUri,
    code_challenge: data.codeChallenge,
    code_challenge_method: 'S256',
    scope: data.scope,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  })
  if (error) throw new Error(`createAuthCode failed: ${error.message}`)
  return code
}

export async function consumeAuthCode(db: OAuthCodesDb, rawCode: string): Promise<AuthCodeRecord | null> {
  if (!rawCode.startsWith('lynq_ac_')) return null
  const codeHash = hashToken(rawCode)
  const { data, error } = await db
    .from('oauth_authorization_codes')
    .select('client_id, user_id, workspace_id, redirect_uri, code_challenge, scope, expires_at')
    .eq('code_hash', codeHash)
    .maybeSingle()

  if (error || !data) return null
  // Single-use: always delete the row once located, before validating expiry.
  await db.from('oauth_authorization_codes').delete().eq('code_hash', codeHash)
  if (new Date(data.expires_at).getTime() <= Date.now()) return null

  return {
    clientId: data.client_id,
    userId: data.user_id,
    workspaceId: data.workspace_id,
    redirectUri: data.redirect_uri,
    codeChallenge: data.code_challenge,
    scope: data.scope,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- oauth-codes`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint lib/services/oauth-codes.ts lib/services/oauth-codes.test.ts`
Expected: clean.

---

### Task 5: Middleware bypass + authorization-server metadata

**Files:**
- Modify: `proxy.ts`, `lib/csrf.ts`
- Create: `app/.well-known/oauth-authorization-server/route.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `GET /.well-known/oauth-authorization-server` (discovery doc); `/api/oauth/*` exempt from the global middleware

- [ ] **Step 1: Exempt `/api/oauth/` in the middleware**

In `proxy.ts`, add to `AUTH_BYPASS_PREFIXES` (after the `/api/v1/sse` entry):

```ts
  // OAuth authorization-server endpoints (register/token are called by MCP
  // clients with no Supabase session; authorize-approve validates the user's
  // JWT itself via getAuthContext). Skip the global session/blocked gate.
  '/api/oauth/',
```

In `lib/csrf.ts`, add to `CSRF_EXEMPT_PREFIXES`:

```ts
  // OAuth endpoints: register/token are cross-origin (no Origin); authorize
  // is same-origin. None are cookie-authenticated, so not a CSRF vector.
  "/api/oauth/",
```

- [ ] **Step 2: Create the AS metadata route**

`app/.well-known/oauth-authorization-server/route.ts`:

```ts
import { NextResponse } from 'next/server'

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 * Advertises the endpoints MCP clients use to register, get consent, and
 * exchange tokens. PKCE S256 is required; clients are public (no secret).
 */
export function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.lynq.app'
  return NextResponse.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['mcp'],
  })
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds; `/.well-known/oauth-authorization-server` appears in the output.

- [ ] **Step 4: Lint**

Run: `npx eslint proxy.ts lib/csrf.ts app/.well-known/oauth-authorization-server/route.ts`
Expected: clean.

---

### Task 6: Dynamic Client Registration endpoint

**Files:**
- Create: `app/api/oauth/register/route.ts`

**Interfaces:**
- Consumes: `registerClient` (Task 3); `supabaseAdmin`
- Produces: `POST /api/oauth/register` (RFC 7591). Accepts `{ client_name, redirect_uris }`, returns `{ client_id, client_id_issued_at, client_name, redirect_uris, token_endpoint_auth_method, grant_types, response_types }`

- [ ] **Step 1: Implement the route**

`app/api/oauth/register/route.ts`:

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { registerClient } from '@/lib/services/oauth-clients'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface RegisterBody {
  client_name?: string
  redirect_uris?: string[]
}

export async function POST(request: NextRequest) {
  let body: RegisterBody
  try {
    body = (await request.json()) as RegisterBody
  } catch {
    return NextResponse.json({ error: 'invalid_client_metadata', error_description: 'Body must be JSON' }, { status: 400 })
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : []
  if (redirectUris.length === 0) {
    return NextResponse.json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' }, { status: 400 })
  }

  try {
    const client = await registerClient(supabaseAdmin as never, {
      clientName: body.client_name ?? 'MCP Client',
      redirectUris,
    })
    return NextResponse.json(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(new Date(client.createdAt).getTime() / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      },
      { status: 201 },
    )
  } catch (e) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: e instanceof Error ? e.message : 'registration failed' },
      { status: 400 },
    )
  }
}
```

- [ ] **Step 2: Build + manual verify**

Run: `npm run build` (expect success). Then with the dev server running (`npm run dev`):

```bash
curl -sS -X POST http://localhost:3000/api/oauth/register \
  -H "Content-Type: application/json" \
  -d '{"client_name":"Test Client","redirect_uris":["https://claude.ai/api/mcp/auth_callback"]}'
```

Expected: HTTP 201 JSON with a `client_id` starting `lynq_client_`. (Save it for Task 9.)

- [ ] **Step 3: Lint**

Run: `npx eslint app/api/oauth/register/route.ts`
Expected: clean.

---

### Task 7: Consent approval endpoint (`POST /api/oauth/authorize`)

**Files:**
- Create: `app/api/oauth/authorize/route.ts`

**Interfaces:**
- Consumes: `getAuthContext` (`@/lib/auth`); `getClient` (Task 3); `createAuthCode` (Task 4); `supabaseAdmin`
- Produces: `POST /api/oauth/authorize` — body `{ client_id, redirect_uri, code_challenge, code_challenge_method, state?, scope? }`, requires `Authorization: Bearer <supabase-jwt>`. Validates the user, the client, and that `redirect_uri` is registered; issues a code; returns `{ redirect: "<redirect_uri>?code=...&state=..." }`

- [ ] **Step 1: Implement the route**

`app/api/oauth/authorize/route.ts`:

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getClient } from '@/lib/services/oauth-clients'
import { createAuthCode } from '@/lib/services/oauth-codes'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface ApproveBody {
  client_id?: string
  redirect_uri?: string
  code_challenge?: string
  code_challenge_method?: string
  state?: string
  scope?: string
}

export async function POST(request: NextRequest) {
  // The consenting user is authenticated by their Supabase session JWT.
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'access_denied', error_description: 'Not authenticated' }, { status: 401 })

  let body: ApproveBody
  try { body = (await request.json()) as ApproveBody } catch {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Body must be JSON' }, { status: 400 })
  }

  const { client_id, redirect_uri, code_challenge, code_challenge_method } = body
  if (!client_id || !redirect_uri || !code_challenge) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'client_id, redirect_uri, code_challenge required' }, { status: 400 })
  }
  if (code_challenge_method && code_challenge_method !== 'S256') {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Only S256 PKCE is supported' }, { status: 400 })
  }

  const client = await getClient(supabaseAdmin as never, client_id)
  if (!client) return NextResponse.json({ error: 'invalid_client' }, { status: 400 })
  if (!client.redirectUris.includes(redirect_uri)) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'redirect_uri not registered for client' }, { status: 400 })
  }

  const code = await createAuthCode(supabaseAdmin as never, {
    clientId: client_id,
    userId: ctx.user.id,
    workspaceId: ctx.workspaceId,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    scope: body.scope ?? 'mcp',
  })

  const url = new URL(redirect_uri)
  url.searchParams.set('code', code)
  if (body.state) url.searchParams.set('state', body.state)
  return NextResponse.json({ redirect: url.toString() })
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success; `/api/oauth/authorize` in output.

- [ ] **Step 3: Lint**

Run: `npx eslint app/api/oauth/authorize/route.ts`
Expected: clean.

> Note: this endpoint is verified end-to-end in Task 9 (it needs a real Supabase JWT + registered client). No unit test here — it is a thin wrapper over already-tested services; the integration test in Task 9 covers it.

---

### Task 8: Token endpoint (`POST /api/oauth/token`)

**Files:**
- Create: `app/api/oauth/token/route.ts`

**Interfaces:**
- Consumes: `consumeAuthCode` (Task 4); `verifyPkceS256` (Task 2); `createTokenPair`, `rotateRefreshToken` (Tasks 1 / Phase 1); `getClient` (Task 3); `supabaseAdmin`
- Produces: `POST /api/oauth/token` — supports `grant_type=authorization_code` (params `code`, `code_verifier`, `redirect_uri`, `client_id`) and `grant_type=refresh_token` (param `refresh_token`). Returns `{ access_token, token_type: "Bearer", expires_in, refresh_token, scope }`. Accepts both JSON and form-encoded bodies (OAuth clients post `application/x-www-form-urlencoded`).

- [ ] **Step 1: Implement the route**

`app/api/oauth/token/route.ts`:

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { consumeAuthCode } from '@/lib/services/oauth-codes'
import { verifyPkceS256 } from '@/lib/oauth/pkce'
import { createTokenPair, rotateRefreshToken, type IssuedTokenPair } from '@/lib/services/oauth-tokens'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function tokenResponse(pair: IssuedTokenPair, scope: string | null) {
  const expiresIn = Math.max(0, Math.floor((new Date(pair.accessExpiresAt).getTime() - Date.now()) / 1000))
  return NextResponse.json({
    access_token: pair.accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: pair.refreshToken,
    scope: scope ?? 'mcp',
  })
}

function oauthError(error: string, description?: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status })
}

async function readParams(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return Object.fromEntries(Object.entries(json).map(([k, v]) => [k, String(v)]))
  }
  const form = await request.formData()
  const out: Record<string, string> = {}
  for (const [k, v] of form.entries()) out[k] = String(v)
  return out
}

export async function POST(request: NextRequest) {
  const params = await readParams(request)
  const grantType = params.grant_type

  if (grantType === 'authorization_code') {
    const { code, code_verifier, redirect_uri } = params
    if (!code || !code_verifier) return oauthError('invalid_request', 'code and code_verifier required')

    const record = await consumeAuthCode(supabaseAdmin as never, code)
    if (!record) return oauthError('invalid_grant', 'Authorization code invalid or expired')
    if (redirect_uri && redirect_uri !== record.redirectUri) return oauthError('invalid_grant', 'redirect_uri mismatch')
    if (!verifyPkceS256(code_verifier, record.codeChallenge)) return oauthError('invalid_grant', 'PKCE verification failed')

    const pair = await createTokenPair(supabaseAdmin as never, {
      clientId: record.clientId,
      userId: record.userId,
      workspaceId: record.workspaceId,
      scope: record.scope,
    })
    return tokenResponse(pair, record.scope)
  }

  if (grantType === 'refresh_token') {
    const { refresh_token } = params
    if (!refresh_token) return oauthError('invalid_request', 'refresh_token required')
    const pair = await rotateRefreshToken(supabaseAdmin as never, refresh_token)
    if (!pair) return oauthError('invalid_grant', 'Refresh token invalid or expired')
    return tokenResponse(pair, 'mcp')
  }

  return oauthError('unsupported_grant_type', `grant_type '${grantType}' not supported`)
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success; `/api/oauth/token` in output.

- [ ] **Step 3: Lint**

Run: `npx eslint app/api/oauth/token/route.ts`
Expected: clean.

---

### Task 9: Consent page (client) + full end-to-end verification

**Files:**
- Create: `app/oauth/authorize/page.tsx`
- Create: `app/oauth/authorize/consent-form.tsx`

**Interfaces:**
- Consumes: `supabase` (`@/lib/supabase`), `Button` (`@/components/ui/button`), `getSafeRedirect` (`@/lib/auth-utils`), and the `POST /api/oauth/authorize` + `/api/oauth/token` endpoints
- Produces: `GET /oauth/authorize` consent UX and a verified end-to-end OAuth flow

- [ ] **Step 1: Create the consent page (server wrapper reading query params)**

`app/oauth/authorize/page.tsx`:

```tsx
import { Suspense } from 'react'
import { ConsentForm } from './consent-form'

// The authorization endpoint. Renders a consent screen; the client component
// reads the browser Supabase session and approves via POST /api/oauth/authorize.
export default function AuthorizePage() {
  return (
    <Suspense fallback={null}>
      <ConsentForm />
    </Suspense>
  )
}
```

- [ ] **Step 2: Create the consent form (client)**

`app/oauth/authorize/consent-form.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export function ConsentForm() {
  const params = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'ready' | 'working' | 'error'>('loading')
  const [message, setMessage] = useState<string>('')

  const clientId = params.get('client_id') ?? ''
  const redirectUri = params.get('redirect_uri') ?? ''
  const codeChallenge = params.get('code_challenge') ?? ''
  const codeChallengeMethod = params.get('code_challenge_method') ?? 'S256'
  const state = params.get('state') ?? ''
  const scope = params.get('scope') ?? 'mcp'
  const responseType = params.get('response_type') ?? 'code'

  useEffect(() => {
    async function check() {
      if (responseType !== 'code' || !clientId || !redirectUri || !codeChallenge) {
        setStatus('error'); setMessage('Invalid authorization request.'); return
      }
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        // Bounce through login, returning to this exact authorize URL.
        const here = window.location.pathname + window.location.search
        window.location.href = `/login?redirect=${encodeURIComponent(here)}`
        return
      }
      setStatus('ready')
    }
    void check()
  }, [responseType, clientId, redirectUri, codeChallenge])

  async function approve() {
    setStatus('working')
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) { setStatus('error'); setMessage('Session expired. Reload and try again.'); return }

    const res = await fetch('/api/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        client_id: clientId, redirect_uri: redirectUri,
        code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod,
        state, scope,
      }),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error_description?: string }
      setStatus('error'); setMessage(err.error_description ?? 'Authorization failed.'); return
    }
    const { redirect } = (await res.json()) as { redirect: string }
    window.location.href = redirect
  }

  function deny() {
    const url = new URL(redirectUri)
    url.searchParams.set('error', 'access_denied')
    if (state) url.searchParams.set('state', state)
    window.location.href = url.toString()
  }

  if (status === 'loading') return <main className="mx-auto max-w-md p-8">Checking your session…</main>
  if (status === 'error') return <main className="mx-auto max-w-md p-8 text-destructive">{message}</main>

  return (
    <main className="mx-auto max-w-md p-8 space-y-6">
      <h1 className="text-xl font-semibold">Connect to Lynq &amp; Flow</h1>
      <p className="text-foreground-2">
        <span className="font-medium">{clientId}</span> is requesting access to your Lynq workspace.
        It will be able to read and act on your inbox with your permissions.
      </p>
      <div className="flex gap-3">
        <Button onClick={approve} disabled={status === 'working'}>
          {status === 'working' ? 'Authorizing…' : 'Approve'}
        </Button>
        <Button variant="outline" onClick={deny} disabled={status === 'working'}>Deny</Button>
      </div>
    </main>
  )
}
```

> Note: class names use existing tokens (`text-destructive`, `text-foreground-2`); if a token name differs in the current `globals.css`, use the nearest existing token — do not hardcode hex. tkvlad restyles later.

- [ ] **Step 3: Build + lint**

Run: `npm run build` (expect `/oauth/authorize` route in output) and `npx eslint "app/oauth/authorize/page.tsx" "app/oauth/authorize/consent-form.tsx"`
Expected: build succeeds; lint clean.

- [ ] **Step 4: End-to-end OAuth flow verification (dev server running)**

Generate a PKCE pair, register a client, mint an auth code by calling the approve endpoint with a real Supabase JWT, exchange it, and call an MCP tool with the issued access token:

```bash
# 4a. PKCE pair
VERIFIER=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
CHALLENGE=$(node -e "console.log(require('crypto').createHash('sha256').update('$VERIFIER').digest('base64url'))")

# 4b. Register a client (open DCR)
CLIENT_ID=$(curl -sS -X POST http://localhost:3000/api/oauth/register \
  -H "Content-Type: application/json" \
  -d '{"client_name":"E2E","redirect_uris":["https://example.com/cb"]}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).client_id))")
echo "client_id=$CLIENT_ID"

# 4c. Get a real Supabase user JWT for the test workspace.
#     (Use an existing dev login; obtain its access_token. Document how you got it in the report.)
JWT="<paste a valid Supabase access_token for a workspace member>"

# 4d. Approve → get an auth code (simulating what the consent page POSTs)
REDIR=$(curl -sS -X POST http://localhost:3000/api/oauth/authorize \
  -H "Content-Type: application/json" -H "Authorization: Bearer $JWT" \
  -d "{\"client_id\":\"$CLIENT_ID\",\"redirect_uri\":\"https://example.com/cb\",\"code_challenge\":\"$CHALLENGE\",\"code_challenge_method\":\"S256\",\"state\":\"xyz\"}" \
  | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).redirect))")
echo "redirect=$REDIR"
CODE=$(node -e "console.log(new URL('$REDIR').searchParams.get('code'))")

# 4e. Exchange code → tokens (PKCE)
TOKENS=$(curl -sS -X POST http://localhost:3000/api/oauth/token \
  -H "Content-Type: application/json" \
  -d "{\"grant_type\":\"authorization_code\",\"code\":\"$CODE\",\"code_verifier\":\"$VERIFIER\",\"redirect_uri\":\"https://example.com/cb\",\"client_id\":\"$CLIENT_ID\"}")
echo "$TOKENS"
ACCESS=$(node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).access_token))" <<< "$TOKENS")
REFRESH=$(node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).refresh_token))" <<< "$TOKENS")

# 4f. Use the access token against the MCP endpoint (Phase 1)
curl -sS -X POST http://localhost:3000/api/v1/mcp \
  -H "Authorization: Bearer $ACCESS" -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | tail -c 300

# 4g. Refresh rotation
curl -sS -X POST http://localhost:3000/api/oauth/token \
  -H "Content-Type: application/json" \
  -d "{\"grant_type\":\"refresh_token\",\"refresh_token\":\"$REFRESH\"}" | tail -c 300
```

Expected:
- 4e returns `access_token` (`lynq_at_…`), `refresh_token` (`lynq_rt_…`), `expires_in` ≈ 3600.
- 4f returns a tools list including `list_conversations` (the OAuth-issued token authenticates the MCP endpoint).
- 4g returns a **new** token pair (rotation), and reusing the old refresh token afterward returns `invalid_grant`.
- Re-running 4e with the same code returns `invalid_grant` (single-use enforced).

- [ ] **Step 5: Run the full unit suite**

Run: `npm test`
Expected: all test files pass (Phase 1 + Phase 2: oauth-tokens, mcp-auth, conversations, mcp/server, pkce, oauth-clients, oauth-codes).

---

## Self-Review

**Spec coverage (design §5 OAuth):**
- `/.well-known/oauth-authorization-server` discovery → Task 5.
- Dynamic Client Registration → Tasks 3, 6.
- Authorization endpoint + consent reusing Supabase login → Tasks 7, 9.
- PKCE (S256) enforced → Tasks 2, 7, 8.
- Token endpoint: code exchange + refresh rotation → Tasks 1, 8.
- Tokens/codes hashed, single-use codes → Tasks 3, 4.
- Middleware exemption for the new endpoints → Task 5.
- Issued tokens authenticate the Phase 1 MCP endpoint → verified Task 9 (4f).
- **Deferred (explicit):** connected-apps management UI + `/oauth/revoke` endpoint (next phase); fully branded consent screen (tkvlad redesign).

**Placeholder scan:** No "TBD"/"add validation"/"write tests later" — each code and test step is complete. The two `> Note` callouts (the `toHaveProperty` transcription fix in Task 4; the design-token caveat in Task 9) are concrete instructions, not deferrals.

**Type consistency:** `RegisteredClient`/`OAuthClientsDb` (Task 3), `AuthCodeRecord`/`OAuthCodesDb` (Task 4), `rotateRefreshToken`/`IssuedTokenPair` (Task 1), `verifyPkceS256`/`generateAuthCode` (Task 2) are defined once and consumed with matching names/shapes in Tasks 6, 7, 8. `createAuthCode` returns the plaintext code; `consumeAuthCode` returns `AuthCodeRecord | null` — matching the token route's usage. `tokenResponse` consumes `IssuedTokenPair` (`accessToken`, `refreshToken`, `accessExpiresAt`) exactly as Phase 1 defines it.

---

## Next phases (not in this plan)

- **Phase 3 — MVP tool batch:** inbox `get_conversation`/`create_draft`/`send_reply`/`set_state`/tags/`link_customer`, macros, orders (read), analytics (read), search; tag enrichment for `listConversations`.
- **Phase 4 — Emma config tools + settings UI + connected-apps management** (`get_ai_settings`/`update_policies`/`update_scenario`; `/oauth/revoke`; list/revoke approved connectors; resolve `MCP_PROMPT_GUIDE_URL`).
