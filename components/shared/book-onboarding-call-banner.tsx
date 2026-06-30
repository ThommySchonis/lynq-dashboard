import { Button } from '@/components/ui/button'
import { CALENDLY_ONBOARDING_URL } from '@/lib/home-constants'

export function BookOnboardingCallBanner() {
  return (
    <div className="relative z-5 mx-6 mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] p-4 px-5 text-white shadow-[0_1px_2px_rgba(28,15,54,0.04)]">
      <div className="min-w-0 flex-[1_1_320px]">
        <div className="mb-1 text-sm font-semibold -tracking-[0.01em] text-white">
          Book your free onboarding call
        </div>
        <div className="text-[13px] leading-normal text-white/80">
          Get 30 minutes with our team to set up Lynq &amp; Flow the right way.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="bg-white text-[#6366F1] hover:bg-white/90"
          render={
            <a
              href={CALENDLY_ONBOARDING_URL}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          Schedule a time
        </Button>
      </div>
    </div>
  )
}

export default BookOnboardingCallBanner
