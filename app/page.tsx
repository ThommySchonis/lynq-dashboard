import { redirect } from 'next/navigation'

// The App Store sends installs to application_url (this root). If Shopify
// install params are present, forward to the OAuth-first install entry;
// otherwise behave as before.
export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const shop = typeof sp.shop === 'string' ? sp.shop : undefined

  // A Shopify-originated open (App Store install OR opening the app from the
  // Admin) lands here with a `shop` param. Managed installation grants scopes
  // without calling the app, so the standalone app must start the authorization
  // code grant itself. `hmac` may or may not be present depending on the entry
  // point, so forward on `shop` alone; the install route verifies `hmac` when
  // present and the callback fully enforces hmac + state + code exchange.
  if (shop) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === 'string') qs.set(k, v)
    }
    redirect(`/api/auth/shopify/install?${qs.toString()}`)
  }

  redirect('/home')
}
