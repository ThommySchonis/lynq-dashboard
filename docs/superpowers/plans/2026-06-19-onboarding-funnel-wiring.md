# Onboarding Funnel Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the onboarding wizard the canonical signup + onboarding funnel, retire `/signup`, and ensure an un-onboarded user is sent into (and resumes) the wizard after email confirmation and login.

**Architecture:** The 7-step wizard at `/onboarding` does real account creation at step 1 (`signUp`), then waits on the email-confirm step. The confirmation link lands on `/auth/confirm`, which — like `/login` — reads the user's onboarding status via a `SECURITY DEFINER` RPC and routes incomplete users to `/onboarding`. On mount with a session, the wizard resumes at the Connect-store step, prefilling name/brand/goal from `signUp` user-metadata. `/signup` becomes a redirect to `/onboarding`.

**Tech Stack:** Next.js 16 (app router, React 19), Supabase JS (auth + RPC), TanStack Query, react-hook-form + zod, Tailwind v4, Zustand.

## Global Constraints

- TypeScript only. No `any` — use `unknown`, typed guards, or `Record<string, unknown>` (ESLint `no-explicit-any` / `no-unsafe-*` enforced).
- Use the `@/` path alias for all imports — no `../../../`.
- Schema changes go through `supabase migration new` → SQL in `supabase/migrations/` → `supabase db push`. Never run SQL in the editor.
- This project has **no automated test runner** (package.json scripts: `dev`, `build`, `lint`, `format`). Per-task verification is `npm run lint`; final verification is `npm run build` + a manual browser walkthrough. Do **not** invent a test framework.
- **No git commit/push steps** (per `CLAUDE.local.md`). Committing is a separate, user-initiated action. `supabase db push` (remote DB) is allowed — it is not a git operation.
- Before editing files in these areas, invoke the matching project skill: components/hooks/`.tsx` → `component-rules`; `app/**/page.tsx` → `page-rules`; DB schema/functions → `migration-rules`.
- Brand accent gradient and existing wizard styling must be preserved — only wire behavior, don't restyle approved steps.

---

### Task 1: Onboarding-status RPC migration

Reads the current user's `profiles.onboarding_completed` via a `SECURITY DEFINER` function so the client never needs RLS read access to `profiles`. Also guarantees the column exists.

**Files:**
- Create: `supabase/migrations/20260619000000_onboarding_status_rpc.sql`

**Interfaces:**
- Produces: SQL function `public.api_onboarding_status() returns boolean` (granted to `authenticated`), returning `true` only when the caller's `profiles` row has `onboarding_completed = true`, `false` otherwise (including no row).

**Invoke first:** `migration-rules` skill.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260619000000_onboarding_status_rpc.sql`:

```sql
-- ============================================================
-- api_onboarding_status — returns whether the calling user has
-- completed onboarding. SECURITY DEFINER so the public/anon client
-- (authenticated session) can read its own flag without a profiles
-- RLS select policy. Reads profiles by auth.uid(); no row => false.
--
-- Also ensures profiles.onboarding_completed exists (profiles predates
-- the migrations folder; add the column idempotently if missing).
-- ============================================================

begin;

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

create or replace function public.api_onboarding_status()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select onboarding_completed from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.api_onboarding_status() from public;
grant execute on function public.api_onboarding_status() to authenticated;

commit;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply the migration to remote**

Run from `lynq-dashboard/`:
```bash
supabase db push
```
Expected: the new migration applies cleanly (no error). If `profiles` already had `onboarding_completed`, the `add column if not exists` is a no-op.

- [ ] **Step 3: Verify the function exists and returns a boolean**

In an authenticated app context this returns `false` for a fresh user. Confirm the function is registered (PostgREST schema reloaded) by checking it appears via the Supabase API, or re-run `supabase db push` and confirm it reports no pending migrations.

---

### Task 2: `getOnboardingStatus` client helper

Single source of truth for reading onboarding status from the client. Used by `/auth/confirm`, `/login`, and the wizard mount.

