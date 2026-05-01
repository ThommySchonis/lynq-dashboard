'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import Sidebar from '../../components/Sidebar'

const EASE = [0.16, 1, 0.3, 1]

const CSS = `
  .cert * { box-sizing: border-box; margin: 0; padding: 0; }
  .cert { font-family: 'Switzer', 'Rethink Sans', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
  .cert-scroll::-webkit-scrollbar { width: 3px; }
  .cert-scroll::-webkit-scrollbar-track { background: transparent; }
  .cert-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

  .cert-btn-primary {
    background: linear-gradient(135deg, #8B5CF6, #6366F1); color: #FFFFFF;
    border: none; border-radius: 20px; padding: 10px 22px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
    box-shadow: 0 4px 16px rgba(99,102,241,0.3); display: flex; align-items: center; gap: 8px;
  }
  .cert-btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }

  .cert-btn-secondary {
    background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.09);
    color: #6B7280; border-radius: 20px; padding: 10px 20px; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.15s; font-family: inherit; display: flex; align-items: center; gap: 8px;
  }
  .cert-btn-secondary:hover { background: rgba(0,0,0,0.07); color: #374151; }

  @keyframes cert-spin { to { transform: rotate(360deg); } }

  @media print {
    .cert-no-print { display: none !important; }
    .cert-card { box-shadow: none !important; }
  }
`

function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', minHeight:300 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid rgba(0,0,0,0.08)', borderTop:'3px solid #8B5CF6', borderRadius:'50%', animation:'cert-spin 0.7s linear infinite', margin:'0 auto 12px' }} />
        <div style={{ fontSize:13, color:'#9CA3AF' }}>Loading…</div>
      </div>
    </div>
  )
}

function formatDate(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
}

