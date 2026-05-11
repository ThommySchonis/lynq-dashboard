'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Sparkles, Loader2, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMacroOnboarding, useSaveMacroOnboarding, useGenerateMacros } from '@/hooks/settings'
import {
  WIZARD_STEPS,
  INITIAL_MACRO_WIZARD_FORM,
} from '@/lib/settings-constants'
import type { MacroWizardForm } from '@/lib/settings-constants'
import { WizardProgress } from './wizard-progress'
import { WizardStepBrand } from './wizard-step-brand'
import { WizardStepContact } from './wizard-step-contact'
import { WizardStepPolicies } from './wizard-step-policies'
import { WizardStepFinal } from './wizard-step-final'

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
    if (!Number.isFinite(days) || days < 1 || days > 365) e.return_days = '1\u2013365 days'
    if (!form.return_shipping) e.return_shipping = 'Pick one'
    if (!form.damage_policy) e.damage_policy = 'Pick one'
  }
  return e
}

export function MacroWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<MacroWizardForm>(INITIAL_MACRO_WIZARD_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [topError, setTopError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const { data: onboarding, isLoading } = useMacroOnboarding()
  const saveMutation = useSaveMacroOnboarding()
  const generateMutation = useGenerateMacros()

  // Prefill from existing onboarding data
  useEffect(() => {
    if (onboarding) {
      setForm((prev) => ({ ...prev, ...onboarding }))
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
    // Validate all steps defensively
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
      // Save onboarding answers first
      await saveMutation.mutateAsync(form as unknown as Parameters<typeof saveMutation.mutateAsync>[0])
    } catch (err) {
      setTopError(err instanceof Error ? err.message : "Couldn't save your answers. Try again.")
      return
    }

    // Start generating
    setGenerating(true)
    runGenerate()
  }

  async function runGenerate() {
    setTopError(null)
    setGenerating(true)

    try {
      const data = await generateMutation.mutateAsync({})
      // Land on macros list with success toast via sessionStorage
      try {
        sessionStorage.setItem('mp:lastToast', JSON.stringify({
          msg: `${data.count} macros created`,
          type: 'ok',
        }))
      } catch {
        // sessionStorage not available
      }
      router.push('/settings/workspace/macros')
    } catch (err) {
      setGenerating(false)
      setTopError(err instanceof Error ? err.message : 'Generation failed. Try again.')
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-[720px] mx-auto px-10 py-8 pb-12">
        <div className="flex items-center justify-center py-20 gap-2.5 text-muted-foreground text-sm">
          <Loader2 size={18} strokeWidth={1.75} className="animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  // Generating overlay
  if (generating) {
    return (
      <div className="max-w-[720px] mx-auto px-10 py-8 pb-12">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-(--accent)/15 flex items-center justify-center text-(--accent) mb-4">
            <Loader2 size={32} strokeWidth={1.75} className="animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1.5">Creating your macros...</h2>
          <p className="text-sm text-muted-foreground max-w-[380px] leading-relaxed">
            AI is reviewing your store details and crafting personalized responses.
            This takes about 30-60 seconds.
          </p>

          {topError && (
            <div className="flex items-start gap-2.5 p-3 px-4 bg-destructive/5 border border-destructive/20 rounded-[10px] mt-6 max-w-[420px] text-[13px] text-destructive">
              <AlertCircle size={16} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" />
              <span>{topError}</span>
            </div>
          )}

          {topError && (
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => { setGenerating(false); setTopError(null) }}
              >
                Edit answers
              </Button>
              <Button onClick={() => runGenerate()}>
                <Sparkles size={14} strokeWidth={1.75} />
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[720px] mx-auto px-10 py-8 pb-12">
      {/* Back link */}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 bg-transparent border-none text-muted-foreground text-[13px] cursor-pointer rounded-md transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => router.push('/settings/workspace/macros')}
      >
        <ArrowLeft size={14} strokeWidth={1.75} />
        Back to macros
      </button>

      <WizardProgress steps={WIZARD_STEPS} currentStep={step} />

      {/* Step title */}
      <h1 className="text-[22px] font-semibold text-foreground mb-1">
        {WIZARD_STEPS[step].title}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {WIZARD_STEPS[step].desc}
      </p>

      {/* Top error */}
      {topError && (
        <div className="flex items-start gap-2.5 p-3 px-4 bg-destructive/5 border border-destructive/20 rounded-[10px] mb-4 text-[13px] text-destructive">
          <AlertCircle size={16} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" />
          <span>{topError}</span>
        </div>
      )}

      {/* Step content */}
      {step === 0 && <WizardStepBrand form={form} onChange={handleChange} errors={errors} />}
      {step === 1 && <WizardStepContact form={form} onChange={handleChange} errors={errors} />}
      {step === 2 && <WizardStepPolicies form={form} onChange={handleChange} errors={errors} />}
      {step === 3 && <WizardStepFinal form={form} onChange={handleChange} errors={errors} />}

      {/* Actions */}
      <div className="flex justify-between gap-2 mt-8">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 0 || saveMutation.isPending}
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back
        </Button>

        {step < 3 ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight size={14} strokeWidth={1.75} />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Sparkles size={14} strokeWidth={1.75} />
                Generate macros
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
