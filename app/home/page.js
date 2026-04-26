'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

const SUGGESTIONS = [
  { icon: '📦', text: 'What were my most refunded products?' },
  { icon: '💰', text: 'What is my revenue this month?' },
  { icon: '⚡', text: 'Which orders are still unfulfilled?' },
  { icon: '📉', text: "What's my refund rate trend?" },
]

const CSS = `
  @keyframes aurora1 {
    0%,100% { transform: translate(0,0) scale(1); opacity:.45; }
    33%      { transform: translate(60px,-80px) scale(1.15); opacity:.65; }
    66%      { transform: translate(-40px,40px) scale(.9); opacity:.35; }
  }
  @keyframes aurora2 {
    0%,100% { transform: translate(0,0) scale(1); opacity:.3; }
    40%      { transform: translate(-80px,60px) scale(1.2); opacity:.5; }
    70%      { transform: translate(50px,-30px) scale(.85); opacity:.25; }
  }
  @keyframes aurora3 {
    0%,100% { transform: translate(0,0) scale(1); opacity:.2; }
    50%      { transform: translate(40px,80px) scale(1.1); opacity:.4; }
  }
  @keyframes revealUp {
    from { opacity:0; transform:translateY(20px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes revealScale {
    from { opacity:0; transform:scale(.94); }
    to   { opacity:1; transform:scale(1); }
  }
  @keyframes msgIn {
    from { opacity:0; transform:translateY(10px) scale(.98); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes dotBounce {
    0%,60%,100% { transform:translateY(0); opacity:.4; }
    30%          { transform:translateY(-5px); opacity:1; }
  }
  @keyframes blink {
    0%,100% { opacity:1; }
    50%      { opacity:0; }
  }
  @keyframes gradientShift {
    0%   { background-position:0% 50%; }
    50%  { background-position:100% 50%; }
    100% { background-position:0% 50%; }
  }
  @keyframes spin {
    to { transform:rotate(360deg); }
  }
  @keyframes shimmer {
    from { background-position:-200% 0; }
    to   { background-position:200% 0; }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }

  .home-root * { box-sizing:border-box; margin:0; padding:0; }

  .home-root {
    font-family:var(--font-rethink), -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing:antialiased;
  }

  /* Animated gradient heading */
  .gradient-name {
    background: linear-gradient(135deg, #60A5FA 0%, #3B82F6 30%, #3088FF 50%, #FF6B35 80%, #FF8C5A 100%);
    background-size:200% 200%;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
    animation:gradientShift 6s ease infinite;
  }

  /* KPI cards */
  .kpi-card {
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:14px;
    padding:16px 20px;
    text-align:center;
    transition:all 0.2s ease;
    cursor:default;
    position:relative;
    overflow:hidden;
  }
  .kpi-card::before {
    content:'';
    position:absolute;
    inset:0;
    background:linear-gradient(135deg,rgba(48,136,255,0.06),transparent 60%);
    opacity:0;
    transition:opacity 0.3s ease;
  }
  .kpi-card:hover::before { opacity:1; }
  .kpi-card:hover {
    border-color:rgba(48,136,255,0.25);
    transform:translateY(-2px);
    box-shadow:0 8px 32px rgba(48,136,255,0.08);
  }

  /* Suggestion chips */
  .suggestion-chip {
    display:flex;
    align-items:center;
    gap:8px;
    padding:10px 16px;
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.09);
    border-radius:12px;
    color:rgba(248,250,252,0.6);
    font-size:13px;
    font-family:inherit;
    cursor:pointer;
    transition:all 0.2s ease;
    text-align:left;
    white-space:nowrap;
  }
  .suggestion-chip:hover {
    background:rgba(48,136,255,0.1);
    border-color:rgba(48,136,255,0.3);
    color:#F8FAFC;
    transform:translateY(-1px);
    box-shadow:0 4px 20px rgba(48,136,255,0.1);
  }

  /* Chat input */
  .chat-input-box {
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:18px;
    transition:all 0.25s ease;
    position:relative;
  }
  .chat-input-box:focus-within {
    border-color:rgba(48,136,255,0.45);
    background:rgba(48,136,255,0.04);
    box-shadow:0 0 0 4px rgba(48,136,255,0.08), 0 8px 40px rgba(48,136,255,0.08);
  }
  .chat-input-box textarea {
    background:transparent;
    border:none;
    outline:none;
    color:#F8FAFC;
    font-size:15px;
    line-height:1.6;
    resize:none;
    font-family:inherit;
    width:100%;
    padding:0;
    max-height:160px;
    overflow-y:auto;
  }
  .chat-input-box textarea::placeholder {
    color:rgba(248,250,252,0.25);
  }

  /* Send button */
  .send-btn {
    width:38px;
    height:38px;
    border-radius:11px;
    background:linear-gradient(135deg,#3088FF,#2060CC);
    border:none;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    flex-shrink:0;
    transition:all 0.2s ease;
    box-shadow:0 4px 12px rgba(48,136,255,0.3);
  }
  .send-btn:hover:not(:disabled) {
    background:linear-gradient(135deg,#5AA3FF,#3088FF);
    box-shadow:0 6px 20px rgba(48,136,255,0.4);
    transform:translateY(-1px) scale(1.05);
  }
  .send-btn:active:not(:disabled) {
    transform:scale(.97);
  }
  .send-btn:disabled {
    opacity:.35;
    cursor:not-allowed;
    box-shadow:none;
  }

  /* Chat message bubbles */
  .msg-user {
    background:linear-gradient(135deg,rgba(48,136,255,0.2),rgba(48,136,255,0.12));
    border:1px solid rgba(48,136,255,0.25);
    border-radius:18px 18px 4px 18px;
    backdrop-filter:blur(8px);
  }
  .msg-ai {
    background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.09);
    border-radius:18px 18px 18px 4px;
    backdrop-filter:blur(8px);
  }

  /* Scrollbar */
  .chat-scroll::-webkit-scrollbar { width:3px; }
  .chat-scroll::-webkit-scrollbar-track { background:transparent; }
  .chat-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }

  /* Sidebar override for premium look */
  .sidebar-premium {
    background:rgba(6,9,26,0.95) !important;
    backdrop-filter:blur(20px) !important;
    -webkit-backdrop-filter:blur(20px) !important;
    border-right:1px solid rgba(255,255,255,0.06) !important;
  }
`

