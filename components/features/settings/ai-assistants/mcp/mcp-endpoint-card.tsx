'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCopied } from '@/hooks/use-copied'
import {
  MCP_ENDPOINT,
  CONNECTION_TABS,
  WHAT_IT_UNLOCKS,
  type StepSegment,
} from '@/lib/mcp-constants'

function Segment({ segment }: { segment: StepSegment }) {
  if (segment.style === 'accent') return <span className="font-medium text-primary">{segment.text}</span>
  if (segment.style === 'bold') return <span className="font-semibold text-foreground">{segment.text}</span>
  if (segment.style === 'code')
    return (
      <code className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[13px] text-foreground-2">
        {segment.text}
      </code>
    )
  return <span>{segment.text}</span>
}

export function MCPEndpointCard() {
  const [activeTab, setActiveTab] = useState(CONNECTION_TABS[0].id)
  const { copied, copy } = useCopied()

  const tab = CONNECTION_TABS.find((t) => t.id === activeTab) ?? CONNECTION_TABS[0]

  return (
    <div className="overflow-hidden rounded-2xl border border-settings-border bg-card">
      {/* Endpoint */}
      <div className="flex flex-col gap-3 px-6 pb-[22px] pt-5">
        <h2 className="text-base font-semibold text-foreground">MCP endpoint</h2>
        <div className="flex items-center gap-2.5">
          <div className="flex flex-1 items-center rounded-[10px] border border-settings-border bg-foreground/[0.02] px-4 py-3">
            <span className="flex-1 truncate text-sm text-foreground">{MCP_ENDPOINT}</span>
          </div>
          <button
            type="button"
            onClick={() => copy(MCP_ENDPOINT)}
            className="flex items-center gap-2 rounded-[10px] border border-settings-border bg-card py-[11px] pl-3.5 pr-4 text-sm font-semibold text-foreground-2 transition-colors hover:bg-foreground/[0.03]"
          >
            {copied ? <Check size={16} strokeWidth={1.75} /> : <Copy size={16} strokeWidth={1.75} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="h-px w-full bg-settings-border" />

      {/* Connection steps + What it unlocks */}
      <div className="flex">
        <div className="flex flex-1 flex-col gap-4 px-6 pb-[22px] pt-5">
          <h2 className="text-base font-semibold text-foreground">Connection steps</h2>

          <div className="flex items-center justify-between gap-2">
            {CONNECTION_TABS.map((t) => {
              const active = t.id === activeTab
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full py-[7px] pl-2 pr-3.5 text-sm font-medium transition-colors',
                    active
                      ? 'border border-accent-border bg-accent-soft text-foreground'
                      : 'border border-transparent text-foreground-3 hover:text-foreground',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.iconSrc} alt="" className="size-5 shrink-0" />
                  {t.label}
                </button>
              )
            })}
          </div>

          <ol className="flex flex-col gap-[11px]">
            {tab.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground-2">
                <span className="text-foreground-4">{i + 1}.</span>
                <span className="flex-1">
                  {step.map((seg, j) => (
                    <Segment key={j} segment={seg} />
                  ))}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="w-px shrink-0 bg-settings-border" />

        <div className="flex flex-1 flex-col gap-3 px-6 pb-[22px] pt-5">
          <h2 className="text-base font-semibold text-foreground">What it unlocks</h2>
          <ul className="flex flex-col gap-[11px]">
            {WHAT_IT_UNLOCKS.map((item) => (
              <li key={item} className="flex items-center gap-[11px] text-sm text-foreground-2">
                <Check size={16} strokeWidth={2} className="shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