export default function CertificatePage() {
  const [loading, setLoading]   = useState(true)
  const [cert,    setCert]      = useState(null)
  const [name,    setName]      = useState('')
  const [session, setSession]   = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) { window.location.href = '/login'; return }
      setSession(s)

      const meta = s.user.user_metadata || {}
      const raw  = (s.user.email || '').split('@')[0]
      setName(meta.full_name || meta.name || (raw.charAt(0).toUpperCase() + raw.slice(1)))

      try {
        const { data } = await supabase
          .from('certificates')
          .select('*')
          .eq('user_id', s.user.id)
          .single()
        setCert(data || null)
      } catch (_) { setCert(null) }
      setLoading(false)
    })
  }, [])

  function handleDownload() {
    window.print()
  }

  function handleLinkedIn() {
    const text = encodeURIComponent(`I just earned the Lynq Academy E-commerce CS Mastery certificate! 🎓 #CustomerService #Ecommerce #LynqAcademy`)
    window.open(`https://www.linkedin.com/sharing/share-offsite/?text=${text}`, '_blank')
  }

  if (loading) return (
    <div className="cert" style={{ display:'flex', height:'100vh', background:'#F9F9FB' }}>
      <style>{CSS}</style><Sidebar />
      <div style={{ flex:1 }}><Spinner /></div>
    </div>
  )

  if (!cert) return (
    <div className="cert" style={{ display:'flex', height:'100vh', background:'#F9F9FB' }}>
      <style>{CSS}</style><Sidebar />
      <div className="cert-scroll" style={{ flex:1, overflowY:'auto', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px' }}>
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, ease:EASE }} style={{ maxWidth:480, width:'100%', textAlign:'center' }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#0F0F10', marginBottom:10 }}>Certificate Not Found</h1>
          <p style={{ fontSize:14, color:'#6B7280', lineHeight:1.65, marginBottom:24 }}>You haven't passed the final exam yet. Complete the exam with 80%+ to earn your certificate.</p>
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button className="cert-btn-secondary" onClick={() => window.location.href = '/academy'}>Back to Academy</button>
            <button className="cert-btn-primary" onClick={() => window.location.href = '/academy/final-exam'}>Take Final Exam →</button>
          </div>
        </motion.div>
      </div>
    </div>
  )

  return (
    <div className="cert" style={{ display:'flex', height:'100vh', background:'#F9F9FB' }}>
      <style>{CSS}</style><Sidebar />
      <div className="cert-scroll" style={{ flex:1, overflowY:'auto', padding:'32px 24px' }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>

          {/* Actions bar */}
          <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4, ease:EASE }}
            className="cert-no-print"
            style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28 }}>
            <button className="cert-btn-secondary" onClick={() => window.location.href = '/academy'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back to Academy
            </button>
            <div style={{ display:'flex', gap:8 }}>
              <button className="cert-btn-secondary" onClick={handleLinkedIn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                Share on LinkedIn
              </button>
              <button className="cert-btn-primary" onClick={handleDownload}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download PDF
              </button>
            </div>
          </motion.div>

          {/* Certificate card */}
          <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6, ease:EASE, delay:0.1 }}
            className="cert-card"
            style={{ background:'#FFFFFF', borderRadius:20, border:'1px solid rgba(0,0,0,0.08)', boxShadow:'0 8px 48px rgba(0,0,0,0.08)', overflow:'hidden', position:'relative' }}>

            {/* Top gradient bar */}
            <div style={{ height:6, background:'linear-gradient(90deg,#8B5CF6,#6366F1,#3B82F6)' }} />

            {/* Corner ornaments */}
            <div style={{ position:'absolute', top:20, left:20, width:40, height:40, opacity:0.12 }}>
              <svg viewBox="0 0 40 40" fill="none"><path d="M0 40 L40 0" stroke="#8B5CF6" strokeWidth="1"/><path d="M0 30 L30 0" stroke="#8B5CF6" strokeWidth="1"/><path d="M0 20 L20 0" stroke="#8B5CF6" strokeWidth="1"/></svg>
            </div>
            <div style={{ position:'absolute', top:20, right:20, width:40, height:40, opacity:0.12, transform:'scaleX(-1)' }}>
              <svg viewBox="0 0 40 40" fill="none"><path d="M0 40 L40 0" stroke="#8B5CF6" strokeWidth="1"/><path d="M0 30 L30 0" stroke="#8B5CF6" strokeWidth="1"/><path d="M0 20 L20 0" stroke="#8B5CF6" strokeWidth="1"/></svg>
            </div>
            <div style={{ position:'absolute', bottom:20, left:20, width:40, height:40, opacity:0.12, transform:'scaleY(-1)' }}>
              <svg viewBox="0 0 40 40" fill="none"><path d="M0 40 L40 0" stroke="#8B5CF6" strokeWidth="1"/><path d="M0 30 L30 0" stroke="#8B5CF6" strokeWidth="1"/><path d="M0 20 L20 0" stroke="#8B5CF6" strokeWidth="1"/></svg>
            </div>
            <div style={{ position:'absolute', bottom:20, right:20, width:40, height:40, opacity:0.12, transform:'scale(-1)' }}>
              <svg viewBox="0 0 40 40" fill="none"><path d="M0 40 L40 0" stroke="#8B5CF6" strokeWidth="1"/><path d="M0 30 L30 0" stroke="#8B5CF6" strokeWidth="1"/><path d="M0 20 L20 0" stroke="#8B5CF6" strokeWidth="1"/></svg>
            </div>

            <div style={{ padding:'52px 64px 56px', textAlign:'center', position:'relative' }}>

              {/* Logo / issuer */}
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:'#9CA3AF', marginBottom:32 }}>Lynq &amp; Flow Agency</div>

              {/* Certificate label */}
              <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.12em', color:'#8B5CF6', marginBottom:16 }}>Certificate of Completion</div>

              {/* Divider */}
              <div style={{ width:60, height:2, background:'linear-gradient(90deg,transparent,#8B5CF6,transparent)', margin:'0 auto 28px' }} />

              {/* This certifies text */}
              <p style={{ fontSize:14, color:'#9CA3AF', marginBottom:12, fontStyle:'italic' }}>This certifies that</p>

              {/* Name */}
              <div style={{ fontSize:44, fontWeight:800, color:'#0F0F10', letterSpacing:'-0.025em', lineHeight:1.1, marginBottom:20 }}>{name}</div>

              <p style={{ fontSize:14, color:'#6B7280', marginBottom:10 }}>has successfully completed</p>

              {/* Course name */}
              <div style={{ fontSize:24, fontWeight:700, color:'#0F0F10', letterSpacing:'-0.02em', marginBottom:6 }}>E-commerce CS Mastery</div>
              <div style={{ fontSize:14, color:'#6B7280', marginBottom:32 }}>Lynq Academy · Full Certification Program</div>

              {/* Divider */}
              <div style={{ width:80, height:1, background:'rgba(0,0,0,0.08)', margin:'0 auto 32px' }} />

              {/* Stats row */}
              <div style={{ display:'flex', gap:40, justifyContent:'center', marginBottom:40 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:28, fontWeight:800, color:'#8B5CF6', marginBottom:4 }}>{cert.exam_score}%</div>
                  <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em' }}>Exam Score</div>
                </div>
                <div style={{ width:1, background:'rgba(0,0,0,0.07)' }} />
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:28, fontWeight:800, color:'#10B981', marginBottom:4 }}>{cert.modules_completed || 6}</div>
                  <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em' }}>Modules Completed</div>
                </div>
                <div style={{ width:1, background:'rgba(0,0,0,0.07)' }} />
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:28, fontWeight:800, color:'#6366F1', marginBottom:4 }}>50</div>
                  <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em' }}>Questions Passed</div>
                </div>
              </div>

              {/* Award icon */}
              <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,rgba(139,92,246,0.12),rgba(99,102,241,0.08))', border:'1px solid rgba(139,92,246,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 32px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
              </div>

              {/* Issue date */}
              <div style={{ fontSize:12, color:'#C4C4C4' }}>Issued on {formatDate(cert.issued_at)}</div>
            </div>

            {/* Bottom gradient bar */}
            <div style={{ height:4, background:'linear-gradient(90deg,#8B5CF6,#6366F1,#3B82F6)' }} />
          </motion.div>

          <div style={{ height:40 }} />
        </div>
      </div>
    </div>
  )
}