function AuroraBackground() {
  return (
    <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      <div style={{
        position:'absolute', top:'-20%', left:'20%',
        width:'700px', height:'600px', borderRadius:'50%',
        background:'radial-gradient(ellipse,rgba(48,136,255,0.12) 0%,transparent 70%)',
        animation:'aurora1 18s ease-in-out infinite',
        filter:'blur(40px)',
      }}/>
      <div style={{
        position:'absolute', bottom:'0', right:'10%',
        width:'500px', height:'500px', borderRadius:'50%',
        background:'radial-gradient(ellipse,rgba(255,107,53,0.08) 0%,transparent 70%)',
        animation:'aurora2 22s ease-in-out infinite',
        filter:'blur(40px)',
      }}/>
      <div style={{
        position:'absolute', top:'40%', left:'-5%',
        width:'400px', height:'400px', borderRadius:'50%',
        background:'radial-gradient(ellipse,rgba(139,92,246,0.06) 0%,transparent 70%)',
        animation:'aurora3 26s ease-in-out infinite',
        filter:'blur(40px)',
      }}/>
      {/* Subtle grid */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)',
        backgroundSize:'64px 64px',
        maskImage:'radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)',
      }}/>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display:'flex', gap:'5px', alignItems:'center', padding:'6px 2px' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width:'6px', height:'6px', borderRadius:'50%',
          background:'rgba(48,136,255,0.7)',
          animation:`dotBounce 1.2s ease-in-out ${i*0.2}s infinite`,
        }}/>
      ))}
    </div>
  )
}

