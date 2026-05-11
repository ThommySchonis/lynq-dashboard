'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AuthShellProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}

export function AuthShell({ title, subtitle, children, className }: AuthShellProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-gradient-to-br from-[#1C0F36] to-[#0D0F14] lg:flex">
        {/* Floating orbs */}
        <div className="absolute left-1/4 top-1/4 h-64 w-64 animate-[orbFloat1_20s_ease-in-out_infinite] rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 h-48 w-48 animate-[orbFloat2_25s_ease-in-out_infinite] rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative z-10 text-center">
          <Image src="/logo.png" alt="Lynq & Flow" width={64} height={64} className="mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white">Lynq & Flow</h2>
          <p className="mt-2 text-sm text-white/50">Customer support, simplified.</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={cn('w-full max-w-md', className)}
        >
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-1)]">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-[var(--text-3)]">{subtitle}</p>
          )}
          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
    </div>
  )
}
