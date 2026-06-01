# Emma onboarding refactor — smoke test checklist

Verification steps to run after applying the two migrations in this PR
to the dev database:

1. `supabase/migrations/20260603000000_ai_policies_onboarding_refactor.sql`
2. `supabase/migrations/20260603000001_ai_scenarios_onboarding_refactor.sql`

Both are additive + idempotent — re-running is safe. Each ends with a
`DO $$` verification block that raises on assertion failure.

## SQL — verify schema landed cleanly

Run these one at a time in the Supabase SQL Editor.

```sql
-- 1) Confirm the new columns exist on ai_policies
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='ai_policies'
  AND column_name IN (
    'parcelpanel_url',
    'cancellation_window',
    'can_decide_options',
    'can_decide_notes',
    'cannot_decide_options',
    'cannot_decide_notes'
  )
ORDER BY column_name;
-- Expected: 6 rows.
```

```sql
-- 2) Confirm the dropped columns are gone
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='ai_policies'
  AND column_name IN ('languages', 'can_decide', 'escalate_triggers');
-- Expected: 0 rows.
```

```sql
-- 3) Confirm the new scenario columns on ai_scenarios
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='ai_scenarios'
  AND column_name IN ('triggers','must_do','must_not_do')
ORDER BY column_name;
-- Expected: 3 rows, all `text`.
```

```sql
-- 4) Confirm renamed scenario keys + no legacy rows remain
SELECT store_id, scenario_key
FROM public.ai_scenarios
WHERE scenario_key IN (
  'refund_or_return',
  'cancellation',
  'refund_or_cancel',
  'wismo',
  'order_status',
  'wrong_or_damaged',
  'wrong_or_damaged_item'
)
ORDER BY store_id, scenario_key;
-- Expected: rows ONLY with the new keys
--   (order_status, wrong_or_damaged_item, refund_or_return, cancellation).
-- No row should still have wismo / wrong_or_damaged / refund_or_cancel.
```

```sql
-- 5) Confirm ai_drafts.intent CHECK accepts the new 10 values
--    and no legacy values remain in the data
SELECT DISTINCT intent
FROM public.ai_drafts
ORDER BY intent;
-- Expected: only values from
--   {order_status, long_delivery, lost_package, wrong_or_damaged_item,
--    refund_or_return, cancellation, customs_fees, angry_or_chargeback,
--    other, unknown}
```

```sql
-- 6) Confirm ai_lessons.applies_to_scenario was migrated too
SELECT DISTINCT applies_to_scenario
FROM public.ai_lessons
WHERE applies_to_scenario IS NOT NULL
ORDER BY applies_to_scenario;
-- Expected: no wismo / wrong_or_damaged / refund_or_cancel left.
```

```sql
-- 7) Confirm ai_autonomy_rules.config.global_block_intents was rewritten
SELECT config -> 'global_block_intents' AS block_intents
FROM public.ai_autonomy_rules
WHERE config ? 'global_block_intents';
-- Expected: any row that previously had 'refund_or_cancel' now has both
-- 'refund_or_return' and 'cancellation' in the array. No row should
-- still contain 'wismo' / 'wrong_or_damaged' / 'refund_or_cancel'.
```

## UI — smoke checklist (Demo Store)

Start the dev server (or hit the Vercel preview deploy for this PR) and:

- [ ] `/settings/ai-agent/onboarding` loads with the Demo Store selected.
- [ ] **Fundament**: tone-of-voice is now a dropdown with the 4 options
      (Persoonlijk vanuit de eigenaar / Vriendelijk & warm /
      Professioneel & verzorgd / Direct & efficiënt). Defaults to
      Persoonlijk vanuit de eigenaar when empty. Legacy free-text values
      coerce to the same default on load.
- [ ] **Fundament**: the Languages field is **gone** entirely (no
      ChipInput, no helper text).
- [ ] **Policies**: "Agent can decide" shows the 8 checkboxes from
      CAN_DECIDE_PREDEFINED + an "Aanvullende notities (can decide)"
      textarea below. Save persists both halves.
- [ ] **Policies**: "Agent cannot decide" shows the 8 checkboxes from
      CANNOT_DECIDE_PREDEFINED + an "Aanvullende notities (cannot decide)"
      textarea. The old "Escalate triggers" ChipInput is gone.
- [ ] **Policies**: "ParcelPanel tracking URL" input renders with helper
      text "Statische tracking-URL waarmee Emma klanten doorverwijst".
- [ ] **Policies**: "Cancellation window" dropdown renders with the 4
      options (4 uur / 12 uur / 24 uur / Geen annulering mogelijk).
      Defaults to 24 uur.
- [ ] **Scenarios**: 8 cards visible (was 7) — the new card is
      "Cancellation". The renamed "Refund or return" card replaces what
      was previously "Refund or cancellation". "Where is my order?" still
      shows but its underlying key is now `order_status`. "Wrong or
      damaged item" still shows but its underlying key is now
      `wrong_or_damaged_item`.
- [ ] **Scenarios**: each card expands to 5 textareas — Triggers,
      Approach, Must do, Must not do, Escalate when. Each saves
      individually.
- [ ] **Completeness badges**: per-section badges go green only when
      every required field is filled (see getOnboardingStatus per
      Notion §6).
- [ ] **Rules page** at `/settings/ai-agent/rules`: the Block intents
      list now shows 10 rows (8 scenario titles + Other + Unknown).
      Default checked: Refund or return, Cancellation, Angry customer
      or chargeback.
- [ ] **AI Reply** on a fallback ticket (a conversation that's NOT
      tied to a store with completed onboarding) still works — the
      route falls back to DEFAULT_SYSTEM_PROMPT unchanged. No Phase 2
      regression.
- [ ] **AI Reply** on an Emma-eligible ticket: the new system prompt
      includes a tone-of-voice snippet, the language-auto-detect
      instruction, the new 5-field scenario blocks, and the scenario-
      rule reinforcement at the end ("Follow each scenario's must-do
      / must-not-do rules strictly…").

## Rollback

Both migrations are additive — rollback path is to manually:

- `ALTER TABLE public.ai_policies DROP COLUMN can_decide_options, …;`
- `ALTER TABLE public.ai_policies ADD COLUMN languages text[];`
- Revert the scenario_key UPDATEs by running the inverse mappings.
- Re-add the old ai_drafts.intent CHECK.

Realistically: keep the migrations forward-only; if the app needs to
roll back the code, the new columns become unused but harmless.
