import { toast } from 'sonner'

export async function downloadExport(
  url: string,
  body: Record<string, unknown>,
  token: string,
  fallbackFilename: string,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    toast.error('Failed to download export. Please try again.')
    return
  }

  const disposition = res.headers.get('Content-Disposition')
  let filename = fallbackFilename
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i)
    if (match?.[1]) {
      filename = decodeURIComponent(match[1].trim())
    }
  }

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}
