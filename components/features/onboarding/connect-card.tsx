import type { ReactNode } from 'react'

export interface ConnectCardProps {
  icon: string
  title: string
  description: string
  connected: boolean
  children: ReactNode
}

export function ConnectCard({ icon, title, description, connected, children }: ConnectCardProps) {
  return (
    <div
      className={[
        'bg-[#1C0F36] rounded-xl p-5 flex flex-col gap-3',
        connected ? 'border border-green-400/30' : 'border border-white/[0.07]',
      ].join(' ')}
    >
      <div className="text-2xl">{icon}</div>
      <div>
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-xs text-white/40 leading-relaxed">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  )
}
