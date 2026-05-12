'use client'

import type { ReactNode } from 'react'
import { Loader } from 'lucide-react'

interface InviteLayoutProps {
  children?: ReactNode
  loading?: boolean
}

export default function InviteLayout({ children, loading = false }: InviteLayoutProps) {
  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-6 font-sans antialiased">
      <div className="w-full max-w-[440px]">
        {/* Brand wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#1C0F36] px-4 py-2 rounded-lg">
            <span className="text-sm font-bold text-white tracking-[0.02em]">
              Lynq &amp; Flow
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E5E0EB] rounded-xl overflow-hidden shadow-sm">
          {/* Gradient top border */}
          <div
            className="h-1 w-full"
            style={{ background: 'linear-gradient(90deg, #A175FC, #6366F1)' }}
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 px-8">
              <Loader size={28} strokeWidth={1.75} className="text-foreground-4 animate-spin" />
              <p className="mt-3 text-sm text-foreground-4">Loading invite…</p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  )
}
