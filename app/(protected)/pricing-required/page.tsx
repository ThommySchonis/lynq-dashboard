'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { useSubscription, useManageUrl } from '@/hooks/billing'
import { useSignOut } from '@/hooks/auth'

export default function PricingRequiredPage() {
  const router = useRouter()
  const session = useAuthStore((s) => s.session)
  const signOut = useSignOut()
  const { data: subData } = useSubscription()
  const { data: manageUrl } = useManageUrl()

  // If the user already has an active/trial/grandfathered subscription,
  // send them to /home (e.g. arrived here via stale bookmark).
  useEffect(() => {
    const sub = subData?.subscription
    if (!sub) return
    const ok = sub.isGrandfathered || sub.status === 'active' || sub.status === 'trial'
    if (ok) router.replace('/home')
  }, [subData, router])

  function handleLogout() {
    signOut.mutate(undefined, {
      onSuccess: () => router.push('/login'),
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Choose your plan to continue</h1>
        <p className="text-sm text-muted-foreground">
          Lynq is billed through Shopify. Pick a plan from your Shopify admin to start your 14-day free trial.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-base font-medium">Plans</h2>
        <ul className="space-y-2 text-sm">
          <li><strong>Starter</strong> — €30 / month</li>
          <li><strong>Growth</strong> — €89 / month</li>
          <li><strong>Scale</strong> — €249 / month</li>
          <li><strong>Enterprise</strong> — €599 / month</li>
        </ul>
        <p className="text-xs text-muted-foreground">14-day free trial on every plan.</p>
      </div>

      {manageUrl ? (
        <a
          href={manageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Choose your plan in Shopify ↗
        </a>
      ) : (
        <p className="text-sm text-destructive">
          No connected Shopify store found. Connect a store first in Settings → Stores.
        </p>
      )}

      {session && (
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={handleLogout}
            disabled={signOut.isPending}
            className="bg-transparent border-none text-foreground-4 text-xs cursor-pointer underline font-[inherit] disabled:opacity-50"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
