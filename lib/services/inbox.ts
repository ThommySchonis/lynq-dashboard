import { getAdapter } from '../providers'

/**
 * Send a reply in a thread.
 */
export async function sendReply(provider: string, account: any, message: any) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.sendReply(refreshed, message)
}

/**
 * Fetch threads for a workspace.
 */
export async function getThreads(provider: string, account: any, filters: any = {}) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.fetchThreads(refreshed, filters)
}

/**
 * Fetch a single thread with all messages.
 */
export async function getThread(provider: string, account: any, threadId: string) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.fetchThread(refreshed, threadId)
}

/**
 * Mark a thread as resolved.
 */
export async function resolveThread(provider: string, account: any, threadId: string, agentId: string) {
  // Thread resolution is handled by conversationEngine, not provider adapters.
  // This is a pass-through for Part 2 analytics instrumentation.
  const engine: any = await import('../conversationEngine')
  return engine.resolveThread(threadId, agentId)
}

/**
 * Send a new message (not a reply).
 */
export async function sendNew(provider: string, account: any, message: any) {
  const adapter = getAdapter(provider)
  const refreshed = await adapter.refreshTokenIfNeeded(account)
  return adapter.sendNew(refreshed, message)
}
