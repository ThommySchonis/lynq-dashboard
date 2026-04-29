'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ─── Status configs ───────────────────────────────────────────
const STATUS = {
  open:     { label:'Open',     bg:'rgba(161,117,252,0.15)', color:'#A175FC',  border:'rgba(161,117,252,0.3)'  },
  pending:  { label:'Pending',  bg:'rgba(251,191,36,0.14)',  color:'#fbbf24',  border:'rgba(251,191,36,0.3)'   },
  resolved: { label:'Resolved', bg:'rgba(74,222,128,0.14)',  color:'#4ade80',  border:'rgba(74,222,128,0.3)'   },
  closed:   { label:'Closed',   bg:'var(--bg-input)', color:'var(--text-3)', border:'var(--bg-surface-2)' },
}
const ORDER_STATUS = {
  paid:        { bg:'rgba(74,222,128,0.14)',  color:'#4ade80',  label:'Paid'         },
  unpaid:      { bg:'rgba(251,146,60,0.14)',  color:'#fb923c',  label:'Unpaid'       },
  fulfilled:   { bg:'rgba(74,222,128,0.14)',  color:'#4ade80',  label:'Fulfilled'    },
  unfulfilled: { bg:'rgba(251,146,60,0.14)',  color:'#fb923c',  label:'Unfulfilled'  },
  partial:     { bg:'rgba(251,191,36,0.14)',  color:'#fbbf24',  label:'Partial'      },
  refunded:    { bg:'rgba(248,113,133,0.14)', color:'#fb7185',  label:'Refunded'     },
  cancelled:   { bg:'rgba(248,113,133,0.14)', color:'#fb7185',  label:'Cancelled'    },
  voided:      { bg:'rgba(248,113,133,0.14)', color:'#fb7185',  label:'Voided'       },
  pending:     { bg:'rgba(251,191,36,0.14)',  color:'#fbbf24',  label:'Pending'      },
  authorized:  { bg:'rgba(99,179,237,0.14)',  color:'#63b3ed',  label:'Authorized'   },
}
const CANCEL_REASONS = [
  { value:'customer',  label:'Customer requested'  },
  { value:'fraud',     label:'Fraudulent'          },
  { value:'inventory', label:'Items unavailable'   },
  { value:'declined',  label:'Payment declined'    },
  { value:'other',     label:'Other'               },
]
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
const DEFAULT_TICKET_TAGS = [
  { id:'order-status', name:'ORDER-STATUS', color:'#84cc16', description:'Questions about order status or delivery updates' },
  { id:'feedback', name:'feedback', color:'#a78bfa', description:'Customer feedback or product experience' },
  { id:'negative', name:'negative', color:'#f97316', description:'Negative sentiment or complaint' },
  { id:'return-exchange', name:'RETURN/EXCHANGE', color:'#8b5cf6', description:'Return, exchange, or size change request' },
  { id:'order-change-cancel', name:'ORDER-CHANGE/CANCEL', color:'#f59e0b', description:'Order edit, address change, or cancellation' },
  { id:'positive', name:'positive', color:'#22c55e', description:'Positive sentiment or compliment' },
  { id:'promotion', name:'PROMOTION', color:'#fb923c', description:'Promotion, discount, or coupon question' },
  { id:'product', name:'PRODUCT', color:'#38bdf8', description:'Product details, stock, sizing, or recommendation' },
]
function loadMacros() {
  try { const s=JSON.parse(localStorage.getItem('lynq_macros')||'null'); if(s?.length) return s } catch{}
  return FALLBACK_MACROS
}
function saveMacrosToStorage(m) { try{localStorage.setItem('lynq_macros',JSON.stringify(m))}catch{} }
function loadTicketTags() {
  try {
    const saved = JSON.parse(localStorage.getItem('lynq_tags') || 'null')
    if (Array.isArray(saved) && saved.length) return saved
  } catch {}
  return DEFAULT_TICKET_TAGS
}
function saveTicketTags(tags) { try{localStorage.setItem('lynq_tags',JSON.stringify(tags))}catch{} }

// ─── Demo data ───────────────────────────────────────────────
const DEMO_THREADS = [
  { id:'demo-1', from:'Sophie de Vries <sophie@example.com>', subject:'Where is my package?', snippet:'Hi, I placed an order 2 weeks ago but haven\'t received anything yet...', date:new Date(Date.now()-3600000*2).toISOString(), unread:true },
  { id:'demo-2', from:'Mark Jansen <mark.jansen@example.com>', subject:'Received wrong product', snippet:'Hi, I received my order but there is a wrong item inside...', date:new Date(Date.now()-3600000*5).toISOString(), unread:true },
  { id:'demo-3', from:'Lisa Bakker <lisa@example.com>', subject:'Refund request for order #1042', snippet:'Hi, I would like to request a refund for order #1042...', date:new Date(Date.now()-86400000).toISOString(), unread:false },
  { id:'demo-4', from:'Tom Hendricks <t.hendricks@example.com>', subject:'Re: Delivery time question', snippet:'Thanks so much for the quick reply! Great to know.', date:new Date(Date.now()-86400000*2).toISOString(), unread:false },
  { id:'demo-5', from:'Anna Smit <anna.smit@example.com>', subject:'Exchange size — order #1045', snippet:'Hi, I ordered a size M but would like to exchange it for a L, is that possible?', date:new Date(Date.now()-86400000*3).toISOString(), unread:false },
]
const DEMO_MESSAGES = {
  'demo-1': [
    { id:'dm1a', from:'Sophie de Vries <sophie@example.com>', date:new Date(Date.now()-3600000*2).toISOString(), body:'Hi,\n\nI placed an order 2 weeks ago (order #1038) but still haven\'t received anything. Could you look into this for me?\n\nBest regards,\nSophie' },
    { id:'dm1b', from:'Support <info@example.com>', date:new Date(Date.now()-3600000*1).toISOString(), body:'Hi Sophie,\n\nThank you for reaching out! I\'ll look into this right away. Could you confirm the email address you used when placing the order?\n\nBest regards,\nCustomer Support' },
  ],
  'demo-2': [
    { id:'dm2a', from:'Mark Jansen <mark.jansen@example.com>', date:new Date(Date.now()-3600000*5).toISOString(), body:'Hi,\n\nI received my order #1041 yesterday but there\'s a wrong item inside. I ordered a black shirt but received a blue one. Could you help resolve this?\n\nBest regards,\nMark Jansen' },
  ],
  'demo-3': [
    { id:'dm3a', from:'Lisa Bakker <lisa@example.com>', date:new Date(Date.now()-86400000).toISOString(), body:'Hi,\n\nI\'d like to request a refund for order #1042. Unfortunately the product didn\'t meet my expectations.\n\nCould you let me know how to proceed?\n\nBest regards,\nLisa Bakker' },
  ],
  'demo-4': [
    { id:'dm4a', from:'Tom Hendricks <t.hendricks@example.com>', date:new Date(Date.now()-86400000*2-3600000).toISOString(), body:'Hi,\n\nI\'d like to place an order but first wanted to know the delivery time to Belgium?\n\nThanks,\nTom' },
    { id:'dm4b', from:'Support <info@example.com>', date:new Date(Date.now()-86400000*2).toISOString(), body:'Hi Tom,\n\nThanks for your question! Deliveries to Belgium typically take 3–5 business days.\n\nBest regards,\nCustomer Support' },
    { id:'dm4c', from:'Tom Hendricks <t.hendricks@example.com>', date:new Date(Date.now()-86400000*2+3600000).toISOString(), body:'Thanks so much for the quick reply! Great to know.' },
  ],
  'demo-5': [
    { id:'dm5a', from:'Anna Smit <anna.smit@example.com>', date:new Date(Date.now()-86400000*3).toISOString(), body:'Hi,\n\nI ordered a size M (order #1045) but would like to exchange it for a size L. Is that possible and if so, how does it work?\n\nKind regards,\nAnna' },
  ],
}
const DEMO_CUSTOMER = {
  'demo-1': { customer:{ id:1001, firstName:'Sophie', lastName:'de Vries', email:'sophie@example.com', phone:'+31 6 12345678', city:'Amsterdam', country:'Netherlands', countryCode:'NL', ordersCount:3, totalSpent:'127.50', currency:'EUR', tags:'vip,repeat', note:'', createdAt:'2024-03-15T10:00:00Z' }, orders:[{ id:9001, name:'#1038', createdAt:'2025-04-10T14:30:00Z', financialStatus:'paid', fulfillmentStatus:'unfulfilled', totalPrice:'49.95', currency:'EUR', lineItems:[{ id:801, title:'Premium Cotton T-shirt', variantTitle:'Black / L', sku:'TSH-BLK-L', quantity:1, price:'49.95' }], fulfillments:[], hasRefund:false, shippingAddress:{ firstName:'Sophie', lastName:'de Vries', address1:'Keizersgracht 123', address2:'', city:'Amsterdam', zip:'1015 CJ', country:'Netherlands', countryCode:'NL', phone:'+31 6 12345678' } },{ id:9002, name:'#1031', createdAt:'2025-02-28T09:00:00Z', financialStatus:'paid', fulfillmentStatus:'fulfilled', totalPrice:'77.55', currency:'EUR', lineItems:[{ id:802, title:'Hoodie Classic', variantTitle:'Grey / M', sku:'HOD-GRY-M', quantity:1, price:'59.95' },{ id:803, title:'Socks 3-pack', variantTitle:'White', sku:'SOK-WHT', quantity:1, price:'17.60' }], fulfillments:[{ trackingNumber:'3SBME123456789', trackingUrl:'https://tracking.example.com/3SBME123456789', trackingCompany:'PostNL', status:'success' }], hasRefund:false, shippingAddress:{ firstName:'Sophie', lastName:'de Vries', address1:'Keizersgracht 123', address2:'', city:'Amsterdam', zip:'1015 CJ', country:'Netherlands', countryCode:'NL', phone:'+31 6 12345678' } }] },
  'demo-2': { customer:{ id:1002, firstName:'Mark', lastName:'Jansen', email:'mark.jansen@example.com', phone:'+31 6 87654321', city:'Rotterdam', country:'Netherlands', countryCode:'NL', ordersCount:1, totalSpent:'64.90', currency:'EUR', tags:'', note:'', createdAt:'2025-01-20T08:00:00Z' }, orders:[{ id:9003, name:'#1041', createdAt:'2025-04-22T11:00:00Z', financialStatus:'paid', fulfillmentStatus:'fulfilled', totalPrice:'64.90', currency:'EUR', lineItems:[{ id:804, title:'Slim Fit Shirt', variantTitle:'Blue / M', sku:'SHT-BLU-M', quantity:1, price:'44.95' },{ id:805, title:'Leather Belt', variantTitle:'Brown', sku:'RMN-BRN', quantity:1, price:'19.95' }], fulfillments:[{ trackingNumber:'3SBME987654321', trackingUrl:'https://tracking.example.com/3SBME987654321', trackingCompany:'DHL', status:'success' }], hasRefund:false, shippingAddress:{ firstName:'Mark', lastName:'Jansen', address1:'Coolsingel 45', address2:'', city:'Rotterdam', zip:'3011 AD', country:'Netherlands', countryCode:'NL', phone:'+31 6 87654321' } }] },
  'demo-3': { customer:{ id:1003, firstName:'Lisa', lastName:'Bakker', email:'lisa@example.com', phone:'', city:'Utrecht', country:'Netherlands', countryCode:'NL', ordersCount:2, totalSpent:'89.90', currency:'EUR', tags:'', note:'', createdAt:'2024-11-05T12:00:00Z' }, orders:[{ id:9004, name:'#1042', createdAt:'2025-04-18T16:00:00Z', financialStatus:'paid', fulfillmentStatus:'fulfilled', totalPrice:'44.95', currency:'EUR', lineItems:[{ id:806, title:'Yoga Leggings', variantTitle:'Black / S', sku:'YLG-BLK-S', quantity:1, price:'44.95' }], fulfillments:[{ trackingNumber:'3SBME555444333', trackingUrl:'', trackingCompany:'PostNL', status:'success' }], hasRefund:false, shippingAddress:{ firstName:'Lisa', lastName:'Bakker', address1:'Oudegracht 78', address2:'', city:'Utrecht', zip:'3511 AV', country:'Netherlands', countryCode:'NL', phone:'' } }] },
  'demo-4': { customer:{ id:1004, firstName:'Tom', lastName:'Hendricks', email:'t.hendricks@example.com', phone:'+32 476 123456', city:'Antwerp', country:'Belgium', countryCode:'BE', ordersCount:1, totalSpent:'54.95', currency:'EUR', tags:'', note:'', createdAt:'2025-03-01T10:00:00Z' }, orders:[{ id:9005, name:'#1039', createdAt:'2025-04-12T13:00:00Z', financialStatus:'paid', fulfillmentStatus:'fulfilled', totalPrice:'54.95', currency:'EUR', lineItems:[{ id:807, title:'Cargo Pants', variantTitle:'Khaki / 32', sku:'CRG-KHK-32', quantity:1, price:'54.95' }], fulfillments:[{ trackingNumber:'BE123456789', trackingUrl:'', trackingCompany:'bpost', status:'success' }], hasRefund:false, shippingAddress:{ firstName:'Tom', lastName:'Hendricks', address1:'Meir 22', address2:'', city:'Antwerp', zip:'2000', country:'Belgium', countryCode:'BE', phone:'+32 476 123456' } }] },
  'demo-5': { customer:{ id:1005, firstName:'Anna', lastName:'Smit', email:'anna.smit@example.com', phone:'+31 6 11223344', city:'Den Haag', country:'Netherlands', countryCode:'NL', ordersCount:4, totalSpent:'212.80', currency:'EUR', tags:'vip', note:'Prefer no promotional emails', createdAt:'2023-09-10T09:00:00Z' }, orders:[{ id:9006, name:'#1045', createdAt:'2025-04-24T10:00:00Z', financialStatus:'paid', fulfillmentStatus:'unfulfilled', totalPrice:'39.95', currency:'EUR', lineItems:[{ id:808, title:"Women's Sports Shirt", variantTitle:'Pink / M', sku:'SPT-PNK-M', quantity:1, price:'39.95' }], fulfillments:[], hasRefund:false, shippingAddress:{ firstName:'Anna', lastName:'Smit', address1:'Binnenhof 1', address2:'', city:'Den Haag', zip:'2513 AA', country:'Netherlands', countryCode:'NL', phone:'+31 6 11223344' } }] },
}

