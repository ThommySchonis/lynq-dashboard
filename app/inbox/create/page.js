'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Sidebar from '../../components/Sidebar'

// ─── Macros ───────────────────────────────────────────────────
const NOW = new Date().toISOString()
const FALLBACK_MACROS = [
  { id:'greeting', name:'Greeting',        tags:['support'],   language:'English', usageCount:0, updatedAt:NOW, archived:false, body:'Hi {{name}},\n\nThank you for reaching out! I\'m happy to help you.\n\n' },
  { id:'tracking', name:'Tracking Update', tags:['shipping'],  language:'English', usageCount:0, updatedAt:NOW, archived:false, body:'Hi {{name}},\n\nYour order is on its way! You can track it using the link in your shipping confirmation email.\n\nBest regards,\nCustomer Support' },
  { id:'refund',   name:'Refund',          tags:['refund'],    language:'English', usageCount:0, updatedAt:NOW, archived:false, body:'Hi {{name}},\n\nYour refund has been processed. The amount is typically back in your account within 5–7 business days.\n\nBest regards,\nCustomer Support' },
  { id:'delay',    name:'Delay',           tags:['shipping'],  language:'English', usageCount:0, updatedAt:NOW, archived:false, body:'Hi {{name}},\n\nUnfortunately your order is experiencing a delay. We\'ll keep you updated!\n\nBest regards,\nCustomer Support' },
  { id:'quality',  name:'Quality Issue',   tags:['complaint'], language:'English', usageCount:0, updatedAt:NOW, archived:false, body:'Hi {{name}},\n\nWe\'re sorry to hear that! Could you send us a photo? We\'ll arrange a solution right away.\n\nBest regards,\nCustomer Support' },
  { id:'closing',  name:'Closing',         tags:['support'],   language:'English', usageCount:0, updatedAt:NOW, archived:false, body:'Hi {{name}},\n\nGreat to hear! Have a wonderful day!\n\nBest regards,\nCustomer Support' },
  { id:'notfound', name:'Order Not Found', tags:['order'],     language:'English', usageCount:0, updatedAt:NOW, archived:false, body:'Hi {{name}},\n\nI\'m unable to find an order linked to this email address. Could you share your order number?\n\nBest regards,\nCustomer Support' },
  { id:'wrongitem',name:'Wrong Item',      tags:['complaint'], language:'English', usageCount:0, updatedAt:NOW, archived:false, body:'Hi {{name}},\n\nWe\'re sorry about that! Please send us a photo and we\'ll sort it out right away.\n\nBest regards,\nCustomer Support' },
]
function loadMacros() {
  try { const s = JSON.parse(localStorage.getItem('lynq_macros') || 'null'); if (s?.length) return s } catch {}
  return FALLBACK_MACROS
}

