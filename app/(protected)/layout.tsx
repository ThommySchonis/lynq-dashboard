import { AuthGuard } from '@/components/shared/auth-guard'
import { ServiceBanner } from '@/components/shared/service-banner'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ServiceBanner />
      {children}
    </AuthGuard>
  )
}
