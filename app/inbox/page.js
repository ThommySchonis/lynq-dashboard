'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../components/Sidebar'

// ─── Status configs ───────────────────────────────────────────
const STATUS = {
  open:     { label:'Open',     bg:'rgba(161,117,252,0.15)', color:'#A175FC',  border:'rgba(161,117,252,0.3)'  },
  pending:  { label:'Pending',  bg:'rgba(251,191,36,0.14)',  color:'#fbbf24',  border:'rgba(251,191,36,0.3)'   },
  resolved: { label:'Resolved', bg:'rgba(74,222,128,0.14)',  color:'#4ade80',  border:'rgba(74,222,128,0.3)'   },
  closed:   { label:'Closed',   bg:'rgba(255,255,255,0.07)', color:'rgba(240,236,249,0.35)', border:'rgba(255,255,255,0.1)' },
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
const FALLBACK_MACROS = [
  { id:'greeting', name:'Greeting',        tags:['support'],   body:'Hi {{name}},\n\nThank you for reaching out! I\'m happy to help you.\n\n' },
  { id:'tracking', name:'Tracking Update', tags:['shipping'],  body:'Hi {{name}},\n\nYour order is on its way! You can track it using the link in your shipping confirmation email.\n\nBest regards,\nCustomer Support' },
  { id:'refund',   name:'Refund',          tags:['refund'],    body:'Hi {{name}},\n\nYour refund has been processed. The amount is typically back in your account within 5–7 business days.\n\nBest regards,\nCustomer Support' },
  { id:'delay',    name:'Delay',           tags:['shipping'],  body:'Hi {{name}},\n\nUnfortunately your order is experiencing a delay. We\'ll keep you updated!\n\nBest regards,\nCustomer Support' },
  { id:'quality',  name:'Quality Issue',   tags:['complaint'], body:'Hi {{name}},\n\nWe\'re sorry to hear that! Could you send us a photo? We\'ll arrange a solution right away.\n\nBest regards,\nCustomer Support' },
  { id:'closing',  name:'Closing',         tags:['support'],   body:'Hi {{name}},\n\nGreat to hear! Have a wonderful day!\n\nBest regards,\nCustomer Support' },
  { id:'notfound', name:'Order Not Found', tags:['order'],     body:'Hi {{name}},\n\nI\'m unable to find an order linked to this email address. Could you share your order number?\n\nBest regards,\nCustomer Support' },
  { id:'wrongitem',name:'Wrong Item',      tags:['complaint'], body:'Hi {{name}},\n\nWe\'re sorry about that! Please send us a photo and we\'ll sort it out right away.\n\nBest regards,\nCustomer Support' },
]

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
  @keyframes fadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes slideIn  { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes shimmer  { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes toastIn  { from{opacity:0;transform:translateY(14px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes msgIn    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes modalIn  { from{opacity:0;transform:scale(.95) translateY(14px)} to{opacity:1;transform:scale(1) translateY(0)} }

  .ir * { box-sizing:border-box; margin:0; padding:0; }
  .ir { font-family:var(--font-rethink),-apple-system,BlinkMacSystemFont,'Inter',sans-serif; -webkit-font-smoothing:antialiased; }
  button { border:none; background:none; }
  input,textarea,select { font-family:inherit; }

  /* ── Thread row ── */
  .trow { padding:12px 16px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.035); border-left:2.5px solid transparent; transition:background .15s,border-color .15s; position:relative; }
  .trow:hover:not(.trow-active) { background:rgba(161,117,252,0.045); }
  .trow-active { background:linear-gradient(90deg,rgba(161,117,252,0.13) 0%,rgba(161,117,252,0.04) 100%); border-left-color:#A175FC; }

  /* ── View tabs ── */
  .vtab { padding:8px 12px; background:transparent; cursor:pointer; font-size:12px; font-weight:500; font-family:inherit; border-bottom:2px solid transparent; transition:color .15s,border-color .15s; color:rgba(240,236,249,0.3); white-space:nowrap; letter-spacing:.01em; }
  .vtab.on { color:#A175FC; border-bottom-color:#A175FC; font-weight:700; }
  .vtab:hover:not(.on) { color:rgba(240,236,249,0.6); }

  /* ── Composer tab ── */
  .ctab { padding:9px 14px; background:transparent; cursor:pointer; font-size:12.5px; font-weight:500; font-family:inherit; border-bottom:2px solid transparent; transition:color .15s,border-color .15s; color:rgba(240,236,249,0.32); }
  .ctab.on { color:#F0ECF9; border-bottom-color:#A175FC; font-weight:600; }
  .ctab:hover:not(.on) { color:rgba(240,236,249,0.6); }

  /* ── Scrollbar ── */
  .sscroll::-webkit-scrollbar { width:3px; }
  .sscroll::-webkit-scrollbar-track { background:transparent; }
  .sscroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }

  /* ── Skeleton ── */
  .skel { background:linear-gradient(90deg,rgba(255,255,255,0.035) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.035) 75%); background-size:400% 100%; animation:shimmer 1.8s linear infinite; border-radius:6px; }

  /* ── Status dropdown ── */
  .sdrop { position:absolute; top:calc(100% + 6px); right:0; background:#130a2e; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:5px; z-index:100; min-width:150px; box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04); animation:fadeUp .14s ease both; }
  .sopt  { padding:9px 12px; border-radius:8px; cursor:pointer; font-size:12.5px; font-weight:600; display:flex; align-items:center; gap:8px; transition:background .1s; font-family:inherit; width:100%; text-align:left; }
  .sopt:hover { background:rgba(255,255,255,0.06); }

  /* ── Inbox search ── */
  .isearch { width:100%; padding:9px 12px 9px 34px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:10px; color:#F0ECF9; font-size:12.5px; outline:none; transition:all .2s; }
  .isearch:focus { border-color:rgba(161,117,252,0.4); background:rgba(161,117,252,0.05); box-shadow:0 0 0 3px rgba(161,117,252,0.08); }
  .isearch::placeholder { color:rgba(240,236,249,0.2); }

  /* ── Macro ── */
  .macro-panel { display:flex; border-top:1px solid rgba(255,255,255,0.055); animation:fadeUp .18s ease both; max-height:260px; }
  .macro-list { width:230px; border-right:1px solid rgba(255,255,255,0.055); overflow-y:auto; flex-shrink:0; }
  .macro-item { padding:10px 14px; cursor:pointer; transition:background .12s; border-left:2px solid transparent; }
  .macro-item:hover { background:rgba(255,255,255,0.03); }
  .macro-item.mi-active { background:rgba(161,117,252,0.09); border-left-color:#A175FC; }
  .macro-preview { flex:1; padding:14px 16px; overflow-y:auto; font-size:13px; line-height:1.75; color:rgba(240,236,249,0.65); white-space:pre-wrap; }
  .macro-var { color:#A175FC; background:rgba(161,117,252,0.12); padding:1px 5px; border-radius:4px; font-weight:600; font-size:11px; }
  .macro-suggest { padding:4px 14px 6px; font-size:9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:rgba(240,236,249,0.25); }
  .macro-tag { font-size:10px; font-weight:600; padding:1px 6px; border-radius:4px; background:rgba(255,255,255,0.06); color:rgba(240,236,249,0.35); }

  /* ── Textarea ── */
  .compose-ta { width:100%; resize:none; outline:none; font-family:inherit; background:transparent; border:none; padding:15px 17px; font-size:13.5px; color:#F0ECF9; line-height:1.78; }

  /* ── Compose box ── */
  .compose-box { margin:0 14px 14px; border:1px solid rgba(255,255,255,0.08); border-radius:14px; overflow:hidden; background:rgba(255,255,255,0.022); transition:border-color .2s,box-shadow .2s; }
  .compose-box:focus-within { border-color:rgba(161,117,252,0.32); box-shadow:0 0 0 3px rgba(161,117,252,0.07); }

  /* ── Buttons ── */
  .btn-send { padding:9px 20px; font-size:13px; font-weight:600; font-family:inherit; background:linear-gradient(135deg,#A175FC 0%,#8555e8 100%); color:#fff; border-radius:10px; cursor:pointer; transition:all .2s cubic-bezier(.16,1,.3,1); box-shadow:0 2px 12px rgba(161,117,252,0.4); }
  .btn-send:hover:not(:disabled) { background:linear-gradient(135deg,#B990FF 0%,#9B6FFF 100%); box-shadow:0 6px 22px rgba(161,117,252,0.55); transform:translateY(-1px); }
  .btn-send:active:not(:disabled) { transform:translateY(0); box-shadow:0 2px 8px rgba(161,117,252,0.4); }
  .btn-send:disabled { opacity:.3; cursor:not-allowed; transform:none; box-shadow:none; }
  .btn-ghost { padding:9px 16px; font-size:12.5px; font-weight:500; font-family:inherit; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); color:rgba(240,236,249,0.5); border-radius:10px; cursor:pointer; transition:all .15s; }
  .btn-ghost:hover:not(:disabled) { border-color:rgba(255,255,255,0.2); color:rgba(240,236,249,0.85); background:rgba(255,255,255,0.07); }
  .btn-ghost:disabled { opacity:.3; cursor:not-allowed; }
  .btn-danger { padding:9px 20px; font-size:13px; font-weight:600; font-family:inherit; background:linear-gradient(135deg,rgba(239,68,68,0.92),rgba(220,38,38,0.92)); color:#fff; border-radius:10px; cursor:pointer; transition:all .2s; box-shadow:0 2px 12px rgba(239,68,68,0.3); }
  .btn-danger:hover:not(:disabled) { background:linear-gradient(135deg,#ef4444,#dc2626); box-shadow:0 6px 22px rgba(239,68,68,0.45); transform:translateY(-1px); }
  .btn-danger:active:not(:disabled) { transform:translateY(0); }
  .btn-danger:disabled { opacity:.35; cursor:not-allowed; }
  .btn-iris { padding:8px 15px; font-size:12.5px; font-weight:600; font-family:inherit; background:rgba(161,117,252,0.1); border:1px solid rgba(161,117,252,0.22); color:#A175FC; border-radius:10px; cursor:pointer; transition:all .18s; }
  .btn-iris:hover:not(:disabled) { background:rgba(161,117,252,0.18); border-color:rgba(161,117,252,0.38); transform:translateY(-1px); }
  .btn-iris:disabled { opacity:.35; cursor:not-allowed; }

  /* ── Order card ── */
  .order-card { background:linear-gradient(145deg,rgba(255,255,255,0.042) 0%,rgba(161,117,252,0.018) 100%); border:1px solid rgba(255,255,255,0.08); border-radius:18px; padding:16px 16px 14px; margin-bottom:10px; position:relative; overflow:hidden; transition:border-color .22s,box-shadow .22s; }
  .order-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:linear-gradient(180deg,#A175FC 0%,rgba(161,117,252,0.06) 100%); }
  .order-card::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 60% 40% at 80% 0%,rgba(161,117,252,0.06) 0%,transparent 70%); pointer-events:none; }
  .order-card:hover { border-color:rgba(161,117,252,0.24); box-shadow:0 16px 48px rgba(0,0,0,0.32),0 0 0 1px rgba(161,117,252,0.08),0 0 60px rgba(161,117,252,0.04); }

  /* ── Order actions grid ── */
  .order-actions { display:grid; grid-template-columns:1fr 1fr; gap:6px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.055); margin-top:4px; }
  .oa-btn { padding:8px 10px; display:flex; align-items:center; justify-content:center; gap:6px; font-size:11.5px; font-weight:600; font-family:inherit; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:rgba(240,236,249,0.45); border-radius:10px; cursor:pointer; transition:all .18s cubic-bezier(.16,1,.3,1); white-space:nowrap; }
  .oa-btn:hover { background:rgba(161,117,252,0.12); border-color:rgba(161,117,252,0.28); color:#C3A3FF; transform:translateY(-1px); box-shadow:0 4px 14px rgba(161,117,252,0.18); }
  .oa-btn:active { transform:translateY(0); }
  .oa-btn.oa-danger:hover { background:rgba(239,68,68,0.09); border-color:rgba(239,68,68,0.28); color:#fca5a5; box-shadow:0 4px 14px rgba(239,68,68,0.14); }
  .oa-btn.oa-green:hover { background:rgba(74,222,128,0.09); border-color:rgba(74,222,128,0.28); color:#86efac; }
  .oa-btn svg { flex-shrink:0; opacity:.6; transition:opacity .15s; }
  .oa-btn:hover svg { opacity:1; }

  /* ── Modal ── */
  .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); z-index:500; display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn .2s ease; }
  .modal-box { background:linear-gradient(145deg,rgba(22,11,52,0.99) 0%,rgba(12,6,30,0.99) 100%); border:1px solid rgba(161,117,252,0.22); border-radius:22px; padding:30px; box-shadow:0 48px 120px rgba(0,0,0,0.8),0 0 0 1px rgba(161,117,252,0.1),0 0 100px rgba(161,117,252,0.05); width:100%; max-width:560px; animation:modalIn .24s cubic-bezier(.16,1,.3,1); max-height:88vh; display:flex; flex-direction:column; overflow:hidden; }
  .modal-body { overflow-y:auto; flex:1; }
  .modal-body::-webkit-scrollbar { width:3px; }
  .modal-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
  .modal-input { width:100%; background:rgba(255,255,255,0.055); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:11px 14px; font-size:13.5px; color:#F0ECF9; outline:none; transition:border-color .2s,box-shadow .2s; font-family:inherit; }
  .modal-input:focus { border-color:rgba(161,117,252,0.5); box-shadow:0 0 0 3px rgba(161,117,252,0.1); }
  .modal-input::placeholder { color:rgba(240,236,249,0.22); }
  .modal-select { width:100%; background:rgba(255,255,255,0.055); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:11px 14px; font-size:13.5px; color:#F0ECF9; outline:none; font-family:inherit; cursor:pointer; }
  .modal-select option { background:#130a2e; }
  .modal-label { font-size:10.5px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:rgba(240,236,249,0.35); margin-bottom:7px; display:block; }
  .modal-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .chk-row { display:flex; align-items:center; gap:9px; cursor:pointer; user-select:none; }
  .chk-box { width:18px; height:18px; border-radius:5px; border:1.5px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .15s; }
  .chk-box.chk-on { background:#A175FC; border-color:#A175FC; box-shadow:0 0 12px rgba(161,117,252,0.45); }
  .li-row { display:flex; align-items:center; gap:12px; padding:11px 0; border-bottom:1px solid rgba(255,255,255,0.055); }
  .li-row:last-child { border-bottom:none; }
  .qty-btn { width:28px; height:28px; border-radius:7px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1); color:rgba(240,236,249,0.7); font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; flex-shrink:0; }
  .qty-btn:hover:not(:disabled) { background:rgba(161,117,252,0.18); border-color:rgba(161,117,252,0.35); color:#A175FC; }
  .qty-btn:disabled { opacity:.3; cursor:not-allowed; }

  /* ── Info grid ── */
  .info-label { font-size:10px; font-weight:700; color:rgba(240,236,249,0.28); letter-spacing:.07em; text-transform:uppercase; }
  .info-val   { font-size:12.5px; color:rgba(240,236,249,0.78); margin-top:2px; line-height:1.5; }
  .stat-card  { background:rgba(255,255,255,0.038); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:12px 14px; transition:border-color .15s; }
  .stat-card:hover { border-color:rgba(161,117,252,0.18); }

  /* ── Tracking ── */
  .track-pill { display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:600; padding:3px 9px; border-radius:100px; }

  /* ── Urgency badges ── */
  .urg-pill { display:inline-flex; align-items:center; gap:4px; font-size:9px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; padding:2px 7px; border-radius:100px; }
  .urg-dot  { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
  @keyframes urgPulse { 0%,100%{opacity:1} 50%{opacity:.45} }
  .urg-critical .urg-dot { animation:urgPulse 1.6s ease-in-out infinite; }

  @media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
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
}

// ─── Helpers ─────────────────────────────────────────────────
function extractEmail(s) { if (!s) return ''; const m=s.match(/<(.+?)>/); return m?m[1]:s.trim() }
function extractName(s)  { if (!s) return 'Unknown'; const m=s.match(/^([^<]+)/); return m?m[1].trim().replace(/"/g,''):s }
function formatDate(s)   { if (!s) return ''; const d=new Date(s),now=new Date(),diff=now-d; if(diff<86400000) return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); if(diff<604800000) return d.toLocaleDateString([],{weekday:'short'}); return d.toLocaleDateString([],{month:'short',day:'numeric'}) }
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
  const s=ORDER_STATUS[status?.toLowerCase()]||{bg:'rgba(255,255,255,0.07)',color:'rgba(240,236,249,0.4)',label:status}
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

function StatusMenu({ current, onChange, onClose }) {
  const ref=useRef(null)
  useEffect(()=>{ function h(e){if(ref.current&&!ref.current.contains(e.target))onClose()} document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h) },[onClose])
  return (
    <div ref={ref} className="sdrop">
      {Object.entries(STATUS).map(([k,s])=>(
        <button key={k} className="sopt" onClick={()=>{onChange(k);onClose()}} style={{color:s.color}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0}} />
          {s.label}
          {current===k&&<span style={{marginLeft:'auto',fontSize:10,color:'rgba(255,255,255,0.4)'}}>✓</span>}
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
      <span style={{fontSize:13,color:'rgba(240,236,249,0.7)'}}>{label}</span>
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
          <span style={{fontSize:17,fontWeight:700,color:'#F0ECF9',letterSpacing:'-0.01em'}}>{title}</span>
          <button onClick={onClose} style={{color:'rgba(240,236,249,0.35)',cursor:'pointer',display:'flex',padding:4,borderRadius:6,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='rgba(240,236,249,0.7)'} onMouseLeave={e=>e.currentTarget.style.color='rgba(240,236,249,0.35)'}>{I.close}</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div style={{paddingTop:20,borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:10,justifyContent:'flex-end',flexShrink:0,marginTop:20}}>{footer}</div>}
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
      <div style={{display:'flex',gap:5,marginBottom:18,padding:'4px',background:'rgba(255,255,255,0.04)',borderRadius:11,border:'1px solid rgba(255,255,255,0.07)'}}>
        {MODES.map(o=>(
          <button key={o.v} onClick={()=>setMode(o.v)} style={{flex:1,padding:'8px 10px',borderRadius:8,fontSize:12,fontWeight:600,fontFamily:'inherit',cursor:'pointer',transition:'all .15s',background:mode===o.v?'rgba(161,117,252,0.2)':'transparent',color:mode===o.v?'#C3A3FF':'rgba(240,236,249,0.35)',border:mode===o.v?'1px solid rgba(161,117,252,0.35)':'1px solid transparent',boxShadow:mode===o.v?'0 2px 8px rgba(161,117,252,0.15)':'none'}}>{o.l}</button>
        ))}
      </div>

      {/* Custom amount input */}
      {mode==='custom'&&(
        <div style={{marginBottom:18}}>
          <label className="modal-label">Refund amount</label>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:14,fontWeight:700,color:'rgba(240,236,249,0.4)',pointerEvents:'none'}}>€</span>
            <input type="number" className="modal-input" style={{paddingLeft:28}} value={customAmount} onChange={e=>setCustomAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" max={order.totalPrice} autoFocus />
          </div>
          {Number(customAmount)>0&&(
            <div style={{marginTop:8,fontSize:12,color:'rgba(240,236,249,0.4)'}}>
              Max: <span style={{color:'rgba(240,236,249,0.65)',fontWeight:600}}>{fmtPrice(order.totalPrice,order.currency)}</span>
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
                <div style={{fontSize:13,fontWeight:600,color:'#F0ECF9'}}>{li.title}</div>
                {li.variantTitle&&<div style={{fontSize:11.5,color:'rgba(240,236,249,0.4)'}}>{li.variantTitle}</div>}
              </div>
              <span style={{fontSize:12.5,color:'rgba(240,236,249,0.6)',minWidth:60,textAlign:'right'}}>{fmtPrice(li.price,order.currency)}</span>
              <div style={{display:'flex',alignItems:'center',gap:6,minWidth:80,justifyContent:'center'}}>
                <button className="qty-btn" onClick={()=>setQtys(q=>({...q,[li.id]:Math.max(0,q[li.id]-1)}))} disabled={!qtys[li.id]||mode==='full'}>−</button>
                <span style={{fontSize:13,fontWeight:600,color:'#F0ECF9',minWidth:20,textAlign:'center'}}>{qtys[li.id]}</span>
                <button className="qty-btn" onClick={()=>setQtys(q=>({...q,[li.id]:Math.min(li.quantity,q[li.id]+1)}))} disabled={qtys[li.id]>=li.quantity||mode==='full'}>+</button>
                <span style={{fontSize:11,color:'rgba(240,236,249,0.3)'}}>/{li.quantity}</span>
              </div>
              <span style={{fontSize:13,fontWeight:700,color:'#F0ECF9',minWidth:60,textAlign:'right'}}>{fmtPrice((qtys[li.id]||0)*Number(li.price),order.currency)}</span>
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

      <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'13px 15px'}}>
        <div style={{display:'flex',justifyContent:'space-between',paddingTop:0}}>
          <span style={{fontSize:14,fontWeight:700,color:'#F0ECF9'}}>Refund total</span>
          <span style={{fontSize:15,fontWeight:800,color: totalRefund>0?'#4ade80':'rgba(240,236,249,0.3)'}}>{fmtPrice(totalRefund,order.currency)}</span>
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
      <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,padding:'10px 14px',marginBottom:14}}>
        {(order.lineItems||[]).map(li=>(
          <div key={li.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
            <span style={{fontSize:12.5,color:'rgba(240,236,249,0.7)'}}>{li.quantity}× {li.title}{li.variantTitle?` · ${li.variantTitle}`:''}</span>
            <span style={{fontSize:12.5,color:'rgba(240,236,249,0.5)'}}>{fmtPrice(Number(li.price)*li.quantity,order.currency)}</span>
          </div>
        ))}
        <div style={{display:'flex',justifyContent:'space-between',paddingTop:8,marginTop:4}}>
          <span style={{fontSize:12.5,color:'rgba(240,236,249,0.45)'}}>Original</span>
          <span style={{fontSize:13,fontWeight:700,color:'#F0ECF9'}}>{fmtPrice(originalTotal,order.currency)}</span>
        </div>
      </div>

      {/* Discount section */}
      <div style={{marginBottom:14}}>
        <label className="modal-label">Discount</label>
        <div style={{display:'flex',gap:6,marginBottom:discountType!=='none'?10:0}}>
          {[{v:'none',l:'None'},{v:'percentage',l:'Percentage %'},{v:'fixed',l:'Fixed amount'}].map(o=>(
            <button key={o.v} onClick={()=>{setDiscountType(o.v);setDiscountValue('')}} style={{flex:1,padding:'7px 8px',borderRadius:8,fontSize:11.5,fontWeight:600,fontFamily:'inherit',cursor:'pointer',transition:'all .15s',background:discountType===o.v?'rgba(161,117,252,0.18)':'rgba(255,255,255,0.04)',color:discountType===o.v?'#A175FC':'rgba(240,236,249,0.4)',border:discountType===o.v?'1px solid rgba(161,117,252,0.3)':'1px solid rgba(255,255,255,0.07)'}}>{o.l}</button>
          ))}
        </div>
        {discountType!=='none'&&(
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <input type="number" className="modal-input" style={{flex:1}} value={discountValue} onChange={e=>setDiscountValue(e.target.value)} placeholder={discountType==='percentage'?'e.g. 10':'e.g. 5.00'} min="0" max={discountType==='percentage'?100:undefined} />
            <span style={{fontSize:12.5,fontWeight:700,color:'rgba(240,236,249,0.5)',flexShrink:0}}>{discountType==='percentage'?'%':'€'}</span>
          </div>
        )}
      </div>

      {/* New total preview */}
      {discountType!=='none'&&Number(discountValue)>0&&(
        <div style={{background:'rgba(161,117,252,0.06)',border:'1px solid rgba(161,117,252,0.15)',borderRadius:10,padding:'10px 14px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:11,color:'rgba(240,236,249,0.35)',marginBottom:2}}>Discount</div>
            <div style={{fontSize:12.5,fontWeight:700,color:'#fb7185'}}>− {fmtPrice(discountAmount,order.currency)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:'rgba(240,236,249,0.35)',marginBottom:2}}>New total</div>
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

// ─── Macro Panel ──────────────────────────────────────────────
function MacroPanel({ macros, aiMacros, onInsert, onClose, customerName }) {
  const [search, setSearch]   = useState('')
  const [selected, setSelected] = useState(null)
  const searchRef = useRef(null)
  useEffect(()=>{ searchRef.current?.focus() },[])
  useEffect(()=>{ function h(e){if(e.key==='Escape')onClose()} document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h) },[onClose])

  const filtered = macros.filter(m=>!search||(m.name+m.body+(m.tags||[]).join('')).toLowerCase().includes(search.toLowerCase()))
  const active = selected || filtered[0] || null

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
    <div style={{borderTop:'1px solid rgba(255,255,255,0.055)',animation:'fadeUp .18s ease both'}}>
      {/* Search row */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',borderBottom:'1px solid rgba(255,255,255,0.055)',background:'rgba(255,255,255,0.02)'}}>
        <span style={{color:'#A175FC',display:'flex',flexShrink:0}}>{I.lightning}</span>
        <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search macros by name, tag or content…" style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:12.5,color:'rgba(240,236,249,0.7)',fontFamily:'inherit'}} />
        {aiMacros?.length>0 && <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,background:'rgba(161,117,252,0.15)',color:'#A175FC',letterSpacing:'.04em',flexShrink:0}}>AI ✦</span>}
        <button onClick={onClose} style={{color:'rgba(240,236,249,0.3)',cursor:'pointer',display:'flex',padding:3,borderRadius:5,transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='rgba(240,236,249,0.7)'} onMouseLeave={e=>e.currentTarget.style.color='rgba(240,236,249,0.3)'}>{I.close}</button>
      </div>
      {/* Two-panel */}
      <div className="macro-panel">
        {/* List */}
        <div className="macro-list sscroll">
          {aiMacros?.length>0 && (
            <>
              <div className="macro-suggest">AI suggestions ✦</div>
              {aiMacros.map(m=>(
                <div key={m.id} className={`macro-item${active?.id===m.id?' mi-active':''}`} onClick={()=>setSelected(m)} onDoubleClick={()=>applyMacro(m)}>
                  <div style={{fontSize:12.5,fontWeight:600,color:active?.id===m.id?'#A175FC':'rgba(240,236,249,0.8)',marginBottom:3}}>{m.name}</div>
                </div>
              ))}
              <div style={{height:1,background:'rgba(255,255,255,0.06)',margin:'4px 0'}} />
            </>
          )}
          {filtered.length===0 && <div style={{padding:'20px 14px',fontSize:12,color:'rgba(240,236,249,0.25)',textAlign:'center'}}>No macros found</div>}
          {filtered.map(m=>(
            <div key={m.id} className={`macro-item${active?.id===m.id?' mi-active':''}`} onClick={()=>setSelected(m)} onDoubleClick={()=>applyMacro(m)}>
              <div style={{fontSize:12.5,fontWeight:600,color:active?.id===m.id?'#A175FC':'rgba(240,236,249,0.8)',marginBottom:3}}>{m.name}</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {(m.tags||[]).map(t=><span key={t} className="macro-tag">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
        {/* Preview */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {active ? (
            <>
              <div className="macro-preview sscroll">{renderPreview(active.body)}</div>
              <div style={{padding:'10px 14px',borderTop:'1px solid rgba(255,255,255,0.055)',display:'flex',justifyContent:'flex-end',gap:8,flexShrink:0}}>
                <button className="btn-ghost" style={{fontSize:11.5,padding:'6px 12px'}} onClick={()=>setSelected(null)}>Close</button>
                <button className="btn-send" style={{fontSize:11.5,padding:'6px 14px'}} onClick={()=>applyMacro(active)}>Insert</button>
              </div>
            </>
          ) : (
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(240,236,249,0.2)',fontSize:12.5}}>Select a macro to preview</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function InboxPage() {
  const [session, setSession]         = useState(null)
  const [threads, setThreads]         = useState([])
  const [view, setView]               = useState('all')
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
  const [demoMode, setDemoMode]       = useState(false)
  const [customer, setCustomer]       = useState(null)
  const [loadingCust, setLoadingCust] = useState(false)
  const [rightTab, setRightTab]       = useState('shopify')
  const [statusMenu, setStatusMenu]   = useState(false)
  const [statuses, setStatuses]       = useState(()=>{ try{return JSON.parse(localStorage.getItem('lynq_statuses')||'{}')}catch{return{}} })
  // Macros
  const [macros, setMacros]           = useState(FALLBACK_MACROS)
  const [aiMacros, setAiMacros]       = useState([])
  const [showMacros, setShowMacros]   = useState(false)
  // Order modals
  const [modal, setModal]             = useState(null) // { type:'refund'|'cancel'|'duplicate'|'address', order }
  // AI triage
  const [analyses, setAnalyses]       = useState({})

  const msgEnd    = useRef(null)
  const replyRef  = useRef(null)

  // ── Auth + load ──
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(!session){window.location.href='/login';return}
      setSession(session)
      loadThreads(session.access_token)
      loadMacros(session.access_token)
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
    const res  = await authFetch('/api/gmail/threads',{},token)
    const data = await res.json()
    if(data.connected===false){
      setGmailOk(false); setDemoMode(true)
      setThreads(DEMO_THREADS); setLT(false)
      analyzeThreads(DEMO_THREADS, token)
      return
    }
    setGmailOk(true); setDemoMode(false)
    const thr = data.threads||[]
    setThreads(thr)
    setLT(false)
    analyzeThreads(thr, token)
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
    if(demoMode || thread.id?.startsWith('demo-')) {
      setTimeout(()=>{ setMessages(DEMO_MESSAGES[thread.id]||[]); setLM(false); setCustomer(DEMO_CUSTOMER[thread.id]||null); setThreads(p=>p.map(t=>t.id===thread.id?{...t,unread:false}:t)) }, 400)
      return
    }
    const res  = await authFetch(`/api/gmail/thread/${thread.id}`,{},session.access_token)
    const data = await res.json()
    setMessages(data.messages||[])
    setLM(false)
    if(thread.unread){ authFetch(`/api/gmail/thread/${thread.id}`,{method:'PATCH'},session.access_token); setThreads(p=>p.map(t=>t.id===thread.id?{...t,unread:false}:t)) }
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
    }
  }

  async function handleAiReply() {
    if(!messages.length) return
    setAiLoading(true)
    const res  = await authFetch('/api/ai/reply',{method:'POST',body:JSON.stringify({messages,threadId:selected.id})},session.access_token)
    const data = await res.json()
    if(data.reply) setReply(data.reply)
    else showT('AI reply failed','error')
    setAiLoading(false)
  }

  async function handleSend() {
    if(!reply.trim()||!selected) return
    if(demoMode){ showT('Demo mode — connect Gmail to send messages','error'); return }
    setSending(true)
    const last=messages[messages.length-1]
    const res=await authFetch('/api/gmail/send',{method:'POST',body:JSON.stringify({to:extractEmail(last?.from||selected.from),subject:`Re: ${selected.subject}`,body:reply,threadId:selected.id,replyToMessageId:last?.id})},session.access_token)
    const data=await res.json()
    if(data.success){showT('Message sent!','success');setReply('');loadThreads(session.access_token)}
    else showT(data.error||'Failed to send','error')
    setSending(false)
  }

  async function handleSendResolve() { await handleSend(); if(selected) saveStatus(selected.id,'resolved') }

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

  const VIEWS = [{id:'all',label:'All'},{id:'open',label:'Open'},{id:'pending',label:'Pending'},{id:'resolved',label:'Resolved'}]

  // ── Render ──
  return (
    <div className="ir" style={{display:'flex',height:'100vh',background:'#080518',overflow:'hidden'}}>
      <style>{CSS}</style>
      <Sidebar />

      {/* ═══════════════ LEFT: Thread list ═══════════════ */}
      <div style={{width:300,borderRight:'1px solid rgba(255,255,255,0.05)',display:'flex',flexDirection:'column',flexShrink:0,background:'rgba(255,255,255,0.015)'}}>

        {/* Header */}
        <div style={{padding:'14px 14px 0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:15,fontWeight:700,color:'#F0ECF9',letterSpacing:'-0.01em'}}>Inbox</span>
              <span title="Shortcuts: j/k navigate · r reply" style={{fontSize:9.5,color:'rgba(240,236,249,0.2)',background:'rgba(255,255,255,0.06)',padding:'2px 6px',borderRadius:4,cursor:'default'}}>j/k/r</span>
            </div>
            <button onClick={()=>loadThreads(session.access_token)} style={{background:'transparent',color:'rgba(240,236,249,0.32)',cursor:'pointer',display:'flex',padding:5,borderRadius:7,transition:'all .15s'}} onMouseEnter={e=>{e.currentTarget.style.color='rgba(240,236,249,0.7)';e.currentTarget.style.background='rgba(255,255,255,0.06)'}} onMouseLeave={e=>{e.currentTarget.style.color='rgba(240,236,249,0.32)';e.currentTarget.style.background='transparent'}} title="Refresh">{I.refresh}</button>
          </div>

          {/* Search */}
          <div style={{position:'relative',marginBottom:10}}>
            <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'rgba(240,236,249,0.25)',pointerEvents:'none',display:'flex'}}>{I.search}</span>
            <input className="isearch" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search threads…" />
          </div>

          {/* View tabs */}
          <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.055)'}}>
            {VIEWS.map(v=>(
              <button key={v.id} className={`vtab${view===v.id?' on':''}`} onClick={()=>setView(v.id)}>
                {v.label}
                {counts[v.id]>0&&<span style={{marginLeft:4,background:view===v.id?'rgba(161,117,252,0.2)':'rgba(255,255,255,0.08)',color:view===v.id?'#A175FC':'rgba(240,236,249,0.3)',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:100}}>{counts[v.id]}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Thread list */}
        <div className="sscroll" style={{flex:1,overflowY:'auto'}}>
          {demoMode&&(
            <div style={{margin:'10px 10px 4px',padding:'8px 12px',background:'rgba(251,191,36,0.07)',border:'1px solid rgba(251,191,36,0.22)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
              <span style={{fontSize:11,fontWeight:600,color:'rgba(251,191,36,0.85)'}}>Demo mode</span>
              <a href="/settings" style={{fontSize:10.5,fontWeight:700,color:'#A175FC',textDecoration:'none',flexShrink:0}}>Connect →</a>
            </div>
          )}
          {loadingThreads&&[0,1,2,3,4].map(i=>(
            <div key={i} style={{padding:'12px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',gap:10,opacity:1-i*.16}}>
              <div className="skel" style={{width:34,height:34,borderRadius:'50%',flexShrink:0}} />
              <div style={{flex:1,display:'flex',flexDirection:'column',gap:7}}>
                <div className="skel" style={{height:11,width:'65%'}} />
                <div className="skel" style={{height:10,width:'85%'}} />
                <div className="skel" style={{height:9,width:'50%'}} />
              </div>
            </div>
          ))}
          {!loadingThreads&&sortedFiltered.length===0&&gmailOk&&<div style={{padding:'40px 20px',textAlign:'center',color:'rgba(240,236,249,0.25)',fontSize:12.5}}>No threads in this view</div>}
          {sortedFiltered.map(thread=>{
            const active=selected?.id===thread.id
            const name=extractName(thread.from)
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
                style={!active&&urgUI?{borderLeftColor:urgUI.border}:{}}
                onClick={()=>openThread(thread)}>
                <div style={{display:'flex',gap:10}}>
                  <div style={{position:'relative',flexShrink:0}}>
                    <Avatar name={name} size={33} />
                    {thread.unread&&<span style={{position:'absolute',top:0,right:0,width:8,height:8,borderRadius:'50%',background:'#A175FC',border:'1.5px solid #0D0719',boxShadow:'0 0 6px rgba(161,117,252,0.6)'}} />}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
                      <span style={{fontSize:12.5,fontWeight:thread.unread?700:500,color:thread.unread?'#F0ECF9':'rgba(240,236,249,0.7)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:145}}>{name}</span>
                      <span style={{fontSize:10,color:'rgba(240,236,249,0.28)',flexShrink:0,marginLeft:4}}>{formatDate(thread.date)}</span>
                    </div>
                    <div style={{fontSize:11.5,color:thread.unread?'rgba(240,236,249,0.7)':'rgba(240,236,249,0.4)',fontWeight:thread.unread?600:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:3}}>{thread.subject}</div>
                    <div style={{fontSize:10.5,color:'rgba(240,236,249,0.25)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:5}}>{thread.snippet}</div>
                    <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                      {analysis&&urg&&urg!=='low'&&(
                        <span className={`urg-pill urg-${urg}`} style={{background:urgUI.bg,color:urgUI.color,border:`1px solid ${urgUI.border}`}}>
                          <span className="urg-dot" style={{background:urgUI.color}} />
                          {analysis.intent}
                        </span>
                      )}
                      {analysis&&urg==='low'&&(
                        <span style={{fontSize:9.5,color:'rgba(240,236,249,0.28)',fontWeight:600}}>{analysis.intent}</span>
                      )}
                      <TicketBadge status={status} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══════════════ CENTER: Conversation ═══════════════ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>
        {!selected?(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,color:'rgba(240,236,249,0.15)'}}>
            <div style={{opacity:.4}}>{I.mail}</div>
            <div style={{fontSize:13}}>Select a thread to read</div>
            <div style={{fontSize:11,color:'rgba(240,236,249,0.1)'}}>j / k navigate · r reply</div>
          </div>
        ):(
          <>
            {/* Ticket header */}
            <div style={{padding:'12px 20px',borderBottom:'1px solid rgba(255,255,255,0.055)',flexShrink:0,background:'rgba(255,255,255,0.018)'}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#F0ECF9',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2,letterSpacing:'-0.01em'}}>{selected.subject}</div>
                  <div style={{fontSize:11.5,color:'rgba(240,236,249,0.38)'}}>{extractName(selected.from)} · {messages.length} message{messages.length!==1?'s':''}</div>
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                  {/* Status dropdown */}
                  <div style={{position:'relative'}}>
                    <button onClick={()=>setStatusMenu(s=>!s)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background:'rgba(255,255,255,0.055)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,color:'rgba(240,236,249,0.75)',fontFamily:'inherit',transition:'all .15s'}} onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'} onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'}>
                      <span style={{width:7,height:7,borderRadius:'50%',background:STATUS[getStatus(selected.id)]?.color,flexShrink:0}} />
                      {STATUS[getStatus(selected.id)]?.label}
                      {I.chevron}
                    </button>
                    {statusMenu&&<StatusMenu current={getStatus(selected.id)} onChange={s=>saveStatus(selected.id,s)} onClose={()=>setStatusMenu(false)} />}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="sscroll" style={{flex:1,overflowY:'auto',padding:'20px 24px 12px'}}>
              {loadingMsgs&&[0,1].map(i=>(
                <div key={i} style={{display:'flex',gap:10,flexDirection:i%2===0?'row':'row-reverse',marginBottom:14,animation:`fadeUp .3s ease ${i*.1}s both`}}>
                  <div className="skel" style={{width:28,height:28,borderRadius:'50%',flexShrink:0}} />
                  <div className="skel" style={{height:64,width:'60%',borderRadius:12}} />
                </div>
              ))}
              {messages.map((msg,idx)=>{
                const isAgent=msg.from?.toLowerCase().includes(session.user.email?.split('@')[0]?.toLowerCase()||'')
                const isNote=msg.isNote
                const name=extractName(msg.from)
                return (
                  <div key={msg.id||idx} style={{marginBottom:14,display:'flex',gap:10,flexDirection:isAgent?'row-reverse':'row',animation:'msgIn .28s ease both'}}>
                    {!isNote&&<Avatar name={name} size={28} />}
                    <div style={{maxWidth:'74%'}}>
                      <div style={{fontSize:10.5,color:'rgba(240,236,249,0.3)',marginBottom:4,textAlign:isAgent?'right':'left'}}>
                        <span style={{color:'rgba(240,236,249,0.55)',fontWeight:600}}>{name}</span>
                        <span style={{marginLeft:6}}>{formatDate(msg.date)}</span>
                      </div>
                      <div style={{background:isNote?'rgba(251,191,36,0.07)':isAgent?'rgba(161,117,252,0.14)':'rgba(255,255,255,0.05)',border:`1px solid ${isNote?'rgba(251,191,36,0.22)':isAgent?'rgba(161,117,252,0.22)':'rgba(255,255,255,0.07)'}`,borderRadius:isAgent?'14px 4px 14px 14px':'4px 14px 14px 14px',borderLeft:isNote?'3px solid rgba(251,191,36,0.45)':undefined,padding:'12px 15px',fontSize:13.5,lineHeight:1.72,color:'rgba(240,236,249,0.85)',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
                        {isNote&&<div style={{fontSize:10,fontWeight:700,color:'rgba(251,191,36,0.7)',letterSpacing:'.07em',textTransform:'uppercase',marginBottom:6}}>Internal note</div>}
                        {msg.body||msg.snippet}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={msgEnd} />
            </div>

            {/* Composer */}
            <div style={{borderTop:'1px solid rgba(255,255,255,0.055)',flexShrink:0,background:'rgba(255,255,255,0.01)'}}>
              {/* Macro panel */}
              {showMacros&&(
                <MacroPanel
                  macros={macros}
                  aiMacros={aiMacros}
                  customerName={extractName(selected?.from||'')}
                  onInsert={body=>{setReply(body);setShowMacros(false);setTimeout(()=>replyRef.current?.focus(),10)}}
                  onClose={()=>setShowMacros(false)}
                />
              )}

              {/* Composer tabs */}
              {!showMacros&&(
                <>
                  <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.045)',paddingLeft:16,justifyContent:'space-between',alignItems:'center',paddingRight:14}}>
                    <div style={{display:'flex'}}>
                      {[{id:'reply',label:'Reply'},{id:'note',label:'Internal note'}].map(t=>(
                        <button key={t.id} className={`ctab${composerTab===t.id?' on':''}`} onClick={()=>setComposerTab(t.id)}>{t.label}</button>
                      ))}
                    </div>
                    {/* Macro trigger button */}
                    <button onClick={()=>setShowMacros(true)} title="Macros (⌘M)" style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',background:'transparent',border:'1px solid rgba(255,255,255,0.08)',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:600,color:'rgba(240,236,249,0.4)',transition:'all .15s',fontFamily:'inherit'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(161,117,252,0.3)';e.currentTarget.style.color='#A175FC';e.currentTarget.style.background='rgba(161,117,252,0.08)'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.08)';e.currentTarget.style.color='rgba(240,236,249,0.4)';e.currentTarget.style.background='transparent'}}>
                      <span style={{display:'flex'}}>{I.lightning}</span>
                      Macros
                      {aiMacros.length>0&&<span style={{background:'rgba(161,117,252,0.2)',color:'#A175FC',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4}}>AI</span>}
                    </button>
                  </div>

                  <div className="compose-box">
                    <textarea
                      ref={replyRef}
                      value={reply}
                      onChange={e=>setReply(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey))handleSend()}}
                      placeholder={composerTab==='reply'?'Write a reply… (⌘+Enter to send)':'Internal note — not visible to customer…'}
                      rows={4}
                      className="compose-ta"
                      style={{background:composerTab==='note'?'rgba(251,191,36,0.035)':'transparent',borderBottom:`1px solid ${composerTab==='note'?'rgba(251,191,36,0.15)':'rgba(255,255,255,0.05)'}`}}
                    />
                    <div style={{padding:'10px 14px 12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <button className="btn-iris" onClick={handleAiReply} disabled={aiLoading||!messages.length} style={{display:'flex',alignItems:'center',gap:6}}>
                        {aiLoading?<Spinner />:I.ai}
                        {aiLoading?'Generating…':'AI Reply'}
                      </button>
                      <div style={{display:'flex',gap:7}}>
                        <button className="btn-ghost" onClick={handleSendResolve} disabled={!reply.trim()||sending}>Send & Close</button>
                        <button className="btn-send" onClick={handleSend} disabled={!reply.trim()||sending} style={{display:'flex',alignItems:'center',gap:6}}>
                          {sending?<Spinner white />:I.send}
                          {sending?'Sending…':'Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ═══════════════ RIGHT: Customer panel ═══════════════ */}
      {selected&&(
        <div className="sscroll" style={{width:320,borderLeft:'1px solid rgba(255,255,255,0.055)',display:'flex',flexDirection:'column',flexShrink:0,overflowY:'auto',background:'rgba(255,255,255,0.012)'}}>

          {/* Customer header */}
          <div style={{padding:'16px 16px 12px',borderBottom:'1px solid rgba(255,255,255,0.055)',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <Avatar name={customer?.customer?`${customer.customer.firstName||''} ${customer.customer.lastName||''}`.trim()||extractName(selected.from):extractName(selected.from)} size={38} />
              <div style={{minWidth:0}}>
                <div style={{fontSize:13.5,fontWeight:700,color:'#F0ECF9',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {customer?.customer?`${customer.customer.firstName||''} ${customer.customer.lastName||''}`.trim()||extractName(selected.from):extractName(selected.from)}
                </div>
                <div style={{fontSize:11,color:'rgba(240,236,249,0.35)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{extractEmail(selected.from)}</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{display:'flex',gap:4}}>
              {[{id:'info',label:'Customer'},{id:'shopify',label:'Orders'}].map(t=>(
                <button key={t.id} onClick={()=>setRightTab(t.id)} style={{flex:1,padding:'6px 8px',borderRadius:8,fontSize:11.5,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:rightTab===t.id?'rgba(161,117,252,0.14)':'rgba(255,255,255,0.04)',color:rightTab===t.id?'#A175FC':'rgba(240,236,249,0.38)',border:rightTab===t.id?'1px solid rgba(161,117,252,0.25)':'1px solid transparent',cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
                  {t.label}
                  {t.id==='shopify'&&(customer?.orders||[]).length>0&&<span style={{background:'rgba(161,117,252,0.2)',color:'#A175FC',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4}}>{customer.orders.length}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Info tab */}
          {rightTab==='info'&&(
            <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
              <div><div className="info-label">Email</div><div className="info-val">{extractEmail(selected.from)}</div></div>
              {loadingCust&&[0,1,2].map(i=><div key={i} className="skel" style={{height:28,borderRadius:8}} />)}
              {customer?.customer&&!loadingCust&&(
                <>
                  {customer.customer.phone&&<div><div className="info-label">Phone</div><div className="info-val">{customer.customer.phone}</div></div>}
                  {(customer.customer.city||customer.customer.country)&&<div><div className="info-label">Location</div><div className="info-val">{[customer.customer.city,customer.customer.country].filter(Boolean).join(', ')}</div></div>}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
                    <div className="stat-card"><div style={{fontSize:20,fontWeight:800,color:'#F0ECF9',marginBottom:2}}>{customer.customer.ordersCount??'—'}</div><div className="info-label">Orders</div></div>
                    <div className="stat-card"><div style={{fontSize:16,fontWeight:800,color:'#4ade80',marginBottom:2}}>{fmtPrice(customer.customer.totalSpent,customer.customer.currency)}</div><div className="info-label">Spent</div></div>
                  </div>
                  {customer.customer.note&&<div><div className="info-label">Note</div><div className="info-val" style={{fontSize:12,fontStyle:'italic'}}>{customer.customer.note}</div></div>}
                  {customer.customer.tags&&<div>
                    <div className="info-label" style={{marginBottom:5}}>Tags</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {customer.customer.tags.split(',').filter(Boolean).map(tag=><span key={tag} style={{fontSize:10.5,fontWeight:600,padding:'2px 8px',borderRadius:100,background:'rgba(161,117,252,0.12)',color:'#A175FC',border:'1px solid rgba(161,117,252,0.22)'}}>{tag.trim()}</span>)}
                    </div>
                  </div>}
                  {customer.customer.createdAt&&<div><div className="info-label">Customer since</div><div className="info-val">{new Date(customer.customer.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div></div>}
                </>
              )}
              {!customer?.customer&&!loadingCust&&<div style={{padding:'16px 0',textAlign:'center',fontSize:12,color:'rgba(240,236,249,0.25)'}}>No Shopify customer found</div>}
            </div>
          )}

          {/* Orders tab */}
          {rightTab==='shopify'&&(
            <div style={{padding:'12px'}}>
              {loadingCust&&[0,1].map(i=><div key={i} className="skel" style={{height:120,borderRadius:14,marginBottom:10}} />)}
              {!loadingCust&&!customer?.customer&&<div style={{padding:'24px 0',textAlign:'center',fontSize:12,color:'rgba(240,236,249,0.25)'}}>No Shopify data found</div>}
              {!loadingCust&&customer?.customer&&(customer.orders||[]).length===0&&<div style={{padding:'24px 0',textAlign:'center',fontSize:12,color:'rgba(240,236,249,0.25)'}}>No orders</div>}
              {(customer?.orders||[]).map((order,oi)=>{
                const isCancelled = order.financialStatus==='cancelled'||order.financialStatus==='voided'
                const isRefunded  = order.financialStatus==='refunded'
                const canFulfill  = !isCancelled && (order.fulfillmentStatus==='unfulfilled'||order.fulfillmentStatus==='partial')
                const canRefund   = !isCancelled && !isRefunded
                const canCancel   = !isCancelled
                const shopifyDomain = customer?.shopifyDomain
                return (
                <div key={order.id} className="order-card" style={{animation:`fadeUp .3s ease ${oi*.06}s both`}}>
                  {/* Header */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:9,paddingLeft:8}}>
                    <div>
                      <span style={{fontSize:14,fontWeight:800,color:'#B990FF',letterSpacing:'-0.02em'}}>{order.name}</span>
                      <div style={{fontSize:10,color:'rgba(240,236,249,0.28)',marginTop:1}}>{new Date(order.createdAt).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'})}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:15,fontWeight:800,color:'#F0ECF9',letterSpacing:'-0.02em'}}>{fmtPrice(order.totalPrice,order.currency)}</div>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10,paddingLeft:8}}>
                    <OrderBadge status={order.financialStatus} />
                    <OrderBadge status={order.fulfillmentStatus} />
                    {order.hasRefund&&<span style={{fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:100,background:'rgba(248,113,133,0.12)',color:'#fb7185',border:'1px solid rgba(248,113,133,0.22)'}}>Partially refunded</span>}
                  </div>

                  {/* Line items */}
                  <div style={{marginBottom:10,paddingLeft:8}}>
                    {(order.lineItems||[]).slice(0,2).map(item=>(
                      <div key={item.id} style={{display:'flex',justifyContent:'space-between',fontSize:11.5,color:'rgba(240,236,249,0.48)',marginBottom:3}}>
                        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:155}}>{item.quantity}× {item.title}{item.variantTitle?` · ${item.variantTitle}`:''}</span>
                        <span style={{flexShrink:0,marginLeft:8,color:'rgba(240,236,249,0.35)'}}>{fmtPrice(Number(item.price)*item.quantity,order.currency)}</span>
                      </div>
                    ))}
                    {(order.lineItems||[]).length>2&&<div style={{fontSize:10.5,color:'rgba(240,236,249,0.25)',marginTop:2}}>+{order.lineItems.length-2} more item{order.lineItems.length-2!==1?'s':''}</div>}
                  </div>

                  {/* Tracking */}
                  {(order.fulfillments||[]).length>0&&(
                    <div style={{marginBottom:9,marginLeft:8,padding:'7px 10px',background:'rgba(74,222,128,0.04)',borderRadius:9,border:'1px solid rgba(74,222,128,0.1)'}}>
                      {order.fulfillments.slice(0,1).map((f,i)=>(
                        <div key={i}>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:f.trackingNumber?3:0}}>
                            <span style={{display:'flex',color:'rgba(74,222,128,0.6)'}}>{I.truck}</span>
                            <span style={{fontSize:11,fontWeight:700,color:'rgba(240,236,249,0.6)'}}>{f.trackingCompany||'Carrier'}</span>
                            <span style={{fontSize:9.5,fontWeight:700,padding:'1px 6px',borderRadius:4,background:'rgba(74,222,128,0.14)',color:'#4ade80',textTransform:'capitalize',marginLeft:'auto'}}>Delivered</span>
                          </div>
                          {f.trackingNumber&&<div style={{fontSize:10,color:'rgba(240,236,249,0.3)',fontFamily:'monospace'}}>{f.trackingNumber}</div>}
                          {f.trackingUrl&&<a href={f.trackingUrl} target="_blank" rel="noreferrer" style={{fontSize:10.5,color:'#A175FC',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3,marginTop:2}}>Track package <span style={{display:'flex'}}>{I.externalLink}</span></a>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Shipping address */}
                  {order.shippingAddress&&(
                    <div style={{marginBottom:9,marginLeft:8,padding:'7px 10px',background:'rgba(255,255,255,0.025)',borderRadius:9,border:'1px solid rgba(255,255,255,0.055)'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                        <div style={{display:'flex',alignItems:'center',gap:4,color:'rgba(240,236,249,0.3)'}}>
                          <span style={{display:'flex'}}>{I.mappin}</span>
                          <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase'}}>Shipping address</span>
                        </div>
                        <button onClick={()=>setModal({type:'address',order})} style={{display:'flex',alignItems:'center',gap:3,color:'rgba(240,236,249,0.3)',cursor:'pointer',fontSize:10,fontWeight:600,padding:'2px 6px',borderRadius:5,border:'1px solid rgba(255,255,255,0.07)',background:'transparent',transition:'all .15s'}} onMouseEnter={e=>{e.currentTarget.style.color='#A175FC';e.currentTarget.style.borderColor='rgba(161,117,252,0.3)'}} onMouseLeave={e=>{e.currentTarget.style.color='rgba(240,236,249,0.3)';e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'}}>
                          <span style={{display:'flex'}}>{I.edit}</span> Edit
                        </button>
                      </div>
                      <div style={{fontSize:11,color:'rgba(240,236,249,0.45)',lineHeight:1.55}}>
                        {[order.shippingAddress.firstName,order.shippingAddress.lastName].filter(Boolean).join(' ')}<br/>
                        {order.shippingAddress.address1}{order.shippingAddress.address2?`, ${order.shippingAddress.address2}`:''}<br/>
                        {[order.shippingAddress.city,order.shippingAddress.zip].filter(Boolean).join(' ')}{order.shippingAddress.country?`, ${order.shippingAddress.country}`:''}
                      </div>
                    </div>
                  )}

                  {/* Action grid */}
                  <div className="order-actions">
                    {canRefund&&(
                      <button className="oa-btn" onClick={()=>setModal({type:'refund',order})}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.8"/></svg>
                        Refund
                      </button>
                    )}
                    <button className="oa-btn" onClick={()=>setModal({type:'duplicate',order})}>
                      <span style={{display:'flex'}}>{I.copy}</span> Duplicate
                    </button>
                    <button className="oa-btn" onClick={()=>setModal({type:'note',order})}>
                      <span style={{display:'flex'}}>{I.note}</span> Note
                    </button>
                    {canCancel&&(
                      <button className="oa-btn oa-danger" onClick={()=>setModal({type:'cancel',order})}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )})}

            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Modals ═══════════════ */}
      {modal?.type==='refund'    && <RefundModal      order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type==='cancel'    && <CancelModal      order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type==='duplicate' && <DuplicateModal   order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type==='address'   && <EditAddressModal order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type==='fulfill'   && <FulfillModal     order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}
      {modal?.type==='note'      && <NoteModal        order={modal.order} token={session.access_token} onClose={()=>setModal(null)} onSuccess={handleModalSuccess} />}

      {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
    </div>
  )
}
