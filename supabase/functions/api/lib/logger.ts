type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const CONFIGURED_LEVEL: LogLevel =
  (Deno.env.get('LOG_LEVEL') as LogLevel) ?? 'info'

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const IPV4_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g
const IPV4_MAPPED_RE = /::ffff:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g
const TOKEN_VALUE_RE = /^(shpat_|ya29\.|Bearer\s).*/i
const SENSITIVE_KEY_RE =
  /^(password|pass|secret|token|access_token|refresh_token)$/i
const NAME_KEY_RE =
  /^(first_name|last_name|customer_name|full_name)$/i
const MAX_DEPTH = 10

function sanitize(value: unknown, depth = 0, seen = new WeakSet()): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED]'
  if (value === null || value === undefined) return value
  if (typeof value === 'boolean' || typeof value === 'number') return value

  if (typeof value === 'string') {
    return value
      .replace(EMAIL_RE, '[EMAIL]')
      .replace(IPV4_MAPPED_RE, '[IP]')
      .replace(IPV4_RE, '[IP]')
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1, seen))
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[CIRCULAR]'
    seen.add(value as object)

    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        result[key] = key.toLowerCase().includes('token') ? '[TOKEN]' : '[REDACTED]'
      } else if (NAME_KEY_RE.test(key)) {
        result[key] = '[NAME]'
      } else if (typeof val === 'string' && TOKEN_VALUE_RE.test(val)) {
        result[key] = '[TOKEN]'
      } else {
        result[key] = sanitize(val, depth + 1, seen)
      }
    }
    return result
  }

  return String(value)
}

function emit(level: LogLevel, tag: string, msg: string, data?: unknown) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[CONFIGURED_LEVEL]) return

  const entry: Record<string, unknown> = {
    level,
    tag,
    msg,
    ts: new Date().toISOString(),
  }

  if (data !== undefined) {
    entry.data = sanitize(data)
  }

  const line = JSON.stringify(entry)

  switch (level) {
    case 'error':
      console.error(line)
      break
    case 'warn':
      console.warn(line)
      break
    default:
      console.log(line)
  }
}

export const logger = {
  debug: (tag: string, msg: string, data?: unknown) => emit('debug', tag, msg, data),
  info:  (tag: string, msg: string, data?: unknown) => emit('info', tag, msg, data),
  warn:  (tag: string, msg: string, data?: unknown) => emit('warn', tag, msg, data),
  error: (tag: string, msg: string, data?: unknown) => emit('error', tag, msg, data),
}
