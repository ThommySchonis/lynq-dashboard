import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getAiSettings, upsertPolicies, upsertScenario, type PoliciesPatch, type ScenarioPatch } from '@/lib/services/ai-config'
import { can } from '@/lib/permissions'
import { ok, fail } from '@/mcp/tools/inbox'
import type { McpToolContext } from '@/mcp/types'

const policiesShape = {
  brand_name: z.string().nullable().optional(),
  brand_description: z.string().nullable().optional(),
  tone_of_voice: z.string().nullable().optional(),
  sign_off: z.string().nullable().optional(),
  languages: z.array(z.string()).nullable().optional(),
  website_url: z.string().nullable().optional(),
  shipping_policy: z.string().nullable().optional(),
  refund_policy: z.string().nullable().optional(),
  cancellation_policy: z.string().nullable().optional(),
  customs_policy: z.string().nullable().optional(),
  can_decide: z.array(z.string()).nullable().optional(),
  cannot_decide: z.array(z.string()).nullable().optional(),
  escalate_triggers: z.array(z.string()).nullable().optional(),
  tracking_url: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  product_categories: z.array(z.string()).nullable().optional(),
  formality_level: z.enum(['casual', 'balanced', 'formal']).nullable().optional(),
  communication_style: z.array(z.string()).nullable().optional(),
  personality_preferences: z.string().nullable().optional(),
}

export function registerEmmaTools(server: McpServer, ctx: McpToolContext): void {
  server.registerTool(
    'get_ai_settings',
    {
      description:
        'Read the workspace Emma AI configuration for a store: brand identity, tone, policies, scenarios, lessons, examples, and the assembled system prompt. Use this to write on-brand replies and to see what is configured before editing.',
      inputSchema: z.object({ storeId: z.string().optional() }),
    },
    async (args: { storeId?: string }) => {
      try {
        return ok(await getAiSettings(ctx.workspaceId, args.storeId))
      } catch (e) {
        return fail(`get_ai_settings failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }
  )

  server.registerTool(
    'update_policies',
    {
      description:
        'Update Emma brand/policy settings for a store (partial — only the fields you pass change). Affects how the AI replies workspace-wide.',
      inputSchema: z.object({ storeId: z.string().optional(), ...policiesShape }),
    },
    async (args: { storeId?: string } & PoliciesPatch) => {
      if (!can.manageWorkspace(ctx.role)) return fail('Your role cannot edit Emma settings (owner/admin only).')
      const { storeId, ...patch } = args
      if (Object.keys(patch).length === 0) return fail('Provide at least one policy field to update.')
      try {
        await upsertPolicies(ctx.workspaceId, storeId, patch)
        return ok({ updated: true })
      } catch (e) {
        return fail(`update_policies failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }
  )

  server.registerTool(
    'update_scenario',
    {
      description:
        'Update one Emma scenario (e.g. refund, shipping) for a store: approach, questions to ask, response template, escalation, autonomy, enabled.',
      inputSchema: z.object({
        storeId: z.string().optional(),
        scenario_key: z.string(),
        title: z.string().nullable().optional(),
        approach: z.string().nullable().optional(),
        questions_to_ask: z.array(z.string()).nullable().optional(),
        response_template: z.string().nullable().optional(),
        escalate_when: z.string().nullable().optional(),
        autonomy_pct: z.number().int().min(0).max(100).nullable().optional(),
        enabled: z.boolean().nullable().optional(),
      }),
    },
    async (args: { storeId?: string; scenario_key: string } & ScenarioPatch) => {
      if (!can.manageWorkspace(ctx.role)) return fail('Your role cannot edit Emma settings (owner/admin only).')
      const { storeId, scenario_key, ...patch } = args
      if (Object.keys(patch).length === 0) return fail('Provide at least one scenario field to update.')
      try {
        await upsertScenario(ctx.workspaceId, storeId, scenario_key, patch)
        return ok({ updated: true })
      } catch (e) {
        return fail(`update_scenario failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }
  )
}
