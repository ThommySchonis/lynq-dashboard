# Lynq MCP Server (OAuth-authenticated) — Design

**Date:** 2026-06-26
**Status:** Approved design, ready for implementation planning
**Owner:** Dendy

## 1. Summary

Build a hosted **Model Context Protocol (MCP) server** that lets Claude (and other
MCP clients such as ChatGPT) operate a Lynq workspace on a user's behalf —
reading and answering inbox tickets, managing ticket state, looking up orders and
analytics, and reading/editing Emma's AI instructions.

The server is exposed at **`https://app.lynq.app/api/v1/mcp`** (the URL already
referenced by `lib/mcp-constants.ts`) and authenticated with **OAuth 2.1**, the
auth scheme remote MCP connectors in Claude web / ChatGPT expect. A connected
client acts with the **full permissions of the user who authorised it** — exactly
what that user can do in the dashboard, gated by the same role / `can.*` checks.

Because Claude is itself the MCP client, the server is also intended to **replace
the cloud AI assist (Emma)**: rather than calling Lynq's server-side AI endpoints,
Claude reads the workspace's Emma configuration and writes on-brand replies
directly.

## 2. Goals & non-goals

### Goals
- Hosted MCP server at `/api/v1/mcp` using stateless Streamable-HTTP transport.
- OAuth 2.1 authorisation (Dynamic Client Registration + PKCE + refresh tokens)
  as the **only** auth mechanism, reusing the existing Supabase login for the
  consent step.
- **Full parity with the user's dashboard API surface**: every API capability a
  user has in the dashboard is reachable as an MCP tool, gated by the same role.
- MCP server code lives in a **self-contained top-level `mcp/` folder**, isolated
  from app/UI code. The only app-side touch point is a thin route handler.
- Tools call existing `lib/services/*` (no business-logic duplication).
- Server instructions teach Claude the inbox workflow and how to read Emma's
  settings to generate replies (replacing cloud AI assist).

### Non-goals (this spec)
- **No Personal Access Tokens.** OAuth fully covers connector auth; PAT adds no
  capability and is dropped.
- No per-token granular scopes. Authorisation inherits the user's **role**;
  finer scopes are a future enhancement (a `scopes` concept is left room for but
  unused).
- No local stdio MCP package. The architecture keeps tools decoupled so a local
  build could be extracted later, but it is out of scope here.
- No exposure of platform-admin-only surfaces (`/admin`, `/lynq-admin`),
  internal webhooks, cron, or migration endpoints.

## 3. Context: how Lynq auth & API work today

- Two runtimes mirror each other: **Next.js** (`app/`, `lib/`) and the canonical
  **Hono/Deno** API (`supabase/functions/api/`). Most endpoints live in Hono.
- Auth today: `Authorization: Bearer <supabase-jwt>` →
  `getUserFromToken()` → `workspace_members` lookup → a workspace-scoped
  **`AuthContext`** `{ user, workspace, workspaceId, role, memberId, … }`
  (`lib/auth.ts` for Next, `middleware/auth.ts` for Hono). A user maps to a
  single workspace membership.
- Four roles: `owner`, `admin`, `agent`, `observer`. Capability checks in
  `lib/permissions.ts` (`can.*`).
- Every workspace-scoped query must be filtered by `workspaceId` (mandatory rule).
- Emma AI config lives in `ai_policies`, `ai_scenarios`, `ai_lessons`,
  `ai_examples` and is assembled into a system prompt by
  `lib/services/ai-prompt-builder.ts` (`buildEmmaSystemPrompt()`).
- A settings page already exists in design (`lib/mcp-constants.ts`): connector
  URL `https://app.lynq.app/api/v1/mcp`, connect/"Authorise" steps for Claude
  web / Claude Code / ChatGPT, a "what it unlocks" list, and starter prompts.

## 4. Architecture

```
Claude web / ChatGPT / Claude Code
        │  OAuth 2.1 (Dynamic Client Registration + PKCE)
        │  1. discover  /.well-known/oauth-protected-resource
        │               /.well-known/oauth-authorization-server
        │  2. POST /oauth/register      → client_id
        │  3. GET  /oauth/authorize     → Supabase login + consent → auth code
        │  4. POST /oauth/token         → access token (+ refresh)
        ▼
  /api/v1/mcp  (Next.js route, thin)
        │  verify access token → AuthContext { user, workspaceId, role }
        ▼
  mcp/  (self-contained server)
        │  tool → lib/services/* (workspace-scoped + role-gated)
        ▼
  Supabase / Shopify
```

**Chosen approach:** the MCP route is a **Next.js handler** on `app.lynq.app`
(matches `MCP_ENDPOINT`, best TypeScript MCP-SDK support, same-process calls to
`lib/services/*`, no extra deploy target or network hop). The OAuth front door
and token store are also implemented in the Next.js app so the consent step can
reuse the existing Supabase browser session.