**Files:**
- Create: `lib/onboarding-status.ts`

**Interfaces:**
- Consumes: `rpc` from `@/lib/rpc` (signature `rpc<T>(fn: string, params?: Record<string, unknown>): Promise<T>`), RPC `api_onboarding_status` (Task 1).
- Produces: `export async function getOnboardingStatus(): Promise<boolean>` — resolves `true` when onboarding is complete, `false` otherwise (including on error, fail-open to onboarding).

- [ ] **Step 1: Write the helper**

Create `lib/onboarding-status.ts`:

```ts
import { rpc } from '@/lib/rpc'

/**
 * Returns true when the current authenticated user has finished onboarding.
 * Reads via the api_onboarding_status SECURITY DEFINER RPC. On any error we
 * resolve false (treat as incomplete) so the user is routed to onboarding
 * rather than silently skipping it.
 */
export async function getOnboardingStatus(): Promise<boolean> {
  try {
    const complete = await rpc<boolean>('api_onboarding_status')
    return complete === true
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors for `lib/onboarding-status.ts`.

---

### Task 3: Extend `useSignUp` with onboarding metadata

Carries the wizard's name/brand/goal into Supabase user-metadata so the wizard can prefill on resume after a fresh-session email click.

**Files:**
- Modify: `hooks/auth/use-auth-mutations.ts` (`SignUpVariables` interface + `useSignUp`)

**Interfaces:**
- Produces: `SignUpVariables` gains optional `brand_name?: string`, `full_name?: string`, `goal?: string`. `useSignUp().mutate`/`mutateAsync` accept them and write them into `options.data` alongside the existing fields.

**Invoke first:** `component-rules` skill (this is a hooks file).

- [ ] **Step 1: Extend the variables interface**

In `hooks/auth/use-auth-mutations.ts`, update `SignUpVariables`:

```ts
export interface SignUpVariables {
  email: string
  password: string
  first_name: string
  last_name: string
  company_name: string
  brand_name?: string
  full_name?: string
  goal?: string
}
```

- [ ] **Step 2: Pass the new fields into `options.data`**

Replace the `useSignUp` mutationFn body's `data` block so all metadata is forwarded:

```ts
export function useSignUp() {
  return useMutation({
    mutationFn: async ({
      email,
      password,
      first_name,
      last_name,
      company_name,
      brand_name,
      full_name,
      goal,
    }: SignUpVariables) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            company_name: company_name.trim(),
            ...(brand_name ? { brand_name: brand_name.trim() } : {}),
            ...(full_name ? { full_name: full_name.trim() } : {}),
            ...(goal ? { goal } : {}),
          },
        },
      })
      if (error) throw error
      return data
    },
  })
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors. The existing `/signup` page (which doesn't pass the new optional fields) still type-checks.

---

### Task 4: Add `hideNext` to `ProgressFooter`

The email-confirm step must not let users click "Continue" past it — progression happens via the email link. Add an opt-out for the Next button while keeping the progress bar.

**Files:**
- Modify: `components/features/onboarding/progress-footer.tsx`

**Interfaces:**
- Produces: `ProgressFooterProps` gains `hideNext?: boolean`. When true, the Next `<Button>` is not rendered and `onNext` is not required to do anything.

**Invoke first:** `component-rules` skill.

- [ ] **Step 1: Add the prop and guard the Next button**

Update the interface and the Next button render:

```tsx
interface ProgressFooterProps {
  /** Zero-based index of the current step. */
  stepIndex: number
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  /** Hide the Next button entirely (e.g. when progression is external). */
  hideNext?: boolean
}

export function ProgressFooter({
  stepIndex,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
  hideNext,
}: ProgressFooterProps) {
```

Then in the JSX, wrap the Next `<Button>`:

```tsx
        {!hideNext && (
          <Button
            onClick={onNext}
            disabled={nextDisabled}
            className="h-11 min-w-[185px] rounded-lg bg-foreground px-10 text-sm font-semibold text-background hover:bg-foreground/90 active:bg-foreground/90"
          >
            {nextLabel}
          </Button>
        )}
```

(`onNext` becomes optional; existing callers that pass it are unaffected.)

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. Existing steps still compile (they all pass `onNext`).

---

### Task 5: Add submitting/error props to `StepAccount`

The account step's footer button must reflect the async `signUp` (pending label + disabled) and show signup errors. The wizard owns the mutation and passes state down.

**Files:**
- Modify: `components/features/onboarding/steps/step-account.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `StepAccountProps` gains `submitting?: boolean` and `errorMessage?: string`. Footer shows "Creating…" + disabled while submitting; `errorMessage` renders above the footer.

**Invoke first:** `component-rules` skill.

- [ ] **Step 1: Extend props and footer/error rendering**

Update the interface:

```tsx
interface StepAccountProps {
  stepIndex: number
  defaultValues: AccountFormData
  onBack: () => void
  onNext: (values: AccountFormData) => void
  submitting?: boolean
  errorMessage?: string
}
```

Update the component signature to destructure `submitting` and `errorMessage`, and change the `ProgressFooter` usage:

```tsx
export function StepAccount({
  stepIndex,
  defaultValues,
  onBack,
  onNext,
  submitting,
  errorMessage,
}: StepAccountProps) {
```

```tsx
        <ProgressFooter
          stepIndex={stepIndex}
          onBack={onBack}
          onNext={() => void handleSubmit(onNext)()}
          nextLabel={submitting ? 'Creating…' : 'Create account'}
          nextDisabled={!isValid || submitting}
        />
```

Add the error block immediately before the closing `</form>` (after the Terms paragraph):

```tsx
        {errorMessage && (
          <p role="alert" className="text-xs text-destructive">
            {errorMessage}
          </p>
        )}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

---

### Task 6: Wire resend + hide Next on `StepConfirm`

Replace the dead "Resend email" button with the working `ResendConfirmationButton`, and hide the Next button (the user must click the email link to advance).

**Files:**
- Modify: `components/features/onboarding/steps/step-confirm.tsx`

**Interfaces:**
- Consumes: `ResendConfirmationButton` (default export from `@/components/features/auth/resend-confirmation-button`), `ProgressFooter.hideNext` (Task 4).
- Produces: `StepConfirmProps` — `onNext` becomes optional (no longer used to advance).

**Invoke first:** `component-rules` skill.

- [ ] **Step 1: Update imports and props**

Replace the `Button` import with the resend button and make `onNext` optional:

```tsx
'use client'

import { Mail, TriangleAlert } from 'lucide-react'
import ResendConfirmationButton from '@/components/features/auth/resend-confirmation-button'
import { WizardShell } from '../wizard-shell'
import { ProgressFooter } from '../progress-footer'
import { StepHeading } from '../step-heading'
import { IconBadge } from '../icon-badge'

interface StepConfirmProps {
  stepIndex: number
  email: string
  onBack: () => void
  onNext?: () => void
}
```

- [ ] **Step 2: Hide Next and swap the resend control**

Update the component body:

```tsx
export function StepConfirm({ stepIndex, email, onBack }: StepConfirmProps) {
  return (
    <WizardShell footer={<ProgressFooter stepIndex={stepIndex} onBack={onBack} hideNext />}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
        <IconBadge icon={Mail} />

        <StepHeading
          center
          title="Check your inbox"
          description={
            <>
              We&apos;ve sent a confirmation link to{' '}
              <span className="underline">{email || 'your email'}.</span> Click it to continue.
            </>
          }
        />

        <div className="flex flex-col items-center gap-3">
          <div className="text-center">
            <p className="text-sm text-foreground">Didn&apos;t receive the email?</p>
            <p className="text-sm text-foreground-3">Check your spam folder before resending.</p>
          </div>
          <ResendConfirmationButton email={email} variant="inline" />
        </div>

        <div className="flex items-center gap-2.5 rounded-lg bg-warning-soft px-4 py-2.5 text-left text-xs text-foreground-2">
          <TriangleAlert className="size-5 shrink-0 text-warning" />
          You won&apos;t be able to log back in without confirming
        </div>
      </div>
    </WizardShell>
  )
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

---

### Task 7: Wire the wizard — real signup + resume/redirect logic

The core task. The wizard now: (a) calls `signUp` at the account step and advances to the confirm step; (b) on mount with a session, checks onboarding status — redirecting completed users to `/home`, or resuming incomplete users at the Connect-store step with metadata prefilled and brand persisted.

**Files:**
- Modify: `components/features/onboarding/onboarding-wizard.tsx`

**Interfaces:**
- Consumes: `getOnboardingStatus` (Task 2), `useSignUp` with new metadata fields (Task 3), `StepAccount` `submitting`/`errorMessage` props (Task 5), `useSaveBrand`/`useCompleteOnboarding`/`useAuthStore` (existing).
- Produces: the funnel behavior described in the spec.

**Invoke first:** `component-rules` skill.

- [ ] **Step 1: Replace the wizard file**

Replace the entire contents of `components/features/onboarding/onboarding-wizard.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useSignUp } from '@/hooks/auth/use-auth-mutations'
import { useSaveBrand, useCompleteOnboarding } from '@/hooks/onboarding'
import { getOnboardingStatus } from '@/lib/onboarding-status'
import { StepGoal } from './steps/step-goal'
import { StepAccount } from './steps/step-account'
import { StepConfirm } from './steps/step-confirm'
import { StepConnectStore } from './steps/step-connect-store'
import { StepTeamVolume } from './steps/step-team-volume'
import { StepHearAbout } from './steps/step-hear-about'
import { StepPricing } from './steps/step-pricing'
import { INITIAL_WIZARD_DATA } from '@/lib/onboarding-constants'
import type { WizardData, PricingPlan, AccountFormData } from '@/lib/onboarding-constants'

const CONNECT_STORE_STEP = 3

/** Reads a string field from Supabase user_metadata without using `any`. */
function metaString(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = meta?.[key]
  return typeof value === 'string' ? value : undefined
}

/** Orchestrates the 7-step onboarding wizard (now the canonical signup funnel). */
export function OnboardingWizard() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const session = useAuthStore((s) => s.session)
  const authLoading = useAuthStore((s) => s.isLoading)
  const signUp = useSignUp()
  const saveBrand = useSaveBrand()
  const completeOnboarding = useCompleteOnboarding()

  const [stepIndex, setStepIndex] = useState(0)
  const [data, setData] = useState<WizardData>(INITIAL_WIZARD_DATA)
  // Until we've resolved an existing session's onboarding status, we hold the
  // UI to avoid flashing step 0 to a user who should resume at Connect-store.
  const [booted, setBooted] = useState(false)

  const next = () => setStepIndex((i) => i + 1)
  const back = () => setStepIndex((i) => i - 1)
  const patch = (values: Partial<WizardData>) => setData((d) => ({ ...d, ...values }))

  const account = { name: data.name, email: data.email, storeName: data.brandName }

  // On mount: if already authenticated, branch on onboarding status. Completed
  // users leave; incomplete users resume at Connect-store with name/brand/goal
  // restored from signUp metadata (which survives a fresh-session email click).
  useEffect(() => {
    if (booted || authLoading) return
    if (!session || !user) {
      setBooted(true)
      return
    }
    let cancelled = false
    void getOnboardingStatus().then((complete) => {
      if (cancelled) return
      if (complete) {
        router.replace('/home')
        return
      }
      const meta = user.user_metadata as Record<string, unknown> | undefined
      const brand = metaString(meta, 'brand_name')
      const goalMeta = metaString(meta, 'goal')
      setData((d) => ({
        ...d,
        name: metaString(meta, 'full_name') ?? d.name,
        brandName: brand ?? d.brandName,
        goal: (goalMeta as WizardData['goal']) ?? d.goal,
      }))
      if (brand) {
        saveBrand.mutate({ brandName: brand, language: 'English', tone: 'professional' })
      }
      setStepIndex(CONNECT_STORE_STEP)
      setBooted(true)
    })
    return () => {
      cancelled = true
    }
    // saveBrand is a stable mutation object; intentionally excluded.
  }, [booted, authLoading, session, user, router]) // eslint-disable-line react-hooks/exhaustive-deps

  // Account step: create the real account, then wait on email confirmation.
  function handleAccountNext(values: AccountFormData) {
    patch(values)
    const trimmed = data.name.trim()
    const firstSpace = trimmed.indexOf(' ')
    const firstName = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)
    const lastName = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1)
    signUp.mutate(
      {
        email: values.email,
        password: values.password,
        first_name: firstName,
        last_name: lastName,
        company_name: data.brandName,
        brand_name: data.brandName,
        full_name: data.name,
        goal: data.goal ?? undefined,
      },
      {
        onSuccess: (res) => {
          // Email confirmation on => no session yet: show the confirm step.
          // Auto-confirm fallback => session present: persist brand and skip
          // straight to Connect-store in the same tab.
          if (res.session) {
            if (data.brandName) {
              saveBrand.mutate({
                brandName: data.brandName,
                language: 'English',
                tone: 'professional',
              })
            }
            setStepIndex(CONNECT_STORE_STEP)
          } else {
            next()
          }
        },
      },
    )
  }

  // Final step: mark onboarding complete, then continue to the dashboard.
  function handleFinish() {
    if (user) {
      completeOnboarding.mutate(user.id, { onSuccess: () => router.push('/home') })
    } else {
      router.push('/login')
    }
  }

  // Hold rendering while we resolve an authenticated user's resume target.
  if (session && !booted) {
    return (
      <div className="flex min-h-screen items-center justify-center text-foreground-3">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  const signUpError =
    signUp.error instanceof Error ? signUp.error.message : undefined

  switch (stepIndex) {
    case 0:
      return (
        <StepGoal
          stepIndex={stepIndex}
          defaultValues={{ name: data.name, brandName: data.brandName, goal: data.goal ?? undefined }}
          onNext={(values) => {
            patch(values)
            next()
          }}
        />
      )
    case 1:
      return (
        <StepAccount
          stepIndex={stepIndex}
          defaultValues={{ email: data.email, password: data.password }}
          onBack={back}
          onNext={handleAccountNext}
          submitting={signUp.isPending}
          errorMessage={signUpError}
        />
      )
    case 2:
      return <StepConfirm stepIndex={stepIndex} email={data.email} onBack={back} />
    case 3:
      return <StepConnectStore stepIndex={stepIndex} onBack={back} onNext={next} />
    case 4:
      return (
        <StepTeamVolume
          stepIndex={stepIndex}
          account={account}
          agentCount={data.agentCount}
          ticketVolume={data.ticketVolume}
          onChange={patch}
          onBack={back}
          onNext={next}
        />
      )
    case 5:
      return (
        <StepHearAbout
          stepIndex={stepIndex}
          account={account}
          referral={data.referral}
          referralDetails={data.referralDetails}
          onChange={patch}
          onBack={back}
          onNext={next}
        />
      )
    case 6:
      return (
        <StepPricing
          stepIndex={stepIndex}
          account={account}
          plan={data.plan}
          onSelect={(plan: PricingPlan['id']) => patch({ plan })}
          onBack={back}
          onNext={handleFinish}
        />
      )
    default:
      return null
  }
}
```

- [ ] **Step 2: Confirm `AccountFormData` is exported from constants**

`AccountFormData` is imported from `@/lib/onboarding-constants`. It is already exported there (`export type AccountFormData = z.infer<typeof accountSchema>`). No change needed — just confirm the import resolves.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors. (Note: the back-navigation from the account step still works; going back from confirm returns to the account form.)

---

### Task 8: Route `/auth/confirm` by onboarding status

After the confirmation link establishes a session, send incomplete users to `/onboarding` (which then resumes at Connect-store) instead of always `/home`.

**Files:**
- Modify: `app/auth/confirm/page.tsx`

**Interfaces:**
- Consumes: `getOnboardingStatus` (Task 2).

**Invoke first:** `page-rules` skill.

- [ ] **Step 1: Add a status-aware settle helper and use it for every signed-in path**

In `app/auth/confirm/page.tsx`, add the import:

```tsx
import { getOnboardingStatus } from '@/lib/onboarding-status'
```

Inside the `useEffect`, after the `goTo` definition, add:

```tsx
    const settle = () => {
      void getOnboardingStatus().then((complete) => {
        goTo(complete ? '/home' : '/onboarding')
      })
    }
```

Then replace the three signed-in redirects:
- In the `onAuthStateChange` handler, change `goTo('/home')` → `settle()`.
- In the initial `getSession().then(...)`, change the `if (session) { goTo('/home'); return }` branch's `goTo('/home')` → `settle()`.
- In the delayed `getSession().then(...)`, change the `if (s2) { goTo('/home') }` branch's `goTo('/home')` → `settle()`.

Leave the `goTo('/login')` fallback (ambiguous/no-session) unchanged.

- [ ] **Step 2: Repoint the expired-link CTA to `/onboarding`**

In the same file, the "Request a new link" CTA links to `/signup`. Change it to `/onboarding`:

```tsx
            href="/onboarding"
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

---

### Task 9: Route `/login` by onboarding status

After sign-in, send incomplete users to `/onboarding`; completed users to their requested `redirectTo` (default `/inbox`).

**Files:**
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: `getOnboardingStatus` (Task 2).

**Invoke first:** `page-rules` skill.

- [ ] **Step 1: Import the helper**

Add to `app/login/page.tsx`:

```tsx
import { getOnboardingStatus } from '@/lib/onboarding-status'
```

- [ ] **Step 2: Route the already-signed-in effect**

Replace the existing effect:

```tsx
  useEffect(() => {
    if (isLoading || !session) return
    void getOnboardingStatus().then((complete) => {
      router.replace(complete ? redirectTo : '/onboarding')
    })
  }, [isLoading, session, router, redirectTo])
```

- [ ] **Step 3: Route the sign-in success handler**

In `handleSubmit`'s `onSuccess`, replace the final `router.push(redirectTo)` with a status check (keep the consent-sync block above it unchanged):

```tsx
        onSuccess: (data) => {
          // Fire-and-forget consent sync to Supabase
          const consent = getConsent()
          if (consent && data.session?.access_token) {
            fetch(apiUrl('auth/consent-sync'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.session.access_token}`,
              },
              body: JSON.stringify({ level: consent.level }),
            }).catch(() => {
              // Non-blocking — consent sync failure should not affect login
            })
          }
          void getOnboardingStatus().then((complete) => {
            router.push(complete ? redirectTo : '/onboarding')
          })
        },
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

