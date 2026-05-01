'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

export interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
}

const STYLES = {
  success: { icon: '✓', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  error:   { icon: '✕', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  info:    { icon: 'ℹ', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
}

function Toast({ message, type = 'success', onClose }: ToastProps) {
  const s = STYLES[type]

  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: s.bg, border: `1px solid ${s.border}`,
        borderRadius: 10, padding: '12px 14px',
        minWidth: 280, maxWidth: 360,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        fontFamily: "'Switzer',-apple-system,sans-serif",
      }}
    >
      <span style={{ fontSize: 14, color: s.color, fontWeight: 600, flexShrink: 0 }}>{s.icon}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#111', flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '2px 4px', color: '#BDBDBD', fontSize: 14, lineHeight: 1,
          display: 'flex', alignItems: 'center',
        }}
        aria-label="Dismiss"
      >✕</button>
    </motion.div>
  )
}

export interface ToastState {
  id: number
  message: string
  type: ToastProps['type']
}

export function ToastContainer({ toasts, removeToast }: { toasts: ToastState[]; removeToast: (id: number) => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <AnimatePresence>
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}
