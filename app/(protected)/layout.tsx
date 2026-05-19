import { AuthGuard } from '@/components/shared/auth-guard'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