---

### Task 10: Retire `/signup`

Make `/signup` redirect to `/onboarding`, and add `/onboarding` to the public-route and blocked-state exemption lists so the new entry point behaves like the old signup page.

**Files:**
- Modify: `app/signup/page.tsx`
- Modify: `components/features/cookie-consent/cookie-consent-banner.tsx`
- Modify: `components/shared/blocked-state-guard.tsx`

**Interfaces:**
- Consumes: nothing.

**Invoke first:** `page-rules` skill (for `app/signup/page.tsx`), then `component-rules` for the two component edits.

- [ ] **Step 1: Replace the signup page with a redirect**

Replace the entire contents of `app/signup/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function SignupPage() {
  redirect('/onboarding')
}
```

- [ ] **Step 2: Add `/onboarding` to cookie-consent public routes**

In `components/features/cookie-consent/cookie-consent-banner.tsx`, update the `PUBLIC_ROUTES` constant:

```tsx
const PUBLIC_ROUTES = ['/login', '/signup', '/onboarding', '/forgot-password']
```

- [ ] **Step 3: Add `/onboarding` to blocked-state-guard exemptions**

In `components/shared/blocked-state-guard.tsx`, add `'/onboarding'` to the exemption array that currently contains `'/signup'` (insert immediately after the `'/signup'` entry, matching the existing formatting).

