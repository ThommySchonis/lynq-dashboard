'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import Sidebar from '../../components/Sidebar'

// ─── Constants ────────────────────────────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1]

const ALL_MODULE_IDS = [
  'cs-fundamentals',
  'refund-handling',
  'shopify-ops',
  'email-comms',
  'dispute-mgmt',
  'performance-kpis',
]

const MODULE_LABELS = {
  'cs-fundamentals':  'CS Fundamentals',
  'refund-handling':  'Refund Handling',
  'shopify-ops':      'Shopify Operations',
  'email-comms':      'Email & Communication',
  'dispute-mgmt':     'Dispute Management',
  'performance-kpis': 'Performance & KPIs',
}

// ─── Exam Data ────────────────────────────────────────────────────────────────

const CASE_STUDIES = [
  {
    title: 'The Angry Customer',
    context: 'A customer ordered a Premium Cotton T-shirt 3 weeks ago and has not received it. Tracking shows the package has been stuck in transit for 10 days. The customer emails you furious, threatening a chargeback.',
    questions: [
      { q: 'What is your FIRST response action?', opts: ['Offer immediate refund', 'Apologize and ask for order number to investigate', 'Tell them to wait longer', 'Blame the carrier'], correct: 1 },
      { q: 'You check tracking and the package is lost. What do you offer?', opts: ['10% discount on next order', "Resend the item or full refund, customer's choice", 'Partial refund only', 'Store credit only'], correct: 1 },
      { q: 'The customer threatens a chargeback. What do you do?', opts: ['Ignore the threat', 'Immediately resolve to prevent chargeback', 'Tell them to go ahead', 'Escalate to manager without responding'], correct: 1 },
      { q: 'After resolving, what should you do?', opts: ['Nothing, case is closed', 'Send a follow-up email to confirm satisfaction', 'Ask for a review immediately', 'Close the ticket without response'], correct: 1 },
      { q: 'What do you document in the ticket?', opts: ['Just the resolution', 'The full timeline, actions taken, and outcome', 'Only the refund amount', 'Nothing additional'], correct: 1 },
    ],
  },
  {
    title: 'The Wrong Item',
    context: 'A customer received a Black L t-shirt but ordered a White M. They send photos as proof. They want an exchange but you are out of White M stock.',
    questions: [
      { q: 'What is your FIRST action after seeing the proof photos?', opts: ['Ask the customer to ship back before doing anything', 'Apologize and confirm you will make it right', 'Ask if they want a refund instead', 'Blame the warehouse'], correct: 1 },
      { q: 'White M is out of stock. What do you offer?', opts: ['Nothing, wait for restock', 'Tell them to wait 4–6 weeks', 'Refund, store credit, or nearest available size', 'Store credit only'], correct: 2 },
      { q: 'What happens to the incorrect item they received?', opts: ['Always request it back', 'For low-value items, let them keep it to avoid return friction', 'Always charge return shipping', 'Ignore it'], correct: 1 },
      { q: 'Customer needs the shirt for an event in 3 days. What do you do?', opts: ['Tell them it is impossible', 'Offer expedited shipping on the replacement and flag as priority', 'Refund only', 'Ask them to order again'], correct: 1 },
      { q: 'What tag do you add to this order in Shopify?', opts: ['customer_complaint', 'Relevant action tag like exchange_sent', 'pending_review', 'No tag needed'], correct: 1 },
    ],
  },
  {
    title: 'The Dispute Manager',
    context: 'A customer filed a chargeback with their bank for €89.95 claiming they never received their order. Your tracking shows it was delivered 2 weeks ago.',
    questions: [
      { q: 'What is your first step?', opts: ['Immediately refund', 'Gather evidence: tracking, delivery confirmation, and communication history', 'Ask customer to check with neighbors', 'Tell them they are wrong'], correct: 1 },
      { q: 'What is the typical window to respond to chargebacks?', opts: ['30 days', '60 days', '7–21 days depending on card network', '48 hours'], correct: 2 },
      { q: 'Which evidence is MOST important for an INR dispute?', opts: ['Your refund policy', 'Product description', 'Proof of delivery with timestamp and address', 'The original order confirmation'], correct: 2 },
      { q: 'Investigation reveals the customer actually never received it. What do you do?', opts: ['Fight the chargeback anyway', 'Withdraw the dispute and refund proactively', 'Ignore the chargeback', 'Ask for more time'], correct: 1 },
      { q: 'How should your dispute response be formatted?', opts: ['Emotional and detailed narrative', 'Concise, timestamped, and evidence-backed', 'As long as possible', 'Just attach the tracking number'], correct: 1 },
    ],
  },
]

