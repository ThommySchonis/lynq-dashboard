// lib/legal/privacy-content.tsx
import type { LegalDoc } from './types'

const SUPPORT_EMAIL = (
  <a
    href="mailto:info@lynqagency.com"
    className="text-[var(--primary)] hover:underline"
  >
    info@lynqagency.com
  </a>
)

export const privacyDoc: LegalDoc = {
  title: 'Privacy Policy',
  lastUpdated: 'June 1, 2026',
  intro: (
    <>
      <p>
        This Privacy Policy explains how Lynq &amp; Flow LLC, a limited liability
        company formed under the laws of the State of Wyoming, United States of
        America (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), collects, uses, discloses,
        and protects personal data when providing the Lynq &amp; Flow Shopify
        application, related integrations, websites, dashboards, and support
        services (collectively, the &ldquo;Service&rdquo;).
      </p>
      <p>This Privacy Policy applies to:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>merchants and authorised users who install or use the Service;</li>
        <li>visitors to our website or communication channels;</li>
        <li>end customers of merchants, where their data is processed through the Service on behalf of merchants.</li>
      </ul>
      <p>
        We process personal data in accordance with the General Data Protection
        Regulation (EU) 2016/679 (&ldquo;GDPR&rdquo;) and other applicable data protection
        laws.
      </p>
    </>
  ),
  sections: [
    {
      id: 'data-controller-and-contact-details',
      number: '1',
      title: 'Data Controller and Contact Details',
      body: (
        <>
          <p><strong className="text-[var(--foreground)]">Data Controller:</strong></p>
          <p>
            Lynq &amp; Flow LLC<br />
            Registered Agent: Registered Agents Inc<br />
            30 N Gould St Ste R<br />
            Sheridan, WY 82801<br />
            Wyoming, USA
          </p>
          <p>Support Email: {SUPPORT_EMAIL}</p>
          <p>Data Protection Contact: Company administrative contact</p>
          <p>
            We act as a data controller when we determine the purposes and means
            of processing personal data (e.g. account management, billing,
            analytics, support, and marketing).
          </p>
          <p>
            We act as a data processor when processing Shopify merchant or
            end-customer data on behalf of our customers under a Data Processing
            Agreement (&ldquo;DPA&rdquo;).
          </p>
        </>
      ),
    },
    {
      id: 'categories-of-personal-data',
      number: '2',
      title: 'Categories of Personal Data We Process',
      body: (
        <>
          <p>We may process the following categories of personal data:</p>
          <dl className="space-y-3">
            <div>
              <dt className="font-medium text-[var(--foreground)]">Account Data</dt>
              <dd>Name, email address, company name, user role, login credentials, and authentication data.</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--foreground)]">Billing Data</dt>
              <dd>Billing history, transaction identifiers, subscription plan details, and limited payment metadata (processed via Shopify or payment providers).</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--foreground)]">Shopify Store Data (Processor Context)</dt>
              <dd>Customer names, email addresses, order details, shipping information, and communication history processed strictly on behalf of merchants.</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--foreground)]">Usage Data</dt>
              <dd>Feature usage, logs, workflow activity, timestamps, system interactions, and performance diagnostics.</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--foreground)]">Support Data</dt>
              <dd>Messages, attachments, and communication history from support requests.</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--foreground)]">Technical Data</dt>
              <dd>IP address, browser type, device information, operating system, and cookies.</dd>
            </div>
          </dl>
          <p>We do not intentionally collect or process special categories of personal data (sensitive data).</p>
        </>
      ),
    },
    {
      id: 'purposes-and-legal-bases',
      number: '3',
      title: 'Purposes and Legal Bases of Processing',
      body: (
        <>
          <p>We process personal data for the following purposes:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Service provision and account management (Art. 6(1)(b) GDPR)</li>
            <li>Billing and compliance (Art. 6(1)(b), 6(1)(c) GDPR)</li>
            <li>Service security and fraud prevention (Art. 6(1)(f) GDPR)</li>
            <li>Product improvement and analytics (Art. 6(1)(f) GDPR)</li>
            <li>Customer support (Art. 6(1)(b), 6(1)(f) GDPR)</li>
            <li>Marketing communications (Art. 6(1)(a), 6(1)(f) GDPR)</li>
            <li>Legal obligations and dispute handling (Art. 6(1)(c), 6(1)(f) GDPR)</li>
            <li>Processing on behalf of merchants (Shopify data) (Art. 6(1)(b) GDPR)</li>
          </ul>
          <p>
            We rely on legitimate interest where necessary to operate, secure,
            and improve the Service, including preventing abuse and ensuring
            system stability.
          </p>
        </>
      ),
    },
    {
      id: 'data-retention',
      number: '4',
      title: 'Data Retention',
      body: (
        <>
          <p>We retain personal data only as long as necessary:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Account data: duration of relationship + up to 6 years</li>
            <li>Billing data: according to legal accounting requirements</li>
            <li>Logs and usage data: up to 12 months</li>
            <li>Support data: up to 24 months</li>
            <li>Marketing data: until consent is withdrawn</li>
            <li>Shopify merchant and end-customer data: according to merchant instructions and DPA terms</li>
          </ul>
          <p>After expiry, data is securely deleted or anonymised unless required by law.</p>
        </>
      ),
    },
    {
      id: 'data-sharing-and-recipients',
      number: '5',
      title: 'Data Sharing and Recipients',
      body: (
        <>
          <p>We may share data with:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>hosting and infrastructure providers</li>
            <li>Shopify and integration partners</li>
            <li>payment processors</li>
            <li>analytics providers</li>
            <li>professional advisers (legal, accounting, audit)</li>
            <li>public authorities where legally required</li>
          </ul>
          <p>All third parties are bound by confidentiality and data protection obligations.</p>
        </>
      ),
    },
    {
      id: 'international-transfers',
      number: '6',
      title: 'International Transfers',
      body: (
        <>
          <p>
            Personal data is primarily processed within the United States and
            other jurisdictions where our service providers operate.
          </p>
          <p>
            Where personal data is transferred from the European Economic Area
            (EEA) to countries not deemed to provide an adequate level of
            protection, we ensure appropriate safeguards such as:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Standard Contractual Clauses (SCCs)</li>
            <li>other lawful transfer mechanisms under GDPR</li>
          </ul>
          <p>Copies of safeguards can be provided upon request.</p>
        </>
      ),
    },
    {
      id: 'data-subject-rights',
      number: '7',
      title: 'Data Subject Rights',
      body: (
        <>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>access your personal data</li>
            <li>correct inaccurate data</li>
            <li>request deletion</li>
            <li>restrict processing</li>
            <li>data portability</li>
            <li>object to processing</li>
            <li>withdraw consent</li>
          </ul>
          <p>Requests can be submitted to: {SUPPORT_EMAIL}</p>
          <p>We may require identity verification and respond within statutory timeframes.</p>
          <p>For Shopify end-customer data, requests should be directed to the relevant merchant.</p>
        </>
      ),
    },
    {
      id: 'security',
      number: '8',
      title: 'Security',
      body: (
        <>
          <p>We implement appropriate technical and organisational measures including:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>encryption in transit and at rest</li>
            <li>access control mechanisms</li>
            <li>monitoring and logging</li>
            <li>regular security testing</li>
            <li>restricted employee access</li>
          </ul>
          <p>Security measures are continuously updated to ensure compliance with GDPR Article 32.</p>
        </>
      ),
    },
    {
      id: 'ai-and-automated-processing',
      number: '9',
      title: 'AI and Automated Processing',
      body: (
        <>
          <p>The Service includes AI-assisted features that help automate workflows and communication.</p>
          <p>Key points:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>AI outputs are assistive and require human oversight</li>
            <li>no fully autonomous decisions with legal effects are made without human review</li>
            <li>input data is processed via secure APIs</li>
            <li>you must not include sensitive personal data in AI inputs</li>
          </ul>
          <p>
            Where data is processed by third-party AI providers, it is used
            solely for generating outputs and is not used for training models.
          </p>
        </>
      ),
    },
    {
      id: 'cookies-and-tracking-technologies',
      number: '10',
      title: 'Cookies and Tracking Technologies',
      body: (
        <>
          <p>We use cookies for:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>essential functionality</li>
            <li>authentication and session management</li>
            <li>analytics and performance monitoring</li>
          </ul>
          <p>Non-essential cookies are used only with consent where required.</p>
          <p>You may control cookies through browser settings.</p>
        </>
      ),
    },
    {
      id: 'changes-to-this-privacy-policy',
      number: '11',
      title: 'Changes to This Privacy Policy',
      body: (
        <>
          <p>We may update this Privacy Policy from time to time.</p>
          <p>Material changes will be communicated via:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>the Service interface, or</li>
            <li>email notification</li>
          </ul>
          <p>Continued use of the Service constitutes acceptance of updates.</p>
        </>
      ),
    },
    {
      id: 'contact-and-complaints',
      number: '12',
      title: 'Contact and Complaints',
      body: (
        <>
          <p>If you have questions about this Privacy Policy or your data, contact:</p>
          <p>{SUPPORT_EMAIL}</p>
          <p>You also have the right to lodge a complaint with your local data protection authority.</p>
        </>
      ),
    },
  ],
}
