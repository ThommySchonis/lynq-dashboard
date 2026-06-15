import { getAdminClient } from '../supabase.ts'

export interface EmmaUsageStore {
  store_id: string
  store_name: string
  count: number
  cost_eur: number
}

export interface EmmaUsageResponse {
  rate_eur: number
  currency: 'EUR'
  period_start: string | null
  period_end: string | null
  total_count: number
  total_cost_eur: number
  stores: EmmaUsageStore[]
}

// Shape returned by the api_get_emma_billing RPC (counts only).
interface EmmaBillingRpcStore {
  store_id: string
  store_name: string
  count: number
}

interface EmmaBillingRpcResult {
  period_start: string | null
  period_end: string | null
  total_count: number
  stores: EmmaBillingRpcStore[]
}

const EMPTY_RPC: EmmaBillingRpcResult = {
  period_start: null,
  period_end: null,
  total_count: 0,
  stores: [],
}

/** Parse the EUR decimal rate env value into integer cents. Default 0. */
export function parseRateCents(envValue: string | undefined): number {
  if (!envValue) return 0
  const n = Number(envValue)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

const centsToEur = (cents: number): number => Math.round(cents) / 100

/** Apply an integer-cents rate to RPC counts and shape the response. Pure. */
export function priceEmmaUsage(
  rpc: EmmaBillingRpcResult,
  rateCents: number,
): EmmaUsageResponse {
  const stores: EmmaUsageStore[] = (rpc.stores ?? []).map((s) => ({
    store_id: s.store_id,
    store_name: s.store_name,
    count: s.count,
    cost_eur: centsToEur(s.count * rateCents),
  }))

  const totalCount = rpc.total_count ?? 0

  return {
    rate_eur: centsToEur(rateCents),
    currency: 'EUR',
    period_start: rpc.period_start,
    period_end: rpc.period_end,
    total_count: totalCount,
    total_cost_eur: centsToEur(totalCount * rateCents),
    stores,
  }
}

/** Fetch counts via the RPC and apply the env rate. */
export async function getEmmaUsage(workspaceId: string): Promise<EmmaUsageResponse> {
  const supabase = getAdminClient()
  const { data, error } = await supabase.rpc('api_get_emma_billing', {
    p_workspace_id: workspaceId,
  })
  if (error) throw new Error(error.message)

  const rpc = (data ?? EMPTY_RPC) as EmmaBillingRpcResult
  const rateCents = parseRateCents(Deno.env.get('EMMA_COST_PER_TRIGGER_EUR'))
  return priceEmmaUsage(rpc, rateCents)
}
