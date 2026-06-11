import type { SourcePlatform } from '@/types/migrations'

export interface PlatformOption {
  value: SourcePlatform
  label: string
  enabled: boolean
}

export const PLATFORMS: PlatformOption[] = [
  { value: 'gorgias',    label: 'Gorgias',    enabled: true },
  { value: 'zendesk',    label: 'Zendesk',    enabled: true },
  { value: 'reamaze',    label: 'Re:amaze',   enabled: true },
  { value: 'commslayer', label: 'CommSlayer', enabled: true },
]

export interface PlatformConfig {
  label: string
  needsSubdomain: boolean
  subdomainHint?: string
  needsUsername: boolean
  apiKeyHint: string
}

export const PLATFORM_CONFIG: Record<SourcePlatform, PlatformConfig> = {
  gorgias: {
    label: 'Gorgias',
    needsSubdomain: true,
    subdomainHint: 'e.g. brand.gorgias.com',
    needsUsername: true,
    apiKeyHint: 'Generated in Settings → REST API.',
  },
  zendesk: {
    label: 'Zendesk',
    needsSubdomain: true,
    subdomainHint: 'e.g. brand (your *.zendesk.com subdomain)',
    needsUsername: true,
    apiKeyHint: 'Generated in Admin → API → Token Access.',
  },
  reamaze: {
    label: 'Re:amaze',
    needsSubdomain: true,
    subdomainHint: 'e.g. brand (your *.reamaze.io brand)',
    needsUsername: true,
    apiKeyHint: 'Generated in Settings → API Token.',
  },
  commslayer: {
    label: 'CommSlayer',
    needsSubdomain: false,
    needsUsername: false,
    apiKeyHint: 'Generated in Settings → Integrations → Create integration token. Use the full bearer token.',
  },
}
