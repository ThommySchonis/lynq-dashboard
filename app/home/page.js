'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

const SUGGESTED_QUESTIONS = [
  'What were my top refunded products this month?',
  'How is my revenue trending compared to last month?',
  'Which orders are still unfulfilled?',
  "What's my refund rate this month?",
]

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'rgba(48,136,255,0.6)',
            animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

function ChatMessage({ role, content, isStreaming }) {
  const isUser = role === 'user'

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '16px',
      animation: 'fadeSlideIn 0.25s ease-out',
    }}>
      {!isUser && (
        <div style={{
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3088FF 0%, #FF6B35 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginRight: '10px',
          marginTop: '2px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
      )}

      <div style={{
        maxWidth: '72%',
        padding: isUser ? '10px 16px' : '12px 16px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser
          ? 'rgba(48,136,255,0.2)'
          : 'rgba(255,255,255,0.05)',
        border: isUser
          ? '1px solid rgba(48,136,255,0.3)'
          : '1px solid rgba(255,255,255,0.08)',
        fontSize: '14px',
        lineHeight: '1.65',
        color: isUser ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.85)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {isStreaming && !content ? <TypingDots /> : content}
        {isStreaming && content && (
          <span style={{
            display: 'inline-block',
            width: '2px',
            height: '14px',
            background: '#3088FF',
            marginLeft: '2px',
            verticalAlign: 'text-bottom',
            animation: 'cursorBlink 1s ease-in-out infinite',
          }} />
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  const [session, setSession] = useState(null)
  const [userName, setUserName] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [storeContext, setStoreContext] = useState(null)
  const [contextLoaded, setContextLoaded] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const greeting = getGreeting()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.href = '/login'
        return
      }
      setSession(session)
      const email = session.user.email || ''
      const name = email.split('@')[0]
      setUserName(name.charAt(0).toUpperCase() + name.slice(1))
      loadStoreContext(session.access_token)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadStoreContext(token) {
    try {
      const [kpisRes, ordersRes, refundsRes] = await Promise.all([
        fetch('/api/shopify/kpis', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/shopify/orders', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/shopify/refunds', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      const kpis = kpisRes.ok ? (await kpisRes.json()) : {}
      const { orders = [] } = ordersRes.ok ? (await ordersRes.json()) : {}
      const { refunds = [] } = refundsRes.ok ? (await refundsRes.json()) : {}

      setStoreContext({ kpis, orders, refunds })
    } catch {
      setStoreContext({})
    } finally {
      setContextLoaded(true)
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed || isLoading || !session) return

    setInput('')
    setIsLoading(true)

    const userMsg = { role: 'user', content: trimmed }
    const assistantMsg = { role: 'assistant', content: '', isStreaming: true }
    setMessages(prev => [...prev, userMsg, assistantMsg])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: trimmed, context: storeContext }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const current = accumulated
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: current, isStreaming: true }
          return updated
        })
      }

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: accumulated, isStreaming: false }
        return updated
      })
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          isStreaming: false,
        }
        return updated
      })
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 0.8; }
        }
        .chat-input-wrap:focus-within .chat-input-border {
          border-color: rgba(48,136,255,0.5) !important;
          box-shadow: 0 0 0 3px rgba(48,136,255,0.08) !important;
        }
        .suggestion-chip:hover {
          background: rgba(48,136,255,0.12) !important;
          border-color: rgba(48,136,255,0.3) !important;
          color: rgba(255,255,255,0.85) !important;
        }
        .send-btn:hover:not(:disabled) {
          background: #5AA3FF !important;
          transform: scale(1.05);
        }
        .send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: '#08101F' }}>
        <Sidebar />

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

          {/* Ambient background glows */}
          <div style={{
            position: 'absolute',
            top: '-10%',
            left: '30%',
            width: '600px',
            height: '500px',
            background: 'radial-gradient(ellipse, rgba(48,136,255,0.07) 0%, transparent 65%)',
            pointerEvents: 'none',
            animation: 'glowPulse 6s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '10%',
            right: '10%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(ellipse, rgba(255,107,53,0.04) 0%, transparent 65%)',
            pointerEvents: 'none',
            animation: 'glowPulse 8s ease-in-out 2s infinite',
          }} />

          {/* Chat area */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflowY: 'auto',
            padding: '0 24px',
            position: 'relative',
          }}>

            {/* Hero / empty state */}
            {isEmpty && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                textAlign: 'center',
                maxWidth: '640px',
                padding: '60px 0 32px',
                animation: 'fadeSlideIn 0.4s ease-out',
              }}>
                {/* Greeting pill */}
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.3)',
                  marginBottom: '16px',
                  padding: '5px 14px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '100px',
                  background: 'rgba(255,255,255,0.03)',
                }}>
                  {greeting}
                </div>

                {/* Welcome heading */}
                <h1 style={{
                  fontSize: '38px',
                  fontWeight: '700',
                  lineHeight: '1.15',
                  letterSpacing: '-0.02em',
                  color: '#fff',
                  marginBottom: '14px',
                }}>
                  Welcome back,{' '}
                  <span style={{
                    background: 'linear-gradient(135deg, #3088FF 0%, #FF6B35 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    {userName || 'there'}
                  </span>
                </h1>

                <p style={{
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.4)',
                  lineHeight: '1.6',
                  maxWidth: '420px',
                  marginBottom: '40px',
                }}>
                  {contextLoaded
                    ? 'What would you like to know about your store today?'
                    : 'Loading your store data…'}
                </p>

                {/* KPI quick stats (shown once loaded) */}
                {contextLoaded && storeContext?.kpis?.totalOrders > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '36px',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                  }}>
                    {[
                      { label: 'Orders', value: storeContext.kpis.totalOrders },
                      { label: 'Revenue', value: `€${Number(storeContext.kpis.netRevenue).toLocaleString()}` },
                      { label: 'Refund rate', value: `${storeContext.kpis.refundRate}%` },
                      { label: 'Refunds', value: storeContext.kpis.totalRefunds },
                    ].map(stat => (
                      <div key={stat.label} style={{
                        padding: '10px 18px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '-0.01em' }}>
                          {stat.value}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px', letterSpacing: '0.03em' }}>
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestion chips */}
                {contextLoaded && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    justifyContent: 'center',
                    maxWidth: '560px',
                  }}>
                    {SUGGESTED_QUESTIONS.map(q => (
                      <button
                        key={q}
                        className="suggestion-chip"
                        onClick={() => sendMessage(q)}
                        disabled={isLoading}
                        style={{
                          padding: '8px 14px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '100px',
                          color: 'rgba(255,255,255,0.5)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            {!isEmpty && (
              <div style={{
                width: '100%',
                maxWidth: '720px',
                paddingTop: '40px',
                paddingBottom: '20px',
              }}>
                {messages.map((msg, i) => (
                  <ChatMessage key={i} {...msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Chat input pinned to bottom */}
          <div style={{
            padding: '20px 24px 28px',
            display: 'flex',
            justifyContent: 'center',
            background: 'linear-gradient(to top, #08101F 60%, transparent)',
            position: 'relative',
          }}>
            <div
              className="chat-input-wrap"
              style={{ width: '100%', maxWidth: '720px' }}
            >
              <div
                className="chat-input-border"
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={contextLoaded ? 'Ask anything about your store…' : 'Loading store data…'}
                  disabled={!contextLoaded || isLoading}
                  rows={1}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#fff',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    resize: 'none',
                    fontFamily: 'inherit',
                    padding: 0,
                    maxHeight: '160px',
                    overflowY: 'auto',
                    width: '100%',
                  }}
                  onInput={e => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
                  }}
                />

                <button
                  className="send-btn"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading || !contextLoaded}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#3088FF',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>

              <div style={{
                textAlign: 'center',
                marginTop: '10px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.2)',
                letterSpacing: '0.02em',
              }}>
                Lynq AI · Answers based on your real store data · Press Enter to send
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
