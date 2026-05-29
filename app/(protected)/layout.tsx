import { AuthGuard } from '@/components/shared/auth-guard'
import { ServiceBanner } from '@/components/shared/service-banner'
import { ImpersonationBanner } from '@/components/shared/impersonation-banner'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ImpersonationBanner />
      <ServiceBanner />
      {children}
    </AuthGuard>
  )
}
