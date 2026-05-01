'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import Sidebar from '../../components/Sidebar'

const EASE = [0.16, 1, 0.3, 1]

const ALL_MODULE_IDS = ['cs-fundamentals','refund-handling','shopify-ops','email-comms','dispute-mgmt','performance-kpis']
const MODULE_LABELS  = {
  'cs-fundamentals':  'CS Fundamentals',
  'refund-handling':  'Refund Handling',
  'shopify-ops':      'Shopify Operations',
  'email-comms':      'Email & Communication',
  'dispute-mgmt':     'Dispute Management',
  'performance-kpis': 'Performance & KPIs',
}

const SECTION_META = [
  { label: 'CS Fundamentals',      color: '#6366F1' },
  { label: 'Refunds & Returns',    color: '#3B82F6' },
  { label: 'Case Studies',         color: '#8B5CF6' },
  { label: 'Shopify & Operations', color: '#10B981' },
  { label: 'Performance & KPIs',   color: '#F59E0B' },
]

// ─── 50 Questions — flat array, section determined by Math.floor(idx/10) ─────
const ALL_Q = [
  // ── Section 0: CS Fundamentals (0-9) ─────────────────────────────────────
  { q: "A customer emails saying their order arrived damaged. What is your FIRST action?",
    opts: ['Issue an immediate refund', 'Apologize, ask for photos and order number', 'Tell them to contact the carrier', 'Ignore and close the ticket'], correct: 1 },
  { q: "What does 'first contact resolution' mean?",
    opts: ['Solving the issue in the first email', 'Responding within one hour', 'Escalating to a manager immediately', 'Closing the ticket after one reply'], correct: 0 },
  { q: "A customer is extremely angry and uses offensive language. What do you do?",
    opts: ['Match their tone', 'Ignore the message', 'Calmly acknowledge frustration, set boundaries, offer solution', 'Immediately refund without investigating'], correct: 2 },
  { q: "What is the ideal response time for email support?",
    opts: ['Same day', 'Within 4 hours', 'Within 24 hours', 'Within 48 hours'], correct: 1 },
  { q: "Which metric measures customer satisfaction after a ticket?",
    opts: ['NPS', 'CSAT', 'AOV', 'CTR'], correct: 1 },
  { q: "A customer asks a question outside your knowledge. What do you do?",
    opts: ['Make up an answer', "Tell them you don't know and close the ticket", 'Escalate or research before responding', 'Copy paste from Google'], correct: 2 },
  { q: "What is the purpose of an internal note in Gorgias?",
    opts: ['To send to the customer', 'To communicate with teammates without the customer seeing', 'To log shipping updates', 'To create refunds'], correct: 1 },
  { q: "A VIP customer complains about a €15 order issue. How do you handle it?",
    opts: ['Same as any other customer', 'Prioritize, offer extra compensation, personal touch', 'Ignore because amount is small', 'Immediately escalate'], correct: 1 },
  { q: "What should every CS reply include?",
    opts: ['Your personal opinion', 'A clear acknowledgment, solution, and next step', 'An apology for everything', 'A discount code'], correct: 1 },
  { q: "What is 'ticket deflection'?",
    opts: ['Closing tickets without solving them', 'Preventing tickets through proactive communication', 'Transferring tickets to other agents', 'Deleting spam tickets'], correct: 1 },

  // ── Section 1: Refunds & Returns (10-19) ─────────────────────────────────
  { q: "A customer wants to return an item after 45 days. Your policy is 30 days. What do you do?",
    opts: ['Deny immediately', 'Approve regardless', 'Assess the situation, consider customer history, escalate if needed', 'Offer store credit automatically'], correct: 2 },
  { q: "What is the difference between a refund and a chargeback?",
    opts: ['No difference', 'A refund is customer-initiated, chargeback is bank-initiated', 'A chargeback is cheaper', 'A refund takes longer'], correct: 1 },
  { q: "Customer received wrong item. What do you offer FIRST?",
    opts: ['Full refund', 'Apology + send correct item + let them keep wrong one', '10% discount', 'Ask them to return wrong item first'], correct: 1 },
  { q: "What refund rate percentage triggers a review with the supplier?",
    opts: ['1%', '3%', '5%', '10%'], correct: 2 },
  { q: "A customer claims non-delivery but tracking shows delivered. What do you do?",
    opts: ['Immediately refund', 'Deny the claim', 'Investigate — check address, ask neighbors, wait 3 days', 'Tell them to contact carrier themselves'], correct: 2 },
  { q: "What documentation should you always request for a damage claim?",
    opts: ['Customer ID', 'Clear photos of damage and packaging', 'Bank statement', 'Original purchase receipt only'], correct: 1 },
  { q: "When should you escalate a refund request?",
    opts: ['Never', 'When amount exceeds your authorization limit', 'For all requests', 'Only for VIP customers'], correct: 1 },
  { q: "What is 'return merchandise authorization' (RMA)?",
    opts: ['A refund method', 'A formal approval process for returns', 'A shipping label', 'A customer satisfaction score'], correct: 1 },
  { q: "Customer wants refund for 'not as described.' You have photos proving it matches. What do you do?",
    opts: ['Deny immediately', 'Share the product photos, offer partial refund as goodwill', 'Full refund no questions', 'Ignore the request'], correct: 1 },
  { q: "What is the most common reason customers request refunds in dropshipping?",
    opts: ['Price too high', 'Long delivery times', 'Poor packaging', 'Wrong payment method'], correct: 1 },

  // ── Section 2: Case Studies (20-29) ──────────────────────────────────────
  { caseTitle: 'The Repeat Returner',
    caseContext: "Emma has ordered 8 times in 6 months and requested 5 refunds. Her latest request is for 'item not as described' for a €49 order.",
    showContext: true,
    q: "What is your first step?",
    opts: ['Approve immediately', 'Check her order history and refund pattern', 'Deny without investigating', 'Escalate to manager immediately'], correct: 1 },
  { caseTitle: 'The Repeat Returner',
    q: "You notice a pattern of abuse. What do you do?",
    opts: ['Accuse her directly', 'Deny all future orders', 'Document the pattern, offer this refund, flag account for review', 'Block her account immediately'], correct: 2 },
  { caseTitle: 'The Repeat Returner',
    q: "How do you word your response to maintain professionalism?",
    opts: ["\"We've noticed you return a lot\"", "\"We're happy to help with this order, and we'll review your account to ensure the best experience going forward\"", '"This is your last refund"', '"We cannot process this request"'], correct: 1 },

  { caseTitle: 'The Chargeback Threat',
    caseContext: "Mark ordered €127 of products. Tracking shows delivered. He threatens chargeback saying he never received it.",
    showContext: true,
    q: "What evidence do you gather?",
    opts: ['Nothing, just refund', 'Tracking confirmation, delivery photo, IP/address match', 'Ask him to prove non-delivery', 'Contact carrier only'], correct: 1 },
  { caseTitle: 'The Chargeback Threat',
    q: "You decide to refund to avoid chargeback. What do you document?",
    opts: ['Nothing', 'Full interaction, decision rationale, amount', 'Only the refund amount', "Customer's name only"], correct: 1 },

  { caseTitle: 'The Product Quality Issue',
    caseContext: "12 customers in one week complain about the same product — stitching comes apart after one wash. Total refund value: €480.",
    showContext: true,
    q: "What is your immediate action?",
    opts: ['Refund all 12 individually and move on', 'Refund all + alert supplier + pause product sales', 'Only refund customers who complain loudly', 'Ignore until more complaints come in'], correct: 1 },
  { caseTitle: 'The Product Quality Issue',
    q: "How do you communicate with the supplier?",
    opts: ['Angry email', 'Formal complaint with all evidence, photos, customer feedback', 'Phone call only', 'Wait for them to contact you'], correct: 1 },
  { caseTitle: 'The Product Quality Issue',
    q: "What should you add to the refund intelligence dashboard?",
    opts: ['Nothing', 'Product flagged, reason: quality, 12 refunds in 7 days', 'Only the total amount', 'Customer names only'], correct: 1 },
  { caseTitle: 'The Product Quality Issue',
    q: "How do you proactively handle customers who bought this product but haven't complained yet?",
    opts: ['Do nothing', 'Send proactive email acknowledging potential issue', 'Remove product silently', 'Wait for them to contact you'], correct: 1 },
  { caseTitle: 'The Product Quality Issue',
    q: "After resolving, what process improvement do you suggest?",
    opts: ['Nothing', "Add quality check step before shipping this supplier's products", 'Stop working with this supplier immediately', 'Hire more CS agents'], correct: 1 },

  // ── Section 3: Shopify & Operations (30-39) ───────────────────────────────
  { q: "Where do you find a customer's order history in Shopify?",
    opts: ['Analytics tab', 'Customers section, search by email', 'Orders tab only', 'Settings'], correct: 1 },
  { q: "What does 'fulfillment status: unfulfilled' mean?",
    opts: ['Order was cancelled', 'Order placed but not yet shipped', 'Order was refunded', 'Order is on hold'], correct: 1 },
  { q: "How do you process a partial refund in Shopify?",
    opts: ['Cancel the order', 'Orders > select order > Refund > enter partial amount', 'Delete the line item', 'Contact Shopify support'], correct: 1 },
  { q: "A customer's tracking link is broken. What do you check first?",
    opts: ['Shopify settings', 'Whether the fulfillment was created correctly with tracking number', 'Carrier website directly', "Customer's browser"], correct: 1 },
  { q: "What is Parcel Panel used for?",
    opts: ['Creating shipping labels', 'Tracking shipments and notifying customers', 'Processing payments', 'Managing inventory'], correct: 1 },
  { q: "How long does a typical dropshipping delivery take?",
    opts: ['1-3 days', '5-7 days', '7-21 days depending on origin', '30+ days always'], correct: 2 },
  { q: "A customer wants to change their shipping address after order placed. What do you do?",
    opts: ['Always possible', 'Check if order is fulfilled yet — if not, contact supplier immediately', 'Never possible', 'Ignore the request'], correct: 1 },
  { q: "What information do you always confirm before escalating an order issue?",
    opts: ["Customer's age", 'Order number, item, shipping address, tracking status', 'Payment method only', 'Delivery date only'], correct: 1 },
  { q: "What does 'on hold' status mean in Gorgias?",
    opts: ['Ticket is closed', 'Ticket is waiting for customer or third party response', 'Ticket is spam', 'Ticket needs immediate action'], correct: 1 },
  { q: "How do you handle a customer who emails in a language you don't speak?",
    opts: ['Ignore the email', 'Use translation tool, respond in their language', 'Reply in English only', 'Close the ticket'], correct: 1 },

  // ── Section 4: Performance & KPIs (40-49) ────────────────────────────────
  { q: "What is a healthy CSAT score?",
    opts: ['Above 50%', 'Above 70%', 'Above 85%', '100% always'], correct: 2 },
  { q: "What does a high 'first response time' indicate?",
    opts: ['Great service', 'Too many tickets or understaffed team', 'Complex tickets', 'Bad customers'], correct: 1 },
  { q: "If your refund rate spikes from 2% to 8% in one week, what do you investigate FIRST?",
    opts: ['Agent performance', 'Whether a specific product is causing issues', 'Customer demographics', 'Shipping carrier'], correct: 1 },
  { q: "What is 'one-touch resolution'?",
    opts: ['Using one hand to type', 'Resolving a ticket in a single response', 'One agent handles all tickets', 'One refund per customer'], correct: 1 },
  { q: "Which metric shows how efficiently your team closes tickets?",
    opts: ['CSAT', 'Close rate', 'Response time', 'Ticket volume'], correct: 1 },
  { q: "A customer hasn't responded in 5 days. What do you do?",
    opts: ['Keep the ticket open indefinitely', 'Send a follow-up, then close if no response in 2 more days', 'Close immediately', 'Escalate to manager'], correct: 1 },
  { q: "What does 'handle time' measure?",
    opts: ['How long to write a reply', 'Total time from ticket open to close', 'How fast you type', 'Shift duration'], correct: 1 },
  { q: "Your team's CSAT drops from 92% to 78% in one month. What is your first step?",
    opts: ['Fire everyone', 'Review low-scoring tickets to identify patterns', 'Add more agents', 'Change the survey questions'], correct: 1 },
  { q: "What is the purpose of weekly performance reports?",
    opts: ['To blame agents for mistakes', 'To identify trends, celebrate wins, address issues proactively', 'To send to customers', 'Required by law'], correct: 1 },
  { q: "A new agent has 60% CSAT after 2 weeks. What do you do?",
    opts: ['Fire them immediately', 'Review their tickets, provide coaching, give 2 more weeks', 'Reduce their ticket load forever', 'Ignore, it will improve automatically'], correct: 1 },
]