function LynqIcon() {
  return (
    <div style={{
      width:28, height:28, borderRadius:'8px',
      background:'linear-gradient(135deg,#3088FF 0%,#FF6B35 100%)',
      display:'flex', alignItems:'center', justifyContent:'center',
      flexShrink:0, boxShadow:'0 4px 12px rgba(48,136,255,0.25)',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    </div>
  )
}

function ChatMessage({ role, content, isStreaming, animDelay = 0 }) {
  const isUser = role === 'user'
  return (
    <div style={{
      display:'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom:'12px',
      animation:`msgIn 0.3s ease-out ${animDelay}ms both`,
    }}>
      {!isUser && (
        <div style={{ marginRight:'10px', marginTop:'2px', flexShrink:0 }}>
          <LynqIcon/>
        </div>
      )}
      <div
        className={isUser ? 'msg-user' : 'msg-ai'}
        style={{
          maxWidth:'75%',
          padding:'12px 16px',
          fontSize:'14px',
          lineHeight:'1.7',
          color: isUser ? 'rgba(248,250,252,0.95)' : 'rgba(248,250,252,0.85)',
          whiteSpace:'pre-wrap',
          wordBreak:'break-word',
        }}
      >
        {isStreaming && !content
          ? <TypingIndicator/>
          : content
        }
        {isStreaming && content && (
          <span style={{
            display:'inline-block', width:'2px', height:'14px',
            background:'#3088FF', marginLeft:'2px',
            verticalAlign:'text-bottom',
            animation:'blink 1s ease-in-out infinite',
          }}/>
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  const [session, setSession]         = useState(null)
  const [userName, setUserName]       = useState('')
  const [messages, setMessages]       = useState([])
  const [input, setInput]             = useState('')
  const [isLoading, setIsLoading]     = useState(false)
  const [storeContext, setStoreContext] = useState(null)
  const [contextLoaded, setContextLoaded] = useState(false)
  const [mounted, setMounted]         = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const greeting       = getGreeting()

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setSession(session)
      const email = session.user.email || ''
      const raw   = email.split('@')[0]
      setUserName(raw.charAt(0).toUpperCase() + raw.slice(1))
      loadStoreContext(session.access_token)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages])

  async function loadStoreContext(token) {
    try {
      const headers = { Authorization:`Bearer ${token}` }
      const [kpisRes, ordersRes, refundsRes] = await Promise.all([
        fetch('/api/shopify/kpis',    { headers }),
        fetch('/api/shopify/orders',  { headers }),
        fetch('/api/shopify/refunds', { headers }),
      ])
      const kpis                 = kpisRes.ok    ? await kpisRes.json()    : {}
      const { orders   = [] }    = ordersRes.ok  ? await ordersRes.json()  : {}
      const { refunds  = [] }    = refundsRes.ok ? await refundsRes.json() : {}
      setStoreContext({ kpis, orders, refunds })
    } catch { setStoreContext({}) }
    finally  { setContextLoaded(true) }
  }

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading || !session) return

    setInput('')
    setIsLoading(true)
    const userMsg      = { role:'user',      content:trimmed,  isStreaming:false }
    const assistantMsg = { role:'assistant', content:'',       isStreaming:true  }
    setMessages(prev => [...prev, userMsg, assistantMsg])

    try {
      const res = await fetch('/api/ai/chat', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message:trimmed, context:storeContext }),
      })
      if (!res.ok || !res.body) throw new Error()

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream:true })
        const snapshot = acc
        setMessages(prev => {
          const u = [...prev]
          u[u.length-1] = { role:'assistant', content:snapshot, isStreaming:true }
          return u
        })
      }
      setMessages(prev => {
        const u = [...prev]
        u[u.length-1] = { role:'assistant', content:acc, isStreaming:false }
        return u
      })
    } catch {
      setMessages(prev => {
        const u = [...prev]
        u[u.length-1] = { role:'assistant', content:'Something went wrong. Please try again.', isStreaming:false }
        return u
      })
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isLoading, session, storeContext])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const hasMessages = messages.length > 0
  const kpis = storeContext?.kpis || {}
  const showKpis = contextLoaded && (kpis.totalOrders > 0 || kpis.netRevenue > 0)

  if (!mounted) return null

  return (
    <div className="home-root" style={{ display:'flex', minHeight:'100vh', background:'#06091A' }}>
      <style>{CSS}</style>
      <Sidebar/>

      <div style={{ flex:1, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden', minWidth:0 }}>
        <AuroraBackground/>

        {/* Chat scroll area */}
        <div
          className="chat-scroll"
          style={{
            flex:1,
            overflowY:'auto',
            display:'flex',
            flexDirection:'column',
            alignItems:'center',
            padding:'0 24px',
            position:'relative',
            zIndex:1,
          }}
        >
          {/* ── HERO (empty state) ── */}
          {!hasMessages && (
            <div style={{
              flex:1, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              textAlign:'center', maxWidth:'680px', width:'100%',
              padding:'48px 0 24px',
            }}>

              {/* Greeting badge */}
              <div style={{
                display:'inline-flex', alignItems:'center', gap:'8px',
                padding:'6px 16px', borderRadius:'100px',
                background:'rgba(255,255,255,0.04)',
                border:'1px solid rgba(255,255,255,0.08)',
                marginBottom:'24px',
                animation:'revealUp 0.5s ease-out both',
              }}>
                <div style={{
                  width:'6px', height:'6px', borderRadius:'50%',
                  background:'#4ade80',
                  boxShadow:'0 0 6px #4ade80',
                }}/>
                <span style={{
                  fontSize:'11px', fontWeight:600, letterSpacing:'.1em',
                  textTransform:'uppercase', color:'rgba(248,250,252,0.45)',
                }}>
                  {greeting}
                </span>
              </div>

              {/* Heading */}
              <h1 style={{
                fontSize:'clamp(32px,5vw,52px)', fontWeight:800,
                letterSpacing:'-0.03em', lineHeight:1.1,
                color:'#F8FAFC', marginBottom:'16px',
                animation:'revealUp 0.5s ease-out 0.1s both',
              }}>
                Welcome back,{' '}
                <span className="gradient-name">{userName || 'there'}</span>
              </h1>

              <p style={{
                fontSize:'16px', color:'rgba(248,250,252,0.38)',
                lineHeight:1.7, maxWidth:'400px', marginBottom:'44px',
                animation:'revealUp 0.5s ease-out 0.18s both',
              }}>
                {contextLoaded
                  ? 'Ask anything about your store — revenue, refunds, orders, trends.'
                  : 'Loading your store data…'
                }
              </p>

              {/* KPI cards */}
              {showKpis && (
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'repeat(4,1fr)',
                  gap:'10px',
                  width:'100%',
                  marginBottom:'40px',
                  animation:'revealUp 0.5s ease-out 0.26s both',
                }}>
                  {[
                    { label:'Orders',      value: kpis.totalOrders },
                    { label:'Net Revenue', value: `€${Number(kpis.netRevenue||0).toLocaleString('nl-NL')}` },
                    { label:'Refund Rate', value: `${kpis.refundRate || 0}%` },
                    { label:'Refunds',     value: kpis.totalRefunds },
                  ].map((s,i) => (
                    <div key={s.label} className="kpi-card" style={{ animationDelay:`${0.28+i*0.06}s` }}>
                      <div style={{ fontSize:'22px', fontWeight:700, letterSpacing:'-0.02em', color:'#F8FAFC', marginBottom:'4px' }}>
                        {s.value}
                      </div>
                      <div style={{ fontSize:'11px', color:'rgba(248,250,252,0.35)', letterSpacing:'.04em', textTransform:'uppercase', fontWeight:500 }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestion chips */}
              {contextLoaded && (
                <div style={{
                  display:'flex', flexWrap:'wrap', gap:'8px',
                  justifyContent:'center', maxWidth:'600px',
                  animation:'revealUp 0.5s ease-out 0.36s both',
                }}>
                  {SUGGESTIONS.map(({ icon, text }) => (
                    <button
                      key={text}
                      className="suggestion-chip"
                      onClick={() => sendMessage(text)}
                      disabled={isLoading}
                    >
                      <span style={{ fontSize:'14px' }}>{icon}</span>
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MESSAGES ── */}
          {hasMessages && (
            <div style={{
              width:'100%', maxWidth:'740px',
              paddingTop:'36px', paddingBottom:'16px',
              animation:'fadeIn 0.2s ease-out both',
            }}>
              {messages.map((msg, i) => (
                <ChatMessage key={i} {...msg} animDelay={0}/>
              ))}
              <div ref={messagesEndRef}/>
            </div>
          )}
        </div>

        {/* ── INPUT AREA ── */}
        <div style={{
          padding:'16px 24px 28px',
          display:'flex', justifyContent:'center',
          background:'linear-gradient(to top,#06091A 55%,transparent)',
          position:'relative', zIndex:2,
        }}>
          <div style={{ width:'100%', maxWidth:'740px' }}>

            {/* Input card */}
            <div className="chat-input-box" style={{ padding:'14px 14px 14px 18px', display:'flex', alignItems:'flex-end', gap:'12px' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={contextLoaded ? 'Ask anything about your store…' : 'Loading your store data…'}
                disabled={!contextLoaded || isLoading}
                rows={1}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
                }}
              />
              <button
                className="send-btn"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading || !contextLoaded}
              >
                {isLoading ? (
                  <div style={{
                    width:14, height:14, border:'2px solid rgba(255,255,255,0.3)',
                    borderTop:'2px solid #fff', borderRadius:'50%',
                    animation:'spin 0.7s linear infinite',
                  }}/>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            </div>

            <div style={{
              textAlign:'center', marginTop:'10px',
              fontSize:'11px', color:'rgba(248,250,252,0.18)',
              letterSpacing:'.03em',
            }}>
              Lynq AI · Powered by real store data · ↵ to send
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
