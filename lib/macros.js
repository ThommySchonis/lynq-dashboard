/**
 * Shared helpers for the macros API.
 */

export const MACRO_LANGS = ['auto', 'en', 'nl', 'fr', 'de', 'es', 'it']

export function relativeTime(date) {
  if (!date) return null
  const ms = Date.now() - new Date(date).getTime()
  if (ms < 0) return 'just now'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

// Sanitize macro fields from request body. Returns { name, body, language, tags }.
// Throws an Error with .code property on validation failure.
export function sanitizeMacroInput(body, { partial = false } = {}) {
  const out = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') throw fieldError('Name must be a string', 'invalid_name')
    const name = body.name.trim().slice(0, 200)
    if (!partial && !name) throw fieldError('Name is required', 'name_required')
    if (name) out.name = name
  } else if (!partial) {
    throw fieldError('Name is required', 'name_required')
  }

  if (body.body !== undefined) {
    if (typeof body.body !== 'string') throw fieldError('Body must be a string', 'invalid_body')
    out.body = body.body.slice(0, 100_000)  // 100kb cap
  } else if (!partial) {
    out.body = ''
  }

  if (body.language !== undefined) {
    if (!MACRO_LANGS.includes(body.language)) throw fieldError('Invalid language', 'invalid_language')
    out.language = body.language
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw fieldError('Tags must be an array', 'invalid_tags')
    out.tags = body.tags
      .map(t => typeof t === 'string' ? t.trim().slice(0, 40) : '')
      .filter(Boolean)
      .slice(0, 25)
  }

  return out
}

function fieldError(message, code) {
  const err = new Error(message)
  err.code = code
  return err
}