// ─── Helpers ─────────────────────────────────────────────────
function authFetch(url, opts = {}, token) {
  return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers } })
}
function escapeHtml(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
function normalizeSafeUrl(value, { allowImages = false } = {}) {
  if (typeof window === 'undefined') return ''
  try {
    const url = new URL(String(value || '').trim(), window.location.origin)
    const safe = allowImages ? ['http:', 'https:', 'data:'] : ['http:', 'https:', 'mailto:', 'tel:']
    if (!safe.includes(url.protocol)) return ''
    if (url.protocol === 'data:' && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(String(value))) return ''
    return ['mailto:', 'tel:'].includes(url.protocol) ? url.href : url.toString()
  } catch { return '' }
}
function sanitizeHtml(html = '') {
  if (typeof document === 'undefined') return escapeHtml(html).replace(/\n/g, '<br>')
  const allowed = new Set(['A','B','BR','BLOCKQUOTE','CODE','DIV','EM','I','LI','OL','P','PRE','SPAN','STRONG','U','UL','IMG'])
  const tpl = document.createElement('template')
  tpl.innerHTML = String(html)
  tpl.content.querySelectorAll('script,style,iframe,object,embed,form,meta,link').forEach(n => n.remove())
  tpl.content.querySelectorAll('*').forEach(n => {
    if (!allowed.has(n.tagName)) { n.replaceWith(...n.childNodes); return }
    ;[...n.attributes].forEach(a => { const nm = a.name.toLowerCase(); if (nm.startsWith('on') || nm === 'style') n.removeAttribute(a.name) })
    if (n.tagName === 'A') {
      const href = normalizeSafeUrl(n.getAttribute('href'))
      if (href) { n.setAttribute('href', href); n.setAttribute('rel', 'noopener noreferrer'); n.setAttribute('target', '_blank') }
      else n.removeAttribute('href')
    } else if (n.tagName === 'IMG') {
      const src = normalizeSafeUrl(n.getAttribute('src'), { allowImages: true })
      if (src) n.setAttribute('src', src); else n.remove()
      n.removeAttribute('srcset')
    } else { ;[...n.attributes].forEach(a => n.removeAttribute(a.name)) }
  })
  return tpl.innerHTML
}
function plainTextToSafeHtml(text = '') { return escapeHtml(text).replace(/\n/g, '<br>') }

// ─── CSS ─────────────────────────────────────────────────────
const CSS = `
  @keyframes spin    { to { transform: rotate(360deg) } }
  @keyframes toastIn { from { opacity:0; transform:translateY(14px) scale(.95) } to { opacity:1; transform:translateY(0) scale(1) } }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }

  .ct-root * { box-sizing:border-box; margin:0; padding:0; }
  .ct-root { font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,'Inter',sans-serif; -webkit-font-smoothing:antialiased; }
  button { border:none; background:none; cursor:pointer; }
  input, textarea, select { font-family:inherit; }

  button:focus-visible, a:focus-visible { outline:2px solid rgba(161,117,252,0.65); outline-offset:2px; border-radius:6px; }
  input:focus-visible, [contenteditable]:focus-visible { outline:none; }

  .compose-ta { width:100%; resize:none; outline:none; font-family:inherit; background:transparent; border:none; padding:14px 16px; font-size:13.5px; color:var(--text-1); line-height:1.78; letter-spacing:.005em; }
  .compose-ta[contenteditable=true]:empty:before { content:attr(data-placeholder); color:var(--text-3); pointer-events:none; display:block; }

  .rtbar-btn { min-width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:7px; cursor:pointer; font-size:12px; font-weight:700; font-family:inherit; color:var(--text-3); transition:all .16s; border:none; background:transparent; padding:0 6px; }
  .rtbar-btn:hover { background:var(--bg-surface-2); color:var(--text-1); }

  .skel { background:linear-gradient(90deg,var(--skeleton-from,rgba(255,255,255,0.04)) 25%,var(--skeleton-to,rgba(255,255,255,0.08)) 50%,var(--skeleton-from,rgba(255,255,255,0.04)) 75%); background-size:400% 100%; animation:shimmer 1.8s linear infinite; border-radius:6px; }

  .macro-dd { position:absolute; bottom:calc(100% + 3px); left:0; right:0; background:var(--bg-surface); border:1px solid var(--border); border-radius:10px; box-shadow:0 -8px 24px rgba(0,0,0,0.1); z-index:60; max-height:220px; overflow-y:auto; padding:4px; animation:fadeUp .14s ease both; }
  .macro-dd-btn { display:block; width:100%; text-align:left; padding:8px 11px; background:none; border:none; cursor:pointer; border-radius:7px; font-family:inherit; transition:background .12s; }
  .macro-dd-btn:hover { background:var(--bg-surface-2); }

  .ct-in-bg {
    background: var(--bg-base, #1C0F36);
  }
`

// ─── Toast ────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [onDone])
  const ok = type === 'success'
  return (
    <div style={{ position:'fixed', bottom:24, right:24, padding:'11px 18px', display:'flex', alignItems:'center', gap:10, background:ok?'rgba(74,222,128,0.1)':'rgba(248,113,133,0.1)', border:`1px solid ${ok?'rgba(74,222,128,0.28)':'rgba(248,113,133,0.28)'}`, borderRadius:11, fontSize:13, fontWeight:500, color:ok?'#4ade80':'#fb7185', zIndex:9999, animation:'toastIn .28s ease both', boxShadow:'0 8px 32px rgba(0,0,0,0.35)' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:ok?'#4ade80':'#fb7185', flexShrink:0, boxShadow:`0 0 8px ${ok?'#4ade80':'#fb7185'}` }} />
      {msg}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function CreateTicketPage() {
  const router = useRouter()

  const [session, setSession]           = useState(null)
  const [emailProvider, setEmailProvider] = useState(null)
  const [connectedEmail, setConnectedEmail] = useState(null)
  const [macros, setMacros]             = useState([])
  const [ready, setReady]               = useState(false)
  const [toast, setToast]               = useState(null)

  // Compose state
  const [to, setTo]                     = useState('')
  const [subject, setSubject]           = useState('')
  const [body, setBody]                 = useState('')
  const [sending, setSending]           = useState(false)
  const [showCC, setShowCC]             = useState(false)
  const [cc, setCC]                     = useState('')
  const [bcc, setBcc]                   = useState('')
  const [tags, setTags]                 = useState([])
  const [tagInput, setTagInput]         = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [macroSearch, setMacroSearch]   = useState('')
  const [showMacroDD, setShowMacroDD]   = useState(false)

  const bodyRef  = useRef(null)
  const macroRef = useRef(null)

  // ── Auth + provider detection ──
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) { window.location.href = '/login'; return }
      setSession(s)

      // Load macros from localStorage or API
      const local = loadMacros()
      setMacros(local)
      authFetch('/api/macros', {}, s.access_token)
        .then(r => r.json())
        .then(d => { if (d.macros?.length) setMacros(d.macros) })
        .catch(() => {})

      // Detect email provider
      try {
        const gmailRes  = await authFetch('/api/gmail/threads', {}, s.access_token)
        const gmailData = await gmailRes.json()
        if (gmailData.connected !== false) {
          setEmailProvider('gmail')
          setConnectedEmail(gmailData.email || null)
          setReady(true); return
        }
      } catch {}
      try {
        const outlookRes  = await authFetch('/api/outlook/threads', {}, s.access_token)
        const outlookData = await outlookRes.json()
        if (outlookData.connected !== false && outlookData.threads?.length) {
          setEmailProvider('outlook')
          setConnectedEmail(outlookData.email || null)
          setReady(true); return
        }
      } catch {}
      try {
        const customRes  = await authFetch('/api/custom-email/threads', {}, s.access_token)
        const customData = await customRes.json()
        if (customData.connected !== false && customData.threads?.length) {
          setEmailProvider('custom')
          setConnectedEmail(customData.email || null)
          setReady(true); return
        }
      } catch {}
      // No provider — still allow composing (demo mode)
      setEmailProvider(null)
      setReady(true)
    })
  }, [])

  useEffect(() => {
    function h(e) { if (e.key === 'Escape') router.push('/inbox') }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [router])

  useEffect(() => {
    if (ready) setTimeout(() => bodyRef.current?.focus(), 150)
  }, [ready])

  // ── Format helpers ──
  function fmt(cmd) { bodyRef.current?.focus(); document.execCommand(cmd, false, null) }
  function insertLink() {
    const raw = prompt('URL:')
    const url = normalizeSafeUrl(raw)
    if (!url) { setToast({ msg: 'Only http, https, or mailto links are allowed', type: 'error' }); return }
    bodyRef.current?.focus()
    document.execCommand('createLink', false, url)
  }

  // ── Macros ──
  const liveMacros = Array.isArray(macros) ? macros.filter(m => !m.archived) : []
  const macroHits  = macroSearch
    ? liveMacros.filter(m => (m.name + m.body + (m.tags || []).join(' ')).toLowerCase().includes(macroSearch.toLowerCase())).slice(0, 8)
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
  async function doSend(andClose = false) {
    if (!to.trim()) { setToast({ msg: 'Please enter a recipient', type: 'error' }); return }
    setSending(true)

    if (!emailProvider) {
      // Demo mode
      await new Promise(r => setTimeout(r, 700))
      setSending(false)
      setToast({ msg: 'Message sent!', type: 'success' })
      setTimeout(() => router.push('/inbox'), 600)
      return
    }

    const safeBody  = sanitizeHtml(bodyRef.current?.innerHTML || '')
    const sendPath  = emailProvider === 'outlook' ? '/api/outlook/send'
                    : emailProvider === 'custom'  ? '/api/custom-email/send'
                    : '/api/gmail/send'

    try {
      const res  = await authFetch(sendPath, {
        method: 'POST',
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          body: safeBody,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
        })
      }, session.access_token)
      const data = await res.json()
      setSending(false)
      if (data.success || data.id) {
        setToast({ msg: 'Message sent!', type: 'success' })
        setTimeout(() => router.push('/inbox'), 600)
      } else {
        setToast({ msg: data.error || 'Failed to send', type: 'error' })
      }
    } catch (err) {
      setSending(false)
      setToast({ msg: 'Failed to send', type: 'error' })
    }
  }

  // ── Loading state ──
  if (!session || !ready) {
    return (
      <div style={{ display:'flex', height:'100vh', background:'var(--bg-base,#1C0F36)' }}>
        <Sidebar />
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.15)', borderTop:'2px solid #A175FC', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div className="ct-root ct-in-bg" style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <style>{CSS}</style>

      <Sidebar />

      {/* ═══ LEFT: narrow placeholder (keeps layout consistent) ═══ */}
      <div style={{ width:308, flexShrink:0, borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', position:'relative', zIndex:1 }}>

        {/* Header */}
        <div style={{ padding:'14px 14px 0', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <span style={{ fontSize:15, fontWeight:700, color:'var(--text-1)', letterSpacing:'-0.01em' }}>Inbox</span>
            <button
              onClick={() => router.push('/inbox')}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:8, background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--text-2)', fontSize:11.5, fontWeight:600, fontFamily:'inherit', transition:'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.color='var(--text-1)'; e.currentTarget.style.borderColor='var(--text-3)' }}
              onMouseLeave={e => { e.currentTarget.style.color='var(--text-2)'; e.currentTarget.style.borderColor='var(--border)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          </div>
        </div>

        {/* Empty inbox list placeholder */}
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'var(--text-3)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:.35 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span style={{ fontSize:11.5, opacity:.5 }}>New ticket</span>
        </div>
      </div>

      {/* ═══ RIGHT: Compose area ═══ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', borderLeft:'1px solid var(--border)', background:'var(--bg-surface)', position:'relative', zIndex:1 }}>

        {/* ── Top bar ── */}
        <div style={{ borderBottom:'1px solid var(--border)', flexShrink:0 }}>

          {/* Row 1: Subject + controls */}
          <div style={{ display:'flex', alignItems:'center', padding:'10px 14px', gap:8 }}>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:14, fontWeight:600, color:'var(--text-1)', fontFamily:'inherit', minWidth:0 }}
            />
            {/* Priority badge */}
            <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:6, border:'1px solid var(--border)', fontSize:11.5, color:'var(--text-2)', cursor:'default', whiteSpace:'nowrap', flexShrink:0 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              normal
            </div>
            {/* Customer search */}
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:8, padding:'5px 10px', width:220, flexShrink:0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Search customers…" style={{ background:'transparent', border:'none', outline:'none', fontSize:11.5, color:'var(--text-1)', fontFamily:'inherit', width:'100%' }} />
            </div>
            {/* Unassigned */}
            <button style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:7, fontSize:11.5, color:'var(--text-2)', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0 }}>
              Unassigned
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {/* Close */}
            <button onClick={() => router.push('/inbox')} style={{ background:'none', border:'none', color:'var(--text-3)', padding:4, display:'flex', flexShrink:0 }} title="Close">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Row 2: Tags + metadata */}
          <div style={{ display:'flex', alignItems:'center', padding:'6px 14px', gap:14, fontSize:12, color:'var(--text-2)', borderTop:'1px solid var(--border)', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              {tags.map(t => (
                <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:4, background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:5, padding:'1px 7px', fontSize:11.5, color:'var(--text-1)' }}>
                  {t}
                  <button onClick={() => setTags(p => p.filter(x => x !== t))} style={{ background:'none', border:'none', color:'var(--text-3)', padding:0, lineHeight:1, display:'flex' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </span>
              ))}
              <button onClick={() => setShowTagInput(v => !v)} style={{ display:'inline-flex', alignItems:'center', gap:3, background:'none', border:'none', color:'var(--accent)', fontSize:11.5, fontFamily:'inherit', padding:0 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add tags
              </button>
              {showTagInput && (
                <input
                  autoFocus
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { setTags(p => [...new Set([...p, tagInput.trim()])]); setTagInput(''); if (e.key === ',') e.preventDefault() }
                    if (e.key === 'Escape') setShowTagInput(false)
                  }}
                  placeholder="tag name…"
                  style={{ background:'transparent', border:'none', borderBottom:'1px solid var(--accent)', outline:'none', fontSize:11.5, color:'var(--text-1)', fontFamily:'inherit', width:84 }}
                />
              )}
            </div>
            <div style={{ width:1, height:13, background:'var(--border)', flexShrink:0 }} />
            <span>Contact reason: <button style={{ color:'var(--accent)', background:'none', border:'none', fontFamily:'inherit', fontSize:12, padding:0 }}>+Add</button></span>
            <div style={{ width:1, height:13, background:'var(--border)', flexShrink:0 }} />
            <span>Product: <button style={{ color:'var(--accent)', background:'none', border:'none', fontFamily:'inherit', fontSize:12, padding:0 }}>+Add</button></span>
            <div style={{ width:1, height:13, background:'var(--border)', flexShrink:0 }} />
            <span>Resolution: <button style={{ color:'var(--accent)', background:'none', border:'none', fontFamily:'inherit', fontSize:12, padding:0 }}>+Add</button></span>
          </div>
        </div>

        {/* ── Empty thread area ── */}
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, color:'var(--text-3)', overflowY:'auto' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:.3 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span style={{ fontSize:12, opacity:.45 }}>Compose your message below</span>
        </div>

        {/* ── Bottom compose section ── */}
        <div style={{ borderTop:'1px solid var(--border)', flexShrink:0 }}>

          {/* To row */}
          <div style={{ display:'flex', alignItems:'center', padding:'8px 14px', borderBottom:'1px solid var(--border)', gap:8 }}>
            <span style={{ fontSize:10.5, fontWeight:700, color:'var(--text-3)', letterSpacing:'.08em', textTransform:'uppercase', width:38, flexShrink:0 }}>To</span>
            <input
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="customer@email.com"
              autoFocus
              style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text-1)', fontFamily:'inherit' }}
            />
            <button
              onClick={() => setShowCC(v => !v)}
              style={{ fontSize:10.5, fontWeight:600, color:showCC?'var(--accent)':'var(--text-3)', background:'none', border:'1px solid var(--border)', borderRadius:5, padding:'2px 9px', fontFamily:'inherit', flexShrink:0, transition:'all .15s' }}
            >
              Cc / Bcc
            </button>
          </div>

          {/* From row */}
          {connectedEmail && (
            <div style={{ display:'flex', alignItems:'center', padding:'8px 14px', borderBottom:'1px solid var(--border)', gap:8 }}>
              <span style={{ fontSize:10.5, fontWeight:700, color:'var(--text-3)', letterSpacing:'.08em', textTransform:'uppercase', width:38, flexShrink:0 }}>From</span>
              <span style={{ fontSize:13, color:'var(--text-2)' }}>{connectedEmail}</span>
            </div>
          )}

          {/* CC + Bcc row */}
          {showCC && (
            <div style={{ display:'flex', alignItems:'center', padding:'8px 14px', borderBottom:'1px solid var(--border)', gap:8, background:'var(--bg-input)' }}>
              <span style={{ fontSize:10.5, fontWeight:700, color:'var(--text-3)', letterSpacing:'.08em', textTransform:'uppercase', width:38, flexShrink:0 }}>CC</span>
              <input value={cc} onChange={e => setCC(e.target.value)} placeholder="cc@email.com" style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text-1)', fontFamily:'inherit' }} />
              <span style={{ fontSize:10.5, fontWeight:700, color:'var(--text-3)', letterSpacing:'.08em', textTransform:'uppercase', width:38, flexShrink:0 }}>BCC</span>
              <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@email.com" style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text-1)', fontFamily:'inherit' }} />
            </div>
          )}

          {/* Macro search row */}
          <div style={{ display:'flex', alignItems:'center', padding:'7px 14px', borderBottom:'1px solid var(--border)', gap:8, position:'relative' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <input
              ref={macroRef}
              value={macroSearch}
              onChange={e => { setMacroSearch(e.target.value); setShowMacroDD(true) }}
              onFocus={() => setShowMacroDD(true)}
              onBlur={() => setTimeout(() => setShowMacroDD(false), 160)}
              placeholder="Search macros by name, tags or body…"
              style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text-1)', fontFamily:'inherit' }}
            />
            {macroSearch && (
              <button onMouseDown={e => { e.preventDefault(); setMacroSearch(''); setShowMacroDD(false) }} style={{ background:'none', border:'none', color:'var(--text-3)', padding:2, display:'flex' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.3"><polyline points="6 9 12 15 18 9"/></svg>
            {showMacroDD && macroHits.length > 0 && (
              <div className="macro-dd">
                {macroHits.map(m => (
                  <button key={m.id} className="macro-dd-btn" onMouseDown={() => applyMacro(m)}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text-1)' }}>{m.name}</div>
                    <div style={{ fontSize:11.5, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>{m.body?.replace(/\n/g, ' ')}</div>
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
            className="compose-ta"
            style={{ minHeight:140, padding:'12px 16px', fontSize:13.5, lineHeight:1.75, overflowY:'auto' }}
          />

          {/* Suggested macros */}
          {!body && suggested.length > 0 && (
            <div style={{ padding:'7px 14px 8px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:500 }}>Suggested macros</span>
              {suggested.map(m => (
                <button
                  key={m.id}
                  onClick={() => applyMacro(m)}
                  style={{ padding:'2px 10px', background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:100, fontSize:11.5, color:'var(--text-1)', fontFamily:'inherit', transition:'border-color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {/* Toolbar + Send buttons */}
          <div style={{ display:'flex', alignItems:'center', padding:'7px 12px', borderTop:'1px solid var(--border)', gap:3 }}>
            {/* Formatting */}
            <button className="rtbar-btn" onMouseDown={e => e.preventDefault()} onClick={() => fmt('bold')} title="Bold" style={{ fontWeight:700, minWidth:26, fontSize:12 }}>B</button>
            <button className="rtbar-btn" onMouseDown={e => e.preventDefault()} onClick={() => fmt('italic')} title="Italic" style={{ fontStyle:'italic', minWidth:26, fontSize:12 }}>I</button>
            <button className="rtbar-btn" onMouseDown={e => e.preventDefault()} onClick={() => fmt('underline')} title="Underline" style={{ textDecoration:'underline', minWidth:26, fontSize:12 }}>U</button>
            <div style={{ width:1, height:14, background:'var(--border)', margin:'0 3px' }} />
            <button className="rtbar-btn" onMouseDown={e => e.preventDefault()} onClick={insertLink} title="Link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </button>
            <button className="rtbar-btn" onMouseDown={e => e.preventDefault()} onClick={() => fmt('insertUnorderedList')} title="Bullet list">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <div style={{ flex:1 }} />

            {/* Send button group */}
            <div style={{ display:'flex', alignItems:'stretch', borderRadius:9, overflow:'hidden', boxShadow:'0 2px 10px rgba(161,117,252,0.35)', flexShrink:0 }}>
              <button
                onClick={() => doSend(false)}
                disabled={sending}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 18px', background:'linear-gradient(135deg,#A175FC 0%,#7B45E8 100%)', color:'#fff', border:'none', cursor:sending?'not-allowed':'pointer', fontSize:12.5, fontWeight:600, fontFamily:'inherit', opacity:sending?0.7:1, transition:'opacity .15s' }}
              >
                {sending
                  ? <><div style={{ width:11, height:11, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Sending…</>
                  : <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      Send
                    </>
                }
              </button>
              <div style={{ width:1, background:'rgba(255,255,255,0.22)', flexShrink:0 }} />
              <button
                onClick={() => doSend(true)}
                disabled={sending}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 18px', background:'linear-gradient(135deg,#A175FC 0%,#7B45E8 100%)', color:'#fff', border:'none', cursor:sending?'not-allowed':'pointer', fontSize:12.5, fontWeight:600, fontFamily:'inherit', opacity:sending?0.7:1, transition:'opacity .15s', whiteSpace:'nowrap' }}
              >
                Send &amp; Close
              </button>
            </div>
          </div>

        </div>
      </div>

      {toast && <Toast key={toast.msg + toast.type} msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
