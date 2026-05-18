/**
 * Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD from request URL.
 * Falls back to start-of-current-month to today in Amsterdam timezone.
 * Returns bare YYYY-MM-DD strings — callers add time boundaries if needed.
 */
export function parseDateRange(request: { url: string }) {
  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  if (fromParam && toParam) {
    return { from: fromParam, to: toParam }
  }

  // Default: start of current month -> today in Amsterdam timezone
  const now = new Date()
  const amsterdamNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })
  )
  const year = amsterdamNow.getFullYear()
  const month = String(amsterdamNow.getMonth() + 1).padStart(2, '0')
  const day = String(amsterdamNow.getDate()).padStart(2, '0')

  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${day}`,
  }
}
