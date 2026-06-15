import { assertEquals } from '@std/assert'
import { parseRateCents, priceEmmaUsage, type EmmaUsageStore } from '../lib/services/emma-usage.ts'

Deno.test('parseRateCents: valid decimal EUR → integer cents', () => {
  assertEquals(parseRateCents('0.05'), 5)
  assertEquals(parseRateCents('1'), 100)
  assertEquals(parseRateCents('0.123'), 12) // rounds to nearest cent
})

Deno.test('parseRateCents: unset / empty / invalid → 0', () => {
  assertEquals(parseRateCents(undefined), 0)
  assertEquals(parseRateCents(''), 0)
  assertEquals(parseRateCents('abc'), 0)
  assertEquals(parseRateCents('-1'), 0)
})

Deno.test('priceEmmaUsage: applies rate and shapes response', () => {
  const result = priceEmmaUsage(
    {
      period_start: '2026-06-01T00:00:00Z',
      period_end: '2026-07-01T00:00:00Z',
      total_count: 123,
      stores: [
        { store_id: 'a', store_name: 'Acme', count: 100 },
        { store_id: 'b', store_name: 'Beta', count: 23 },
      ],
    },
    5, // 5 cents per generation
  )

  assertEquals(result.rate_eur, 0.05)
  assertEquals(result.currency, 'EUR')
  assertEquals(result.total_count, 123)
  assertEquals(result.total_cost_eur, 6.15)
  assertEquals(result.stores[0].cost_eur, 5.0)
  assertEquals(result.stores[1].cost_eur, 1.15)
  // Per-store costs reconcile with the total.
  assertEquals(
    result.stores.reduce((sum: number, s: EmmaUsageStore) => sum + s.cost_eur, 0),
    result.total_cost_eur,
  )
})

Deno.test('priceEmmaUsage: empty stores → zero totals', () => {
  const result = priceEmmaUsage(
    { period_start: null, period_end: null, total_count: 0, stores: [] },
    5,
  )
  assertEquals(result.total_count, 0)
  assertEquals(result.total_cost_eur, 0)
  assertEquals(result.stores, [])
})

Deno.test('priceEmmaUsage: zero rate → zero cost, counts preserved', () => {
  const result = priceEmmaUsage(
    {
      period_start: null,
      period_end: null,
      total_count: 50,
      stores: [{ store_id: 'a', store_name: 'Acme', count: 50 }],
    },
    0,
  )
  assertEquals(result.total_count, 50)
  assertEquals(result.total_cost_eur, 0)
  assertEquals(result.stores[0].cost_eur, 0)
})