// ─── CSS ─────────────────────────────────────────────────────
const CSS = `
  @keyframes fadeUp   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes slideIn  { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes shimmer  { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes toastIn  { from{opacity:0;transform:translateY(14px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes msgIn    { from{opacity:0;transform:translateY(10px) scale(.99)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes modalIn  { from{opacity:0;transform:scale(.96) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes glowPulse { 0%,100%{opacity:.5} 50%{opacity:1} }

  /* ── Aurora background animations ── */
  @keyframes auroraA {
    0%,100% { transform:translate(0,0) scale(1);           opacity:.75; }
    33%      { transform:translate(70px,-90px) scale(1.28); opacity:.9; }
    66%      { transform:translate(-50px,45px) scale(.88);  opacity:.6; }
  }
  @keyframes auroraB {
    0%,100% { transform:translate(0,0) scale(1);             opacity:.65; }
    40%      { transform:translate(-90px,60px) scale(1.22);  opacity:.85; }
    75%      { transform:translate(55px,-35px) scale(.82);   opacity:.5; }
  }
  @keyframes auroraC {
    0%,100% { transform:translate(0,0) scale(1);          opacity:.55; }
    55%      { transform:translate(45px,75px) scale(1.15); opacity:.75; }
  }
  @keyframes auroraD {
    0%,100% { transform:translate(0,0) scale(1);             opacity:.6; }
    45%      { transform:translate(-55px,-50px) scale(1.3);  opacity:.8; }
  }
  @keyframes auroraE {
    0%,100% { transform:translate(0,0) scale(1);          opacity:.6; }
    60%      { transform:translate(75px,35px) scale(1.2); opacity:.85; }
  }

  .ir * { box-sizing:border-box; margin:0; padding:0; }
  .ir { font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,'Inter',sans-serif; -webkit-font-smoothing:antialiased; }
  button { border:none; background:none; }
  input,textarea,select { font-family:inherit; }

  /* ── Global focus ring (keyboard nav) ── */
  button:focus-visible,a:focus-visible { outline:2px solid rgba(161,117,252,0.65); outline-offset:2px; border-radius:6px; }
  input:focus-visible,textarea:focus-visible,[contenteditable]:focus-visible { outline:none; }

  /* ── Thread row ── */
  .trow { padding:11px 14px 11px 12px; cursor:pointer; border-bottom:1px solid var(--border); border-left:3px solid transparent; transition:background .15s; position:relative; display:flex; align-items:flex-start; gap:9px; }
  .trow:hover:not(.trow-active) { background:var(--bg-surface-2); }
  .trow-active { background:rgba(124,92,252,0.05); border-left-color:var(--accent); }
  [data-theme="dark"] .trow:hover:not(.trow-active) { background:rgba(255,255,255,0.03); }
  [data-theme="dark"] .trow-active { background:linear-gradient(90deg,rgba(161,117,252,0.18) 0%,rgba(161,117,252,0.04) 100%); }
  .trow-active::after { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:linear-gradient(180deg,#C3A3FF 0%,#7B45E8 100%); border-radius:0 2px 2px 0; }
  .trow-cb { width:16px; height:16px; border-radius:4px; border:1.5px solid var(--border); background:var(--bg-surface); cursor:pointer; appearance:none; -webkit-appearance:none; flex-shrink:0; margin-top:2px; transition:all .15s; }
  .trow-cb:checked { background:var(--accent); border-color:var(--accent); background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M13.3 4.3a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L6.6 9.6l5.3-5.3a1 1 0 0 1 1.4 0z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:center; }
  .trow-cb:hover:not(:checked) { border-color:var(--accent-border); }
  .trow-snippet { overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }

  /* ── View tabs — pill style ── */
  .vtab { padding:6px 12px; background:transparent; cursor:pointer; font-size:11.5px; font-weight:500; font-family:inherit; border-radius:0; transition:all .18s; color:var(--text-3); white-space:nowrap; letter-spacing:.01em; border:none; border-bottom:2px solid transparent; }
  .vtab.on { color:var(--text-1); border-bottom-color:var(--accent); font-weight:600; background:transparent; }
  .vtab:hover:not(.on) { color:var(--text-2); }

  /* ── Composer tab ── */
  .ctab { padding:9px 15px; background:transparent; cursor:pointer; font-size:12.5px; font-weight:500; font-family:inherit; border-bottom:2px solid transparent; transition:color .15s,border-color .15s; color:var(--text-3); }
  .ctab.on { color:var(--text-1); border-bottom-color:#A175FC; font-weight:600; }
  .ctab:hover:not(.on) { color:var(--text-2); }

  /* ── Scrollbar ── */
  .sscroll::-webkit-scrollbar { width:3px; }
  .sscroll::-webkit-scrollbar-track { background:transparent; }
  .sscroll::-webkit-scrollbar-thumb { background:var(--bg-surface-2); border-radius:2px; }

  /* ── Skeleton ── */
  .skel { background:linear-gradient(90deg,var(--skeleton-from) 25%,var(--skeleton-to) 50%,var(--skeleton-from) 75%); background-size:400% 100%; animation:shimmer 1.8s linear infinite; border-radius:6px; }

  /* ── Status dropdown ── */
  .sdrop { position:absolute; top:calc(100% + 6px); right:0; background:var(--bg-surface); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:13px; padding:5px; z-index:100; min-width:155px; box-shadow:var(--shadow-card-hover); animation:fadeUp .14s ease both; }
  [data-theme="dark"] .sdrop { box-shadow:0 24px 64px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.04); }
  .sopt  { padding:9px 12px; border-radius:8px; cursor:pointer; font-size:12.5px; font-weight:600; display:flex; align-items:center; gap:8px; transition:background .12s; font-family:inherit; width:100%; text-align:left; }
  .sopt:hover { background:var(--bg-surface-2); }

  /* ── Inbox search ── */
  .isearch { width:100%; padding:9px 12px 9px 34px; background:var(--bg-input); border:1px solid var(--border); border-radius:10px; color:var(--text-1); font-size:12.5px; outline:none; transition:all .2s; }
  .isearch:focus { border-color:var(--accent-border); background:rgba(161,117,252,0.05); box-shadow:0 0 0 3px rgba(161,117,252,0.08); }
  .isearch::placeholder { color:var(--text-3); }

  /* ── Macro ── */
  .macro-panel { display:flex; border-top:1px solid var(--border); animation:fadeUp .18s ease both; height:min(360px,46vh); min-height:220px; }
  .macro-list { width:230px; border-right:1px solid var(--border); overflow-y:auto; flex-shrink:0; }
  .macro-item { padding:10px 14px; cursor:pointer; transition:background .12s; border-left:2px solid transparent; }
  .macro-item:hover { background:var(--bg-surface-2); }
  .macro-item.mi-active { background:rgba(161,117,252,0.09); border-left-color:#A175FC; }
  .macro-preview { flex:1; padding:14px 16px; overflow-y:auto; font-size:13px; line-height:1.75; color:var(--text-2); white-space:pre-wrap; }
  .macro-var { color:#A175FC; background:rgba(161,117,252,0.12); padding:1px 5px; border-radius:4px; font-weight:600; font-size:11px; }
  .macro-suggest { padding:4px 14px 6px; font-size:9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-3); }
  .macro-tag { font-size:10px; font-weight:600; padding:1px 6px; border-radius:4px; background:var(--bg-surface-2); color:var(--text-3); }
  .macro-gear-menu { position:absolute; top:calc(100% + 4px); right:0; min-width:192px; background:var(--bg-surface); border:1px solid var(--border); border-radius:10px; box-shadow:0 8px 24px rgba(15,23,42,0.12),0 2px 6px rgba(15,23,42,0.06); z-index:40; padding:4px; animation:fadeUp .14s ease both; }
  .macro-gear-item { display:flex; align-items:center; gap:9px; width:100%; padding:8px 11px; border-radius:7px; background:none; border:none; font-family:inherit; font-size:12.5px; color:var(--text-1); cursor:pointer; text-align:left; transition:background .12s; }
  .macro-gear-item:hover { background:var(--bg-surface-2); }
  .macro-gear-item.danger { color:var(--danger); }
  .macro-gear-divider { height:1px; background:var(--border); margin:3px 0; }
  .macro-star { background:none; border:none; cursor:pointer; display:flex; align-items:center; padding:2px 3px; border-radius:4px; transition:opacity .15s; flex-shrink:0; opacity:0; }
  .macro-item:hover .macro-star { opacity:0.45; }
  .macro-star:hover { opacity:1 !important; }
  .macro-star.fav { opacity:1; }

  /* ── Compose textarea ── */
  .compose-ta { width:100%; resize:none; outline:none; font-family:inherit; background:transparent; border:none; padding:14px 16px; font-size:13.5px; color:var(--text-1); line-height:1.78; letter-spacing:.005em; }

  /* ── Compose box ── */
  .compose-box { background:var(--bg-surface); }
  [data-theme="dark"] .compose-box { background:rgba(255,255,255,0.025); }

  /* ── Suggested macro chips ── */
  .macro-chip-suggest { display:inline-flex; align-items:center; font-size:11px; font-weight:500; font-family:inherit; padding:3px 10px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-1); cursor:pointer; transition:all .15s; white-space:nowrap; }
  .macro-chip-suggest:hover { border-color:var(--accent-border); color:var(--accent-text); background:var(--accent-soft); }

  /* ── Buttons ── */
  .btn-send { padding:9px 20px; font-size:13px; font-weight:600; font-family:inherit; background:linear-gradient(135deg,#A175FC 0%,#7B45E8 100%); color:#fff; border-radius:10px; cursor:pointer; transition:all .2s cubic-bezier(.16,1,.3,1); box-shadow:0 2px 14px rgba(161,117,252,0.45); letter-spacing:.01em; }
  .btn-send:hover:not(:disabled) { background:linear-gradient(135deg,#BA96FF 0%,#9B6FFF 100%); box-shadow:0 6px 24px rgba(161,117,252,0.6); transform:translateY(-1px); }
  .btn-send:active:not(:disabled) { transform:translateY(0); box-shadow:0 2px 8px rgba(161,117,252,0.4); }
  .btn-send:disabled { opacity:.28; cursor:not-allowed; transform:none; box-shadow:none; }
  .btn-ghost { padding:9px 16px; font-size:12.5px; font-weight:500; font-family:inherit; background:var(--bg-input); border:1px solid var(--border); color:var(--text-2); border-radius:10px; cursor:pointer; transition:all .15s; }
  .btn-ghost:hover:not(:disabled) { border-color:var(--text-3); color:var(--text-1); background:var(--bg-surface-2); }
  .btn-ghost:disabled { opacity:.28; cursor:not-allowed; }
  .btn-close { padding:9px 16px; font-size:12.5px; font-weight:600; font-family:inherit; background:rgba(74,222,128,0.07); border:1px solid rgba(74,222,128,0.2); color:rgba(74,222,128,0.75); border-radius:10px; cursor:pointer; transition:all .18s; display:flex; align-items:center; gap:5px; }
  .btn-close:hover:not(:disabled) { background:rgba(74,222,128,0.13); border-color:rgba(74,222,128,0.38); color:#4ade80; box-shadow:0 2px 12px rgba(74,222,128,0.15); }
  .btn-close:disabled { opacity:.28; cursor:not-allowed; }
  .btn-danger { padding:9px 20px; font-size:13px; font-weight:600; font-family:inherit; background:linear-gradient(135deg,#ef4444,#c81e1e); color:#fff; border-radius:10px; cursor:pointer; transition:all .2s cubic-bezier(.16,1,.3,1); box-shadow:0 2px 14px rgba(239,68,68,0.35); }
  .btn-danger:hover:not(:disabled) { background:linear-gradient(135deg,#f87171,#ef4444); box-shadow:0 6px 24px rgba(239,68,68,0.5); transform:translateY(-1px); }
  .btn-danger:active:not(:disabled) { transform:translateY(0); }
  .btn-danger:disabled { opacity:.3; cursor:not-allowed; }
  .btn-iris { padding:8px 16px; font-size:12.5px; font-weight:600; font-family:inherit; background:var(--accent-soft); border:1px solid var(--accent-border); color:var(--accent-text); border-radius:11px; cursor:pointer; transition:all .2s cubic-bezier(.16,1,.3,1); box-shadow:var(--shadow-row); }
  .btn-iris:hover:not(:disabled) { background:linear-gradient(135deg,rgba(124,92,252,0.16) 0%,rgba(124,92,252,0.10) 100%); border-color:var(--accent); transform:translateY(-1px); box-shadow:0 6px 20px rgba(124,92,252,0.18); }
  .btn-iris:disabled { opacity:.3; cursor:not-allowed; }

  /* ── Order card ── */
  .order-card { background:var(--bg-surface); border:1px solid var(--border); border-radius:18px; padding:16px 16px 14px; margin-bottom:10px; position:relative; overflow:hidden; transition:all .24s cubic-bezier(.16,1,.3,1); box-shadow:var(--shadow-card); }
  .order-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:linear-gradient(180deg,#C3A3FF 0%,rgba(161,117,252,0.1) 100%); border-radius:0 3px 3px 0; }
  .order-card::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 50% 35% at 85% 0%,rgba(161,117,252,0.07) 0%,transparent 65%); pointer-events:none; }
  .order-card:hover { border-color:var(--accent-border); box-shadow:var(--shadow-card-hover); transform:translateY(-1px); }

  /* ── Order actions grid ── */
  .order-actions { display:grid; grid-template-columns:1fr 1fr; gap:5px; padding-top:11px; border-top:1px solid var(--border); margin-top:4px; }
  .oa-btn { padding:8px 10px; display:flex; align-items:center; justify-content:center; gap:6px; font-size:11.5px; font-weight:600; font-family:inherit; background:var(--bg-input); border:1px solid var(--border); color:var(--text-3); border-radius:10px; cursor:pointer; transition:all .18s cubic-bezier(.16,1,.3,1); white-space:nowrap; }
  .oa-btn:hover { background:rgba(161,117,252,0.12); border-color:rgba(161,117,252,0.28); color:#C3A3FF; transform:translateY(-1px); box-shadow:0 4px 14px rgba(161,117,252,0.18); }
  .oa-btn:active { transform:translateY(0); }
  .oa-btn.oa-danger:hover { background:rgba(239,68,68,0.09); border-color:rgba(239,68,68,0.28); color:#fca5a5; box-shadow:0 4px 14px rgba(239,68,68,0.14); }
  .oa-btn.oa-green:hover { background:rgba(74,222,128,0.09); border-color:rgba(74,222,128,0.28); color:#86efac; }
  .oa-btn svg { flex-shrink:0; opacity:.55; transition:opacity .15s; }
  .oa-btn:hover svg { opacity:1; }

  /* ── Modal ── */
  .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); z-index:500; display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn .2s ease; }
  .modal-box { background:var(--bg-surface); border:1px solid var(--border); border-radius:22px; padding:28px 30px; box-shadow:var(--shadow-card-hover); width:100%; max-width:560px; animation:modalIn .24s cubic-bezier(.16,1,.3,1); max-height:88vh; display:flex; flex-direction:column; overflow:hidden; }
  [data-theme="dark"] .modal-box { border-color:rgba(161,117,252,0.2); box-shadow:0 48px 120px rgba(0,0,0,0.8),0 0 0 1px rgba(161,117,252,0.08); }
  .modal-body { overflow-y:auto; flex:1; }
  .modal-body::-webkit-scrollbar { width:3px; }
  .modal-body::-webkit-scrollbar-thumb { background:var(--bg-surface-2); border-radius:2px; }
  .modal-input { width:100%; background:var(--bg-surface-2); border:1px solid var(--border); border-radius:10px; padding:11px 14px; font-size:13.5px; color:var(--text-1); outline:none; transition:border-color .2s,box-shadow .2s; font-family:inherit; }
  .modal-input:focus { border-color:var(--accent-border); box-shadow:0 0 0 3px rgba(161,117,252,0.1); }
  .modal-input::placeholder { color:var(--text-3); }
  .modal-select { width:100%; background:var(--bg-surface-2); border:1px solid var(--border); border-radius:10px; padding:11px 14px; font-size:13.5px; color:var(--text-1); outline:none; font-family:inherit; cursor:pointer; }
  .modal-select option { background:#130a2e; }
  .modal-label { font-size:10.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--text-3); margin-bottom:7px; display:block; }
  .modal-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .chk-row { display:flex; align-items:center; gap:9px; cursor:pointer; user-select:none; }
  .chk-box { width:18px; height:18px; border-radius:5px; border:1.5px solid rgba(255,255,255,0.13); background:var(--bg-input); display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .15s; }
  .chk-box.chk-on { background:#A175FC; border-color:#A175FC; box-shadow:0 0 14px rgba(161,117,252,0.5); }
  .li-row { display:flex; align-items:center; gap:12px; padding:11px 0; border-bottom:1px solid var(--border); }
  .li-row:last-child { border-bottom:none; }
  .qty-btn { width:28px; height:28px; border-radius:7px; background:var(--bg-surface-2); border:1px solid var(--border); color:var(--text-2); font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; flex-shrink:0; }
  .qty-btn:hover:not(:disabled) { background:rgba(161,117,252,0.18); border-color:rgba(161,117,252,0.35); color:#B48CFF; }
  .qty-btn:disabled { opacity:.28; cursor:not-allowed; }

  /* ── Info grid ── */
  .info-label { font-size:10px; font-weight:700; color:var(--text-3); letter-spacing:.07em; text-transform:uppercase; }
  .info-val   { font-size:12.5px; color:var(--text-1); margin-top:2px; line-height:1.5; }
  .stat-card  { background:var(--bg-surface); border:1px solid var(--border); border-radius:14px; padding:13px 15px; transition:all .22s cubic-bezier(.16,1,.3,1); box-shadow:var(--shadow-card); }
  .stat-card:hover { border-color:var(--accent-border); box-shadow:var(--shadow-card-hover); transform:translateY(-1px); }
  [data-theme="dark"] .stat-card { background:linear-gradient(145deg,rgba(255,255,255,0.055) 0%,rgba(161,117,252,0.018) 100%); box-shadow:0 4px 16px rgba(0,0,0,0.18); }
  [data-theme="dark"] .stat-card:hover { background:linear-gradient(145deg,rgba(255,255,255,0.07) 0%,rgba(161,117,252,0.03) 100%); box-shadow:0 8px 28px rgba(0,0,0,0.28),0 0 0 1px rgba(161,117,252,0.1); }

  /* ── Tracking ── */
  .track-pill { display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:600; padding:3px 9px; border-radius:100px; }

  /* ── Urgency badges ── */
  .urg-pill { display:inline-flex; align-items:center; gap:4px; font-size:9px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; padding:2px 8px; border-radius:100px; }
  .urg-dot  { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
  @keyframes urgPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
  .urg-critical .urg-dot { animation:urgPulse 1.4s ease-in-out infinite; }
  .urg-critical { box-shadow:0 0 10px rgba(239,68,68,0.28); }
  .urg-high    { box-shadow:0 0 8px rgba(249,115,22,0.2); }

  /* ── Rich text toolbar ── */
  .rtbar { display:flex; align-items:center; gap:1px; padding:7px 12px; border-bottom:1px solid var(--border); flex-wrap:nowrap; overflow-x:auto; }
  .rtbar::-webkit-scrollbar { display:none; }
  .rtbar-btn { min-width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:7px; cursor:pointer; font-size:12px; font-weight:700; font-family:inherit; color:var(--text-3); transition:all .16s; border:none; background:transparent; padding:0 6px; white-space:nowrap; gap:4px; }
  .rtbar-btn:hover { background:var(--bg-surface-2); color:var(--text-1); }
  .rtbar-btn.rton { background:rgba(161,117,252,0.16); color:#B48CFF; }
  .rtbar-sep { width:1px; height:18px; background:var(--bg-surface-2); margin:0 6px; flex-shrink:0; }
  .compose-ta[contenteditable=true]:empty:before { content:attr(data-placeholder); color:var(--text-3); pointer-events:none; display:block; }
  .cm-input { color:var(--text-1) !important; -webkit-text-fill-color:var(--text-1) !important; background:transparent !important; }
  .cm-input::placeholder { color:var(--text-3); -webkit-text-fill-color:var(--text-3); }
  .cm-input:focus { caret-color:#A175FC; outline:none; }
  .cm-input:-webkit-autofill,
  .cm-input:-webkit-autofill:hover,
  .cm-input:-webkit-autofill:focus,
  .cm-input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px var(--bg-surface) inset !important;
    -webkit-text-fill-color: var(--text-1) !important;
    caret-color: var(--accent);
    transition: background-color 9999s ease-in-out 0s;
  }

  /* ── Emoji picker — glassmorphism ── */
  .emoji-pop { position:absolute; bottom:calc(100% + 8px); left:-8px; background:rgba(12,6,32,0.94); backdrop-filter:blur(28px); -webkit-backdrop-filter:blur(28px); border:1px solid var(--border); border-radius:16px; padding:10px; z-index:200; box-shadow:0 24px 80px rgba(0,0,0,0.72),0 0 0 1px rgba(161,117,252,0.07); animation:fadeUp .16s ease both; }
  .emoji-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
  .emoji-btn { width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:17px; cursor:pointer; border:none; background:transparent; transition:background .1s; }
  .emoji-btn:hover { background:rgba(161,117,252,0.15); }

  /* ── Attachments ── */
  .attach-chip { display:inline-flex; align-items:center; gap:5px; padding:4px 10px 4px 8px; background:rgba(161,117,252,0.08); border:1px solid rgba(161,117,252,0.2); border-radius:8px; font-size:11px; color:rgba(161,117,252,0.85); }

  /* ── Translate banner ── */
  .xlate-bar { display:flex; align-items:center; gap:8px; padding:6px 14px; background:linear-gradient(90deg,rgba(161,117,252,0.1) 0%,rgba(161,117,252,0.04) 100%); border-bottom:1px solid rgba(161,117,252,0.14); font-size:11.5px; color:#B48CFF; }

  /* ── Msg translate btn ── */
  .msg-xlate-btn { font-size:10px; font-weight:600; color:var(--text-3); background:none; border:none; cursor:pointer; padding:2px 7px; font-family:inherit; transition:all .15s; border-radius:5px; }
  .msg-xlate-btn:hover { color:#A175FC; background:rgba(161,117,252,0.1); }

  /* ── Message bubbles — clean, email-style ── */
  .msg-in  {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 2px 14px 14px 14px;
    padding: 14px 18px;
    font-size: 13.5px;
    line-height: 1.75;
    color: #0F172A;
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow: 0 1px 3px rgba(15,23,42,0.06);
  }
  [data-theme="dark"] .msg-in {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 2px 14px 14px 14px;
    color: var(--text-1);
    box-shadow: none;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .msg-out {
    background: #F0EEFF;
    border: 1px solid #DDD6FE;
    border-radius: 14px 2px 14px 14px;
    padding: 14px 18px;
    font-size: 13.5px;
    line-height: 1.75;
    color: #0F172A;
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow: 0 1px 3px rgba(124,92,252,0.08);
  }
  [data-theme="dark"] .msg-out {
    background: rgba(124,92,252,0.14);
    border: 1px solid rgba(161,117,252,0.22);
    border-radius: 14px 2px 14px 14px;
    color: var(--text-1);
    box-shadow: none;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .msg-note {
    background: #FFFBEB;
    border: 1px solid #FDE68A;
    border-left: 3px solid #F59E0B;
    border-radius: 2px 14px 14px 14px;
    padding: 14px 18px;
    font-size: 13.5px;
    line-height: 1.75;
    color: #0F172A;
    white-space: pre-wrap;
    word-break: break-word;
  }
  [data-theme="dark"] .msg-note {
    background: rgba(251,191,36,0.08);
    border: 1px solid rgba(251,191,36,0.2);
    border-left: 3px solid rgba(251,191,36,0.5);
    color: var(--text-1);
  }
  .msg-sender { font-size:10.5px; color:var(--text-2); font-weight:700; letter-spacing:.01em; }
  .msg-time   { font-size:10px; color:var(--text-3); margin-left:7px; font-weight:400; }

  /* ── Inbox aurora — subtle in light, full in dark ── */
  .in-bg { background:var(--bg-page); }
  [data-theme="dark"] .in-bg { background:#0A0520; }

  .in-panel-l { background:var(--bg-surface); border-right:1px solid var(--border); }
  [data-theme="dark"] .in-panel-l { background:rgba(10,4,28,0.52); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border-right:1px solid rgba(255,255,255,0.07); }

  /* Aurora — hidden in light mode (work tool), full in dark */
  .in-al1, .in-al4, .in-al6, .in-grid { display:none; }
  [data-theme="dark"] .in-al1 { display:block; position:absolute; top:-25%; left:12%; width:1000px; height:900px; border-radius:50%; background:radial-gradient(ellipse,rgba(161,117,252,0.62) 0%,rgba(124,58,237,0.32) 38%,rgba(109,40,217,0.1) 60%,transparent 74%); animation:auroraA 22s ease-in-out infinite; filter:blur(55px); }
  [data-theme="dark"] .in-al4 { display:block; position:absolute; top:2%; left:3%; width:420px; height:420px; border-radius:50%; background:radial-gradient(ellipse,rgba(139,92,246,0.55) 0%,rgba(109,40,217,0.22) 50%,transparent 72%); animation:auroraD 19s ease-in-out infinite; filter:blur(42px); }
  [data-theme="dark"] .in-al6 { display:block; position:absolute; bottom:10%; left:30%; width:500px; height:500px; border-radius:50%; background:radial-gradient(ellipse,rgba(107,63,196,0.38) 0%,rgba(75,40,148,0.14) 48%,transparent 70%); animation:auroraB 26s ease-in-out infinite reverse; filter:blur(58px); }
  [data-theme="dark"] .in-grid { display:block; position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px); background-size:72px 72px; }
  .in-vig { position:absolute; inset:0; }
  [data-theme="dark"] .in-vig { background:radial-gradient(ellipse 115% 105% at 50% 50%,transparent 32%,rgba(10,5,32,0.42) 70%,rgba(10,5,32,0.82) 100%); }

  @media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }

  /* ── Right Panel — Gorgias style ── */
  .rp-search { width:100%; padding:7px 12px 7px 32px; background:var(--bg-surface-2); border:1px solid var(--border); border-radius:8px; color:var(--text-1); font-size:12px; outline:none; transition:border-color .2s; font-family:inherit; }
  .rp-search:focus { border-color:var(--accent-border); }
  .rp-search::placeholder { color:var(--text-3); }
  .rp-tab { flex:1; padding:8px 6px; background:transparent; cursor:pointer; font-size:11.5px; font-weight:500; font-family:inherit; color:var(--text-2); border:none; border-bottom:2px solid transparent; transition:all .15s; white-space:nowrap; text-align:center; }
  .rp-tab.on { color:var(--text-1); border-bottom-color:var(--accent); font-weight:600; }
  .rp-tab:hover:not(.on) { color:var(--text-1); }
  .rp-section { width:100%; display:flex; align-items:center; gap:6px; padding:9px 14px; background:transparent; cursor:pointer; border:none; font-family:inherit; text-align:left; transition:background .12s; }
  .rp-section:hover { background:var(--bg-surface-2); }
  .rp-kv { display:flex; align-items:baseline; justify-content:space-between; gap:16px; padding:3px 0; }
  .rp-kv-l { font-size:11px; color:var(--text-2); flex-shrink:0; min-width:72px; }
  .rp-kv-v { font-size:11.5px; color:var(--text-1); text-align:right; word-break:break-word; }
  .rp-order-hdr { width:100%; display:flex; align-items:center; gap:6px; padding:10px 14px 9px; background:transparent; cursor:pointer; border:none; font-family:inherit; text-align:left; transition:background .12s; }
  .rp-order-hdr:hover { background:var(--bg-surface-2); }
  .rp-action { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:500; font-family:inherit; padding:4px 9px; border-radius:6px; border:1px solid var(--border); background:var(--bg-surface); color:var(--text-1); cursor:pointer; transition:all .15s; white-space:nowrap; }
  .rp-action:hover { border-color:var(--border-hover); background:var(--bg-surface-2); }
  .rp-action.danger:hover { border-color:rgba(220,38,38,0.35); color:#dc2626; background:rgba(220,38,38,0.05); }
  [data-theme="dark"] .rp-action.danger:hover { color:#f87171; background:rgba(239,68,68,0.08); }
  .rp-subsec { width:100%; display:flex; align-items:center; gap:6px; padding:7px 0; background:transparent; cursor:pointer; border:none; font-size:11.5px; font-weight:600; font-family:inherit; color:var(--text-1); text-align:left; transition:opacity .12s; border-top:1px solid var(--border); margin-top:6px; }
  [data-theme="dark"] .rp-subsec { border-top-color:rgba(255,255,255,0.1); }
  .rp-subsec:hover { opacity:.75; }
  .rp-tag { font-size:10px; font-weight:500; padding:2px 7px; border-radius:4px; background:var(--bg-surface-2); color:var(--text-1); border:1px solid var(--border); }
`

