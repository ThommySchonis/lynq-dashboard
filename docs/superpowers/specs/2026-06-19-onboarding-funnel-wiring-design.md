# Onboarding Funnel Wiring — Design

**Date:** 2026-06-19
**Status:** Approved (design); pending implementation plan

## Goal

Make the existing onboarding wizard the **canonical signup + onboarding funnel**, retire the standalone `/signup` page, and guarantee that after email confirmation and login an un-onboarded user lands in (and resumes) the wizard. Onboarding completion must be reliably persisted so the gate works on every subsequent login.

## Background / Current State

- **Onboarding exists** — built by `tkvlad1966`, merged to `main` (commit `daaf314`). Public page at `app/onboarding/page.tsx` rendering a 7-step wizard (`components/features/onboarding/onboarding-wizard.tsx`):

  | Step | Content |
  |------|---------|
  | 0 | Goal + name + brand |
  | 1 | Account creation |
  | 2 | Email confirm |
  | 3 | Connect store |
  | 4 | Team & volume |
  | 5 | How'd you hear |
  | 6 | Pricing → finish |

- The wizard is conceived as a **full funnel**, but steps 1–2 (account creation, email confirm) are **UI-only mockups** — the code comment in the wizard calls account creation + confirm-resume "the remaining backend gap." `StepAccount` collects email/password but just calls `onNext(values)`; it never calls `signUp`.
- A **separate, functional `/signup` page** exists (`app/signup/page.tsx`) using the real `useSignUp` hook.
- **Email confirmation is enabled** in Supabase: `signUp` (`hooks/auth/use-auth-mutations.ts`) sets `emailRedirectTo: ${origin}/auth/confirm`, and login handles the `email_not_confirmed` error. So `signUp` returns **no session** — the user must click the emailed link.
- **Current redirects ignore onboarding entirely:**
  - `app/auth/confirm/page.tsx` → always `/home` on `SIGNED_IN`
  - `app/login/page.tsx` → `/inbox` (or `?redirect`)
  - `components/shared/auth-guard.tsx` gates on session / scheduled-deletion / billing — **not** onboarding.
