export const metadata = {
  title: 'Privacy Policy — Lynq',
  description: 'Privacy policy and data protection details for Lynq.',
}

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#1C0F36',
      color: '#ffffff',
      fontFamily: "'Switzer', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '60px 24px',
    }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* Logo */}
        <div style={{ marginBottom: '48px' }}>
          <img src="/logo.png" alt="Lynq" style={{ height: '28px', filter: 'brightness(0) invert(1)' }} />
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Privacy Policy</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '48px', fontSize: '14px' }}>
          Last updated: April 2026
        </p>

        <Section title="1. Who we are">
          Lynq is a customer support and order management platform for Shopify merchants, operated by Lynq & Flow
          (info@lynqagency.com). We help merchants manage customer emails, orders, and refunds from one dashboard.
        </Section>

        <Section title="2. What data we collect">
          When a merchant connects their Shopify store to Lynq, we access the following data on their behalf:
          <ul style={{ marginTop: '12px', paddingLeft: '20px', lineHeight: '1.8' }}>
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
          <ul style={{ marginTop: '12px', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>Displaying customer information to support agents in the Lynq inbox</li>
            <li>Processing order actions (refunds, cancellations, address updates) on behalf of merchants</li>
            <li>Generating KPI reports and analytics for merchants</li>
          </ul>
          We do not sell, share, or use customer data for marketing or advertising purposes.
        </Section>

        <Section title="4. Data storage and security">
          <ul style={{ marginTop: '0', paddingLeft: '20px', lineHeight: '1.8' }}>
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
          <ul style={{ marginTop: '12px', paddingLeft: '20px', lineHeight: '1.8' }}>
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
          <div style={{ marginTop: '12px' }}>
            <strong>Lynq & Flow</strong><br />
            info@lynqagency.com
          </div>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <h2 style={{
        fontSize: '18px',
        fontWeight: '600',
        marginBottom: '12px',
        color: '#ffffff',
      }}>
        {title}
      </h2>
      <div style={{
        fontSize: '15px',
        lineHeight: '1.7',
        color: 'rgba(255,255,255,0.65)',
      }}>
        {children}
      </div>
    </div>
  )
}
