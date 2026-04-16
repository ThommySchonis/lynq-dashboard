'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

export default function InboxPage() {
  const [session, setSession] = useState(null)
  const [threads, setThreads] = useState([])
  const [selectedThread, setSelectedThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [reply, setReply] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')
  const [gmailConnected, setGmailConnected] = useState(true)
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
    if (data.connected === false) {
      setGmailConnected(false)
      setLoadingThreads(false)
      return
    }
    setThreads(data.threads || [])
    setLoadingThreads(false)
  }

  async function openThread(thread) {
    setSelectedThread(thread)
    setMessages([])
    setReply('')
    setLoadingMessages(true)

    const res = await authFetch(`/api/gmail/thread/${thread.id}`, {}, session.access_token)
    const data = await res.json()
    setMessages(data.messages || [])
    setLoadingMessages(false)

    // Mark as read
    if (thread.unread) {
      await authFetch(`/api/gmail/thread/${thread.id}`, { method: 'PATCH' }, session.access_token)
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread: false } : t))
    }
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
        to: lastMsg?.from || selectedThread.from,
        subject: `Re: ${selectedThread.subject}`,
        body: reply,
        threadId: selectedThread.id,
        replyToMessageId: lastMsg?.id,
      }),
    }, session.access_token)

    const data = await res.json()
    if (data.success) {
      showToast('Email sent!', 'success')
      setReply('')
      loadThreads(session.access_token)
    } else {
      showToast(data.error || 'Send failed', 'error')
    }
    setSending(false)
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
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

  function extractName(fromStr) {
    if (!fromStr) return 'Unknown'
    const match = fromStr.match(/^([^<]+)/)
    return match ? match[1].trim().replace(/"/g, '') : fromStr
  }

  const filtered = threads.filter(t =>
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.from?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1C0F36', overflow: 'hidden' }}>
      <Sidebar />

      {/* Thread List */}
      <div style={{
        width: '320px',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h1 style={{ fontSize: '16px', fontWeight: '700' }}>Inbox</h1>
            <button
              onClick={() => loadThreads(session?.access_token)}
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: '16px', padding: '4px' }}
              title="Refresh"
            >
              ↻
            </button>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ fontSize: '13px', padding: '8px 12px' }}
          />
        </div>

        {/* Threads */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!gmailConnected && (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>✉️</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
                Gmail not connected yet
              </div>
              <a href="/settings" style={{
                display: 'inline-block', padding: '8px 16px',
                background: '#A175FC', color: '#fff', borderRadius: '8px',
                fontSize: '13px', textDecoration: 'none', fontWeight: '500',
              }}>
                Connect Gmail
              </a>
            </div>
          )}

          {loadingThreads && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
              Loading...
            </div>
          )}

          {!loadingThreads && gmailConnected && filtered.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
              No emails found
            </div>
          )}

          {filtered.map(thread => {
            const active = selectedThread?.id === thread.id
            return (
              <div
                key={thread.id}
                onClick={() => openThread(thread)}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  background: active ? 'rgba(161,117,252,0.1)' : 'transparent',
                  borderLeft: active ? '2px solid #A175FC' : '2px solid transparent',
                  transition: 'all 0.1s ease',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: thread.unread ? '700' : '500',
                    color: thread.unread ? '#fff' : 'rgba(255,255,255,0.7)',
                    maxWidth: '180px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {extractName(thread.from)}
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                    {formatDate(thread.date)}
                  </span>
                </div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: thread.unread ? '600' : '400',
                  color: thread.unread ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
                  marginBottom: '4px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {thread.subject}
                </div>
                <div style={{
                  fontSize: '11px', color: 'rgba(255,255,255,0.3)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {thread.snippet}
                </div>
                {thread.unread && (
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#A175FC', float: 'right', marginTop: '-20px',
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Thread View */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedThread ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.2)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✉️</div>
            <div style={{ fontSize: '14px' }}>Select an email to read</div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                {selectedThread.subject}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                {selectedThread.from} · {selectedThread.messageCount} message{selectedThread.messageCount !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {loadingMessages && (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                  Loading messages...
                </div>
              )}
              {messages.map((msg, i) => {
                const isCustomer = !msg.from?.includes(session?.user?.email?.split('@')[0])
                return (
                  <div key={msg.id} style={{
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isCustomer ? 'flex-start' : 'flex-end',
                  }}>
                    <div style={{
                      fontSize: '11px', color: 'rgba(255,255,255,0.3)',
                      marginBottom: '6px',
                      display: 'flex', gap: '8px',
                    }}>
                      <span style={{ fontWeight: '500', color: 'rgba(255,255,255,0.5)' }}>
                        {extractName(msg.from)}
                      </span>
                      <span>{formatDate(msg.date)}</span>
                    </div>
                    <div style={{
                      maxWidth: '75%',
                      background: isCustomer ? '#241352' : 'rgba(161,117,252,0.12)',
                      border: `1px solid ${isCustomer ? 'rgba(255,255,255,0.07)' : 'rgba(161,117,252,0.2)'}`,
                      borderRadius: isCustomer ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                      padding: '14px 16px',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      color: 'rgba(255,255,255,0.85)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {msg.body || msg.snippet}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              padding: '16px 24px',
              flexShrink: 0,
              background: '#1C0F36',
            }}>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button
                  onClick={handleAiReply}
                  disabled={aiLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px',
                    background: 'rgba(161,117,252,0.15)',
                    border: '1px solid rgba(161,117,252,0.3)',
                    color: '#A175FC', borderRadius: '8px',
                    fontSize: '12px', fontWeight: '600',
                    cursor: aiLoading ? 'not-allowed' : 'pointer',
                    opacity: aiLoading ? 0.6 : 1,
                  }}
                >
                  {aiLoading ? '⏳ Generating...' : '✨ AI Reply'}
                </button>
              </div>

              {/* Textarea */}
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Write a reply..."
                rows={5}
                style={{
                  width: '100%', resize: 'vertical',
                  background: '#241352',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  color: '#fff',
                  fontFamily: 'inherit',
                  lineHeight: '1.6',
                  marginBottom: '10px',
                }}
              />

              {/* Send row */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSend}
                  disabled={!reply.trim() || sending}
                  style={{
                    padding: '9px 24px',
                    background: reply.trim() && !sending ? '#A175FC' : 'rgba(161,117,252,0.3)',
                    color: '#fff', borderRadius: '8px',
                    fontSize: '13px', fontWeight: '600',
                    cursor: reply.trim() && !sending ? 'pointer' : 'not-allowed',
                  }}
                >
                  {sending ? 'Sending...' : 'Send ↑'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          padding: '12px 20px',
          background: toast.type === 'success' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
          color: toast.type === 'success' ? '#4ade80' : '#f87171',
          borderRadius: '10px', fontSize: '13px', fontWeight: '500',
          zIndex: 1000, backdropFilter: 'blur(8px)',
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
