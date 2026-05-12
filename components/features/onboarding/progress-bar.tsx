import { STEPS } from '@/lib/onboarding-constants'

interface ProgressBarProps {
  step: number
}

export function ProgressBar({ step }: ProgressBarProps) {
  return (
    <div className="flex items-center gap-0 mb-12">
      {STEPS.map((label, i) => {
        const num = i + 1
        const done = step > num
        const active = step === num
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-all duration-300',
                  done
                    ? 'bg-primary text-white border-none'
                    : active
                    ? 'bg-transparent border-2 border-primary text-primary'
                    : 'bg-transparent border-2 border-white/15 text-white/30',
                ].join(' ')}
              >
                {done ? '✓' : num}
              </div>
              <span
                className={[
                  'text-[11px] font-medium tracking-[0.03em] whitespace-nowrap',
                  active ? 'text-white' : 'text-white/30',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  'w-20 h-px mb-[18px] mx-2 transition-all duration-300',
                  step > num ? 'bg-primary' : 'bg-white/10',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