// ─── Confetti pieces (pre-computed, stable) ───────────────────────────────────
const CONFETTI_COLORS = ['#8B5CF6','#6366F1','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899']
const CONFETTI = Array.from({ length: 30 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  delay: `${((i * 7) % 30) * 0.1}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 6 + (i % 5),
  duration: `${2.5 + (i % 8) * 0.2}s`,
  rotate: i % 2 === 0 ? 1 : -1,
}))

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  .fe * { box-sizing: border-box; margin: 0; padding: 0; }
  .fe { font-family: 'Switzer', 'Rethink Sans', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }
  .fe-scroll::-webkit-scrollbar { width: 3px; }
  .fe-scroll::-webkit-scrollbar-track { background: transparent; }
  .fe-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

  .fe-option {
    background: #FFFFFF; border: 1px solid rgba(0,0,0,0.09);
    border-radius: 10px; padding: 14px 18px;
    display: flex; align-items: center; gap: 14px;
    cursor: pointer; transition: all 0.15s ease; margin-bottom: 8px;
  }
  .fe-option:hover { background: rgba(139,92,246,0.02); border-color: rgba(139,92,246,0.35); }
  .fe-option.selected { background: rgba(139,92,246,0.06); border-color: #8B5CF6; }

  .fe-radio {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,0.2); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .fe-option:hover .fe-radio { border-color: rgba(139,92,246,0.5); }
  .fe-option.selected .fe-radio { background: #8B5CF6; border-color: #8B5CF6; }

  .fe-btn-primary {
    background: linear-gradient(135deg, #8B5CF6, #6366F1); color: #FFFFFF;
    border: none; border-radius: 20px; padding: 10px 24px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
    box-shadow: 0 4px 16px rgba(99,102,241,0.3);
  }
  .fe-btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .fe-btn-primary:disabled { opacity: 0.35; cursor: not-allowed; transform: none; filter: none; box-shadow: none; }

  .fe-btn-secondary {
    background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.09);
    color: #6B7280; border-radius: 20px; padding: 10px 20px; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .fe-btn-secondary:hover { background: rgba(0,0,0,0.07); color: #374151; }

  .fe-btn-green {
    background: linear-gradient(135deg, #10B981, #059669); color: #FFFFFF;
    border: none; border-radius: 20px; padding: 10px 24px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
    box-shadow: 0 4px 16px rgba(16,185,129,0.3);
  }
  .fe-btn-green:hover { filter: brightness(1.1); transform: translateY(-1px); }

  @keyframes fe-spin { to { transform: rotate(360deg); } }
  @keyframes confettiFall {
    0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh)  rotate(720deg); opacity: 0; }
  }
`

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sectionScore(sIdx, answers) {
  const start = sIdx * 10, end = start + 10
  let correct = 0
  for (let i = start; i < end; i++) {
    if (answers[i] === ALL_Q[i].correct) correct++
  }
  return Math.round((correct / 10) * 100)
}

function totalScore(answers) {
  const scores = [0,1,2,3,4].map(s => sectionScore(s, answers))
  return Math.round(scores.reduce((a,b) => a+b, 0) / 5)
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', minHeight:300 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid rgba(0,0,0,0.08)', borderTop:'3px solid #8B5CF6', borderRadius:'50%', animation:'fe-spin 0.7s linear infinite', margin:'0 auto 12px' }} />
        <div style={{ fontSize:13, color:'#9CA3AF' }}>Loading…</div>
      </div>
    </div>
  )
}

