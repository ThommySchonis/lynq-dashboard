/**
 * Shared constants for the Academy module.
 * Extracted from app/academy/page.js and app/academy/final-exam/page.js.
 */

import type { QuizQuestion, Module, ExamQuestion, SectionMeta } from '@/types/academy'

// ── Pass threshold ───────────────────────────────────────────────────────────

export const PASS_THRESHOLD = 75

// ── Animation easing ─────────────────────────────────────────────────────────

export const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

// ── Local-storage key builder ────────────────────────────────────────────────

export function readKey(moduleId: string, idx: number): string {
  return `ac_read_${moduleId}_${idx}`
}

// ── Quiz questions per module ────────────────────────────────────────────────

export const QUIZ_QUESTIONS: Record<string, QuizQuestion[]> = {
  'cs-fundamentals': [
    { q: 'What is the first step when handling a customer complaint?', opts: ['Offer a refund immediately', 'Listen and acknowledge the issue', 'Transfer to manager', 'Close the ticket'], correct: 1 },
    { q: 'What does CSAT stand for?', opts: ['Customer Satisfaction Score', 'Customer Service Agent Training', 'Case Status And Tracking', 'Client Support Action Team'], correct: 0 },
    { q: 'What is the ideal first response time for support tickets?', opts: ['24 hours', '12 hours', '4 hours', '1 hour'], correct: 2 },
    { q: 'Which tool is used for helpdesk management at Lynq?', opts: ['Shopify', 'Klaviyo', 'Lynq Inbox', 'Meta Ads'], correct: 2 },
    { q: 'What should you always do before closing a ticket?', opts: ['Ask for payment', 'Confirm the issue is resolved', 'Send a survey', 'Escalate to manager'], correct: 1 },
  ],
  'refund-handling': [
    { q: 'What is the typical refund processing time?', opts: ['24 hours', '3–5 business days', '7–10 business days', '30 days'], correct: 1 },
    { q: 'When should you offer a replacement instead of a refund?', opts: ['Always', 'Never', 'When item is damaged in transit', 'When customer is angry'], correct: 2 },
    { q: 'What is a chargeback?', opts: ['A discount code', 'A disputed transaction via the bank', 'A shipping fee', 'A product return'], correct: 1 },
    { q: 'What refund rate is considered healthy for e-commerce?', opts: ['Under 1%', 'Under 3%', 'Under 10%', 'Under 15%'], correct: 1 },
    { q: 'What should you document for every refund?', opts: ['Customer age', 'Reason, amount, and resolution', 'Delivery address only', 'Payment method only'], correct: 1 },
  ],
  'shopify-ops': [
    { q: "Where can you view a customer's full order history in Shopify?", opts: ['The analytics dashboard', 'The customer timeline view', 'The inventory tab', 'The reports section'], correct: 1 },
    { q: 'What does "Unfulfilled" status mean in Shopify?', opts: ['Order was cancelled', 'Order was refunded', 'Order has not been shipped yet', 'Order is pending payment'], correct: 2 },
    { q: 'What is the most common cause of WISMO tickets?', opts: ['Wrong addresses', 'The gap between label creation and first carrier scan', 'International customs', 'Stock shortages'], correct: 1 },
    { q: 'Where should support actions be recorded in Shopify?', opts: ["Nowhere, it's automatic", 'Internal order notes', "The customer's profile", 'A spreadsheet'], correct: 1 },
    { q: 'What is the recommended low-stock alert threshold?', opts: ['When stock hits zero', 'When you have 1 item left', 'At 20% of average weekly sales', 'When a customer complains'], correct: 2 },
  ],
  'email-comms': [
    { q: 'What is the ideal length for a first-response email?', opts: ['As long as needed', 'Under 50 words', 'Under 120 words', 'Exactly 200 words'], correct: 2 },
    { q: 'What is a macro in customer support?', opts: ['A pricing rule', 'A pre-written response template', 'A tracking system', 'A refund policy'], correct: 1 },
    { q: 'What is a P1 ticket?', opts: ['A standard inquiry', 'A product question', 'A chargeback or legal threat requiring <2h response', 'A positive review'], correct: 2 },
    { q: 'What phrase should you AVOID in customer emails?', opts: ['Thank you for reaching out', 'I understand your frustration', 'Per our policy', 'How can I help?'], correct: 2 },
    { q: 'How often should macros be reviewed and updated?', opts: ['Never', 'Daily', 'Quarterly', 'Annually'], correct: 2 },
  ],
  'dispute-mgmt': [
    { q: 'What chargeback rate triggers card processor scrutiny?', opts: ['Above 5%', 'Above 1%', 'Above 10%', 'Above 0.1%'], correct: 1 },
    { q: 'What is the most common chargeback reason in e-commerce?', opts: ['Duplicate charge', 'Item not received (INR)', 'Wrong amount charged', 'Unauthorized transaction'], correct: 1 },
    { q: 'When is the best time to resolve a PayPal dispute?', opts: ['At the claim stage', 'At the inquiry stage', 'After PayPal decides', 'Never respond'], correct: 1 },
    { q: 'Which is NOT valid chargeback evidence?', opts: ['Delivery confirmation', 'Customer communication history', 'Your refund policy screenshot', 'A verbal promise to the customer'], correct: 3 },
    { q: 'What reduces unauthorized transaction disputes by up to 80%?', opts: ['Free shipping', 'Better product photos', '3D Secure authentication', 'Signature confirmation'], correct: 2 },
  ],
  'performance-kpis': [
    { q: 'What does FCR stand for?', opts: ['First Customer Review', 'Full Charge Rate', 'First Contact Resolution', 'Forwarded Case Report'], correct: 2 },
    { q: 'What CSAT score requires immediate intervention?', opts: ['Below 4.5', 'Below 4.0', 'Below 3.5', 'Below 3.0'], correct: 2 },
    { q: 'What is the target FCR rate for e-commerce support?', opts: ['Above 50%', 'Above 60%', 'Above 75%', 'Above 90%'], correct: 2 },
    { q: 'What often predicts a refund spike 48–72 hours later?', opts: ['A volume decrease', 'A ticket volume spike', 'A weekend surge', 'A Monday drop'], correct: 1 },
    { q: 'How frequently should KPI reviews be run?', opts: ['Daily', 'Weekly', 'Monthly', 'Quarterly'], correct: 1 },
  ],
}