- **Completion tracking:** `useCompleteOnboarding` (`hooks/onboarding/use-onboarding-mutations.ts:99`) and `admin.ts:615` upsert `profiles.onboarding_completed = true`. The `profiles` table **does exist** in the remote DB (referenced across `exams`, `marketplace`, `admin` routes; keyed on `id` = auth user id) but is **not captured in any migration** (provisioned via the Supabase SQL editor, per this project's pattern). The `onboarding_completed` column's existence in remote must be verified.

## Decisions (locked with user)

1. **Wizard is the canonical full funnel**; retire `/signup`.
2. **Email confirmation is required** — the "resume" problem exists (the link may open in a new tab/session, discarding client-side wizard state).
3. **Resume at Connect-store, carrying name/brand/goal** — stash these in `signUp` user-metadata so they survive a fresh session; the wizard prefills them on resume.
4. **Gate lives only at the `/auth/confirm` and `/login` redirect points** — not centrally in AuthGuard. Accepted tradeoff: a user could bypass by navigating directly to `/home` post-confirm.

## End-to-End Flow

### New user
1. Visits `/onboarding` (or `/signup`, which now redirects to `/onboarding`).
2. **Step 0 (Goal):** name, brand, goal.
3. **Step 1 (Account):** email + password → **calls `signUp`** with metadata:
   - `first_name` / `last_name` — split from the single `name` field (first token / remainder)
   - `company_name` and `brand_name` — from `brandName`
   - `full_name` — the raw `name`
   - `goal`
   `emailRedirectTo` remains `/auth/confirm`. On success (no session — confirm required), advance to Step 2. Surface `signUp` errors (e.g. email already in use).
4. **Step 2 (Confirm):** "check your email" screen with resend wired to `useResendConfirmation`. User clicks the emailed link.
5. Link → `/auth/confirm` → `SIGNED_IN` → reads `profiles.onboarding_completed` → `false` → `router.replace('/onboarding')`.
6. **Wizard mounts with a session** → jumps to **step 3 (Connect store)**, prefilling name/brand/goal from user metadata, and persists brand via `saveBrand` once.
7. **Steps 3–6** (connect store, team/volume, hear-about, pricing) → **Finish** → `useCompleteOnboarding` sets `profiles.onboarding_completed = true` → `/home`.

### Returning user
- `/login` → on sign-in success, read `onboarding_completed`:
  - incomplete → `/onboarding` (resumes at step 3)
  - complete → `redirectTo` (default `/inbox`)

## Changes

1. **Wizard step 1 — wire real signup**
   `StepAccount` + `onboarding-wizard.tsx`: call `signUp` (via `useSignUp` or the wizard) with the metadata above. On success advance to Step 2; on error display it inline.

2. **Wizard mount logic** (`onboarding-wizard.tsx`)
   - `session && onboarding_completed` → redirect `/home` (don't re-onboard).
   - `session && !onboarding_completed` → start at step 3, prefill name/brand/goal from `user.user_metadata`, call `saveBrand` once.
   - no session → start at step 0 (default).

3. **Step 2 (Confirm)** — wire `useResendConfirmation`; show the target email. May reuse the existing `VerifyPanel` / `ResendConfirmationButton` components.

4. **`/auth/confirm`** (`app/auth/confirm/page.tsx`) — replace the unconditional `goTo('/home')` on signed-in with an onboarding-status check → `/onboarding` if incomplete, else `/home`. The ambiguous/no-session and error branches are unchanged.

5. **`/login`** (`app/login/page.tsx`) — in **both** the sign-in `onSuccess` handler and the "already has a session" effect, check onboarding status → `/onboarding` if incomplete, else `redirectTo`.

6. **Retire `/signup`** — replace `app/signup/page.tsx` with a redirect to `/onboarding`. Repoint any inbound links to `/signup` (e.g. the expired-link CTA in `/auth/confirm`, marketing links) to `/onboarding`.

7. **Completion tracking helper + column**
   - Add a small `getOnboardingStatus(userId)` helper that reads `profiles.onboarding_completed` with `.maybeSingle()` (null → treat as incomplete). Used by `/auth/confirm`, `/login`, and the wizard mount.
   - Verify `profiles.onboarding_completed` exists in remote. If absent, add the column (+ a self-select RLS policy so the authenticated user can read their own row). Per project convention, schema lives in a migration even though `profiles` itself predates the migrations folder.

## Data

- **`profiles`** (existing, keyed on `id` = auth uid): `onboarding_completed boolean default false`. Read by the gate; written by `useCompleteOnboarding` / admin.
- **Auth user metadata** carries `goal`, `brand_name`, `company_name`, `full_name`, `first_name`, `last_name` so the wizard can prefill on resume after a fresh-session email click.

## Edge Cases

- **Email link opened in a different browser** still works — the token is in the URL hash and `/auth/confirm` establishes the session via `onAuthStateChange`.
- **No `profiles` row yet** → `maybeSingle()` returns null → treated as incomplete → routed to onboarding.
- **Fully-onboarded user navigates to `/onboarding` directly** → wizard mount detects `complete` → redirects `/home`.
- **User abandons after confirm, logs in later** → login gate → `/onboarding` (step 3).
- **Direct `/home` navigation post-confirm** bypasses onboarding (gate is confirm/login only) — accepted tradeoff.
- **`saveBrand` on resume** requires a workspace; `provision_workspace` (trial + `user_profiles` row) runs on first authenticated access, so the workspace exists by the time the user resumes at step 3.

## Name → metadata mapping

The wizard collects a single `name`. `signUp` metadata expects `first_name` / `last_name` / `company_name`. Mapping:
- `first_name` = first whitespace-delimited token of `name`
- `last_name` = remainder (may be empty)
- `company_name` = `brand_name` = `brandName`
- `full_name` = raw `name`

(Decided against splitting the wizard's name field into two inputs to avoid changing the approved step-0 UI.)

## Testing

Manual verification (no automated tests planned for this wiring):
1. Sign up via the wizard → receive confirmation email → click link → confirm resume at **Connect store** with name/brand/goal prefilled → finish → land on `/home`.
2. Query `profiles` to confirm `onboarding_completed = true` persisted.
3. Log out, log back in → land on `/inbox` (not onboarding).
4. Create a confirmed-but-not-onboarded user → log in → land on `/onboarding` at step 3.
5. Visit `/signup` → redirected to `/onboarding`.
6. Navigate to `/onboarding` as a fully-onboarded user → redirected to `/home`.

## Out of Scope

- Central AuthGuard enforcement of onboarding (explicitly deferred per decision 4).
- Full DB-persisted per-step wizard progress (resume fidelity is metadata-based, not step-exact).
- Billing/Shopify managed-pricing handoff at the pricing step (already a later pass per existing code comments).
