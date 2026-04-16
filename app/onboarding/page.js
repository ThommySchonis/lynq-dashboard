'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const STEPS = ['Welcome', 'Brand Setup', 'Connect Tools', 'Done']

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)

  // Brand setup
  const [brandName, setBrandName] = useState('')
  const [language, setLanguage] = useState('English')
  const [tone, setTone] = useState('professional')

  // Connections
  const [shopifyStore, setShopifyStore] = useState('')
  const [parcelPanelKey, setParcelPanelKey] = useState('')
  const [gmailConnected, setGmailConnected] = useState(false)
  const [shopifyConnected, setShopifyConnected] = useState(false)
  const [parcelConnected, setParcelConnected] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setUser(session.user)

      // Check if returning from Shopify OAuth
      const params = new URLSearchParams(window.location.search)
      if (params.get('shopify') === 'connected') {
        setShopifyConnected(true)
        setStep(3)
      }
      if (params.get('step')) {
        setStep(parseInt(params.get('step')))
      }
    })
  }, [])

  async function saveBrandSetup() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/settings/brand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ brandName, language, tone }),
    })
    setLoading(false)
    setStep(3)
  }

  async function connectParcelPanel() {
    if (!parcelPanelKey) return
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/settings/integrations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ parcelpanel_api_key: parcelPanelKey }),
    })
    if (res.ok) setParcelConnected(true)
    setLoading(false)
  }

  async function connectShopify() {
    if (!shopifyStore) return
    const { data: { session } } = await supabase.auth.getSession()
    window.location.href = `/api/auth/shopify?shop=${shopifyStore}&token=${session.access_token}`
  }

  async function connectGmail() {
    window.location.href = '/api/auth/gmail'
  }

  async function completeOnboarding() {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase
      .from('profiles')
      .upsert({ id: session.user.id, onboarding_completed: true })
    window.location.href = '/inbox'
  }

  if (!user) return null

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1C0F36',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 24px',
    }}>
      {/* Glow */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '800px', height: '400px',
        background: 'radial-gradient(ellipse, rgba(161,117,252,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <img src="/logo.png" alt="Lynq" style={{
        height: '28px', filter: 'brightness(0) invert(1)', marginBottom: '40px'
      }} />

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '48px' }}>
        {STEPS.map((label, i) => {
          const num = i + 1
          const done = step > num
          const active = step === num
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: '600',
                  background: done ? '#A175FC' : active ? 'transparent' : 'transparent',
                  border: done ? 'none' : active ? '2px solid #A175FC' : '2px solid rgba(255,255,255,0.15)',
                  color: done ? '#fff' : active ? '#A175FC' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.3s ease',
                }}>
                  {done ? '✓' : num}
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: '500',
                  color: active ? '#fff' : 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: '80px', height: '1px', marginBottom: '18px', marginLeft: '8px', marginRight: '8px',
                  background: step > num ? '#A175FC' : 'rgba(255,255,255,0.1)',
                  transition: 'background 0.3s ease',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Card */}
      <div style={{
        background: '#241352',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px',
        padding: '40px',
        width: '100%',
        maxWidth: step === 3 ? '720px' : '480px',
        position: 'relative',
      }}>

        {/* STEP 1: Welcome */}
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>👋</div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '12px' }}>
              Welcome to Lynq
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', marginBottom: '40px', lineHeight: '1.6' }}>
              Let's get your dashboard ready in a few steps.<br />
              It only takes about 2 minutes.
            </p>
            <button onClick={() => setStep(2)} style={{
              background: '#A175FC', color: '#fff', borderRadius: '10px',
              padding: '14px 40px', fontSize: '15px', fontWeight: '600',
            }}>
              Get Started →
            </button>
          </div>
        )}

        {/* STEP 2: Brand Setup */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px' }}>Brand Setup</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginBottom: '32px' }}>
              This helps the AI write replies that match your brand voice.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <Label>Brand name</Label>
              <input
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="e.g. Earthly Sheets"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <Label>Customer language</Label>
              <select value={language} onChange={e => setLanguage(e.target.value)}>
                <option>English</option>
                <option>Dutch</option>
                <option>French</option>
                <option>German</option>
                <option>Spanish</option>
              </select>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <Label>Tone of voice</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                {[
                  { value: 'friendly', label: 'Friendly & informal', example: '"Hey! Thanks for reaching out 😊"' },
                  { value: 'professional', label: 'Professional & warm', example: '"Thank you for contacting us."' },
                  { value: 'luxury', label: 'Luxury & formal', example: '"We sincerely appreciate you reaching out."' },
                ].map(opt => (
                  <div
                    key={opt.value}
                    onClick={() => setTone(opt.value)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: `1px solid ${tone === opt.value ? '#A175FC' : 'rgba(255,255,255,0.07)'}`,
                      background: tone === opt.value ? 'rgba(161,117,252,0.08)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '2px' }}>{opt.label}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{opt.example}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={saveBrandSetup}
              disabled={!brandName || loading}
              style={{
                width: '100%', padding: '13px',
                background: !brandName ? 'rgba(161,117,252,0.3)' : '#A175FC',
                color: '#fff', borderRadius: '10px',
                fontSize: '14px', fontWeight: '600',
                cursor: !brandName ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Saving...' : 'Save & Continue →'}
            </button>
          </div>
        )}

        {/* STEP 3: Connect Tools */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px' }}>Connect Your Tools</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginBottom: '32px' }}>
              Connect your tools to unlock the full dashboard. You can skip and do this later in Settings.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
              {/* Gmail Card */}
              <ConnectCard
                icon="✉️"
                title="Gmail"
                description="Receive and reply to customer emails directly in your inbox."
                connected={gmailConnected}
              >
                {!gmailConnected ? (
                  <>
                    <button onClick={connectGmail} style={btnOutline}>
                      Connect Gmail
                    </button>
                    <SkipLink />
                  </>
                ) : (
                  <ConnectedBadge />
                )}
              </ConnectCard>

              {/* Shopify Card */}
              <ConnectCard
                icon="🛍️"
                title="Shopify"
                description="View orders, process refunds and manage customers without leaving Lynq."
                connected={shopifyConnected}
              >
                {!shopifyConnected ? (
                  <>
                    <input
                      value={shopifyStore}
                      onChange={e => setShopifyStore(e.target.value)}
                      placeholder="yourstore"
                      style={{ marginBottom: '8px' }}
                    />
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>
                      Only the store name — not the full URL
                    </div>
                    <button
                      onClick={connectShopify}
                      disabled={!shopifyStore}
                      style={shopifyStore ? btnOutline : btnDisabled}
                    >
                      Connect Shopify
                    </button>
                    <SkipLink />
                  </>
                ) : (
                  <ConnectedBadge />
                )}
              </ConnectCard>

              {/* ParcelPanel Card */}
              <ConnectCard
                icon="📦"
                title="ParcelPanel"
                description="Track shipments and get alerts for failed deliveries and pickup points."
                connected={parcelConnected}
              >
                {!parcelConnected ? (
                  <>
                    <input
                      type="password"
                      value={parcelPanelKey}
                      onChange={e => setParcelPanelKey(e.target.value)}
                      placeholder="API Key"
                      style={{ marginBottom: '10px' }}
                    />
                    <button
                      onClick={connectParcelPanel}
                      disabled={!parcelPanelKey || loading}
                      style={parcelPanelKey ? btnOutline : btnDisabled}
                    >
                      {loading ? 'Connecting...' : 'Connect'}
                    </button>
                    <SkipLink />
                  </>
                ) : (
                  <ConnectedBadge />
                )}
              </ConnectCard>
            </div>

            <button onClick={() => setStep(4)} style={{
              width: '100%', padding: '13px',
              background: '#A175FC', color: '#fff',
              borderRadius: '10px', fontSize: '14px', fontWeight: '600',
            }}>
              Continue →
            </button>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(161,117,252,0.15)',
              border: '2px solid #A175FC',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '32px', margin: '0 auto 24px',
            }}>
              ✓
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '12px' }}>
              You're all set!
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', marginBottom: '40px', lineHeight: '1.6' }}>
              Your dashboard is ready.<br />
              Start by checking your inbox.
            </p>
            <button onClick={completeOnboarding} style={{
              background: '#A175FC', color: '#fff', borderRadius: '10px',
              padding: '14px 40px', fontSize: '15px', fontWeight: '600',
              marginBottom: '16px', width: '100%',
            }}>
              Go to Inbox →
            </button>
            <button onClick={completeOnboarding} style={{
              background: 'transparent', color: 'rgba(255,255,255,0.35)',
              fontSize: '13px', padding: '8px',
            }}>
              Complete settings later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Small reusable components
function Label({ children }) {
  return (
    <label style={{
      display: 'block', fontSize: '11px', fontWeight: '600',
      color: 'rgba(255,255,255,0.45)', marginBottom: '6px',
      letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      {children}
    </label>
  )
}

function ConnectCard({ icon, title, description, connected, children }) {
  return (
    <div style={{
      background: '#1C0F36',
      border: `1px solid ${connected ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ fontSize: '24px' }}>{icon}</div>
      <div>
        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.5' }}>{description}</div>
      </div>
      <div>{children}</div>
    </div>
  )
}

function ConnectedBadge() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      color: '#4ade80', fontSize: '13px', fontWeight: '500',
    }}>
      <span style={{
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'rgba(74,222,128,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px',
      }}>✓</span>
      Connected
    </div>
  )
}

function SkipLink() {
  return (
    <div style={{
      textAlign: 'center', marginTop: '8px',
      fontSize: '11px', color: 'rgba(255,255,255,0.25)',
      cursor: 'pointer',
    }}>
      Skip for now
    </div>
  )
}

const btnOutline = {
  width: '100%', padding: '9px',
  background: 'transparent',
  border: '1px solid rgba(161,117,252,0.4)',
  color: '#A175FC', borderRadius: '8px',
  fontSize: '13px', fontWeight: '500',
  cursor: 'pointer',
}

const btnDisabled = {
  width: '100%', padding: '9px',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.2)', borderRadius: '8px',
  fontSize: '13px', cursor: 'not-allowed',
}
