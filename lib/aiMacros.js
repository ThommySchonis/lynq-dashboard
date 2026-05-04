/**
 * Helpers for the AI macro generator (Phase 2).
 *
 * - SYSTEM_PROMPT + buildUserMessage() build the Claude payload
 * - parseMacroJson() strips code fences and validates the response shape
 * - calculateCost() applies Sonnet 4 pricing ($3 / $15 per Mtok)
 */

export const SYSTEM_PROMPT = `You are an expert at creating customer service email templates for Shopify e-commerce stores. You create warm, on-brand, ready-to-send responses that customer service agents apply with one click.

Your output must be valid JSON only — no markdown code fences, no explanations, no preamble. Just the JSON object.`

export function buildUserMessage(answers) {
  const trackingLink = answers.tracking_link?.trim()
    ? answers.tracking_link.trim()
    : 'none — omit tracking URL references'
  const extraNotes = answers.extra_notes?.trim()
    ? answers.extra_notes.trim()
    : 'none'

  return `Generate exactly 50 customer service email macros for this store.

STORE DETAILS:
- Store name: ${answers.store_name ?? ''}
- Sells: ${answers.what_sells ?? ''}
- Brand voice: ${answers.brand_voice ?? ''}
- Support email: ${answers.support_email ?? ''}
- Email signature: ${answers.signature ?? ''}
- Tracking link: ${trackingLink}
- Return window: ${answers.return_days ?? 30} days
- Return shipping policy: ${answers.return_shipping ?? ''}
- Damage policy: ${answers.damage_policy ?? ''}
- Additional context: ${extraNotes}

REQUIREMENTS:
1. Generate exactly 50 macros across these categories:
   - TRK (Tracking): 6 macros — tracking provided, not moving, delayed, lost in transit, return to sender, delivered but not received
   - STS (Order Status): 4 macros — confirmed/processing, shipped, delivered, address issue
   - CNL (Cancellations): 3 macros — confirmed, not possible (already shipped), checking reason before cancelling
   - RTR (Returns/Refunds): 9 macros — return instructions, refund processed, partial refund offers at 10%, 20%, 30%, 40%, 50%, return outside window, size exchange option
   - DMG (Damages): 4 macros — damaged item photos requested, damaged item resolution, wrong item received, missing item
   - CHG (Order Changes): 3 macros — address updated, address change too late, general order updated
   - PROD (Product Questions): 5 macros — general question, sizing advice, materials/fabric, styling advice, out of stock
   - CC (Customer Care): 3 macros — action confirmed, happy customer follow-up, discount code provided
   - REV (Reviews): 3 macros — thank you for positive review, response to negative review, review invitation
   - PAY (Payments): 2 macros — double charge, payment failed
   - GI (General Info): 3 macros — about us, shipping & delivery info, return policy overview
   - FINAL (Closings): 2 macros — warm closing, welcome new customer
   Total: 50 macros

2. Naming convention: "{CATEGORY} - {Short descriptive name}"
   Example: "TRK - Tracking Number Provided"

3. Body format: Valid HTML using only <p>, <br>, <strong>, <em>, <ul>, <ol>, <li> tags. No inline styles. No <div>, no classes. Each paragraph wrapped in <p>. Empty lines between paragraphs as separate <p> elements (not <br><br>).

4. Variables to use inline (literal strings, not replaced yet):
   - {{ticket.customer.firstname}} — for personalization in greeting
   Use this in the opening line of every macro.

5. Placeholders for agent to fill manually (use square brackets):
   - [DATE] — for specific dates
   - [ORDER NUMBER] — for order references
   - [NEW ADDRESS] — for address updates
   - [ITEM NAME] — for product references
   - [SIZE] — for size references
   - [CODE] — for discount codes
   - [AMOUNT] — for refund amounts
   - [SUMMARY OF CHANGES] — for change summaries
   Use these naturally where the agent would need to add specifics.

6. Every macro MUST end with the exact signature provided in STORE DETAILS. Do not modify or rewrite it.

7. Brand voice consistency:
   - Warm & personal: friendly, uses "I" and "we", expresses care
   - Professional & efficient: direct, clear, polite, no fluff
   - Casual & friendly: conversational, contractions OK, light tone
   - Luxury & elegant: refined, sophisticated word choice, never overly casual
   - Playful & fun: warm but with personality, exclamations OK

8. Length: each macro 80-200 words (excluding HTML tags). Aim for 100-150 typical.

9. Tags: assign 2-4 lowercase tags per macro from this list:
   tracking, shipping, delivery, lost, delayed, status, cancellation, return, refund, partial-refund, exchange, damaged, wrong-item, missing-item, address, change, product, sizing, materials, styling, out-of-stock, follow-up, discount, review, positive, negative, payment, billing, info, welcome, closing
   Pick the most relevant 2-4 per macro.

10. Language: write all macros in English. The macros table allows other languages, but for Phase 2 we generate English only. Customer can translate later.

OUTPUT SHAPE:
{
  "macros": [
    { "name": "TRK - Tracking Number Provided", "body": "<p>Hi {{ticket.customer.firstname}},</p><p>...</p>", "tags": ["tracking", "shipping", "status"] },
    ... 49 more
  ]
}`
}

// Strip ```json fences if Claude wrapped despite instructions. Returns
// { macros, raw, parseError } where macros is null on failure.
export function parseMacroJson(text) {
  if (typeof text !== 'string') {
    return { macros: null, raw: text, parseError: 'response was not a string' }
  }

  let cleaned = text.trim()

  // Strip ```json ... ``` or ``` ... ``` wrappers if present
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenceMatch) cleaned = fenceMatch[1].trim()

  // If Claude prefixed something like "Here is the JSON:" then started the
  // object, try to extract from the first { to the last }
  if (!cleaned.startsWith('{')) {
    const first = cleaned.indexOf('{')
    const last  = cleaned.lastIndexOf('}')
    if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1)
  }

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    return { macros: null, raw: text, parseError: e.message }
  }

  if (!parsed || !Array.isArray(parsed.macros)) {
    return { macros: null, raw: text, parseError: 'response missing "macros" array' }
  }

  // Validate each macro has the minimum shape
  const valid = parsed.macros.filter(m =>
    m && typeof m.name === 'string' && m.name.trim() &&
         typeof m.body === 'string' &&
         (Array.isArray(m.tags) || m.tags === undefined)
  )

  return { macros: valid, raw: text, parseError: null }
}

// Sonnet 4 pricing: $3 / Mtok input, $15 / Mtok output.
export function calculateCost(usage) {
  const input  = usage?.input_tokens  ?? 0
  const output = usage?.output_tokens ?? 0
  return {
    input_tokens:        input,
    output_tokens:       output,
    estimated_cost_usd:  Number(((input * 3) / 1_000_000 + (output * 15) / 1_000_000).toFixed(4)),
  }
}

// Sleep helper for the retry-once pattern.
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