- [ ] **Step 4: Confirm no other inbound `/signup` links need changing**

Run: `grep -rn "\"/signup\"\|'/signup'\|href=\"/signup\"" app components lib hooks | grep -v node_modules`
Expected: remaining matches are only the invite flow (`/invites/${token}/signup`) and the constants just edited. The login footer already points to `/onboarding`; `/auth/confirm` was repointed in Task 8. No further changes.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors.

---

### Task 11: Build + manual end-to-end verification

No automated tests exist; verify with a production build and a manual walkthrough.

**Files:** none (verification only).

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 2: New-user funnel (email confirmation on)**

Start dev (`npm run dev`) and, with a fresh email:
1. Go to `/onboarding`. Complete step 0 (name, brand, goal).
2. Step 1: enter email + password → "Create account". Expect the button to show "Creating…", then advance to the **Check your inbox** step (no Next button, working resend link).
3. Open the confirmation email; click the link. Expect to land authenticated and be routed to `/onboarding`, **resumed at Connect store (step 4 of 7)**, with name/brand/goal preserved.
4. Complete steps 4–7 → Finish. Expect to land on `/home`.

- [ ] **Step 3: Completion persisted + returning login**

1. In Supabase, confirm the user's `profiles.onboarding_completed = true`.
2. Log out, then log in via `/login`. Expect to land on `/inbox` (not `/onboarding`).

