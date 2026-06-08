// lib/ai/brand-context.ts
//
// Workspace-level brand context for AI routes that need light context
// (macros, analyze). The reply route uses the full buildEmmaSystemPrompt
// instead, with per-store ai_policies.
//
// This loader is workspace-scoped (limit 1) rather than store-scoped. A
// workspace with multiple stores having different brands gets one of them;
// the impact is marginal classification quality, not correctness. Any DB
// error returns null and routes proceed without context.

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { AiPolicies } from '@/lib/services/ai-onboarding'
import { logger } from '@/lib/logger'

export async function loadWorkspaceBrandContext(
  workspaceId: string,
): Promise<AiPolicies | null> {
  try {
    const { data } = await supabaseAdmin
      .from('ai_policies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .limit(1)
      .maybeSingle<AiPolicies>()
    return data ?? null
  } catch (err) {
    logger.error('[ai/brand-context]', 'load failed', err)
    return null
  }
}

/**
 * Compact one-block brand summary (~30–50 tokens). Empty string if no
 * useful fields are set — callers prepend unconditionally and the empty
 * string is a no-op.
 */
export function buildBrandContextLine(policies: AiPolicies | null): string {
  if (!policies) return ''
  const parts: string[] = []
  if (policies.brand_name)        parts.push(`Brand: ${policies.brand_name.trim()}`)
  if (policies.industry)          parts.push(`Industry: ${policies.industry.trim()}`)
  if (policies.product_categories?.length) {
    parts.push(`Products: ${policies.product_categories.slice(0, 5).join(', ')}`)
  }
  if (policies.languages?.length) parts.push(`Customer languages: ${policies.languages.join(', ')}`)
  return parts.length === 0 ? '' : `## Store context\n${parts.join(' · ')}`
}
