'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const TYPING_STRINGS = [
  'Ask anything about your store...',
  'What are my top refunded products?',
  'How many open tickets do I have?',
  'What is my refund rate this week?',
]

const CHIPS = [
  { key: 'refunds',  label: '↩  Top refunded products',  query: 'What are my top refunded products?' },
  { key: 'orders',   label: '◎  Unfulfilled orders',      query: 'Which orders are still unfulfilled?' },
  { key: 'trend',    label: '↗  Refund rate trend',       query: "What is my refund rate trend?" },
  { key: 'tickets',  label: '✦  Open tickets today',      query: 'How many open tickets do I have today?' },
]

const EASE = [0.16, 1, 0.3, 1]

const CSS = `
  @keyframes hueShift {
    0%,100% { filter: hue-rotate(0deg); }
    50%      { filter: hue-rotate(20deg); }
  }
  @keyframes pulseDot {
    0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
    70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
    100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
  }
  @keyframes shimmerBtn {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes borderGlow {
    0%,100% { opacity: 0.4; }
    50%      { opacity: 1; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
  @keyframes dotBounce {
    0%,60%,100% { transform: translateY(0); opacity: .35; }
    30%          { transform: translateY(-5px); opacity: 1; }
  }
  @keyframes msgIn {
    from { opacity:0; transform:translateY(10px) scale(.98); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }

  @media (prefers-reduced-motion:reduce) {
    *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; }
  }

  .hp-root { font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,sans-serif; -webkit-font-smoothing:antialiased; }
  .hp-root * { box-sizing:border-box; margin:0; padding:0; }

  .name-gradient {
    background: linear-gradient(135deg, #A175FC 0%, #818CF8 45%, #60A5FA 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: hueShift 6s ease-in-out infinite;
  }

  .pulse-dot { animation: pulseDot 2s infinite; }

  .send-btn-primary {
    position: relative; overflow: hidden;
    width: 34px; height: 34px; border-radius: 8px;
    background: #111; border: none; color: #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0;
    transition: background 0.18s, transform 0.18s;
  }
  .send-btn-primary::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%);
    background-size: 200% 100%;
    animation: shimmerBtn 2.5s infinite;
    border-radius: inherit;
  }
  .send-btn-primary:hover:not(:disabled) { background: #333; transform: scale(1.06); }
  .send-btn-primary:disabled { opacity: 0.4; cursor: default; }

  .border-glow { animation: borderGlow 3.5s ease-in-out infinite; }

  .chip-btn {
    background: rgba(255,255,255,0.82);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 20px; padding: 6px 14px;
    font-size: 12px; font-weight: 500; color: #555;
    cursor: pointer; font-family: inherit;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    white-space: nowrap;
    transition: color 0.18s, border-color 0.18s, box-shadow 0.18s, transform 0.18s;
  }
  .chip-btn:hover { color: #111; border-color: rgba(161,117,252,0.3); box-shadow: 0 6px 16px rgba(161,117,252,0.12); transform: translateY(-2px); }
  .chip-btn:disabled { opacity: 0.5; cursor: default; transform: none; }

  .float-card {
    background: rgba(255,255,255,0.88);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 12px; padding: 12px 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    min-width: 140px;
  }

  .search-inner {
    position: relative; z-index: 1;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-radius: 12px; padding: 12px 16px;
    display: flex; align-items: center; gap: 10px;
    transition: border-color 0.2s;
  }
  .search-inner input {
    flex: 1; background: transparent; border: none; outline: none;
    font-size: 14px; color: #111; font-family: inherit;
  }
  .search-inner input::placeholder { color: #BDBDBD; }

  .msg-user { background: rgba(161,117,252,0.08); border: 1px solid rgba(161,117,252,0.2); border-radius: 20px 20px 5px 20px; }
  .msg-ai   { background: #F5F5F5; border: 1px solid rgba(0,0,0,0.07); border-radius: 20px 20px 20px 5px; }

  .bottom-box {
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(0,0,0,0.09); border-radius: 22px;
    padding: 18px 18px 18px 22px;
    display: flex; align-items: flex-end; gap: 12px;
    transition: border-color 0.2s;
  }
  .bottom-box:focus-within { border-color: rgba(161,117,252,0.3); }
  .bottom-box textarea {
    flex: 1; background: transparent; border: none; outline: none;
    font-size: 15px; color: #111; font-family: inherit;
    resize: none; max-height: 180px; overflow-y: auto; line-height: 1.65;
  }
  .bottom-box textarea::placeholder { color: #BDBDBD; }

  .chat-scroll::-webkit-scrollbar { width: 3px; }
  .chat-scroll::-webkit-scrollbar-track { background: transparent; }
  .chat-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

  @media (max-width: 1023px) {
    .hp-float { display: none !important; }
    .hp-headline { font-size: 32px !important; }
    .hp-search { width: 90vw !important; }
  }
`