// ── Module data ──────────────────────────────────────────────────────────────

export const MODULES: Module[] = [
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
    quiz: [],
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
    quiz: [],
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
        body: `Support teams spend most of their time in Shopify's admin. Speed comes from knowing the shortcuts.\n\nMust-know tools: Customer timeline view (see all orders + history), Order notes (internal communication), Refund flow, Address edit, and the Risk analysis tab for fraud detection.\n\nA good helpdesk integrates directly with Shopify so you can trigger refunds, tag orders, and view customer order history without leaving the inbox.`,
        takeaways: ['The Shopify customer timeline is the fastest way to understand a customer\'s entire history.', 'Always leave internal notes on orders when taking support actions.', 'High-risk scores in Shopify\'s fraud analysis should flag the order for manual review before fulfillment.'],
      },
    ],
    quiz: [],
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
    quiz: [],
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
    quiz: [],
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
        body: `Data is useless without visibility. A good reporting setup gives you real-time access to ticket volume, resolution rates, and team performance.\n\nYour helpdesk dashboard should provide the core CS metrics: response time, resolution time, CSAT, ticket volume by tag. Supplement with Shopify's analytics for refund rates and order data.\n\nWeekly report template:\n— Tickets received vs last week (+/-%)\n— FCR rate\n— CSAT average\n— Average response time\n— Top 3 ticket categories\n— Open tickets aging >72h`,
        takeaways: ['Ticket volume spikes often predict refund spikes 48–72 hours later.', 'Aging tickets (open >72h) are your biggest CSAT risk — review them daily.', 'Tag consistency is essential — garbage tags produce garbage data.'],
      },
      {
        title: 'Continuous Improvement Process', mins: 5,
        body: `Great CS operations don't happen by accident — they're the result of deliberate weekly improvement cycles.\n\nThe improvement cycle: Measure → Identify → Root cause → Implement → Measure again.\n\nCommon root cause patterns:\nHigh WISMO volume → Improve shipping notification emails or shipping speed\nHigh refund rate → Product quality issue, listing accuracy, or sizing chart\nLow FCR → Agents lack authority to resolve, policy is unclear, or training gaps\nSlow response time → Understaffed, inefficient routing, or too many channels`,
        takeaways: ['Never implement more than 2 changes simultaneously — you won\'t know what worked.', 'Involve agents in improvement discussions — they surface problems management doesn\'t see.', 'Celebrate improvements publicly — it builds a quality culture.'],
      },
    ],
    quiz: [],
  },
]