const KNOWLEDGE_QUESTIONS = [
  { q: 'What does FCR stand for?', opts: ['First Customer Review', 'Full Charge Rate', 'First Contact Resolution', 'Forwarded Case Report'], correct: 2 },
  { q: 'What is the target FCR rate?', opts: ['Above 50%', 'Above 60%', 'Above 75%', 'Above 90%'], correct: 2 },
  { q: 'Which chargeback rate triggers card processor scrutiny?', opts: ['Above 5%', 'Above 1%', 'Above 10%', 'Above 0.1%'], correct: 1 },
  { q: 'What is a P1 support ticket?', opts: ['Standard inquiry', 'Product question', 'Chargeback or legal threat requiring <2h response', 'Positive review'], correct: 2 },
  { q: 'What does CSAT stand for?', opts: ['Customer Satisfaction Score', 'Customer Service Agent Training', 'Case Status And Tracking', 'Client Support Action Team'], correct: 0 },
  { q: 'What refund rate is healthy for e-commerce?', opts: ['Under 1%', 'Under 3%', 'Under 10%', 'Under 15%'], correct: 1 },
  { q: 'What does "Unfulfilled" mean in Shopify?', opts: ['Cancelled', 'Refunded', 'Not yet shipped', 'Pending payment'], correct: 2 },
  { q: 'What reduces unauthorized chargebacks by up to 80%?', opts: ['Free shipping', 'Better photos', '3D Secure authentication', 'Signature confirmation'], correct: 2 },
  { q: 'When should you respond to a PayPal dispute?', opts: ['At the claim stage', 'At the inquiry stage', 'After PayPal decides', 'Never'], correct: 1 },
  { q: 'What is the ideal first response email length?', opts: ['As long as needed', 'Under 50 words', 'Under 120 words', 'Exactly 200 words'], correct: 2 },
  { q: 'How often should support macros be reviewed?', opts: ['Never', 'Daily', 'Quarterly', 'Annually'], correct: 2 },
  { q: 'What is the most common chargeback reason?', opts: ['Duplicate charge', 'Item not received (INR)', 'Wrong amount', 'Unauthorized transaction'], correct: 1 },
  { q: 'What should you ALWAYS do before closing a ticket?', opts: ['Ask for payment', 'Confirm issue is resolved', 'Send a survey', 'Escalate'], correct: 1 },
  { q: 'What CSAT score needs immediate intervention?', opts: ['Below 4.5', 'Below 4.0', 'Below 3.5', 'Below 3.0'], correct: 2 },
  { q: 'What is the low-stock alert threshold in Shopify?', opts: ['Zero stock', '1 item left', '20% of average weekly sales', 'When customer complains'], correct: 2 },
  { q: 'What is the typical refund processing time?', opts: ['24 hours', '3–5 business days', '7–10 business days', '30 days'], correct: 1 },
  { q: 'What is the first step when handling a complaint?', opts: ['Offer refund', 'Listen and acknowledge', 'Transfer to manager', 'Close ticket'], correct: 1 },
  { q: 'Where are support actions recorded in Shopify?', opts: ['Automatically', 'Internal order notes', "Customer's profile", 'Spreadsheet'], correct: 1 },
  { q: 'What makes a good macro?', opts: ['Copy-paste as-is always', 'Starting point that agents personalize', 'Never update it', 'Use only for refunds'], correct: 1 },
  { q: 'What phrase should be avoided in support emails?', opts: ['Thank you', 'I understand', 'Per our policy', 'How can I help'], correct: 2 },
]

