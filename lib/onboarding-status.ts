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
