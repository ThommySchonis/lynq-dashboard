// Canonical billing issuer — Lynq & Flow LLC, the US Wyoming entity
// that bills all customers. Used by invoice PDF rendering, "from"
// identity on billing emails, and any customer-facing financial copy.
//
// Single source of truth — never hardcode these values in templates.
// Change here and every invoice / email / receipt picks it up.
//
// Notes:
//   - Not registered for EU VAT (US entity). Invoices to EU B2B
//     customers use Article 196 reverse-charge — see invoiceFooter.
//   - All charges processed by Whop — the actual card statement
//     descriptor is "WHOP * LYNQ FLOW", not the LLC name. Reflected
//     in the billing UI under "Payment method".
//   - No bank details / IBAN / phone on customer-facing surfaces —
//     all payment flows go through Whop, no direct bank deposits.

export interface IssuerAddress {
  line1:      string
  line2:      string
  city:       string
  state:      string
  postalCode: string
  country:    string
}

export interface Issuer {
  legalName:        string
  entityType:       string
  ein:              string
  wyomingEntityId:  string
  address:          IssuerAddress
  contactEmail:     string
  website:          string
  vatRegistered:    boolean
  customerSegment:  string
  paymentProcessor: string
  invoiceFooter:    string
}

export const ISSUER: Issuer = {
  legalName:        'Lynq & Flow LLC',
  entityType:       'Wyoming Limited Liability Company',
  ein:              '98-1936010',
  wyomingEntityId:  '2026-001965184',
  address: {
    line1:      '312 W 2nd St',
    line2:      'Unit #A9659',
    city:       'Casper',
    state:      'WY',
    postalCode: '82601',
    country:    'US',
  },
  contactEmail:     'billing@lynqflow.co',
  website:          'https://lynqflow.co',
  vatRegistered:    false,
  customerSegment:  'B2B only — no consumer sales',
  paymentProcessor: 'Whop',
  invoiceFooter:    'VAT reverse charged under Article 196 VAT Directive 2006/112/EC for EU B2B customers. Customer is responsible for VAT in their jurisdiction. Lynq & Flow LLC is a US entity not registered for EU VAT.',
}

// EU member states (alpha-2) — drives invoice reverse-charge footer
// and billing-info VAT-number requirement.
export const EU_COUNTRIES: ReadonlySet<string> = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
  'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
])

export function isEUCountry(countryCode: string | null | undefined): boolean {
  return EU_COUNTRIES.has((countryCode || '').toUpperCase())
}

// Permissive EU VAT format check — 2 letter country code + 8-12
// alphanumerics. Per-country precision deferred to a VIES lookup
// integration later. Returns true for empty input — required-ness
// is enforced separately based on customer country.
export function isValidVATFormat(vatNumber: string | null | undefined): boolean {
  if (!vatNumber) return true
  return /^[A-Z]{2}[A-Z0-9]{8,12}$/.test(vatNumber.toUpperCase().replace(/\s/g, ''))
}
