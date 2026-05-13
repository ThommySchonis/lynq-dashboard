// HTTP-header / env-var ASCII sanitization helpers.
//
// HTTP header values must be ByteString (each char ≤ 0xFF). Smart-quote
// chars (U+2018/U+2019/U+201C/U+201D) and other Unicode lookalikes
// routinely slip into env vars pasted from docs / Notion / Slack and
// cause fetch() to throw "Cannot convert argument to a ByteString".
//
// `asciiSafe()` normalizes common Unicode lookalikes to their ASCII
// equivalents and strips everything else. Apply defensively to any
// header value built from a dynamic source (env vars, user input,
// generated keys).
//
// `diagnoseEnvVar()` is a one-shot debug logger for env vars suspected
// of containing non-ASCII bytes. Logs first 5 + last 5 chars (never
// the full value) plus indices + Unicode code points of any offenders.
// Marked at call-sites with TEMP comments for follow-up removal.

import * as Sentry from '@sentry/nextjs'

/**
 * Sanitize a value for use as an HTTP header. Converts common smart
 * quotes / dashes / nbsp to ASCII equivalents, then strips any
 * remaining non-printable / non-ASCII bytes.
 *
 * When sanitization actually changed the input (input !== output), we
 * log to Sentry with the scope + label + offender indices/codepoints
 * so production tells us about silently-cleaned data. The original
 * value is NEVER logged (callers pass secrets like API keys / JWTs).
 *
 * @param value  Untrusted string that needs to be ASCII-safe
 * @param label  Header name / identifier (appears in logs)
 * @param scope  Logger scope tag — e.g. 'whop', 'proxy'. Defaults to
 *               'asciiSafe' if unspecified. Becomes a Sentry tag.
 */
export function asciiSafe(
  value: string,
  label: string,
  scope: string = 'asciiSafe',
): string {
  const sanitized = value
    .replace(/[‘’‚‛]/g, "'")          // curly apostrophes/quotes  → '
    .replace(/[“”„‟]/g, '"')          // curly double quotes       → "
    .replace(/[–—]/g, '-')            // en/em dash                → -
    .replace(/[ ]/g, ' ')             // non-breaking space        → space
    .replace(/[^\x20-\x7E]/g, '')     // strip remaining non-ASCII (catch-all safety net)

  if (sanitized !== value) {
    const offenders: Array<{ i: number; code: number; hex: string }> = []
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i)
      if (code > 127) offenders.push({ i, code, hex: '0x' + code.toString(16) })
    }
    Sentry.captureMessage(`[${scope}] asciiSafe modified ${label}`, {
      level: 'warning',
      tags:  { scope, header: label },
      extra: {
        original_length:  value.length,
        sanitized_length: sanitized.length,
        non_ascii_chars:  offenders,
      },
    })
    console.warn(`[${scope}] asciiSafe modified header`, { header: label, non_ascii_chars: offenders })
  }
  return sanitized
}

/**
 * One-shot diagnostic logger for env vars. Use to confirm whether an
 * env var pasted into Vercel contains non-ASCII bytes without exposing
 * the value itself in logs.
 *
 * Output shape:
 *   [<logScope>] <name> { first5, last5, length, non_ascii_count, non_ascii_chars }
 *
 * Always mark call-sites with a TEMP comment so we remember to remove
 * after the env vars are confirmed clean.
 */
export function diagnoseEnvVar(
  name: string,
  value: string | undefined,
  logScope: string,
): void {
  if (value === undefined) {
    console.log(`[${logScope}] ${name}`, { defined: false })
    return
  }
  const nonAscii: Array<{ i: number; code: number; hex: string }> = []
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code > 127) nonAscii.push({ i, code, hex: '0x' + code.toString(16) })
  }
  console.log(`[${logScope}] ${name}`, {
    first5:           value.slice(0, 5),
    last5:            value.slice(-5),
    length:           value.length,
    non_ascii_count:  nonAscii.length,
    non_ascii_chars:  nonAscii,
  })
}
