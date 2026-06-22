'use client'

import { useState } from 'react'
import { Package, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useConnectParcelPanel } from '@/hooks/supply-chain/use-supply-chain-mutations'
import { apiUrl } from '@/lib/api-client'

interface SetupWizardProps {
  onConnected: () => void
}

function SetupStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start mb-5">
      <div className="w-[22px] h-[22px] rounded-md bg-[#F5F5F5] border border-[rgba(0,0,0,0.07)] flex items-center justify-center text-[10px] font-bold text-[#888888] shrink-0 mt-px">
        {n}
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-foreground mb-1">{title}</p>
        {children}
      </div>
    </div>
  )
}

export function SetupWizard({ onConnected }: SetupWizardProps) {
  const [apiKey, setApiKey] = useState('')
  const [webhookToken, setWebhookToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { mutate, isPending, error } = useConnectParcelPanel()

  const webhookUrl = webhookToken
    ? apiUrl(`parcel-panel/webhook/${webhookToken}`)
    : null

  const copyWebhook = () => {
    if (!webhookUrl) return
    navigator.clipboard.writeText(webhookUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConnect = () => {
    if (!apiKey.trim()) return
    mutate(apiKey.trim(), {
      onSuccess: (data) => {
        setWebhookToken(data.webhookToken)
      },
    })
  }

  return (
    <div className="flex flex-col items-center pt-12 px-6 text-center">
      {/* Icon */}
      <div className="w-16 h-16 rounded-[18px] bg-[#F5F5F5] border border-[rgba(0,0,0,0.07)] flex items-center justify-center mb-[22px]">
        <Package className="w-7 h-7 text-[#555555]" strokeWidth={1.85} />
      </div>

      <h2 className="text-[26px] font-extrabold tracking-[-0.04em] text-foreground mb-2.5">
        Connect Parcel Panel
      </h2>
      <p className="text-sm text-foreground-2 max-w-[440px] leading-[1.7] mb-7">
        Link your Parcel Panel account to automatically track all shipments and get proactive alerts.
      </p>

      {/* Amber notice */}
      <div className="w-full max-w-[440px] mb-7 py-[11px] px-3.5 bg-[rgba(217,119,6,0.06)] border border-[rgba(217,119,6,0.18)] rounded-[10px] text-left flex gap-[9px] items-start">
        <AlertCircle className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-px" />
        <p className="text-[12.5px] text-[#D97706] leading-[1.55]">
          <strong>Note:</strong> On connection we import tracking for your recent orders (last 90 days). After that, new status updates arrive automatically via the webhook.
        </p>
      </div>

      <div className="w-full max-w-[440px] text-left">
        {/* Steps */}
        <div className="bg-card border border-border rounded-xl p-5 pb-1 mb-4">
          <p className="text-[10px] font-bold text-foreground-4 uppercase tracking-[.1em] mb-[18px]">
            Setup instructions
          </p>

          <SetupStep n={1} title="Add your API key">
            <p className="text-[12.5px] text-foreground-2 leading-[1.55]">
              Copy your API key from Parcel Panel &rarr; Settings &rarr; API and paste it below.
            </p>
          </SetupStep>

          <SetupStep n={2} title="Connect your account">
            <p className="text-[12.5px] text-foreground-2 leading-[1.55]">
              Paste your API key below and click Connect to verify and link your account.
            </p>
          </SetupStep>

          <SetupStep n={3} title="Add the webhook URL in Parcel Panel">
            <p className="text-[12.5px] text-foreground-2 leading-[1.55]">
              {webhookToken
                ? 'Go to Parcel Panel \u2192 Settings \u2192 Webhooks \u2192 Add webhook and paste this URL:'
                : 'Connect your account first to generate your unique webhook URL.'}
            </p>
            {webhookUrl && (
              <div className="flex items-center gap-1.5 bg-[#F5F5F5] border border-[rgba(0,0,0,0.07)] rounded-lg py-2 px-2.5 mt-2">
                <code className="flex-1 text-[11px] text-[#555555] break-all font-mono">
                  {webhookUrl}
                </code>
                <button
                  onClick={copyWebhook}
                  className="shrink-0 py-1 px-2 rounded-md border text-[11px] font-semibold cursor-pointer transition-all duration-150"
                  style={{
                    background: copied ? '#16A34A' : '#FFFFFF',
                    color: copied ? '#FFFFFF' : '#555555',
                    borderColor: copied ? 'transparent' : 'rgba(0,0,0,0.1)',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </SetupStep>

          <SetupStep n={4} title="Select all shipping status events">
            <p className="text-[12.5px] text-foreground-2 leading-[1.55]">
              Enable all event types so every status update is sent to your dashboard.
            </p>
          </SetupStep>
        </div>

        {/* API key input — only shown before connect */}
        {!webhookToken && (
          <>
            <input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="Paste your Parcel Panel API key..."
              type="password"
              className="w-full py-3 px-4 bg-input border border-border rounded-[10px] text-foreground text-sm font-[inherit] outline-none transition-colors duration-150 placeholder:text-muted-foreground focus:border-(--border-hover) focus:bg-secondary mb-2.5"
            />

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 mb-2.5 py-2.5 px-3 bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.14)] rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-[#DC2626] shrink-0 mt-px" />
                <p className="text-[12.5px] text-[#DC2626] leading-[1.5]">{error?.message}</p>
              </div>
            )}

            {/* Connect button */}
            <button
              onClick={handleConnect}
              disabled={isPending || !apiKey.trim()}
              className="w-full py-3 rounded-[10px] border text-sm font-bold cursor-pointer transition-all duration-150 disabled:cursor-not-allowed"
              style={{
                background: isPending || !apiKey.trim() ? '#F5F5F5' : '#111111',
                color: isPending || !apiKey.trim() ? '#BDBDBD' : '#FFFFFF',
                borderColor: isPending || !apiKey.trim() ? 'rgba(0,0,0,0.08)' : 'transparent',
              }}
            >
              {isPending ? 'Connecting...' : 'Connect Parcel Panel'}
            </button>
          </>
        )}

        {/* Success state — shown after connect, user completes webhook setup then clicks Done */}
        {webhookToken && (
          <>
            <div className="flex items-start gap-2 mb-4 py-2.5 px-3 bg-[rgba(22,163,74,0.06)] border border-[rgba(22,163,74,0.14)] rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0 mt-px" />
              <p className="text-[12.5px] text-[#16A34A] leading-[1.5]">
                Account connected. Copy the webhook URL above and add it in Parcel Panel, then click Done.
              </p>
            </div>

            <button
              onClick={onConnected}
              className="w-full py-3 rounded-[10px] border text-sm font-bold cursor-pointer transition-all duration-150"
              style={{
                background: '#111111',
                color: '#FFFFFF',
                borderColor: 'transparent',
              }}
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  )
}