function CheckIcon({ size=14, color='#10B981' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
function XIcon({ size=14, color='#EF4444' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FinalExamPage() {
  const [view,          setView]          = useState('loading')
  const [session,       setSession]       = useState(null)
  const [passedModules, setPassedModules] = useState([])
  const [currentQ,      setCurrentQ]      = useState(0)
  const [answers,       setAnswers]       = useState({})
  const [scores,        setScores]        = useState(null)
  const [saving,        setSaving]        = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) { window.location.href = '/login'; return }
      setSession(s)
      const isAdmin = s.user.email === 'info@lynqagency.com'
      if (isAdmin) { setView('intro'); return }
      try {
        const { data } = await supabase
          .from('exam_submissions').select('module_id, passed').eq('user_id', s.user.id).eq('passed', true)
        const passed = (data || []).map(r => r.module_id).filter(id => ALL_MODULE_IDS.includes(id))
        setPassedModules(passed)
        setView(ALL_MODULE_IDS.every(id => passed.includes(id)) ? 'intro' : 'locked')
      } catch (_) { setView('locked') }
    })
  }, [])

  async function handleSubmit() {
    setSaving(true)
    const sectionScores = [0,1,2,3,4].map(s => sectionScore(s, answers))
    const total = Math.round(sectionScores.reduce((a,b) => a+b, 0) / 5)
    setScores({ sections: sectionScores, total })
    const passed = total >= 80
    try {
      if (session?.user?.id) {
        await supabase.from('exam_submissions').upsert(
          { user_id: session.user.id, module_id: 'final', score: total, passed, completed_at: new Date().toISOString() },
          { onConflict: 'user_id,module_id' }
        )
        if (passed) {
          await supabase.from('certificates').upsert(
            { user_id: session.user.id, issued_at: new Date().toISOString(), exam_score: total, modules_completed: 6 },
            { onConflict: 'user_id' }
          )
        }
      }
    } catch (_) {}
    setSaving(false)
    setView('results')
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (view === 'loading') return (
    <div className="fe" style={{ display:'flex', height:'100vh', background:'#F9F9FB' }}>
      <style>{CSS}</style><Sidebar />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><Spinner /></div>
    </div>
  )

  // ── Locked ────────────────────────────────────────────────────────────────
  if (view === 'locked') return (
    <div className="fe" style={{ display:'flex', height:'100vh', background:'#F9F9FB' }}>
      <style>{CSS}</style><Sidebar />
      <div className="fe-scroll" style={{ flex:1, overflowY:'auto', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px' }}>
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, ease:EASE }} style={{ maxWidth:560, width:'100%' }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h1 style={{ fontSize:28, fontWeight:800, color:'#0F0F10', letterSpacing:'-0.025em', marginBottom:10 }}>Final Exam Locked</h1>
            <p style={{ fontSize:15, color:'#6B7280', lineHeight:1.65, maxWidth:420, margin:'0 auto' }}>Complete all 6 module quizzes with 70%+ before taking the final exam.</p>
          </div>
          <div style={{ background:'#FFFFFF', border:'1px solid rgba(0,0,0,0.07)', borderRadius:14, padding:'20px 24px', marginBottom:24 }}>
            {ALL_MODULE_IDS.map(id => {
              const done = passedModules.includes(id)
              return (
                <div key={id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:done ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.05)', border:`1px solid ${done ? 'rgba(16,185,129,0.3)' : 'rgba(0,0,0,0.1)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {done ? <CheckIcon size={13} /> : <XIcon size={13} color="#D1D5DB" />}
                  </div>
                  <span style={{ fontSize:14, color:done ? '#374151' : '#9CA3AF', fontWeight:done ? 500 : 400 }}>{MODULE_LABELS[id]}</span>
                  <span style={{ marginLeft:'auto', fontSize:11, fontWeight:600, color:done ? '#10B981' : '#D1D5DB' }}>{done ? 'Passed' : 'Not yet'}</span>
                </div>
              )
            })}
          </div>
          <div style={{ textAlign:'center' }}>
            <button className="fe-btn-secondary" onClick={() => window.location.href = '/academy'}>← Return to Academy</button>
          </div>
        </motion.div>
      </div>
    </div>
  )

  // ── Intro ─────────────────────────────────────────────────────────────────
  if (view === 'intro') return (
    <div className="fe" style={{ display:'flex', height:'100vh', background:'#F9F9FB' }}>
      <style>{CSS}</style><Sidebar />
      <div className="fe-scroll" style={{ flex:1, overflowY:'auto', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px' }}>
        <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, ease:EASE }} style={{ maxWidth:640, width:'100%' }}>
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#8B5CF6,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 8px 32px rgba(139,92,246,0.4)' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
            </div>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#8B5CF6', marginBottom:12 }}>Lynq Academy</div>
            <h1 style={{ fontSize:32, fontWeight:800, color:'#0F0F10', letterSpacing:'-0.025em', marginBottom:12 }}>Final Certification Exam</h1>
            <p style={{ fontSize:15, color:'#6B7280', lineHeight:1.65, maxWidth:460, margin:'0 auto' }}>Complete all 50 questions to earn your certificate.</p>
          </div>

          <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:36, flexWrap:'wrap' }}>
            {[['50 Questions', false],['5 Sections', false],['~45 minutes', false],['80% to pass', true]].map(([text, isGreen], i) => (
              <div key={i} style={{ background: isGreen ? 'rgba(16,185,129,0.07)' : '#F5F5F5', border: isGreen ? '1px solid rgba(16,185,129,0.18)' : '1px solid rgba(0,0,0,0.08)', borderRadius:20, padding:'7px 16px', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:13, fontWeight:500, color: isGreen ? '#10B981' : '#555555' }}>{text}</span>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:36 }}>
            {SECTION_META.map(({ label }, i) => (
              <div key={i}
                style={{ background:'#FFFFFF', border:'1px solid rgba(0,0,0,0.07)', borderRadius:10, padding:'14px 18px', display:'flex', alignItems:'center', gap:14, cursor:'default', transition:'background 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.background='#F9F8FF'}
                onMouseLeave={e=>e.currentTarget.style.background='#FFFFFF'}>
                <div style={{ width:28, height:28, borderRadius:8, background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#555555' }}>{String(i+1).padStart(2,'0')}</span>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9CA3AF', marginBottom:3 }}>Section {i+1}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#0F0F10' }}>{label}</div>
                </div>
                <div style={{ marginLeft:'auto', fontSize:11, color:'#C4C4C4' }}>10 questions</div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
            <button className="fe-btn-secondary" onClick={() => window.location.href = '/academy'}>← Back to Academy</button>
            <button
              onClick={() => { setCurrentQ(0); setAnswers({}); setView('exam') }}
              style={{ background:'#111111', color:'#FFFFFF', border:'none', borderRadius:8, padding:'11px 28px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'opacity 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.opacity='0.85'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              Start Exam →
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )

  // ── Results ───────────────────────────────────────────────────────────────
  if (view === 'results' && scores) {
    const passed = scores.total >= 80
    const ringR = 70, rStroke = 8, rCirc = 2 * Math.PI * ringR
    return (
      <div className="fe" style={{ display:'flex', height:'100vh', background:'#F9F9FB', position:'relative', overflow:'hidden' }}>
        <style>{CSS}</style><Sidebar />
        {passed && CONFETTI.map((p, i) => (
          <div key={i} style={{ position:'fixed', top:0, left:p.left, width:p.size, height:p.size * 1.5, background:p.color, borderRadius:2, animation:`confettiFall ${p.duration} ${p.delay} ease-in forwards`, pointerEvents:'none', zIndex:999 }} />
        ))}
        <div className="fe-scroll" style={{ flex:1, overflowY:'auto', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px' }}>
          <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} transition={{ duration:0.5, ease:EASE }} style={{ maxWidth:600, width:'100%', textAlign:'center' }}>
            <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:24 }}>
              <svg width="158" height="158" viewBox="0 0 158 158" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="79" cy="79" r={ringR} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={rStroke}/>
                <motion.circle cx="79" cy="79" r={ringR} fill="none"
                  stroke={passed ? '#10B981' : '#EF4444'} strokeWidth={rStroke}
                  strokeLinecap="round" strokeDasharray={rCirc}
                  initial={{ strokeDashoffset: rCirc }}
                  animate={{ strokeDashoffset: rCirc - (scores.total / 100) * rCirc }}
                  transition={{ duration:1.5, ease:'easeOut', delay:0.3 }}/>
              </svg>
              <div style={{ position:'absolute', textAlign:'center' }}>
                <div style={{ fontSize:36, fontWeight:800, color:'#0F0F10' }}>{scores.total}%</div>
                <div style={{ fontSize:11, color:'#9CA3AF' }}>total score</div>
              </div>
            </div>

            <h2 style={{ fontSize:26, fontWeight:800, color:'#0F0F10', letterSpacing:'-0.025em', marginBottom:10 }}>
              {passed ? 'Congratulations!' : 'Almost there!'}
            </h2>
            <p style={{ fontSize:15, color:'#6B7280', lineHeight:1.65, maxWidth:440, margin:'0 auto 32px' }}>
              {passed
                ? "You've earned your Lynq Academy certificate. Outstanding work!"
                : `You scored ${scores.total}%. You need 80% to pass. Review sections below 80% and retake when ready.`}
            </p>

            <div style={{ background:'#FFFFFF', border:'1px solid rgba(0,0,0,0.07)', borderRadius:14, padding:'20px 24px', marginBottom:28, textAlign:'left' }}>
              <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9CA3AF', marginBottom:16 }}>Section Scores</div>
              {SECTION_META.map(({ label, color }, i) => {
                const s = scores.sections[i]
                return (
                  <div key={i} style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:13, fontWeight:500, color:'#374151' }}>{label}</span>
                      <span style={{ fontSize:13, fontWeight:700, color: s >= 80 ? '#10B981' : s >= 60 ? '#F59E0B' : '#EF4444' }}>{s}%</span>
                    </div>
                    <div style={{ height:4, borderRadius:10, background:'rgba(0,0,0,0.07)', overflow:'hidden' }}>
                      <motion.div initial={{ width:0 }} animate={{ width:`${s}%` }} transition={{ duration:1, ease:'easeOut', delay:0.5 + i*0.1 }}
                        style={{ height:'100%', borderRadius:10, background:color }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
              {passed ? (
                <>
                  <button className="fe-btn-green" onClick={() => window.location.href = '/academy/certificate'}>Claim Your Certificate →</button>
                  <button className="fe-btn-secondary" onClick={() => window.location.href = '/academy'}>Back to Academy</button>
                </>
              ) : (
                <>
                  <button className="fe-btn-secondary" onClick={() => window.location.href = '/academy'}>Back to Academy</button>
                  <button className="fe-btn-primary" onClick={() => { setAnswers({}); setCurrentQ(0); setScores(null); setView('intro') }}>Retake Exam</button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Exam ──────────────────────────────────────────────────────────────────
  const q             = ALL_Q[currentQ]
  const currentSection = Math.floor(currentQ / 10)
  const meta           = SECTION_META[currentSection]
  const isLastQ        = currentQ === 49
  const isFirstQ       = currentQ === 0
  const prevQ          = ALL_Q[currentQ - 1]
  const showContext    = q?.showContext || (q?.caseTitle && prevQ?.caseTitle !== q?.caseTitle)
  const answeredTotal  = Object.keys(answers).length
  const qInSection     = currentQ % 10

  return (
    <div className="fe" style={{ display:'flex', height:'100vh', background:'#F9F9FB' }}>
      <style>{CSS}</style><Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Progress header */}
        <div style={{ height:52, background:'#FFFFFF', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', padding:'0 24px', gap:16, flexShrink:0 }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:6 }}>
            {SECTION_META.map(({ label, color }, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:22, height:22, borderRadius:'50%', background: currentSection === i ? meta.color : currentSection > i ? '#10B981' : 'rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color: currentSection >= i ? '#FFF' : '#9CA3AF', transition:'all 0.3s', flexShrink:0 }}>
                  {currentSection > i ? '✓' : i+1}
                </div>
                <span style={{ fontSize:11, fontWeight:currentSection === i ? 600 : 400, color:currentSection === i ? '#0F0F10' : '#C4C4C4', whiteSpace:'nowrap' }}>{label}</span>
                {i < 4 && <div style={{ width:16, height:1, background:'rgba(0,0,0,0.1)', margin:'0 2px' }} />}
              </div>
            ))}
          </div>
          <span style={{ fontSize:12, color:'#9CA3AF', flexShrink:0 }}>Q{currentQ+1}/50</span>
          <button className="fe-btn-secondary" style={{ padding:'6px 14px', fontSize:12 }} onClick={() => setView('intro')}>Exit</button>
        </div>

        {/* Total progress bar */}
        <div style={{ height:3, background:'rgba(0,0,0,0.06)' }}>
          <motion.div style={{ height:'100%', background:`linear-gradient(90deg,${meta.color},#8B5CF6)` }}
            animate={{ width:`${((currentQ+1)/50)*100}%` }} transition={{ duration:0.3 }} />
        </div>

        <div className="fe-scroll" style={{ flex:1, overflowY:'auto' }}>
          <div style={{ maxWidth:720, margin:'0 auto', padding:'32px 24px' }}>
            <AnimatePresence mode="wait">
              <motion.div key={currentQ} initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.22, ease:EASE }}>

                {/* Section label + progress */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:meta.color }}>
                      {meta.label} — Question {qInSection+1} of 10
                    </span>
                    <span style={{ fontSize:11, color:'#9CA3AF' }}>{answeredTotal}/50 answered</span>
                  </div>
                  <div style={{ height:3, borderRadius:10, background:'rgba(0,0,0,0.07)', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:10, background:meta.color, width:`${((qInSection+1)/10)*100}%`, transition:'width 0.3s ease' }} />
                  </div>
                </div>

                {/* Case context */}
                {showContext && q.caseContext && (
                  <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }}
                    style={{ background:'#F9F8FF', border:'1px solid rgba(139,92,246,0.12)', borderLeft:'3px solid #8B5CF6', borderRadius:8, padding:'16px 20px', marginBottom:20 }}>
                    <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#8B5CF6', marginBottom:8 }}>Case Study: {q.caseTitle}</div>
                    <p style={{ fontSize:14, color:'#374151', lineHeight:1.75 }}>{q.caseContext}</p>
                  </motion.div>
                )}

                {/* Case badge (not first question) */}
                {q?.caseTitle && !showContext && (
                  <div style={{ background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.12)', borderRadius:6, padding:'6px 12px', marginBottom:14, display:'inline-block' }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'#8B5CF6' }}>{q.caseTitle}</span>
                  </div>
                )}

                {/* Question */}
                <div style={{ background:'#FFFFFF', border:'1px solid rgba(0,0,0,0.07)', borderRadius:12, padding:'24px 28px', marginBottom:14 }}>
                  <h3 style={{ fontSize:18, fontWeight:600, color:'#0F0F10', lineHeight:1.5 }}>{q.q}</h3>
                </div>

                {/* Options */}
                {q.opts.map((opt, idx) => {
                  const sel = answers[currentQ] === idx
                  return (
                    <div key={idx} className={`fe-option ${sel ? 'selected' : ''}`}
                      onClick={() => setAnswers(prev => ({ ...prev, [currentQ]: idx }))}>
                      <div className="fe-radio">
                        {sel && <div style={{ width:8, height:8, borderRadius:'50%', background:'#FFFFFF' }} />}
                      </div>
                      <span style={{ fontSize:14, color:'#0F0F10', flex:1 }}>{opt}</span>
                    </div>
                  )
                })}

                {/* Navigation */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:20 }}>
                  <button className="fe-btn-secondary" onClick={() => setCurrentQ(q => q - 1)}
                    disabled={isFirstQ} style={{ opacity:isFirstQ ? 0.35 : 1 }}>← Previous</button>
                  {!isLastQ
                    ? <button className="fe-btn-primary" onClick={() => setCurrentQ(q => q + 1)}>Next →</button>
                    : <button className="fe-btn-primary"
                        disabled={answeredTotal < 50 || saving}
                        style={{ opacity:answeredTotal >= 50 ? 1 : 0.5 }}
                        onClick={handleSubmit}>
                        {saving ? 'Submitting…' : 'Submit Exam →'}
                      </button>
                  }
                </div>
                {isLastQ && answeredTotal < 50 && (
                  <p style={{ fontSize:12, color:'#F59E0B', textAlign:'center', marginTop:10 }}>
                    {50 - answeredTotal} question{50 - answeredTotal !== 1 ? 's' : ''} still unanswered
                  </p>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
