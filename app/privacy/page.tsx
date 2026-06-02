// app/privacy/page.tsx
import { LegalPage } from '@/components/features/legal/legal-page'
import { privacyDoc } from '@/lib/legal/privacy-content'

export const metadata = {
  title: 'Privacy Policy — Lynq',
  description:
    'Privacy policy and data protection details for Lynq & Flow.',
}

export default function PrivacyPage() {
  return (
    <LegalPage
      doc={privacyDoc}
      crossLink={{ href: '/terms', label: 'Terms of Service' }}
    />
  )
}
