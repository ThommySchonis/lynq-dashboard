'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Sidebar from '../../components/Sidebar'

// ─── Macros ───────────────────────────────────────────────────
const NOW = new Date().toISOString()
const FALLBACK_MACROS = [
  { id:'greeting', name:'Greeting',        tags:['support'],   archived:false, body:'Hi {{name}},\n\nThank you for reaching out! I\'m happy to help you.\n\n' },
  { id:'tracking', name:'Tracking Update', tags:['shipping'],  archived:false, body:'Hi {{name}},\n\nYour order is on its way! You can track it using the link in your shipping confirmation email.\n\nBest regards,\nCustomer Support' },
  { id:'refund',   name:'Refund',          tags:['refund'],    archived:false, body:'Hi {{name}},\n\nYour refund has been processed. The amount is typically back in your account within 5–7 business days.\n\nBest regards,\nCustomer Support' },
  { id:'delay',    name:'Delay',           tags:['shipping'],  archived:false, body:'Hi {{name}},\n\nUnfortunately your order is experiencing a delay. We\'ll keep you updated!\n\nBest regards,\nCustomer Support' },
  { id:'quality',  name:'Quality Issue',   tags:['complaint'], archived:false, body:'Hi {{name}},\n\nWe\'re sorry to hear that! Could you send us a photo? We\'ll arrange a solution right away.\n\nBest regards,\nCustomer Support' },
  { id:'closing',  name:'Closing',         tags:['support'],   archived:false, body:'Hi {{name}},\n\nGreat to hear! Have a wonderful day!\n\nBest regards,\nCustomer Support' },
  { id:'notfound', name:'Order Not Found', tags:['order'],     archived:false, body:'Hi {{name}},\n\nI\'m unable to find an order linked to this email address. Could you share your order number?\n\nBest regards,\nCustomer Support' },
  { id:'wrongitem',name:'Wrong Item',      tags:['complaint'], archived:false, body:'Hi {{name}},\n\nWe\'re sorry about that! Please send us a photo and we\'ll sort it out right away.\n\nBest regards,\nCustomer Support' },
]
function readMacrosFromStorage() {
  try { const s = JSON.parse(localStorage.getItem('lynq_macros') || 'null'); if (s?.length) return s } catch {}
  return FALLBACK_MACROS
}

// ─── Demo recent tickets (left panel) ────────────────────────
const DEMO_RECENT = [
  { id:'r1', from:'Sophie de Vries', subject:'Where is my package?',      time:'2h ago',  status:'open' },
  { id:'r2', from:'Mark Jansen',     subject:'Received wrong product',    time:'5h ago',  status:'open' },
  { id:'r3', from:'Lisa Bakker',     subject:'Refund request #1042',      time:'1d ago',  status:'pending' },
  { id:'r4', from:'Tom Hendricks',   subject:'Re: Delivery time question', time:'2d ago',  status:'resolved' },
]
const STATUS_DOT = { open:'#A175FC', pending:'#fbbf24', resolved:'#4ade80' }

