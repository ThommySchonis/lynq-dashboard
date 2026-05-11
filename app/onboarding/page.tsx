'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useSaveBrand, useConnectParcelPanel, useCompleteOnboarding } from '@/hooks/onboarding'
import type { User } from '@supabase/supabase-js'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldLabel } from '@/components/features/onboarding/field-label'
import { ConnectedBadge } from '@/components/features/onboarding/connected-badge'
import { ConnectCard } from '@/components/features/onboarding/connect-card'
import { ProgressBar } from '@/components/features/onboarding/progress-bar'
import { TONE_OPTIONS, LANGUAGE_OPTIONS } from '@/lib/onboarding-constants'
import type { Tone, Language } from '@/lib/onboarding-constants'

// ── Brand form schema ───────────────────────────────────────────────────────

const brandSchema = z.object({
  brandName: z.string().min(1, 'Brand name is required'),
  language: z.enum(['English', 'Dutch', 'French', 'German', 'Spanish']),
  tone: z.enum(['friendly', 'professional', 'luxury']),
})

type BrandFormValues = z.infer<typeof brandSchema>

// ── Skip text ───────────────────────────────────────────────────────────────

function SkipText() {
  return (
    <div className="text-center mt-2 text-[11px] text-white/25 cursor-pointer">
      Skip for now
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<User | null>(null)
  const [step, setStep] = useState(1)

  // Connections
  const [shopifyStore, setShopifyStore] = useState('')
  const [parcelPanelKey, setParcelPanelKey] = useState('')
  const [gmailConnected, setGmailConnected] = useState(false)
  const [shopifyConnected, setShopifyConnected] = useState(false)
  const [parcelConnected, setParcelConnected] = useState(false)

  const saveBrandMutation = useSaveBrand()
  const connectParcelPanelMutation = useConnectParcelPanel()
  const completeOnboardingMutation = useCompleteOnboarding()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      brandName: '',
      language: 'English',
      tone: 'professional',
    },
    mode: 'onChange',
  })

  // Session check + OAuth callback detection
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      setUser(session.user)

      // Detect OAuth callbacks via search params
      if (searchParams.get('shopify') === 'connected') {
        setShopifyConnected(true)
        setStep(3)
      }
      if (searchParams.get('gmail') === 'connected') {
        setGmailConnected(true)
        setStep(3)
      }
      const stepParam = searchParams.get('step')
      if (stepParam) {
        const parsed = parseInt(stepParam, 10)
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) {
          setStep(parsed)
        }
      }
    })
  }, [router, searchParams])

  async function onBrandSubmit(values: BrandFormValues) {
    await saveBrandMutation.mutateAsync({
      brandName: values.brandName,
      language: values.language as Language,
      tone: values.tone as Tone,
    })
    setStep(3)
  }

  async function handleConnectParcelPanel() {
    if (!parcelPanelKey) return
    await connectParcelPanelMutation.mutateAsync({ parcelpanel_api_key: parcelPanelKey })
    setParcelConnected(true)
  }

  async function handleConnectShopify() {
    if (!shopifyStore) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/auth/shopify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ shop: shopifyStore }),
    })
    const data = await res.json() as { url?: string }
    if (data.url) window.location.href = data.url
  }

  async function handleCompleteOnboarding() {
    if (!user) return
    await completeOnboardingMutation.mutateAsync(user.id)
    router.push('/inbox')
  }

  if (!user) return null

  const isSaving = saveBrandMutation.isPending
  const isConnectingParcel = connectParcelPanelMutation.isPending
  const isCompleting = completeOnboardingMutation.isPending

  return (
    <div className="min-h-screen bg-[#1C0F36] flex flex-col items-center px-6 py-10">
      {/* Top glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none bg-[radial-gradient(ellipse,rgba(161,117,252,0.07)_0%,transparent_70%)]" />

      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Lynq"
        className="h-7 brightness-0 invert mb-10"
      />

      <ProgressBar step={step} />

      {/* Card */}
      <div
        className={[
          'bg-[#241352] border border-white/[0.07] rounded-[20px] p-10 w-full relative',
          step === 3 ? 'max-w-[720px]' : 'max-w-[480px]',
        ].join(' ')}
      >
        {/* ── Step 1: Welcome ── */}
        {step === 1 && (
          <div className="text-center">
            <div className="text-[40px] mb-4">👋</div>
            <h1 className="text-[28px] font-bold mb-3">Welcome to Lynq</h1>
            <p className="text-white/50 text-[15px] mb-10 leading-relaxed">
              Let&apos;s get your dashboard ready in a few steps.<br />
              It only takes about 2 minutes.
            </p>
            <button
              onClick={() => setStep(2)}
              className="bg-[#A175FC] text-white rounded-[10px] px-10 py-3.5 text-[15px] font-semibold cursor-pointer"
            >
              Get Started →
            </button>
          </div>
        )}

        {/* ── Step 2: Brand Setup ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit(onBrandSubmit)}>
            <h2 className="text-[22px] font-bold mb-1.5">Brand Setup</h2>
            <p className="text-white/45 text-[13px] mb-8">
              This helps the AI write replies that match your brand voice.
            </p>

            {/* Brand name */}
            <div className="mb-5">
              <FieldLabel htmlFor="brandName">Brand name</FieldLabel>
              <Input
                id="brandName"
                {...register('brandName')}
                placeholder="e.g. Earthly Sheets"
                className="bg-[#1C0F36] border-white/10 text-white placeholder:text-white/30 focus-visible:border-[#A175FC]/60 h-auto py-2.5"
              />
              {errors.brandName && (
                <p className="text-red-400 text-[12px] mt-1">{errors.brandName.message}</p>
              )}
            </div>

            {/* Language */}
            <div className="mb-5">
              <FieldLabel>Customer language</FieldLabel>
              <Controller
                name="language"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full bg-[#1C0F36] border-white/10 text-white h-auto py-2.5 data-[size=default]:h-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Tone */}
            <div className="mb-8">
              <FieldLabel>Tone of voice</FieldLabel>
              <Controller
                name="tone"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-2.5 mt-2">
                    {TONE_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        onClick={() => field.onChange(opt.value)}
                        className={[
                          'px-4 py-3.5 rounded-[10px] border cursor-pointer transition-all duration-150',
                          field.value === opt.value
                            ? 'border-[#A175FC] bg-[rgba(161,117,252,0.08)]'
                            : 'border-white/[0.07] bg-transparent',
                        ].join(' ')}
                      >
                        <div className="font-medium mb-0.5">{opt.label}</div>
                        <div className="text-xs text-white/40">{opt.example}</div>
                      </div>
                    ))}
                  </div>
                )}
              />
            </div>

            <button
              type="submit"
              disabled={!isValid || isSaving}
              className={[
                'w-full py-[13px] rounded-[10px] text-sm font-semibold text-white transition-colors',
                !isValid || isSaving
                  ? 'bg-[rgba(161,117,252,0.3)] cursor-not-allowed'
                  : 'bg-[#A175FC] cursor-pointer',
              ].join(' ')}
            >
              {isSaving ? 'Saving...' : 'Save & Continue →'}
            </button>
          </form>
        )}

        {/* ── Step 3: Connect Tools ── */}
        {step === 3 && (
          <div>
            <h2 className="text-[22px] font-bold mb-1.5">Connect Your Tools</h2>
            <p className="text-white/45 text-[13px] mb-8">
              Connect your tools to unlock the full dashboard. You can skip and do this later in Settings.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {/* Gmail */}
              <ConnectCard
                icon="✉️"
                title="Gmail"
                description="Receive and reply to customer emails directly in your inbox."
                connected={gmailConnected}
              >
                {gmailConnected ? (
                  <ConnectedBadge />
                ) : (
                  <>
                    <button
                      onClick={() => { window.location.href = '/api/auth/gmail' }}
                      className="w-full py-[9px] bg-transparent border border-[rgba(161,117,252,0.4)] text-[#A175FC] rounded-lg text-[13px] font-medium cursor-pointer"
                    >
                      Connect Gmail
                    </button>
                    <SkipText />
                  </>
                )}
              </ConnectCard>

              {/* Shopify */}
              <ConnectCard
                icon="🛍️"
                title="Shopify"
                description="View orders, process refunds and manage customers without leaving Lynq."
                connected={shopifyConnected}
              >
                {shopifyConnected ? (
                  <ConnectedBadge />
                ) : (
                  <>
                    <Input
                      value={shopifyStore}
                      onChange={(e) => setShopifyStore(e.target.value)}
                      placeholder="yourstore"
                      className="bg-[#1C0F36] border-white/10 text-white placeholder:text-white/30 focus-visible:border-[#A175FC]/60 mb-2 h-auto py-2"
                    />
                    <div className="text-[11px] text-white/30 mb-2.5">
                      Only the store name — not the full URL
                    </div>
                    <button
                      onClick={handleConnectShopify}
                      disabled={!shopifyStore}
                      className={[
                        'w-full py-[9px] rounded-lg text-[13px] font-medium border transition-colors',
                        shopifyStore
                          ? 'bg-transparent border-[rgba(161,117,252,0.4)] text-[#A175FC] cursor-pointer'
                          : 'bg-transparent border-white/[0.08] text-white/20 cursor-not-allowed',
                      ].join(' ')}
                    >
                      Connect Shopify
                    </button>
                    <SkipText />
                  </>
                )}
              </ConnectCard>

              {/* ParcelPanel */}
              <ConnectCard
                icon="📦"
                title="ParcelPanel"
                description="Track shipments and get alerts for failed deliveries and pickup points."
                connected={parcelConnected}
              >
                {parcelConnected ? (
                  <ConnectedBadge />
                ) : (
                  <>
                    <Input
                      type="password"
                      value={parcelPanelKey}
                      onChange={(e) => setParcelPanelKey(e.target.value)}
                      placeholder="API Key"
                      className="bg-[#1C0F36] border-white/10 text-white placeholder:text-white/30 focus-visible:border-[#A175FC]/60 mb-2.5 h-auto py-2"
                    />
                    <button
                      onClick={handleConnectParcelPanel}
                      disabled={!parcelPanelKey || isConnectingParcel}
                      className={[
                        'w-full py-[9px] rounded-lg text-[13px] font-medium border transition-colors',
                        parcelPanelKey && !isConnectingParcel
                          ? 'bg-transparent border-[rgba(161,117,252,0.4)] text-[#A175FC] cursor-pointer'
                          : 'bg-transparent border-white/[0.08] text-white/20 cursor-not-allowed',
                      ].join(' ')}
                    >
                      {isConnectingParcel ? 'Connecting...' : 'Connect'}
                    </button>
                    <SkipText />
                  </>
                )}
              </ConnectCard>
            </div>

            <button
              onClick={() => setStep(4)}
              className="w-full py-[13px] bg-[#A175FC] text-white rounded-[10px] text-sm font-semibold cursor-pointer"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === 4 && (
          <div className="text-center">
            <div className="w-[72px] h-[72px] rounded-full bg-[rgba(161,117,252,0.15)] border-2 border-[#A175FC] flex items-center justify-center text-[32px] mx-auto mb-6">
              ✓
            </div>
            <h1 className="text-[26px] font-bold mb-3">You&apos;re all set!</h1>
            <p className="text-white/50 text-[15px] mb-10 leading-relaxed">
              Your dashboard is ready.<br />
              Start by checking your inbox.
            </p>
            <button
              onClick={handleCompleteOnboarding}
              disabled={isCompleting}
              className="w-full bg-[#A175FC] text-white rounded-[10px] px-10 py-3.5 text-[15px] font-semibold mb-4 cursor-pointer disabled:opacity-60"
            >
              {isCompleting ? 'Loading...' : 'Go to Inbox →'}
            </button>
            <button
              onClick={handleCompleteOnboarding}
              disabled={isCompleting}
              className="bg-transparent text-white/35 text-[13px] p-2 cursor-pointer disabled:opacity-60"
            >
              Complete settings later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
