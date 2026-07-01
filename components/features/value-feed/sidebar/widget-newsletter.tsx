'use client'

import { useState } from 'react'

/**
 * Sidebar "Value, in your inbox" newsletter widget (Figma 396:8192).
 * Visual only — no real subscription backend (see plan); shows a success state.
 */
export function WidgetNewsletter() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) setDone(true)
  }

  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] border border-border bg-secondary px-[22px] py-6">
      <h2 className="text-sm font-semibold leading-5 text-foreground">Value, in your inbox</h2>
      <p className="text-sm leading-5 text-foreground-3/90">
        Get the weekly digest of tips, masterclasses and product updates.
      </p>

      {done ? (
        <p className="text-sm font-medium leading-5 text-primary">Thanks — you&apos;re subscribed.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-11 rounded-[10px] border border-border bg-card px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-foreground-4 focus:border-primary"
          />
          <button
            type="submit"
            className="h-11 cursor-pointer rounded-[10px] bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Subscribe
          </button>
        </form>
      )}
    </section>
  )
}
