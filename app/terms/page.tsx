// app/terms/page.tsx
import { LegalPage } from '@/components/features/legal/legal-page'
import { termsDoc } from '@/lib/legal/terms-content'

export const metadata = {
  title: 'Terms of Service — Lynq',
  description:
    'Terms of service for Lynq & Flow, an AI-powered Shopify helpdesk and automation platform.',
}

export default function TermsPage() {
  return (
    <LegalPage
      doc={termsDoc}
      crossLink={{ href: '/privacy', label: 'Privacy Policy' }}
    />
  )
}
