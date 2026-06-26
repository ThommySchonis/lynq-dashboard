import { Check } from 'lucide-react'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { WHAT_IT_UNLOCKS, STARTER_PROMPTS } from '@/lib/mcp-constants'

const CAPABILITIES = [
  {
    heading: 'Inbox',
    items: [
      'Find and read tickets by date, status, tag, or keyword',
      'Draft and send replies to customers',
      'Change ticket state (open, snoozed, closed)',
      'Add tags to tickets',
      'Link a ticket to a customer record',
    ],
  },
  {
    heading: 'Macros',
    items: ['List available macros', 'Apply a macro to a ticket'],
  },
  {
    heading: 'Orders & analytics',
    items: [
      'Look up Shopify orders linked to a ticket or customer',
      'Surface trends across tickets (volume, tags, repeat topics)',
    ],
  },
  {
    heading: 'Search',
    items: ['Full-text search across all tickets in your workspace'],
  },
  {
    heading: 'Emma settings',
    items: [
      "Read Emma's current guidance rules and knowledge base",
      "Edit Emma's guidance rules and saved replies",
    ],
  },
]

export default function MCPGuidePage() {
  return (
    <div className="mx-auto flex min-h-full max-w-[960px] flex-col gap-7 px-6 py-10">
      <SettingsPageHeader
        title="Prompt guide"
        description="Tips and starter prompts for getting the most out of your AI assistant connector."
        backHref="/settings/ai-assistants/mcp"
        breadcrumb={['AI assistants', 'Prompt guide']}
      />

      {/* Intro — what it unlocks */}
      <section className="flex flex-col gap-3.5">
        <h2 className="text-lg font-semibold text-foreground">What connecting unlocks</h2>
        <p className="text-sm text-foreground-3">
          Once your AI assistant is connected to your Lynq &amp; Flow workspace it can act on your behalf — not just give advice. Here is what becomes possible:
        </p>
        <ul className="flex flex-col gap-[11px]">
          {WHAT_IT_UNLOCKS.map((item) => (
            <li key={item} className="flex items-center gap-[11px] text-sm text-foreground-2">
              <Check size={16} strokeWidth={2} className="shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Starter prompts */}
      <section className="flex flex-col gap-3.5">
        <h2 className="text-lg font-semibold text-foreground">Starter prompts</h2>
        <p className="text-sm text-foreground-3">
          Copy any of these into your AI assistant to get started right away.
        </p>
        <div className="flex flex-col gap-4">
          {STARTER_PROMPTS.map((prompt) => (
            <div
              key={prompt.title}
              className="flex flex-col gap-2 rounded-2xl border border-settings-border bg-card px-5 pb-5 pt-[18px]"
            >
              <h3 className="text-base font-semibold text-foreground">{prompt.title}</h3>
              <p className="text-sm text-foreground-3">{prompt.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capability reference */}
      <section className="flex flex-col gap-3.5">
        <h2 className="text-lg font-semibold text-foreground">What the connector can do</h2>
        <p className="text-sm text-foreground-3">
          These are the concrete actions available to your AI assistant once connected.
        </p>
        <div className="overflow-hidden rounded-2xl border border-settings-border bg-card">
          {CAPABILITIES.map((group, i) => (
            <div key={group.heading}>
              {i > 0 && <div className="h-px w-full bg-settings-border" />}
              <div className="flex flex-col gap-2.5 px-6 py-5">
                <h3 className="text-sm font-semibold text-foreground">{group.heading}</h3>
                <ul className="flex flex-col gap-2">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-foreground-2">
                      <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-foreground-4" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
