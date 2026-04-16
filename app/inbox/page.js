'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

const TAG_COLORS = {
  'urgent':     { bg: 'rgba(248,113,113,0.15)', color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  'refund':     { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c', border: 'rgba(251,146,60,0.3)' },
  'tracking':   { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  'wrong item': { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: 'rgba(167,139,250,0.3)' },
  'damaged':    { bg: 'rgba(248,113,113,0.15)', color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  'default':    { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.12)' },
}

function Tag({ label }) {
  const style = TAG_COLORS[label?.toLowerCase()] || TAG_COLORS.default
  return (
    <span style={{
      fontSize: '10px', fontWeight: '600', padding: '2px 7px',
      borderRadius: '4px', letterSpacing: '0.03em',
      background: style.bg, color: style.color, border: `1px solid ${style.border}`,
    }}>{label}</span>
  )
}

function Avatar({ name, size = 32 }) {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const colors = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#7c3aed']
  const color = colors[initials.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: '700', flexShrink: 0,
    }}>{initials}</div>
  )
}

export default function InboxPage() {
  const [session, setSession] = useState(null)
  const [threads, setThreads] = useState([])
  const [activeTab, setActiveTab] = useState('inbox')
  const [selectedThread, setSelectedThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [reply, setReply] = useState('')
  const [replyTab, setReplyTab] = useState('reply')
  const [aiLoading, setAiLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')
  const [gmailConnected, setGmailConnected] = useState(true)
  const [customerData, setCustomerData] = useState(null)
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [rightTab, setRightTab] = useState('info')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setSession(session)
      loadThreads(session.access_token)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function authFetch(url, options = {}, token) {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
  }

  async function loadThreads(token) {
    setLoadingThreads(true)
    const res = await authFetch('/api/gmail/threads', {}, token)
    const data = await res.json()
    if (data.connected === false) { setGmailConnected(false); setLoadingThreads(false); return }
    setThreads(data.threads || [])
    setLoadingThreads(false)
  }

  async function openThread(thread) {
    setSelectedThread(thread)
    setMessages([])
    setReply('')
    setCustomerData(null)
    setLoadingMessages(true)

    const res = await authFetch(`/api/gmail/thread/${thread.id}`, {}, session.access_token)
    const data = await res.json()
    setMessages(data.messages || [])
    setLoadingMessages(false)

    if (thread.unread) {
      await authFetch(`/api/gmail/thread/${thread.id}`, { method: 'PATCH' }, session.access_token)
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread: false } : t))
    }

    // Load Shopify customer
    const email = extractEmail(thread.from)
    if (email) loadCustomer(email, session.access_token)
  }

  async function loadCustomer(email, token) {
    setLoadingCustomer(true)
    const res = await authFetch(`/api/shopify/customer?email=${encodeURIComponent(email)}`, {}, token)
    const data = await res.json()
    setCustomerData(data)
    setLoadingCustomer(false)
  }

  async function handleAiReply() {
    if (!messages.length) return
    setAiLoading(true)
    const res = await authFetch('/api/ai/reply', {
      method: 'POST',
      body: JSON.stringify({ messages, threadId: selectedThread.id }),
    }, session.access_token)
    const data = await res.json()
    if (data.reply) setReply(data.reply)
    else showToast('AI reply failed — try again', 'error')
    setAiLoading(false)
  }

  async function handleSend() {
    if (!reply.trim() || !selectedThread) return
    setSending(true)
    const lastMsg = messages[messages.length - 1]
    const res = await authFetch('/api/gmail/send', {
      method: 'POST',
      body: JSON.stringify({
        to: extractEmail(lastMsg?.from || selectedThread.from),
        subject: `Re: ${selectedThread.subject}`,
        body: reply,
        threadId: selectedThread.id,
        replyToMessageId: lastMsg?.id,
      }),
    }, session.access_token)
    const data = await res.json()
    if (data.success) { showToast('Sent!', 'success'); setReply(''); loadThreads(session.access_token) }
    else showToast(data.error || 'Send failed', 'error')
    setSending(false)
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function extractEmail(str) {
    if (!str) return ''
    const match = str.match(/<(.+?)>/)
    return match ? match[1] : str.trim()
  }

  function extractName(fromStr) {
    if (!fromStr) return 'Unknown'
    const match = fromStr.match(/^([^<]+)/)
    return match ? match[1].trim().replace(/"/g, '') : fromStr
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now - d
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  function formatPrice(price, currency = 'EUR') {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(price)
  }

  const filtered = threads.filter(t =>
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.from?.toLowerCase().includes(search.toLowerCase())
  )

  const tabs = ['Inbox', 'Starred', 'Pending', 'Overdue']

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1C0F36', overflow: 'hidden', fontFamily: 'inherit' }}>
      <Sidebar />

      {/* Thread List */}
      <div style={{ width: '300px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h1 style={{ fontSize: '15px', fontWeight: '700' }}>Inbox</h1>
            <button onClick={() => loadThreads(session?.access_token)} style={{ background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: '15px', padding: '4px', cursor: 'pointer' }} title="Refresh">↻</button>
          </div>

          {/* Search */}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ fontSize: '12px', padding: '7px 12px', marginBottom: '12px' }} />

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {tabs.map(tab => {
              const active = activeTab === tab.toLowerCase()
              return (
                <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())} style={{
                  flex: 1, padding: '8px 4px', background: 'transparent',
                  fontSize: '11px', fontWeight: active ? '600' : '400',
                  color: active ? '#A175FC' : 'rgba(255,255,255,0.35)',
                  borderBottom: active ? '2px solid #A175FC' : '2px solid transparent',
                  cursor: 'pointer', letterSpacing: '0.02em',
                }}>{tab}</button>
              )
            })}
          </div>
        </div>

        {/* Thread items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!gmailConnected && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>✉️</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>Gmail not connected</div>
              <a href="/settings" style={{ padding: '7px 14px', background: '#A175FC', color: '#fff', borderRadius: '8px', fontSize: '12px', textDecoration: 'none', fontWeight: '500' }}>Connect Gmail</a>
            </div>
          )}

          {loadingThreads && <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Loading...</div>}

          {filtered.map(thread => {
            const active = selectedThread?.id === thread.id
            const name = extractName(thread.from)
            return (
              <div key={thread.id} onClick={() => openThread(thread)} style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                background: active ? 'rgba(161,117,252,0.08)' : 'transparent',
                borderLeft: active ? '2px solid #A175FC' : '2px solid transparent',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Avatar name={name} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: thread.unread ? '700' : '500', color: thread.unread ? '#fff' : 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                        {name}
                      </span>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginLeft: '4px' }}>
                        {formatDate(thread.date)}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: thread.unread ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.4)', fontWeight: thread.unread ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '5px' }}>
                      {thread.subject}
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>
                      {thread.snippet}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {thread.unread && <Tag label="New" />}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Thread View */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!selectedThread ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>✉️</div>
            <div style={{ fontSize: '13px' }}>Select an email to read</div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px' }}>{selectedThread.subject}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                  {extractName(selectedThread.from)} · {selectedThread.messageCount} message{selectedThread.messageCount !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <ActionBtn label="Resolve" color="#4ade80" />
                <ActionBtn label="Pending" color="#fb923c" />
                <ActionBtn label="Assign" color="rgba(255,255,255,0.5)" />
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {loadingMessages && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Loading...</div>}
              {messages.map(msg => {
                const isAgent = msg.from?.toLowerCase().includes(session?.user?.email?.split('@')[0]?.toLowerCase())
                const name = extractName(msg.from)
                return (
                  <div key={msg.id} style={{ marginBottom: '16px', display: 'flex', gap: '10px', flexDirection: isAgent ? 'row-reverse' : 'row' }}>
                    <Avatar name={name} size={28} />
                    <div style={{ maxWidth: '72%' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '4px', textAlign: isAgent ? 'right' : 'left' }}>
                        <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: '500' }}>{name}</span>
                        <span style={{ marginLeft: '6px' }}>{formatDate(msg.date)}</span>
                      </div>
                      <div style={{
                        background: isAgent ? 'rgba(161,117,252,0.12)' : '#241352',
                        border: `1px solid ${isAgent ? 'rgba(161,117,252,0.2)' : 'rgba(255,255,255,0.07)'}`,
                        borderRadius: isAgent ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                        padding: '12px 14px', fontSize: '13px', lineHeight: '1.65',
                        color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.body || msg.snippet}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px 16px', flexShrink: 0 }}>
              {/* Reply / Internal Note tabs */}
              <div style={{ display: 'flex', gap: '0', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['reply', 'note'].map(tab => (
                  <button key={tab} onClick={() => setReplyTab(tab)} style={{
                    padding: '7px 14px', background: 'transparent',
                    fontSize: '12px', fontWeight: replyTab === tab ? '600' : '400',
                    color: replyTab === tab ? '#fff' : 'rgba(255,255,255,0.35)',
                    borderBottom: replyTab === tab ? '2px solid #A175FC' : '2px solid transparent',
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}>
                    {tab === 'reply' ? 'Reply' : 'Internal Note'}
                  </button>
                ))}
              </div>

              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder={replyTab === 'reply' ? 'Write your reply...' : 'Add an internal note (not visible to customer)...'}
                rows={4}
                style={{
                  width: '100%', resize: 'none',
                  background: replyTab === 'note' ? 'rgba(251,191,36,0.05)' : '#241352',
                  border: `1px solid ${replyTab === 'note' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '10px', padding: '12px 14px',
                  fontSize: '13px', color: '#fff', fontFamily: 'inherit',
                  lineHeight: '1.6', marginBottom: '10px',
                }}
              />

              {/* Bottom bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={handleAiReply} disabled={aiLoading} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px',
                  background: 'rgba(161,117,252,0.12)',
                  border: '1px solid rgba(161,117,252,0.25)',
                  color: '#A175FC', borderRadius: '8px',
                  fontSize: '12px', fontWeight: '600',
                  cursor: aiLoading ? 'wait' : 'pointer',
                  opacity: aiLoading ? 0.6 : 1,
                }}>
                  {aiLoading ? '⏳ Generating...' : '✨ AI Reply'}
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleSend} disabled={!reply.trim() || sending} style={{
                    padding: '8px 20px',
                    background: reply.trim() && !sending ? '#A175FC' : 'rgba(161,117,252,0.25)',
                    color: '#fff', borderRadius: '8px',
                    fontSize: '12px', fontWeight: '600',
                    cursor: reply.trim() && !sending ? 'pointer' : 'not-allowed',
                  }}>
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                  <button onClick={async () => { await handleSend() }} disabled={!reply.trim() || sending} style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.5)', borderRadius: '8px',
                    fontSize: '12px', fontWeight: '500',
                    cursor: 'pointer',
                  }}>
                    Send & Close
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Panel — Customer Info */}
      {selectedThread && (
        <div style={{ width: '280px', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
          {/* Customer header */}
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Avatar name={extractName(selectedThread.from)} size={38} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>{extractName(selectedThread.from)}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{extractEmail(selectedThread.from)}</div>
              </div>
            </div>

            {/* Right panel tabs */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {['info', 'shopify'].map(tab => (
                <button key={tab} onClick={() => setRightTab(tab)} style={{
                  flex: 1, padding: '6px', borderRadius: '6px',
                  fontSize: '11px', fontWeight: '500',
                  background: rightTab === tab ? 'rgba(161,117,252,0.15)' : 'rgba(255,255,255,0.05)',
                  color: rightTab === tab ? '#A175FC' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', textTransform: 'capitalize',
                  border: rightTab === tab ? '1px solid rgba(161,117,252,0.2)' : '1px solid transparent',
                }}>{tab}</button>
              ))}
            </div>
          </div>

          {rightTab === 'info' && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <InfoField label="Email" value={extractEmail(selectedThread.from)} />
              {customerData?.customer && (
                <>
                  <InfoField label="Phone" value={customerData.customer.phone || '—'} />
                  <InfoField label="Location" value={[customerData.customer.city, customerData.customer.country].filter(Boolean).join(', ') || '—'} />
                  <InfoField label="Total orders" value={customerData.customer.ordersCount} />
                  <InfoField label="Total spent" value={formatPrice(customerData.customer.totalSpent || 0)} />
                  {customerData.customer.tags && (
                    <InfoField label="Tags" value={customerData.customer.tags || '—'} />
                  )}
                </>
              )}
              {loadingCustomer && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Loading customer...</div>}
            </div>
          )}

          {rightTab === 'shopify' && (
            <div style={{ padding: '12px', flex: 1 }}>
              {!customerData?.customer && !loadingCustomer && (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>No Shopify customer found</div>
                </div>
              )}
              {loadingCustomer && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', padding: '12px 0' }}>Loading orders...</div>}
              {customerData?.orders?.map(order => (
                <div key={order.id} style={{
                  background: '#1a0d30', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px', padding: '12px', marginBottom: '10px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#A175FC' }}>{order.name}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(order.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>

                  {/* Status badges */}
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <StatusBadge status={order.financialStatus} />
                    <StatusBadge status={order.fulfillmentStatus} />
                  </div>

                  {/* Line items */}
                  {order.lineItems?.slice(0, 2).map(item => (
                    <div key={item.id} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.quantity}x {item.title}
                    </div>
                  ))}

                  <div style={{ fontSize: '12px', fontWeight: '600', margin: '6px 0 10px', color: '#fff' }}>
                    {formatPrice(order.totalPrice)}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {['Refund', 'Cancel', 'Duplicate', 'Address'].map(action => (
                      <button key={action} style={{
                        padding: '4px 8px', fontSize: '10px', fontWeight: '500',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.6)', borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(161,117,252,0.15)'; e.currentTarget.style.color = '#A175FC' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
                      >{action}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          padding: '10px 18px',
          background: toast.type === 'success' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
          color: toast.type === 'success' ? '#4ade80' : '#f87171',
          borderRadius: '10px', fontSize: '13px', fontWeight: '500',
          zIndex: 1000,
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>{value}</div>
    </div>
  )
}

function StatusBadge({ status }) {
  if (!status) return null
  const map = {
    paid: { bg: 'rgba(74,222,128,0.12)', color: '#4ade80' },
    fulfilled: { bg: 'rgba(74,222,128,0.12)', color: '#4ade80' },
    unfulfilled: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c' },
    refunded: { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
    cancelled: { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
    pending: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
  }
  const s = map[status?.toLowerCase()] || { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }
  return (
    <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '4px', background: s.bg, color: s.color }}>
      {status}
    </span>
  )
}

function ActionBtn({ label, color }) {
  return (
    <button style={{
      padding: '6px 12px', fontSize: '11px', fontWeight: '500',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      color, borderRadius: '6px', cursor: 'pointer',
    }}>{label}</button>
  )
}
