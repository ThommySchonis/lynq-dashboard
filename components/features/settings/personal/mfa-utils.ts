/** Copy text to clipboard silently. */
export function copyText(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {})
}

/** Download an array of recovery codes as a .txt file. */
export function downloadCodes(codes: string[]) {
  const blob = new Blob([codes.join('\n')], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'lynq-recovery-codes.txt'
  a.click()
  URL.revokeObjectURL(a.href)
}
