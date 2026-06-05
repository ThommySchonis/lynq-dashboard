/**
 * Temporary flag that hides all client-facing billing surfaces while the new
 * billing system is being built. Reads `NEXT_PUBLIC_BILLING_UI_ENABLED` at
 * build time — must equal the literal string `'true'` to show billing.
 * Anything else (including unset) hides it.
 *
 * Spec: docs/superpowers/specs/2026-06-05-hide-billing-ui-temporarily-design.md
 */
export function isBillingUIEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BILLING_UI_ENABLED === 'true';
}
