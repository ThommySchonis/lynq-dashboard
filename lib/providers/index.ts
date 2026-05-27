import { PROVIDERS } from './types'
import * as gmailAdapter from './gmail'
import * as outlookAdapter from './outlook'
import * as customAdapter from './custom'
import * as forwardingAdapter from './forwarding'

/** Common account shape that all providers accept. */
export interface ProviderAccount {
  id: string
  provider: string
  email?: string
  email_address?: string
  display_name?: string
  access_token?: string
  refresh_token?: string
  expires_at?: string | null
  encrypted_password?: string
  imap_host?: string
  imap_port?: number
  smtp_host?: string
  smtp_port?: number
  [key: string]: unknown
}

interface SendResult {
  providerMessageId: string
  messageId: string
}

export interface ProviderAdapter {
  refreshTokenIfNeeded(account: ProviderAccount): Promise<ProviderAccount>
  fetchThreads(account: ProviderAccount, filters?: Record<string, unknown>): Promise<{ threads: unknown[]; nextPageToken?: string | null }>
  fetchThread(account: ProviderAccount, threadId: string): Promise<{ messages: unknown[] }>
  sendReply(account: ProviderAccount, message: Record<string, unknown>): Promise<SendResult>
  sendNew(account: ProviderAccount, message: Record<string, unknown>): Promise<SendResult>
}

const adapters: Record<string, ProviderAdapter> = {
  [PROVIDERS.GMAIL]: gmailAdapter as unknown as ProviderAdapter,
  [PROVIDERS.OUTLOOK]: outlookAdapter as unknown as ProviderAdapter,
  [PROVIDERS.CUSTOM]: customAdapter as unknown as ProviderAdapter,
  [PROVIDERS.FORWARDING]: forwardingAdapter as unknown as ProviderAdapter,
}

export function getAdapter(provider: string): ProviderAdapter {
  const adapter = adapters[provider]
  if (!adapter) throw new Error(`Unknown provider: ${provider}`)
  return adapter
}
