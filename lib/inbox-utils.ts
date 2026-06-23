// lib/inbox-utils.ts

/** ISO timestamp `hours` from now — used to resolve snooze presets. */
export function isoFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString()
}

export function authFetch(url: string, opts: RequestInit = {}, token: string) {
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  })
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

export function fmtPrice(v: string | number, c = 'EUR'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c || 'EUR' }).format(Number(v) || 0)
}

/** A Shopify customer is VIP when its comma-separated tags string contains "vip"
 *  (case-insensitive). Temporary until a structured VIP field exists (BE #3). */
export function deriveIsVip(tags: string | null | undefined): boolean {
  return (tags ?? '').split(',').some((t) => t.trim().toLowerCase() === 'vip')
}

export function relTime(s: string | null | undefined): string {
  if (!s) return ''
  const diff = Date.now() - new Date(s).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function extractEmail(s: string | null | undefined): string {
  if (!s) return ''
  const m = s.match(/<(.+?)>/)
  return m ? m[1] : s.trim()
}

export function extractName(s: string | null | undefined): string {
  if (!s) return 'Unknown'
  const m = s.match(/^([^<]+)/)
  return m ? m[1].trim().replace(/"/g, '') : s
}

export function getInitials(name: string): string {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export function escapeHtml(value = ''): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function normalizeSafeUrl(href: string | null, opts?: { allowImages?: boolean }): string | null {
  if (!href) return null
  try {
    const url = new URL(href, window.location.origin)
    if (['http:', 'https:', 'mailto:'].includes(url.protocol)) return url.href
    if (opts?.allowImages && url.protocol === 'data:') return url.href
    return null
  } catch {
    return null
  }
}

/** Parse a comma-separated recipient string into the {email, name} shape the compose API expects. */
export function parseRecipientList(value: string | undefined): { email: string; name: string }[] {
  if (!value) return []
  return value
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ email, name: '' }))
}

export function sanitizeHtml(html = ''): string {
  if (typeof document === 'undefined') return html.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

  const allowedTags = new Set(['A', 'B', 'BR', 'BLOCKQUOTE', 'CODE', 'DIV', 'EM', 'I', 'LI', 'OL', 'P', 'PRE', 'SPAN', 'STRONG', 'U', 'UL', 'IMG'])
  const template = document.createElement('template')
  template.innerHTML = String(html)

  template.content.querySelectorAll('script,style,iframe,object,embed,form,meta,link').forEach(node => node.remove())
  template.content.querySelectorAll('*').forEach(node => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes)
      return
    }
    ;[...node.attributes].forEach(attr => {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on') || name === 'style') node.removeAttribute(attr.name)
    })
    if (node.tagName === 'A') {
      const href = normalizeSafeUrl(node.getAttribute('href'))
      if (href) {
        node.setAttribute('href', href)
        node.setAttribute('rel', 'noopener noreferrer')
        node.setAttribute('target', '_blank')
      } else {
        node.removeAttribute('href')
      }
    } else if (node.tagName === 'IMG') {
      const src = normalizeSafeUrl(node.getAttribute('src'), { allowImages: true })
      if (src) node.setAttribute('src', src)
      else node.remove()
      node.removeAttribute('srcset')
    } else {
      ;[...node.attributes].forEach(attr => node.removeAttribute(attr.name))
    }
  })
  return template.innerHTML
}

export function plainTextToSafeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
}

export const EMOJIS = ['😊','😀','🙏','👍','❤️','✅','⚠️','📦','🚚','💰','🔄','❌','✨','💬','🎉','😅','🤔','😢','😡','🥺','🙌','💪','🤝','⏰','🌍','🔔','⭐','📧','👋','😮','🫡','🙌']

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:     { label: 'Open',     color: 'text-blue-500'    },
  pending:  { label: 'Pending',  color: 'text-amber-500'   },
  resolved: { label: 'Resolved', color: 'text-emerald-500' },
  closed:   { label: 'Closed',   color: 'text-zinc-400'    },
}

export const ORDER_STATUS_CONFIG: Record<string, { label: string; variant: string }> = {
  paid:        { label: 'Paid',        variant: 'active'    },
  unpaid:      { label: 'Unpaid',      variant: 'pending'   },
  fulfilled:   { label: 'Fulfilled',   variant: 'delivered' },
  unfulfilled: { label: 'Unfulfilled', variant: 'pending'   },
  partial:     { label: 'Partial',     variant: 'pending'   },
  refunded:    { label: 'Refunded',    variant: 'failed'    },
  cancelled:   { label: 'Cancelled',   variant: 'failed'    },
  voided:      { label: 'Voided',      variant: 'failed'    },
  pending:     { label: 'Pending',     variant: 'pending'   },
  authorized:  { label: 'Authorized',  variant: 'open'      },
}

export const CANCEL_REASONS = [
  { value: 'customer',  label: 'Customer requested' },
  { value: 'fraud',     label: 'Fraudulent'         },
  { value: 'inventory', label: 'Items unavailable'  },
  { value: 'declined',  label: 'Payment declined'   },
  { value: 'other',     label: 'Other'              },
]

export const REFUND_REASONS = [
  { value: 'customer',   label: 'Customer changed mind' },
  { value: 'fraud',      label: 'Fraudulent order'      },
  { value: 'inventory',  label: 'Item out of stock'     },
  { value: 'declined',   label: 'Payment declined'      },
  { value: 'quality',    label: 'Product quality issue'  },
  { value: 'shipping',   label: 'Shipping problem'      },
  { value: 'wrong_item', label: 'Wrong item received'   },
  { value: 'other',      label: 'Other'                 },
]
