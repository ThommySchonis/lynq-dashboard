export function truncate(s: string, maxLength: number): string {
  if (!s) return ''
  return s.length > maxLength ? s.slice(0, maxLength) + '…' : s
}

export function initialsFor(user: { name?: string; email?: string } | null | undefined): string {
  if (!user) return '?'
  const src = user.name || user.email || '?'
  return src
    .split(/[ @._]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
}
