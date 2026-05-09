import { PROVIDERS } from './types'
import * as gmailAdapter from './gmail'
import * as outlookAdapter from './outlook'
import * as customAdapter from './custom'

const adapters = {
  [PROVIDERS.GMAIL]: gmailAdapter,
  [PROVIDERS.OUTLOOK]: outlookAdapter,
  [PROVIDERS.CUSTOM]: customAdapter,
}

export function getAdapter(provider) {
  const adapter = adapters[provider]
  if (!adapter) throw new Error(`Unknown provider: ${provider}`)
  return adapter
}
