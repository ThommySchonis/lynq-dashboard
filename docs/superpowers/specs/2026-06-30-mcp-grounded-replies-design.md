# MCP Phase 1 — Autonomy-Aware, Preference-Grounded Reply Generation

**Date:** 2026-06-30
**Status:** Approved design, ready for implementation plan
**Scope:** Phase 1 of "give the AI agent full app functionality through MCP." This phase covers reply generation grounded in the workspace's AI preferences + templates, with server-side autonomy enforcement. Broader functionality gaps (macro CRUD, products, draft orders, AI-agent rules/lessons editing, billing, etc.) are deferred to a later Phase 2 spec.

## Goal

The connecting agent (e.g. Claude operating the Lynq & Flow MCP) writes reply text itself. This phase makes that workflow:

1. **Grounded** — one MCP call hands the agent everything needed to compose an on-brand, policy-aware reply (assembled Emma system prompt, brand/policies, scenarios, lessons, examples, the best-matching templates, the thread, and order context).
2. **Safe** — `send_reply` enforces the workspace's autonomy rules at send time using the *same* gate Emma uses, so MCP cannot bypass workspace policy.
3. **Visible but not billed** — MCP replies are recorded as `ai_drafts` so they appear in the app's AI activity, but they are NOT written to `ai_usage` (the user's own agent did the work, not Emma — so no Emma cost/charge).

No second in-app LLM call is made; the agent is the intelligence.

## Background (current state)

The MCP server (`mcp/server.ts`) registers ~30 tools across inbox, macros, search, Shopify, and Emma config. Relevant existing pieces this design reuses:

