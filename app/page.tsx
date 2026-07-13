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
  const hmac = typeof sp.hmac === 'string' ? sp.hmac : undefined

  if (shop && hmac) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === 'string') qs.set(k, v)
    }
    redirect(`/api/auth/shopify/install?${qs.toString()}`)
  }

  redirect('/home')
}