- [ ] **Step 4: Incomplete user is redirected**

1. Create/confirm a user who has **not** finished onboarding (e.g. abandon after confirmation).
2. Log in via `/login`. Expect redirect to `/onboarding`, resumed at Connect store.

- [ ] **Step 5: Guard cases**

1. As a fully-onboarded user, navigate directly to `/onboarding`. Expect redirect to `/home`.
2. Navigate to `/signup`. Expect redirect to `/onboarding`.
3. Use an expired confirmation link. Expect the "Link expired" screen; its CTA points to `/onboarding`.

---

## Self-Review

**Spec coverage:**
- Wizard becomes canonical funnel / `signUp` at step 1 → Task 3 (metadata) + Task 5 (UI) + Task 7 (wiring). ✔
- Email-confirm resume at Connect-store carrying name/brand/goal → Task 3 (metadata write) + Task 7 (mount resume) + Task 8 (`/auth/confirm` routing). ✔
- Step 2 resend wired → Task 6. ✔
- `/auth/confirm` routes by status → Task 8. ✔
- `/login` routes by status (both paths) → Task 9. ✔
- Retire `/signup` + repoint links → Task 10 (+ Task 8 step 2 for the confirm CTA). ✔
- Completion tracking helper + column → Task 1 (column + RPC) + Task 2 (helper). ✔
- Gate only at confirm + login (not AuthGuard) → Tasks 8/9 only; AuthGuard untouched. ✔
- Edge cases (no profiles row → incomplete; fully-onboarded hits `/onboarding` → `/home`; saveBrand on resume) → Task 7 + Task 1 (`coalesce(..., false)`). ✔
- name→first/last split, company_name←brand → Task 7 step 1. ✔

**Placeholder scan:** No TBD/TODO; all code blocks are complete; verification commands have expected outputs. ✔

**Type consistency:** `getOnboardingStatus()` (no args, `Promise<boolean>`) is defined in Task 2 and called the same way in Tasks 7/8/9. `SignUpVariables` optional fields added in Task 3 are exactly the ones Task 7 passes (`brand_name`, `full_name`, `goal`). `ProgressFooter.hideNext` (Task 4) is consumed in Task 6. `StepAccount` `submitting`/`errorMessage` (Task 5) match Task 7's usage. `CONNECT_STORE_STEP = 3` matches the `case 3` Connect-store step. ✔

## Out of Scope (per spec)

- Central AuthGuard onboarding enforcement (deferred).
- Full DB-persisted per-step wizard progress.
- Billing / Shopify managed-pricing handoff at the pricing step.
