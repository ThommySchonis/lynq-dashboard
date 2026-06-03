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

export const EU_COUNTRIES: ReadonlySet<string> = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
  'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
])

export function isEUCountry(countryCode: string | null | undefined): boolean {
  return EU_COUNTRIES.has((countryCode || '').toUpperCase())
}

export function isValidVATFormat(vatNumber: string | null | undefined): boolean {
  if (!vatNumber) return true
  return /^[A-Z]{2}[A-Z0-9]{8,12}$/.test(vatNumber.toUpperCase().replace(/\s/g, ''))
}