// Attach quiz data + Knowledge Check section to each module
MODULES.forEach(mod => {
  mod.quiz = QUIZ_QUESTIONS[mod.id] || []
  mod.sections.push({ title: 'Knowledge Check', type: 'quiz', mins: 10 })
})

// ── Final Exam constants ─────────────────────────────────────────────────────

export const ALL_MODULE_IDS: string[] = ['cs-fundamentals', 'refund-handling', 'shopify-ops', 'email-comms', 'dispute-mgmt', 'performance-kpis']

export const MODULE_LABELS: Record<string, string> = {
  'cs-fundamentals': 'CS Fundamentals',
  'refund-handling': 'Refund Handling',
  'shopify-ops': 'Shopify Operations',
  'email-comms': 'Email & Communication',
  'dispute-mgmt': 'Dispute Management',
  'performance-kpis': 'Performance & KPIs',
}

export const SECTION_META: SectionMeta[] = [
  { label: 'CS Fundamentals', color: '#6366F1' },
  { label: 'Refunds & Returns', color: '#3B82F6' },
  { label: 'Case Studies', color: '#8B5CF6' },
  { label: 'Shopify & Operations', color: '#10B981' },
  { label: 'Performance & KPIs', color: '#F59E0B' },
]

// ── Confetti pieces (pre-computed, stable) ──────────────────────────────────

export const CONFETTI_COLORS = ['#8B5CF6', '#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899']
export const CONFETTI = Array.from({ length: 30 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  delay: `${((i * 7) % 30) * 0.1}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 6 + (i % 5),
  duration: `${2.5 + (i % 8) * 0.2}s`,
}))

export const ALL_EXAM_QUESTIONS: ExamQuestion[] = [
  // -- Section 0: CS Fundamentals (0-9) --
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
  { q: "What is the purpose of an internal note in your helpdesk?",
    opts: ['To send to the customer', 'To communicate with teammates without the customer seeing', 'To log shipping updates', 'To create refunds'], correct: 1 },
  { q: "A VIP customer complains about a €15 order issue. How do you handle it?",
    opts: ['Same as any other customer', 'Prioritize, offer extra compensation, personal touch', 'Ignore because amount is small', 'Immediately escalate'], correct: 1 },
  { q: "What should every CS reply include?",
    opts: ['Your personal opinion', 'A clear acknowledgment, solution, and next step', 'An apology for everything', 'A discount code'], correct: 1 },
  { q: "What is 'ticket deflection'?",
    opts: ['Closing tickets without solving them', 'Preventing tickets through proactive communication', 'Transferring tickets to other agents', 'Deleting spam tickets'], correct: 1 },

  // -- Section 1: Refunds & Returns (10-19) --
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

  // -- Section 2: Case Studies (20-29) --
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

  // -- Section 3: Shopify & Operations (30-39) --
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
  { q: "What does 'on hold' status mean in your helpdesk?",
    opts: ['Ticket is closed', 'Ticket is waiting for customer or third party response', 'Ticket is spam', 'Ticket needs immediate action'], correct: 1 },
  { q: "How do you handle a customer who emails in a language you don't speak?",
    opts: ['Ignore the email', 'Use translation tool, respond in their language', 'Reply in English only', 'Close the ticket'], correct: 1 },

  // -- Section 4: Performance & KPIs (40-49) --
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