function AnimatedCount({ to, suffix = '' }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const dur = 1500
    let raf
    function tick(now) {
      const p = Math.min((now - start) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(to * ease))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{val}{suffix}</>
}

function TypingDots() {
  return (
    <div style={{ display:'flex', gap:5, alignItems:'center', padding:'3px 0' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'rgba(161,117,252,0.7)', animation:`dotBounce 1.2s ease-in-out ${i*0.18}s infinite` }} />
      ))}
    </div>
  )
}

function ChatMessage({ role, content, isStreaming }) {
  const isUser = role === 'user'
  return (
    <div style={{ display:'flex', justifyContent:isUser?'flex-end':'flex-start', marginBottom:14, animation:'msgIn .3s cubic-bezier(.16,1,.3,1) both' }}>
      {!isUser && (
        <div style={{ width:30, height:30, borderRadius:9, background:'linear-gradient(135deg,#A175FC,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', marginRight:10, marginTop:2, flexShrink:0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
      )}
      <div className={isUser ? 'msg-user' : 'msg-ai'} style={{ maxWidth:'72%', padding:'13px 17px', fontSize:14, lineHeight:1.72, color:'#111', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
        {isStreaming && !content ? <TypingDots /> : content}
        {isStreaming && content && <span style={{ display:'inline-block', width:2, height:14, background:'#A175FC', marginLeft:2, verticalAlign:'text-bottom', animation:'blink 1s ease-in-out infinite' }} />}
      </div>
    </div>
  )
}

export default function HomePage() {
  const [session, setSession]           = useState(null)
  const [userName, setUserName]         = useState('')
  const [messages, setMessages]         = useState([])
  const [input, setInput]               = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [storeContext, setStoreContext]  = useState(null)
  const [contextLoaded, setContextLoaded] = useState(false)
  const [mounted, setMounted]           = useState(false)
  const [placeholder, setPlaceholder]   = useState(TYPING_STRINGS[0])

  const messagesEndRef  = useRef(null)
  const inputRef        = useRef(null)
  const bottomInputRef  = useRef(null)
  const containerRef    = useRef(null)

  const mouseX  = useMotionValue(600)
  const mouseY  = useMotionValue(400)
  const springX = useSpring(mouseX, { stiffness:150, damping:20 })
  const springY = useSpring(mouseY, { stiffness:150, damping:20 })
  const spotlightBg = useMotionTemplate`radial-gradient(400px circle at ${springX}px ${springY}px, rgba(161,117,252,0.06), transparent 60%)`

  const greeting = getGreeting()
  const hasMsg   = messages.length > 0

  // Typing effect
  useEffect(() => {
    if (!mounted) return
    let si = 0, ci = 0, typing = true, timeout
    function tick() {
      const str = TYPING_STRINGS[si]
      if (typing) {
        ci++
        setPlaceholder(str.slice(0, ci))
        if (ci >= str.length) { typing = false; timeout = setTimeout(tick, 2000); return }
        timeout = setTimeout(tick, 60)
      } else {
        ci--
        setPlaceholder(str.slice(0, ci))
        if (ci <= 0) { typing = true; si = (si + 1) % TYPING_STRINGS.length; timeout = setTimeout(tick, 300); return }
        timeout = setTimeout(tick, 30)
      }
    }
    timeout = setTimeout(tick, 1200)
    return () => clearTimeout(timeout)
  }, [mounted])

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setSession(session)
      const meta = session.user.user_metadata || {}
      const raw  = (session.user.email || '').split('@')[0]
      setUserName(meta.full_name || meta.name || (raw.charAt(0).toUpperCase() + raw.slice(1)))
      loadContext(session.access_token)
    })
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  async function loadContext(token) {
    const h = { Authorization:`Bearer ${token}` }
    try {
      const [a, b, c] = await Promise.all([
        fetch('/api/shopify/kpis',    { headers:h }),
        fetch('/api/shopify/orders',  { headers:h }),
        fetch('/api/shopify/refunds', { headers:h }),
      ])
      const kpis            = a.ok ? await a.json() : {}
      const { orders  = [] } = b.ok ? await b.json() : {}
      const { refunds = [] } = c.ok ? await c.json() : {}
      setStoreContext({ kpis, orders, refunds })
    } catch { setStoreContext({}) }
    finally  { setContextLoaded(true) }
  }

  const sendMessage = useCallback(async (text) => {
    const t = text.trim()
    if (!t || isLoading || !session) return
    setInput('')
    setIsLoading(true)
    setMessages(prev => [...prev, { role:'user', content:t }, { role:'assistant', content:'', isStreaming:true }])
    try {
      const history = messages.filter(m => !m.isStreaming).map(m => ({ role:m.role, content:m.content }))
      const res = await fetch('/api/ai/chat', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` },
        body:JSON.stringify({ message:t, history, context:storeContext }),
      })
      if (!res.ok || !res.body) throw new Error()
      const reader = res.body.getReader()
      const dec    = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream:true })
        const snap = acc
        setMessages(prev => { const u=[...prev]; u[u.length-1]={ role:'assistant', content:snap, isStreaming:true }; return u })
      }
      setMessages(prev => { const u=[...prev]; u[u.length-1]={ role:'assistant', content:acc, isStreaming:false }; return u })
    } catch {
      setMessages(prev => { const u=[...prev]; u[u.length-1]={ role:'assistant', content:'Something went wrong. Please try again.', isStreaming:false }; return u })
    } finally {
      setIsLoading(false)
      setTimeout(() => bottomInputRef.current?.focus(), 60)
    }
  }, [isLoading, session, storeContext, messages])

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  function onMouseMove(e) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) { mouseX.set(e.clientX - rect.left); mouseY.set(e.clientY - rect.top) }
  }

  if (!mounted) return null

  return (
    <div className="hp-root" style={{ display:'flex', minHeight:'100vh', background:'#fff', overflow:'hidden' }}>
      <style>{CSS}</style>
      <Sidebar />

      <div ref={containerRef} onMouseMove={onMouseMove} style={{ flex:1, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', minHeight:'100vh' }}>

        {/* ── Orbs — direct children so they're never clipped ── */}
        <div aria-hidden style={{ position:'absolute', top:'-200px', right:'-100px', width:'600px', height:'600px', borderRadius:'50%', background:'radial-gradient(circle, rgba(161,117,252,0.35), transparent 70%)', filter:'blur(70px)', zIndex:0, pointerEvents:'none' }} />
        <div aria-hidden style={{ position:'absolute', bottom:'-200px', left:'-100px', width:'550px', height:'550px', borderRadius:'50%', background:'radial-gradient(circle, rgba(96,165,250,0.28), transparent 70%)', filter:'blur(70px)', zIndex:0, pointerEvents:'none' }} />
        <div aria-hidden style={{ position:'absolute', top:'30%', left:'20%', width:'400px', height:'400px', borderRadius:'50%', background:'radial-gradient(circle, rgba(244,114,182,0.2), transparent 70%)', filter:'blur(70px)', zIndex:0, pointerEvents:'none' }} />

        {/* ── Background layers (dot grid, beam, spotlight) ── */}
        <div aria-hidden style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>

          {/* Dot grid */}
          <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle, rgba(0,0,0,0.055) 1px, transparent 1px)', backgroundSize:'28px 28px' }} />
          {/* Dot fade */}
          <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(255,255,255,0) 20%, rgba(255,255,255,0.75) 65%, rgba(255,255,255,0.97) 100%)' }} />

          {/* Top beam */}
          <motion.div animate={{ opacity:[0.5,1,0.5] }} transition={{ duration:8, repeat:Infinity, ease:'easeInOut' }}
            style={{ position:'absolute', top:-80, left:'50%', transform:'translateX(-50%)', width:800, height:350, background:'conic-gradient(from 180deg at 50% 0%, transparent 55deg, rgba(161,117,252,0.07) 110deg, transparent 165deg)', filter:'blur(35px)' }} />

          {/* Spotlight */}
          <motion.div style={{ position:'absolute', inset:0, background:spotlightBg }} />
        </div>

        {/* ── HERO STATE ── */}
        {!hasMsg && (
          <>
            <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', paddingBottom:80, position:'relative', zIndex:1 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>

                {/* Status badge */}
                <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6, delay:0.2, ease:EASE }}
                  style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.85)', border:'1px solid rgba(0,0,0,0.08)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', borderRadius:20, padding:'5px 14px', marginBottom:24 }}>
                  <div className="pulse-dot" style={{ width:7, height:7, borderRadius:'50%', background:'#22C55E', flexShrink:0 }} />
                  <span style={{ fontSize:12, fontWeight:500, color:'#555' }}>{greeting}</span>
                </motion.div>

                {/* Headline */}
                <motion.h1 initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.65, delay:0.3, ease:EASE }}
                  className="hp-headline"
                  style={{ fontSize:'clamp(36px, 5vw, 52px)', fontWeight:800, letterSpacing:'-0.025em', lineHeight:1.05, textAlign:'center', marginBottom:14, color:'#111' }}>
                  Welcome back,{' '}
                  <span style={{ background:'linear-gradient(135deg, #A175FC 0%, #818CF8 45%, #60A5FA 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', display:'inline-block' }}>{userName || 'there'}</span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.65, delay:0.4, ease:EASE }}
                  style={{ fontSize:15, color:'#888', textAlign:'center', lineHeight:1.6, maxWidth:380, marginBottom:32 }}>
                  Your store is running. Ask anything —<br />your AI knows everything.
                </motion.p>

                {/* Search bar */}
                <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.65, delay:0.5, ease:EASE }}
                  className="hp-search"
                  style={{ width:'min(500px, 90%)', marginBottom:18, position:'relative' }}>
                  {/* Animated border glow */}
                  <div className="border-glow" style={{ position:'absolute', inset:-1, borderRadius:13, background:'linear-gradient(135deg, rgba(161,117,252,0.5), rgba(129,140,248,0.35), rgba(96,165,250,0.5))', zIndex:0 }} />
                  <div className="search-inner">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={onKey}
                      placeholder={placeholder}
                      disabled={!contextLoaded || isLoading}
                    />
                    <button className="send-btn-primary" onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading || !contextLoaded} aria-label="Send">
                      {isLoading
                        ? <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                      }
                    </button>
                  </div>
                </motion.div>

                {/* Suggestion chips */}
                <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.65, delay:0.6, ease:EASE }}
                  style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
                  {CHIPS.map((chip, i) => (
                    <motion.button key={chip.key} className="chip-btn"
                      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                      transition={{ delay:0.6 + i*0.06, ease:EASE }}
                      onClick={() => sendMessage(chip.query)}
                      disabled={isLoading}>
                      {chip.label}
                    </motion.button>
                  ))}
                </motion.div>

              </div>
            </div>

            {/* Floating cards */}
            <div className="hp-float" aria-hidden>
              <motion.div className="float-card"
                initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0, y:[0,-8,0] }}
                transition={{ opacity:{ delay:0.7, duration:0.5 }, x:{ delay:0.7, duration:0.5 }, y:{ duration:5, repeat:Infinity, ease:'easeInOut', delay:1 } }}
                style={{ position:'absolute', right:24, top:'22%', zIndex:2 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#BDBDBD', marginBottom:6 }}>Open tickets</div>
                <div style={{ fontSize:20, fontWeight:700, color:'#111', marginBottom:6 }}><AnimatedCount to={12} /></div>
                <span style={{ fontSize:10, fontWeight:600, background:'#FEF2F2', color:'#DC2626', borderRadius:100, padding:'2px 8px' }}>5 urgent</span>
              </motion.div>

              <motion.div className="float-card"
                initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0, y:[0,-6,0] }}
                transition={{ opacity:{ delay:0.9, duration:0.5 }, x:{ delay:0.9, duration:0.5 }, y:{ duration:6.5, repeat:Infinity, ease:'easeInOut', delay:1.2 } }}
                style={{ position:'absolute', right:24, bottom:'22%', zIndex:2 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#BDBDBD', marginBottom:6 }}>Refund rate</div>
                <div style={{ fontSize:20, fontWeight:700, color:'#111', marginBottom:6 }}><AnimatedCount to={3} suffix="%" /></div>
                <span style={{ fontSize:10, fontWeight:600, background:'#FEF9EE', color:'#92400E', borderRadius:100, padding:'2px 8px' }}>↑ this week</span>
              </motion.div>
            </div>

            {/* Bottom notification bar */}
            <motion.div initial={{ opacity:0, y:36 }} animate={{ opacity:1, y:0 }} transition={{ delay:1, duration:0.5, ease:EASE }}
              style={{ position:'absolute', bottom:0, left:0, right:0, height:36, background:'rgba(255,255,255,0.85)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderTop:'1px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', zIndex:3 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div className="pulse-dot" style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E', flexShrink:0 }} />
                <span style={{ fontSize:12, color:'#555' }}>New order <strong style={{ color:'#111', fontWeight:600 }}>€129.00</strong></span>
              </div>
              <span style={{ fontSize:12, color:'#888' }}>New message · <strong style={{ color:'#555', fontWeight:500 }}>Sarah K.</strong></span>
            </motion.div>
          </>
        )}

        {/* ── CONVERSATION STATE ── */}
        {hasMsg && (
          <>
            <div className="chat-scroll" style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 44px 16px', position:'relative', zIndex:1 }}>
              <div style={{ width:'100%', maxWidth:780 }}>
                {messages.map((msg, i) => <ChatMessage key={i} {...msg} />)}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <div style={{ padding:'16px 44px 36px', display:'flex', justifyContent:'center', position:'relative', zIndex:2, background:'linear-gradient(to top, rgba(255,255,255,0.98) 60%, transparent)' }}>
              <div style={{ width:'100%', maxWidth:780 }}>
                <div className="bottom-box">
                  <textarea
                    ref={bottomInputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Ask a follow-up…"
                    disabled={isLoading}
                    rows={1}
                    onInput={e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,180)+'px' }}
                  />
                  <button className="send-btn-primary" style={{ width:38, height:38, borderRadius:10 }} onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} aria-label="Send">
                    {isLoading
                      ? <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                    }
                  </button>
                </div>
                <div style={{ textAlign:'center', marginTop:10, fontSize:11, color:'#BDBDBD', letterSpacing:'.04em' }}>
                  Lynq AI · ↵ Enter to send
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