- `get_ai_settings` (`mcp/tools/emma.ts` → `lib/services/ai-config.ts::getAiSettings`) already returns policies, scenarios, lessons, examples, and the assembled `systemPrompt`.
- `list_macros` / `get_macro` (`mcp/tools/macros.ts`) expose templates (plain `body` text, `language`, `tags`).
- `send_reply` / `create_draft` / `set_state` / `link_customer` (`mcp/tools/inbox.ts`).
- `shouldAutoSend()` (`lib/services/ai-autonomy.ts`) — a pure decision function gating Emma's auto-send.
- `generateEmmaDraft()` (`lib/services/emma-generate.ts`) — the in-app engine; reference for the autonomy + ai_drafts + ai_usage pattern. **Not invoked by MCP** (we don't want a second LLM call), but its gating logic is reused.

**Gap this phase closes:** an MCP agent today must orchestrate 4–5 calls to ground a reply (and may forget), and can call `send_reply` directly, bypassing every autonomy rule the workspace configured. There is also no way to list members for assignment.

## Autonomy model (reused, not reinvented)

`shouldAutoSend({ draft, scenario, rules })` returns `{ send: true }` or `{ send: false, reason }`. Branch order (first match wins):

1. `master_off` — `rules.master_enabled` is false.
2. `blocked_intent` — draft intent ∈ `rules.global_block_intents` (default: `refund_or_cancel`, `angry_or_chargeback`).
3. `scenario_locked` — matching scenario `autonomy_pct === 0`.
4. `emma_escalate` — `draft.should_escalate` is true.
5. `confidence_low` — `draft.confidence < max(rules.confidence_threshold, scenarioPct/100)`.

Plus a store-level toggle checked separately in `emma-generate.ts`: `stores.ai_auto_send_enabled`. When off → blocked reason `store_disabled`.

Valid intents (`REPLY_INTENTS`, `lib/schemas/ai.ts`): `wismo`, `long_delivery`, `lost_package`, `wrong_or_damaged`, `refund_or_cancel`, `customs_fees`, `angry_or_chargeback`, `other`, `unknown`.

Inputs come from: `ai_autonomy_rules.config` (per workspace+store), the scenario row matching the intent (per store), and `stores.ai_auto_send_enabled`.

## Components

### 1. New tool: `get_reply_context`

**Purpose:** one call returns everything the agent needs to compose a grounded, autonomy-aware reply.

**Input:** `{ conversationId: string, storeId?: string }`

**Returns (single JSON bundle):**

- `thread` — messages, `customerEmail`, `subject`, `status`, existing `intent` if any (from `getConversation`).
- `order` — linked Shopify order context when the conversation is linked/resolvable (reuse the lookup path used by existing Shopify tools); `null` if unlinked.
- `aiSettings` — the assembled `systemPrompt`, `brand`, tone, `sign_off`, `policies` (including `can_decide` / `cannot_decide` / `escalate_triggers`), `scenarios` (each `key`, `title`, `approach`, `response_template`, `escalate_when`, `autonomy_pct`, `enabled`), `lessons`, `examples`. Sourced from `getAiSettings`.
- `suggestedMacros` — workspace macros ranked by relevance to this thread (language match + tag/keyword overlap with the latest customer message), each `{ id, name, body, score }`. Satisfies the "suggest_macro" requirement.
- `autonomy` — `{ master_enabled, confidence_threshold, global_block_intents, store_auto_send_enabled, perScenarioAutonomyPct: Record<intent, number> }`.
- `validIntents` — the `REPLY_INTENTS` list.
- `guidance` — short instruction string: compose grounded in `systemPrompt` + best macro, choose an intent, then call `send_reply` with `intent`/`confidence` (gate enforced) or `create_draft`.

**Permissions:** any role that can view conversations (read-level). No mutations.

**Placement:** new file `mcp/tools/context.ts`, registered in `mcp/server.ts`. Macro-ranking + bundling logic lives in a service helper (e.g. `lib/services/mcp-reply-context.ts`) so the tool stays a thin wrapper, per the backend service-layer rule.

### 2. Modified tool: `send_reply` (autonomy enforcement)

**New optional params** (self-reported by the composing agent), added to the existing schema: `intent` (enum `REPLY_INTENTS`), `confidence` (number 0–1), `should_escalate` (boolean).

**Behavior:** before sending, load the scenario row for `intent`, the `ai_autonomy_rules` config, and `stores.ai_auto_send_enabled`, then run `shouldAutoSend()` (the same pure function).

- **Allowed** → send via the existing `sendReply` path, then record a non-billable `ai_drafts` row (see §5). Return `{ sent: true, ... }`.
- **Blocked** → do NOT send. Auto-save the composed text as a draft (via `createInboxDraft`, plus the `ai_drafts` record) and return `{ sent: false, drafted: true, draftId, blockedReason, message }` so no work is lost and the agent learns why.
- **Fail-safe defaults** — `intent` omitted → treated as `unknown` (no scenario); `confidence` omitted → `0`, which trips `confidence_low` and routes to a draft. A careless call drafts rather than sends.

**Anti-gaming note:** an agent could claim `confidence = 1.0`, but the hard policy blocks (master off, store off, `blocked_intent`, `scenario_locked`, `emma_escalate` when honestly flagged) still fire regardless of confidence. This matches Emma's own trust model and is acceptable for Phase 1.

**Permissions:** unchanged — `can.replyToTickets(role)`.

**Placement:** modify `send_reply` in `mcp/tools/inbox.ts`; the gate-evaluation + context-loading logic goes in a service helper (e.g. `lib/services/mcp-autonomy-gate.ts`) that reuses `shouldAutoSend`, keeping the tool thin.

### 3. New tool: `list_members`

Read-only list of workspace members (`id`, name, email, role, status) via the existing `getEnrichedMembers` service, so the agent can resolve a member id for `set_state` assignment/escalation. No mutations.

**Placement:** `mcp/tools/inbox.ts` (or a small `mcp/tools/members.ts`), registered in `mcp/server.ts`.

## Data changes

- **`ai_drafts.prompt_path`** — current CHECK constraint is `in ('emma', 'fallback')` (`supabase/migrations/20260531000000_ai_drafts.sql`). Add `'mcp'` via a new migration so MCP replies are distinguishable in AI activity. Verify downstream consumers (the workflow function in `20260609103529_ai_drafts_workflow.sql`) tolerate the new value.
- **No `ai_usage` write** for MCP replies — by design, so they never count toward Emma cost/charts. (No in-app LLM call happens anyway, so there is genuinely no cost to record.)
- Plan/ticket-cap limits enforced inside `sendReply` continue to apply (sending an email is still sending an email).

## Instructions update

Update `mcp/instructions.ts` (`LYNQ_MCP_INSTRUCTIONS`) to teach the new loop:

> For a customer reply: call `get_reply_context` first → compose a reply grounded in the returned `systemPrompt` and the best `suggestedMacros` entry → call `send_reply` with the `intent` and your `confidence`. The server enforces the workspace's autonomy rules: if the reply is not allowed to auto-send, it is saved as a draft for human review instead (the response tells you why). Use `create_draft` when you explicitly want a human to review. Use `list_members` to find a member id for assignment/escalation via `set_state`.

## Out of scope (Phase 2, separate spec)

Macro CRUD + generation, Shopify products, draft orders, contacts, billing, AI-agent rules/lessons/onboarding editing, analytics-page parity, email-account management, data export. These are real gaps but belong to the follow-up "broader functionality" spec.

## Testing

Follow the repo's existing MCP test convention (`mcp/tools/*.test.ts`):

- `get_reply_context` — bundles all sections; macro ranking orders by relevance; unlinked conversation returns `order: null`; missing conversation fails cleanly.
- `send_reply` gate — allowed intent sends + records `ai_drafts`(`prompt_path='mcp'`), no `ai_usage`; each blocked reason (`master_off`, `store_disabled`, `blocked_intent`, `scenario_locked`, `emma_escalate`, `confidence_low`) drafts instead of sends and returns the reason; omitted `intent`/`confidence` defaults route to a draft; role without `replyToTickets` is rejected.
- `list_members` — returns members for the workspace; respects workspace scoping.
- `shouldAutoSend` reuse — assert MCP path produces the same decisions as the Emma path for equivalent inputs.

Run `npx tsc --noEmit` and `npm run lint` before considering the work done (tests do not type-check).