### 4.1 Folder & boundary layout

```
lynq-dashboard/
├─ mcp/                          ← self-contained MCP server (no app/UI imports)
│   ├─ server.ts                 createLynqMcpServer(ctx) → MCP server instance
│   ├─ transport.ts              stateless Streamable-HTTP request handler
│   ├─ instructions.ts           server instructions + prompt-guide text
│   ├─ tools/
│   │   ├─ index.ts              registers all tool groups
│   │   ├─ inbox.ts              conversations: list/get/draft/send/state/tag/link
│   │   ├─ macros.ts             list/get/apply
│   │   ├─ orders.ts             shopify orders: list/get/lookup (read)
│   │   ├─ analytics.ts          kpis / refund-insights (read)
│   │   ├─ emma.ts               get settings / edit instructions
│   │   └─ … (added per §6 parity roadmap)
│   └─ types.ts                  McpToolContext (subset of AuthContext)
│
├─ app/api/v1/mcp/route.ts       ← thin: verify token → createLynqMcpServer → transport
├─ app/api/oauth/…               ← OAuth endpoints (register / authorize / token)
├─ app/.well-known/…             ← OAuth metadata documents
├─ lib/services/oauth.ts         ← token store, client registration, code/token issuance
└─ app/(protected)/…/settings    ← existing MCP settings page (connect/authorise copy)
```

Dependency direction is one-way: **`app → mcp → lib/services`**. `mcp/` never
imports React/UI and never re-implements business logic.

## 5. OAuth 2.1 design

Implements the MCP authorization spec for remote servers, using the MCP
TypeScript SDK's OAuth provider/router helpers where possible to avoid
hand-rolling crypto.

### 5.1 Endpoints
- `GET /.well-known/oauth-protected-resource` — declares the resource and points
  to the authorization server.
- `GET /.well-known/oauth-authorization-server` — lists `registration`,
  `authorization`, and `token` endpoints, supported PKCE methods, grant types.
- `POST /oauth/register` — **Dynamic Client Registration**: a connector
  registers itself and receives a `client_id` (public client; PKCE required).