// ─── Icons ────────────────────────────────────────────────────
const I = {
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  refresh:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  chevron:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  send:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  ai:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  mail:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  lightning:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  close:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  truck:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  mappin:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  edit:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  check:    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  plus:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  copy:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  shopify:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  externalLink:<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  truck2:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  note:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  tag:        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  spin:       <div style={{width:13,height:13,border:'2px solid rgba(255,255,255,0.18)',borderTop:'2px solid #A175FC',borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}} />,
  bold:       <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>,
  italic:     <svg width="11" height="12" viewBox="0 0 24 24" fill="currentColor"><line x1="19" y1="4" x2="10" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="14" y1="20" x2="5" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="15" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  underline:  <svg width="12" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>,
  link2:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  image2:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  emoji:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  paperclip:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  globe:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  xsmall:     <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
}

// ─── Helpers ─────────────────────────────────────────────────
function extractEmail(s) { if (!s) return ''; const m=s.match(/<(.+?)>/); return m?m[1]:s.trim() }
function extractName(s)  { if (!s) return 'Unknown'; const m=s.match(/^([^<]+)/); return m?m[1].trim().replace(/"/g,''):s }
function formatDate(s) {
  if(!s) return ''
  const diff = Date.now()-new Date(s)
  if(diff<60000) return 'just now'
  if(diff<3600000) return `${Math.floor(diff/60000)}m ago`
  if(diff<86400000) return `${Math.floor(diff/3600000)}h ago`
  if(diff<604800000) return `${Math.floor(diff/86400000)}d ago`
  return new Date(s).toLocaleDateString([],{month:'short',day:'numeric'})
}
function fmtPrice(v,c='EUR') { return new Intl.NumberFormat('en-US',{style:'currency',currency:c||'EUR'}).format(Number(v)||0) }
function authFetch(url, opts={}, token) { return fetch(url,{...opts,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...opts.headers}}) }

// ─── Base components ─────────────────────────────────────────
function Avatar({ name='?', size=32 }) {
  const ini=(name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  const COLS=['#7c3aed','#a855f7','#059669','#d97706','#0ea5e9','#be185d','#6d28d9']
  const col=COLS[(ini.charCodeAt(0)+(ini.charCodeAt(1)||0))%COLS.length]
  return <div style={{width:size,height:size,borderRadius:'50%',background:col,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.34,fontWeight:700,flexShrink:0,letterSpacing:'-0.01em'}}>{ini}</div>
}

function OrderBadge({ status }) {
  if (!status) return null
  const s=ORDER_STATUS[status?.toLowerCase()]||{bg:'var(--bg-input)',color:'var(--text-3)',label:status}
  return <span style={{fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:100,background:s.bg,color:s.color,border:`1px solid ${s.color}22`,letterSpacing:'.01em'}}>{s.label||status}</span>
}

function TicketBadge({ status }) {
  const s=STATUS[status]||STATUS.open
  return <span style={{fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:100,background:s.bg,color:s.color,border:`1px solid ${s.border}`}}>{s.label}</span>
}

function Spinner({ size=13, white=false }) {
  return <div style={{width:size,height:size,border:`2px solid rgba(255,255,255,0.18)`,borderTop:`2px solid ${white?'#fff':'#A175FC'}`,borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}} />
}

function Toast({ msg, type, onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,3200); return ()=>clearTimeout(t) },[onDone])
  const ok=type==='success'
  return (
    <div style={{position:'fixed',bottom:24,right:24,padding:'11px 18px',display:'flex',alignItems:'center',gap:10,background:ok?'rgba(74,222,128,0.1)':'rgba(248,113,133,0.1)',border:`1px solid ${ok?'rgba(74,222,128,0.28)':'rgba(248,113,133,0.28)'}`,borderRadius:11,fontSize:13,fontWeight:500,color:ok?'#4ade80':'#fb7185',zIndex:9999,animation:'toastIn .28s ease both',boxShadow:'0 8px 32px rgba(0,0,0,0.35)'}}>
      <span style={{width:7,height:7,borderRadius:'50%',background:ok?'#4ade80':'#fb7185',flexShrink:0,boxShadow:`0 0 8px ${ok?'#4ade80':'#fb7185'}`}} />
      {msg}
    </div>
  )
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeSafeUrl(value, { allowImages = false } = {}) {
  if (typeof window === 'undefined') return ''
  try {
    const url = new URL(String(value || '').trim(), window.location.origin)
    const safeProtocols = allowImages ? ['http:', 'https:', 'data:'] : ['http:', 'https:', 'mailto:', 'tel:']
    if (!safeProtocols.includes(url.protocol)) return ''
    if (url.protocol === 'data:' && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(String(value))) return ''
    return ['mailto:', 'tel:'].includes(url.protocol) ? url.href : url.toString()
  } catch {
    return ''
  }
}

function sanitizeHtml(html = '') {
  if (typeof document === 'undefined') return escapeHtml(html).replace(/\n/g, '<br>')

  const allowedTags = new Set(['A','B','BR','BLOCKQUOTE','CODE','DIV','EM','I','LI','OL','P','PRE','SPAN','STRONG','U','UL','IMG'])
  const template = document.createElement('template')
  template.innerHTML = String(html)

  template.content.querySelectorAll('script,style,iframe,object,embed,form,meta,link').forEach(node => node.remove())
  template.content.querySelectorAll('*').forEach(node => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes)
      return
    }

    ;[...node.attributes].forEach(attr => {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on') || name === 'style') node.removeAttribute(attr.name)
    })

    if (node.tagName === 'A') {
      const href = normalizeSafeUrl(node.getAttribute('href'))
      if (href) {
        node.setAttribute('href', href)
        node.setAttribute('rel', 'noopener noreferrer')
        node.setAttribute('target', '_blank')
      } else {
        node.removeAttribute('href')
      }
    } else if (node.tagName === 'IMG') {
      const src = normalizeSafeUrl(node.getAttribute('src'), { allowImages: true })
      if (src) node.setAttribute('src', src)
      else node.remove()
      node.removeAttribute('srcset')
    } else {
      ;[...node.attributes].forEach(attr => node.removeAttribute(attr.name))
    }
  })

  return template.innerHTML
}

function plainTextToSafeHtml(text = '') {
  return escapeHtml(text).replace(/\n/g, '<br>')
}

function StatusMenu({ current, onChange, onClose }) {
  const ref=useRef(null)
  useEffect(()=>{ function h(e){if(ref.current&&!ref.current.contains(e.target))onClose()} document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h) },[onClose])
  return (
    <div ref={ref} className="sdrop">
      {Object.entries(STATUS).map(([k,s])=>(
        <button key={k} className="sopt" onClick={()=>{onChange(k);onClose()}} style={{color:s.color}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0}} />
          {s.label}
          {current===k&&<span style={{marginLeft:'auto',fontSize:10,color:'var(--text-3)'}}>✓</span>}
        </button>
      ))}
    </div>
  )
}

// ─── Checkbox helper ──────────────────────────────────────────
function Chk({ checked, onChange, label }) {
  return (
    <label className="chk-row">
      <div className={`chk-box${checked?' chk-on':''}`} onClick={onChange}>
        {checked && <span style={{color:'#fff',display:'flex'}}>{I.check}</span>}
      </div>
      <span style={{fontSize:13,color:'var(--text-2)'}}>{label}</span>
    </label>
  )
}

// ─── Modal base ───────────────────────────────────────────────
function ModalBase({ title, onClose, children, footer }) {
  useEffect(()=>{ function h(e){if(e.key==='Escape')onClose()} document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h) },[onClose])
  return (
    <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="modal-box">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexShrink:0}}>
          <span style={{fontSize:17,fontWeight:700,color:'var(--text-1)',letterSpacing:'-0.01em'}}>{title}</span>
          <button onClick={onClose} style={{color:'var(--text-3)',cursor:'pointer',display:'flex',padding:4,borderRadius:6,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='var(--text-2)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-3)'}>{I.close}</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div style={{paddingTop:20,borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:10,justifyContent:'flex-end',flexShrink:0,marginTop:20}}>{footer}</div>}
      </div>
    </div>
  )
}

