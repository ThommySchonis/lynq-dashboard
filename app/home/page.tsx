'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { WelcomeBanner } from '@/components/shared/welcome-banner'
import { TrialEndingBanner } from '@/components/shared/trial-ending-banner'
import { isTrialEndingSoon } from '@/lib/trialStatus'
import { useHomeKpis, useOnboardingStatus, useAiChat } from '@/hooks/home'
import { Search, ArrowUp, Send } from 'lucide-react'
import { SUGGESTIONS } from '@/lib/home-constants'
import { getGreeting } from '@/lib/home-utils'
import { ChatMessageBubble } from '@/components/features/home/chat-message-bubble'

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const router = useRouter()
  const session = useAuthStore((s) => s.session)
  const user = useAuthStore((s) => s.user)
  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState('')
  const [welcomeHidden, setWelcomeHidden] = useState(false)

  const heroInputRef = useRef<HTMLInputElement>(null)
  const bottomInputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const greeting = getGreeting()

  // Derive user name
  const meta = user?.user_metadata
  const rawEmail = (user?.email ?? '').split('@')[0]
  const userName =
    (meta?.full_name as string) ??
    (meta?.name as string) ??
    (rawEmail.charAt(0).toUpperCase() + rawEmail.slice(1))

  // Hooks
  const { data: shopifyContext, isFetched: contextLoaded } = useHomeKpis()
  const { data: onboarding } = useOnboardingStatus()
  const { messages, isStreaming, sendMessage } = useAiChat()

  // Session check
  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) {
        router.push('/login')
      }
    })
  }, [router])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus bottom input after streaming ends
  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      const t = setTimeout(() => bottomInputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [isStreaming, messages.length])

  // Banner logic
  const trialEndingShouldShow =
    !!onboarding &&
    isTrialEndingSoon({
      subscription_status: onboarding.subscription_status,
      trial_ends_at: onboarding.trial_ends_at,
    })

  const welcomeShouldShow =
    !trialEndingShouldShow &&
    !welcomeHidden &&
    onboarding?.subscription_status === 'trial' &&
    !onboarding?.user?.welcome_dismissed_at

  // Handlers
  function handleSend(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setInput('')
    sendMessage(trimmed, shopifyContext ?? undefined)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const hasMsg = messages.length > 0

  if (!mounted) return null

  return (
    <div className="flex min-h-screen bg-[#F5F4FF] font-[Switzer,-apple-system,BlinkMacSystemFont,sans-serif] antialiased">
      <Sidebar />

      <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#F5F4FF]">
        {/* Banners */}
        {trialEndingShouldShow && <TrialEndingBanner />}
        {welcomeShouldShow && (
          <WelcomeBanner
            firstName={onboarding?.user?.first_name ?? userName}
            onDismissed={() => setWelcomeHidden(true)}
          />
        )}

        {/* Orbs */}
        <div
          className="pointer-events-none absolute -right-[100px] -top-[200px] z-0 h-[800px] w-[800px] rounded-full blur-[60px]"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)',
            animation: 'orbFloat1 18s ease-in-out infinite',
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-[200px] -left-[100px] z-0 h-[700px] w-[700px] rounded-full blur-[60px]"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%)',
            animation: 'orbFloat2 22s ease-in-out infinite',
          }}
        />
        <div
          className="pointer-events-none absolute left-[5%] top-[20%] z-0 h-[500px] w-[500px] rounded-full blur-[80px]"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)',
            animation: 'orbFloat3 15s ease-in-out infinite',
          }}
        />
        <div
          className="pointer-events-none absolute bottom-[10%] right-[5%] z-0 h-[450px] w-[450px] rounded-full blur-[80px]"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%)',
            animation: 'orbFloat4 19s ease-in-out infinite',
          }}
        />

        {/* ── HERO STATE ── */}
        {!hasMsg && (
          <div className="relative z-[1] flex flex-1 items-center justify-center py-10">
            <div className="flex w-full max-w-[640px] flex-col items-center px-6 text-center">
              {/* Greeting badge */}
              <div className="home-content-item">
                <div className="mb-6 inline-flex items-center gap-[7px] rounded-full border border-black/[0.08] bg-white/80 px-3.5 py-[5px] shadow-[0_1px_3px_rgba(0,0,0,0.05)] backdrop-blur-[12px]">
                  <div
                    className="size-[7px] shrink-0 rounded-full bg-green-500"
                    style={{ animation: 'pulseGreen 2s ease-in-out infinite' }}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#555555]">
                    {greeting}
                  </span>
                </div>
              </div>

              {/* Headline */}
              <h1 className="home-content-item mb-3 text-[42px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#0F0F10]">
                Welcome back,{' '}
                <span className="inline-block bg-gradient-to-br from-[#8B5CF6] via-[#6366F1] to-[#3B82F6] bg-clip-text text-transparent">
                  {userName || 'there'}
                </span>
              </h1>

              {/* Subtitle */}
              <p className="home-content-item mb-8 max-w-[420px] text-[15px] leading-[1.6] text-gray-500">
                {contextLoaded
                  ? 'Ask anything about your store — revenue, refunds, orders, trends.'
                  : 'Connecting to your store data\u2026'}
              </p>

              {/* Search bar */}
              <div className="home-content-item w-full">
                <div className="relative mx-auto mb-5 w-[min(520px,90vw)]">
                  {/* Animated gradient border */}
                  <div
                    className="absolute -inset-[1.5px] z-0 rounded-[14px]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.5), rgba(99,102,241,0.3), rgba(96,165,250,0.4))',
                      animation: 'borderPulse 3.5s ease-in-out infinite',
                    }}
                  />
                  <div className="relative z-[1] flex items-center gap-2.5 rounded-xl bg-white/[0.92] p-[10px_12px] backdrop-blur-[20px]">
                    <Search className="size-4 shrink-0 text-[#BDBDBD]" strokeWidth={2} />
                    <input
                      ref={heroInputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKey}
                      placeholder={contextLoaded ? 'Ask anything about your store\u2026' : 'Connecting\u2026'}
                      disabled={!contextLoaded || isStreaming}
                      className="flex-1 border-none bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#BDBDBD]"
                    />
                    <button
                      onClick={() => handleSend(input)}
                      disabled={!input.trim() || isStreaming || !contextLoaded}
                      aria-label="Send"
                      className="flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#111111] transition-colors hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-[0.26]"
                    >
                      {isStreaming ? (
                        <div className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <ArrowUp className="size-4 text-white" strokeWidth={2.5} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Suggestion chips */}
              <div className="home-content-item flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((text) => (
                  <button
                    key={text}
                    onClick={() => handleSend(text)}
                    disabled={isStreaming || !contextLoaded}
                    className="rounded-full border border-black/[0.08] bg-white/80 px-3.5 py-[7px] text-xs font-medium text-[#555555] shadow-[0_1px_3px_rgba(0,0,0,0.05)] backdrop-blur-[10px] transition-all hover:translate-y-[-2px] hover:border-violet-500/20 hover:shadow-[0_4px_16px_rgba(139,92,246,0.12)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {text}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-4 text-center text-[11px] text-[#BDBDBD]">
                Lynq AI &middot; Answers based on live store data &middot; &#8629; Enter to send
              </div>
            </div>
          </div>
        )}

        {/* ── CONVERSATION STATE ── */}
        {hasMsg && (
          <div className="relative z-[1] flex flex-1 flex-col">
            {/* Messages area */}
            <div className="chat-scroll flex flex-1 flex-col items-center overflow-y-auto px-11 pb-4 pt-12">
              <div className="w-full max-w-[780px]">
                {messages.map((msg, i) => (
                  <ChatMessageBubble key={i} {...msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Bottom input */}
            <div className="flex justify-center bg-gradient-to-t from-[#F9F9FB] from-[52%] to-transparent px-11 pb-9 pt-4">
              <div className="w-full max-w-[780px]">
                <div className="chat-bottom">
                  <textarea
                    ref={bottomInputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Ask a follow-up\u2026"
                    disabled={isStreaming}
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = `${Math.min(target.scrollHeight, 180)}px`
                    }}
                  />
                  <button
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || isStreaming}
                    aria-label="Send"
                    className="flex size-[42px] shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-[#0F0F10] transition-colors hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-[0.26]"
                  >
                    {isStreaming ? (
                      <div className="size-[15px] animate-spin rounded-full border-2 border-white/[0.22] border-t-white" />
                    ) : (
                      <Send className="size-4 text-white" strokeWidth={2.3} />
                    )}
                  </button>
                </div>
                <div className="mt-2.5 text-center text-[11px] text-[#BDBDBD]">
                  Lynq AI &middot; Answers based on live store data &middot; &#8629; Enter to send
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
