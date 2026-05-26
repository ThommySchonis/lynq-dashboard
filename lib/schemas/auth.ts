import { z } from 'zod'

// --- Body schemas ---

export const customEmailConnectBody = z.object({
  imap_host: z.string().min(1, 'IMAP host is required'),
  imap_port: z.union([z.string(), z.number()]).optional().default(993),
  smtp_host: z.string().min(1, 'SMTP host is required'),
  smtp_port: z.union([z.string(), z.number()]).optional().default(587),
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
  store_id: z.string().optional(),
})

export const shopifyAuthBody = z.object({
  shop: z.string().min(1, 'Shop domain is required'),
  store_name: z.string().min(1, 'Store name is required'),
})

export const recoveryClearBody = z.object({
  clear: z.boolean().optional(),
})

// --- Query schemas ---

export const oauthStartQuery = z.object({
  t: z.string().optional(),
  store_id: z.string().optional(),
})

export const gmailCallbackQuery = z.object({
  code: z.string().min(1, 'Code is required'),
  state: z.string().min(1, 'State is required'),
})

export const outlookCallbackQuery = z.object({
  code: z.string().min(1, 'Code is required'),
  state: z.string().min(1, 'State is required'),
})

export const shopifyCallbackQuery = z.object({
  code: z.string().min(1, 'Code is required'),
  hmac: z.string().min(1, 'HMAC is required'),
  shop: z.string().min(1, 'Shop is required'),
  state: z.string().min(1, 'State is required'),
})

// --- Invite body schemas ---

export const inviteSignupBody = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const disconnectGmailBody = z.object({
  account_id: z.string().min(1, 'account_id is required'),
})
