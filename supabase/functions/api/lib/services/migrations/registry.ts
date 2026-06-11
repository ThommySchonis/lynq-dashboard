// supabase/functions/api/lib/services/migrations/registry.ts

import type { SourceAdapter, SourcePlatform } from './types.ts'
import { gorgias }    from './adapters/gorgias.ts'
import { zendesk }    from './adapters/zendesk.ts'
import { reamaze }    from './adapters/reamaze.ts'
import { commslayer } from './adapters/commslayer.ts'

export const adapters: Partial<Record<SourcePlatform, SourceAdapter>> = {
  gorgias,
  zendesk,
  reamaze,
  commslayer,
}

export function getAdapter(platform: string): SourceAdapter {
  const a = adapters[platform as SourcePlatform]
  if (!a) throw new Error(`Unsupported migration source: ${platform}`)
  return a
}

export function listSupportedPlatforms(): SourcePlatform[] {
  return Object.keys(adapters) as SourcePlatform[]
}