// ─── Helpers ─────────────────────────────────────────────────
function authFetch(url, opts = {}, token) {
  return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers } })
}
function escapeHtml(s = '') {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
function normalizeSafeUrl(value, { allowImages = false } = {}) {
  if (typeof window === 'undefined') return ''
  try {
    const url = new URL(String(value || '').trim(), window.location.origin)
    const safe = allowImages ? ['http:','https:','data:'] : ['http:','https:','mailto:','tel:']
    if (!safe.includes(url.protocol)) return ''
    if (url.protocol === 'data:' && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(String(value))) return ''
    return ['mailto:','tel:'].includes(url.protocol) ? url.href : url.toString()
  } catch { return '' }
}
function sanitizeHtml(html = '') {
  if (typeof document === 'undefined') return escapeHtml(html).replace(/\n/g,'<br>')
  const allowed = new Set(['A','B','BR','BLOCKQUOTE','CODE','DIV','EM','I','LI','OL','P','PRE','SPAN','STRONG','U','UL','IMG'])
  const tpl = document.createElement('template')
  tpl.innerHTML = String(html)
  tpl.content.querySelectorAll('script,style,iframe,object,embed,form,meta,link').forEach(n => n.remove())
  tpl.content.querySelectorAll('*').forEach(n => {
    if (!allowed.has(n.tagName)) { n.replaceWith(...n.childNodes); return }
    ;[...n.attributes].forEach(a => { const nm = a.name.toLowerCase(); if (nm.startsWith('on') || nm === 'style') n.removeAttribute(a.name) })
    if (n.tagName === 'A') {
      const href = normalizeSafeUrl(n.getAttribute('href'))
      if (href) { n.setAttribute('href',href); n.setAttribute('rel','noopener noreferrer'); n.setAttribute('target','_blank') }
      else n.removeAttribute('href')
    } else if (n.tagName === 'IMG') {
      const src = normalizeSafeUrl(n.getAttribute('src'),{allowImages:true})
      if (src) n.setAttribute('src',src); else n.remove()
      n.removeAttribute('srcset')
    } else { ;[...n.attributes].forEach(a => n.removeAttribute(a.name)) }
  })
  return tpl.innerHTML
}
function plainTextToSafeHtml(text = '') { return escapeHtml(text).replace(/\n/g,'<br>') }

// ─── CSS (all dark — hardcoded so it never renders white) ────
const CSS = `
  @keyframes spin    { to { transform:rotate(360deg) } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes toastIn { from{opacity:0;transform:translateY(14px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes auroraA { 0%,100%{transform:translate(0,0) scale(1);opacity:.75} 33%{transform:translate(70px,-90px) scale(1.28);opacity:.9} 66%{transform:translate(-50px,45px) scale(.88);opacity:.6} }
  @keyframes auroraB { 0%,100%{transform:translate(0,0) scale(1);opacity:.65} 40%{transform:translate(-90px,60px) scale(1.22);opacity:.85} 75%{transform:translate(55px,-35px) scale(.82);opacity:.5} }
  @keyframes auroraD { 0%,100%{transform:translate(0,0) scale(1);opacity:.6} 45%{transform:translate(-55px,-50px) scale(1.3);opacity:.8} }

  .ct-wrap *  { box-sizing:border-box; margin:0; padding:0; }
  .ct-wrap    { font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,'Inter',sans-serif; -webkit-font-smoothing:antialiased; }
  button      { border:none; background:none; cursor:pointer; }
  input, textarea, select { font-family:inherit; }

  button:focus-visible { outline:2px solid rgba(161,117,252,0.65); outline-offset:2px; border-radius:6px; }
  input:focus-visible, [contenteditable]:focus-visible { outline:none; }

  /* Aurora blobs */
  .ct-al1 { position:absolute; top:-25%; left:12%; width:1000px; height:900px; border-radius:50%; background:radial-gradient(ellipse,rgba(161,117,252,0.55) 0%,rgba(124,58,237,0.28) 38%,transparent 65%); animation:auroraA 22s ease-in-out infinite; filter:blur(60px); pointer-events:none; }
  .ct-al2 { position:absolute; top:2%; left:3%; width:420px; height:420px; border-radius:50%; background:radial-gradient(ellipse,rgba(139,92,246,0.45) 0%,rgba(109,40,217,0.18) 50%,transparent 72%); animation:auroraD 19s ease-in-out infinite; filter:blur(45px); pointer-events:none; }
  .ct-al3 { position:absolute; bottom:10%; left:30%; width:500px; height:500px; border-radius:50%; background:radial-gradient(ellipse,rgba(107,63,196,0.3) 0%,rgba(75,40,148,0.1) 48%,transparent 70%); animation:auroraB 26s ease-in-out infinite reverse; filter:blur(60px); pointer-events:none; }
  .ct-grid { position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,0.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.016) 1px,transparent 1px); background-size:72px 72px; pointer-events:none; }

  /* Thread rows (left panel) */
  .ct-trow { padding:10px 14px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; align-items:flex-start; gap:9px; transition:background .14s; }
  .ct-trow:hover { background:rgba(255,255,255,0.04); }

  /* Compose editor */
  .ct-body { width:100%; resize:none; outline:none; font-family:inherit; background:transparent; border:none; padding:14px 16px; font-size:13.5px; color:#F8FAFC; line-height:1.78; letter-spacing:.005em; }
  .ct-body[contenteditable=true]:empty:before { content:attr(data-placeholder); color:rgba(248,250,252,0.28); pointer-events:none; display:block; }

  /* Toolbar buttons */
  .ct-rb { min-width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:7px; font-size:12px; font-weight:700; font-family:inherit; color:rgba(248,250,252,0.42); transition:all .15s; border:none; background:transparent; padding:0 6px; }
  .ct-rb:hover { background:rgba(255,255,255,0.07); color:#F8FAFC; }

  /* Macro dropdown */
  .ct-mdd { position:absolute; bottom:calc(100% + 4px); left:0; right:0; background:#1a0b3d; border:1px solid rgba(255,255,255,0.09); border-radius:10px; box-shadow:0 -12px 32px rgba(0,0,0,0.4); z-index:60; max-height:220px; overflow-y:auto; padding:4px; animation:fadeUp .14s ease both; }
  .ct-mb  { display:block; width:100%; text-align:left; padding:8px 11px; background:none; border:none; cursor:pointer; border-radius:7px; font-family:inherit; transition:background .12s; }
  .ct-mb:hover { background:rgba(255,255,255,0.07); }

  /* Toast */
  .ct-toast { position:fixed; bottom:24px; right:24px; padding:11px 18px; display:flex; align-items:center; gap:10px; border-radius:11px; font-size:13px; font-weight:500; z-index:9999; animation:toastIn .28s ease both; box-shadow:0 8px 32px rgba(0,0,0,0.5); }

  /* Scrollbar */
  ::-webkit-scrollbar { width:3px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
`

// ─── Colours (dark, hardcoded) ────────────────────────────────
const C = {
  bg:        '#0A0520',
  panel:     'rgba(10,4,28,0.6)',
  surface:   '#160c35',
  compose:   '#120931',
  row:       '#0f0728',
  input:     'rgba(255,255,255,0.05)',
  border:    'rgba(255,255,255,0.07)',
  borderHov: 'rgba(255,255,255,0.14)',
  t1:        '#F8FAFC',
  t2:        'rgba(248,250,252,0.65)',
  t3:        'rgba(248,250,252,0.36)',
  accent:    '#A175FC',
  accentSoft:'rgba(161,117,252,0.14)',
  accentBord:'rgba(161,117,252,0.25)',
}

// ─── Toast component ──────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3400); return () => clearTimeout(t) }, [onDone])
  const ok = type !== 'error'
  return (
    <div className="ct-toast" style={{ background:ok?'rgba(74,222,128,0.1)':'rgba(248,113,133,0.1)', border:`1px solid ${ok?'rgba(74,222,128,0.28)':'rgba(248,113,133,0.28)'}`, color:ok?'#4ade80':'#fb7185' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:ok?'#4ade80':'#fb7185', flexShrink:0, boxShadow:`0 0 8px ${ok?'#4ade80':'#fb7185'}` }} />
      {msg}
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────
function Avatar({ name='?', size=28 }) {
  const ini = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  const COLS = ['#7c3aed','#a855f7','#059669','#d97706','#0ea5e9','#be185d']
  const col  = COLS[(ini.charCodeAt(0)+(ini.charCodeAt(1)||0))%COLS.length]
  return <div style={{ width:size, height:size, borderRadius:'50%', background:col, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.34, fontWeight:700, flexShrink:0 }}>{ini}</div>
}

// ─── Main page ────────────────────────────────────────────────
export default function CreateTicketPage() {
  const router = useRouter()

  const [session, setSession]             = useState(null)
  const [emailProvider, setEmailProvider] = useState(null)
  const [connectedEmail, setConnectedEmail] = useState(null)
  const [macros, setMacros]               = useState([])
  const [ready, setReady]                 = useState(false)
  const [toast, setToast]                 = useState(null)

  // Compose fields
  const [to, setTo]                 = useState('')
  const [subject, setSubject]       = useState('')
  const [body, setBody]             = useState('')
  const [sending, setSending]       = useState(false)
  const [showCC, setShowCC]         = useState(false)
  const [cc, setCC]                 = useState('')
  const [bcc, setBcc]               = useState('')
  const [tags, setTags]             = useState([])
  const [tagInput, setTagInput]     = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [macroSearch, setMacroSearch]   = useState('')
  const [showMacroDD, setShowMacroDD]   = useState(false)
  const [priority, setPriority]     = useState('normal')

  const bodyRef = useRef(null)

  // ── Auth + provider detection ──
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) { window.location.href = '/login'; return }
      setSession(s)

      const local = readMacrosFromStorage()
      setMacros(local)

      authFetch('/api/macros', {}, s.access_token)
        .then(r => r.json())
        .then(d => { if (d.macros?.length) setMacros(d.macros) })
        .catch(() => {})

      // Detect email provider (try in order)
      const providers = [
        { path:'/api/gmail/threads',        key:'gmail'   },
        { path:'/api/outlook/threads',      key:'outlook' },
        { path:'/api/custom-email/threads', key:'custom'  },
      ]
      for (const p of providers) {
        try {
          const res  = await authFetch(p.path, {}, s.access_token)
          const data = await res.json()
          if (data.connected !== false) {
            setEmailProvider(p.key)
            setConnectedEmail(data.email || null)
            break
          }
        } catch {}
      }
      setReady(true)
    })
  }, [])

  // Esc → back to inbox
  useEffect(() => {
    function h(e) { if (e.key === 'Escape') router.push('/inbox') }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [router])

  // Auto-focus body when ready
  useEffect(() => {
    if (ready) setTimeout(() => bodyRef.current?.focus(), 180)
  }, [ready])

  // ── Rich text helpers ──
  function fmt(cmd) { bodyRef.current?.focus(); document.execCommand(cmd, false, null) }
  function insertLink() {
    const raw = prompt('URL:')
    const url = normalizeSafeUrl(raw)
    if (!url) { setToast({ msg:'Only http, https, or mailto links are allowed', type:'error' }); return }
    bodyRef.current?.focus()
    document.execCommand('createLink', false, url)
  }

  // ── Macros ──
  const liveMacros = Array.isArray(macros) ? macros.filter(m => !m.archived) : []
  const macroHits  = macroSearch
    ? liveMacros.filter(m => (m.name + m.body + (m.tags||[]).join(' ')).toLowerCase().includes(macroSearch.toLowerCase())).slice(0, 8)
    : []
  const suggested = liveMacros.slice(0, 5)

  function applyMacro(m) {
    if (!bodyRef.current) return
    bodyRef.current.innerHTML = plainTextToSafeHtml(m.body)
    setBody(m.body)
    setMacroSearch(''); setShowMacroDD(false)
    bodyRef.current?.focus()
  }

  // ── Send ──
  async function doSend() {
    if (!to.trim()) { setToast({ msg:'Please enter a recipient email', type:'error' }); return }
    setSending(true)

    if (!emailProvider) {
      await new Promise(r => setTimeout(r, 800))
      setSending(false)
      setToast({ msg:'Message sent!', type:'success' })
      setTimeout(() => router.push('/inbox'), 700)
      return
    }

    const safeBody = sanitizeHtml(bodyRef.current?.innerHTML || '')
    const sendPath = emailProvider === 'outlook' ? '/api/outlook/send'
                   : emailProvider === 'custom'  ? '/api/custom-email/send'
                   : '/api/gmail/send'
    try {
      const res  = await authFetch(sendPath, {
        method:'POST',
        body: JSON.stringify({ to:to.trim(), subject:subject.trim()||'(no subject)', body:safeBody, cc:cc.trim()||undefined, bcc:bcc.trim()||undefined })
      }, session.access_token)
      const data = await res.json()
      setSending(false)
      if (data.success || data.id) {
        setToast({ msg:'Message sent!', type:'success' })
        setTimeout(() => router.push('/inbox'), 700)
      } else {
        setToast({ msg:data.error || 'Failed to send', type:'error' })
      }
    } catch {
      setSending(false)
      setToast({ msg:'Failed to send', type:'error' })
    }
  }

  const PRIORITY_OPTS = ['low','normal','high','urgent']
  const PRIORITY_COLOR = { low:'#94A3B8', normal:C.t3, high:'#fbbf24', urgent:'#f87171' }

  // ── Loading screen ──
  if (!session || !ready) {
    return (
      <div style={{ display:'flex', height:'100vh', background:C.bg }}>
        <Sidebar />
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:20, height:20, border:'2px solid rgba(255,255,255,0.12)', borderTop:'2px solid #A175FC', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div className="ct-wrap" data-theme="dark" style={{ display:'flex', height:'100vh', overflow:'hidden', background:C.bg, position:'relative' }}>
      <style>{CSS}</style>

      {/* ── Aurora background ── */}
      <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
        <div className="ct-al1" />
        <div className="ct-al2" />
        <div className="ct-al3" />
        <div className="ct-grid" />
      </div>

      <Sidebar />

      {/* ═══ LEFT: Recent tickets ═══ */}
      <div style={{ width:308, flexShrink:0, display:'flex', flexDirection:'column', position:'relative', zIndex:1, background:C.panel, backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', borderRight:`1px solid ${C.border}` }}>

        {/* Header */}
        <div style={{ padding:'14px 14px 10px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:15, fontWeight:700, color:C.t1, letterSpacing:'-0.01em' }}>Inbox</span>
              <span style={{ fontSize:10, background:C.accentSoft, color:C.accent, border:`1px solid ${C.accentBord}`, padding:'1px 7px', borderRadius:4, fontWeight:600 }}>New ticket</span>
            </div>
            <button
              onClick={() => router.push('/inbox')}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:7, background:C.input, border:`1px solid ${C.border}`, color:C.t2, fontSize:11.5, fontWeight:600, fontFamily:'inherit', transition:'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = C.t1; e.currentTarget.style.borderColor = C.borderHov }}
              onMouseLeave={e => { e.currentTarget.style.color = C.t2; e.currentTarget.style.borderColor = C.border }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          </div>

          {/* Divider label */}
          <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:C.t3, marginTop:2 }}>Recent tickets</div>
        </div>

        {/* Recent ticket list (demo) */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {DEMO_RECENT.map(t => (
            <div key={t.id} className="ct-trow">
              <Avatar name={t.from} size={28} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginBottom:2 }}>
                  <span style={{ fontSize:11.5, fontWeight:600, color:C.t1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.from}</span>
                  <span style={{ fontSize:10, color:C.t3, flexShrink:0 }}>{t.time}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:STATUS_DOT[t.status]||C.t3, flexShrink:0 }} />
                  <span style={{ fontSize:11, color:C.t2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.subject}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <div style={{ padding:'10px 14px', borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
          <div style={{ fontSize:11, color:C.t3, display:'flex', alignItems:'center', gap:5 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Press Esc to go back to inbox
          </div>
        </div>
      </div>

      {/* ═══ RIGHT: Compose area ═══ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', borderLeft:`1px solid ${C.border}`, background:C.surface, position:'relative', zIndex:1 }}>

        {/* ── Top bar ── */}
        <div style={{ borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>

          {/* Row 1: Subject + controls */}
          <div style={{ display:'flex', alignItems:'center', padding:'10px 16px', gap:8 }}>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:14, fontWeight:600, color:C.t1, fontFamily:'inherit', minWidth:0 }}
            />

            {/* Priority */}
            <div style={{ position:'relative', flexShrink:0 }}>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                style={{ appearance:'none', WebkitAppearance:'none', background:C.input, border:`1px solid ${C.border}`, borderRadius:6, padding:'3px 24px 3px 8px', fontSize:11.5, color:PRIORITY_COLOR[priority], fontFamily:'inherit', cursor:'pointer', outline:'none' }}
              >
                {PRIORITY_OPTS.map(p => <option key={p} value={p} style={{ background:'#1a0b3d', color:C.t1 }}>{p}</option>)}
              </select>
              <svg style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>

            {/* Customer search */}
            <div style={{ display:'flex', alignItems:'center', gap:6, background:C.input, border:`1px solid ${C.border}`, borderRadius:8, padding:'5px 10px', width:210, flexShrink:0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Search customers…" style={{ background:'transparent', border:'none', outline:'none', fontSize:11.5, color:C.t1, fontFamily:'inherit', width:'100%' }} />
            </div>

            {/* Unassigned */}
            <button style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:C.input, border:`1px solid ${C.border}`, borderRadius:7, fontSize:11.5, color:C.t2, fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0, transition:'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHov}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            >
              Unassigned
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>

            {/* Close */}
            <button onClick={() => router.push('/inbox')} style={{ background:'none', border:'none', color:C.t3, padding:4, display:'flex', flexShrink:0, borderRadius:6, transition:'color .15s' }}
              onMouseEnter={e => e.currentTarget.style.color = C.t1}
              onMouseLeave={e => e.currentTarget.style.color = C.t3}
              title="Close (Esc)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Row 2: Tags + metadata */}
          <div style={{ display:'flex', alignItems:'center', padding:'6px 16px', gap:14, fontSize:12, color:C.t2, borderTop:`1px solid ${C.border}`, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              {tags.map(t => (
                <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:4, background:C.accentSoft, border:`1px solid ${C.accentBord}`, borderRadius:5, padding:'1px 8px', fontSize:11.5, color:C.accent }}>
                  {t}
                  <button onClick={() => setTags(p => p.filter(x => x !== t))} style={{ background:'none', border:'none', color:C.t3, padding:0, lineHeight:1, display:'flex' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </span>
              ))}
              <button onClick={() => setShowTagInput(v => !v)} style={{ display:'inline-flex', alignItems:'center', gap:3, background:'none', border:'none', color:C.accent, fontSize:11.5, fontFamily:'inherit', padding:0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add tags
              </button>
              {showTagInput && (
                <input
                  autoFocus
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key==='Enter'||e.key===',') && tagInput.trim()) { setTags(p=>[...new Set([...p,tagInput.trim()])]); setTagInput(''); if(e.key===',') e.preventDefault() }
                    if (e.key==='Escape') setShowTagInput(false)
                  }}
                  placeholder="tag name…"
                  style={{ background:'transparent', border:'none', borderBottom:`1px solid ${C.accent}`, outline:'none', fontSize:11.5, color:C.t1, fontFamily:'inherit', width:84 }}
                />
              )}
            </div>
            <div style={{ width:1, height:13, background:C.border, flexShrink:0 }} />
            <span style={{ color:C.t3 }}>Contact reason: <button style={{ color:C.accent, background:'none', border:'none', fontFamily:'inherit', fontSize:12, padding:0 }}>+Add</button></span>
            <div style={{ width:1, height:13, background:C.border, flexShrink:0 }} />
            <span style={{ color:C.t3 }}>Product: <button style={{ color:C.accent, background:'none', border:'none', fontFamily:'inherit', fontSize:12, padding:0 }}>+Add</button></span>
            <div style={{ width:1, height:13, background:C.border, flexShrink:0 }} />
            <span style={{ color:C.t3 }}>Resolution: <button style={{ color:C.accent, background:'none', border:'none', fontFamily:'inherit', fontSize:12, padding:0 }}>+Add</button></span>
          </div>
        </div>

        {/* ── Empty thread area (visual guide) ── */}
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, overflowY:'auto' }}>
          <div style={{ padding:'14px 20px', borderRadius:14, background:'rgba(161,117,252,0.06)', border:`1px solid rgba(161,117,252,0.14)`, textAlign:'center', maxWidth:360 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A175FC" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:.6, marginBottom:8 }}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            <div style={{ fontSize:13, fontWeight:600, color:C.t1, marginBottom:4 }}>New outgoing email</div>
            <div style={{ fontSize:11.5, color:C.t3, lineHeight:1.6 }}>Fill in the To field, write your message below and press Send. The reply thread will appear here once the customer responds.</div>
          </div>
        </div>

        {/* ── Bottom compose section ── */}
        <div style={{ borderTop:`1px solid ${C.border}`, flexShrink:0, background:C.compose }}>

          {/* To row */}
          <div style={{ display:'flex', alignItems:'center', padding:'9px 16px', borderBottom:`1px solid ${C.border}`, gap:8 }}>
            <span style={{ fontSize:10.5, fontWeight:700, color:C.t3, letterSpacing:'.09em', textTransform:'uppercase', width:40, flexShrink:0 }}>To</span>
            <input
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="customer@email.com"
              style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:C.t1, fontFamily:'inherit' }}
            />
            <button
              onClick={() => setShowCC(v => !v)}
              style={{ fontSize:10.5, fontWeight:600, color:showCC?C.accent:C.t3, background:'none', border:`1px solid ${C.border}`, borderRadius:5, padding:'2px 9px', fontFamily:'inherit', flexShrink:0, transition:'all .15s' }}
            >
              Cc / Bcc
            </button>
          </div>

          {/* From row */}
          {connectedEmail && (
            <div style={{ display:'flex', alignItems:'center', padding:'8px 16px', borderBottom:`1px solid ${C.border}`, gap:8 }}>
              <span style={{ fontSize:10.5, fontWeight:700, color:C.t3, letterSpacing:'.09em', textTransform:'uppercase', width:40, flexShrink:0 }}>From</span>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:C.accentSoft, border:`1px solid ${C.accentBord}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <span style={{ fontSize:13, color:C.t2 }}>{connectedEmail}</span>
              </div>
            </div>
          )}

          {/* Demo mode notice (no email provider) */}
          {!emailProvider && (
            <div style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 16px', borderBottom:`1px solid ${C.border}`, background:'rgba(251,191,36,0.05)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style={{ fontSize:11.5, color:'rgba(251,191,36,0.8)' }}>Demo mode — connect Gmail or Outlook in Settings to send real emails</span>
            </div>
          )}

          {/* CC + Bcc */}
          {showCC && (
            <div style={{ display:'flex', alignItems:'center', padding:'8px 16px', borderBottom:`1px solid ${C.border}`, gap:8, background:C.input }}>
              <span style={{ fontSize:10.5, fontWeight:700, color:C.t3, letterSpacing:'.09em', textTransform:'uppercase', width:40, flexShrink:0 }}>CC</span>
              <input value={cc} onChange={e => setCC(e.target.value)} placeholder="cc@email.com" style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:C.t1, fontFamily:'inherit' }} />
              <span style={{ fontSize:10.5, fontWeight:700, color:C.t3, letterSpacing:'.09em', textTransform:'uppercase', width:40, flexShrink:0 }}>BCC</span>
              <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@email.com" style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:C.t1, fontFamily:'inherit' }} />
            </div>
          )}

          {/* Macro search row */}
          <div style={{ display:'flex', alignItems:'center', padding:'7px 16px', borderBottom:`1px solid ${C.border}`, gap:8, position:'relative' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <input
              value={macroSearch}
              onChange={e => { setMacroSearch(e.target.value); setShowMacroDD(true) }}
              onFocus={() => setShowMacroDD(true)}
              onBlur={() => setTimeout(() => setShowMacroDD(false), 160)}
              placeholder="Search macros by name, tags or body…"
              style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:C.t1, fontFamily:'inherit' }}
            />
            {macroSearch && (
              <button onMouseDown={e => { e.preventDefault(); setMacroSearch(''); setShowMacroDD(false) }} style={{ background:'none', border:'none', color:C.t3, padding:2, display:'flex' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.3"><polyline points="6 9 12 15 18 9"/></svg>
            {showMacroDD && macroHits.length > 0 && (
              <div className="ct-mdd">
                {macroHits.map(m => (
                  <button key={m.id} className="ct-mb" onMouseDown={() => applyMacro(m)}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:C.t1 }}>{m.name}</div>
                    <div style={{ fontSize:11.5, color:C.t2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>{m.body?.replace(/\n/g,' ')}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rich text body */}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Type your message here… or pick a macro above."
            onInput={e => setBody(e.currentTarget.textContent || '')}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) doSend() }}
            className="ct-body"
            style={{ minHeight:130, overflowY:'auto' }}
          />

          {/* Suggested macros */}
          {!body && suggested.length > 0 && (
            <div style={{ padding:'7px 16px 9px', borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style={{ fontSize:11, color:C.t3, fontWeight:500 }}>Suggested macros</span>
              {suggested.map(m => (
                <button
                  key={m.id}
                  onClick={() => applyMacro(m)}
                  style={{ padding:'2px 10px', background:C.input, border:`1px solid ${C.border}`, borderRadius:100, fontSize:11.5, color:C.t1, fontFamily:'inherit', transition:'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.t1 }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {/* Toolbar + Send */}
          <div style={{ display:'flex', alignItems:'center', padding:'8px 12px', borderTop:`1px solid ${C.border}`, gap:2 }}>
            <button className="ct-rb" onMouseDown={e => e.preventDefault()} onClick={() => fmt('bold')} title="Bold" style={{ fontWeight:700, minWidth:26, fontSize:12 }}>B</button>
            <button className="ct-rb" onMouseDown={e => e.preventDefault()} onClick={() => fmt('italic')} title="Italic" style={{ fontStyle:'italic', minWidth:26, fontSize:12 }}>I</button>
            <button className="ct-rb" onMouseDown={e => e.preventDefault()} onClick={() => fmt('underline')} title="Underline" style={{ textDecoration:'underline', minWidth:26, fontSize:12 }}>U</button>
            <div style={{ width:1, height:14, background:C.border, margin:'0 4px' }} />
            <button className="ct-rb" onMouseDown={e => e.preventDefault()} onClick={insertLink} title="Link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </button>
            <button className="ct-rb" onMouseDown={e => e.preventDefault()} onClick={() => fmt('insertUnorderedList')} title="Bullet list">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>

            <div style={{ flex:1 }} />

            {/* Keyboard hint */}
            <span style={{ fontSize:10.5, color:C.t3, marginRight:8 }}>⌘+Enter to send</span>

            {/* Send button group */}
            <div style={{ display:'flex', alignItems:'stretch', borderRadius:9, overflow:'hidden', boxShadow:'0 2px 14px rgba(161,117,252,0.4)', flexShrink:0 }}>
              <button
                onClick={doSend}
                disabled={sending}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 18px', background:'linear-gradient(135deg,#A175FC 0%,#7B45E8 100%)', color:'#fff', border:'none', cursor:sending?'not-allowed':'pointer', fontSize:12.5, fontWeight:600, fontFamily:'inherit', opacity:sending?0.65:1, transition:'opacity .15s' }}
              >
                {sending
                  ? <><div style={{ width:11, height:11, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin .7s linear infinite', flexShrink:0 }} />Sending…</>
                  : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Send</>
                }
              </button>
              <div style={{ width:1, background:'rgba(255,255,255,0.2)', flexShrink:0 }} />
              <button
                onClick={doSend}
                disabled={sending}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 18px', background:'linear-gradient(135deg,#A175FC 0%,#7B45E8 100%)', color:'#fff', border:'none', cursor:sending?'not-allowed':'pointer', fontSize:12.5, fontWeight:600, fontFamily:'inherit', opacity:sending?0.65:1, transition:'opacity .15s', whiteSpace:'nowrap' }}
              >
                Send &amp; Close
              </button>
            </div>
          </div>

        </div>
      </div>

      {toast && <Toast key={toast.msg+toast.type} msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
