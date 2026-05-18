import { create } from 'zustand'
import { authFetch } from '@/lib/inbox-utils'
import { parseJson } from '@/lib/utils/typed-json'
import type { Thread, Message } from '@/types'

interface AnalyzeResponse { analyses?: Record<string, ThreadAnalysis> }
interface ReplyResponse { reply?: string }
interface TranslateResponse { translated?: string }
interface DetectLanguageResponse { code?: string; name?: string }

interface ThreadAnalysis {
  urgency: string
  score: number
  reason?: string
}

interface CustomerLang {
  code: string
  name: string
}

interface AIState {
  // Analyses keyed by thread ID
  analyses: Record<string, ThreadAnalysis>

  // Translations keyed by message ID ('__loading__' = in progress)
  translations: Record<string, string>

  // Customer language detection
  customerLang: CustomerLang | null

  // Auto-translate toggle
  autoTranslate: boolean

  // Loading states
  aiLoading: boolean

  // Actions
  setAutoTranslate: (enabled: boolean) => void
  setAnalyses: (analyses: Record<string, ThreadAnalysis>) => void
  setTranslation: (msgId: string, value: string | undefined) => void
  resetForThread: () => void
  analyzeThreads: (threads: Thread[], token: string) => Promise<void>
  generateReply: (thread: Thread, messages: Message[], token: string) => Promise<string | null>
  translateMessage: (msgId: string, text: string, token: string) => Promise<void>
  detectLanguage: (text: string, token: string) => Promise<void>
}

export const useAIStore = create<AIState>()((set, get) => ({
  analyses: {},
  translations: {},
  customerLang: null,
  autoTranslate: false,
  aiLoading: false,

  setAutoTranslate: (enabled) => set({ autoTranslate: enabled }),

  setAnalyses: (analyses) => set({ analyses }),

  setTranslation: (msgId, value) =>
    set((state) => {
      if (value === undefined) {
        const { [msgId]: _, ...rest } = state.translations
        return { translations: rest }
      }
      return { translations: { ...state.translations, [msgId]: value } }
    }),

  resetForThread: () => set({ customerLang: null, autoTranslate: false, translations: {} }),

  analyzeThreads: async (threads, token) => {
    if (!threads?.length || !token) return
    try {
      const res = await authFetch(
        '/api/ai/analyze',
        {
          method: 'POST',
          body: JSON.stringify({
            threads: threads.slice(0, 25).map((t) => ({
              id: t.id,
              subject: t.subject,
              snippet: t.snippet,
            })),
          }),
        },
        token,
      )
      const data = await parseJson<AnalyzeResponse>(res)
      if (data.analyses) {
        set({ analyses: data.analyses })
      }
    } catch {
      // Analysis failure is non-critical
    }
  },

  generateReply: async (thread, messages, token) => {
    if (!messages.length) return null
    set({ aiLoading: true })
    try {
      const res = await authFetch(
        '/api/ai/reply',
        {
          method: 'POST',
          body: JSON.stringify({ messages, threadId: thread.id }),
        },
        token,
      )
      const data = await parseJson<ReplyResponse>(res)
      set({ aiLoading: false })
      if (data.reply) return data.reply
      return null
    } catch {
      set({ aiLoading: false })
      return null
    }
  },

  translateMessage: async (msgId, text, token) => {
    // Set loading sentinel
    set({ translations: { ...get().translations, [msgId]: '__loading__' } })
    try {
      const res = await authFetch(
        '/api/ai/translate',
        { method: 'POST', body: JSON.stringify({ text }) },
        token,
      )
      const data = await parseJson<TranslateResponse>(res)
      set({
        translations: {
          ...get().translations,
          [msgId]: data.translated || 'Translation failed',
        },
      })
    } catch {
      set({
        translations: {
          ...get().translations,
          [msgId]: 'Translation failed',
        },
      })
    }
  },

  detectLanguage: async (text, token) => {
    try {
      const res = await authFetch(
        '/api/ai/translate',
        { method: 'POST', body: JSON.stringify({ text, detectOnly: true }) },
        token,
      )
      const data = await parseJson<DetectLanguageResponse>(res)
      if (data.code && data.name) {
        set({
          customerLang: { code: data.code, name: data.name },
          autoTranslate: data.code !== 'en',
        })
      }
    } catch {
      // Language detection failure is non-critical
    }
  },
}))
