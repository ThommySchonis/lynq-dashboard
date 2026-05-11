import type { ReactNode } from 'react'

export const metadata = {
  title: 'Privacy Policy — Lynq',
  description: 'Privacy policy and data protection details for Lynq.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#1C0F36] text-white px-6 py-[60px]">
      <div className="max-w-[720px] mx-auto">

        {/* Logo */}
        <div className="mb-12">
          <img src="/logo.png" alt="Lynq" className="h-7 brightness-0 invert" />
        </div>

        <h1 className="text-[32px] font-bold mb-2">Privacy Policy</h1>
        <p className="text-white/45 mb-12 text-sm">
          Last updated: April 2026
        </p>

        <Section title="1. Who we are">
          Lynq is a customer support and order management platform for Shopify merchants, operated by Lynq &amp; Flow
          (info@lynqagency.com). We help merchants manage customer emails, orders, and refunds from one dashboard.
        </Section>

        <Section title="2. What data we collect">
          When a merchant connects their Shopify store to Lynq, we access the following data on their behalf:
          <ul className="mt-3 pl-5 leading-[1.8] list-disc">
            <li>Customer names and email addresses</li>
            <li>Shipping and billing addresses</li>
            <li>Order history, refunds, and fulfillment status</li>
            <li>Product and inventory data</li>
            <li>Store analytics and reports</li>
          </ul>
          This data is accessed solely to provide the Lynq service to merchants and their support teams.
        </Section>

        <Section title="3. How we use data">
          We process personal data only for the following purposes:
          <ul className="mt-3 pl-5 leading-[1.8] list-disc">
            <li>Displaying customer information to support agents in the Lynq inbox</li>
            <li>Processing order actions (refunds, cancellations, address updates) on behalf of merchants</li>
            <li>Generating KPI reports and analytics for merchants</li>
          </ul>
          We do not sell, share, or use customer data for marketing or advertising purposes.
        </Section>

        <Section title="4. Data storage and security">
          <ul className="pl-5 leading-[1.8] list-disc">
            <li>All data is stored in Supabase, which encrypts data at rest and in transit</li>
            <li>Backups are encrypted and managed by Supabase infrastructure</li>
            <li>Access to customer data is restricted to authenticated merchant accounts</li>
            <li>Test and production environments use separate databases</li>
            <li>Access to personal data is logged at the infrastructure level via Supabase audit logging</li>
          </ul>
        </Section>

        <Section title="5. Data retention">
          We retain customer and order data for as long as a merchant maintains an active Lynq account.
          Upon account termination, merchants may request deletion of their data by contacting info@lynqagency.com.
          We will process deletion requests within 30 days.
        </Section>

        <Section title="6. Your rights">
          Merchants and their customers have the right to access, correct, or delete personal data we hold.
          To exercise these rights, contact us at info@lynqagency.com.
        </Section>

        <Section title="7. Security incident response policy">
          In the event of a data breach or security incident affecting merchant or customer data, Lynq will:
          <ul className="mt-3 pl-5 leading-[1.8] list-disc">
            <li>Identify and contain the incident as quickly as possible</li>
            <li>Notify affected merchants within 72 hours of discovery</li>
            <li>Provide a description of the nature of the breach and the data involved</li>
            <li>Communicate the steps taken to contain and remediate the incident</li>
            <li>Where required by law, notify relevant data protection authorities</li>
          </ul>
          To report a security concern, contact us immediately at info@lynqagency.com.
        </Section>

        <Section title="8. Contact">
          For any privacy-related questions or requests:
          <div className="mt-3">
            <strong>Lynq &amp; Flow</strong><br />
            info@lynqagency.com
          </div>
        </Section>

      </div>
    </div>
  )
}

interface SectionProps {
  title: string
  children: ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="mb-10">
      <h2 className="text-[18px] font-semibold mb-3 text-white">
        {title}
      </h2>
      <div className="text-[15px] leading-[1.7] text-white/65">
        {children}
      </div>
    </div>
  )
}
