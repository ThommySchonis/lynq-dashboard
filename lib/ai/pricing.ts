// lib/ai/pricing.ts
//
// Per-model pricing for ai_usage.cost_usd calculations. Supports Anthropic
// prompt-caching rates (cacheWrite/cacheRead). For non-Anthropic providers,
// only inputPerToken/outputPerToken are used.
//
// Prices are USD per 1 token. Update when providers change rates.
// Sources: anthropic.com/pricing, openai.com/pricing, groq.com/pricing

interface ModelPrice {
  inputPerToken:        number              // standard, uncached input
  outputPerToken:       number
  cacheWritePerToken?:  number              // Anthropic: 1.25x input
  cacheReadPerToken?:   number              // Anthropic: 0.10x input
}

const MODEL_PRICES: Record<string, ModelPrice> = {
  // Anthropic — with prompt-caching rates
  'claude-haiku-4-5-20251001': {
    inputPerToken: 0.0000008, outputPerToken: 0.000004,
    cacheWritePerToken: 0.000001, cacheReadPerToken: 0.00000008,
  },
  'claude-sonnet-4-6': {
    inputPerToken: 0.000003, outputPerToken: 0.000015,
    cacheWritePerToken: 0.00000375, cacheReadPerToken: 0.0000003,
  },
  'claude-opus-4-7': {
    inputPerToken: 0.000015, outputPerToken: 0.000075,
    cacheWritePerToken: 0.00001875, cacheReadPerToken: 0.0000015,
  },
  // OpenAI
  'gpt-4o-mini': { inputPerToken: 0.00000015, outputPerToken: 0.0000006 },
  'gpt-4o':      { inputPerToken: 0.0000025,  outputPerToken: 0.00001  },
  // Groq
  'llama-3.3-70b-versatile': { inputPerToken: 0.00000059, outputPerToken: 0.00000079 },
  'llama-3.1-8b-instant':    { inputPerToken: 0.00000005, outputPerToken: 0.00000008 },
}

export interface AiUsage {
  inputTokens?:               number   // total input (Anthropic: includes cache reads + writes)
  outputTokens?:              number
  cacheReadInputTokens?:      number   // Anthropic only
  cacheCreationInputTokens?:  number   // Anthropic only
}

/**
 * Returns USD cost, or null when the model is not in the price table (e.g.
 * testing a new model id). Callers store null into ai_usage.cost_usd and rely
 * on token counts for comparison.
 */
export function computeCost(modelId: string, usage: AiUsage): number | null {
  const p = MODEL_PRICES[modelId]
  if (!p) return null
  const cacheRead  = usage.cacheReadInputTokens     ?? 0
  const cacheWrite = usage.cacheCreationInputTokens ?? 0
  const totalIn    = usage.inputTokens              ?? 0
  const stdInput   = Math.max(0, totalIn - cacheRead - cacheWrite)
  const output     = usage.outputTokens             ?? 0
  return (
    stdInput   * p.inputPerToken +
    cacheRead  * (p.cacheReadPerToken  ?? p.inputPerToken) +
    cacheWrite * (p.cacheWritePerToken ?? p.inputPerToken) +
    output     * p.outputPerToken
  )
}
