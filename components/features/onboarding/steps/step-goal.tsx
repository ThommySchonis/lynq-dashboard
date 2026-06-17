'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { WizardShell } from '../wizard-shell'
import { ProgressFooter } from '../progress-footer'
import { StepHeading } from '../step-heading'
import { SelectableCard } from '../selectable-card'
import { goalSchema, GOAL_OPTIONS } from '@/lib/onboarding-constants'
import type { GoalFormData } from '@/lib/onboarding-constants'

interface StepGoalProps {
  defaultValues: GoalFormData
  onNext: (values: GoalFormData) => void
}

export function StepGoal({ defaultValues, onNext }: StepGoalProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues,
    mode: 'onChange',
  })

  return (
    <WizardShell
      footer={
        <ProgressFooter
          stepIndex={0}
          onNext={() => void handleSubmit(onNext)()}
          nextLabel="Next"
          nextDisabled={!isValid}
        />
      }
    >
      <form className="flex flex-col gap-9" onSubmit={(e) => void handleSubmit(onNext)(e)}>
        <StepHeading
          title="Let's set up your workspace"
          description="Tell us a bit about your store to customize your experience."
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground-2">
            What is your name?
          </label>
          <p className="text-xs text-foreground-3">So we understand how to address you.</p>
          <Input id="name" {...register('name')} placeholder="Please write your name" className="h-11" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="brandName" className="text-sm font-medium text-foreground-2">
            What is the name of your brand?
          </label>
          <p className="text-xs text-foreground-3">
            Your clients will encounter this in conversations, emails, and your support center.
          </p>
          <Input
            id="brandName"
            {...register('brandName')}
            placeholder="Kindly provide your brand's name."
            className="h-11"
          />
          {errors.brandName && <p className="text-xs text-destructive">{errors.brandName.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground-2">What&apos;s your primary objective?</p>
          <p className="text-xs text-foreground-3">
            This assists us in establishing the appropriate elements first.
          </p>
          <Controller
            name="goal"
            control={control}
            render={({ field }) => (
              <div className="mt-1 flex gap-3">
                {GOAL_OPTIONS.map((option) => (
                  <SelectableCard
                    key={option.value}
                    icon={option.icon}
                    title={option.title}
                    description={option.description}
                    selected={field.value === option.value}
                    onSelect={() => field.onChange(option.value)}
                  />
                ))}
              </div>
            )}
          />
        </div>
      </form>
    </WizardShell>
  )
}
