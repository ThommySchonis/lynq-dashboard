'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useSubscription, useManageUrl } from '@/hooks/billing/use-billing-data'

const DISMISS_KEY = 'trial_banner_dismissed_until'

export function TrialEndingBanner() {
  const { data: subData } = useSubscription()
  const { data: manageUrl } = useManageUrl()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    try {
      const ts = window.localStorage.getItem(DISMISS_KEY)
      if (ts && Number.parseInt(ts, 10) > Date.now()) setHidden(true) // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      // ignore
    }
  }, [])

  function handleDismiss() {
    try {
      const until = Date.now() + 24 * 60 * 60 * 1000
      window.localStorage.setItem(DISMISS_KEY, String(until))
    } catch {
      // ignore
    }
    setHidden(true)
  }

  const sub = subData?.subscription
  if (!sub || hidden) return null

  const trialEndsAt = sub.trialEndsAt
  if (!trialEndsAt) return null

  const trialEnd = new Date(trialEndsAt)
  const now = new Date()
  if (trialEnd <= now) return null

  const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const isLastDay = daysLeft <= 1

  return (
    <div className="relative z-5 mx-6 mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/12 to-amber-600/6 p-3.5 px-[18px] shadow-[0_1px_2px_rgba(28,15,54,0.04)]">
      <div className="min-w-0 flex-[1_1_320px]">
        <div className="mb-0.5 text-sm font-semibold -tracking-[0.01em] text-amber-800">
          {isLastDay ? 'Your trial ends today' : `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
        </div>
        <div className="text-[13px] leading-normal text-amber-900">
          Pick a plan to continue using Lynq &amp; Flow.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {manageUrl ? (
          <Button
            size="sm"
            className="bg-amber-500 text-white hover:bg-amber-600"
            render={<a href={manageUrl} target="_blank" rel="noopener noreferrer" />}
          >
            Choose plan in Shopify
          </Button>
        ) : (
          <Button size="sm" className="bg-amber-500 text-white hover:bg-amber-600" render={<Link href="/settings/workspace/billing" />}>
            See plans
          </Button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="cursor-pointer rounded-md border-none bg-transparent px-3 py-2 text-xs font-medium text-amber-800 hover:text-amber-900"
        >
          Remind me tomorrow
        </button>
      </div>
    </div>
  )
}

export default TrialEndingBanner
