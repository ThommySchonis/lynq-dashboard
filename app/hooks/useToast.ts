'use client'

import { useState, useCallback } from 'react'
import type { ToastState } from '../components/Toast'

export function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([])

  const addToast = useCallback((message: string, type: ToastState['type'] = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}
