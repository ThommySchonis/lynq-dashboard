import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Capitalises a role string for UI display.
 * "agent" → "Agent", "owner" → "Owner". Empty / null → "—".
 */
export function formatRole(role: string | null | undefined): string {
  if (!role) return '—'
  const r = role.trim()
  if (!r) return '—'
  return r[0].toUpperCase() + r.slice(1).toLowerCase()
}
