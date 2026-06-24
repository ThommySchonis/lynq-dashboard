'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { ChevronLeft, ArrowRight, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { useMacroOnboarding, useSaveMacroOnboarding, useGenerateMacros } from '@/hooks/settings'
import { WIZARD_STEPS, INITIAL_MACRO_WIZARD_FORM } from '@/lib/settings-constants'
import type { MacroWizardForm } from '@/lib/settings-constants'
import { WizardProgress } from './wizard-progress'
import { WizardStepBrand } from './wizard-step-brand'
import { WizardStepContact } from './wizard-step-contact'
import { WizardStepPolicies } from './wizard-step-policies'
import { WizardStepFinal } from './wizard-step-final'

const MACROS_HREF = '/settings/workspace/macros'
const CARD_CLASS =
  'rounded-2xl border border-border bg-card shadow-[0_4px_14px_-4px_rgba(15,13,31,0.05)]'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validateStep(step: number, form: MacroWizardForm): Record<string, string> {
  const e: Record<string, string> = {}
  if (step === 0) {
    if (!form.store_name.trim()) e.store_name = 'Required'
    if (!form.what_sells.trim()) e.what_sells = 'Required'
    if (!form.brand_voice) e.brand_voice = 'Pick one'
  } else if (step === 1) {
    if (!form.support_email.trim()) e.support_email = 'Required'
    else if (!EMAIL_RE.test(form.support_email.trim())) e.support_email = 'Invalid email'
    if (!form.signature.trim()) e.signature = 'Required'
  } else if (step === 2) {
    const days = Number(form.return_days)
    if (!Number.isFinite(days) || days < 1 || days > 365) e.return_days = '1–365 days'
    if (!form.return_shipping) e.return_shipping = 'Pick one'
    if (!form.damage_policy) e.damage_policy = 'Pick one'
  }
  return e
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
      <AlertCircle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[860px] px-6 py-8">{children}</div>
}

export function MacroWizard() {
  const router = useRouter()
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<MacroWizardForm>(INITIAL_MACRO_WIZARD_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [topError, setTopError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const { data: onboarding, isLoading } = useMacroOnboarding()
  const saveMutation = useSaveMacroOnboarding()
  const generateMutation = useGenerateMacros()

  const breadcrumb = useMemo(
    () => ['Settings', 'Macros', 'Generate from your store', WIZARD_STEPS[step].title],
    [step],
  )

  // Prefill from existing onboarding data
  useEffect(() => {
    if (onboarding) {
      setForm((prev) => ({ ...prev, ...onboarding })) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [onboarding])

  const handleChange = useCallback((field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (prev[field]) {
        const next = { ...prev }
        delete next[field]
        return next
      }
      return prev
    })
  }, [])

  function handleNext() {
    const stepErrors = validateStep(step, form)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length === 0) {
      setStep((s) => Math.min(3, s + 1))
    }
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1))
    setTopError(null)
  }

  async function handleSubmit() {
    for (let s = 0; s <= 3; s++) {
      const stepErrors = validateStep(s, form)
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors)
        setStep(s)
        return
      }
    }
    setTopError(null)
    try {
      await saveMutation.mutateAsync(form as unknown as Parameters<typeof saveMutation.mutateAsync>[0])
    } catch (err) {
      setTopError(err instanceof Error ? err.message : "Couldn't save your answers. Try again.")
      return
    }
    setGenerating(true)
    void runGenerate()
  }

  async function runGenerate() {
    setTopError(null)
    setGenerating(true)
    try {
      const data = await generateMutation.mutateAsync({})
      try {
        sessionStorage.setItem(
          'mp:lastToast',
          JSON.stringify({ msg: `${data.count} macros created`, type: 'ok' }),
        )
      } catch {
        // sessionStorage not available
      }
      router.push(MACROS_HREF)
    } catch (err) {
      setGenerating(false)
      setTopError(err instanceof Error ? err.message : 'Generation failed. Try again.')
    }
  }

  const header = (
    <SettingsPageHeader
      title="Generate macros from your store"
      backHref={MACROS_HREF}
      breadcrumb={breadcrumb}
    />
  )

  // ── Initial onboarding load ──
  if (isLoading) {
    return (
      <>
        {header}
        <Shell>
          <div className={`flex items-center justify-center gap-2.5 py-20 text-sm text-muted-foreground ${CARD_CLASS}`}>
            <Loader2 size={18} strokeWidth={1.75} className="animate-spin" />
            Loading…
          </div>
        </Shell>
      </>
    )
  }

  // ── Generating ──
  if (generating) {
    return (
      <>
        {header}
        <Shell>
          <div className={`flex flex-col items-center gap-5 px-8 py-14 text-center ${CARD_CLASS}`}>
            <Loader2 size={36} strokeWidth={1.75} className="animate-spin text-primary" />
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-foreground">Creating your Macros</h2>
              <p className="max-w-[420px] text-sm leading-relaxed text-muted-foreground">
                AI is reviewing your store details and crafting personalized responses. This takes about
                30–60 seconds.
              </p>
            </div>
            {topError && (
              <div className="flex flex-col items-center gap-4">
                <ErrorBanner message={topError} />
                <div className="flex gap-2.5">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setGenerating(false)
                      setTopError(null)
                    }}
                  >
                    Edit answers
                  </Button>
                  <Button onClick={() => void runGenerate()}>
                    <Sparkles size={14} strokeWidth={1.75} />
                    Try again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Shell>
      </>
    )
  }

  // ── Wizard step ──
  return (
    <>
      {header}
      <Shell>
        <div className={`flex flex-col gap-6 px-[34px] pb-7 pt-[30px] ${CARD_CLASS}`}>
          <WizardProgress steps={WIZARD_STEPS} currentStep={step} />

          <div className="flex flex-col gap-[5px]">
            <h2 className="text-[22px] font-bold leading-tight text-foreground">
              {WIZARD_STEPS[step].title}
            </h2>
            <p className="text-sm text-muted-foreground">{WIZARD_STEPS[step].desc}</p>
          </div>

          {topError && <ErrorBanner message={topError} />}

          {step === 0 && <WizardStepBrand form={form} onChange={handleChange} errors={errors} />}
          {step === 1 && <WizardStepContact form={form} onChange={handleChange} errors={errors} />}
          {step === 2 && <WizardStepPolicies form={form} onChange={handleChange} errors={errors} />}
          {step === 3 && <WizardStepFinal form={form} onChange={handleChange} />}

          <div className="border-t border-border" />

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 0 || saveMutation.isPending}
              className="h-11 rounded-[11px] px-5"
            >
              <ChevronLeft size={16} strokeWidth={2} />
              Previous
            </Button>

            {step < 3 ? (
              <Button onClick={handleNext} className="h-11 rounded-[10px] px-5">
                Next
                <ArrowRight size={16} strokeWidth={2} />
              </Button>
            ) : (
              <Button
                onClick={() => void handleSubmit()}
                disabled={isSuspended || saveMutation.isPending}
                className="h-11 rounded-[10px] px-5"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} strokeWidth={1.75} />
                    Generate macros
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Shell>
    </>
  )
}
