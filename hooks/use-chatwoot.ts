'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '@/stores/auth'

interface ChatwootUser {
  email: string
  name: string
  avatar_url?: string
  phone_number?: string
}

interface ChatwootCustomAttributes {
  [key: string]: string | number | boolean
}

interface ChatwootSDK {
  run: (config: { websiteToken: string; baseUrl: string }) => void
}

interface ChatwootInstance {
  setUser: (identifier: string, user: ChatwootUser & { custom_attributes?: ChatwootCustomAttributes }) => void
  setCustomAttributes: (attributes: ChatwootCustomAttributes) => void
  reset: () => void
  toggle: (state?: 'open' | 'close') => void
}

declare global {
  interface Window {
    chatwootSettings?: {
      hideMessageBubble?: boolean
      position?: 'left' | 'right'
      locale?: string
      type?: 'standard' | 'expanded_bubble'
      darkMode?: 'light' | 'auto'
      launcherTitle?: string
    }
    chatwootSDK?: ChatwootSDK
    $chatwoot?: ChatwootInstance
  }
}

interface UseChatwootReturn {
  isReady: boolean
  toggle: () => void
  open: () => void
  close: () => void
}

const CHATWOOT_TOKEN = process.env.NEXT_PUBLIC_CHATWOOT_TOKEN
const CHATWOOT_BASE_URL = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL ?? 'https://app.chatwoot.com'

let scriptInjected = false
let mountCount = 0

export function useChatwoot(): UseChatwootReturn {
  const [isReady, setIsReady] = useState(false)
  const isReadyRef = useRef(false)
  const user = useAuthStore((s) => s.user)
  const workspace = useAuthStore((s) => s.workspace)
  const role = useAuthStore((s) => s.role)

  const identifyUser = useCallback(() => {
    if (!window.$chatwoot || !user || !workspace) return

    const displayName = typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : (user.email ?? '')

    window.$chatwoot.setUser(user.id, {
      email: user.email ?? '',
      name: displayName,
      custom_attributes: {
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        role: role ?? 'observer',
      },
    })
  }, [user, workspace, role])

  useEffect(() => {
    if (!CHATWOOT_TOKEN) return

    const handleReady = () => {
      isReadyRef.current = true
      setIsReady(true)
      identifyUser()
    }

    window.addEventListener('chatwoot:ready', handleReady)

    if (window.$chatwoot) {
      handleReady()
    } else if (!scriptInjected) {
      scriptInjected = true

      window.chatwootSettings = {
        hideMessageBubble: false,
        position: 'right',
        locale: 'en',
        type: 'standard',
        darkMode: 'auto',
      }

      const script = document.createElement('script')
      script.src = `${CHATWOOT_BASE_URL}/packs/js/sdk.js`
      script.async = true
      script.onload = () => {
        window.chatwootSDK?.run({ websiteToken: CHATWOOT_TOKEN, baseUrl: CHATWOOT_BASE_URL })
      }
      document.head.appendChild(script)
    }

    return () => {
      window.removeEventListener('chatwoot:ready', handleReady)
    }
  }, [identifyUser])

  useEffect(() => {
    if (isReadyRef.current) {
      identifyUser()
    }
  }, [identifyUser])

  useEffect(() => {
    mountCount++
    return () => {
      mountCount--
      if (mountCount === 0 && window.$chatwoot) {
        window.$chatwoot.reset()
      }
    }
  }, [])

  const toggle = useCallback(() => window.$chatwoot?.toggle(), [])
  const open = useCallback(() => window.$chatwoot?.toggle('open'), [])
  const close = useCallback(() => window.$chatwoot?.toggle('close'), [])

  return { isReady, toggle, open, close }
}
