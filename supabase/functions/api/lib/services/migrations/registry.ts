// supabase/functions/api/lib/services/migrations/registry.ts

import type { SourceAdapter, SourcePlatform } from './types.ts'
import { gorgias } from './adapters/gorgias.ts'
import { zendesk } from './adapters/zendesk.ts'

export const adapters: Partial<Record<SourcePlatform, SourceAdapter>> = {
  gorgias,
  zendesk,
}

export function getAdapter(platform: string): SourceAdapter {
  const a = adapters[platform as SourcePlatform]
  if (!a) throw new Error(`Unsupported migration source: ${platform}`)
  return a
}

export function listSupportedPlatforms(): SourcePlatform[] {
  return Object.keys(adapters) as SourcePlatform[]
}
