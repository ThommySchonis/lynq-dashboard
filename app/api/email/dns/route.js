import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// GET /api/email/dns?domain=yourdomain.com&provider=google|microsoft|custom
// Returns the exact DNS records the customer needs to add for email deliverability
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain')?.toLowerCase().trim()
  const provider = searchParams.get('provider') || 'google'

  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

  const spfRecords = {
    google: `v=spf1 include:_spf.google.com ~all`,
    microsoft: `v=spf1 include:spf.protection.outlook.com ~all`,
    custom: `v=spf1 a mx ~all`,
  }

  const records = {
    spf: {
      type: 'TXT',
      name: '@',
      value: spfRecords[provider] || spfRecords.google,
      ttl: '3600',
      purpose: 'Prevents spammers from sending emails on behalf of your domain',
      required: true,
    },
    dmarc: {
      type: 'TXT',
      name: `_dmarc.${domain}`,
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; ruf=mailto:dmarc@${domain}; fo=1`,
      ttl: '3600',
      purpose: 'Tells receiving servers what to do with emails that fail SPF/DKIM checks',
      required: true,
    },
    mxVerification: provider === 'google' ? {
      type: 'TXT',
      name: '@',
      value: 'google-site-verification=REPLACE_WITH_YOUR_CODE',
      ttl: '3600',
      purpose: 'Verifies domain ownership with Google Workspace',
      required: false,
      note: 'Get your verification code from Google Workspace Admin → Domain setup',
    } : null,
  }

  const googleMxRecords = [
    { type: 'MX', name: '@', value: 'ASPMX.L.GOOGLE.COM', priority: 1, ttl: '3600' },
    { type: 'MX', name: '@', value: 'ALT1.ASPMX.L.GOOGLE.COM', priority: 5, ttl: '3600' },
    { type: 'MX', name: '@', value: 'ALT2.ASPMX.L.GOOGLE.COM', priority: 5, ttl: '3600' },
    { type: 'MX', name: '@', value: 'ALT3.ASPMX.L.GOOGLE.COM', priority: 10, ttl: '3600' },
    { type: 'MX', name: '@', value: 'ALT4.ASPMX.L.GOOGLE.COM', priority: 10, ttl: '3600' },
  ]

  const microsoftMxRecords = [
    { type: 'MX', name: '@', value: `${domain.replace(/\./g, '-')}.mail.protection.outlook.com`, priority: 0, ttl: '3600' },
  ]

  return NextResponse.json({
    domain,
    provider,
    records: {
      spf: records.spf,
      dmarc: records.dmarc,
      ...(records.mxVerification ? { mxVerification: records.mxVerification } : {}),
    },
    mxRecords: provider === 'google' ? googleMxRecords : microsoftMxRecords,
    dkimNote: provider === 'google'
      ? 'DKIM must be generated in Google Workspace Admin → Apps → Gmail → Authenticate email. Copy the TXT record and add it to your DNS as a TXT record named "google._domainkey".'
      : 'DKIM is automatically configured by Microsoft 365. No manual DNS record needed.',
    checklist: [
      { step: 1, label: 'Add SPF record', type: 'TXT', name: '@', done: false },
      { step: 2, label: 'Add DMARC record', type: 'TXT', name: `_dmarc.${domain}`, done: false },
      { step: 3, label: provider === 'google' ? 'Add DKIM from Google Workspace Admin' : 'DKIM auto-configured by Microsoft', type: 'TXT', name: provider === 'google' ? `google._domainkey.${domain}` : 'auto', done: false },
      { step: 4, label: 'Add MX records', type: 'MX', name: '@', done: false },
    ],
    propagationNote: 'DNS changes can take up to 24-48 hours to propagate worldwide. Use mxtoolbox.com to verify.',
  })
}
