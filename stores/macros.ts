import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authFetch } from '@/lib/inbox-utils'

interface Macro {
  id: string
  name: string
  body?: string
  content?: string
  tags?: string[]
  language?: string
  usageCount?: number
  updatedAt?: string
  archived?: boolean
  [key: string]: any
}

interface MacrosState {
  macros: Macro[]
  aiMacros: Macro[]
  favs: string[]

  setMacros: (macros: Macro[]) => void
  saveMacro: (macro: Macro) => void
  deleteMacro: (id: string) => void
  setAiMacros: (macros: Macro[]) => void
  toggleFav: (id: string) => void
  fetchMacros: (token: string) => Promise<void>
}

const FALLBACK_MACROS: Macro[] = [
  { id:'greeting', name:'Greeting',        tags:['support'],   language:'English', usageCount:0, updatedAt:new Date().toISOString(), archived:false, body:'Hi {{name}},\n\nThank you for reaching out! I\'m happy to help you.\n\n' },
  { id:'tracking', name:'Tracking Update', tags:['shipping'],  language:'English', usageCount:0, updatedAt:new Date().toISOString(), archived:false, body:'Hi {{name}},\n\nYour order is on its way! You can track it using the link in your shipping confirmation email.\n\nBest regards,\nCustomer Support' },
  { id:'refund',   name:'Refund',          tags:['refund'],    language:'English', usageCount:0, updatedAt:new Date().toISOString(), archived:false, body:'Hi {{name}},\n\nYour refund has been processed. The amount is typically back in your account within 5–7 business days.\n\nBest regards,\nCustomer Support' },
  { id:'delay',    name:'Delay',           tags:['shipping'],  language:'English', usageCount:0, updatedAt:new Date().toISOString(), archived:false, body:'Hi {{name}},\n\nUnfortunately your order is experiencing a delay. We\'ll keep you updated!\n\nBest regards,\nCustomer Support' },
  { id:'quality',  name:'Quality Issue',   tags:['complaint'], language:'English', usageCount:0, updatedAt:new Date().toISOString(), archived:false, body:'Hi {{name}},\n\nWe\'re sorry to hear that! Could you send us a photo? We\'ll arrange a solution right away.\n\nBest regards,\nCustomer Support' },
  { id:'closing',  name:'Closing',         tags:['support'],   language:'English', usageCount:0, updatedAt:new Date().toISOString(), archived:false, body:'Hi {{name}},\n\nGreat to hear! Have a wonderful day!\n\nBest regards,\nCustomer Support' },
  { id:'notfound', name:'Order Not Found', tags:['order'],     language:'English', usageCount:0, updatedAt:new Date().toISOString(), archived:false, body:'Hi {{name}},\n\nI\'m unable to find an order linked to this email address. Could you share your order number?\n\nBest regards,\nCustomer Support' },
  { id:'wrongitem',name:'Wrong Item',      tags:['complaint'], language:'English', usageCount:0, updatedAt:new Date().toISOString(), archived:false, body:'Hi {{name}},\n\nWe\'re sorry about that! Please send us a photo and we\'ll sort it out right away.\n\nBest regards,\nCustomer Support' },
]

export const useMacrosStore = create<MacrosState>()(
  persist(
    (set, get) => ({
      macros: FALLBACK_MACROS,
      aiMacros: [],
      favs: [],

      setMacros: (macros) => set({ macros }),

      saveMacro: (macro) =>
        set((state) => {
          const idx = state.macros.findIndex(x => x.id === macro.id)
          const macros = idx >= 0
            ? state.macros.map(x => x.id === macro.id ? macro : x)
            : [...state.macros, macro]
          return { macros }
        }),

      deleteMacro: (id) =>
        set((state) => ({ macros: state.macros.filter(x => x.id !== id) })),

      setAiMacros: (aiMacros) => set({ aiMacros }),

      toggleFav: (id) =>
        set((state) => ({
          favs: state.favs.includes(id)
            ? state.favs.filter(x => x !== id)
            : [...state.favs, id],
        })),

      fetchMacros: async (token) => {
        try {
          const res = await authFetch('/api/macros', {}, token)
          const data = await res.json()
          if (data.macros?.length) set({ macros: data.macros })
        } catch {}
      },
    }),
    {
      name: 'lynq_macros_store',
      partialize: (state) => ({ macros: state.macros, favs: state.favs }),
    },
  ),
)
