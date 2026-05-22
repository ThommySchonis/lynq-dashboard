import Link from 'next/link'

export function ShopifySettings() {
  return (
    <div className="text-sm text-foreground-2">
      Shopify connections are now managed in{' '}
      <Link href="/settings/workspace/stores" className="text-primary underline">
        Stores
      </Link>.
    </div>
  )
}