- `GET /oauth/authorize` — authorization-code + PKCE. If the user is not already
  authenticated with Supabase, they log in; then a **consent screen** ("Allow
  *<client>* to access your Lynq workspace *<name>* as *<role>*?"). On approval,
  issue a short-lived auth code bound to the user, workspace, client, redirect
  URI, and PKCE challenge.
- `POST /oauth/token` — exchanges the auth code (verifying PKCE) for an **access
  token** (+ **refresh token**); also handles `refresh_token` grant with refresh
  rotation. Tokens are opaque, stored hashed.

### 5.2 Token store (`oauth_clients`, `oauth_tokens`)
- **`oauth_clients`**: `id (client_id), client_name, redirect_uris[],
  created_at`. Registered MCP clients (public clients; no client secret).
- **`oauth_tokens`**: `id, client_id, user_id, workspace_id,
  access_token_hash, refresh_token_hash, scopes (reserved, unused),
  access_expires_at, refresh_expires_at, created_at, last_used_at,
  revoked_at`. Access tokens short-lived; refresh tokens long-lived and
  rotated on use. Only hashes are stored.
- Auth-code storage: short-TTL rows (or the same table with a `kind`),
  single-use, bound to PKCE challenge + redirect URI.

### 5.3 Verification → AuthContext
`/api/v1/mcp` reads the bearer access token, hashes it, looks it up in
`oauth_tokens`, checks `revoked_at` / `access_expires_at`, bumps `last_used_at`,
then loads the user's `workspace_members` row to build the **same `AuthContext`**
used everywhere else (`user, workspace, workspaceId, role, memberId`). Suspended
or scheduled-for-deletion workspaces are rejected exactly as today. Invalid /
expired / revoked tokens → `401` with `WWW-Authenticate` pointing at the
protected-resource metadata (so clients can re-auth).

## 6. MCP tools

### 6.1 Design principle — dashboard parity
The MCP exposes **every API capability a user has in the dashboard**, each tool a
thin wrapper over an existing `lib/services/*` function, called with
`ctx.workspaceId` and gated by the user's role via `can.*`. The MCP can do
exactly what its authorising user can do in the UI — no more, no less.
Platform-admin-only surfaces, internal webhooks, cron, and migrations are
excluded.

### 6.2 MVP tool set (first batch)

| Group | Tools |
|---|---|
| **Inbox / conversations** | `list_conversations` (filters: status, tag, date range, search, assignee), `get_conversation` (messages + customer/order context), `create_draft`, `send_reply`, `set_state` (close / snooze / reopen / assign), `add_tag` / `remove_tag`, `link_customer` |
| **Macros** | `list_macros`, `get_macro`, `apply_macro` |
| **Orders** (read) | `list_orders`, `get_order`, `lookup_order` (by email / number) |
| **Analytics** (read) | `get_kpis`, `get_refund_insights` |
| **Emma config** | `get_ai_settings` (returns `buildEmmaSystemPrompt()` output + raw policies/scenarios), `update_policies`, `update_scenario` |
| **Search** | `search` (cross-entity search used by the dashboard) |

All four chosen write capabilities (create drafts, send replies, manage ticket
state, edit Emma's instructions) are in the MVP.

### 6.3 Parity roadmap (subsequent batches, same framework)
Mapped from the existing Hono user-facing routes; each becomes a `mcp/tools/*`
module:
`tags`, `stores`, `settings`, `email-display`, `email-dns`,
`profile`, `account`, `workspaces` / `workspace-actions`, `invites`,
`onboarding`, `marketplace`, `academy` / `exams`, `parcel-panel`,
`shopify` (write/sync actions), `billing` (read), `analytics-extra`,
`auth-forwarding`.
Excluded from the MCP: `admin`, `lynq-admin`, `cron`, `migrations`, `health`,
and all `webhooks-*`.

The spec treats full parity as the **target**; implementation lands the MVP batch
first, then iterates module-by-module without further architectural change.

## 7. Server instructions

The MCP server ships an `instructions` block (in `mcp/instructions.ts`) that:
- Explains the inbox workflow (find tickets → read context → draft/send →
  set state / tag).
- Directs Claude to call `get_ai_settings` and write replies **consistent with
  the workspace's Emma configuration** (brand identity, tone, policies,
  scenarios), explicitly **replacing the cloud AI assist**.
- States safety rules surfaced from Emma policy (never invent order details,
  tracking numbers, or policies; escalate per configured triggers).
- Resolves the currently-placeholder `MCP_PROMPT_GUIDE_URL` to a real guide.

## 8. Data flow, errors, security

- **Flow:** client tool call → route already holds `ctx` from the access token →
  tool validates args (zod) → calls `lib/services/X(ctx.workspaceId, args)` →
  result mapped to MCP tool output.
- **Errors:**
  - Invalid / expired / revoked token → `401` + `WWW-Authenticate` (triggers
    client re-auth / refresh).
  - Role-forbidden action → tool returns a clean "not permitted for your role"
    MCP error result (not a crash, no stack).
  - Bad arguments → zod validation error surfaced to the client.
  - Service throws → mapped to an `isError` tool result with a safe message; no
    internal details leaked.
- **Security:**
  - PKCE mandatory; auth codes single-use and short-TTL; refresh-token rotation;
    all tokens stored hashed.
  - Consent screen names the client, workspace, and role being granted.
  - Redirect URIs validated against the registered client.
  - Workspace scoping enforced on every tool via `ctx.workspaceId`; role gating
    via `can.*` — identical to dashboard guarantees.
  - Tokens revocable (per-token) from the token store; revocation immediate.

## 9. Testing strategy

- **OAuth core (`lib/services/oauth.ts`):** client registration; auth-code
  issuance + single-use enforcement; PKCE verification; access/refresh issuance;
  refresh rotation; expiry; revocation; hashing.
- **Token → AuthContext:** a valid access token resolves to an `AuthContext`
  equivalent to the JWT path for the same user; suspended/deletion workspaces
  rejected.
- **Tools:** per-tool tests with a mocked service layer asserting (a) workspace
  scoping (`ctx.workspaceId` passed through) and (b) role gating (forbidden role
  → error result).
- **End-to-end smoke:** an MCP client performs DCR → authorize → token, lists
  tools, and runs `list_conversations` and a no-op `create_draft` against a test
  workspace.
- **Lint:** `npm run lint` clean, no `any`, `@/` imports.

## 10. Open implementation details (resolve during planning)

- Confirm how `/.well-known/*`, `/oauth/*`, and `/api/v1/mcp` route under
  `app.lynq.app` (Next.js route handlers vs. any rewrite to the Hono function);
  the design assumes Next.js route handlers.
- Pick the MCP TypeScript SDK version and confirm its OAuth provider helpers
  cover DCR + PKCE + refresh, or identify the gaps to implement.
- Confirm exact `lib/services/*` signatures for each MVP tool (names/args) and
  add any thin service wrappers missing for a clean tool mapping.
- Decide consent-screen UX (reuse existing settings/auth styling) and the
  access-/refresh-token TTLs.
- Confirm whether the MVP send path should record an audit trail of
  MCP-originated sends/edits.

## 11. Known limitation

Claude web / ChatGPT connectors use OAuth (covered here). Claude **Code** can use
the same OAuth flow; a header-pasted-token shortcut is intentionally **not**
provided (PAT dropped). If a future need arises for headless/script access, a PAT
or client-credentials grant can be layered onto the same token store without
changing the tool layer.