// ─── Compose New Ticket Modal ─────────────────────────────────
function ComposeModal({ token, emailProvider, connectedEmail, onClose, onSuccess, macros=[] }) {
  const [to, setTo]               = useState('')
  const [subject, setSubject]     = useState('')
  const [body, setBody]           = useState('')
  const [sending, setSending]     = useState(false)
  const [showCC, setShowCC]       = useState(false)
  const [cc, setCC]               = useState('')
  const [bcc, setBcc]             = useState('')
  const [tags, setTags]           = useState([])
  const [tagInput, setTagInput]   = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [macroSearch, setMacroSearch]   = useState('')
  const [showMacroDD, setShowMacroDD]   = useState(false)
  const bodyRef      = useRef(null)
  const macroRef     = useRef(null)

  useEffect(()=>{ function h(e){if(e.key==='Escape')onClose()} document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h) },[onClose])
  useEffect(()=>{ setTimeout(()=>bodyRef.current?.focus(), 150) },[])

  function fmt(cmd, val) { bodyRef.current?.focus(); document.execCommand(cmd, false, val||null) }
  function insertLink() {
    const url = normalizeSafeUrl(prompt('URL:'))
    if(!url) { onSuccess('Only http, https, or mailto links are allowed','error'); return }
    fmt('createLink', url)
  }
  function applyMacro(m) {
    if(!bodyRef.current) return
    bodyRef.current.innerHTML = plainTextToSafeHtml(m.body)
    setBody(m.body)
    setMacroSearch(''); setShowMacroDD(false)
    bodyRef.current?.focus()
  }

  async function doSend() {
    if(!to.trim()) { onSuccess('Please enter a recipient','error'); return }
    setSending(true)
    if(!emailProvider) {
      await new Promise(r=>setTimeout(r,700))
      setSending(false); onSuccess('Message sent!'); onClose(); return
    }
    const safeBody = sanitizeHtml(bodyRef.current?.innerHTML || '')
    const sendPath = emailProvider==='outlook' ? '/api/outlook/send' : emailProvider==='custom' ? '/api/custom-email/send' : '/api/gmail/send'
    const res = await authFetch(sendPath, { method:'POST', body:JSON.stringify({ to:to.trim(), subject:subject.trim(), body:safeBody, cc:cc.trim()||undefined, bcc:bcc.trim()||undefined }) }, token)
    const data = await res.json()
    setSending(false)
    if(data.success||data.id) { onSuccess('Message sent!'); onClose() }
    else onSuccess(data.error||'Failed to send','error')
  }

  const liveMacros  = macros.filter(m=>!m.archived)
  const macroHits   = macroSearch ? liveMacros.filter(m=>(m.name+m.body+(m.tags||[]).join(' ')).toLowerCase().includes(macroSearch.toLowerCase())).slice(0,8) : []
  const suggested   = liveMacros.slice(0,5)

  return (
    <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:14,width:'100%',maxWidth:920,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden',animation:'modalIn .22s cubic-bezier(.16,1,.3,1)',boxShadow:'0 24px 72px rgba(0,0,0,0.16)'}}>

        {/* ── Top bar: Subject + controls ── */}
        <div style={{borderBottom:'1px solid var(--border)',flexShrink:0}}>

          {/* Row 1 */}
          <div style={{display:'flex',alignItems:'center',padding:'10px 14px',gap:8}}>
            <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject" style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:14,fontWeight:600,color:'var(--text-1)',fontFamily:'inherit',minWidth:0}} />
            {/* Priority */}
            <div style={{display:'flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:6,border:'1px solid var(--border)',fontSize:11.5,color:'var(--text-2)',cursor:'default',whiteSpace:'nowrap',flexShrink:0}}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              normal
            </div>
            {/* Prev/Next */}
            <button style={{background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'4px 7px',cursor:'pointer',color:'var(--text-2)',display:'flex',flexShrink:0}} title="Previous">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button style={{background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'4px 7px',cursor:'pointer',color:'var(--text-2)',display:'flex',flexShrink:0}} title="Next">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            {/* Customer search */}
            <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:8,padding:'5px 10px',width:240,flexShrink:0}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Search customers by email, order..." style={{background:'transparent',border:'none',outline:'none',fontSize:11.5,color:'var(--text-1)',fontFamily:'inherit',width:'100%'}} />
            </div>
            {/* Settings */}
            <button style={{background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'5px 7px',cursor:'pointer',color:'var(--text-2)',display:'flex',flexShrink:0}} title="Settings">
              <GearIcon />
            </button>
            {/* Unassigned */}
            <button style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:7,fontSize:11.5,color:'var(--text-2)',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',flexShrink:0}}>
              Unassigned
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {/* Close */}
            <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:4,display:'flex',flexShrink:0}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Row 2: Tags + metadata */}
          <div style={{display:'flex',alignItems:'center',padding:'6px 14px',gap:14,fontSize:12,color:'var(--text-2)',borderTop:'1px solid var(--border)',flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              {tags.map(t=>(
                <span key={t} style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:5,padding:'1px 7px',fontSize:11.5,color:'var(--text-1)'}}>
                  {t}
                  <button onClick={()=>setTags(p=>p.filter(x=>x!==t))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:0,lineHeight:1,display:'flex'}}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </span>
              ))}
              <button onClick={()=>setShowTagInput(v=>!v)} style={{display:'inline-flex',alignItems:'center',gap:3,background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:11.5,fontFamily:'inherit',padding:0}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add tags
              </button>
              {showTagInput&&(
                <input autoFocus value={tagInput} onChange={e=>setTagInput(e.target.value)}
                  onKeyDown={e=>{
                    if((e.key==='Enter'||e.key===',')&&tagInput.trim()){setTags(p=>[...new Set([...p,tagInput.trim()])]);setTagInput('');if(e.key===',')e.preventDefault()}
                    if(e.key==='Escape')setShowTagInput(false)
                  }}
                  placeholder="tag name…"
                  style={{background:'transparent',border:'none',borderBottom:'1px solid var(--accent)',outline:'none',fontSize:11.5,color:'var(--text-1)',fontFamily:'inherit',width:84}}
                />
              )}
            </div>
            <div style={{width:1,height:13,background:'var(--border)',flexShrink:0}} />
            <span>Contact reason: <button style={{color:'var(--accent)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:12,padding:0}}>+Add</button></span>
            <div style={{width:1,height:13,background:'var(--border)',flexShrink:0}} />
            <span>Product: <button style={{color:'var(--accent)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:12,padding:0}}>+Add</button></span>
            <div style={{width:1,height:13,background:'var(--border)',flexShrink:0}} />
            <span>Resolution: <button style={{color:'var(--accent)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:12,padding:0}}>+Add</button></span>
          </div>
        </div>

        {/* ── Empty thread area ── */}
        <div style={{flex:1,overflowY:'auto',minHeight:20}} />

        {/* ── Bottom compose section ── */}
        <div style={{borderTop:'1px solid var(--border)',flexShrink:0}}>

          {/* To row */}
          <div style={{display:'flex',alignItems:'center',padding:'8px 14px',borderBottom:'1px solid var(--border)',gap:8}}>
            <span style={{fontSize:10.5,fontWeight:700,color:'var(--text-3)',letterSpacing:'.08em',textTransform:'uppercase',width:38,flexShrink:0}}>To</span>
            <input value={to} onChange={e=>setTo(e.target.value)} placeholder="Search customers..." autoFocus style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:13,color:'var(--text-1)',fontFamily:'inherit'}} />
            <button onClick={()=>setShowCC(v=>!v)} style={{fontSize:10.5,fontWeight:600,color:showCC?'var(--accent)':'var(--text-3)',background:'none',border:'1px solid var(--border)',borderRadius:5,padding:'2px 9px',cursor:'pointer',fontFamily:'inherit',flexShrink:0,transition:'all .15s'}}>Cc / Bcc</button>
          </div>

          {/* From row */}
          {connectedEmail&&(
            <div style={{display:'flex',alignItems:'center',padding:'8px 14px',borderBottom:'1px solid var(--border)',gap:8}}>
              <span style={{fontSize:10.5,fontWeight:700,color:'var(--text-3)',letterSpacing:'.08em',textTransform:'uppercase',width:38,flexShrink:0}}>From</span>
              <span style={{fontSize:13,color:'var(--text-2)'}}>{connectedEmail}</span>
            </div>
          )}

          {/* CC + Bcc row */}
          {showCC&&(
            <div style={{display:'flex',alignItems:'center',padding:'8px 14px',borderBottom:'1px solid var(--border)',gap:8,background:'var(--bg-input)'}}>
              <span style={{fontSize:10.5,fontWeight:700,color:'var(--text-3)',letterSpacing:'.08em',textTransform:'uppercase',width:38,flexShrink:0}}>CC</span>
              <input value={cc} onChange={e=>setCC(e.target.value)} placeholder="cc@email.com" style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:13,color:'var(--text-1)',fontFamily:'inherit'}} />
              <span style={{fontSize:10.5,fontWeight:700,color:'var(--text-3)',letterSpacing:'.08em',textTransform:'uppercase',width:38,flexShrink:0}}>BCC</span>
              <input value={bcc} onChange={e=>setBcc(e.target.value)} placeholder="bcc@email.com" style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:13,color:'var(--text-1)',fontFamily:'inherit'}} />
            </div>
          )}

          {/* Macro search row */}
          <div style={{display:'flex',alignItems:'center',padding:'7px 14px',borderBottom:'1px solid var(--border)',gap:8,position:'relative'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <input
              ref={macroRef}
              value={macroSearch}
              onChange={e=>{setMacroSearch(e.target.value);setShowMacroDD(true)}}
              onFocus={()=>setShowMacroDD(true)}
              onBlur={()=>setTimeout(()=>setShowMacroDD(false),160)}
              placeholder="Search macros by name, tags or body..."
              style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:13,color:'var(--text-1)',fontFamily:'inherit'}}
            />
            {macroSearch&&<button onMouseDown={e=>{e.preventDefault();setMacroSearch('');setShowMacroDD(false)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:2,display:'flex'}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.3"><polyline points="6 9 12 15 18 9"/></svg>
            {showMacroDD&&macroHits.length>0&&(
              <div style={{position:'absolute',bottom:'calc(100% + 3px)',left:0,right:0,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:10,boxShadow:'0 -8px 24px rgba(0,0,0,0.1)',zIndex:60,maxHeight:220,overflowY:'auto',padding:4}}>
                {macroHits.map(m=>(
                  <button key={m.id} onMouseDown={()=>applyMacro(m)} style={{display:'block',width:'100%',textAlign:'left',padding:'8px 11px',background:'none',border:'none',cursor:'pointer',borderRadius:7,fontFamily:'inherit',transition:'background .12s'}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-input)'} onMouseLeave={e=>e.currentTarget.style.background='none'}>
                    <div style={{fontSize:12.5,fontWeight:600,color:'var(--text-1)'}}>{m.name}</div>
                    <div style={{fontSize:11.5,color:'var(--text-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:1}}>{m.body?.replace(/\n/g,' ')}</div>
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
            data-placeholder="Click here to reply, or press r."
            onInput={e=>setBody(e.currentTarget.textContent)}
            onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey))doSend()}}
            className="compose-ta"
            style={{minHeight:130,padding:'12px 16px',fontSize:13.5,lineHeight:1.75,overflowY:'auto'}}
          />

          {/* Suggested macros */}
          {!body&&suggested.length>0&&(
            <div style={{padding:'7px 14px 8px',borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style={{fontSize:11,color:'var(--text-3)',fontWeight:500}}>Suggested macros</span>
              {suggested.map(m=>(
                <button key={m.id} onClick={()=>applyMacro(m)} style={{padding:'2px 10px',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:100,fontSize:11.5,color:'var(--text-1)',cursor:'pointer',fontFamily:'inherit',transition:'border-color .15s'}} onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {/* Toolbar + Send buttons */}
          <div style={{display:'flex',alignItems:'center',padding:'7px 12px',borderTop:'1px solid var(--border)',gap:3}}>
            <button className="rtbar-btn" onMouseDown={e=>e.preventDefault()} onClick={()=>fmt('bold')} title="Bold" style={{fontWeight:700,minWidth:26,fontSize:12}}>B</button>
            <button className="rtbar-btn" onMouseDown={e=>e.preventDefault()} onClick={()=>fmt('italic')} title="Italic" style={{fontStyle:'italic',minWidth:26,fontSize:12}}>I</button>
            <button className="rtbar-btn" onMouseDown={e=>e.preventDefault()} onClick={()=>fmt('underline')} title="Underline" style={{textDecoration:'underline',minWidth:26,fontSize:12}}>U</button>
            <div style={{width:1,height:14,background:'var(--border)',margin:'0 3px'}} />
            <button className="rtbar-btn" onMouseDown={e=>e.preventDefault()} onClick={insertLink} title="Link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </button>
            <button className="rtbar-btn" onMouseDown={e=>e.preventDefault()} onClick={()=>fmt('insertUnorderedList')} title="Bullet list">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <div style={{flex:1}} />
            {/* Send button group */}
            <div style={{display:'flex',alignItems:'stretch',borderRadius:9,overflow:'hidden',boxShadow:'0 2px 10px rgba(161,117,252,0.35)',flexShrink:0}}>
              <button onClick={doSend} disabled={sending} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 16px',background:'linear-gradient(135deg,#A175FC 0%,#7B45E8 100%)',color:'#fff',border:'none',cursor:sending?'not-allowed':'pointer',fontSize:12.5,fontWeight:600,fontFamily:'inherit',opacity:sending?0.7:1,transition:'opacity .15s'}}>
                {sending
                  ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{animation:'spin .8s linear infinite'}}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Sending…</>
                  : <>Send</>
                }
              </button>
              <div style={{width:1,background:'rgba(255,255,255,0.22)',flexShrink:0}} />
              <button onClick={doSend} disabled={sending} style={{display:'flex',alignItems:'center',gap:5,padding:'7px 16px',background:'linear-gradient(135deg,#A175FC 0%,#7B45E8 100%)',color:'#fff',border:'none',cursor:sending?'not-allowed':'pointer',fontSize:12.5,fontWeight:600,fontFamily:'inherit',opacity:sending?0.7:1,transition:'opacity .15s',whiteSpace:'nowrap'}}>
                Send &amp; Close
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Refund Modal ─────────────────────────────────────────────
function RefundModal({ order, token, onClose, onSuccess }) {
  const [mode, setMode]           = useState('items') // 'items' | 'full' | 'custom'
  const [qtys, setQtys]           = useState(Object.fromEntries((order.lineItems||[]).map(li=>[li.id,0])))
  const [customAmount, setCustomAmount] = useState('')
  const [restock, setRestock]     = useState(false)
  const [notify, setNotify]       = useState(true)
  const [reason, setReason]       = useState('')
  const [shipping, setShipping]   = useState(false)
  const [loading, setLoading]     = useState(false)

  useEffect(()=>{
    if(mode==='full') setQtys(Object.fromEntries((order.lineItems||[]).map(li=>[li.id,li.quantity])))
    else if(mode==='items') setQtys(Object.fromEntries((order.lineItems||[]).map(li=>[li.id,0])))
  },[mode])

  const itemsTotal = (order.lineItems||[]).reduce((s,li)=>s+(qtys[li.id]||0)*Number(li.price),0)
  const totalRefund = mode==='custom' ? (Number(customAmount)||0) : itemsTotal
  const canSubmit = mode==='custom' ? Number(customAmount)>0 : totalRefund>0

  async function handleRefund() {
    setLoading(true)
    let body
    if(mode==='custom') {
      body = { customAmount: Number(customAmount), notify, reason }
    } else {
      const lineItems = (order.lineItems||[]).filter(li=>qtys[li.id]>0).map(li=>({lineItemId:li.id,quantity:qtys[li.id]}))
      body = { lineItems, restock, notify, reason, shipping }
    }
    const res = await authFetch(`/api/shopify/orders/${order.id}/refund`,{method:'POST',body:JSON.stringify(body)},token)
    const data = await res.json()
    setLoading(false)
    if (data.success) onSuccess('Refund processed!')
    else onSuccess(data.error||'Refund failed','error')
  }

  const MODES = [{v:'items',l:'By items'},{v:'full',l:'Full refund'},{v:'custom',l:'Custom amount'}]

  return (
    <ModalBase title={`Refund — ${order.name}`} onClose={onClose}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={handleRefund} disabled={loading||!canSubmit}>
          {loading?<Spinner white />:'Process refund'}
        </button>
      </>}
    >
      {/* 3-way mode toggle */}
      <div style={{display:'flex',gap:5,marginBottom:18,padding:'4px',background:'var(--bg-input)',borderRadius:11,border:'1px solid var(--border)'}}>
        {MODES.map(o=>(
          <button key={o.v} onClick={()=>setMode(o.v)} style={{flex:1,padding:'8px 10px',borderRadius:8,fontSize:12,fontWeight:600,fontFamily:'inherit',cursor:'pointer',transition:'all .15s',background:mode===o.v?'rgba(161,117,252,0.2)':'transparent',color:mode===o.v?'#C3A3FF':'var(--text-3)',border:mode===o.v?'1px solid rgba(161,117,252,0.35)':'1px solid transparent',boxShadow:mode===o.v?'0 2px 8px rgba(161,117,252,0.15)':'none'}}>{o.l}</button>
        ))}
      </div>

      {/* Custom amount input */}
      {mode==='custom'&&(
        <div style={{marginBottom:18}}>
          <label className="modal-label">Refund amount</label>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:14,fontWeight:700,color:'var(--text-3)',pointerEvents:'none'}}>€</span>
            <input type="number" className="modal-input" style={{paddingLeft:28}} value={customAmount} onChange={e=>setCustomAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" max={order.totalPrice} autoFocus />
          </div>
          {Number(customAmount)>0&&(
            <div style={{marginTop:8,fontSize:12,color:'var(--text-3)'}}>
              Max: <span style={{color:'var(--text-2)',fontWeight:600}}>{fmtPrice(order.totalPrice,order.currency)}</span>
            </div>
          )}
        </div>
      )}

      {/* Line items table (items + full mode) */}
      {mode!=='custom'&&(
        <div style={{marginBottom:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto auto auto',gap:'0 12px',alignItems:'center',paddingBottom:8,marginBottom:6,borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
            <span className="info-label">Product</span>
            <span className="info-label">Price</span>
            <span className="info-label" style={{textAlign:'center',minWidth:80}}>Qty</span>
            <span className="info-label" style={{textAlign:'right'}}>Total</span>
          </div>
          {(order.lineItems||[]).map(li=>(
            <div key={li.id} className="li-row">
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text-1)'}}>{li.title}</div>
                {li.variantTitle&&<div style={{fontSize:11.5,color:'var(--text-3)'}}>{li.variantTitle}</div>}
              </div>
              <span style={{fontSize:12.5,color:'var(--text-2)',minWidth:60,textAlign:'right'}}>{fmtPrice(li.price,order.currency)}</span>
              <div style={{display:'flex',alignItems:'center',gap:6,minWidth:80,justifyContent:'center'}}>
                <button className="qty-btn" onClick={()=>setQtys(q=>({...q,[li.id]:Math.max(0,q[li.id]-1)}))} disabled={!qtys[li.id]||mode==='full'}>−</button>
                <span style={{fontSize:13,fontWeight:600,color:'var(--text-1)',minWidth:20,textAlign:'center'}}>{qtys[li.id]}</span>
                <button className="qty-btn" onClick={()=>setQtys(q=>({...q,[li.id]:Math.min(li.quantity,q[li.id]+1)}))} disabled={qtys[li.id]>=li.quantity||mode==='full'}>+</button>
                <span style={{fontSize:11,color:'var(--text-3)'}}>/{li.quantity}</span>
              </div>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text-1)',minWidth:60,textAlign:'right'}}>{fmtPrice((qtys[li.id]||0)*Number(li.price),order.currency)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
        {mode!=='custom'&&<Chk checked={restock} onChange={()=>setRestock(v=>!v)} label="Restock items" />}
        <Chk checked={notify}  onChange={()=>setNotify(v=>!v)}  label="Notify customer" />
        {mode!=='custom'&&<Chk checked={shipping} onChange={()=>setShipping(v=>!v)} label="Refund shipping costs" />}
      </div>

      <div style={{marginBottom:16}}>
        <label className="modal-label">Reason (optional)</label>
        <input className="modal-input" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for refund…" />
      </div>

      <div style={{background:'var(--bg-surface-2)',border:'1px solid var(--border)',borderRadius:12,padding:'13px 15px'}}>
        <div style={{display:'flex',justifyContent:'space-between',paddingTop:0}}>
          <span style={{fontSize:14,fontWeight:700,color:'var(--text-1)'}}>Refund total</span>
          <span style={{fontSize:15,fontWeight:800,color: totalRefund>0?'#4ade80':'var(--text-3)'}}>{fmtPrice(totalRefund,order.currency)}</span>
        </div>
      </div>
    </ModalBase>
  )
}

// ─── Cancel Modal ─────────────────────────────────────────────
function CancelModal({ order, token, onClose, onSuccess }) {
  const [reason, setReason]   = useState('customer')
  const [restock, setRestock] = useState(true)
  const [notify, setNotify]   = useState(true)
  const [refund, setRefund]   = useState(true)
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    setLoading(true)
    const res = await authFetch(`/api/shopify/orders/${order.id}/cancel`,{method:'POST',body:JSON.stringify({reason,restock,notify,refund})},token)
    const data = await res.json()
    setLoading(false)
    if (data.success) onSuccess('Order cancelled')
    else onSuccess(data.error||'Failed to cancel order','error')
  }

  return (
    <ModalBase title={`Cancel order — ${order.name}`} onClose={onClose}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Keep order</button>
        <button className="btn-danger" onClick={handleCancel} disabled={loading}>
          {loading?<Spinner white />:'Cancel order'}
        </button>
      </>}
    >
      <div style={{marginBottom:16}}>
        <label className="modal-label">Reason for cancellation</label>
        <select className="modal-select" value={reason} onChange={e=>setReason(e.target.value)}>
          {CANCEL_REASONS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:8}}>
        <Chk checked={restock} onChange={()=>setRestock(v=>!v)} label="Restock items" />
        <Chk checked={notify}  onChange={()=>setNotify(v=>!v)}  label="Notify customer" />
        <Chk checked={refund}  onChange={()=>setRefund(v=>!v)}  label="Refund payment" />
      </div>
    </ModalBase>
  )
}

// ─── Duplicate Modal ──────────────────────────────────────────
function DuplicateModal({ order, token, onClose, onSuccess }) {
  const [note, setNote]               = useState(`Duplicate of ${order.name}`)
  const [keepAddress, setKeepAddress] = useState(true)
  const [discountType, setDiscountType] = useState('none') // 'none' | 'percentage' | 'fixed'
  const [discountValue, setDiscountValue] = useState('')
  const [loading, setLoading]         = useState(false)

  const originalTotal = Number(order.totalPrice) || 0
  const discountAmount = discountType==='percentage' ? originalTotal*(Number(discountValue)||0)/100
    : discountType==='fixed' ? Math.min(Number(discountValue)||0, originalTotal) : 0
  const newTotal = Math.max(0, originalTotal - discountAmount)

  async function handleDuplicate() {
    setLoading(true)
    const res = await authFetch(`/api/shopify/orders/${order.id}/duplicate`,{method:'POST',body:JSON.stringify({
      keepAddress, note, tags:'',
      discountType: discountType!=='none' ? discountType : undefined,
      discountValue: discountType!=='none' ? Number(discountValue) : undefined,
    })},token)
    const data = await res.json()
    setLoading(false)
    if (data.success) onSuccess(`Draft ${data.draftOrder?.name||''} created!`)
    else onSuccess(data.error||'Duplicate failed','error')
  }

  return (
    <ModalBase title={`Duplicate — ${order.name}`} onClose={onClose}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-send" onClick={handleDuplicate} disabled={loading} style={{display:'flex',alignItems:'center',gap:7}}>
          {loading?<Spinner white />:<span style={{display:'flex'}}>{I.copy}</span>}
          Create draft
        </button>
      </>}
    >
      {/* Products */}
      <div style={{background:'var(--bg-surface-2)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px',marginBottom:14}}>
        {(order.lineItems||[]).map(li=>(
          <div key={li.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
            <span style={{fontSize:12.5,color:'var(--text-2)'}}>{li.quantity}× {li.title}{li.variantTitle?` · ${li.variantTitle}`:''}</span>
            <span style={{fontSize:12.5,color:'var(--text-2)'}}>{fmtPrice(Number(li.price)*li.quantity,order.currency)}</span>
          </div>
        ))}
        <div style={{display:'flex',justifyContent:'space-between',paddingTop:8,marginTop:4}}>
          <span style={{fontSize:12.5,color:'var(--text-2)'}}>Original</span>
          <span style={{fontSize:13,fontWeight:700,color:'var(--text-1)'}}>{fmtPrice(originalTotal,order.currency)}</span>
        </div>
      </div>

      {/* Discount section */}
      <div style={{marginBottom:14}}>
        <label className="modal-label">Discount</label>
        <div style={{display:'flex',gap:6,marginBottom:discountType!=='none'?10:0}}>
          {[{v:'none',l:'None'},{v:'percentage',l:'Percentage %'},{v:'fixed',l:'Fixed amount'}].map(o=>(
            <button key={o.v} onClick={()=>{setDiscountType(o.v);setDiscountValue('')}} style={{flex:1,padding:'7px 8px',borderRadius:8,fontSize:11.5,fontWeight:600,fontFamily:'inherit',cursor:'pointer',transition:'all .15s',background:discountType===o.v?'rgba(161,117,252,0.18)':'var(--bg-input)',color:discountType===o.v?'#A175FC':'var(--text-3)',border:discountType===o.v?'1px solid rgba(161,117,252,0.3)':'1px solid rgba(255,255,255,0.07)'}}>{o.l}</button>
          ))}
        </div>
        {discountType!=='none'&&(
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <input type="number" className="modal-input" style={{flex:1}} value={discountValue} onChange={e=>setDiscountValue(e.target.value)} placeholder={discountType==='percentage'?'e.g. 10':'e.g. 5.00'} min="0" max={discountType==='percentage'?100:undefined} />
            <span style={{fontSize:12.5,fontWeight:700,color:'var(--text-2)',flexShrink:0}}>{discountType==='percentage'?'%':'€'}</span>
          </div>
        )}
      </div>

      {/* New total preview */}
      {discountType!=='none'&&Number(discountValue)>0&&(
        <div style={{background:'rgba(161,117,252,0.06)',border:'1px solid rgba(161,117,252,0.15)',borderRadius:10,padding:'10px 14px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:2}}>Discount</div>
            <div style={{fontSize:12.5,fontWeight:700,color:'#fb7185'}}>− {fmtPrice(discountAmount,order.currency)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:2}}>New total</div>
            <div style={{fontSize:15,fontWeight:800,color:'#4ade80'}}>{fmtPrice(newTotal,order.currency)}</div>
          </div>
        </div>
      )}

      <div style={{marginBottom:14}}>
        <label className="modal-label">Note</label>
        <input className="modal-input" value={note} onChange={e=>setNote(e.target.value)} />
      </div>
      <Chk checked={keepAddress} onChange={()=>setKeepAddress(v=>!v)} label="Copy shipping address" />
    </ModalBase>
  )
}

// ─── Edit Address Modal ───────────────────────────────────────
function EditAddressModal({ order, token, onClose, onSuccess }) {
  const sa = order.shippingAddress||{}
  const [form, setForm] = useState({ firstName:sa.firstName||'', lastName:sa.lastName||'', address1:sa.address1||'', address2:sa.address2||'', city:sa.city||'', zip:sa.zip||'', country:sa.country||'', countryCode:sa.countryCode||'', phone:sa.phone||'' })
  const [loading, setLoading] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function handleSave() {
    setLoading(true)
    const res = await authFetch(`/api/shopify/orders/${order.id}/address`,{method:'PUT',body:JSON.stringify(form)},token)
    const data = await res.json()
    setLoading(false)
    if (data.success) onSuccess('Address updated')
    else onSuccess(data.error||'Failed to save address','error')
  }

  return (
    <ModalBase title={`Edit address — ${order.name}`} onClose={onClose}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-send" onClick={handleSave} disabled={loading}>
          {loading?<Spinner white />:'Save'}
        </button>
      </>}
    >
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="modal-row">
          <div><label className="modal-label">First name</label><input className="modal-input" value={form.firstName} onChange={e=>set('firstName',e.target.value)} /></div>
          <div><label className="modal-label">Last name</label><input className="modal-input" value={form.lastName} onChange={e=>set('lastName',e.target.value)} /></div>
        </div>
        <div><label className="modal-label">Address line 1</label><input className="modal-input" value={form.address1} onChange={e=>set('address1',e.target.value)} /></div>
        <div><label className="modal-label">Address line 2 (optional)</label><input className="modal-input" value={form.address2} onChange={e=>set('address2',e.target.value)} /></div>
        <div className="modal-row">
          <div><label className="modal-label">City</label><input className="modal-input" value={form.city} onChange={e=>set('city',e.target.value)} /></div>
          <div><label className="modal-label">Zip code</label><input className="modal-input" value={form.zip} onChange={e=>set('zip',e.target.value)} /></div>
        </div>
        <div className="modal-row">
          <div><label className="modal-label">Country</label><input className="modal-input" value={form.country} onChange={e=>set('country',e.target.value)} /></div>
          <div><label className="modal-label">Phone</label><input className="modal-input" value={form.phone} onChange={e=>set('phone',e.target.value)} /></div>
        </div>
      </div>
    </ModalBase>
  )
}

// ─── Fulfill Modal ────────────────────────────────────────────
function FulfillModal({ order, token, onClose, onSuccess }) {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingCompany, setTrackingCompany] = useState('')
  const [notify, setNotify] = useState(true)
  const [loading, setLoading] = useState(false)

  async function handleFulfill() {
    setLoading(true)
    const res = await authFetch(`/api/shopify/orders/${order.id}/fulfill`,{method:'POST',body:JSON.stringify({trackingNumber,trackingCompany,notify})},token)
    const data = await res.json()
    setLoading(false)
    if (data.success) onSuccess('Order marked as fulfilled')
    else onSuccess(data.error||'Failed to fulfill order','error')
  }

  return (
    <ModalBase title={`Fulfill order — ${order.name}`} onClose={onClose}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-send" onClick={handleFulfill} disabled={loading} style={{display:'flex',alignItems:'center',gap:7}}>
          {loading?<Spinner white />:<span style={{display:'flex'}}>{I.truck2}</span>}
          Mark as fulfilled
        </button>
      </>}
    >
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{background:'rgba(74,222,128,0.05)',border:'1px solid rgba(74,222,128,0.15)',borderRadius:10,padding:'10px 14px',fontSize:12.5,color:'rgba(74,222,128,0.8)'}}>
          All items will be marked as fulfilled.
        </div>
        <div>
          <label className="modal-label">Tracking number (optional)</label>
          <input className="modal-input" value={trackingNumber} onChange={e=>setTrackingNumber(e.target.value)} placeholder="e.g. 3SBME123456789" />
        </div>
        <div>
          <label className="modal-label">Carrier (optional)</label>
          <input className="modal-input" value={trackingCompany} onChange={e=>setTrackingCompany(e.target.value)} placeholder="e.g. PostNL, DHL, UPS…" />
        </div>
        <Chk checked={notify} onChange={()=>setNotify(v=>!v)} label="Send shipping confirmation to customer" />
      </div>
    </ModalBase>
  )
}

// ─── Note Modal ───────────────────────────────────────────────
function NoteModal({ order, token, onClose, onSuccess }) {
  const [note, setNote] = useState(order.note||'')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    const res = await authFetch(`/api/shopify/orders/${order.id}/note`,{method:'PUT',body:JSON.stringify({note})},token)
    const data = await res.json()
    setLoading(false)
    if (data.success) onSuccess('Note saved')
    else onSuccess(data.error||'Failed to save note','error')
  }

  return (
    <ModalBase title={`Note — ${order.name}`} onClose={onClose}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-send" onClick={handleSave} disabled={loading}>
          {loading?<Spinner white />:'Save'}
        </button>
      </>}
    >
      <div>
        <label className="modal-label">Internal note (visible in Shopify)</label>
        <textarea className="modal-input" value={note} onChange={e=>setNote(e.target.value)} rows={5} placeholder="Add a note to this order…" style={{resize:'vertical',minHeight:100}} />
      </div>
    </ModalBase>
  )
}

// ─── Ticket action bar ────────────────────────────────────────
function TicketActionBar({ meta, status, tagLibrary, onClose, onAddTag, onCreateTag, onRemoveTag, onFieldChange }) {
  const [tagMenuOpen, setTagMenuOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const selectedTags = meta.tags || []
  const availableTags = tagLibrary.filter(tag => !selectedTags.includes(tag.name))

  function handleCreateTag() {
    const created = onCreateTag(newTag)
    if (created) {
      onAddTag(created.name)
      setNewTag('')
      setTagMenuOpen(false)
    }
  }

  const fieldButton = (key, label) => (
    <button
      onClick={() => onFieldChange(key, label)}
      style={{display:'inline-flex',alignItems:'center',gap:4,border:'none',background:'transparent',padding:0,cursor:'pointer',fontSize:10.5,color:'var(--text-3)',fontFamily:'inherit'}}
    >
      <span style={{color:'var(--text-2)',fontWeight:600}}>{label}:</span>
      <span>{meta[key] || '+Add'}</span>
    </button>
  )

  return (
    <div style={{display:'flex',alignItems:'center',gap:18,padding:'9px 0 0',marginTop:9,borderTop:'1px solid var(--border)',minHeight:34,flexWrap:'wrap'}}>
      <button
        onClick={onClose}
        style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 9px',border:'1px solid var(--border)',borderRadius:7,background:status==='closed'?'var(--bg-surface-2)':'var(--bg-surface)',color:'var(--text-2)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}
        title="Close ticket"
      >
        <span style={{fontSize:12}}>✓</span>
        {status==='closed' ? 'Closed' : 'Close'}
      </button>

      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
        {(meta.tags||[]).map(tag=>(
          <button
            key={tag}
            onClick={() => onRemoveTag(tag)}
            title="Remove tag"
            style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 7px',border:'1px solid var(--border)',borderRadius:999,background:'var(--bg-surface-2)',color:'var(--text-2)',fontSize:10.5,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}
          >
            {tag}
            <span style={{color:'var(--text-3)'}}>×</span>
          </button>
        ))}
        <div style={{position:'relative'}}>
          <button onClick={()=>setTagMenuOpen(v=>!v)} style={{border:'none',background:'transparent',cursor:'pointer',fontSize:10.5,color:'var(--accent)',fontFamily:'inherit',padding:0}}>+Add tag</button>
          {tagMenuOpen&&(
            <div style={{position:'absolute',top:'calc(100% + 8px)',left:0,width:260,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,boxShadow:'var(--shadow-card-hover)',padding:8,zIndex:60}}>
              <div style={{fontSize:10,fontWeight:800,color:'var(--text-3)',letterSpacing:'.08em',textTransform:'uppercase',padding:'4px 6px 8px'}}>Choose tag</div>
              <div style={{maxHeight:180,overflowY:'auto',display:'flex',flexDirection:'column',gap:3}}>
                {availableTags.map(tag=>(
                  <button key={tag.id} onClick={()=>{onAddTag(tag.name);setTagMenuOpen(false)}} style={{display:'flex',alignItems:'center',gap:8,width:'100%',border:'none',background:'transparent',borderRadius:8,padding:'7px 8px',cursor:'pointer',fontFamily:'inherit',fontSize:12,color:'var(--text-2)',textAlign:'left'}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:tag.color,flexShrink:0}} />
                    <span style={{flex:1}}>{tag.name}</span>
                  </button>
                ))}
                {availableTags.length===0&&<div style={{fontSize:11,color:'var(--text-3)',padding:'8px 6px'}}>No more existing tags</div>}
              </div>
              <div style={{display:'flex',gap:6,borderTop:'1px solid var(--border)',marginTop:8,paddingTop:8}}>
                <input value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleCreateTag()}} placeholder="Create new tag" style={{flex:1,minWidth:0,border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-surface-2)',color:'var(--text-1)',fontSize:12,padding:'7px 8px',outline:'none'}} />
                <button onClick={handleCreateTag} style={{border:'none',background:'var(--accent)',color:'#fff',borderRadius:8,padding:'7px 10px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Add</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'minmax(120px,1fr) minmax(120px,1fr) minmax(120px,1fr)',gap:'18px',flex:'1 1 420px',minWidth:320}}>
        {fieldButton('contactReason', 'Contact reason')}
        {fieldButton('product', 'Product')}
        {fieldButton('resolution', 'Resolution')}
      </div>

      <select
        value={meta.assignee || 'Unassigned'}
        onChange={e=>onFieldChange('assignee', e.target.value)}
        style={{marginLeft:'auto',border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-surface)',color:'var(--text-2)',fontSize:11,padding:'4px 8px',fontFamily:'inherit',outline:'none'}}
      >
        <option>Unassigned</option>
        <option>Support</option>
        <option>Admin</option>
        <option>Escalated</option>
      </select>
    </div>
  )
}

// ─── Macro Panel ──────────────────────────────────────────────
function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"/>
    </svg>
  )
}

function MacroPanel({ macros, aiMacros, onInsert, onClose, customerName, onManage, onCreateNew, favs, onToggleFav }) {
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(null)
  const [gearOpen, setGearOpen] = useState(false)
  const searchRef = useRef(null)
  const gearRef   = useRef(null)

  useEffect(()=>{ searchRef.current?.focus() },[])
  useEffect(()=>{
    function h(e){if(e.key==='Escape'){ if(gearOpen)setGearOpen(false); else onClose() }}
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h)
  },[onClose,gearOpen])
  useEffect(()=>{
    if(!gearOpen) return
    function h(e){ if(gearRef.current&&!gearRef.current.contains(e.target)) setGearOpen(false) }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h)
  },[gearOpen])

  function toggleFav(id, e) { e.stopPropagation(); onToggleFav(id) }

  const filtered = macros.filter(m=>!search||(m.name+m.body+(m.tags||[]).join('')).toLowerCase().includes(search.toLowerCase()))
  const favMacros    = filtered.filter(m=>favs.includes(m.id))
  const nonFavMacros = filtered.filter(m=>!favs.includes(m.id))
  const active = selected || filtered[0] || null

  const StarIcon = ({filled})=>(
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled?'#f59e0b':'none'} stroke={filled?'#f59e0b':'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )

  function applyMacro(m) {
    const firstName = (customerName||'').split(' ')[0] || 'there'
    const body = m.body.replace(/{{name}}/gi, firstName).replace(/{{firstname}}/gi, firstName)
    onInsert(body)
  }

  function renderPreview(body) {
    return body.split(/({{[^}]+}})/).map((part,i)=>
      part.match(/{{[^}]+}}/)
        ? <span key={i} className="macro-var">{part}</span>
        : <span key={i}>{part}</span>
    )
  }

  return (
    <div style={{borderTop:'1px solid var(--border)',animation:'fadeUp .18s ease both',display:'flex',flexDirection:'column',height:'min(360px,46vh)',minHeight:220,background:'var(--bg-surface)'}}>
      {/* Search + gear row */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface-2)',flexShrink:0}}>
        <span style={{color:'var(--accent-text)',display:'flex',flexShrink:0}}>{I.lightning}</span>
        <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search macros by name, tag or content…" style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:12.5,color:'var(--text-1)',fontFamily:'inherit'}} />
        {aiMacros?.length>0 && <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,background:'rgba(161,117,252,0.15)',color:'#A175FC',letterSpacing:'.04em',flexShrink:0}}>AI ✦</span>}
        {/* Gear settings */}
        <div ref={gearRef} style={{position:'relative',flexShrink:0}}>
          <button
            onClick={()=>setGearOpen(p=>!p)}
            style={{color:gearOpen?'var(--accent-text)':'var(--text-2)',cursor:'pointer',display:'flex',padding:'5px 6px',borderRadius:6,background:gearOpen?'var(--accent-soft)':'transparent',border:gearOpen?'1px solid var(--accent-border)':'1px solid transparent',transition:'all .15s'}}
            onMouseEnter={e=>{if(!gearOpen){e.currentTarget.style.background='var(--bg-surface)';e.currentTarget.style.border='1px solid var(--border)'}}}
            onMouseLeave={e=>{if(!gearOpen){e.currentTarget.style.background='transparent';e.currentTarget.style.border='1px solid transparent'}}}
            title="Macro settings"
          ><GearIcon /></button>
          {gearOpen&&(
            <div className="macro-gear-menu">
              <button className="macro-gear-item" onClick={()=>{setGearOpen(false);onManage()}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="15" x2="12" y2="15"/></svg>
                Manage macros
              </button>
              <button className="macro-gear-item" onClick={()=>{setGearOpen(false);active&&onManage(active)}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit macro
              </button>
              <button className="macro-gear-item" onClick={()=>{setGearOpen(false);onCreateNew()}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create new macro
              </button>
              <div className="macro-gear-divider" />
              <button className="macro-gear-item danger" onClick={()=>{setGearOpen(false);active&&confirm('Delete this macro?')&&onDeleteMacro&&onDeleteMacro(active.id)}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Delete macro
              </button>
              <div className="macro-gear-divider" />
              <button className="macro-gear-item" onClick={()=>{setGearOpen(false);onManage()}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                My macro preferences
              </button>
            </div>
          )}
        </div>
        <button onClick={onClose} style={{color:'var(--text-2)',cursor:'pointer',display:'flex',padding:'5px 6px',borderRadius:6,border:'1px solid transparent',transition:'all .15s'}} onMouseEnter={e=>{e.currentTarget.style.color='var(--text-1)';e.currentTarget.style.background='var(--bg-surface)';e.currentTarget.style.border='1px solid var(--border)'}} onMouseLeave={e=>{e.currentTarget.style.color='var(--text-2)';e.currentTarget.style.background='transparent';e.currentTarget.style.border='1px solid transparent'}}>{I.close}</button>
      </div>

      {/* Two-panel — fills remaining height */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* List */}
        <div className="macro-list sscroll" style={{borderRight:'1px solid var(--border)'}}>
          {aiMacros?.length>0 && (
            <>
              <div className="macro-suggest">AI suggestions ✦</div>
              {aiMacros.map(m=>(
                <div key={m.id} className={`macro-item${active?.id===m.id?' mi-active':''}`} onClick={()=>setSelected(m)} onDoubleClick={()=>applyMacro(m)} style={{display:'flex',alignItems:'flex-start',gap:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12.5,fontWeight:600,color:active?.id===m.id?'#A175FC':'var(--text-1)',marginBottom:3}}>{m.name}</div>
                  </div>
                </div>
              ))}
              <div style={{height:1,background:'var(--border)',margin:'4px 0'}} />
            </>
          )}
          {filtered.length===0 && <div style={{padding:'20px 14px',fontSize:12,color:'var(--text-3)',textAlign:'center'}}>No macros found</div>}
          {/* Favorites section */}
          {favMacros.length>0&&(
            <>
              <div className="macro-suggest" style={{display:'flex',alignItems:'center',gap:4}}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Favorites
              </div>
              {favMacros.map(m=>(
                <div key={m.id} className={`macro-item${active?.id===m.id?' mi-active':''}`} onClick={()=>setSelected(m)} onDoubleClick={()=>applyMacro(m)} style={{display:'flex',alignItems:'flex-start',gap:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12.5,fontWeight:600,color:active?.id===m.id?'#A175FC':'var(--text-1)',marginBottom:3}}>{m.name}</div>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {(m.tags||[]).map(t=><span key={t} className="macro-tag">{t}</span>)}
                    </div>
                  </div>
                  <button className="macro-star fav" style={{marginTop:1}} onClick={e=>toggleFav(m.id,e)} title="Remove from favorites"><StarIcon filled /></button>
                </div>
              ))}
              {nonFavMacros.length>0&&<div style={{height:1,background:'var(--border)',margin:'4px 0'}} />}
            </>
          )}
          {/* All / remaining macros */}
          {nonFavMacros.length>0&&(
            <>
              {favMacros.length>0&&<div className="macro-suggest">All macros</div>}
              {nonFavMacros.map(m=>(
                <div key={m.id} className={`macro-item${active?.id===m.id?' mi-active':''}`} onClick={()=>setSelected(m)} onDoubleClick={()=>applyMacro(m)} style={{display:'flex',alignItems:'flex-start',gap:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12.5,fontWeight:600,color:active?.id===m.id?'#A175FC':'var(--text-1)',marginBottom:3}}>{m.name}</div>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {(m.tags||[]).map(t=><span key={t} className="macro-tag">{t}</span>)}
                    </div>
                  </div>
                  <button className="macro-star" style={{marginTop:1}} onClick={e=>toggleFav(m.id,e)} title="Add to favorites"><StarIcon filled={false} /></button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Preview — no buttons here */}
        {active
          ? <div className="macro-preview sscroll" style={{flex:1}}>{renderPreview(active.body)}</div>
          : <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-3)',fontSize:12.5}}>Select a macro to preview</div>
        }
      </div>

      {/* Full-width footer — always visible, connected to bottom of panel */}
      <div style={{borderTop:'1px solid var(--border)',padding:'8px 14px',display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8,flexShrink:0,background:'var(--bg-surface)'}}>
        <button className="btn-ghost" style={{fontSize:11.5,padding:'6px 14px'}} onClick={onClose}>Close</button>
        <button className="btn-send" style={{fontSize:11.5,padding:'6px 16px',opacity:active?1:0.45,cursor:active?'pointer':'default'}} onClick={()=>active&&applyMacro(active)}>Insert</button>
      </div>
    </div>
  )
}

// ─── Macro Editor ─────────────────────────────────────────────
function MacroEditor({ macro, onSave, onDuplicate, onDelete, onBack }) {
  const isNew = !macro?.id
  const [name, setName]       = useState(macro?.name || '')
  const [body, setBody]       = useState(macro?.body || '')
  const [tags, setTags]       = useState((macro?.tags||[]).join(', '))
  const [language, setLang]   = useState(macro?.language || 'English')
  const [tagInput, setTagInput] = useState((macro?.tags||[]).join(', '))
  const bodyRef = useRef(null)

  useEffect(()=>{
    if(bodyRef.current) bodyRef.current.value = macro?.body || ''
  },[])

  function insertVar(v) {
    const ta = bodyRef.current; if(!ta) return
    const s=ta.selectionStart, e=ta.selectionEnd
    const newVal = ta.value.slice(0,s)+v+ta.value.slice(e)
    ta.value = newVal; setBody(newVal)
    ta.focus(); ta.setSelectionRange(s+v.length, s+v.length)
  }

  function handleSave() {
    if(!name.trim()) return
    const t = tagInput.split(',').map(s=>s.trim()).filter(Boolean)
    onSave({
      id: macro?.id || `m_${Date.now()}`,
      name: name.trim(),
      body: bodyRef.current?.value || body,
      tags: t,
      language,
      usageCount: macro?.usageCount || 0,
      updatedAt: new Date().toISOString(),
      archived: macro?.archived || false,
    })
  }

  const VARS = [
    { label:'Customer first name', value:'{{name}}' },
    { label:'Order number',        value:'{{order_number}}' },
    { label:'Tracking link',       value:'{{tracking_link}}' },
    { label:'Agent name',          value:'{{agent_name}}' },
  ]

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'auto',background:'var(--bg-page)'}}>
      {/* Top bar */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 24px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)',flexShrink:0}}>
        <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',fontSize:13,padding:'4px 0',fontFamily:'inherit'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <span style={{color:'var(--border)',fontSize:16}}>|</span>
        <span style={{fontSize:14,fontWeight:600,color:'var(--text-1)'}}>{isNew ? 'Create macro' : `Edit: ${macro.name}`}</span>
      </div>

      {/* Form */}
      <div style={{maxWidth:860,width:'100%',margin:'0 auto',padding:'32px 24px',display:'flex',gap:32}}>
        {/* Left col — main */}
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:20}}>
          {/* Name */}
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--text-2)',marginBottom:6}}>Macro name <span style={{color:'var(--danger)'}}>*</span></label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Delivery - Delay" style={{width:'100%',padding:'9px 12px',border:'1px solid var(--border)',borderRadius:8,fontSize:13,color:'var(--text-1)',background:'var(--bg-surface)',fontFamily:'inherit',outline:'none'}} />
            <div style={{fontSize:11,color:'var(--text-3)',marginTop:5}}>Name that all agents will see while searching for it</div>
          </div>

          {/* Response text */}
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--text-2)',marginBottom:6}}>Response text</label>
            {/* Recipient row */}
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',borderRadius:'8px 8px 0 0',border:'1px solid var(--border)',borderBottom:'none',background:'var(--bg-surface-2)',fontSize:12,color:'var(--text-2)'}}>
              <span style={{fontWeight:600}}>To:</span>
              <span style={{padding:'2px 8px',borderRadius:5,background:'var(--accent-soft)',color:'var(--accent-text)',fontWeight:600,fontSize:11}}>Current client</span>
            </div>
            {/* Toolbar */}
            <div style={{display:'flex',alignItems:'center',gap:2,padding:'5px 10px',border:'1px solid var(--border)',borderBottom:'none',background:'var(--bg-surface)',flexWrap:'wrap'}}>
              {['B','I','U'].map(f=>(
                <button key={f} style={{fontWeight:f==='B'?700:400,fontStyle:f==='I'?'italic':'normal',textDecoration:f==='U'?'underline':'none',padding:'3px 7px',borderRadius:5,border:'1px solid transparent',background:'none',cursor:'pointer',color:'var(--text-2)',fontSize:13,fontFamily:'inherit'}}>{f}</button>
              ))}
              <span style={{width:1,height:16,background:'var(--border)',margin:'0 4px'}} />
              {VARS.map(v=>(
                <button key={v.value} onClick={()=>insertVar(v.value)} style={{padding:'2px 8px',borderRadius:5,border:'1px solid var(--border)',background:'var(--bg-surface-2)',color:'var(--text-2)',fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>{v.label}</button>
              ))}
            </div>
            {/* Body */}
            <textarea
              ref={bodyRef}
              defaultValue={macro?.body || ''}
              onChange={e=>setBody(e.target.value)}
              placeholder="Write your macro response here. Use the variable buttons above to insert dynamic values."
              style={{width:'100%',minHeight:200,padding:'12px 14px',border:'1px solid var(--border)',borderRadius:'0 0 8px 8px',resize:'vertical',fontSize:13,lineHeight:1.75,color:'var(--text-1)',background:'var(--bg-surface)',fontFamily:'inherit',outline:'none'}}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--text-2)',marginBottom:6}}>Tags <span style={{fontSize:11,fontWeight:400,color:'var(--text-3)'}}>(comma separated)</span></label>
            <input value={tagInput} onChange={e=>setTagInput(e.target.value)} placeholder="e.g. shipping, support" style={{width:'100%',padding:'9px 12px',border:'1px solid var(--border)',borderRadius:8,fontSize:13,color:'var(--text-1)',background:'var(--bg-surface)',fontFamily:'inherit',outline:'none'}} />
          </div>

          {/* Actions row */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:8,borderTop:'1px solid var(--border)'}}>
            <div style={{display:'flex',gap:8}}>
              <button onClick={handleSave} style={{padding:'9px 18px',borderRadius:8,border:'none',background:'var(--text-1)',color:'var(--bg-surface)',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                {isNew ? 'Create macro' : 'Update macro'}
              </button>
              {!isNew&&<button onClick={()=>onDuplicate(macro)} style={{padding:'9px 16px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-surface)',color:'var(--text-1)',fontWeight:500,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Duplicate macro</button>}
            </div>
            <div style={{display:'flex',gap:8}}>
              {!isNew&&<button onClick={()=>onDelete(macro.id)} style={{padding:'9px 16px',borderRadius:8,border:'1px solid rgba(220,38,38,0.3)',background:'rgba(220,38,38,0.06)',color:'var(--danger)',fontWeight:500,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Delete macro</button>}
            </div>
          </div>
        </div>

        {/* Right col — language */}
        <div style={{width:220,flexShrink:0,display:'flex',flexDirection:'column',gap:16}}>
          <div>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--text-2)',marginBottom:6}}>Language</label>
            <select value={language} onChange={e=>setLang(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1px solid var(--border)',borderRadius:8,fontSize:13,color:'var(--text-1)',background:'var(--bg-surface)',fontFamily:'inherit',outline:'none',cursor:'pointer'}}>
              {['English','Dutch','German','French','Spanish','Italian','Portuguese'].map(l=>(
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <div style={{fontSize:11,color:'var(--text-3)',marginTop:5}}>Language in which this macro is written</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Macro Manager ─────────────────────────────────────────────
function MacroManager({ macros, favs, onClose, onSaveMacro, onDeleteMacro, onToggleFav }) {
  const [tab, setTab]         = useState('active')
  const [search, setSearch]   = useState('')
  const [langFilter, setLangF]= useState('all')
  const [tagFilter, setTagF]  = useState('all')
  const [editing, setEditing] = useState(null) // null=list, 'new'=create, macro=edit

  const allTags = [...new Set(macros.flatMap(m=>m.tags||[]))].sort()
  const allLangs = [...new Set(macros.map(m=>m.language||'English'))].sort()

  const visible = macros.filter(m=>{
    if(tab==='active' && m.archived) return false
    if(tab==='archived' && !m.archived) return false
    if(search && !(m.name+m.body+(m.tags||[]).join('')).toLowerCase().includes(search.toLowerCase())) return false
    if(langFilter!=='all' && m.language!==langFilter) return false
    if(tagFilter!=='all' && !(m.tags||[]).includes(tagFilter)) return false
    return true
  })

  function handleSave(m) {
    onSaveMacro(m)
    setEditing(null)
  }
  function handleDuplicate(m) {
    onSaveMacro({...m, id:`m_${Date.now()}`, name:`${m.name} (copy)`, usageCount:0, updatedAt:new Date().toISOString()})
    setEditing(null)
  }
  function handleDelete(id) {
    if(!confirm('Delete this macro? This cannot be undone.')) return
    onDeleteMacro(id); setEditing(null)
  }
  function handleArchive(m) {
    onSaveMacro({...m, archived:!m.archived, updatedAt:new Date().toISOString()})
  }

  function fmtDate(iso) {
    if(!iso) return '—'
    try { return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) } catch{ return '—' }
  }

  if(editing) {
    return (
      <div style={{position:'fixed',inset:0,background:'var(--bg-page)',zIndex:200,display:'flex',flexDirection:'column'}}>
        <MacroEditor
          macro={editing==='new'?null:editing}
          onSave={handleSave}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onBack={()=>setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div style={{position:'fixed',inset:0,background:'var(--bg-page)',zIndex:200,display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:16,padding:'14px 28px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)',flexShrink:0}}>
        <button onClick={onClose} style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',fontSize:13,padding:'4px 0',fontFamily:'inherit'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to inbox
        </button>
        <span style={{flex:1,fontSize:16,fontWeight:700,color:'var(--text-1)'}}>Macros</span>
        {/* Filters */}
        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position:'absolute',left:9,color:'var(--text-3)',pointerEvents:'none'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search macros..." style={{paddingLeft:30,paddingRight:12,paddingTop:7,paddingBottom:7,border:'1px solid var(--border)',borderRadius:8,fontSize:12.5,color:'var(--text-1)',background:'var(--bg-surface-2)',width:200,outline:'none',fontFamily:'inherit'}} />
        </div>
        <select value={langFilter} onChange={e=>setLangF(e.target.value)} style={{padding:'7px 10px',border:'1px solid var(--border)',borderRadius:8,fontSize:12.5,color:'var(--text-2)',background:'var(--bg-surface-2)',cursor:'pointer',fontFamily:'inherit',outline:'none'}}>
          <option value="all">Language</option>
          {allLangs.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        <select value={tagFilter} onChange={e=>setTagF(e.target.value)} style={{padding:'7px 10px',border:'1px solid var(--border)',borderRadius:8,fontSize:12.5,color:'var(--text-2)',background:'var(--bg-surface-2)',cursor:'pointer',fontFamily:'inherit',outline:'none'}}>
          <option value="all">All tags</option>
          {allTags.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={()=>setEditing('new')} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'var(--accent)',color:'#fff',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>Create macro</button>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,padding:'0 28px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)',flexShrink:0}}>
        {['active','archived'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'10px 16px',background:'none',border:'none',borderBottom:`2px solid ${tab===t?'var(--accent)':'transparent'}`,color:tab===t?'var(--text-1)':'var(--text-2)',fontWeight:tab===t?600:500,fontSize:13,cursor:'pointer',fontFamily:'inherit',textTransform:'capitalize',transition:'all .15s'}}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{flex:1,overflow:'auto',padding:'0 28px'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid var(--border)'}}>
              {[['MACRO',''],['TAGS','160px'],['LANGUAGE','110px'],['USAGE','90px'],['LAST UPDATED','140px'],['','56px']].map(([h,w])=>(
                <th key={h} style={{padding:'10px 12px 10px 0',fontSize:10.5,fontWeight:700,color:'var(--text-3)',letterSpacing:'.05em',textAlign:'left',whiteSpace:'nowrap',width:w||'auto'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length===0&&(
              <tr><td colSpan={6} style={{padding:'40px 0',textAlign:'center',color:'var(--text-3)',fontSize:13}}>No macros found</td></tr>
            )}
            {visible.map(m=>(
              <tr key={m.id} style={{borderBottom:'1px solid var(--border)'}} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-surface-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                {/* Name */}
                <td style={{padding:'12px 12px 12px 0'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <button onClick={e=>{e.stopPropagation();onToggleFav(m.id)}} style={{background:'none',border:'none',cursor:'pointer',display:'flex',padding:2,color:favs.includes(m.id)?'#f59e0b':'var(--text-3)',flexShrink:0,opacity:favs.includes(m.id)?1:0.4,transition:'opacity .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=favs.includes(m.id)?1:0.4}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={favs.includes(m.id)?'#f59e0b':'none'} stroke={favs.includes(m.id)?'#f59e0b':'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </button>
                    <button onClick={()=>setEditing(m)} style={{background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',padding:0,color:'var(--text-1)',fontSize:13,fontWeight:500}}>{m.name}</button>
                  </div>
                </td>
                {/* Tags */}
                <td style={{padding:'12px 12px 12px 0'}}>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {(m.tags||[]).map(t=><span key={t} style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:4,background:'var(--accent-soft)',color:'var(--accent-text)'}}>{t}</span>)}
                  </div>
                </td>
                {/* Language */}
                <td style={{padding:'12px 12px 12px 0',fontSize:12.5,color:'var(--text-2)'}}>{m.language||'English'}</td>
                {/* Usage */}
                <td style={{padding:'12px 12px 12px 0',fontSize:12.5,color:'var(--text-2)'}}>{m.usageCount||0}</td>
                {/* Updated */}
                <td style={{padding:'12px 12px 12px 0',fontSize:12,color:'var(--text-3)'}}>{fmtDate(m.updatedAt)}</td>
                {/* Actions */}
                <td style={{padding:'12px 0',textAlign:'right'}}>
                  <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end'}}>
                    <button onClick={()=>setEditing(m)} title="Edit" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',display:'flex',padding:4,borderRadius:5,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='var(--text-1)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-3)'}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={()=>handleArchive(m)} title={m.archived?'Unarchive':'Archive'} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',display:'flex',padding:4,borderRadius:5,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='var(--text-1)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-3)'}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                    </button>
                    <button onClick={()=>handleDelete(m.id)} title="Delete" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',display:'flex',padding:4,borderRadius:5,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-3)'}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────
function InboxPage() {
  const [session, setSession]         = useState(null)
  const [threads, setThreads]         = useState([])
  const searchParams                  = useSearchParams()
  const [view, setView]               = useState(searchParams.get('view') || 'all')
  const [selected, setSelected]       = useState(null)
  const [messages, setMessages]       = useState([])
  const [loadingThreads, setLT]       = useState(true)
  const [loadingMsgs, setLM]          = useState(false)
  const [reply, setReply]             = useState('')
  const [composerTab, setComposerTab] = useState('reply')
  const [sending, setSending]         = useState(false)
  const [aiLoading, setAiLoading]     = useState(false)
  const [toast, setToast]             = useState(null)
  const [search, setSearch]           = useState('')
  const [gmailOk, setGmailOk]         = useState(true)
  const [emailProvider, setEmailProvider] = useState(null) // 'gmail' | 'outlook' | 'custom' | null
  const [connectedEmail, setConnectedEmail] = useState(null)
  const [sentThreads, setSentThreads]   = useState([])
  const [loadingSent, setLoadingSent]   = useState(false)
  const [demoMode, setDemoMode]       = useState(false)
  const [customer, setCustomer]       = useState(null)
  const [loadingCust, setLoadingCust] = useState(false)
  const [rightTab, setRightTab]       = useState('shopify')
  const [statusMenu, setStatusMenu]   = useState(false)
  const [statuses, setStatuses]       = useState(()=>{ try{return JSON.parse(localStorage.getItem('lynq_statuses')||'{}')}catch{return{}} })
  // Macros
  const [macros, setMacros]           = useState(loadMacros)
  const [aiMacros, setAiMacros]       = useState([])
  const [showMacros, setShowMacros]   = useState(false)
  const [showMacroManager, setShowMacroManager] = useState(false)
  const [macroFavs, setMacroFavs]     = useState(()=>{ try{return JSON.parse(localStorage.getItem('lynq_macro_favs')||'[]')}catch{return[]} })
  const [tagLibrary, setTagLibrary]   = useState(loadTicketTags)

  function saveMacro(m) {
    setMacros(prev=>{
      const idx = prev.findIndex(x=>x.id===m.id)
      const next = idx>=0 ? prev.map(x=>x.id===m.id?m:x) : [...prev, m]
      saveMacrosToStorage(next); return next
    })
  }
  function deleteMacro(id) {
    setMacros(prev=>{ const next=prev.filter(x=>x.id!==id); saveMacrosToStorage(next); return next })
  }
  function toggleMacroFav(id) {
    setMacroFavs(prev=>{
      const next = prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]
      localStorage.setItem('lynq_macro_favs',JSON.stringify(next)); return next
    })
  }
  function createTicketTag(name) {
    const clean = name?.trim()
    if(!clean) return null
    const existing = tagLibrary.find(t=>t.name.toLowerCase()===clean.toLowerCase())
    if(existing) return existing
    const colors = ['#84cc16','#a78bfa','#f97316','#8b5cf6','#f59e0b','#22c55e','#fb923c','#38bdf8','#ef4444','#64748b']
    const tag = { id:`tag-${Date.now()}`, name:clean, color:colors[tagLibrary.length%colors.length], description:'' }
    const next = [...tagLibrary, tag]
    setTagLibrary(next)
    saveTicketTags(next)
    return tag
  }
  // Order modals
  const [modal, setModal]             = useState(null) // { type:'refund'|'cancel'|'duplicate'|'address', order }
  // AI triage
  const [analyses, setAnalyses]       = useState({})
  // Translation
  const [autoTranslate, setAutoTranslate]     = useState(false)
  const [customerLang, setCustomerLang]       = useState(null)
  const [msgTranslations, setMsgTranslations] = useState({})
  // Composer extras
  const [showEmoji, setShowEmoji]   = useState(false)
  const [attachments, setAttachments] = useState([])
  const [expandedOrders, setExpandedOrders] = useState({})
  const [expandedSubs, setExpandedSubs]     = useState({})
  const [custFieldsOpen, setCustFieldsOpen] = useState(true)
  const [custShowMore, setCustShowMore]     = useState(false)
  const [checkedThreads, setCheckedThreads] = useState({})
  const [ticketMeta, setTicketMeta]         = useState(()=>{ try{return JSON.parse(localStorage.getItem('lynq_ticket_meta')||'{}')}catch{return{}} })

  const msgEnd       = useRef(null)
  const replyRef     = useRef(null)
  const imgUploadRef = useRef(null)
  const fileUploadRef= useRef(null)

  // ── Auth + load ──
  useEffect(()=>{
    supabase.auth.getSession().then(async ({data:{session}})=>{
      if(!session){window.location.href='/login';return}
      setSession(session)
      const detectedProvider = await loadThreads(session.access_token)
      loadMacros(session.access_token)
      if(searchParams.get('view')==='sent'){
        loadSentThreads(session.access_token, detectedProvider)
      }
    })
  },[])

  useEffect(()=>{ msgEnd.current?.scrollIntoView({behavior:'smooth'}) },[messages])

  // ── Keyboard shortcuts ──
  useEffect(()=>{
    function h(e){
      const tag=document.activeElement?.tagName
      if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return
      if(e.key==='j'){ const i=sortedFiltered.findIndex(t=>t.id===selected?.id); if(i<sortedFiltered.length-1) openThread(sortedFiltered[i+1]) }
      if(e.key==='k'){ const i=sortedFiltered.findIndex(t=>t.id===selected?.id); if(i>0) openThread(sortedFiltered[i-1]) }
      if(e.key==='r'&&selected) setTimeout(()=>replyRef.current?.focus(),10)
    }
    document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h)
  },[threads,selected,view,search,analyses])

  // ── Status helpers ──
  function saveStatus(id,s){ const u={...statuses,[id]:s}; setStatuses(u); localStorage.setItem('lynq_statuses',JSON.stringify(u)) }
  const getStatus = id => statuses[id]||'open'
  const getTicketMeta = id => ticketMeta[id] || { tags:[], assignee:'Unassigned', contactReason:'', product:'', resolution:'' }
  function updateTicketMeta(id, patch) {
    const current = getTicketMeta(id)
    const next = { ...ticketMeta, [id]: { ...current, ...patch } }
    setTicketMeta(next)
    localStorage.setItem('lynq_ticket_meta', JSON.stringify(next))
  }
  function addTicketTag(id) {
    const tag = createTicketTag(prompt('Add tag:'))
    if(tag) {
      const current = getTicketMeta(id)
      const tags = [...new Set([...(current.tags||[]), tag.name])]
      updateTicketMeta(id, { tags })
    }
  }
  function removeTicketTag(id, tag) {
    const current = getTicketMeta(id)
    updateTicketMeta(id, { tags: (current.tags || []).filter(t=>t!==tag) })
  }
  function updateTicketField(id, key, label) {
    const value = prompt(`${label}:`)
    if(value === null) return
    updateTicketMeta(id, { [key]: value.trim() })
  }

  // ── Filtered + priority-sorted threads ──
  const URGENCY_SCORE = { critical:4, high:3, medium:2, low:1 }
  const filtered = threads.filter(t=>{
    const s=getStatus(t.id)
    if(view==='open')     return s==='open'
    if(view==='pending')  return s==='pending'
    if(view==='resolved') return s==='resolved'
    return true
  }).filter(t=>!search||t.subject?.toLowerCase().includes(search.toLowerCase())||t.from?.toLowerCase().includes(search.toLowerCase()))

  const sortedFiltered = [...filtered].sort((a,b)=>{
    const sa = URGENCY_SCORE[analyses[a.id]?.urgency]||0
    const sb = URGENCY_SCORE[analyses[b.id]?.urgency]||0
    if(sb!==sa) return sb-sa
    return new Date(b.date)-new Date(a.date)
  })

  const counts = { all:threads.length, open:threads.filter(t=>getStatus(t.id)==='open').length, pending:threads.filter(t=>getStatus(t.id)==='pending').length, resolved:threads.filter(t=>getStatus(t.id)==='resolved').length }

  // ── API calls ──
  async function loadMacros(token) {
    const res = await authFetch('/api/macros',{},token)
    const data = await res.json()
    if(data.macros?.length) setMacros(data.macros)
  }

  async function loadThreads(token) {
    setLT(true)
    // Try Gmail first, then Outlook, then custom email
    const gmailRes  = await authFetch('/api/gmail/threads',{},token)
    const gmailData = await gmailRes.json()
    if(gmailData.connected!==false){
      setGmailOk(true); setDemoMode(false); setEmailProvider('gmail')
      setConnectedEmail(gmailData.email||null)
      const thr = gmailData.threads||[]
      setThreads(thr); setLT(false)
      analyzeThreads(thr, token)
      return 'gmail'
    }

    const outlookRes  = await authFetch('/api/outlook/threads',{},token)
    const outlookData = await outlookRes.json()
    if(outlookData.connected!==false && outlookData.threads?.length){
      setGmailOk(false); setDemoMode(false); setEmailProvider('outlook')
      setConnectedEmail(outlookData.email||null)
      const thr = outlookData.threads||[]
      setThreads(thr); setLT(false)
      analyzeThreads(thr, token)
      return 'outlook'
    }

    const customRes  = await authFetch('/api/custom-email/threads',{},token)
    const customData = await customRes.json()
    if(customData.connected!==false && customData.threads?.length){
      setGmailOk(false); setDemoMode(false); setEmailProvider('custom')
      setConnectedEmail(customData.email||null)
      const thr = customData.threads||[]
      setThreads(thr); setLT(false)
      analyzeThreads(thr, token)
      return 'custom'
    }

    // No provider connected — demo mode
    setGmailOk(false); setDemoMode(true); setEmailProvider(null)
    setThreads(DEMO_THREADS); setLT(false)
    analyzeThreads(DEMO_THREADS, token)
    return null
  }

  async function loadSentThreads(token, provider) {
    setLoadingSent(true)
    setSentThreads([])
    try {
      const p = provider || emailProvider
      // Only Gmail has a dedicated sent route; Outlook/custom fallback to gmail if not connected
      const path = p==='outlook' ? '/api/outlook/sent-threads'
                 : p==='custom'  ? '/api/custom-email/sent-threads'
                 : '/api/gmail/sent-threads'
      const res  = await authFetch(path, {}, token)
      const data = await res.json()
      setSentThreads(data.threads||[])
    } catch {}
    setLoadingSent(false)
  }

  async function analyzeThreads(threadList, token) {
    if(!threadList?.length||!token) return
    try {
      const res = await authFetch('/api/ai/analyze',{
        method:'POST',
        body:JSON.stringify({ threads: threadList.slice(0,25).map(t=>({ id:t.id, subject:t.subject, snippet:t.snippet })) })
      }, token)
      const data = await res.json()
      if(data.analyses) setAnalyses(data.analyses)
    } catch {}
  }

  async function openThread(thread) {
    setSelected(thread); setMessages([]); setReply(''); setCustomer(null); setLM(true); setShowMacros(false)
    setCustomerLang(null); setAutoTranslate(false); setMsgTranslations({}); setShowEmoji(false); setAttachments([])
    if(replyRef.current) replyRef.current.innerHTML = ''
    if(demoMode || thread.id?.startsWith('demo-')) {
      setTimeout(()=>{ setMessages(DEMO_MESSAGES[thread.id]||[]); setLM(false); setCustomer(DEMO_CUSTOMER[thread.id]||null); setThreads(p=>p.map(t=>t.id===thread.id?{...t,unread:false}:t)) }, 400)
      return
    }
    const providerPath = emailProvider==='outlook' ? 'outlook' : emailProvider==='custom' ? 'custom-email' : 'gmail'
    const res  = await authFetch(`/api/${providerPath}/thread/${thread.id}`,{},session.access_token)
    const data = await res.json()
    setMessages(data.messages||[])
    setLM(false)
    if(thread.unread){ authFetch(`/api/${providerPath}/thread/${thread.id}`,{method:'PATCH'},session.access_token); setThreads(p=>p.map(t=>t.id===thread.id?{...t,unread:false}:t)) }
    const email=extractEmail(thread.from)
    if(email){
      setLoadingCust(true)
      const cr=await authFetch(`/api/shopify/customer?email=${encodeURIComponent(email)}`,{},session.access_token)
      const cd=await cr.json()
      setCustomer(cd)
      setLoadingCust(false)
      // AI macro suggestions
      authFetch('/api/ai/macros',{method:'POST',body:JSON.stringify({subject:thread.subject,snippet:thread.snippet})},session.access_token)
        .then(r=>r.json()).then(d=>{ if(d.macros?.length) setAiMacros(d.macros) }).catch(()=>{})
      // Detect customer language from snippet
      if(thread.snippet) {
        authFetch('/api/ai/translate',{method:'POST',body:JSON.stringify({text:thread.snippet,detectOnly:true})},session.access_token)
          .then(r=>r.json()).then(d=>{ if(d.code&&d.name){ setCustomerLang(d); if(d.code!=='en') setAutoTranslate(true) } }).catch(()=>{})
      }
    }
  }

  async function handleAiReply() {
    if(!messages.length) return
    setAiLoading(true)
    const res  = await authFetch('/api/ai/reply',{method:'POST',body:JSON.stringify({messages,threadId:selected.id})},session.access_token)
    const data = await res.json()
    if(data.reply){
      if(replyRef.current){ replyRef.current.innerHTML=plainTextToSafeHtml(data.reply); setReply(replyRef.current.textContent) }
      else setReply(data.reply)
    } else showT('AI reply failed','error')
    setAiLoading(false)
  }

  async function handleSend() {
    const textContent = replyRef.current?.textContent || reply
    if(!textContent.trim()||!selected) return false
    if(demoMode||!emailProvider){ showT('Demo mode — connect an email provider to send messages','error'); return false }
    setSending(true)
    let bodyToSend = sanitizeHtml(replyRef.current?.innerHTML || reply)
    // Auto-translate outgoing message to customer's language
    if(autoTranslate && customerLang && customerLang.code !== 'en') {
      try {
        const tres = await authFetch('/api/ai/translate',{method:'POST',body:JSON.stringify({text:textContent,targetLang:customerLang.name})},session.access_token)
        const td = await tres.json()
        if(td.translated) bodyToSend = plainTextToSafeHtml(td.translated)
      } catch {}
    }
    const last=messages[messages.length-1]
    const sendPath = emailProvider==='outlook' ? '/api/outlook/send' : emailProvider==='custom' ? '/api/custom-email/send' : '/api/gmail/send'
    const sendPayload = {
      to: extractEmail(last?.from||selected.from),
      subject: `Re: ${selected.subject}`,
      body: bodyToSend,
      replyToMessageId: last?.id,
    }
    if(emailProvider==='gmail') sendPayload.threadId = selected.id
    const res=await authFetch(sendPath,{method:'POST',body:JSON.stringify(sendPayload)},session.access_token)
    const data=await res.json()
    if(data.success){
      showT('Message sent!','success')
      if(replyRef.current) replyRef.current.innerHTML=''
      setReply(''); setAttachments([])
      loadThreads(session.access_token)
      setSending(false)
      return true
    }
    showT(data.error||'Failed to send','error')
    setSending(false)
    return false
  }

  async function handleSendResolve() {
    if(!selected) return
    const currentId = selected.id
    const currentIdx = sortedFiltered.findIndex(t => t.id === currentId)
    const nextThread = sortedFiltered.find((t, i) => i !== currentIdx)
    const ok = await handleSend()
    if(ok) {
      saveStatus(currentId, 'resolved')
      showT('Resolved & closed','success')
      if(nextThread) openThread(nextThread)
      else setSelected(null)
    }
  }

  async function translateMessage(msgId, text) {
    setMsgTranslations(p=>({...p,[msgId]:'__loading__'}))
    try {
      const res = await authFetch('/api/ai/translate',{method:'POST',body:JSON.stringify({text})},session.access_token)
      const d = await res.json()
      setMsgTranslations(p=>({...p,[msgId]:d.translated||'Translation failed'}))
    } catch { setMsgTranslations(p=>({...p,[msgId]:'Translation failed'})) }
  }

  function formatDoc(cmd, val) { replyRef.current?.focus(); document.execCommand(cmd, false, val||null) }

  function insertLink() {
    const url = prompt('Enter URL:')
    const safeUrl = normalizeSafeUrl(url)
    if(url && !safeUrl) { showT('Only http, https, or mailto links are allowed','error'); return }
    if(safeUrl) { replyRef.current?.focus(); document.execCommand('createLink', false, safeUrl) }
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0]; if(!file) return
    if(!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type)){ showT('Unsupported image type','error'); e.target.value=''; return }
    const reader = new FileReader()
    reader.onload = () => {
      const src = normalizeSafeUrl(reader.result, { allowImages: true })
      if(!src){ showT('Unsupported image type','error'); return }
      replyRef.current?.focus(); document.execCommand('insertImage', false, src); setReply(replyRef.current?.textContent||'')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleFileAttach(e) {
    const files = Array.from(e.target.files||[])
    setAttachments(p=>[...p,...files.map(f=>({name:f.name,size:f.size}))])
    e.target.value = ''
  }

  const EMOJIS = ['😊','😀','🙏','👍','❤️','✅','⚠️','📦','🚚','💰','🔄','❌','✨','💬','🎉','😅','🤔','😢','😡','🥺','🙌','💪','🤝','⏰','🌍','🔔','⭐','📧','👋','😮','🫡','🙌']

  function showT(msg,type='success'){ setToast({msg,type}) }

  function handleModalSuccess(msg,type='success'){
    setModal(null)
    showT(msg,type)
    if(customer&&session) {
      const email=extractEmail(selected?.from||'')
      if(email){ authFetch(`/api/shopify/customer?email=${encodeURIComponent(email)}`,{},session.access_token).then(r=>r.json()).then(d=>setCustomer(d)).catch(()=>{}) }
    }
  }

  if(!session) return null

  const VIEWS = [{id:'all',label:'All'},{id:'open',label:'Open'},{id:'pending',label:'Pending'},{id:'resolved',label:'Resolved'},{id:'sent',label:'Sent'}]

  // ── Render ──
  return (
    <div className="ir in-bg" style={{display:'flex',height:'100vh',overflow:'hidden',position:'relative'}}>
      <style>{CSS}</style>

      {/* ── Aurora background ── */}
      <div aria-hidden style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
        <div className="in-al1" />
        <div className="in-al4" />
        <div className="in-al6" />
        <div className="in-grid" />
        <div className="in-vig" />
      </div>

      <Sidebar />

      {/* ═══════════════ LEFT: Thread list ═══════════════ */}
      <div className="in-panel-l" style={{width:308,display:'flex',flexDirection:'column',flexShrink:0,position:'relative',zIndex:1}}>

        {/* Header */}
        <div style={{padding:'14px 14px 0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:15,fontWeight:700,color:'var(--text-1)',letterSpacing:'-0.01em'}}>Inbox</span>
              <span title="Shortcuts: j/k navigate · r reply" style={{fontSize:9.5,color:'var(--text-3)',background:'var(--bg-surface-2)',padding:'2px 6px',borderRadius:4,cursor:'default'}}>j/k/r</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <button onClick={()=>loadThreads(session.access_token)} style={{background:'transparent',color:'var(--text-3)',cursor:'pointer',display:'flex',padding:5,borderRadius:7,transition:'all .15s'}} onMouseEnter={e=>{e.currentTarget.style.color='var(--text-2)';e.currentTarget.style.background='var(--bg-input)'}} onMouseLeave={e=>{e.currentTarget.style.color='var(--text-3)';e.currentTarget.style.background='transparent'}} title="Refresh">{I.refresh}</button>
              <button onClick={()=>setModal({type:'compose'})} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:8,background:'var(--accent)',border:'none',color:'#fff',cursor:'pointer',fontSize:11.5,fontWeight:600,fontFamily:'inherit',transition:'all .18s',letterSpacing:'.01em'}} onMouseEnter={e=>{e.currentTarget.style.background='var(--accent-hover)'}} onMouseLeave={e=>{e.currentTarget.style.background='var(--accent)'}} title="New ticket">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{position:'relative',marginBottom:10}}>
            <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)',pointerEvents:'none',display:'flex'}}>{I.search}</span>
            <input className="isearch" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search threads…" />
          </div>

          {/* View tabs */}
          <div style={{display:'flex',borderBottom:'1px solid var(--border)',overflowX:'auto'}} className="sscroll">
            {VIEWS.map(v=>(
              <button key={v.id} className={`vtab${view===v.id?' on':''}`} onClick={()=>{ setView(v.id); if(v.id==='sent'&&session) loadSentThreads(session.access_token, emailProvider) }}>
                {v.label}
                {v.id!=='sent'&&counts[v.id]>0&&<span style={{marginLeft:4,background:view===v.id?'rgba(161,117,252,0.2)':'var(--bg-input)',color:view===v.id?'#A175FC':'var(--text-3)',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:100}}>{counts[v.id]}</span>}
                {v.id==='sent'&&sentThreads.length>0&&<span style={{marginLeft:4,background:view===v.id?'rgba(161,117,252,0.2)':'var(--bg-input)',color:view===v.id?'#A175FC':'var(--text-3)',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:100}}>{sentThreads.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Thread list */}
        <div className="sscroll" style={{flex:1,overflowY:'auto'}}>
          {/* Select all bar */}
          {(()=>{
            const listIds=(view==='sent'?sentThreads:sortedFiltered).map(t=>t.id)
            const allChecked=listIds.length>0&&listIds.every(id=>checkedThreads[id])
            const anyChecked=listIds.some(id=>checkedThreads[id])
            const checkedCount=listIds.filter(id=>checkedThreads[id]).length
            return (
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px 9px 15px',borderBottom:'1px solid var(--border)',background:'var(--bg-surface)',position:'sticky',top:0,zIndex:2}}>
                <input type="checkbox" className="trow-cb" checked={allChecked} onChange={e=>{ const next={}; if(e.target.checked) listIds.forEach(id=>next[id]=true); setCheckedThreads(next) }} style={{marginTop:0}} />
                <span style={{flex:1,fontSize:12,fontWeight:600,color:'var(--text-2)'}}>{anyChecked?`${checkedCount} selected`:'Select all'}</span>
                {anyChecked&&<>
                  <button title="Mark as read" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',display:'flex',padding:4,borderRadius:5,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='var(--text-1)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-2)'}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button title="Assign" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',display:'flex',padding:4,borderRadius:5,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='var(--text-1)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-2)'}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </button>
                  <button title="More actions" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',display:'flex',padding:4,borderRadius:5,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='var(--text-1)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-2)'}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                  </button>
                </>}
                {!anyChecked&&<>
                  <button title="Mark all read" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',display:'flex',padding:4,borderRadius:5,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='var(--text-1)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-2)'}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button title="Assign" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',display:'flex',padding:4,borderRadius:5,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='var(--text-1)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-2)'}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </button>
                  <button title="More" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-2)',display:'flex',padding:4,borderRadius:5,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='var(--text-1)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text-2)'}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
                  </button>
                </>}
              </div>
            )
          })()}
          {demoMode&&(
            <div style={{margin:'10px 10px 4px',padding:'8px 12px',background:'rgba(251,191,36,0.07)',border:'1px solid rgba(251,191,36,0.22)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
              <span style={{fontSize:11,fontWeight:600,color:'rgba(251,191,36,0.85)'}}>Demo mode</span>
              <a href="/settings" style={{fontSize:10.5,fontWeight:700,color:'#A175FC',textDecoration:'none',flexShrink:0}}>Connect →</a>
            </div>
          )}
          {(view==='sent'?loadingSent:loadingThreads)&&[0,1,2,3,4].map(i=>(
            <div key={i} style={{padding:'11px 14px 11px 12px',borderBottom:'1px solid var(--border)',display:'flex',gap:9,opacity:1-i*.16}}>
              <div className="skel" style={{width:16,height:16,borderRadius:4,flexShrink:0,marginTop:2}} />
              <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
                <div className="skel" style={{height:12,width:'55%'}} />
                <div className="skel" style={{height:11,width:'80%'}} />
                <div className="skel" style={{height:10,width:'70%'}} />
              </div>
            </div>
          ))}
          {view==='sent'&&!loadingSent&&sentThreads.length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:'var(--text-3)',fontSize:12.5}}>No sent messages</div>}
          {view!=='sent'&&!loadingThreads&&sortedFiltered.length===0&&gmailOk&&<div style={{padding:'40px 20px',textAlign:'center',color:'var(--text-3)',fontSize:12.5}}>No threads in this view</div>}
          {(view==='sent' ? sentThreads : sortedFiltered).map(thread=>{
            const active=selected?.id===thread.id
            const isSentView = view==='sent'
            const name = isSentView ? extractName(thread.to) : extractName(thread.from)
            const status=getStatus(thread.id)
            const analysis=analyses[thread.id]
            const URGENCY_UI={
              critical:{ color:'#ef4444', bg:'rgba(239,68,68,0.13)', border:'rgba(239,68,68,0.55)' },
              high:    { color:'#f97316', bg:'rgba(249,115,22,0.13)', border:'rgba(249,115,22,0.55)' },
              medium:  { color:'#fbbf24', bg:'rgba(251,191,36,0.12)', border:'rgba(251,191,36,0.4)'  },
              low:     { color:'#4ade80', bg:'rgba(74,222,128,0.09)', border:'rgba(74,222,128,0.3)'  },
            }
            const urg=analysis?.urgency
            const urgUI=URGENCY_UI[urg]
            return (
              <div key={thread.id} className={`trow${active?' trow-active':''}`}
                onClick={()=>openThread(thread)}>
                {/* Checkbox */}
                <input type="checkbox" className="trow-cb" checked={!!checkedThreads[thread.id]}
                  onClick={e=>e.stopPropagation()}
                  onChange={e=>setCheckedThreads(p=>({...p,[thread.id]:e.target.checked}))} />
                {/* Content */}
                <div style={{flex:1,minWidth:0}}>
                  {/* Row 1: name + email icon + time + unread dot */}
                  <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                    <span style={{fontSize:12.5,fontWeight:thread.unread?700:600,color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>
                      {isSentView?'To: '+(name||extractEmail(thread.to)):name}
                    </span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-1)',flexShrink:0}}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    <span style={{fontSize:10.5,color:'var(--text-1)',flexShrink:0,whiteSpace:'nowrap'}}>{formatDate(thread.date)}</span>
                    {thread.unread&&<span style={{width:7,height:7,borderRadius:'50%',background:'#ef4444',flexShrink:0,boxShadow:'0 0 0 1.5px rgba(239,68,68,0.25)'}} />}
                  </div>
                  {/* Row 2: subject */}
                  <div style={{fontSize:12,fontWeight:thread.unread?600:500,color:thread.unread?'var(--text-1)':'var(--text-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:3}}>
                    {thread.subject||'(no subject)'}
                  </div>
                  {/* Row 3: snippet — 2 lines */}
                  <div className="trow-snippet" style={{fontSize:11.5,color:'var(--text-1)',lineHeight:1.45}}>
                    {thread.snippet}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══════════════ CENTER: Conversation ═══════════════ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0,position:'relative',zIndex:1}}>
        {!selected?(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,color:'var(--text-3)'}}>
            <div style={{opacity:.4}}>{I.mail}</div>
            <div style={{fontSize:13}}>Select a thread to read</div>
            <div style={{fontSize:11,color:'var(--text-3)'}}>j / k navigate · r reply</div>
          </div>
        ):(
          <>
            {/* Ticket header */}
            <div style={{padding:'14px 22px',borderBottom:'1px solid var(--border)',flexShrink:0,background:'var(--bg-surface)'}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2,letterSpacing:'-0.01em'}}>{selected.subject}</div>
                  <div style={{fontSize:11.5,color:'var(--text-3)'}}>{extractName(selected.from)} · {messages.length} message{messages.length!==1?'s':''}</div>
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                  {/* Status dropdown */}
                  <div style={{position:'relative'}}>
                    <button onClick={()=>setStatusMenu(s=>!s)} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 11px',background:STATUS[getStatus(selected.id)]?.bg,border:`1px solid ${STATUS[getStatus(selected.id)]?.border}`,borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:600,color:STATUS[getStatus(selected.id)]?.color,fontFamily:'inherit',transition:'all .15s'}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:STATUS[getStatus(selected.id)]?.color,flexShrink:0}} />
                      {STATUS[getStatus(selected.id)]?.label}
                      {I.chevron}
                    </button>
                    {statusMenu&&<StatusMenu current={getStatus(selected.id)} onChange={s=>saveStatus(selected.id,s)} onClose={()=>setStatusMenu(false)} />}
                  </div>
                </div>
              </div>
              <TicketActionBar
                meta={getTicketMeta(selected.id)}
                status={getStatus(selected.id)}
                tagLibrary={tagLibrary}
                onClose={() => saveStatus(selected.id, 'closed')}
                onAddTag={() => addTicketTag(selected.id)}
                onCreateTag={createTicketTag}
                onRemoveTag={(tag) => removeTicketTag(selected.id, tag)}
                onFieldChange={(field, labelOrValue) => field === 'assignee' ? updateTicketMeta(selected.id, { assignee: labelOrValue }) : updateTicketField(selected.id, field, labelOrValue)}
              />
            </div>

            {/* Messages */}
            <div className="sscroll conv-area" style={{flex:1,overflowY:'auto',padding:'24px 28px 16px',background:'var(--bg-surface)'}}>
              {loadingMsgs&&[0,1].map(i=>(
                <div key={i} style={{display:'flex',gap:12,flexDirection:i%2===0?'row':'row-reverse',marginBottom:22,animation:`fadeUp .3s ease ${i*.1}s both`}}>
                  <div className="skel" style={{width:34,height:34,borderRadius:'50%',flexShrink:0}} />
                  <div className="skel" style={{height:80,width:'60%',borderRadius:18}} />
                </div>
              ))}
              {messages.map((msg,idx)=>{
                const isAgent=msg.from?.toLowerCase().includes(session.user.email?.split('@')[0]?.toLowerCase()||'')
                const isNote=msg.isNote
                const name=extractName(msg.from)
                return (
                  <div key={msg.id||idx} style={{marginBottom:22,display:'flex',gap:12,flexDirection:isAgent?'row-reverse':'row',animation:'msgIn .3s cubic-bezier(.16,1,.3,1) both'}}>
                    {!isNote&&<Avatar name={name} size={32} />}
                    <div style={{maxWidth:'76%'}}>
                      <div style={{fontSize:10.5,marginBottom:5,textAlign:isAgent?'right':'left'}}>
                        <span className="msg-sender">{name}</span>
                        <span className="msg-time">{formatDate(msg.date)}</span>
                      </div>
                      <div className={isNote?'msg-note':isAgent?'msg-out':'msg-in'}>
                        {isNote&&<div style={{fontSize:10,fontWeight:700,color:'rgba(251,191,36,0.75)',letterSpacing:'.07em',textTransform:'uppercase',marginBottom:7}}>Internal note</div>}
                        {msgTranslations[msg.id]&&msgTranslations[msg.id]!=='__loading__'
                          ? msgTranslations[msg.id]
                          : (msg.body||msg.snippet)}
                      </div>
                      {!isAgent&&!isNote&&(
                        <div style={{textAlign:'left',marginTop:4}}>
                          {msgTranslations[msg.id]==='__loading__'
                            ? <span style={{fontSize:10,color:'var(--text-3)'}}>Translating…</span>
                            : msgTranslations[msg.id]
                              ? <button className="msg-xlate-btn" onClick={()=>setMsgTranslations(p=>({...p,[msg.id]:undefined}))}>Show original</button>
                              : <button className="msg-xlate-btn" onClick={()=>translateMessage(msg.id, msg.body||msg.snippet||'')}>Translate</button>
                          }
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={msgEnd} />
            </div>

            {/* Composer */}
            <div style={{borderTop:'1px solid var(--border)',flexShrink:0,background:'var(--bg-surface)'}}>
              {/* Macro panel */}
              {showMacros&&(
                <MacroPanel
                  macros={macros.filter(m=>!m.archived)}
                  aiMacros={aiMacros}
                  customerName={extractName(selected?.from||'')}
                  favs={macroFavs}
                  onToggleFav={toggleMacroFav}
                  onInsert={body=>{
                    const safeBody = plainTextToSafeHtml(body)
                    if(replyRef.current){replyRef.current.innerHTML=safeBody;setReply(replyRef.current.textContent)}
                    else setReply(body)
                    setShowMacros(false);setTimeout(()=>replyRef.current?.focus(),10)
                  }}
                  onClose={()=>setShowMacros(false)}
                  onManage={()=>{ setShowMacros(false); setShowMacroManager(true) }}
                  onCreateNew={()=>{ setShowMacros(false); setShowMacroManager(true) }}
                  onDeleteMacro={deleteMacro}
                />
              )}

              {/* Composer — Gorgias style */}
              {!showMacros&&(
                <>
                  {/* Tab strip */}
                  <div style={{display:'flex',borderBottom:'1px solid var(--border)',paddingLeft:16}}>
                    {[{id:'reply',label:'Reply'},{id:'note',label:'Internal note'}].map(t=>(
                      <button key={t.id} className={`ctab${composerTab===t.id?' on':''}`} onClick={()=>setComposerTab(t.id)}>{t.label}</button>
                    ))}
                  </div>

                  {/* To: row */}
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',borderBottom:'1px solid var(--border)'}}>
                    <span style={{display:'flex',color:'var(--text-3)',flexShrink:0}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></span>
                    <span style={{fontSize:11.5,color:'var(--text-2)',fontWeight:600,flexShrink:0}}>To:</span>
                    <span style={{flex:1,fontSize:12,color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {extractName(selected.from)}{extractEmail(selected.from)?` (${extractEmail(selected.from)})`:''}</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-3)',flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>

                  {/* Macro search row */}
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background .12s'}} onClick={()=>setShowMacros(true)} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-surface-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{color:'var(--accent-text)',display:'flex',flexShrink:0}}>{I.lightning}</span>
                    <span style={{flex:1,fontSize:12,color:'var(--text-3)'}}>Search macros by name, tags or body...</span>
                    {aiMacros.length>0&&<span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:4,background:'var(--accent-soft)',color:'var(--accent-text)',letterSpacing:'.04em',flexShrink:0}}>AI</span>}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-3)',flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>

                  {/* Hidden file inputs */}
                  <input ref={imgUploadRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload} />
                  <input ref={fileUploadRef} type="file" multiple style={{display:'none'}} onChange={handleFileAttach} />

                  {/* Flat compose area */}
                  <div className="compose-box" onClick={()=>showEmoji&&setShowEmoji(false)}>
                    {/* Auto-translate banner */}
                    {autoTranslate&&customerLang&&customerLang.code!=='en'&&(
                      <div className="xlate-bar">
                        <span style={{display:'flex'}}>{I.globe}</span>
                        <span style={{flex:1}}>Auto-translating to <strong>{customerLang.name}</strong></span>
                        <button onClick={()=>setAutoTranslate(false)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(161,117,252,0.6)',display:'flex',padding:0}}>{I.xsmall}</button>
                      </div>
                    )}

                    {/* Attachments */}
                    {attachments.length>0&&(
                      <div style={{display:'flex',flexWrap:'wrap',gap:5,padding:'8px 14px 0'}}>
                        {attachments.map((a,i)=>(
                          <span key={i} className="attach-chip">
                            {I.paperclip} {a.name}
                            <button onClick={()=>setAttachments(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',display:'flex',padding:0,marginLeft:2}}>{I.xsmall}</button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Contenteditable composer */}
                    <div
                      ref={replyRef}
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder={composerTab==='reply'?'Click here to reply, or press r.':'Internal note — not visible to customer…'}
                      onInput={e=>setReply(e.currentTarget.textContent)}
                      onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey))handleSend()}}
                      className="compose-ta"
                      style={{minHeight:150,background:composerTab==='note'?'rgba(251,191,36,0.03)':'transparent'}}
                    />

                    {/* AI generating dots */}
                    {aiLoading&&(
                      <div style={{padding:'4px 16px 0',display:'flex',alignItems:'center',gap:4}}>
                        {[0,.18,.36].map(d=><span key={d} style={{width:5,height:5,borderRadius:'50%',background:'var(--accent)',display:'block',animation:`glowPulse .9s ease-in-out ${d}s infinite`}} />)}
                      </div>
                    )}

                    {/* Suggested macros */}
                    {(aiMacros.length>0||macros.length>0)&&(
                      <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderTop:'1px solid var(--border)',flexWrap:'wrap'}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-3)',flexShrink:0}}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                        <span style={{fontSize:10.5,color:'var(--text-2)',fontWeight:600,flexShrink:0}}>Suggested macros</span>
                        {(aiMacros.length>0?aiMacros:macros).slice(0,3).map(m=>{
                          const firstName=extractName(selected?.from||'').split(' ')[0]||'there'
                          const body=m.body.replace(/{{name}}/gi,firstName).replace(/{{firstname}}/gi,firstName)
                          return (
                            <button key={m.id} className="macro-chip-suggest" onClick={()=>{
                              if(replyRef.current){replyRef.current.innerHTML=body.replace(/\n/g,'<br>');setReply(replyRef.current.textContent)}
                              else setReply(body)
                              setTimeout(()=>replyRef.current?.focus(),10)
                            }}>{m.name}</button>
                          )
                        })}
                      </div>
                    )}

                    {/* Toolbar + Send buttons — single bottom row */}
                    <div style={{display:'flex',alignItems:'center',gap:1,padding:'7px 10px',borderTop:'1px solid var(--border)'}}>
                      <button className="rtbar-btn" title="Bold (⌘B)" onClick={()=>formatDoc('bold')} onMouseDown={e=>e.preventDefault()}><span style={{fontWeight:800,fontSize:13}}>B</span></button>
                      <button className="rtbar-btn" title="Italic (⌘I)" onClick={()=>formatDoc('italic')} onMouseDown={e=>e.preventDefault()}><span style={{fontStyle:'italic',fontSize:13}}>I</span></button>
                      <button className="rtbar-btn" title="Underline (⌘U)" onClick={()=>formatDoc('underline')} onMouseDown={e=>e.preventDefault()}><span style={{textDecoration:'underline',fontSize:13}}>U</span></button>
                      <div className="rtbar-sep" />
                      <button className="rtbar-btn" title="Insert link" onClick={insertLink} onMouseDown={e=>e.preventDefault()}>{I.link2}</button>
                      <button className="rtbar-btn" title="Insert image" onClick={()=>imgUploadRef.current?.click()} onMouseDown={e=>e.preventDefault()}>{I.image2}</button>
                      <div style={{position:'relative'}}>
                        <button className={`rtbar-btn${showEmoji?' rton':''}`} title="Emoji" onClick={()=>setShowEmoji(v=>!v)} onMouseDown={e=>e.preventDefault()}>{I.emoji}</button>
                        {showEmoji&&(
                          <div className="emoji-pop" onClick={e=>e.stopPropagation()}>
                            <div className="emoji-grid">
                              {EMOJIS.map(em=>(
                                <button key={em} className="emoji-btn" onMouseDown={e=>{e.preventDefault();replyRef.current?.focus();document.execCommand('insertText',false,em);setReply(replyRef.current?.textContent||'');setShowEmoji(false)}}>{em}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button className="rtbar-btn" title="Attach file" onClick={()=>fileUploadRef.current?.click()} onMouseDown={e=>e.preventDefault()}>{I.paperclip}</button>
                      <div className="rtbar-sep" />
                      <button className={`rtbar-btn${autoTranslate?' rton':''}`} title={customerLang?`Auto-translate to ${customerLang.name}`:'Detect language'} onClick={()=>customerLang?setAutoTranslate(v=>!v):null} style={{gap:4,paddingLeft:6,paddingRight:8,fontSize:11,fontWeight:600,minWidth:'auto'}}>
                        {I.globe}<span>{customerLang?customerLang.name:'Translate'}</span>
                      </button>
                      <div style={{flex:1}} />
                      <button className="btn-iris" onClick={handleAiReply} disabled={aiLoading||!messages.length} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 13px'}}>
                        {aiLoading?<Spinner />:I.ai}{aiLoading?'Generating…':'AI Reply'}
                      </button>
                      <button className="btn-close" onClick={handleSendResolve} disabled={!reply.trim()||sending} style={{marginLeft:6}}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Send & Close
                      </button>
                      <button className="btn-send" onClick={handleSend} disabled={!reply.trim()||sending} style={{display:'flex',alignItems:'center',gap:6,marginLeft:6}}>
                        {sending?<Spinner white />:I.send}{sending?'Sending…':'Send'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ═══════════════ RIGHT: Customer panel — Gorgias style ═══════════════ */}
      {selected&&(
        <div className="sscroll" style={{width:320,borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto',background:'var(--bg-surface)'}}>

          {/* Search */}
          <div style={{padding:'10px 12px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)',display:'flex',pointerEvents:'none'}}>{I.search}</span>
              <input className="rp-search" placeholder="Search for customers by email, order number..." />
            </div>
          </div>

          {/* Customer header */}
          <div style={{padding:'12px 14px 11px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <Avatar name={customer?.customer?`${customer.customer.firstName||''} ${customer.customer.lastName||''}`.trim()||extractName(selected.from):extractName(selected.from)} size={28} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {customer?.customer?`${customer.customer.firstName||''} ${customer.customer.lastName||''}`.trim()||extractName(selected.from):extractName(selected.from)}
                </div>
                <div style={{fontSize:11,color:'var(--text-3)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{extractEmail(selected.from)}</div>
              </div>
              <button style={{display:'flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:7,color:'var(--text-3)',cursor:'pointer',transition:'all .15s',border:'1px solid var(--border)',background:'transparent',flexShrink:0}} onMouseEnter={e=>{e.currentTarget.style.color='var(--text-1)';e.currentTarget.style.background='var(--bg-surface-2)'}} onMouseLeave={e=>{e.currentTarget.style.color='var(--text-3)';e.currentTarget.style.background='transparent'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
              </button>
            </div>
          </div>

          {/* Customer Fields — collapsible */}
          <div style={{borderBottom:'1px solid var(--border)',flexShrink:0}}>
            <button className="rp-section" onClick={()=>setCustFieldsOpen(v=>!v)}>
              <span style={{fontSize:11.5,fontWeight:700,color:'var(--text-2)',flex:1,letterSpacing:'.01em'}}>Customer Fields</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform:custFieldsOpen?'rotate(180deg)':'rotate(0)',transition:'transform .2s',color:'var(--text-3)',flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {custFieldsOpen&&(
              <div style={{padding:'0 14px 10px',display:'flex',flexDirection:'column'}}>
                <div className="rp-kv"><span className="rp-kv-l">Email</span><span className="rp-kv-v" style={{fontSize:11,wordBreak:'break-all'}}>{extractEmail(selected.from)}</span></div>
                {loadingCust&&[0,1].map(i=><div key={i} className="skel" style={{height:18,borderRadius:5,margin:'4px 0'}} />)}
                {customer?.customer&&!loadingCust&&(<>
                  {customer.customer.phone&&<div className="rp-kv"><span className="rp-kv-l">Phone</span><span className="rp-kv-v">{customer.customer.phone}</span></div>}
                  {(customer.customer.city||customer.customer.country)&&<div className="rp-kv"><span className="rp-kv-l">Location</span><span className="rp-kv-v">{[customer.customer.city,customer.customer.country].filter(Boolean).join(', ')}</span></div>}
                  {customer.customer.createdAt&&<div className="rp-kv"><span className="rp-kv-l">Customer since</span><span className="rp-kv-v">{new Date(customer.customer.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'short'})}</span></div>}
                  {customer.customer.note&&<div style={{marginTop:6,padding:'6px 9px',background:'var(--bg-surface-2)',borderRadius:7,border:'1px solid var(--border)'}}><div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:2}}>Note</div><div style={{fontSize:11.5,color:'var(--text-2)',fontStyle:'italic',lineHeight:1.5}}>{customer.customer.note}</div></div>}
                </>)}
              </div>
            )}
          </div>

          {/* Stats bar */}
          {customer?.customer&&!loadingCust&&(
            <div style={{display:'flex',borderBottom:'1px solid var(--border)',flexShrink:0}}>
              <div style={{flex:1,padding:'10px 0',textAlign:'center',borderRight:'1px solid var(--border)'}}>
                <div style={{fontSize:14,fontWeight:800,color:'var(--text-1)',letterSpacing:'-0.02em'}}>{fmtPrice(customer.customer.totalSpent,customer.customer.currency)}</div>
                <div style={{fontSize:9.5,color:'var(--text-3)',marginTop:2,textTransform:'uppercase',letterSpacing:'.06em'}}>Spent</div>
              </div>
              <div style={{flex:1,padding:'10px 0',textAlign:'center'}}>
                <div style={{fontSize:14,fontWeight:800,color:'var(--text-1)',letterSpacing:'-0.02em'}}>{customer.customer.ordersCount??'—'}</div>
                <div style={{fontSize:9.5,color:'var(--text-3)',marginTop:2,textTransform:'uppercase',letterSpacing:'.06em'}}>Orders</div>
              </div>
            </div>
          )}

          {/* Tags */}
          {customer?.customer?.tags&&(
            <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',display:'flex',flexWrap:'wrap',gap:4,flexShrink:0}}>
              {customer.customer.tags.split(',').filter(Boolean).map(tag=><span key={tag} className="rp-tag">{tag.trim()}</span>)}
            </div>
          )}

          {/* Tabs */}
          <div style={{display:'flex',borderBottom:'1px solid var(--border)',flexShrink:0}}>
            <button className={`rp-tab${rightTab==='info'?' on':''}`} onClick={()=>setRightTab('info')}>Customer</button>
            <button className={`rp-tab${rightTab==='shopify'?' on':''}`} onClick={()=>setRightTab('shopify')}>
              Orders{(customer?.orders||[]).length>0?` (${customer.orders.length})`:''}
            </button>
          </div>

          {/* ── Customer tab ── */}
          {rightTab==='info'&&(
            <div style={{flexShrink:0}}>
              {loadingCust&&<div style={{padding:'12px 14px'}}>{[0,1,2].map(i=><div key={i} className="skel" style={{height:20,borderRadius:5,marginBottom:8}} />)}</div>}
              {!loadingCust&&(
                <div style={{padding:'10px 14px 4px',display:'flex',flexDirection:'column',gap:0}}>
                  {/* Note row */}
                  <div style={{display:'flex',alignItems:'flex-start',gap:8,padding:'5px 0',borderBottom:'1px solid var(--border)',marginBottom:2}}>
                    <span style={{display:'flex',color:'var(--text-3)',marginTop:1,flexShrink:0}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
                    <span style={{fontSize:12,color:customer?.customer?.note?'var(--text-2)':'var(--text-3)',fontStyle:customer?.customer?.note?'normal':'italic',lineHeight:1.5}}>{customer?.customer?.note||'This customer has no note.'}</span>
                  </div>
                  {/* Email row */}
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0'}}>
                    <span style={{display:'flex',color:'var(--text-3)',flexShrink:0}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></span>
                    <a href={`mailto:${extractEmail(selected.from)}`} style={{fontSize:12,color:'var(--accent-text)',textDecoration:'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'} onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>{extractEmail(selected.from)}</a>
                  </div>
                  {/* Phone row */}
                  {customer?.customer?.phone&&(
                    <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0'}}>
                      <span style={{display:'flex',color:'var(--text-3)',flexShrink:0}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>
                      <a href={`tel:${customer.customer.phone}`} style={{fontSize:12,color:'var(--accent-text)',textDecoration:'none'}} onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'} onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>{customer.customer.phone}</a>
                    </div>
                  )}
                  {/* Show more */}
                  {customer?.customer&&(
                    <button onClick={()=>setCustShowMore(v=>!v)} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 0',background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--accent-text)',fontFamily:'inherit',fontWeight:500}}>
                      {custShowMore?'Show less':'Show more'}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform:custShowMore?'rotate(180deg)':'rotate(0)',transition:'transform .2s'}}><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  )}
                  {custShowMore&&customer?.customer&&(
                    <div style={{display:'flex',flexDirection:'column',gap:0,paddingTop:4,borderTop:'1px solid var(--border)'}}>
                      {(customer.customer.city||customer.customer.country)&&<div className="rp-kv"><span className="rp-kv-l">Location</span><span className="rp-kv-v">{[customer.customer.city,customer.customer.country].filter(Boolean).join(', ')}</span></div>}
                      {customer.customer.createdAt&&<div className="rp-kv"><span className="rp-kv-l">Customer since</span><span className="rp-kv-v">{new Date(customer.customer.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'short'})}</span></div>}
                      <div className="rp-kv"><span className="rp-kv-l">Orders</span><span className="rp-kv-v">{customer.customer.ordersCount??'—'}</span></div>
                      <div className="rp-kv"><span className="rp-kv-l">Total spent</span><span className="rp-kv-v" style={{fontWeight:700,color:'var(--text-1)'}}>{fmtPrice(customer.customer.totalSpent,customer.customer.currency)}</span></div>
                    </div>
                  )}
                  {!customer?.customer&&<div style={{padding:'8px 0',fontSize:12,color:'var(--text-3)'}}>No Shopify customer found</div>}
                </div>
              )}
              {/* Open Timeline row */}
              <div style={{padding:'8px 14px 12px',display:'flex',alignItems:'center',gap:10}}>
                <button style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:7,border:'1px solid var(--border)',background:'transparent',color:'var(--text-2)',fontSize:11.5,fontWeight:600,fontFamily:'inherit',cursor:'pointer',transition:'all .15s',flexShrink:0}} onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-surface-2)';e.currentTarget.style.color='var(--text-1)'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text-2)'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Open Timeline
                </button>
                {selected?.id&&<span style={{fontSize:11,color:'var(--text-3)'}}>1 ticket, 1 open</span>}
              </div>
            </div>
          )}

          {/* ── Orders tab ── */}
          {rightTab==='shopify'&&(
            <div>
              {/* Create order */}
              <div style={{padding:'10px 12px',borderBottom:'1px solid var(--border)'}}>
                <button style={{width:'100%',padding:'7px 12px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-2)',fontSize:12,fontWeight:600,fontFamily:'inherit',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'all .15s'}} onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-surface-2)';e.currentTarget.style.color='var(--text-1)'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text-2)'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Create order
                </button>
              </div>

              {loadingCust&&[0,1].map(i=>(
                <div key={i} style={{borderBottom:'1px solid var(--border)',padding:'10px 14px'}}>
                  <div className="skel" style={{height:16,borderRadius:5,marginBottom:8,width:'60%'}} />
                  <div className="skel" style={{height:12,borderRadius:5,marginBottom:5,width:'80%'}} />
                  <div className="skel" style={{height:12,borderRadius:5,width:'50%'}} />
                </div>
              ))}
              {!loadingCust&&!customer?.customer&&<div style={{padding:'24px 0',textAlign:'center',fontSize:12,color:'var(--text-3)'}}>No Shopify data found</div>}
              {!loadingCust&&customer?.customer&&(customer.orders||[]).length===0&&<div style={{padding:'24px 0',textAlign:'center',fontSize:12,color:'var(--text-3)'}}>No orders</div>}

              {/* Order sections — Gorgias style */}
              {(customer?.orders||[]).map((order,oi)=>{
                const isOpen       = expandedOrders[order.id]===undefined ? oi===0 : expandedOrders[order.id]
                const shippingOpen = expandedSubs[`${order.id}_shipping`]===undefined ? true : !!expandedSubs[`${order.id}_shipping`]
                const trackOpen    = expandedSubs[`${order.id}_track`]===undefined ? true : !!expandedSubs[`${order.id}_track`]
                const isCancelled  = order.financialStatus==='cancelled'||order.financialStatus==='voided'
                const isRefunded   = order.financialStatus==='refunded'
                const canRefund    = !isCancelled && !isRefunded
                const canCancel    = !isCancelled
                const finS         = ORDER_STATUS[order.financialStatus?.toLowerCase()]
                const fulS         = ORDER_STATUS[order.fulfillmentStatus?.toLowerCase()]
                const sa           = order.shippingAddress
                return (
                  <div key={order.id} style={{borderBottom:'1px solid var(--border)'}}>

                    {/* ── Order header: row 1 = name + chevron ── */}
                    <button className="rp-order-hdr" onClick={()=>setExpandedOrders(v=>({...v,[order.id]:!isOpen}))}>
                      <span style={{fontSize:13.5,fontWeight:700,color:'var(--accent-text)',flex:1,textAlign:'left'}}>{order.name}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform:isOpen?'rotate(180deg)':'rotate(0)',transition:'transform .2s',color:'var(--text-3)',flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
                    </button>

                    {isOpen&&(
                      <div style={{padding:'0 14px 12px'}}>
                        {/* Row 2: status badges */}
                        <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
                          {finS&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:finS.bg,color:finS.color,letterSpacing:'.05em',textTransform:'uppercase',border:`1px solid ${finS.color}22`}}>{finS.label}</span>}
                          {fulS&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:fulS.bg,color:fulS.color,letterSpacing:'.05em',textTransform:'uppercase',border:`1px solid ${fulS.color}22`}}>{fulS.label}</span>}
                          {order.hasRefund&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:'rgba(248,113,133,0.12)',color:'#fb7185',letterSpacing:'.05em',textTransform:'uppercase',border:'1px solid rgba(248,113,133,0.22)'}}>Partial refund</span>}
                        </div>
                        {/* Row 3: action buttons */}
                        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10}}>
                          <button className="rp-action" onClick={()=>setModal({type:'duplicate',order})}><span style={{display:'flex'}}>{I.copy}</span>Duplicate</button>
                          {canRefund&&<button className="rp-action" onClick={()=>setModal({type:'refund',order})}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.8"/></svg>$ Refund
                          </button>}
                          {canCancel&&<button className="rp-action danger" onClick={()=>setModal({type:'cancel',order})}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Cancel
                          </button>}
                          <button className="rp-action" style={{padding:'4px 7px'}} onClick={()=>setModal({type:'note',order})}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
                          </button>
                        </div>

                        {/* Key-value rows */}
                        <div style={{marginBottom:4}}>
                          <div className="rp-kv"><span className="rp-kv-l">Created</span><span className="rp-kv-v">{new Date(order.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span></div>
                          <div className="rp-kv"><span className="rp-kv-l">Total</span><span className="rp-kv-v" style={{fontWeight:700,color:'var(--text-1)'}}>{fmtPrice(order.totalPrice,order.currency)}</span></div>
                        </div>

                        {/* Tracking — collapsible (default open) */}
                        {(order.fulfillments||[]).length>0&&(
                          <>
                            <button className="rp-subsec" onClick={()=>setExpandedSubs(v=>({...v,[`${order.id}_track`]:!trackOpen}))}>
                              <span style={{display:'flex',color:'var(--text-3)'}}>{I.truck2}</span>
                              <span style={{flex:1,fontWeight:600,fontSize:11.5,color:'var(--text-2)'}}>Tracking</span>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform:trackOpen?'rotate(180deg)':'rotate(0)',transition:'transform .2s',color:'var(--text-3)'}}><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            {trackOpen&&order.fulfillments.slice(0,1).map((f,fi)=>(
                              <div key={fi} style={{paddingBottom:6}}>
                                <div className="rp-kv"><span className="rp-kv-l">Carrier</span><span className="rp-kv-v">{f.trackingCompany||'—'}</span></div>
                                {f.trackingNumber&&<div className="rp-kv"><span className="rp-kv-l">Tracking #</span><span className="rp-kv-v" style={{fontFamily:'monospace',fontSize:10.5}}>{f.trackingNumber}</span></div>}
                                <div className="rp-kv"><span className="rp-kv-l">Status</span><span style={{fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:4,background:'rgba(74,222,128,0.12)',color:'#16a34a',border:'1px solid rgba(74,222,128,0.25)',letterSpacing:'.04em',textTransform:'uppercase'}}>Delivered</span></div>
                                {f.trackingUrl&&<div style={{marginTop:4}}><a href={f.trackingUrl} target="_blank" rel="noreferrer" style={{fontSize:11.5,color:'var(--accent-text)',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3}}>Track package <span style={{display:'flex'}}>{I.externalLink}</span></a></div>}
                              </div>
                            ))}
                          </>
                        )}

                        {/* Shipping address — collapsible (default open) */}
                        {sa&&(
                          <>
                            <button className="rp-subsec" onClick={()=>setExpandedSubs(v=>({...v,[`${order.id}_shipping`]:!shippingOpen}))}>
                              <span style={{display:'flex',color:'var(--text-3)'}}>{I.mappin}</span>
                              <span style={{flex:1,fontWeight:600,fontSize:11.5,color:'var(--text-2)'}}>Shipping address</span>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform:shippingOpen?'rotate(180deg)':'rotate(0)',transition:'transform .2s',color:'var(--text-3)'}}><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            {shippingOpen&&(
                              <div style={{paddingBottom:6}}>
                                <div style={{marginBottom:6}}>
                                  <button onClick={()=>setModal({type:'address',order})} style={{display:'inline-flex',alignItems:'center',gap:4,color:'var(--text-2)',cursor:'pointer',fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:6,border:'1px solid var(--border)',background:'transparent',transition:'all .15s',fontFamily:'inherit'}} onMouseEnter={e=>{e.currentTarget.style.color='var(--text-1)';e.currentTarget.style.borderColor='var(--border-hover)'}} onMouseLeave={e=>{e.currentTarget.style.color='var(--text-2)';e.currentTarget.style.borderColor='var(--border)'}}>
                                    <span style={{display:'flex'}}>{I.edit}</span> Edit
                                  </button>
                                </div>
                                {[sa.firstName||sa.lastName?{l:'Name',v:[sa.firstName,sa.lastName].filter(Boolean).join(' ')}:null, sa.address1?{l:'Address1',v:sa.address1}:null, sa.address2?{l:'Address2',v:sa.address2}:null, sa.city?{l:'City',v:sa.city}:null, sa.country?{l:'Country',v:sa.country}:null, sa.province?{l:'Province',v:sa.province}:null, sa.zip?{l:'Zip',v:sa.zip}:null].filter(Boolean).map(row=>(
                                  <div key={row.l} className="rp-kv"><span className="rp-kv-l">{row.l}</span><span className="rp-kv-v">{row.v}</span></div>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {/* Line items — each item as its own collapsible sub-section */}
                        {(order.lineItems||[]).map((item,ii)=>{
                          const itemKey = `${order.id}_item_${item.id}`
                          const itemOpen = expandedSubs[itemKey]===undefined ? true : !!expandedSubs[itemKey]
                          return (
                            <div key={item.id}>
                              <button className="rp-subsec" onClick={()=>setExpandedSubs(v=>({...v,[itemKey]:!itemOpen}))}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-3)',flexShrink:0}}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                                <span style={{flex:1,fontSize:11,fontWeight:600,color:'var(--text-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.quantity} × {item.title}{item.variantTitle?` · ${item.variantTitle}`:''}</span>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform:itemOpen?'rotate(180deg)':'rotate(0)',transition:'transform .2s',color:'var(--text-3)',flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
                              </button>
                              {itemOpen&&(
                                <div style={{paddingBottom:4}}>
                                  <div className="rp-kv"><span className="rp-kv-l">Amount</span><span className="rp-kv-v">{fmtPrice(Number(item.price)*item.quantity,order.currency)}</span></div>
                                  {item.sku&&<div className="rp-kv"><span className="rp-kv-l">Sku</span><span className="rp-kv-v" style={{fontFamily:'monospace',fontSize:10.5}}>{item.sku}</span></div>}
                                  {item.variantTitle&&<div className="rp-kv"><span className="rp-kv-l">Variant</span><span className="rp-kv-v">{item.variantTitle}</span></div>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Modals ═══════════════ */}
      {modal?.type==='compose'   && <ComposeModal emailProvider={emailProvider} connectedEmail={connectedEmail} token={session.access_token} macros={macros} onClose={()=>setModal(null)} onSuccess={(msg,type)=>{handleModalSuccess(msg,type);loadThreads(session.access_token)}} />}
      {modal?.type==='refund'    && <RefundModal      order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type==='cancel'    && <CancelModal      order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type==='duplicate' && <DuplicateModal   order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type==='address'   && <EditAddressModal order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type==='fulfill'   && <FulfillModal     order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type==='note'      && <NoteModal        order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}

      {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}

      {/* Macro Manager overlay */}
      {showMacroManager&&(
        <MacroManager
          macros={macros}
          favs={macroFavs}
          onClose={()=>setShowMacroManager(false)}
          onSaveMacro={m=>{ saveMacro(m); setToast({msg:'Macro saved',type:'success'}) }}
          onDeleteMacro={id=>{ deleteMacro(id); setToast({msg:'Macro deleted',type:'info'}) }}
          onToggleFav={toggleMacroFav}
        />
      )}
    </div>
  )
}

export default function InboxPageWrapper() {
  return (
    <Suspense fallback={null}>
      <InboxPage />
    </Suspense>
  )
}
