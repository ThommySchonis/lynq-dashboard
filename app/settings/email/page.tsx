import { Clock } from 'lucide-react'

export default function EmailSettingsPage() {
  return (
    <div className="bg-secondary min-h-screen flex items-center justify-center px-8 py-12 antialiased">
      <div className="w-full max-w-[480px]">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-7 text-xs text-foreground-4">
          <span>Settings</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          <span className="text-muted-foreground">Email</span>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E5E0EB] rounded-xl px-10 py-12 text-center">
          <div className="mb-4 flex justify-center">
            <Clock size={32} strokeWidth={1.75} className="text-foreground-4" />
          </div>
          <h2 className="text-[22px] font-semibold text-foreground mb-2 leading-snug">
            Email Settings
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This page is being built. Check back soon.
          </p>
        </div>
      </div>
    </div>
  )
}
