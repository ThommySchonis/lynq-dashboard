// lib/ai/model.ts
//
// Provider/model factory for AI routes. Reads AI_PROVIDER + AI_MODEL env vars
// and returns a Vercel AI SDK LanguageModel. Defaults preserve today's
// behavior (Anthropic + Haiku 4.5) so an unconfigured deploy keeps working.

import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { groq } from '@ai-sdk/groq'
import type { LanguageModel } from 'ai'

export type AiProvider = 'anthropic' | 'openai' | 'groq'

const DEFAULT_PROVIDER: AiProvider = 'anthropic'
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

function readProvider(): AiProvider {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase()
  if (raw === 'anthropic' || raw === 'openai' || raw === 'groq') return raw
  return DEFAULT_PROVIDER
}

export function getAiProvider(): AiProvider {
  return readProvider()
}

export function getAiModelId(): string {
  return process.env.AI_MODEL?.trim() || DEFAULT_MODEL
}

export function getAiModel(): LanguageModel {
  const modelId = getAiModelId()
  switch (readProvider()) {
    case 'anthropic': return anthropic(modelId)
    case 'openai':    return openai(modelId)
    case 'groq':      return groq(modelId)
  }
}

/**
 * Returns Anthropic prompt-cache marker options when the current provider is
 * Anthropic; empty object otherwise. Routes attach this to their system
 * message via `providerOptions` to opt into prompt caching. Only useful for
 * routes with large, stable system prompts (currently only /api/ai/reply —
 * other routes' system prompts are below Anthropic's 1024-token minimum).
 */
export function getCachableSystemOptions(): Record<string, unknown> {
  if (readProvider() !== 'anthropic') return {}
  return { anthropic: { cacheControl: { type: 'ephemeral' } } }
}