const PRACTICAL_SCENARIO = `A customer emails you: "I ordered your bestselling hoodie in size L two weeks ago for my son's birthday tomorrow. It just arrived in size S. This is completely unacceptable. I want a refund AND a replacement sent TODAY. If you can't do this, I'm going to dispute the charge with my bank."

Write a complete, professional customer service reply that handles this situation appropriately.`

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  .fe * { box-sizing: border-box; margin: 0; padding: 0; }
  .fe { font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }

  .fe-scroll::-webkit-scrollbar { width: 3px; }
  .fe-scroll::-webkit-scrollbar-track { background: transparent; }
  .fe-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

  .fe-option {
    background: #FFFFFF;
    border: 1px solid rgba(0,0,0,0.09);
    border-radius: 12px; padding: 14px 18px;
    display: flex; align-items: center; gap: 14px;
    cursor: pointer; transition: all 0.15s ease; margin-bottom: 8px;
  }
  .fe-option:hover { background: #F9F9FB; border-color: rgba(139,92,246,0.3); }
  .fe-option.selected { background: rgba(139,92,246,0.06); border-color: #8B5CF6; }

  .fe-radio {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,0.2);
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .fe-option:hover .fe-radio { border-color: #8B5CF6; }
  .fe-option.selected .fe-radio { background: #8B5CF6; border-color: #8B5CF6; }

  .fe-btn-primary {
    background: linear-gradient(135deg, #8B5CF6, #6366F1);
    color: #FFFFFF; border: none; border-radius: 20px;
    padding: 10px 24px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
    box-shadow: 0 4px 16px rgba(99,102,241,0.3);
  }
  .fe-btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .fe-btn-primary:disabled { opacity: 0.35; cursor: not-allowed; transform: none; filter: none; }

  .fe-btn-secondary {
    background: rgba(0,0,0,0.04);
    border: 1px solid rgba(0,0,0,0.09);
    color: #6B7280; border-radius: 20px;
    padding: 10px 20px; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .fe-btn-secondary:hover { background: rgba(0,0,0,0.07); color: #374151; }

  .fe-btn-green {
    background: linear-gradient(135deg, #10B981, #059669);
    color: #FFFFFF; border: none; border-radius: 20px;
    padding: 10px 22px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
    box-shadow: 0 4px 16px rgba(16,185,129,0.3);
  }
  .fe-btn-green:hover { filter: brightness(1.1); transform: translateY(-1px); }

  .fe-textarea {
    width: 100%; border: 1px solid rgba(0,0,0,0.1); border-radius: 12px;
    padding: 18px 20px; font-size: 14px; font-family: inherit; color: #0F0F10;
    background: #FFFFFF; resize: vertical; line-height: 1.7; outline: none;
    transition: border-color 0.15s;
  }
  .fe-textarea:focus { border-color: #8B5CF6; box-shadow: 0 0 0 3px rgba(139,92,246,0.1); }

  @keyframes fe-spin { to { transform: rotate(360deg); } }
`

// ─── Score calculation ────────────────────────────────────────────────────────

function calcCasesScore(answers) {
  let total = 0, correct = 0
  CASE_STUDIES.forEach((cs, ci) => {
    cs.questions.forEach((q, qi) => {
      const key = `${ci}-${qi}`
      total++
      if (answers[key] === q.correct) correct++
    })
  })
  return total === 0 ? 0 : Math.round((correct / total) * 100)
}

function calcKnowledgeScore(answers) {
  let correct = 0
  KNOWLEDGE_QUESTIONS.forEach((q, i) => {
    if (answers[i] === q.correct) correct++
  })
  return Math.round((correct / KNOWLEDGE_QUESTIONS.length) * 100)
}

function calcPracticalScore(text) {
  if (!text || text.length < 100) return 60
  const lower = text.toLowerCase()
  const keywords = ['sorry', 'apologize', 'refund', 'replacement', 'send', 'resolve', 'understand', 'help', 'right away', 'immediately']
  const matched = keywords.filter(k => lower.includes(k)).length
  return matched >= 2 ? 100 : 60
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(0,0,0,0.08)', borderTop: '3px solid #8B5CF6', borderRadius: '50%', animation: 'fe-spin 0.7s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>Loading…</div>
      </div>
    </div>
  )
}

function CheckIcon({ size = 14, color = '#10B981' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon({ size = 14, color = '#EF4444' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinalExamPage() {
  const [view,           setView]           = useState('loading')
  const [section,        setSection]        = useState(0)
  const [passedModules,  setPassedModules]  = useState([])
  const [caseAnswers,    setCaseAnswers]     = useState({})
  const [knowledgeAnswers, setKnowledgeAnswers] = useState({})
  const [practicalText,  setPracticalText]  = useState('')
  const [submitted,      setSubmitted]      = useState(false)
  const [scores,         setScores]         = useState(null)
  const [session,        setSession]        = useState(null)
  const [saving,         setSaving]         = useState(false)

  // Case study navigation state
  const [caseIdx,      setCaseIdx]      = useState(0)
  const [caseQuestion, setCaseQuestion] = useState(0)

  // Knowledge question navigation
  const [knowIdx, setKnowIdx] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) { window.location.href = '/login'; return }
      setSession(s)

      try {
        const { data, error } = await supabase
          .from('exam_submissions')
          .select('module_id, passed')
          .eq('user_id', s.user.id)
          .eq('passed', true)

        if (!error && data) {
          const passed = data.map(r => r.module_id).filter(id => ALL_MODULE_IDS.includes(id))
          setPassedModules(passed)
          const allPassed = ALL_MODULE_IDS.every(id => passed.includes(id))
          setView(allPassed ? 'intro' : 'locked')
        } else {
          setView('locked')
        }
      } catch (_) {
        setView('locked')
      }
    })
  }, [])

  async function handleSubmitExam() {
    setSaving(true)
    const casesScore    = calcCasesScore(caseAnswers)
    const knowledgeScore = calcKnowledgeScore(knowledgeAnswers)
    const practicalScore = calcPracticalScore(practicalText)
    const totalScore    = Math.round((casesScore + knowledgeScore + practicalScore) / 3)

    const result = { cases: casesScore, knowledge: knowledgeScore, practical: practicalScore, total: totalScore }
    setScores(result)

    try {
      if (session?.user?.id) {
        await supabase.from('exam_submissions').upsert({
          user_id: session.user.id,
          module_id: 'final',
          score: totalScore,
          passed: totalScore >= 80,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,module_id' })
      }
    } catch (_) {}

    setSaving(false)
    setView('results')
  }

  // ── Locked view ──────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div className="fe" style={{ display: 'flex', height: '100vh', background: '#F9F9FB' }}>
        <style>{CSS}</style>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner />
        </div>
      </div>
    )
  }

  if (view === 'locked') {
    return (
      <div className="fe" style={{ display: 'flex', height: '100vh', background: '#F9F9FB' }}>
        <style>{CSS}</style>
        <Sidebar />
        <div className="fe-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
            style={{ maxWidth: 560, width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F0F10', letterSpacing: '-0.025em', marginBottom: 10 }}>Final Exam Locked</h1>
              <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.65, maxWidth: 420, margin: '0 auto' }}>
                Complete all 6 module quizzes with 70%+ before taking the final exam.
              </p>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
              {ALL_MODULE_IDS.map(id => {
                const done = passedModules.includes(id)
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.05)', border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {done ? <CheckIcon size={13} /> : <XIcon size={13} color="#D1D5DB" />}
                    </div>
                    <span style={{ fontSize: 14, color: done ? '#374151' : '#9CA3AF', fontWeight: done ? 500 : 400 }}>{MODULE_LABELS[id]}</span>
                    {done && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#10B981' }}>Passed</span>}
                    {!done && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#D1D5DB' }}>Not yet</span>}
                  </div>
                )
              })}
            </div>

            <div style={{ textAlign: 'center' }}>
              <button className="fe-btn-secondary" onClick={() => window.location.href = '/academy'}>← Return to Academy</button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Intro view ───────────────────────────────────────────────────────────────
  if (view === 'intro') {
    return (
      <div className="fe" style={{ display: 'flex', height: '100vh', background: '#F9F9FB' }}>
        <style>{CSS}</style>
        <Sidebar />
        <div className="fe-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
            style={{ maxWidth: 640, width: '100%' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(139,92,246,0.4)' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                </svg>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8B5CF6', marginBottom: 12 }}>Lynq Academy</div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0F0F10', letterSpacing: '-0.025em', marginBottom: 12 }}>Final Certification Exam</h1>
              <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.65, maxWidth: 460, margin: '0 auto' }}>
                Complete all three sections to earn your Lynq Academy certificate.
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 36, flexWrap: 'wrap' }}>
              {[
                { icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, text: '~45 minutes' },
                { icon: <><polyline points="20 6 9 17 4 12"/></>, text: '80% to pass' },
                { icon: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>, text: '3 sections' },
              ].map(({ icon, text }, i) => (
                <div key={i} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#555' }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Section cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36 }}>
              {[
                { num: '01', title: 'Case Studies', desc: '3 real-world customer scenarios — 5 questions each (15 total)', color: '#6366F1', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
                { num: '02', title: 'Knowledge Test', desc: '20 multiple choice questions covering all 6 modules', color: '#3B82F6', icon: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></> },
                { num: '03', title: 'Practical Assignment', desc: 'Write a professional customer service reply to a real scenario', color: '#10B981', icon: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></> },
              ].map(({ num, title, desc, color, icon }) => (
                <div key={num} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: color, marginBottom: 4 }}>Section {num}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#0F0F10', marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 13, color: '#6B7280' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="fe-btn-secondary" onClick={() => window.location.href = '/academy'}>← Back to Academy</button>
              <button className="fe-btn-primary" onClick={() => { setSection(0); setCaseIdx(0); setCaseQuestion(0); setKnowIdx(0); setView('exam') }}>
                Start Exam →
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Results view ─────────────────────────────────────────────────────────────
  if (view === 'results' && scores) {
    const passed = scores.total >= 80
    const ringR = 70, rStroke = 8, rCirc = 2 * Math.PI * ringR

    return (
      <div className="fe" style={{ display: 'flex', height: '100vh', background: '#F9F9FB' }}>
        <style>{CSS}</style>
        <Sidebar />
        <div className="fe-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}
            style={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>

            {/* Score ring */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <svg width="158" height="158" viewBox="0 0 158 158" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="79" cy="79" r={ringR} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={rStroke} />
                <motion.circle cx="79" cy="79" r={ringR} fill="none"
                  stroke={passed ? '#10B981' : '#EF4444'} strokeWidth={rStroke}
                  strokeLinecap="round" strokeDasharray={rCirc}
                  initial={{ strokeDashoffset: rCirc }}
                  animate={{ strokeDashoffset: rCirc - (scores.total / 100) * rCirc }}
                  transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#0F0F10' }}>{scores.total}%</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>total score</div>
              </div>
            </div>

            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0F0F10', letterSpacing: '-0.025em', marginBottom: 10 }}>
              {passed ? 'Congratulations! You passed!' : 'Keep going — you\'re close!'}
            </h2>
            <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.65, marginBottom: 32, maxWidth: 440, margin: '0 auto 32px' }}>
              {passed
                ? "You've earned your Lynq Academy certificate. Outstanding work!"
                : `You scored ${scores.total}%. You need 80% to pass. Review the weaker areas and retake when ready.`}
            </p>

            {/* Section breakdown */}
            <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, padding: '20px 24px', marginBottom: 28, textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: 16 }}>Section Scores</div>
              {[
                { label: 'Case Studies', score: scores.cases, color: '#6366F1' },
                { label: 'Knowledge Test', score: scores.knowledge, color: '#3B82F6' },
                { label: 'Practical Assignment', score: scores.practical, color: '#10B981' },
              ].map(({ label, score, color }) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444' }}>{score}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 10, background: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                      style={{ height: '100%', borderRadius: 10, background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {passed ? (
                <>
                  <button className="fe-btn-green" onClick={() => window.location.href = '/academy'}>View Certificate →</button>
                  <button className="fe-btn-secondary" onClick={() => window.location.href = '/academy'}>Back to Academy</button>
                </>
              ) : (
                <>
                  <button className="fe-btn-secondary" onClick={() => window.location.href = '/academy'}>Back to Academy</button>
                  <button className="fe-btn-primary" onClick={() => {
                    setCaseAnswers({})
                    setKnowledgeAnswers({})
                    setPracticalText('')
                    setScores(null)
                    setSection(0)
                    setCaseIdx(0)
                    setCaseQuestion(0)
                    setKnowIdx(0)
                    setView('intro')
                  }}>Retake Exam</button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Exam view ─────────────────────────────────────────────────────────────────
  const totalCaseQuestions = CASE_STUDIES.reduce((s, cs) => s + cs.questions.length, 0)
  const answeredCaseQuestions = Object.keys(caseAnswers).length
  const answeredKnowledge = Object.keys(knowledgeAnswers).length

  // Global question index for case studies
  const globalCaseIdx = CASE_STUDIES.slice(0, caseIdx).reduce((s, cs) => s + cs.questions.length, 0) + caseQuestion

  const currentCase = CASE_STUDIES[caseIdx]
  const currentCaseQ = currentCase?.questions[caseQuestion]
  const currentKnowQ = KNOWLEDGE_QUESTIONS[knowIdx]

  function nextCaseQuestion() {
    const caseQLen = currentCase.questions.length
    if (caseQuestion < caseQLen - 1) {
      setCaseQuestion(q => q + 1)
    } else if (caseIdx < CASE_STUDIES.length - 1) {
      setCaseIdx(i => i + 1)
      setCaseQuestion(0)
    }
  }

  function prevCaseQuestion() {
    if (caseQuestion > 0) {
      setCaseQuestion(q => q - 1)
    } else if (caseIdx > 0) {
      const prevCase = CASE_STUDIES[caseIdx - 1]
      setCaseIdx(i => i - 1)
      setCaseQuestion(prevCase.questions.length - 1)
    }
  }

  const isLastCaseQuestion = caseIdx === CASE_STUDIES.length - 1 && caseQuestion === currentCase.questions.length - 1
  const isLastKnowQuestion = knowIdx === KNOWLEDGE_QUESTIONS.length - 1
  const currentCaseAnswerKey = `${caseIdx}-${caseQuestion}`

  return (
    <div className="fe" style={{ display: 'flex', height: '100vh', background: '#F9F9FB' }}>
      <style>{CSS}</style>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top progress bar */}
        <div style={{ height: 52, background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            {['Case Studies', 'Knowledge Test', 'Practical'].map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: section === i ? '#8B5CF6' : section > i ? '#10B981' : 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: section >= i ? '#FFF' : '#9CA3AF', transition: 'all 0.2s' }}>
                  {section > i ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: section === i ? 600 : 400, color: section === i ? '#0F0F10' : '#9CA3AF' }}>{label}</span>
                {i < 2 && <div style={{ width: 24, height: 1, background: 'rgba(0,0,0,0.12)', margin: '0 4px' }} />}
              </div>
            ))}
          </div>
          <button className="fe-btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setView('intro')}>Exit Exam</button>
        </div>

        <div className="fe-scroll" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
            <AnimatePresence mode="wait">

              {/* ── Section 0: Case Studies ── */}
              {section === 0 && (
                <motion.div key={`case-${caseIdx}-${caseQuestion}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: EASE }}>
                  {/* Progress */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF' }}>
                        Case {caseIdx + 1} of {CASE_STUDIES.length} — Q{caseQuestion + 1}/{currentCase.questions.length}
                      </span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{answeredCaseQuestions}/{totalCaseQuestions} answered</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 10, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                      <motion.div style={{ height: '100%', borderRadius: 10, background: 'linear-gradient(90deg,#6366F1,#8B5CF6)' }}
                        animate={{ width: `${((globalCaseIdx + 1) / totalCaseQuestions) * 100}%` }} transition={{ duration: 0.3 }} />
                    </div>
                  </div>

                  {/* Case context (show on first question of each case) */}
                  {caseQuestion === 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                      style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366F1', marginBottom: 8 }}>Case Study: {currentCase.title}</div>
                      <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{currentCase.context}</p>
                    </motion.div>
                  )}

                  {caseQuestion > 0 && (
                    <div style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#6366F1' }}>Case: {currentCase.title}</span>
                    </div>
                  )}

                  {/* Question */}
                  <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: '24px 28px', marginBottom: 14 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 600, color: '#0F0F10', lineHeight: 1.5 }}>{currentCaseQ?.q}</h3>
                  </div>

                  {currentCaseQ?.opts.map((opt, idx) => {
                    const sel = caseAnswers[currentCaseAnswerKey] === idx
                    return (
                      <div key={idx} className={`fe-option ${sel ? 'selected' : ''}`}
                        onClick={() => setCaseAnswers(prev => ({ ...prev, [currentCaseAnswerKey]: idx }))}>
                        <div className="fe-radio">
                          {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFFFFF' }} />}
                        </div>
                        <span style={{ fontSize: 14, color: '#0F0F10', flex: 1 }}>{opt}</span>
                      </div>
                    )
                  })}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                    <button className="fe-btn-secondary"
                      onClick={prevCaseQuestion}
                      disabled={caseIdx === 0 && caseQuestion === 0}
                      style={{ opacity: (caseIdx === 0 && caseQuestion === 0) ? 0.35 : 1 }}>← Previous</button>
                    {!isLastCaseQuestion
                      ? <button className="fe-btn-primary" onClick={nextCaseQuestion}>Next →</button>
                      : <button className="fe-btn-primary"
                          disabled={answeredCaseQuestions < totalCaseQuestions}
                          style={{ opacity: answeredCaseQuestions >= totalCaseQuestions ? 1 : 0.5 }}
                          onClick={() => { setSection(1); setKnowIdx(0) }}>
                          Submit Section 1 →
                        </button>
                    }
                  </div>
                </motion.div>
              )}

              {/* ── Section 1: Knowledge Test ── */}
              {section === 1 && (
                <motion.div key={`know-${knowIdx}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: EASE }}>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF' }}>Question {knowIdx + 1} of {KNOWLEDGE_QUESTIONS.length}</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{answeredKnowledge}/{KNOWLEDGE_QUESTIONS.length} answered</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 10, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                      <motion.div style={{ height: '100%', borderRadius: 10, background: 'linear-gradient(90deg,#3B82F6,#6366F1)' }}
                        animate={{ width: `${((knowIdx + 1) / KNOWLEDGE_QUESTIONS.length) * 100}%` }} transition={{ duration: 0.3 }} />
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: '24px 28px', marginBottom: 14 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 600, color: '#0F0F10', lineHeight: 1.5 }}>{currentKnowQ?.q}</h3>
                  </div>

                  {currentKnowQ?.opts.map((opt, idx) => {
                    const sel = knowledgeAnswers[knowIdx] === idx
                    return (
                      <div key={idx} className={`fe-option ${sel ? 'selected' : ''}`}
                        onClick={() => setKnowledgeAnswers(prev => ({ ...prev, [knowIdx]: idx }))}>
                        <div className="fe-radio">
                          {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFFFFF' }} />}
                        </div>
                        <span style={{ fontSize: 14, color: '#0F0F10', flex: 1 }}>{opt}</span>
                      </div>
                    )
                  })}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                    <button className="fe-btn-secondary"
                      onClick={() => setKnowIdx(i => Math.max(0, i - 1))}
                      disabled={knowIdx === 0}
                      style={{ opacity: knowIdx === 0 ? 0.35 : 1 }}>← Previous</button>
                    {!isLastKnowQuestion
                      ? <button className="fe-btn-primary" onClick={() => setKnowIdx(i => i + 1)}>Next →</button>
                      : <button className="fe-btn-primary"
                          disabled={answeredKnowledge < KNOWLEDGE_QUESTIONS.length}
                          style={{ opacity: answeredKnowledge >= KNOWLEDGE_QUESTIONS.length ? 1 : 0.5 }}
                          onClick={() => setSection(2)}>
                          Submit Section 2 →
                        </button>
                    }
                  </div>
                </motion.div>
              )}

              {/* ── Section 2: Practical ── */}
              {section === 2 && (
                <motion.div key="practical" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: EASE }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981', marginBottom: 6 }}>Section 3 — Practical Assignment</div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.02em', marginBottom: 8 }}>Write Your Response</h2>
                    <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Read the scenario below and write a complete, professional customer service reply.</p>
                  </div>

                  <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#10B981', marginBottom: 10 }}>Customer Scenario</div>
                    <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{PRACTICAL_SCENARIO}</p>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 10 }}>Your reply</label>
                    <textarea
                      className="fe-textarea"
                      rows={10}
                      placeholder="Hi [Customer name], I'm so sorry to hear about..."
                      value={practicalText}
                      onChange={e => setPracticalText(e.target.value)}
                    />
                    <div style={{ fontSize: 11, color: practicalText.length >= 100 ? '#10B981' : '#9CA3AF', marginTop: 6, textAlign: 'right' }}>
                      {practicalText.length} characters {practicalText.length < 100 ? `(minimum 100 — ${100 - practicalText.length} more needed)` : '✓'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
                    <button className="fe-btn-secondary" onClick={() => setSection(1)}>← Back to Section 2</button>
                    <button className="fe-btn-primary"
                      disabled={practicalText.length < 50 || saving}
                      style={{ opacity: practicalText.length >= 50 ? 1 : 0.5 }}
                      onClick={handleSubmitExam}>
                      {saving ? 'Submitting…' : 'Submit Exam →'}
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
