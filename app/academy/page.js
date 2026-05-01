'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ─── Static module definitions ───────────────────────────────────────────────
const MODULES = [
  {
    id: 'cs-fundamentals',
    examType: 'customer_service',
    num: '01',
    color: '#6366F1',
    title: 'CS Fundamentals',
    description: 'Core principles of world-class e-commerce customer service.',
    lessons: 4,
    sections: [
      {
        title: 'What is Customer Service Excellence?',
        body: 'Customer service excellence in e-commerce goes beyond answering emails quickly. It means anticipating customer needs, resolving issues on the first contact, and leaving every customer feeling genuinely valued — even when the outcome isn\'t what they hoped for.\n\nWorld-class brands like Zappos built their entire identity on service. For e-commerce operators, this means every support interaction is a brand touchpoint that directly affects repeat purchase rate, reviews, and referrals.',
        takeaways: [
          'First Contact Resolution (FCR) is the single most important metric in support.',
          'A resolved complaint often produces a more loyal customer than one who never had a problem.',
          'Tone matters as much as content — warm, human responses outperform templated ones.',
        ],
        tips: [
          'Always acknowledge the customer\'s frustration before jumping to solutions.',
          'Use the customer\'s name at least once in your reply.',
        ],
      },
      {
        title: 'The 5-Step Resolution Framework',
        body: 'Every customer issue can be resolved using a consistent framework: Acknowledge → Empathize → Clarify → Resolve → Follow up.\n\n1. Acknowledge: Confirm you\'ve received and understood their message.\n2. Empathize: Show you understand how they feel without admitting fault.\n3. Clarify: Ask one focused question if information is missing.\n4. Resolve: Offer the best solution within your authority.\n5. Follow up: Close the loop — confirm the resolution worked.',
        takeaways: [
          'Never skip acknowledgment — customers who feel ignored escalate faster.',
          'One clarifying question is better than three. Consolidate your questions.',
          'Follow-up is optional but dramatically improves CSAT scores.',
        ],
        example: 'Bad: "Your order was delayed due to carrier issues."\nGood: "Hi Sarah, I completely understand how frustrating a delayed order is, especially when you were counting on it. I\'ve checked your tracking and your package is now out for delivery — you should receive it by end of day tomorrow. I\'m sorry for the trouble and I\'ve added a 10% discount to your account for next time."',
      },
      {
        title: 'De-escalation Techniques',
        body: 'Angry customers require a different approach. The goal is not to win an argument — it\'s to transform their emotional state from frustrated to calm, then from calm to satisfied.\n\nKey de-escalation principle: never match the customer\'s emotional energy. Stay measured, professional, and solution-focused regardless of tone.',
        takeaways: [
          'Phrases like "I understand your frustration" validate without escalating.',
          'Offering partial solutions early (e.g., a partial refund or voucher) shows good faith.',
          'If a situation is truly unresolvable, escalate immediately rather than stalling.',
        ],
        tips: [
          'Avoid phrases like "per our policy" — they feel dismissive.',
          '"What can I do to make this right?" is one of the most powerful phrases in support.',
        ],
      },
      {
        title: 'Handling Common Scenarios',
        body: 'Mastering the most common support scenarios lets you respond confidently and consistently. In e-commerce, 80% of tickets fall into four categories: WISMO (Where Is My Order), returns/refunds, damaged products, and product questions.\n\nFor WISMO: always check the tracking link before responding and provide a concrete ETA, not a vague "it should arrive soon."\n\nFor damaged products: ask for a photo, apologize sincerely, and offer a replacement or refund — your choice based on the situation.',
        takeaways: [
          'WISMO tickets should be resolved in under 3 minutes with a good Shopify setup.',
          'Photos of damage serve as documentation, not proof the customer is lying.',
          'Product question tickets are a sales opportunity — answer enthusiastically.',
        ],
      },
    ],
  },
  {
    id: 'refund-handling',
    examType: 'dispute_management',
    num: '02',
    color: '#EF4444',
    title: 'Refund Handling',
    description: 'How to handle refunds fairly, efficiently, and profitably.',
    lessons: 3,
    sections: [
      {
        title: 'Refund Policy Fundamentals',
        body: 'A clear refund policy is the foundation of trust. Customers buy from stores with clear, fair policies. Ambiguity increases tickets, reduces conversions, and leads to chargebacks.\n\nBest practice: publish a 30-day return policy and automate standard refund approvals under €75. This reduces support load and increases customer trust significantly.',
        takeaways: [
          'Clear policies reduce inbound refund requests by up to 40%.',
          'Automated refunds for small amounts save more in support cost than they lose in revenue.',
          'Your policy should match the spirit, not just the letter — edge cases need human judgment.',
        ],
        tips: [
          'Add your refund policy link to every order confirmation email.',
          'State the policy positively: "We accept returns within 30 days" vs "Returns are only accepted..."',
        ],
      },
      {
        title: 'When to Approve vs Decline',
        body: 'Not every refund request deserves approval — but erring heavily toward approval builds long-term loyalty. The key is distinguishing between customer error, seller error, and carrier error.\n\nSeller error (wrong item, damaged, defective): always refund or replace, no questions asked.\nCarrier error (lost, delayed beyond threshold): refund and file a claim with the carrier.\nCustomer error (wrong size ordered, changed mind): use your policy, but consider partial goodwill gestures.',
        takeaways: [
          'Seller errors must always result in a full remedy — no exceptions.',
          'Customer-error refunds can include a restocking fee if your policy states it.',
          'Repeat refund requesters from the same account may be committing fraud — flag them.',
        ],
        example: 'Customer: "I ordered the wrong size and want a refund."\nApproach: Check if they\'re within the return window. If yes, approve the return. If slightly outside, consider a store credit as a goodwill gesture — it costs less and retains the customer.',
      },
      {
        title: 'Refund Communication Scripts',
        body: 'How you communicate a refund matters as much as the refund itself. A positive refund experience can turn a disappointed customer into a loyal one.\n\nApproval script template: "Hi [Name], I\'ve processed your refund of [amount] — it should appear in your account within 3–5 business days. I\'m sorry this didn\'t work out, and I hope to see you again soon."\n\nDenial with goodwill: "Hi [Name], I\'m unable to process this as a refund because [reason], but I\'d love to make it right with a [15% discount / store credit]. Would that work for you?"',
        takeaways: [
          'Always state a timeframe for the refund — vague timelines cause follow-up tickets.',
          'A declined refund with an alternative offer is better received than a flat no.',
          'Close every refund interaction with a positive sentiment.',
        ],
      },
    ],
  },
  {
    id: 'shopify-ops',
    examType: 'supply_chain',
    num: '03',
    color: '#10B981',
    title: 'Shopify Operations',
    description: 'Master order management, fulfillment, and inventory on Shopify.',
    lessons: 4,
    sections: [
      {
        title: 'Order Management Essentials',
        body: 'Shopify\'s admin is the operational hub. Understanding its order flow end-to-end — from placement to fulfillment to delivery confirmation — is non-negotiable for anyone in e-commerce support.\n\nOrder statuses to know: Pending → Unfulfilled → Fulfilled → Delivered. Each status transition triggers automated emails and determines what actions support can take.',
        takeaways: [
          'Orders in "Pending" status haven\'t been captured yet — payment may still be processing.',
          'Only fulfilled orders can generate tracking information.',
          'Cancelled orders within 24 hours of placement rarely need manual action.',
        ],
        tips: [
          'Use the Shopify search with #order_number to jump directly to any order.',
          'Order tags are powerful for flagging escalations, VIPs, and special handling.',
        ],
      },
      {
        title: 'Tracking and Fulfillment Workflows',
        body: 'When customers ask "Where is my order?" the answer must be fast and accurate. Shopify integrates with most major carriers, but tracking links sometimes lag reality by 12–24 hours.\n\nFulfillment workflow: Order placed → Warehouse picks/packs → Shipping label generated → Carrier scans → Tracking active. Support issues most commonly occur between label generation and first carrier scan — this gap can be 24–48 hours and causes many WISMO tickets.',
        takeaways: [
          'A label generated ≠ order shipped. Don\'t assure customers it\'s on its way until the first carrier scan.',
          'International shipments can have 7–14 day tracking blackout periods in customs.',
          'Proactive delay notifications reduce WISMO tickets by 60–70%.',
        ],
        example: 'Customer: "My tracking hasn\'t updated in 5 days."\nResponse: Check if it\'s stuck in customs, contact the carrier, and offer a replacement if it\'s been over your SLA threshold (typically 21 days international, 10 days domestic).',
      },
      {
        title: 'Inventory and Stock Management',
        body: 'Overselling is one of the most damaging operational failures. It creates angry customers, refund overhead, and reputation damage. Shopify\'s inventory tracking, when configured correctly, prevents overselling automatically.\n\nKey settings: Enable "Track quantity" on all SKUs. Use "Continue selling when out of stock" only for made-to-order products. Set up low-stock alerts at 20% of average weekly sales volume.',
        takeaways: [
          'Inventory discrepancies are usually caused by unfulfilled returns not being restocked.',
          'Pre-order products need separate inventory pools and different customer communication.',
          'Bundle products require careful inventory allocation — Shopify doesn\'t always handle this natively.',
        ],
      },
      {
        title: 'Shopify Tools for Support Teams',
        body: 'Support teams spend most of their time in Shopify\'s admin. Speed comes from knowing the shortcuts.\n\nMust-know tools: Customer timeline view (see all orders + history), Order notes (internal communication), Refund flow, Address edit, and the Risk analysis tab for fraud detection.\n\nGorgias integrates directly with Shopify so you can trigger refunds, tag orders, and view customer order history without leaving the helpdesk.',
        takeaways: [
          'The Shopify customer timeline is the fastest way to understand a customer\'s entire history.',
          'Always leave internal notes on orders when taking support actions.',
          'High-risk scores in Shopify\'s fraud analysis should flag the order for manual review before fulfillment.',
        ],
      },
    ],
  },
  {
    id: 'email-comms',
    examType: 'customer_service',
    num: '04',
    color: '#3B82F6',
    title: 'Email & Communication',
    description: 'Write professional, clear, and effective customer emails.',
    lessons: 3,
    sections: [
      {
        title: 'Professional Email Writing',
        body: 'Every support email is a representation of your brand. The best support emails are: warm but professional, concise but complete, action-oriented but empathetic.\n\nStructure every email: greeting → acknowledgment → resolution → close. Avoid walls of text — use short paragraphs (2–3 sentences max) and bullet points for multi-step instructions.',
        takeaways: [
          'Keep first-response emails under 120 words where possible.',
          'One email should address one issue — don\'t bundle multiple resolutions.',
          'Active voice reads faster and feels more decisive: "I\'ve issued your refund" vs "A refund has been issued."',
        ],
        tips: [
          'Read every email aloud before sending — if it sounds stiff, it reads stiff.',
          'Avoid "Unfortunately" as an opener — it front-loads negativity.',
        ],
      },
      {
        title: 'Macro and Template Strategy',
        body: 'Macros are pre-written response templates for common scenarios. A good macro library reduces average handle time by 40–60% while maintaining response quality.\n\nMacro structure: Greeting token → Situation-specific body → Resolution → Personalization gap → Close. The personalization gap is a placeholder where agents add something specific — this prevents robotic responses.\n\nCategories to build macros for: WISMO, refund approved, refund declined, exchange request, damaged item, product inquiry, order cancellation.',
        takeaways: [
          'Macros should be starting points, not copy-paste finals — always personalize.',
          'Review and update macros quarterly — product and policy changes make old macros inaccurate.',
          'Track which macros generate the most follow-up questions and rewrite those first.',
        ],
        example: 'Macro: WISMO — Good\n"Hi {{customer.first_name}}, thanks for reaching out! Your order #{{order.number}} was shipped on {{fulfillment.created_at}} and is currently [tracking status]. Based on the carrier estimate, you should receive it by [date]. [PERSONALIZE: add any relevant context here]. Let me know if you need anything else!"\n\nThe [PERSONALIZE] tag is the gap for human touch.',
      },
      {
        title: 'Response Time SLAs and Prioritization',
        body: 'Response time SLAs (Service Level Agreements) define how quickly you commit to responding. Most e-commerce customers expect first response within 24 hours, with resolution within 48–72 hours.\n\nPriority tiering:\nP1 (respond < 2h): Disputes, chargebacks, legal threats, high-value orders (€500+)\nP2 (respond < 8h): Refund requests, damaged products, missing orders\nP3 (respond < 24h): Product questions, general inquiries, order modifications\n\nTriage is a skill — misclassification causes SLA breaches on high-priority tickets.',
        takeaways: [
          'SLA compliance rate should be above 90% — below 80% indicates staffing or process issues.',
          'Automate P3 acknowledgment emails so customers know you\'ve seen their ticket.',
          'Escalation paths must be clear — every agent should know exactly who to escalate to and when.',
        ],
      },
    ],
  },
  {
    id: 'dispute-mgmt',
    examType: 'dispute_management',
    num: '05',
    color: '#F59E0B',
    title: 'Dispute Management',
    description: 'Win chargebacks and prevent disputes before they happen.',
    lessons: 4,
    sections: [
      {
        title: 'Understanding Chargebacks',
        body: 'A chargeback occurs when a customer disputes a transaction with their bank. The bank reverses the charge and the merchant must provide evidence to dispute it — otherwise the money is gone, plus a chargeback fee (typically €15–€25).\n\nChargeback reasons: Item not received (INR), Significantly not as described (SNAD), Unauthorized transaction (fraud), Duplicate charge.\n\nChargeback rate above 1% of transactions triggers card processor scrutiny. Above 2%, you risk losing your merchant account.',
        takeaways: [
          'Most chargebacks can be prevented with proactive communication.',
          'Document everything — shipping confirmation, tracking, delivery confirmation.',
          'Authorize.net and Stripe both flag accounts that exceed 0.9% chargeback rate.',
        ],
        tips: [
          'Send proactive shipping + delivery confirmation emails to reduce INR claims.',
          'Use signature confirmation for orders over €200.',
        ],
      },
      {
        title: 'Dispute Prevention Strategies',
        body: 'The best way to win a chargeback is to prevent it. Dispute prevention operates at every stage of the order lifecycle.\n\nAt purchase: Clear product descriptions, accurate photos, prominent policies.\nAt fulfillment: Tracking confirmation emails with carrier links.\nAt delivery: Delivery confirmation email with "did everything arrive OK?" CTA.\nPost-delivery: Proactive outreach for high-value or complex orders.\n\nFor "unauthorized transaction" disputes: deploy 3D Secure (Stripe Radar or Shopify\'s built-in), verify billing address, and flag high-risk orders.',
        takeaways: [
          '3D Secure reduces unauthorized transaction disputes by up to 80%.',
          'Clear, timestamped communication records are your best defense.',
          'Offering a refund before a dispute is filed is almost always cheaper than fighting it.',
        ],
      },
      {
        title: 'Building a Winning Dispute Response',
        body: 'When a chargeback is filed, you have a limited window (typically 7–21 days depending on card network) to respond with evidence.\n\nEvidence package checklist:\n1. Transaction details (amount, date, email used)\n2. Proof of delivery (tracking with delivery confirmation)\n3. Customer communication history (emails, timestamps)\n4. Your refund/return policy (screenshot or link)\n5. IP address and geolocation of purchase (if available)\n6. Photos of the product shipped (if SNAD claim)\n\nFormat: clear, chronological PDF. Card issuers receive dozens of responses — make yours easy to read.',
        takeaways: [
          'Organized, timestamped evidence wins disputes. Walls of text lose them.',
          'Include the exact tracking URL, not just the tracking number.',
          'Never include aggressive language in dispute responses — it reads as unprofessional.',
        ],
        example: 'Evidence summary for INR dispute:\n"Order #4521 was placed on Feb 14 and shipped Feb 15 via DHL (tracking: 1234567890). Tracking confirms delivery on Feb 18 at 2:34 PM to the address provided at checkout. The customer contacted us on Feb 20 stating non-receipt. We provided tracking information on Feb 20 (see attached). No further contact was received before this dispute was filed."',
      },
      {
        title: 'PayPal Disputes and Claims',
        body: 'PayPal disputes follow a separate process from card chargebacks but carry the same risks. PayPal\'s Seller Protection covers INR and SNAD claims if you meet the requirements: tracked shipping to the confirmed address, proof of delivery, and transaction within policy limits.\n\nPayPal dispute escalation: Inquiry (2–20 days) → Dispute (20 days) → Claim (escalated to PayPal to decide). Respond at the inquiry stage — it\'s faster, cheaper, and more likely to be resolved without PayPal involvement.',
        takeaways: [
          'PayPal Seller Protection requires shipment to the confirmed PayPal address — always use that address.',
          'Respond to PayPal inquiries within 3 days — delays signal weakness.',
          'Screenshots of your PayPal transaction details are valid evidence.',
        ],
      },
    ],
  },
  {
    id: 'performance-kpis',
    examType: 'overall_manager',
    num: '06',
    color: '#8B5CF6',
    title: 'Performance & KPIs',
    description: 'Track what matters and use data to drive continuous improvement.',
    lessons: 3,
    sections: [
      {
        title: 'Key Metrics Every CS Manager Must Track',
        body: 'You cannot improve what you don\'t measure. The essential metrics for e-commerce customer service:\n\nFCR (First Contact Resolution): % of tickets resolved without follow-up. Target: >75%\nCSAT (Customer Satisfaction): Post-resolution survey score. Target: >4.4/5\nAHT (Average Handle Time): Time from ticket open to close. Target varies by ticket type.\nResponse Time: Time to first response. Target: <4h during business hours.\nChargeback Rate: % of transactions disputed. Target: <0.5%\nRefund Rate: % of orders refunded. Healthy range: 1–5% depending on category.',
        takeaways: [
          'FCR is the strongest predictor of customer satisfaction — prioritize it above all.',
          'CSAT below 4.0 is a warning sign. Below 3.5 requires immediate intervention.',
          'AHT should not be optimized at the expense of quality — rushed resolutions cause follow-up tickets.',
        ],
        tips: [
          'Run weekly KPI reviews — monthly is too slow to catch trends.',
          'Break down metrics by ticket category — "damaged" tickets will naturally take longer than "WISMO".',
        ],
      },
      {
        title: 'Setting Up Reporting and Dashboards',
        body: 'Data is useless without visibility. A good reporting setup gives you real-time access to ticket volume, resolution rates, and team performance.\n\nGorgias dashboards provide most of the CS metrics you need: response time, resolution time, CSAT, ticket volume by tag. Supplement with Shopify\'s analytics for refund rates and order data.\n\nWeekly report template:\n— Tickets received vs last week (+/-%)\n— FCR rate\n— CSAT average\n— Average response time\n— Top 3 ticket categories\n— Open tickets aging >72h',
        takeaways: [
          'Ticket volume spikes often predict refund spikes 48–72 hours later.',
          'Aging tickets (open >72h) are your biggest CSAT risk — review them daily.',
          'Tag consistency is essential — garbage tags produce garbage data.',
        ],
      },
      {
        title: 'Continuous Improvement Process',
        body: 'Great CS operations don\'t happen by accident — they\'re the result of deliberate weekly improvement cycles.\n\nThe improvement cycle: Measure → Identify → Root cause → Implement → Measure again.\n\nCommon root cause patterns:\nHigh WISMO volume → Improve shipping notification emails or shipping speed\nHigh refund rate → Product quality issue, listing accuracy, or sizing chart\nLow FCR → Agents lack authority to resolve, policy is unclear, or training gaps\nSlow response time → Understaffed, inefficient routing, or too many channels\n\nDocument every improvement action with a hypothesis and expected outcome. This builds an institutional knowledge base.',
        takeaways: [
          'Never implement more than 2 changes simultaneously — you won\'t know what worked.',
          'Involve agents in improvement discussions — they surface problems management doesn\'t see.',
          'Celebrate improvements publicly — it builds a quality culture.',
        ],
      },
    ],
  },
]

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
  .ac-root * { box-sizing: border-box; margin: 0; padding: 0; }

  .mod-card {
    background: #FFFFFF;
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 10px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  .mod-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    border-color: rgba(0,0,0,0.1);
  }
  .mod-card-top {
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
  }

  .section-card {
    background: #FFFFFF;
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 10px;
    padding: 24px;
    margin-bottom: 16px;
  }

  .takeaway-box {
    background: rgba(139,92,246,0.04);
    border: 1px solid rgba(139,92,246,0.12);
    border-left: 3px solid #8B5CF6;
    border-radius: 8px;
    padding: 16px 20px;
    margin-top: 16px;
  }
  .tip-box {
    background: rgba(245,158,11,0.04);
    border-left: 3px solid #F59E0B;
    border-radius: 8px;
    padding: 14px 18px;
    margin-top: 12px;
  }
  .example-box {
    background: #F9F9FB;
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 8px;
    padding: 16px;
    margin-top: 12px;
    font-family: monospace;
    font-size: 12.5px;
    white-space: pre-wrap;
    color: #374151;
    line-height: 1.6;
  }

  .quiz-option {
    background: #FFFFFF;
    border: 1px solid rgba(0,0,0,0.09);
    border-radius: 8px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-bottom: 10px;
  }
  .quiz-option:hover { border-color: rgba(139,92,246,0.3); background: rgba(139,92,246,0.02); }
  .quiz-option.selected { border-color: #8B5CF6; background: rgba(139,92,246,0.05); }
  .quiz-option.correct { border-color: #10B981; background: rgba(16,185,129,0.05); }
  .quiz-option.incorrect { border-color: #EF4444; background: rgba(239,68,68,0.05); }
  .quiz-option.missed { border-color: #10B981; background: rgba(16,185,129,0.04); }

  .letter-badge {
    width: 28px; height: 28px; border-radius: 50%;
    background: #F5F5F5; color: #555;
    font-size: 12px; font-weight: 600;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 0.15s;
  }
  .selected .letter-badge { background: #8B5CF6; color: #fff; }
  .correct .letter-badge  { background: #10B981; color: #fff; }
  .incorrect .letter-badge { background: #EF4444; color: #fff; }
  .missed .letter-badge   { background: #10B981; color: #fff; }

  .nav-section-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: 7px;
    cursor: pointer; transition: background 0.1s;
  }
  .nav-section-item:hover { background: rgba(0,0,0,0.03); }

  .start-quiz-btn {
    width: 100%; height: 40px;
    background: #0F0F10; color: #FFFFFF;
    border: none; border-radius: 8px;
    font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
  }
  .start-quiz-btn:hover { background: #333; }
  .start-quiz-btn:disabled { background: #E5E7EB; color: #9CA3AF; cursor: not-allowed; }

  .primary-btn {
    padding: 10px 22px;
    background: #0F0F10; color: #FFFFFF;
    border: none; border-radius: 8px;
    font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
  }
  .primary-btn:hover { background: #333; }

  .secondary-btn {
    padding: 10px 22px;
    background: transparent; color: #374151;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 8px;
    font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
  }
  .secondary-btn:hover { background: rgba(0,0,0,0.03); }

  .cert-card {
    background: #FFFFFF;
    border: 2px solid rgba(139,92,246,0.2);
    border-radius: 16px;
    padding: 48px;
    max-width: 720px;
    margin: 40px auto;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .cert-dots {
    position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.4;
  }
  .cert-glow-tl {
    position: absolute; top: -60px; left: -60px;
    width: 200px; height: 200px; border-radius: 50%;
    background: radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%);
    pointer-events: none;
  }
  .cert-glow-br {
    position: absolute; bottom: -60px; right: -60px;
    width: 200px; height: 200px; border-radius: 50%;
    background: radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%);
    pointer-events: none;
  }

  .progress-ring-track { fill: none; stroke: #F3F4F6; }
  .progress-ring-fill  { fill: none; stroke-linecap: round; transition: stroke-dashoffset 1s ease; }

  .no-access-card {
    background: #FFFFFF;
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 12px;
    padding: 48px;
    max-width: 480px;
    margin: 0 auto;
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; }
  }
`

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SIDEBAR_W = 208
const PASS_THRESHOLD = 75

function readKey(moduleId, sectionIdx) { return `ac_read_${moduleId}_${sectionIdx}` }

function getModuleStatus(mod, passedTypes) {
  if (passedTypes.includes(mod.examType)) return 'completed'
  const anyRead = mod.sections.some((_, i) => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(readKey(mod.id, i)) === '1'
  })
  return anyRead ? 'in-progress' : 'not-started'
}

function StatusBadge({ status }) {
  const map = {
    'completed':   { label: 'Completed ✓', bg: '#F0FDF4', color: '#059669' },
    'in-progress': { label: 'In progress',  bg: '#FFFBEB', color: '#D97706' },
    'not-started': { label: 'Not started',  bg: '#F5F5F5', color: '#9CA3AF' },
  }
  const s = map[status] || map['not-started']
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function ProgressRing({ pct, size = 80, stroke = 7, color = '#8B5CF6', textColor }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle className="progress-ring-track" cx={size/2} cy={size/2} r={r} strokeWidth={stroke} />
      <circle className="progress-ring-fill" cx={size/2} cy={size/2} r={r} strokeWidth={stroke}
        stroke={color} strokeDasharray={circ} strokeDashoffset={offset} />
    </svg>
  )
}

// ─── Views ───────────────────────────────────────────────────────────────────

function OverviewView({ passedTypes, onSelectModule, userName }) {
  const completed = MODULES.filter(m => passedTypes.includes(m.examType)).length
  const total     = MODULES.length
  const pct       = Math.round((completed / total) * 100)
  const allDone   = completed === total

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.02em', marginBottom: 4 }}>Academy</h1>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Master e-commerce customer service</p>
      </div>

      {/* Progress banner */}
      <div style={{
        background: 'linear-gradient(135deg, #F3EEFF, #EFF6FF)',
        border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: 10, padding: '20px 24px',
        display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28,
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9CA3AF', marginBottom: 4 }}>Your Progress</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0F0F10', lineHeight: 1, marginBottom: 6 }}>{pct}%</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>{completed} of {total} modules completed</div>
          <div style={{ height: 6, borderRadius: 10, background: '#E5E7EB', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 10, background: 'linear-gradient(90deg, #8B5CF6, #6366F1)', width: `${pct}%`, transition: 'width 0.6s ease' }} />
          </div>
        </div>

        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          {allDone ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>Certificate earned!</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px dashed rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,92,246,0.04)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
              </div>
              <span style={{ fontSize: 11, color: '#9CA3AF', maxWidth: 130, lineHeight: 1.4, textAlign: 'center' }}>Complete all modules to earn your certificate</span>
            </div>
          )}
        </div>
      </div>

      {/* Module grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
        {MODULES.map(mod => {
          const status = getModuleStatus(mod, passedTypes)
          return (
            <div key={mod.id} className="mod-card" onClick={() => onSelectModule(mod)}>
              <div className="mod-card-top" style={{ background: mod.color }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, marginTop: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9CA3AF' }}>{mod.num}</div>
                <StatusBadge status={status} />
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: mod.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ModuleIcon id={mod.id} color={mod.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#0F0F10', marginBottom: 4 }}>{mod.title}</div>
                  <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, marginBottom: 10 }}>{mod.description}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>{mod.lessons} lessons</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ModuleIcon({ id, color }) {
  const icons = {
    'cs-fundamentals': <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>,
    'refund-handling':  <><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></>,
    'shopify-ops':      <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>,
    'email-comms':      <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    'dispute-mgmt':     <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    'performance-kpis': <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  }
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[id]}
    </svg>
  )
}

function ModuleView({ mod, passedTypes, onBack, onStartQuiz, session }) {
  const [readSections, setReadSections] = useState(() =>
    mod.sections.map((_, i) => typeof window !== 'undefined' && localStorage.getItem(readKey(mod.id, i)) === '1')
  )
  const [activeSection, setActiveSection] = useState(0)
  const allRead = readSections.every(Boolean)
  const isPassed = passedTypes.includes(mod.examType)

  function markRead(idx) {
    if (typeof window !== 'undefined') localStorage.setItem(readKey(mod.id, idx), '1')
    setReadSections(prev => { const a = [...prev]; a[idx] = true; return a })
  }

  const sec = mod.sections[activeSection]

  return (
    <div style={{ padding: '28px 40px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <button onClick={onBack} className="secondary-btn" style={{ marginBottom: 20, fontSize: 12, padding: '6px 14px' }}>
        ← Academy
      </button>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F0F10', letterSpacing: '-0.025em', marginBottom: 6 }}>{mod.title}</h1>
        <p style={{ fontSize: 14, color: '#6B7280' }}>{mod.description}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
        {/* Left — content */}
        <div>
          {mod.sections.map((s, i) => (
            <div key={i} className="section-card" style={{ opacity: i === activeSection || readSections[i] ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0F0F10' }}>{s.title}</h2>
                {readSections[i]
                  ? <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, background: '#F0FDF4', padding: '2px 8px', borderRadius: 4 }}>Read ✓</span>
                  : <button onClick={() => markRead(i)} style={{ fontSize: 11, color: '#6B7280', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 4, background: 'transparent', padding: '2px 8px', cursor: 'pointer' }}>Mark as read</button>
                }
              </div>
              {s.body.split('\n').map((para, pi) => para.trim() && (
                <p key={pi} style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 10 }}>{para}</p>
              ))}
              {s.takeaways && (
                <div className="takeaway-box">
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#7C3AED', marginBottom: 10 }}>Key Takeaways</div>
                  {s.takeaways.map((t, ti) => (
                    <div key={ti} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: '#8B5CF6', flexShrink: 0, marginTop: 2 }}>•</span>
                      <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>
              )}
              {s.tips && s.tips.map((tip, ti) => (
                <div key={ti} className="tip-box" style={{ marginTop: ti === 0 ? 12 : 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', marginRight: 6 }}>TIP</span>
                  <span style={{ fontSize: 13, color: '#374151' }}>{tip}</span>
                </div>
              ))}
              {s.example && (
                <div className="example-box">{s.example}</div>
              )}
            </div>
          ))}
        </div>

        {/* Right — navigation */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0F0F10', marginBottom: 12 }}>Module contents</div>
            {mod.sections.map((s, i) => (
              <div key={i} className="nav-section-item" onClick={() => setActiveSection(i)} style={{ background: i === activeSection ? 'rgba(139,92,246,0.06)' : undefined }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: readSections[i] ? '#10B981' : '#F3F4F6' }}>
                  {readSections[i]
                    ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D1D5DB' }} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.3 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>~5 min read</div>
                </div>
              </div>
            ))}
            <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', margin: '14px 0' }} />
            {isPassed
              ? <div style={{ textAlign: 'center', padding: '10px 0', color: '#059669', fontSize: 13, fontWeight: 600 }}>Quiz passed ✓</div>
              : <button className="start-quiz-btn" disabled={!allRead} onClick={onStartQuiz}>
                  {allRead ? 'Start Quiz →' : `Read all sections to unlock quiz`}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

function QuizView({ mod, session, onBack, onComplete }) {
  const [questions, setQuestions] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [current,   setCurrent]   = useState(0)
  const [answers,   setAnswers]   = useState({}) // questionId → selectedIndex
  const [submitted, setSubmitted] = useState(false)
  const [result,    setResult]    = useState(null)
  const [submitting,setSubmitting]= useState(false)
  const [canAttempt,setCanAttempt]= useState(true)
  const [attemptsLeft,setAttemptsLeft] = useState(3)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/exams/questions?type=${mod.examType}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load questions')
        setCanAttempt(data.canAttempt ?? true)
        setAttemptsLeft(data.attemptsLeft ?? 3)
        setQuestions(data.questions || [])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [mod.examType, session])

  async function submitQuiz() {
    setSubmitting(true)
    try {
      const formattedAnswers = questions.map(q => ({
        question_id: q.id,
        selected_index: answers[q.id] ?? null,
      }))
      const res = await fetch('/api/exams/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ exam_type: mod.examType, answers: formattedAnswers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setResult(data)
      setSubmitted(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ padding: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTop: '3px solid #8B5CF6', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 13, color: '#6B7280' }}>Loading questions…</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: '#EF4444', marginBottom: 16 }}>{error}</div>
      <button className="secondary-btn" onClick={onBack}>← Back to module</button>
    </div>
  )

  if (!canAttempt) return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⛔</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0F0F10', marginBottom: 8 }}>Maximum attempts reached</div>
      <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>You have used all 3 attempts for this exam. Please contact support if you need assistance.</div>
      <button className="secondary-btn" onClick={onBack}>← Back to module</button>
    </div>
  )

  if (questions.length === 0) return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>No questions available for this module yet.</div>
      <button className="secondary-btn" onClick={onBack}>← Back to module</button>
    </div>
  )

  // Results screen
  if (submitted && result) {
    const pct     = result.score ?? 0
    const passed  = result.passed ?? pct >= PASS_THRESHOLD
    const ringCol = passed ? '#8B5CF6' : '#EF4444'
    const r       = 54, stroke = 8
    const circ    = 2 * Math.PI * r
    const offset  = circ - (pct / 100) * circ

    return (
      <div style={{ padding: '32px 40px', maxWidth: 740, margin: '0 auto' }}>
        {/* Score circle */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="124" height="124" viewBox="0 0 124 124" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="62" cy="62" r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
              <circle cx="62" cy="62" r={r} fill="none" stroke={ringCol} strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#0F0F10', lineHeight: 1 }}>{Math.round(pct)}%</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>score</div>
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F0F10', marginBottom: 6 }}>
            {passed ? '🎉 Well done!' : 'Not quite — try again'}
          </div>
          <div style={{ fontSize: 14, color: '#6B7280' }}>
            {passed
              ? `You passed with ${Math.round(pct)}%. Module unlocked!`
              : `You need ${PASS_THRESHOLD}% to pass. You scored ${Math.round(pct)}%.`}
          </div>
        </div>

        {/* Question breakdown */}
        <div style={{ marginBottom: 24 }}>
          {questions.map((q, qi) => {
            const userIdx   = answers[q.id] ?? null
            const correctIdx = typeof q.correct_answer_index === 'number' ? q.correct_answer_index : null
            const isCorrect = userIdx !== null && userIdx === correctIdx
            return (
              <div key={q.id} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 8, padding: '14px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: isCorrect ? '#10B981' : '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    {isCorrect ? <polyline points="20 6 9 17 4 12"/> : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}
                  </svg>
                </div>
                <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>Q{qi + 1}: {q.question || q.text}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: isCorrect ? '#059669' : '#EF4444' }}>{isCorrect ? 'Correct' : 'Incorrect'}</span>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {passed
            ? <button className="primary-btn" onClick={onComplete}>Continue →</button>
            : <>
                <button className="secondary-btn" onClick={onBack}>← Back to module</button>
                <button className="primary-btn" onClick={() => {
                  setSubmitted(false); setResult(null); setAnswers({}); setCurrent(0)
                }}>Retake quiz</button>
              </>
          }
        </div>
      </div>
    )
  }

  const q = questions[current]
  const opts = q?.options || q?.answer_options || []

  return (
    <div style={{ padding: '32px 40px', maxWidth: 760, margin: '0 auto' }}>
      <button onClick={onBack} className="secondary-btn" style={{ marginBottom: 24, fontSize: 12, padding: '6px 14px' }}>← Back to module</button>

      {/* Progress */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Question {current + 1} of {questions.length}</span>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{mod.title} Quiz</span>
        </div>
        <div style={{ height: 5, borderRadius: 10, background: '#F3F4F6', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 10, background: '#8B5CF6', width: `${((current + 1) / questions.length) * 100}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Question card */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: 32, marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#0F0F10', letterSpacing: '-0.01em', marginBottom: 24, lineHeight: 1.45 }}>
          {q?.question || q?.text}
        </div>

        {['A', 'B', 'C', 'D'].slice(0, opts.length).map((letter, idx) => {
          const isSelected = answers[q.id] === idx
          return (
            <div key={idx}
              className={`quiz-option${isSelected ? ' selected' : ''}`}
              onClick={() => !submitted && setAnswers(prev => ({ ...prev, [q.id]: idx }))}
            >
              <div className="letter-badge">{letter}</div>
              <span style={{ fontSize: 14, color: '#0F0F10', flex: 1 }}>{opts[idx]}</span>
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="secondary-btn" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
          Previous
        </button>
        {current < questions.length - 1
          ? <button className="primary-btn" onClick={() => setCurrent(c => c + 1)} disabled={answers[q.id] === undefined}>
              Next
            </button>
          : <button className="primary-btn" onClick={submitQuiz}
              disabled={submitting || Object.keys(answers).length < questions.length}>
              {submitting ? 'Submitting…' : 'Submit Quiz'}
            </button>
        }
      </div>
    </div>
  )
}

function CertificateView({ userName, passedTypes, onBack }) {
  const completedMods = MODULES.filter(m => passedTypes.includes(m.examType))
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{ padding: '32px 40px' }}>
      <button onClick={onBack} className="secondary-btn" style={{ marginBottom: 16, fontSize: 12, padding: '6px 14px' }}>
        ← Academy
      </button>

      <div className="cert-card">
        <div className="cert-dots" />
        <div className="cert-glow-tl" />
        <div className="cert-glow-br" />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#A175FC 0%,#7C3AED 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>Lynq & Flow Academy</span>
          </div>

          {/* Title */}
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9CA3AF', marginBottom: 16 }}>Certificate of Completion</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#0F0F10', letterSpacing: '-0.025em', marginBottom: 8 }}>{userName || 'Student'}</div>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 6 }}>has successfully completed the</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#0F0F10', marginBottom: 24 }}>E-commerce Customer Service Mastery</div>

          <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '24px 0' }} />

          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Completed on {today}</div>

          {/* Module badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
            {MODULES.map(mod => {
              const done = passedTypes.includes(mod.examType)
              return (
                <div key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: done ? mod.color + '14' : '#F5F5F5', border: `1px solid ${done ? mod.color + '30' : 'transparent'}` }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: done ? mod.color : '#D1D5DB' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: done ? mod.color : '#9CA3AF' }}>{mod.title}</span>
                </div>
              )
            })}
          </div>

          <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '0 0 24px' }} />

          {/* Signature row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>Certified by</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0F0F10' }}>Lynq & Flow</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>Date</div>
              <div style={{ fontSize: 14, color: '#374151' }}>{today}</div>
            </div>
          </div>

          {/* Seal */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(139,92,246,0.35)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Certified</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="primary-btn" onClick={() => window.print()}>
              Download Certificate
            </button>
            <button className="secondary-btn" onClick={() => {
              const text = `I just earned the E-commerce Customer Service Mastery certificate from Lynq & Flow Academy! 🎓`
              window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(text)}`, '_blank')
            }}>
              Share on LinkedIn
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AcademyPage() {
  const [session,     setSession]     = useState(null)
  const [userName,    setUserName]    = useState('')
  const [mounted,     setMounted]     = useState(false)
  const [hasAccess,   setHasAccess]   = useState(null) // null = loading
  const [passedTypes, setPassedTypes] = useState([])   // exam_type strings
  const [view,        setView]        = useState('overview') // 'overview'|'module'|'quiz'|'results'|'certificate'
  const [activeModule,setActiveModule]= useState(null)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) { window.location.href = '/login'; return }
      setSession(s)
      const meta = s.user.user_metadata || {}
      const raw  = (s.user.email || '').split('@')[0]
      setUserName(meta.full_name || meta.name || (raw.charAt(0).toUpperCase() + raw.slice(1)))

      // Check access
      const accessRes = await fetch('/api/academy/access', {
        headers: { Authorization: `Bearer ${s.access_token}` },
      })
      const accessData = await accessRes.json()
      setHasAccess(accessData.hasAccess ?? false)

      // Load exam results (passed types)
      if (accessData.hasAccess) {
        const resultRes = await fetch('/api/exams/result', {
          headers: { Authorization: `Bearer ${s.access_token}` },
        })
        const resultData = await resultRes.json()
        const submissions = resultData.submissions || resultData || []
        const passed = [...new Set(
          submissions.filter(s => s.passed).map(s => s.exam_type)
        )]
        setPassedTypes(passed)
      }
    })
  }, [])

  const allModulesDone = MODULES.every(m => passedTypes.includes(m.examType))

  function handleModuleSelect(mod) {
    setActiveModule(mod)
    setView('module')
  }

  function handleQuizComplete() {
    // Reload passed types after quiz completion
    if (session) {
      fetch('/api/exams/result', { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.json())
        .then(data => {
          const submissions = data.submissions || data || []
          const passed = [...new Set(submissions.filter(s => s.passed).map(s => s.exam_type))]
          setPassedTypes(passed)
        })
    }
    setView('overview')
  }

  if (!mounted) return null

  return (
    <div className="ac-root" style={{ display: 'flex', minHeight: '100vh', background: '#F9F9FB', fontFamily: "'Switzer',-apple-system,BlinkMacSystemFont,sans-serif" }}>
      <style>{CSS}</style>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Sidebar />

      <div style={{ marginLeft: SIDEBAR_W, flex: 1, minHeight: '100vh', overflow: 'auto' }}>

        {/* Loading */}
        {hasAccess === null && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTop: '3px solid #8B5CF6', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13, color: '#6B7280' }}>Loading Academy…</div>
            </div>
          </div>
        )}

        {/* No access */}
        {hasAccess === false && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: 40 }}>
            <div className="no-access-card">
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F0F10', marginBottom: 8, letterSpacing: '-0.02em' }}>Academy Access Required</h2>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                The Lynq & Flow Academy is available on the Scale plan or as a standalone add-on for €100.
              </p>
              <div style={{ fontSize: 13, color: '#9CA3AF', padding: '12px 16px', background: '#F9F9FB', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }}>
                Contact your account manager or upgrade your plan to unlock all 6 modules + certification.
              </div>
            </div>
          </div>
        )}

        {/* Academy views */}
        {hasAccess === true && (
          <>
            {view === 'overview' && (
              <OverviewView
                passedTypes={passedTypes}
                onSelectModule={handleModuleSelect}
                userName={userName}
              />
            )}
            {view === 'module' && activeModule && (
              <ModuleView
                mod={activeModule}
                passedTypes={passedTypes}
                session={session}
                onBack={() => setView('overview')}
                onStartQuiz={() => setView('quiz')}
              />
            )}
            {view === 'quiz' && activeModule && (
              <QuizView
                mod={activeModule}
                session={session}
                onBack={() => setView('module')}
                onComplete={handleQuizComplete}
              />
            )}
            {view === 'certificate' && (
              <CertificateView
                userName={userName}
                passedTypes={passedTypes}
                onBack={() => setView('overview')}
              />
            )}

            {/* Certificate banner — shown when all done */}
            {view === 'overview' && allModulesDone && (
              <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 40px 24px' }}>
                <div
                  onClick={() => setView('certificate')}
                  style={{ background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', borderRadius: 10, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>🎉 You've completed all modules!</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Click to view and download your certificate</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
