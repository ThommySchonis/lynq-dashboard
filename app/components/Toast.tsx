'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

export interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}

const ACCENT: Record<ToastProps['type'], string> = {
  success: '#16A34A',
  error:   '#DC2626',
  info:    '#A175FC',
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{
        position: 'fixed', bottom: 20, right: 20,
        background: '#111111', color: '#FFFFFF',
        borderRadius: 8, padding: '10px 16px',
        fontSize: 13, fontWeight: 500,
        maxWidth: 320, zIndex: 9999,
        borderLeft: `3px solid ${ACCENT[type]}`,
        cursor: 'pointer', userSelect: 'none',
        fontFamily: 'var(--font-rethink), -apple-system, sans-serif',
        lineHeight: 1.4,
      }}
    >
      {message}
    </motion.div>
  )
}

export interface ToastState {
  id: number
  message: string
  type: ToastProps['type']
}

export function ToastContainer({
  toast,
  onClose,
}: {
  toast: ToastState | null
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={onClose} />}
    </AnimatePresence>
  )
}

export function createToast(
  message: string,
  type: ToastProps['type'] = 'info',
): ToastState {
  return { id: Date.now(), message, type }
}
