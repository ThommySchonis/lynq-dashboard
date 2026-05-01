'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ─── Constants ────────────────────────────────────────────────────────────────
const SIDEBAR_W  = 208   // main app sidebar
const AC_SIDEBAR = 240   // academy internal sidebar
const EASE       = [0.16, 1, 0.3, 1]
const PASS_THRESHOLD = 75

function readKey(moduleId, idx) { return `ac_read_${moduleId}_${idx}` }

// ─── Module data ──────────────────────────────────────────────────────────────
const MODULES = [
  {
    id: 'cs-fundamentals', examType: 'customer_service',
    num: '01', color: '#6366F1', label: 'CS Fundamentals',
    description: 'Core principles of world-class e-commerce customer service.',
    sections: [
      {
        title: 'What is Customer Service Excellence?', mins: 5,
        body: `Customer service excellence in e-commerce goes beyond answering emails quickly. It means anticipating customer needs, resolving issues on the first contact, and leaving every customer feeling genuinely valued — even when the outcome isn't what they hoped for.\n\nWorld-class brands like Zappos built their entire identity on service. For e-commerce operators, this means every support interaction is a brand touchpoint that directly affects repeat purchase rate, reviews, and referrals.`,
        takeaways: ['First Contact Resolution (FCR) is the single most important metric in support.', 'A resolved complaint often produces a more loyal customer than one who never had a problem.', 'Tone matters as much as content — warm, human responses outperform templated ones.'],
        tips: ['Always acknowledge the customer\'s frustration before jumping to solutions.', 'Use the customer\'s name at least once in your reply.'],
      },
      {
        title: 'The 5-Step Resolution Framework', mins: 6,
        body: `Every customer issue can be resolved using a consistent framework: Acknowledge → Empathize → Clarify → Resolve → Follow up.\n\n1. Acknowledge: Confirm you've received and understood their message.\n2. Empathize: Show you understand how they feel without admitting fault.\n3. Clarify: Ask one focused question if information is missing.\n4. Resolve: Offer the best solution within your authority.\n5. Follow up: Close the loop — confirm the resolution worked.`,
        takeaways: ['Never skip acknowledgment — customers who feel ignored escalate faster.', 'One clarifying question is better than three. Consolidate your questions.', 'Follow-up dramatically improves CSAT scores.'],
        example: 'Bad: "Your order was delayed due to carrier issues."\n\nGood: "Hi Sarah, I completely understand how frustrating a delayed order is, especially when you were counting on it. I\'ve checked your tracking and your package is now out for delivery — you should receive it by end of day tomorrow. I\'ve also added a 10% discount to your account for next time."',
      },
      {
        title: 'De-escalation Techniques', mins: 4,
        body: `Angry customers require a different approach. The goal is not to win an argument — it's to transform their emotional state from frustrated to calm, then from calm to satisfied.\n\nKey de-escalation principle: never match the customer's emotional energy. Stay measured, professional, and solution-focused regardless of tone.`,
        takeaways: ['Phrases like "I understand your frustration" validate without escalating.', 'Offering partial solutions early shows good faith.', 'If a situation is truly unresolvable, escalate immediately rather than stalling.'],
        tips: ['Avoid phrases like "per our policy" — they feel dismissive.', '"What can I do to make this right?" is one of the most powerful phrases in support.'],
      },
      {
        title: 'Handling Common Scenarios', mins: 5,
        body: `Mastering the most common support scenarios lets you respond confidently and consistently. In e-commerce, 80% of tickets fall into four categories: WISMO (Where Is My Order), returns/refunds, damaged products, and product questions.\n\nFor WISMO: always check the tracking link before responding and provide a concrete ETA, not a vague "it should arrive soon."\n\nFor damaged products: ask for a photo, apologize sincerely, and offer a replacement or refund based on the situation.`,
        takeaways: ['WISMO tickets should be resolved in under 3 minutes with a good Shopify setup.', 'Photos of damage serve as documentation, not proof the customer is lying.', 'Product question tickets are a sales opportunity — answer enthusiastically.'],
      },
    ],
  },
  {
    id: 'refund-handling', examType: 'dispute_management',
    num: '02', color: '#EF4444', label: 'Refund Handling',
    description: 'Handle refunds fairly, efficiently, and profitably.',
    sections: [
      {
        title: 'Refund Policy Fundamentals', mins: 4,
        body: `A clear refund policy is the foundation of trust. Customers buy from stores with clear, fair policies. Ambiguity increases tickets, reduces conversions, and leads to chargebacks.\n\nBest practice: publish a 30-day return policy and automate standard refund approvals under €75. This reduces support load and increases customer trust significantly.`,
        takeaways: ['Clear policies reduce inbound refund requests by up to 40%.', 'Automated refunds for small amounts save more in support cost than they lose in revenue.', 'Your policy should match the spirit, not just the letter — edge cases need human judgment.'],
        tips: ['Add your refund policy link to every order confirmation email.', 'State the policy positively: "We accept returns within 30 days."'],
      },
      {
        title: 'When to Approve vs Decline', mins: 5,
        body: `Not every refund request deserves approval — but erring heavily toward approval builds long-term loyalty. The key is distinguishing between customer error, seller error, and carrier error.\n\nSeller error (wrong item, damaged, defective): always refund or replace, no questions asked.\nCarrier error (lost, delayed beyond threshold): refund and file a claim with the carrier.\nCustomer error (wrong size ordered, changed mind): use your policy, but consider partial goodwill gestures.`,
        takeaways: ['Seller errors must always result in a full remedy — no exceptions.', 'Customer-error refunds can include a restocking fee if your policy states it.', 'Repeat refund requesters from the same account may be committing fraud — flag them.'],
        example: 'Customer: "I ordered the wrong size and want a refund."\n\nApproach: Check if they\'re within the return window. If yes, approve the return. If slightly outside, consider a store credit as a goodwill gesture — it costs less and retains the customer.',
      },
      {
        title: 'Refund Communication Scripts', mins: 4,
        body: `How you communicate a refund matters as much as the refund itself. A positive refund experience can turn a disappointed customer into a loyal one.\n\nApproval: "Hi [Name], I've processed your refund of [amount] — it should appear in your account within 3–5 business days. I'm sorry this didn't work out, and I hope to see you again soon."\n\nDenial with goodwill: "Hi [Name], I'm unable to process this as a refund because [reason], but I'd love to make it right with a 15% discount. Would that work for you?"`,
        takeaways: ['Always state a timeframe for the refund — vague timelines cause follow-up tickets.', 'A declined refund with an alternative offer is better received than a flat no.', 'Close every refund interaction with a positive sentiment.'],
      },
    ],
  },
  {
    id: 'shopify-ops', examType: 'supply_chain',
    num: '03', color: '#10B981', label: 'Shopify Operations',
    description: 'Master order management, fulfillment, and inventory on Shopify.',
    sections: [
      {
        title: 'Order Management Essentials', mins: 5,
        body: `Shopify's admin is the operational hub. Understanding its order flow end-to-end — from placement to fulfillment to delivery confirmation — is non-negotiable for anyone in e-commerce support.\n\nOrder statuses to know: Pending → Unfulfilled → Fulfilled → Delivered. Each status transition triggers automated emails and determines what actions support can take.`,
        takeaways: ['Orders in "Pending" status haven\'t been captured yet — payment may still be processing.', 'Only fulfilled orders can generate tracking information.', 'Cancelled orders within 24 hours of placement rarely need manual action.'],
        tips: ['Use the Shopify search with #order_number to jump directly to any order.', 'Order tags are powerful for flagging escalations, VIPs, and special handling.'],
      },
      {
        title: 'Tracking and Fulfillment Workflows', mins: 6,
        body: `When customers ask "Where is my order?" the answer must be fast and accurate. Shopify integrates with most major carriers, but tracking links sometimes lag reality by 12–24 hours.\n\nFulfillment workflow: Order placed → Warehouse picks/packs → Shipping label generated → Carrier scans → Tracking active. Support issues most commonly occur between label generation and first carrier scan — this gap can be 24–48 hours and causes many WISMO tickets.`,
        takeaways: ['A label generated ≠ order shipped. Don\'t assure customers it\'s on its way until the first carrier scan.', 'International shipments can have 7–14 day tracking blackout periods in customs.', 'Proactive delay notifications reduce WISMO tickets by 60–70%.'],
        example: 'Customer: "My tracking hasn\'t updated in 5 days."\n\nResponse: Check if it\'s stuck in customs, contact the carrier, and offer a replacement if it\'s been over your SLA threshold (typically 21 days international, 10 days domestic).',
      },
      {
        title: 'Inventory and Stock Management', mins: 4,
        body: `Overselling is one of the most damaging operational failures. It creates angry customers, refund overhead, and reputation damage. Shopify's inventory tracking, when configured correctly, prevents overselling automatically.\n\nKey settings: Enable "Track quantity" on all SKUs. Use "Continue selling when out of stock" only for made-to-order products. Set up low-stock alerts at 20% of average weekly sales volume.`,
        takeaways: ['Inventory discrepancies are usually caused by unfulfilled returns not being restocked.', 'Pre-order products need separate inventory pools and different customer communication.', 'Bundle products require careful inventory allocation — Shopify doesn\'t always handle this natively.'],
      },
      {
        title: 'Shopify Tools for Support Teams', mins: 4,
        body: `Support teams spend most of their time in Shopify's admin. Speed comes from knowing the shortcuts.\n\nMust-know tools: Customer timeline view (see all orders + history), Order notes (internal communication), Refund flow, Address edit, and the Risk analysis tab for fraud detection.\n\nGorgias integrates directly with Shopify so you can trigger refunds, tag orders, and view customer order history without leaving the helpdesk.`,
        takeaways: ['The Shopify customer timeline is the fastest way to understand a customer\'s entire history.', 'Always leave internal notes on orders when taking support actions.', 'High-risk scores in Shopify\'s fraud analysis should flag the order for manual review before fulfillment.'],
      },
    ],
  },
  {
    id: 'email-comms', examType: 'customer_service',
    num: '04', color: '#3B82F6', label: 'Email & Communication',
    description: 'Write professional, clear, and effective customer emails.',
    sections: [
      {
        title: 'Professional Email Writing', mins: 4,
        body: `Every support email is a representation of your brand. The best support emails are: warm but professional, concise but complete, action-oriented but empathetic.\n\nStructure every email: greeting → acknowledgment → resolution → close. Avoid walls of text — use short paragraphs (2–3 sentences max) and bullet points for multi-step instructions.`,
        takeaways: ['Keep first-response emails under 120 words where possible.', 'One email should address one issue — don\'t bundle multiple resolutions.', 'Active voice reads faster and feels more decisive: "I\'ve issued your refund" vs "A refund has been issued."'],
        tips: ['Read every email aloud before sending — if it sounds stiff, it reads stiff.', 'Avoid "Unfortunately" as an opener — it front-loads negativity.'],
      },
      {
        title: 'Macro and Template Strategy', mins: 5,
        body: `Macros are pre-written response templates for common scenarios. A good macro library reduces average handle time by 40–60% while maintaining response quality.\n\nMacro structure: Greeting token → Situation-specific body → Resolution → Personalization gap → Close. The personalization gap is a placeholder where agents add something specific — this prevents robotic responses.\n\nCategories to build macros for: WISMO, refund approved, refund declined, exchange request, damaged item, product inquiry, order cancellation.`,
        takeaways: ['Macros should be starting points, not copy-paste finals — always personalize.', 'Review and update macros quarterly — product and policy changes make old macros inaccurate.', 'Track which macros generate the most follow-up questions and rewrite those first.'],
        example: 'Macro: WISMO — Good\n"Hi {{customer.first_name}}, thanks for reaching out! Your order #{{order.number}} was shipped on {{date}} via [carrier]. Based on the estimate, you should receive it by [date]. [PERSONALIZE HERE]. Let me know if you need anything else!"',
      },
      {
        title: 'Response Time SLAs', mins: 4,
        body: `Response time SLAs (Service Level Agreements) define how quickly you commit to responding. Most e-commerce customers expect first response within 24 hours, with resolution within 48–72 hours.\n\nPriority tiering:\nP1 (< 2h): Disputes, chargebacks, legal threats, high-value orders (€500+)\nP2 (< 8h): Refund requests, damaged products, missing orders\nP3 (< 24h): Product questions, general inquiries, order modifications`,
        takeaways: ['SLA compliance rate should be above 90% — below 80% indicates staffing or process issues.', 'Automate P3 acknowledgment emails so customers know you\'ve seen their ticket.', 'Escalation paths must be clear — every agent should know exactly who to escalate to and when.'],
      },
    ],
  },
  {
    id: 'dispute-mgmt', examType: 'dispute_management',
    num: '05', color: '#F59E0B', label: 'Dispute Management',
    description: 'Win chargebacks and prevent disputes before they happen.',
    sections: [
      {
        title: 'Understanding Chargebacks', mins: 5,
        body: `A chargeback occurs when a customer disputes a transaction with their bank. The bank reverses the charge and the merchant must provide evidence to dispute it — otherwise the money is gone, plus a chargeback fee (typically €15–€25).\n\nChargeback reasons: Item not received (INR), Significantly not as described (SNAD), Unauthorized transaction (fraud), Duplicate charge.\n\nChargeback rate above 1% of transactions triggers card processor scrutiny. Above 2%, you risk losing your merchant account.`,
        takeaways: ['Most chargebacks can be prevented with proactive communication.', 'Document everything — shipping confirmation, tracking, delivery confirmation.', 'Authorize.net and Stripe both flag accounts that exceed 0.9% chargeback rate.'],
        tips: ['Send proactive shipping + delivery confirmation emails to reduce INR claims.', 'Use signature confirmation for orders over €200.'],
      },
      {
        title: 'Dispute Prevention Strategies', mins: 5,
        body: `The best way to win a chargeback is to prevent it. Dispute prevention operates at every stage of the order lifecycle.\n\nAt purchase: Clear product descriptions, accurate photos, prominent policies.\nAt fulfillment: Tracking confirmation emails with carrier links.\nAt delivery: Delivery confirmation email with "did everything arrive OK?" CTA.\nPost-delivery: Proactive outreach for high-value or complex orders.`,
        takeaways: ['3D Secure reduces unauthorized transaction disputes by up to 80%.', 'Clear, timestamped communication records are your best defense.', 'Offering a refund before a dispute is filed is almost always cheaper than fighting it.'],
      },
      {
        title: 'Building a Winning Dispute Response', mins: 6,
        body: `When a chargeback is filed, you have a limited window (typically 7–21 days depending on card network) to respond with evidence.\n\nEvidence package checklist:\n1. Transaction details (amount, date, email used)\n2. Proof of delivery (tracking with delivery confirmation)\n3. Customer communication history (emails, timestamps)\n4. Your refund/return policy (screenshot or link)\n5. IP address and geolocation of purchase\n6. Photos of the product shipped (if SNAD claim)`,
        takeaways: ['Organized, timestamped evidence wins disputes. Walls of text lose them.', 'Include the exact tracking URL, not just the tracking number.', 'Never include aggressive language in dispute responses.'],
        example: 'Evidence summary for INR dispute:\n"Order #4521 was placed Feb 14 and shipped Feb 15 via DHL (tracking: 1234567890). Tracking confirms delivery Feb 18 at 2:34 PM to the address provided at checkout. Customer contacted us Feb 20 stating non-receipt. We provided tracking on Feb 20 (see attached). No further contact before this dispute was filed."',
      },
      {
        title: 'PayPal Disputes and Claims', mins: 4,
        body: `PayPal disputes follow a separate process from card chargebacks but carry the same risks. PayPal's Seller Protection covers INR and SNAD claims if you meet the requirements: tracked shipping to the confirmed address, proof of delivery, and transaction within policy limits.\n\nPayPal dispute escalation: Inquiry (2–20 days) → Dispute (20 days) → Claim (escalated to PayPal to decide). Respond at the inquiry stage — it's faster, cheaper, and more likely to be resolved without PayPal involvement.`,
        takeaways: ['PayPal Seller Protection requires shipment to the confirmed PayPal address — always use that address.', 'Respond to PayPal inquiries within 3 days — delays signal weakness.', 'Screenshots of your PayPal transaction details are valid evidence.'],
      },
    ],
  },
  {
    id: 'performance-kpis', examType: 'overall_manager',
    num: '06', color: '#8B5CF6', label: 'Performance & KPIs',
    description: 'Track what matters and use data to drive continuous improvement.',
    sections: [
      {
        title: 'Key Metrics Every CS Manager Must Track', mins: 5,
        body: `You cannot improve what you don't measure. The essential metrics for e-commerce customer service:\n\nFCR (First Contact Resolution): % of tickets resolved without follow-up. Target: >75%\nCSAT (Customer Satisfaction): Post-resolution survey score. Target: >4.4/5\nAHT (Average Handle Time): Time from ticket open to close.\nResponse Time: Time to first response. Target: <4h during business hours.\nChargeback Rate: % of transactions disputed. Target: <0.5%\nRefund Rate: % of orders refunded. Healthy range: 1–5%.`,
        takeaways: ['FCR is the strongest predictor of customer satisfaction — prioritize it above all.', 'CSAT below 4.0 is a warning sign. Below 3.5 requires immediate intervention.', 'AHT should not be optimized at the expense of quality — rushed resolutions cause follow-up tickets.'],
        tips: ['Run weekly KPI reviews — monthly is too slow to catch trends.', 'Break down metrics by ticket category.'],
      },
      {
        title: 'Setting Up Reporting and Dashboards', mins: 4,
        body: `Data is useless without visibility. A good reporting setup gives you real-time access to ticket volume, resolution rates, and team performance.\n\nGorgias dashboards provide most of the CS metrics you need: response time, resolution time, CSAT, ticket volume by tag. Supplement with Shopify's analytics for refund rates and order data.\n\nWeekly report template:\n— Tickets received vs last week (+/-%)\n— FCR rate\n— CSAT average\n— Average response time\n— Top 3 ticket categories\n— Open tickets aging >72h`,
        takeaways: ['Ticket volume spikes often predict refund spikes 48–72 hours later.', 'Aging tickets (open >72h) are your biggest CSAT risk — review them daily.', 'Tag consistency is essential — garbage tags produce garbage data.'],
      },
      {
        title: 'Continuous Improvement Process', mins: 5,
        body: `Great CS operations don't happen by accident — they're the result of deliberate weekly improvement cycles.\n\nThe improvement cycle: Measure → Identify → Root cause → Implement → Measure again.\n\nCommon root cause patterns:\nHigh WISMO volume → Improve shipping notification emails or shipping speed\nHigh refund rate → Product quality issue, listing accuracy, or sizing chart\nLow FCR → Agents lack authority to resolve, policy is unclear, or training gaps\nSlow response time → Understaffed, inefficient routing, or too many channels`,
        takeaways: ['Never implement more than 2 changes simultaneously — you won\'t know what worked.', 'Involve agents in improvement discussions — they surface problems management doesn\'t see.', 'Celebrate improvements publicly — it builds a quality culture.'],
      },
    ],
  },
]

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
  .ac * { box-sizing: border-box; margin: 0; padding: 0; }
  .ac { font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }

  /* Remove sidebar right border — causes white line against the white module panel */
  .ac .sb-root { border-right: none; }

  /* Scrollbars */
  .ac-scroll::-webkit-scrollbar { width: 3px; }
  .ac-scroll::-webkit-scrollbar-track { background: transparent; }
  .ac-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

  /* Sidebar items */
  .ac-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 14px; border-radius: 8px; cursor: pointer;
    transition: all 0.15s ease; position: relative;
    border-left: 2px solid transparent;
  }
  .ac-nav-item:hover { background: rgba(0,0,0,0.03); }
  .ac-nav-item.active {
    background: rgba(139,92,246,0.08);
    border-left-color: #8B5CF6;
  }
  .ac-nav-item.done { opacity: 0.55; }

  .ac-sub-item {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 14px 6px 42px; border-radius: 6px; cursor: pointer;
    transition: all 0.12s ease; font-size: 12px;
    color: #9CA3AF;
  }
  .ac-sub-item:hover { background: rgba(0,0,0,0.03); color: #374151; }
  .ac-sub-item.active { color: #0F0F10; }
  .ac-sub-item.done { color: #6B7280; }

  /* Lesson rows */
  .ac-lesson-row {
    display: flex; align-items: center; gap: 16px;
    background: #FFFFFF;
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 10px; padding: 16px 20px; margin-bottom: 8px;
    cursor: pointer; transition: all 0.15s ease;
  }
  .ac-lesson-row:hover {
    background: #F9F9FB;
    border-color: rgba(139,92,246,0.2);
    transform: translateX(2px);
  }

  /* Quiz options */
  .ac-option {
    background: #FFFFFF;
    border: 1px solid rgba(0,0,0,0.09);
    border-radius: 12px; padding: 16px 20px;
    display: flex; align-items: center; gap: 16px;
    cursor: pointer; transition: all 0.15s ease; margin-bottom: 10px;
  }
  .ac-option:hover {
    background: #F9F9FB;
    border-color: rgba(139,92,246,0.3);
  }
  .ac-option.selected {
    background: rgba(139,92,246,0.06);
    border-color: #8B5CF6;
  }
  .ac-option.correct {
    background: rgba(16,185,129,0.06);
    border-color: #10B981;
  }
  .ac-option.incorrect {
    background: rgba(239,68,68,0.06);
    border-color: #EF4444;
  }

  .ac-radio {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,0.2);
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .ac-option:hover .ac-radio { border-color: #8B5CF6; }
  .ac-option.selected .ac-radio { background: #8B5CF6; border-color: #8B5CF6; }
  .ac-option.correct .ac-radio { background: #10B981; border-color: #10B981; }
  .ac-option.incorrect .ac-radio { background: #EF4444; border-color: #EF4444; }

  /* Buttons */
  .ac-btn-primary {
    background: linear-gradient(135deg, #8B5CF6, #6366F1);
    color: #FFFFFF; border: none; border-radius: 20px;
    padding: 10px 24px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
    box-shadow: 0 4px 16px rgba(99,102,241,0.3);
  }
  .ac-btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
  .ac-btn-primary:disabled { opacity: 0.35; cursor: not-allowed; transform: none; filter: none; }

  .ac-btn-secondary {
    background: rgba(0,0,0,0.04);
    border: 1px solid rgba(0,0,0,0.09);
    color: #6B7280; border-radius: 20px;
    padding: 10px 20px; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .ac-btn-secondary:hover { background: rgba(0,0,0,0.07); color: #374151; }

  .ac-btn-green {
    background: linear-gradient(135deg, #10B981, #059669);
    color: #FFFFFF; border: none; border-radius: 20px;
    padding: 10px 22px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
    box-shadow: 0 4px 16px rgba(16,185,129,0.3);
  }
  .ac-btn-green:hover { filter: brightness(1.1); transform: translateY(-1px); }

  .ac-btn-complete {
    background: rgba(16,185,129,0.12);
    border: 1px solid rgba(16,185,129,0.3);
    color: #10B981; border-radius: 20px;
    padding: 10px 20px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
    display: flex; align-items: center; gap: 7px;
  }
  .ac-btn-complete:hover { background: rgba(16,185,129,0.2); }

  /* CTA on welcome */
  .ac-cta {
    background: linear-gradient(135deg, #8B5CF6, #6366F1);
    color: #FFFFFF; border: none; border-radius: 10px;
    padding: 12px 28px; font-size: 14px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
    box-shadow: 0 4px 20px rgba(139,92,246,0.4);
  }
  .ac-cta:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 8px 28px rgba(139,92,246,0.5); }

  @keyframes ac-spin { to { transform: rotate(360deg); } }
  @keyframes ac-pulse {
    0%,100% { opacity: 0.6; transform: scale(1); }
    50%      { opacity: 1;   transform: scale(1.05); }
  }
  @keyframes ac-float {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(40px,-50px) scale(1.05); }
    66%      { transform: translate(-30px,30px) scale(0.95); }
  }
  @keyframes ac-shimmer {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
  }
`

// ─── Small helpers ────────────────────────────────────────────────────────────

const CheckIcon = ({ size = 14, color = '#10B981' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const LockIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

function ModuleIcon({ id, color, size = 16 }) {
  const paths = {
    'cs-fundamentals':  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>,
    'refund-handling':  <><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></>,
    'shopify-ops':      <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>,
    'email-comms':      <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    'dispute-mgmt':     <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    'performance-kpis': <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[id] || <circle cx="12" cy="12" r="10"/>}
    </svg>
  )
}


// ─── Topbar ───────────────────────────────────────────────────────────────────

function Topbar({ view, selectedModule, selectedLesson, passedTypes, userName, onGoWelcome, onGoModule }) {
  const completed = MODULES.filter(m => passedTypes.includes(m.examType)).length
  const pct       = Math.round((completed / MODULES.length) * 100)

  const breadcrumb = () => {
    if (view === 'welcome') return null
    if (view === 'module') return (
      <>
        <span onClick={onGoWelcome} style={{ cursor: 'pointer', color: '#6B7280', transition: 'color 0.1s' }}
          onMouseEnter={e=>e.target.style.color='#374151'}
          onMouseLeave={e=>e.target.style.color='#6B7280'}>Academy</span>
        <span style={{ color: 'rgba(0,0,0,0.2)', margin: '0 6px' }}>›</span>
        <span style={{ color: '#0F0F10', fontWeight: 500 }}>{selectedModule?.label}</span>
      </>
    )
    if (view === 'lesson') return (
      <>
        <span onClick={onGoWelcome} style={{ cursor: 'pointer', color: '#6B7280' }}>Academy</span>
        <span style={{ color: 'rgba(0,0,0,0.2)', margin: '0 6px' }}>›</span>
        <span onClick={onGoModule} style={{ cursor: 'pointer', color: '#6B7280' }}>{selectedModule?.label}</span>
        <span style={{ color: 'rgba(0,0,0,0.2)', margin: '0 6px' }}>›</span>
        <span style={{ color: '#0F0F10', fontWeight: 500 }}>{selectedModule?.sections[selectedLesson]?.title}</span>
      </>
    )
    if (view === 'quiz') return (
      <>
        <span onClick={onGoWelcome} style={{ cursor: 'pointer', color: '#6B7280' }}>Academy</span>
        <span style={{ color: 'rgba(0,0,0,0.2)', margin: '0 6px' }}>›</span>
        <span onClick={onGoModule} style={{ cursor: 'pointer', color: '#6B7280' }}>{selectedModule?.label}</span>
        <span style={{ color: 'rgba(0,0,0,0.2)', margin: '0 6px' }}>›</span>
        <span style={{ color: '#0F0F10', fontWeight: 500 }}>Quiz</span>
      </>
    )
    if (view === 'certificate') return (
      <>
        <span onClick={onGoWelcome} style={{ cursor: 'pointer', color: '#6B7280' }}>Academy</span>
        <span style={{ color: 'rgba(0,0,0,0.2)', margin: '0 6px' }}>›</span>
        <span style={{ color: '#0F0F10', fontWeight: 500 }}>Certificate</span>
      </>
    )
    return null
  }

  return (
    <div style={{ height: 52, background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0 }}>
      <div style={{ flex: 1, fontSize: 13, display: 'flex', alignItems: 'center' }}>{breadcrumb()}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: 'rgba(161,117,252,1)' }}>
          {pct}% complete
        </div>
        {userName && (
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.1)', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Welcome View ─────────────────────────────────────────────────────────────

function WelcomeView({ passedTypes, onSelectModule }) {
  const completed = MODULES.filter(m => passedTypes.includes(m.examType)).length
  const allDone   = completed === MODULES.length

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: '40px 24px' }}>
      {/* Orbs */}
      <motion.div animate={{ x:[0,40,-30,0], y:[0,-50,30,0] }} transition={{ duration:20, repeat:Infinity, ease:'easeInOut' }}
        style={{ position:'absolute', top:'-15%', right:'-5%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.10),transparent 70%)', filter:'blur(80px)', pointerEvents:'none', opacity:0.5 }} />
      <motion.div animate={{ x:[0,-40,20,0], y:[0,40,-20,0] }} transition={{ duration:25, repeat:Infinity, ease:'easeInOut' }}
        style={{ position:'absolute', bottom:'-10%', left:'-5%', width:550, height:550, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.08),transparent 70%)', filter:'blur(80px)', pointerEvents:'none', opacity:0.5 }} />
      <motion.div animate={{ x:[0,20,-15,0], y:[0,-20,15,0] }} transition={{ duration:18, repeat:Infinity, ease:'easeInOut' }}
        style={{ position:'absolute', top:'30%', left:'20%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.06),transparent 70%)', filter:'blur(80px)', pointerEvents:'none', opacity:0.5 }} />

      {/* Content */}
      <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', maxWidth:620 }}>

        {/* Spinning icon */}
        <motion.div initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} transition={{ duration:0.6, ease:EASE }} style={{ position:'relative', width:100, height:100, marginBottom:28 }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid rgba(139,92,246,0.3)', borderTopColor:'#8B5CF6', animation:'ac-spin 3s linear infinite' }} />
          <div style={{ position:'absolute', inset:8, borderRadius:'50%', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.25)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
        </motion.div>

        {/* Badge */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1, duration:0.5, ease:EASE }}
          style={{ background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.15)', borderRadius:20, padding:'4px 14px', marginBottom:18, display:'inline-block' }}>
          <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#7C3AED' }}>Lynq Academy</span>
        </motion.div>

        {/* Title */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15, duration:0.6, ease:EASE }}>
          <h1 style={{ fontSize:'clamp(36px,5vw,52px)', fontWeight:800, letterSpacing:'-0.03em', lineHeight:1.08, color:'#0F0F10', marginBottom:0 }}>Master E-commerce</h1>
          <h1 style={{ fontSize:'clamp(36px,5vw,52px)', fontWeight:800, letterSpacing:'-0.03em', lineHeight:1.08, background:'linear-gradient(135deg,#8B5CF6,#6366F1,#3B82F6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', marginBottom:18 }}>Operations</h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.22, duration:0.5, ease:EASE }}
          style={{ fontSize:16, color:'#6B7280', lineHeight:1.65, maxWidth:440, marginBottom:28 }}>
          Your complete training program for e-commerce customer service and backend operations.
        </motion.p>

        {/* Stats */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3, duration:0.5, ease:EASE }}
          style={{ display:'flex', gap:10, marginBottom:28, flexWrap:'wrap', justifyContent:'center' }}>
          {[
            { icon:<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>, text:'6 Modules' },
            { icon:<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, text:'~4 Hours' },
            { icon:<><polyline points="20 6 9 17 4 12"/></>, text:'Certificate' },
          ].map(({ icon, text }, i) => (
            <div key={i} style={{ background:'#F5F5F5', border:'1px solid rgba(0,0,0,0.08)', borderRadius:20, padding:'8px 16px', display:'flex', alignItems:'center', gap:7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
              <span style={{ fontSize:13, fontWeight:500, color:'#555555' }}>{text}</span>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.38, duration:0.5, ease:EASE }}>
          <button className="ac-cta" onClick={() => onSelectModule(MODULES[0])}>
            {completed > 0 ? 'Continue Learning →' : 'Start Learning →'}
          </button>
        </motion.div>

        {/* Module pills */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.55, duration:0.6 }}
          style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginTop:32 }}>
          {MODULES.map((mod, i) => {
            const done = passedTypes.includes(mod.examType)
            return (
              <motion.div key={mod.id} initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ delay:0.55 + i*0.06 }}
                onClick={() => onSelectModule(mod)}
                style={{ background:'#F5F5F5', border:`1px solid ${done ? mod.color + '40' : 'rgba(0,0,0,0.08)'}`, borderRadius:20, padding:'6px 14px', display:'flex', alignItems:'center', gap:7, cursor:'pointer', transition:'all 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(0,0,0,0.06)'}
                onMouseLeave={e=>e.currentTarget.style.background='#F5F5F5'}
              >
                <div style={{ width:7, height:7, borderRadius:'50%', background:done ? '#10B981' : mod.color, flexShrink:0 }} />
                <span style={{ fontSize:12, fontWeight:500, color:'#555555' }}>{mod.label}</span>
                {done && <CheckIcon size={11} color="#10B981" />}
              </motion.div>
            )
          })}
        </motion.div>

        {allDone && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.7 }} style={{ marginTop:20 }}>
            <button className="ac-btn-green" onClick={() => {}/* handled by parent */}>View Certificate →</button>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── Module Overview View ─────────────────────────────────────────────────────

function ModuleView({ mod, passedTypes, readMap, onSelectLesson, onStartQuiz, onBack }) {
  const isDone      = passedTypes.includes(mod.examType)
  const readCount   = mod.sections.filter((_, i) => readMap[readKey(mod.id, i)]).length
  const allRead     = readCount === mod.sections.length
  const pct         = Math.round((readCount / mod.sections.length) * 100)
  const r = 36, stroke = 5, circ = 2 * Math.PI * r, offset = circ - (pct / 100) * circ

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

      {/* Module header */}
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, ease:EASE }}
        style={{ background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.12)', borderRadius:12, padding:'24px 28px', marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'center', gap:20 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:mod.color, marginBottom:10 }}>Module {mod.num}</div>
          <h2 style={{ fontSize:24, fontWeight:700, color:'#0F0F10', letterSpacing:'-0.025em', marginBottom:8 }}>{mod.label}</h2>
          <p style={{ fontSize:14, color:'#6B7280', lineHeight:1.6 }}>{mod.description}</p>
          <div style={{ display:'flex', gap:16, marginTop:14 }}>
            <span style={{ fontSize:12, color:'#9CA3AF' }}>{mod.sections.length} lessons</span>
            {isDone && <span style={{ fontSize:12, color:'#10B981', fontWeight:600 }}>✓ Completed</span>}
          </div>
        </div>
        {/* Progress ring */}
        <div style={{ position:'relative', flexShrink:0 }}>
          <svg width={82} height={82} viewBox={`0 0 ${r*2+stroke} ${r*2+stroke}`} style={{ transform:'rotate(-90deg)' }}>
            <circle cx={r+stroke/2} cy={r+stroke/2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
            <circle cx={r+stroke/2} cy={r+stroke/2} r={r} fill="none" stroke={isDone ? '#10B981' : mod.color} strokeWidth={stroke}
              strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{ transition:'stroke-dashoffset 0.8s ease' }} />
          </svg>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
            <span style={{ fontSize:18, fontWeight:700, color:'#0F0F10' }}>{isDone ? '✓' : pct + '%'}</span>
          </div>
        </div>
      </motion.div>

      {/* Lessons list */}
      <div>
        {mod.sections.map((sec, i) => {
          const isRead = !!readMap[readKey(mod.id, i)]
          return (
            <motion.div key={i}
              className="ac-lesson-row"
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.1 + i*0.06, duration:0.4, ease:EASE }}
              onClick={() => onSelectLesson(i)}
            >
              {/* Status icon */}
              <div style={{ width:34, height:34, borderRadius:'50%', background:isRead ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.12)', border:`1px solid ${isRead ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.25)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {isRead
                  ? <CheckIcon size={14} color="#10B981" />
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="#6366F1"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                }
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:500, color:'#0F0F10', marginBottom:3 }}>{sec.title}</div>
                <div style={{ display:'flex', gap:8 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'rgba(96,165,250,1)', background:'rgba(59,130,246,0.10)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:4, padding:'1px 6px' }}>TEXT</span>
                  {isRead && <span style={{ fontSize:11, color:'#9CA3AF' }}>Completed</span>}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                <span style={{ fontSize:12, color:'#9CA3AF' }}>{sec.mins} min</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </motion.div>
          )
        })}

        {/* Quiz row */}
        <motion.div
          className="ac-lesson-row"
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
          transition={{ delay:0.1 + mod.sections.length*0.06, duration:0.4, ease:EASE }}
          onClick={allRead && !isDone ? onStartQuiz : undefined}
          style={{ opacity: allRead || isDone ? 1 : 0.4, cursor: allRead || isDone ? 'pointer' : 'default' }}
        >
          <div style={{ width:34, height:34, borderRadius:'50%', background:isDone ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)', border:`1px solid ${isDone ? 'rgba(16,185,129,0.3)' : 'rgba(139,92,246,0.3)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {isDone
              ? <CheckIcon size={14} color="#10B981" />
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            }
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:500, color:'#0F0F10', marginBottom:3 }}>Module Quiz</div>
            <div style={{ display:'flex', gap:8 }}>
              <span style={{ fontSize:11, fontWeight:600, color:'rgba(161,117,252,1)', background:'rgba(139,92,246,0.10)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:4, padding:'1px 6px' }}>QUIZ</span>
              {!allRead && !isDone && <span style={{ fontSize:11, color:'#9CA3AF' }}>Read all lessons to unlock</span>}
              {isDone && <span style={{ fontSize:11, color:'#10B981' }}>Passed</span>}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            {!allRead && !isDone && <LockIcon />}
            {(allRead || isDone) && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Lesson Content View ──────────────────────────────────────────────────────

function LessonView({ mod, lessonIdx, readMap, onMarkRead, onBack, onNext, onPrev, onStartQuiz, passedTypes }) {
  const sec       = mod.sections[lessonIdx]
  const isRead    = !!readMap[readKey(mod.id, lessonIdx)]
  const isLast    = lessonIdx === mod.sections.length - 1
  const allRead   = mod.sections.every((_, i) => readMap[readKey(mod.id, i)])
  const isDone    = passedTypes.includes(mod.examType)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

      {/* Progress bar */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.4 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <span style={{ fontSize:12, color:'#9CA3AF' }}>Lesson {lessonIdx + 1} of {mod.sections.length}</span>
          <span style={{ fontSize:12, color:'#9CA3AF' }}>{mod.label}</span>
        </div>
        <div style={{ height:3, borderRadius:10, background:'rgba(0,0,0,0.08)', marginBottom:28, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:10, background:'linear-gradient(90deg,#3B82F6,#6366F1)', width:`${((lessonIdx+1)/mod.sections.length)*100}%`, transition:'width 0.4s ease' }} />
        </div>
      </motion.div>

      {/* Title */}
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, ease:EASE }}>
        <h2 style={{ fontSize:28, fontWeight:700, color:'#0F0F10', letterSpacing:'-0.02em', marginBottom:24, lineHeight:1.25 }}>{sec.title}</h2>
      </motion.div>

      {/* Content */}
      <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1, duration:0.5, ease:EASE }}>
        {sec.body.split('\n').map((para, pi) => para.trim() && (
          para.match(/^\d+\./) || para.match(/^P[1-3]/)
            ? <div key={pi} style={{ display:'flex', gap:10, marginBottom:10 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#6366F1', flexShrink:0, marginTop:9 }} />
                <p style={{ fontSize:16, color:'#374151', lineHeight:1.8 }}>{para}</p>
              </div>
            : <p key={pi} style={{ fontSize:16, color:'#374151', lineHeight:1.8, marginBottom:16 }}>{para}</p>
        ))}

        {/* Tips */}
        {sec.tips?.map((tip, ti) => (
          <div key={ti} style={{ background:'rgba(99,102,241,0.05)', borderLeft:'3px solid #6366F1', borderRadius:'0 8px 8px 0', padding:'14px 18px', marginBottom:12 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#6366F1', marginRight:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>TIP</span>
            <span style={{ fontSize:15, color:'#374151' }}>{tip}</span>
          </div>
        ))}

        {/* Takeaways */}
        {sec.takeaways && (
          <div style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:10, padding:'18px 20px', marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#10B981', marginBottom:12 }}>Key Takeaways</div>
            {sec.takeaways.map((t, ti) => (
              <div key={ti} style={{ display:'flex', gap:10, marginBottom:8 }}>
                <CheckIcon size={13} color="#10B981" />
                <span style={{ fontSize:14, color:'#374151', lineHeight:1.55 }}>{t}</span>
              </div>
            ))}
          </div>
        )}

        {/* Example */}
        {sec.example && (
          <div style={{ background:'rgba(0,0,0,0.03)', border:'1px solid rgba(0,0,0,0.08)', borderRadius:10, padding:18, marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9CA3AF', marginBottom:10 }}>Example</div>
            <pre style={{ fontSize:13, color:'#374151', lineHeight:1.7, whiteSpace:'pre-wrap', fontFamily:'inherit' }}>{sec.example}</pre>
          </div>
        )}
      </motion.div>

      {/* Navigation */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3, duration:0.4 }}
        style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:32, gap:12, flexWrap:'wrap' }}>
        <button className="ac-btn-secondary" onClick={onPrev} disabled={lessonIdx === 0} style={{ opacity: lessonIdx === 0 ? 0.35 : 1 }}>← Previous</button>
        <div style={{ display:'flex', gap:10 }}>
          {!isRead && (
            <button className="ac-btn-complete" onClick={() => onMarkRead(lessonIdx)}>
              <CheckIcon size={13} color="#10B981" /> Mark as complete
            </button>
          )}
          {isLast && allRead && !isDone
            ? <button className="ac-btn-primary" onClick={onStartQuiz}>Take the quiz →</button>
            : isLast
              ? null
              : <button className="ac-btn-primary" onClick={onNext}>Next lesson →</button>
          }
          {isLast && isDone && <button className="ac-btn-secondary" onClick={onBack}>Back to module</button>}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Quiz View ────────────────────────────────────────────────────────────────

function QuizView({ mod, session, onBack, onComplete }) {
  const [questions,  setQuestions]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [current,    setCurrent]    = useState(0)
  const [answers,    setAnswers]    = useState({})
  const [submitted,  setSubmitted]  = useState(false)
  const [result,     setResult]     = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [canAttempt, setCanAttempt] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/exams/questions?type=${mod.examType}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load questions')
        setCanAttempt(data.canAttempt ?? true)
        setQuestions(data.questions || [])
      } catch (e) { setError(e.message) }
      finally     { setLoading(false) }
    }
    load()
  }, [mod.examType, session])

  async function submitQuiz() {
    setSubmitting(true)
    try {
      const formattedAnswers = questions.map(q => ({ question_id: q.id, selected_index: answers[q.id] ?? null }))
      const res  = await fetch('/api/exams/submit', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` }, body:JSON.stringify({ exam_type:mod.examType, answers:formattedAnswers }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setResult(data); setSubmitted(true)
    } catch (e) { setError(e.message) }
    finally     { setSubmitting(false) }
  }

  const LoadSpinner = () => (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:400 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:32, height:32, border:'3px solid rgba(0,0,0,0.08)', borderTop:'3px solid #8B5CF6', borderRadius:'50%', animation:'ac-spin .7s linear infinite', margin:'0 auto 12px' }} />
        <div style={{ fontSize:13, color:'#9CA3AF' }}>Loading questions…</div>
      </div>
    </div>
  )

  if (loading) return <LoadSpinner />
  if (error) return (
    <div style={{ padding:40, textAlign:'center' }}>
      <div style={{ fontSize:14, color:'#EF4444', marginBottom:16 }}>{error}</div>
      <button className="ac-btn-secondary" onClick={onBack}>← Back</button>
    </div>
  )
  if (!canAttempt) return (
    <div style={{ padding:40, textAlign:'center', maxWidth:500, margin:'80px auto' }}>
      <div style={{ fontSize:36, marginBottom:16 }}>⛔</div>
      <div style={{ fontSize:20, fontWeight:700, color:'#0F0F10', marginBottom:8 }}>Maximum attempts reached</div>
      <div style={{ fontSize:14, color:'#6B7280', marginBottom:24 }}>You have used all 3 attempts for this module's exam.</div>
      <button className="ac-btn-secondary" onClick={onBack}>← Back to module</button>
    </div>
  )
  if (questions.length === 0) return (
    <div style={{ padding:40, textAlign:'center', maxWidth:500, margin:'80px auto' }}>
      <div style={{ fontSize:14, color:'#6B7280', marginBottom:16 }}>No questions available for this module yet.</div>
      <button className="ac-btn-secondary" onClick={onBack}>← Back</button>
    </div>
  )

  // Results screen
  if (submitted && result) {
    const pct    = result.score ?? 0
    const passed = result.passed ?? pct >= PASS_THRESHOLD
    const ringR  = 70, rStroke = 8, rCirc = 2 * Math.PI * ringR
    const rOffset = rCirc - (pct / 100) * rCirc

    return (
      <div style={{ maxWidth:680, margin:'0 auto', padding:'48px 24px', textAlign:'center' }}>
        <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} transition={{ duration:0.5, ease:EASE }}>
          {/* Score ring */}
          <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:24 }}>
            <svg width="158" height="158" viewBox="0 0 158 158" style={{ transform:'rotate(-90deg)' }}>
              <circle cx="79" cy="79" r={ringR} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={rStroke} />
              <motion.circle cx="79" cy="79" r={ringR} fill="none"
                stroke={passed ? '#10B981' : '#EF4444'} strokeWidth={rStroke}
                strokeLinecap="round" strokeDasharray={rCirc}
                initial={{ strokeDashoffset: rCirc }}
                animate={{ strokeDashoffset: rOffset }}
                transition={{ duration:1.5, ease:'easeOut', delay:0.3 }}
              />
            </svg>
            <div style={{ position:'absolute', textAlign:'center' }}>
              <div style={{ fontSize:36, fontWeight:800, color:'#0F0F10' }}>{Math.round(pct)}%</div>
              <div style={{ fontSize:11, color:'#9CA3AF' }}>score</div>
            </div>
          </div>

          <h2 style={{ fontSize:24, fontWeight:700, color:'#0F0F10', marginBottom:8, letterSpacing:'-0.02em' }}>
            {passed ? 'Excellent work! 🎉' : 'Keep practicing'}
          </h2>
          <p style={{ fontSize:15, color:'#6B7280', marginBottom:28, lineHeight:1.6 }}>
            {passed
              ? `You passed with ${Math.round(pct)}%. ${mod.label} is now complete!`
              : `You scored ${Math.round(pct)}%. You need ${PASS_THRESHOLD}% to pass. Review the lessons and try again.`}
          </p>

          {/* Answer breakdown */}
          <div style={{ textAlign:'left', marginBottom:28 }}>
            {questions.map((q, qi) => {
              const userIdx    = answers[q.id] ?? null
              const correctIdx = typeof q.correct_answer_index === 'number' ? q.correct_answer_index : null
              const isCorrect  = userIdx !== null && userIdx === correctIdx
              return (
                <div key={q.id} style={{ background:'rgba(0,0,0,0.02)', border:`1px solid rgba(0,0,0,0.06)`, borderRadius:8, padding:'12px 16px', marginBottom:6, display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', border:`1px solid ${isCorrect ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {isCorrect ? <CheckIcon size={10} color="#10B981" /> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                  </div>
                  <span style={{ fontSize:13, color:'#374151', flex:1 }}>Q{qi+1}: {q.question || q.text}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:isCorrect ? '#10B981' : '#EF4444' }}>{isCorrect ? 'Correct' : 'Wrong'}</span>
                </div>
              )
            })}
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            {passed
              ? <button className="ac-btn-green" onClick={onComplete}>Continue →</button>
              : <>
                  <button className="ac-btn-secondary" onClick={onBack}>← Back to lessons</button>
                  <button className="ac-btn-primary" onClick={() => { setSubmitted(false); setResult(null); setAnswers({}); setCurrent(0) }}>Retake quiz</button>
                </>
            }
          </div>
        </motion.div>
      </div>
    )
  }

  const q    = questions[current]
  const opts = q?.options || q?.answer_options || []

  return (
    <div style={{ maxWidth:680, margin:'0 auto', padding:'40px 24px' }}>
      {/* Progress */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#9CA3AF', marginBottom:10 }}>
          Question {current+1} of {questions.length}
        </div>
        <div style={{ height:3, borderRadius:10, background:'rgba(0,0,0,0.08)', overflow:'hidden' }}>
          <motion.div style={{ height:'100%', borderRadius:10, background:'linear-gradient(90deg,#8B5CF6,#6366F1)' }}
            animate={{ width:`${((current+1)/questions.length)*100}%` }} transition={{ duration:0.3 }} />
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div key={current} initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.25, ease:EASE }}>
          <h3 style={{ fontSize:22, fontWeight:700, color:'#0F0F10', letterSpacing:'-0.01em', marginBottom:24, lineHeight:1.4 }}>{q?.question || q?.text}</h3>

          {opts.map((opt, idx) => (
            <motion.div key={idx}
              className={`ac-option ${answers[q.id] === idx ? 'selected' : ''}`}
              initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
              transition={{ delay:idx*0.07, duration:0.3, ease:EASE }}
              onClick={() => setAnswers(prev => ({ ...prev, [q.id]: idx }))}
            >
              <div className="ac-radio">
                {answers[q.id] === idx && <div style={{ width:8, height:8, borderRadius:'50%', background:'#FFFFFF' }} />}
              </div>
              <span style={{ fontSize:15, color:'#0F0F10', flex:1 }}>{opt}</span>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:24 }}>
        <button className="ac-btn-secondary" onClick={() => setCurrent(c => Math.max(0,c-1))} disabled={current===0} style={{ opacity:current===0 ? 0.35 : 1 }}>← Previous</button>
        {current < questions.length-1
          ? <button className="ac-btn-primary" onClick={() => setCurrent(c => c+1)} disabled={answers[q.id] === undefined}>Next →</button>
          : <button className="ac-btn-primary" onClick={submitQuiz} disabled={submitting || Object.keys(answers).length < questions.length}>
              {submitting ? 'Submitting…' : 'Submit Quiz'}
            </button>
        }
      </div>
    </div>
  )
}

// ─── Certificate View ─────────────────────────────────────────────────────────

function CertificateView({ userName, passedTypes, onBack }) {
  const today     = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })

  return (
    <div style={{ padding:'32px 24px' }}>
      <button className="ac-btn-secondary" onClick={onBack} style={{ marginBottom:24, fontSize:12 }}>← Academy</button>

      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} transition={{ duration:0.5, ease:EASE }}>
        <div style={{ background:'#FFFFFF', border:'1px solid rgba(0,0,0,0.07)', borderRadius:16, padding:48, maxWidth:720, margin:'0 auto', textAlign:'center', position:'relative', overflow:'hidden' }}>

          {/* Decorative */}
          <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle,rgba(0,0,0,0.06) 1px,transparent 1px)', backgroundSize:'28px 28px', opacity:0.4, pointerEvents:'none' }} />
          <div style={{ position:'absolute', top:-60, left:-60, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.18),transparent 70%)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.14),transparent 70%)', pointerEvents:'none' }} />

          <div style={{ position:'relative', zIndex:1 }}>
            {/* Logo */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:32 }}>
              <div style={{ width:26, height:26, borderRadius:7, background:'linear-gradient(135deg,#A175FC,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <span style={{ fontSize:14, color:'#6B7280', fontWeight:500 }}>Lynq & Flow Academy</span>
            </div>

            <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', color:'#9CA3AF', marginBottom:16 }}>Certificate of Completion</div>

            <div style={{ fontSize:36, fontWeight:800, color:'#0F0F10', letterSpacing:'-0.025em', marginBottom:8 }}>
              {userName || 'Student'}
            </div>
            <div style={{ fontSize:14, color:'#6B7280', marginBottom:6 }}>has successfully completed the</div>
            <div style={{ fontSize:18, fontWeight:600, background:'linear-gradient(135deg,#8B5CF6,#6366F1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', marginBottom:28 }}>
              E-commerce Customer Service Mastery
            </div>

            <div style={{ height:1, background:'rgba(0,0,0,0.07)', margin:'0 0 20px' }} />

            <div style={{ fontSize:13, color:'#9CA3AF', marginBottom:20 }}>Completed on {today}</div>

            {/* Module badges */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:7, justifyContent:'center', marginBottom:28 }}>
              {MODULES.map(mod => {
                const done = passedTypes.includes(mod.examType)
                return (
                  <div key={mod.id} style={{ background:done ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.03)', border:`1px solid ${done ? mod.color + '40' : 'rgba(0,0,0,0.08)'}`, borderRadius:20, padding:'4px 12px', display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background: done ? mod.color : 'rgba(0,0,0,0.15)' }} />
                    <span style={{ fontSize:11, fontWeight:500, color:done ? '#374151' : '#9CA3AF' }}>{mod.label}</span>
                    {done && <CheckIcon size={10} color="#10B981" />}
                  </div>
                )
              })}
            </div>

            <div style={{ height:1, background:'rgba(0,0,0,0.07)', margin:'0 0 24px' }} />

            {/* Signature */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:32 }}>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:4 }}>Certified by</div>
                <div style={{ fontSize:15, fontWeight:600, color:'#0F0F10' }}>Lynq & Flow</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:4 }}>Date</div>
                <div style={{ fontSize:14, color:'#374151' }}>{today}</div>
              </div>
            </div>

            {/* Seal */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:32 }}>
              <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,#8B5CF6,#6366F1)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', boxShadow:'0 0 30px rgba(139,92,246,0.4)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                </svg>
                <span style={{ fontSize:7, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(255,255,255,0.8)', marginTop:2 }}>Certified</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
              <button className="ac-cta" style={{ borderRadius:8, padding:'11px 22px', fontSize:13 }} onClick={() => window.print()}>
                Download Certificate
              </button>
              <button className="ac-btn-secondary" style={{ borderRadius:8, padding:'11px 22px', fontSize:13 }} onClick={() => {
                const text = `I just earned the E-commerce Customer Service Mastery certificate from Lynq & Flow Academy! 🎓`
                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(text)}`, '_blank')
              }}>
                Share on LinkedIn
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AcademyPage() {
  const [session,      setSession]      = useState(null)
  const [userName,     setUserName]     = useState('')
  const [mounted,      setMounted]      = useState(false)
  const [passedTypes,  setPassedTypes]  = useState([])
  const [readMap,      setReadMap]      = useState({})
  const [view,         setView]         = useState('welcome')
  const [selectedModule, setSelMod]    = useState(null)
  const [selectedLesson, setSelLesson] = useState(0)

  useEffect(() => {
    setMounted(true)
    // Load localStorage read state
    const map = {}
    MODULES.forEach(mod => mod.sections.forEach((_, i) => {
      const k = readKey(mod.id, i)
      if (localStorage.getItem(k) === '1') map[k] = true
    }))
    setReadMap(map)

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) { window.location.href = '/login'; return }
      setSession(s)
      const meta = s.user.user_metadata || {}
      const raw  = (s.user.email || '').split('@')[0]
      setUserName(meta.full_name || meta.name || (raw.charAt(0).toUpperCase() + raw.slice(1)))

      const resultRes  = await fetch('/api/exams/result', { headers: { Authorization: `Bearer ${s.access_token}` } })
      const resultData = await resultRes.json()
      const submissions = resultData.submissions || resultData || []
      const passed = [...new Set(submissions.filter(s => s.passed).map(s => s.exam_type))]
      setPassedTypes(passed)
    })
  }, [])

  function markRead(moduleId, lessonIdx) {
    const k = readKey(moduleId, lessonIdx)
    localStorage.setItem(k, '1')
    setReadMap(prev => ({ ...prev, [k]: true }))
  }

  function handleSelectModule(mod) {
    setSelMod(mod)
    setSelLesson(0)
    setView('module')
  }

  function handleSelectLesson(idx) {
    setSelLesson(idx)
    setView('lesson')
  }

  function handleQuizComplete() {
    if (session) {
      fetch('/api/exams/result', { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.json())
        .then(data => {
          const submissions = data.submissions || data || []
          const passed = [...new Set(submissions.filter(s => s.passed).map(s => s.exam_type))]
          setPassedTypes(passed)
        })
    }
    const allPassed = MODULES.every(m => [...passedTypes, selectedModule?.examType].includes(m.examType))
    setView(allPassed ? 'certificate' : 'module')
  }

  if (!mounted) return null

  const allDone      = MODULES.every(m => passedTypes.includes(m.examType))
  const completedCnt = MODULES.filter(m => passedTypes.includes(m.examType)).length
  const progressPct  = Math.round((completedCnt / MODULES.length) * 100)

  return (
    <div className="ac" style={{ display:'flex', height:'100vh', background:'#F9F9FB', overflow:'hidden' }}>
      <style>{CSS}</style>
      <Sidebar />

      {/* Module list panel */}
      <div style={{ width:280, minWidth:280, height:'100vh', background:'#FFFFFF', borderLeft:'none', borderRight:'1px solid rgba(0,0,0,0.07)', boxShadow:'none', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
        {/* Header */}
        <div style={{ padding:'18px 16px 14px', borderBottom:'1px solid rgba(0,0,0,0.07)', flexShrink:0 }}>
          <div onClick={() => setView('welcome')} style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', marginBottom:14 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#8B5CF6,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 8px rgba(139,92,246,0.4)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <span style={{ fontSize:14, fontWeight:600, color:'#0F0F10' }}>Lynq Academy</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:11, color:'#9CA3AF' }}>{completedCnt} of {MODULES.length} modules complete</span>
            <span style={{ fontSize:12, fontWeight:600, color:'#8B5CF6' }}>{progressPct}%</span>
          </div>
          <div style={{ height:3, borderRadius:10, background:'rgba(0,0,0,0.08)', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:10, background:'linear-gradient(90deg,#8B5CF6,#6366F1)', width:`${progressPct}%`, transition:'width 0.6s ease' }} />
          </div>
        </div>

        {/* Module nav */}
        <div className="ac-scroll" style={{ flex:1, overflowY:'auto', padding:'10px 8px' }}>
          {MODULES.map((mod, mi) => {
            const isDone    = passedTypes.includes(mod.examType)
            const isActive  = selectedModule?.id === mod.id
            const readCount = mod.sections.filter((_, si) => readMap[readKey(mod.id, si)]).length
            return (
              <motion.div key={mod.id} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:mi*0.04, duration:0.3, ease:EASE }}>
                <div className={`ac-nav-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`} onClick={() => handleSelectModule(mod)}>
                  {isDone
                    ? <CheckIcon size={16} color="#10B981" />
                    : <div style={{ width:22, height:22, borderRadius:6, background:isActive ? 'linear-gradient(135deg,#8B5CF6,#6366F1)' : 'rgba(0,0,0,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:isActive ? '#FFF' : '#9CA3AF' }}>{mod.num}</span>
                      </div>
                  }
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:isActive ? 600 : 400, color:isDone ? '#9CA3AF' : isActive ? '#0F0F10' : '#6B7280', textDecoration:isDone ? 'line-through' : 'none', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {mod.label}
                    </div>
                    <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{readCount}/{mod.sections.length} lessons</div>
                  </div>
                </div>
                <AnimatePresence>
                  {isActive && (
                    <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration:0.25, ease:EASE }} style={{ overflow:'hidden' }}>
                      {mod.sections.map((sec, si) => {
                        const isRead        = !!readMap[readKey(mod.id, si)]
                        const isLessonActive = selectedLesson === si && view === 'lesson'
                        return (
                          <div key={si} className={`ac-sub-item ${isLessonActive ? 'active' : ''} ${isRead ? 'done' : ''}`} onClick={() => handleSelectLesson(si)}>
                            <div style={{ width:6, height:6, borderRadius:'50%', background:isRead ? '#10B981' : isLessonActive ? '#6366F1' : 'rgba(0,0,0,0.15)', flexShrink:0 }} />
                            <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sec.title}</span>
                          </div>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <Topbar
          view={view}
          selectedModule={selectedModule}
          selectedLesson={selectedLesson}
          passedTypes={passedTypes}
          userName={userName}
          onGoWelcome={() => setView('welcome')}
          onGoModule={() => setView('module')}
        />

        <div className="ac-scroll" style={{ flex:1, overflowY:'auto' }}>
          <AnimatePresence mode="wait">
            {view === 'welcome' && (
              <motion.div key="welcome" style={{ display:'flex', flex:1, height:'100%' }}
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.25 }}>
                <WelcomeView passedTypes={passedTypes} onSelectModule={handleSelectModule} />
              </motion.div>
            )}
            {view === 'module' && selectedModule && (
              <motion.div key="module" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.3, ease:EASE }}>
                <ModuleView
                  mod={selectedModule} passedTypes={passedTypes} readMap={readMap}
                  onSelectLesson={handleSelectLesson}
                  onStartQuiz={() => setView('quiz')}
                  onBack={() => setView('welcome')}
                />
              </motion.div>
            )}
            {view === 'lesson' && selectedModule && (
              <motion.div key={`lesson-${selectedLesson}`} initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.3, ease:EASE }}>
                <LessonView
                  mod={selectedModule} lessonIdx={selectedLesson} readMap={readMap}
                  passedTypes={passedTypes}
                  onMarkRead={idx => markRead(selectedModule.id, idx)}
                  onBack={() => setView('module')}
                  onNext={() => { const next = selectedLesson + 1; if (next < selectedModule.sections.length) { setSelLesson(next) } else setView('module') }}
                  onPrev={() => { if (selectedLesson > 0) setSelLesson(selectedLesson - 1) }}
                  onStartQuiz={() => setView('quiz')}
                />
              </motion.div>
            )}
            {view === 'quiz' && selectedModule && session && (
              <motion.div key="quiz" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.3, ease:EASE }}>
                <QuizView mod={selectedModule} session={session} onBack={() => setView('module')} onComplete={handleQuizComplete} />
              </motion.div>
            )}
            {view === 'certificate' && (
              <motion.div key="certificate" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.4 }}>
                <CertificateView userName={userName} passedTypes={passedTypes} onBack={() => setView('welcome')} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Certificate banner when all done */}
        {allDone && view === 'welcome' && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.8, duration:0.4 }}
            onClick={() => setView('certificate')}
            style={{ margin:'0 24px 20px', background:'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(99,102,241,0.15))', border:'1px solid rgba(139,92,246,0.3)', borderRadius:10, padding:'14px 20px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', backdropFilter:'blur(10px)' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(139,92,246,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#0F0F10' }}>🎉 All modules completed!</div>
              <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>Click to view and download your certificate</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </motion.div>
        )}
      </div>
    </div>
  )
}
