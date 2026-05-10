# Shopify Connection Flow, API Verification & Inbox Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Shopify integration fully functional end-to-end — from connecting a store in Settings, through verifying all API routes work, to fixing remaining gaps in the inbox order panel.

**Architecture:** The Settings page gets a connect modal that calls the existing `POST /api/shopify/manual-connect` backend. The customer API route gets extended with `?order=` support and richer response shape. The inbox already has modals and order panel UI built — we fix the remaining gaps (search handler, refund reason dropdown, refund rate badge).

**Tech Stack:** Next.js 16 (app router), React 19, Supabase, Shopify Admin API 2025-04

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/settings/page.js` | Modify | Add Shopify connect modal + disconnect button to IntegrationsTab |
| `app/api/shopify/manual-connect/route.js` | Modify | Fix DELETE handler to null Shopify columns instead of deleting entire row |
| `app/api/shopify/customer/route.js` | Modify | Add `?order=` param support, extend response shape (refunds array, cancelledAt), increase limit to 50 |
| `app/inbox/page.js` | Modify | Wire up manual search input, change refund reason to dropdown, add refund rate badge |

---

### Task 1: Fix Disconnect Backend — manual-connect DELETE handler

**Files:**
- Modify: `app/api/shopify/manual-connect/route.js:41-51`

- [ ] **Step 1: Read the current DELETE handler**

The current handler deletes the entire `integrations` row, which wipes all integration data (parcelpanel_api_key, etc.).

- [ ] **Step 2: Change DELETE to null only Shopify columns**

Replace the DELETE handler in `app/api/shopify/manual-connect/route.js`:

```js
export async function DELETE(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('integrations').update({
    shopify_domain: null,
    shopify_access_token: null,
    shopify_connected_at: null,
  }).eq('client_id', user.id)

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/shopify/manual-connect/route.js
git commit -m "fix: disconnect Shopify without deleting other integrations"
```

---

### Task 2: Shopify Connect Modal in Settings

**Files:**
- Modify: `app/settings/page.js:593-733`

- [ ] **Step 1: Add modal CSS to the settings page CSS block**

Add these styles inside the existing `CSS` template literal (after the `.color-input-wrapper` styles, around line 265):

```css
.modal-backdrop {
  position:fixed; inset:0; z-index:1000;
  background:rgba(0,0,0,0.5); backdrop-filter:blur(4px);
  display:flex; align-items:center; justify-content:center;
  animation:fadeIn 0.2s ease both;
}
.modal-box {
  background:var(--bg-surface); border:1px solid var(--border);
  border-radius:16px; padding:28px; width:100%; max-width:440px;
  box-shadow:0 20px 60px rgba(0,0,0,0.4);
  animation:revealUp 0.3s ease-out both;
}
```

- [ ] **Step 2: Add ShopifyConnectModal component**

Add this component above the `IntegrationsTab` function (around line 593):

```jsx
function ShopifyConnectModal({ token, onClose, onSuccess }) {
  const [shop, setShop] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConnect() {
    if (!shop.trim() || !accessToken.trim()) {
      setError('Both fields are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/shopify/manual-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shop: shop.trim(), accessToken: accessToken.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Connection failed')
        setLoading(false)
        return
      }
      onSuccess(data.shop)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>Connect Shopify</h3>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
          Enter your Shopify store domain and Admin API access token
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="label-text">Store domain</div>
            <input
              className="settings-input"
              type="text"
              value={shop}
              onChange={e => setShop(e.target.value)}
              placeholder="your-store.myshopify.com"
              autoFocus
            />
          </div>
          <div>
            <div className="label-text">Access token</div>
            <PasswordInput
              value={accessToken}
              onChange={setAccessToken}
              placeholder="shpat_..."
            />
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
            fontSize: 13, color: '#f87171',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="danger-btn" onClick={onClose} style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            Cancel
          </button>
          <button className="primary-btn" onClick={handleConnect} disabled={loading}>
            {loading ? <Spinner /> : null}
            {loading ? 'Connecting…' : 'Connect Shopify'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire up IntegrationsTab — Shopify connect + disconnect**

In the `IntegrationsTab` function:

**Add state** (after existing `useState` declarations around line 597):

```js
const [showShopifyModal, setShowShopifyModal] = useState(false)
const [disconnecting, setDisconnecting] = useState(false)
```

**Replace the Shopify item's onClick** — change the generic `onClick` handler. In the integration card render section (around line 718-725), replace the generic connect button handler:

The current code for non-comingSoon, non-connected items is:
```jsx
<button
  className="primary-btn"
  style={{ padding:'7px 16px', fontSize:13 }}
  onClick={() => setToast({ message: `${item.label} connection coming soon`, type: 'success' })}
>
  Connect
</button>
```

Change this to handle Shopify separately:
```jsx
<button
  className="primary-btn"
  style={{ padding:'7px 16px', fontSize:13 }}
  onClick={() => {
    if (item.id === 'shopify') setShowShopifyModal(true)
    else setToast({ message: `${item.label} connection coming soon`, type: 'success' })
  }}
>
  Connect
</button>
```

**Add disconnect button** for connected Shopify — in the connected state section (around line 703-717), after the "Connected" badge span, add a disconnect button specifically for Shopify:

```jsx
) : item.connected ? (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{
      padding:'5px 12px', borderRadius:20,
      background:'rgba(74,222,128,0.1)',
      border:'1px solid rgba(74,222,128,0.25)',
      fontSize:12, fontWeight:600, color:'#4ade80',
      display:'inline-flex', alignItems:'center', gap:6,
    }}>
      <span style={{
        width:6, height:6, borderRadius:'50%',
        background:'#4ade80',
        boxShadow:'0 0 6px #4ade80',
      }}/>
      Connected
    </span>
    {item.id === 'shopify' && (
      <button
        className="danger-btn"
        style={{ padding: '4px 12px', fontSize: 12 }}
        disabled={disconnecting}
        onClick={async () => {
          if (!confirm('Disconnect Shopify? Order data will no longer be available.')) return
          setDisconnecting(true)
          try {
            await fetch('/api/shopify/manual-connect', {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
            setIntegrations(prev => ({ ...prev, shopify: false, shopifyDomain: null }))
            setToast({ message: 'Shopify disconnected', type: 'success' })
          } catch {
            setToast({ message: 'Failed to disconnect', type: 'error' })
          } finally {
            setDisconnecting(false)
          }
        }}
      >
        {disconnecting ? 'Disconnecting…' : 'Disconnect'}
      </button>
    )}
  </div>
```

**Add modal render and handler** at the end of the IntegrationsTab return, before the closing `</div>`:

```jsx
{showShopifyModal && (
  <ShopifyConnectModal
    token={session.access_token}
    onClose={() => setShowShopifyModal(false)}
    onSuccess={(shopDomain) => {
      setShowShopifyModal(false)
      setIntegrations(prev => ({ ...prev, shopify: true, shopifyDomain: shopDomain }))
      setToast({ message: 'Shopify connected successfully!', type: 'success' })
    }}
  />
)}
```

- [ ] **Step 4: Manually test in browser**

1. Go to Settings → Integrations
2. Click "Connect" on Shopify card → modal should open
3. Enter shop domain + access token → click Connect
4. Verify "Connected" badge appears with "Disconnect" button
5. Click Disconnect → verify confirmation → verify reverts to "Connect" button

- [ ] **Step 5: Commit**

```bash
git add app/settings/page.js
git commit -m "feat: add Shopify connect/disconnect modal in Settings"
```

---

### Task 3: Extend Customer API Route

**Files:**
- Modify: `app/api/shopify/customer/route.js`

- [ ] **Step 1: Add `?order=` support and extend response**

Replace the entire `GET` handler in `app/api/shopify/customer/route.js` with:

```js
import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getShopifyClient, shopifyFetch } from '../../../../lib/shopify'
import { NextResponse } from 'next/server'

// GET /api/shopify/customer?email=...  or  ?order=...
// Returns customer info + their recent orders
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await getShopifyClient(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const order = searchParams.get('order')

  if (!email && !order) {
    return NextResponse.json({ error: 'Missing email or order' }, { status: 400 })
  }

  let customer = null

  if (email) {
    // Search customer by email
    const searchRes = await shopifyFetch(
      client,
      `/customers/search.json?query=email:${encodeURIComponent(email)}&limit=1`
    )
    const searchData = await searchRes.json()
    customer = searchData.customers?.[0]
  } else if (order) {
    // Search by order number — strip leading #
    const orderName = order.replace(/^#/, '')
    const orderRes = await shopifyFetch(
      client,
      `/orders.json?name=${encodeURIComponent(orderName)}&status=any&limit=1`
    )
    const orderData = await orderRes.json()
    const matchedOrder = orderData.orders?.[0]
    if (matchedOrder?.customer?.id) {
      // Fetch the full customer record
      const custRes = await shopifyFetch(client, `/customers/${matchedOrder.customer.id}.json`)
      const custData = await custRes.json()
      customer = custData.customer
    }
  }

  if (!customer) return NextResponse.json({ customer: null, orders: [] })

  // Fetch their recent orders (limit 50 for better refund rate accuracy)
  const ordersRes = await shopifyFetch(
    client,
    `/orders.json?customer_id=${customer.id}&status=any&limit=50`
  )
  const ordersData = await ordersRes.json()

  const orders = (ordersData.orders || []).map(o => ({
    id: o.id,
    name: o.name,
    createdAt: o.created_at,
    financialStatus: o.financial_status,
    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
    cancelReason: o.cancel_reason,
    cancelledAt: o.cancelled_at || null,
    totalPrice: o.total_price,
    currency: o.currency,
    lineItems: (o.line_items || []).map(item => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
    })),
    fulfillments: (o.fulfillments || []).map(f => ({
      trackingNumber: f.tracking_number,
      trackingUrl: f.tracking_url,
      trackingCompany: f.tracking_company,
      status: f.status,
    })),
    refunds: o.refunds || [],
    shippingAddress: o.shipping_address ? {
      firstName: o.shipping_address.first_name || '',
      lastName: o.shipping_address.last_name || '',
      address1: o.shipping_address.address1 || '',
      address2: o.shipping_address.address2 || '',
      city: o.shipping_address.city || '',
      zip: o.shipping_address.zip || '',
      country: o.shipping_address.country || '',
      countryCode: o.shipping_address.country_code || '',
      phone: o.shipping_address.phone || '',
    } : null,
  }))

  return NextResponse.json({
    customer: {
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      city: customer.default_address?.city,
      country: customer.default_address?.country,
      countryCode: customer.default_address?.country_code,
      ordersCount: customer.orders_count,
      totalSpent: customer.total_spent,
      currency: customer.currency,
      tags: customer.tags,
      note: customer.note,
      createdAt: customer.created_at,
    },
    orders,
  })
}
```

Key changes from original:
- Accepts `?order=` param: strips `#`, searches Shopify orders by name, loads the associated customer
- Guard changed: requires either `email` or `order` (not just email)
- `refunds: o.refunds || []` replaces `hasRefund: boolean`
- Added `cancelledAt: o.cancelled_at || null`
- Limit increased from 5 to 50

- [ ] **Step 2: Commit**

```bash
git add app/api/shopify/customer/route.js
git commit -m "feat: customer API supports ?order= param, richer response shape"
```

---

### Task 4: API Verification via curl

This task verifies all Shopify endpoints against the real store. Must be done after Tasks 1-3.

- [ ] **Step 1: Start dev server**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npm run dev
```

- [ ] **Step 2: Get a session token**

Log in via the browser at `http://localhost:3000/login`. Open browser DevTools → Application → Local Storage → find `sb-*-auth-token` → copy the `access_token` value. Export it:

```bash
export TOKEN="<paste-token-here>"
```

- [ ] **Step 3: Test connection status**

```bash
curl -s http://localhost:3000/api/shopify/status \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ "connected": true, "shop": "your-store.myshopify.com" }`

- [ ] **Step 4: Test orders list**

```bash
curl -s http://localhost:3000/api/shopify/orders \
  -H "Authorization: Bearer $TOKEN" | jq '.orders[:2]'
```

Expected: Array of order objects with `id`, `name`, `financialStatus`, etc.

- [ ] **Step 5: Test single order detail**

Use an order ID from step 4:

```bash
curl -s http://localhost:3000/api/shopify/orders/<ORDER_ID> \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: Full order with line items, fulfillments, refunds, shipping address.

- [ ] **Step 6: Test customer by email**

Use a customer email from one of the orders:

```bash
curl -s "http://localhost:3000/api/shopify/customer?email=<CUSTOMER_EMAIL>" \
  -H "Authorization: Bearer $TOKEN" | jq '.customer.email, .orders | length'
```

Expected: Customer email + number of orders. Verify `refunds` is an array (not `hasRefund` boolean) and `cancelledAt` field exists on orders.

- [ ] **Step 7: Test customer by order number**

Use an order name (e.g. `1042`) from the orders list:

```bash
curl -s "http://localhost:3000/api/shopify/customer?order=<ORDER_NUMBER>" \
  -H "Authorization: Bearer $TOKEN" | jq '.customer.email, .orders | length'
```

Expected: Same customer + orders response as email lookup.

- [ ] **Step 8: Test order sync**

```bash
curl -s -X POST http://localhost:3000/api/shopify/sync \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: Success response with synced order count.

- [ ] **Step 9: Test KPIs (after sync)**

```bash
curl -s http://localhost:3000/api/shopify/kpis \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: KPI object with totalOrders, totalRefunds, refundRate, netRevenue, etc.

- [ ] **Step 10: Test duplicate order (safe — creates draft)**

```bash
curl -s -X POST http://localhost:3000/api/shopify/orders/<ORDER_ID>/duplicate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

Expected: Draft order with `invoiceUrl`.

- [ ] **Step 11: Fix any failures discovered during verification**

If any endpoint returns errors, debug and fix before proceeding.

- [ ] **Step 12: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve issues found during Shopify API verification"
```

(Only if fixes were needed)

---

### Task 5: Inbox — Wire Up Manual Search Input

**Files:**
- Modify: `app/inbox/page.js:2519-2525`

- [ ] **Step 1: Add search state and handler**

In the main `InboxPage` component, find the state declarations (around line 1769). Add:

```js
const [custSearch, setCustSearch] = useState('')
```

Add the search handler near `openThread` function (around line 1998):

```js
async function handleCustSearch(query) {
  if (!query.trim() || !session) return
  setLoadingCust(true)
  setCustomer(null)
  const isOrder = /^#?\d+$/.test(query.trim())
  const param = isOrder
    ? `order=${encodeURIComponent(query.trim().replace(/^#/, ''))}`
    : `email=${encodeURIComponent(query.trim())}`
  try {
    const res = await authFetch(`/api/shopify/customer?${param}`, {}, session.access_token)
    const data = await res.json()
    setCustomer(data)
  } catch {
    setCustomer(null)
  } finally {
    setLoadingCust(false)
  }
}
```

- [ ] **Step 2: Wire the search input**

Replace the search input at line 2523:

```jsx
<input className="rp-search" placeholder="Search for customers by email, order number..." />
```

With:

```jsx
<input
  className="rp-search"
  placeholder="Search by email or #order number..."
  value={custSearch}
  onChange={e => setCustSearch(e.target.value)}
  onKeyDown={e => { if (e.key === 'Enter') handleCustSearch(custSearch) }}
/>
```

- [ ] **Step 3: Commit**

```bash
git add app/inbox/page.js
git commit -m "feat: wire up customer search input in inbox right panel"
```

---

### Task 6: Inbox — Refund Reason Dropdown

**Files:**
- Modify: `app/inbox/page.js:864-980` (RefundModal)

- [ ] **Step 1: Add refund reason constants**

Add after the existing `CANCEL_REASONS` constant (around line 33):

```js
const REFUND_REASONS = [
  { value: 'customer',   label: 'Customer changed mind' },
  { value: 'fraud',      label: 'Fraudulent order' },
  { value: 'inventory',  label: 'Item out of stock' },
  { value: 'declined',   label: 'Payment declined' },
  { value: 'quality',    label: 'Product quality issue' },
  { value: 'shipping',   label: 'Shipping problem' },
  { value: 'wrong_item', label: 'Wrong item received' },
  { value: 'other',      label: 'Other' },
]
```

- [ ] **Step 2: Replace free-text reason with dropdown**

In `RefundModal` (around line 967-969), replace:

```jsx
<div style={{marginBottom:16}}>
  <label className="modal-label">Reason (optional)</label>
  <input className="modal-input" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for refund…" />
</div>
```

With:

```jsx
<div style={{marginBottom:16}}>
  <label className="modal-label">Reason</label>
  <select className="modal-select" value={reason} onChange={e=>setReason(e.target.value)} required>
    <option value="" disabled>Select a reason…</option>
    {REFUND_REASONS.map(r=>(
      <option key={r.value} value={r.value}>{r.label}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 3: Make reason required for submission**

In `RefundModal`, update the `canSubmit` logic (around line 881):

```js
const canSubmit = reason && (mode==='custom' ? Number(customAmount)>0 : totalRefund>0)
```

- [ ] **Step 4: Commit**

```bash
git add app/inbox/page.js
git commit -m "feat: refund reason uses dropdown taxonomy instead of free text"
```

---

### Task 7: Inbox — Refund Rate Badge in Customer Header

**Files:**
- Modify: `app/inbox/page.js:2563-2574` (stats bar section)

- [ ] **Step 1: Add refund rate computation and badge to the stats bar**

Find the stats bar section (around line 2563-2574). Replace the entire stats bar block:

```jsx
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
```

With:

```jsx
{customer?.customer&&!loadingCust&&(()=>{
  const orders = customer.orders || []
  const withRefund = orders.filter(o => o.refunds && o.refunds.length > 0)
  const refundPct = orders.length > 0 ? Math.round((withRefund.length / orders.length) * 100) : 0
  const approx = customer.customer.ordersCount > 50
  const badgeColor = refundPct > 30 ? '#f87171' : refundPct > 10 ? '#fbbf24' : null
  const badgeBg = refundPct > 30 ? 'rgba(248,113,113,0.12)' : refundPct > 10 ? 'rgba(251,191,36,0.12)' : null
  return (
    <div style={{display:'flex',borderBottom:'1px solid var(--border)',flexShrink:0}}>
      <div style={{flex:1,padding:'10px 0',textAlign:'center',borderRight:'1px solid var(--border)'}}>
        <div style={{fontSize:14,fontWeight:800,color:'var(--text-1)',letterSpacing:'-0.02em'}}>{fmtPrice(customer.customer.totalSpent,customer.customer.currency)}</div>
        <div style={{fontSize:9.5,color:'var(--text-3)',marginTop:2,textTransform:'uppercase',letterSpacing:'.06em'}}>Spent</div>
      </div>
      <div style={{flex:1,padding:'10px 0',textAlign:'center',borderRight:'1px solid var(--border)'}}>
        <div style={{fontSize:14,fontWeight:800,color:'var(--text-1)',letterSpacing:'-0.02em'}}>{customer.customer.ordersCount??'—'}</div>
        <div style={{fontSize:9.5,color:'var(--text-3)',marginTop:2,textTransform:'uppercase',letterSpacing:'.06em'}}>Orders</div>
      </div>
      <div style={{flex:1,padding:'10px 0',textAlign:'center'}}>
        <div style={{fontSize:14,fontWeight:800,color:badgeColor||'var(--text-1)',letterSpacing:'-0.02em'}}>{approx?'~':''}{refundPct}%</div>
        <div style={{fontSize:9.5,color:'var(--text-3)',marginTop:2,textTransform:'uppercase',letterSpacing:'.06em'}}>Refund</div>
      </div>
    </div>
  )
})()}
```

- [ ] **Step 2: Update hasRefund references to use refunds array**

Find the "Partial refund" badge in the order panel (around line 2692):

```jsx
{order.hasRefund&&<span style={{...}}>Partial refund</span>}
```

Replace with:

```jsx
{(order.refunds?.length>0)&&order.financialStatus!=='refunded'&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:'rgba(248,113,133,0.12)',color:'#fb7185',letterSpacing:'.05em',textTransform:'uppercase',border:'1px solid rgba(248,113,133,0.22)'}}>Partial refund</span>}
```

- [ ] **Step 3: Commit**

```bash
git add app/inbox/page.js
git commit -m "feat: add refund rate badge + use refunds array from API"
```

---

### Task 8: End-to-End Browser Verification

- [ ] **Step 1: Test Settings connect flow**

1. Go to `http://localhost:3000/settings` → Integrations tab
2. Click Connect on Shopify → enter store domain + access token
3. Verify Connected badge + Disconnect button appears

- [ ] **Step 2: Test inbox order panel with live data**

1. Go to `http://localhost:3000/inbox`
2. Open a thread → verify customer auto-lookup loads in right panel
3. Verify order list shows with correct status badges
4. Expand an order → verify line items, shipping, fulfillment sections
5. Verify refund rate badge shows in customer stats bar

- [ ] **Step 3: Test manual search**

1. In right panel search input, type a customer email → press Enter
2. Verify customer + orders load
3. Try an order number (e.g. `#1042`) → press Enter
4. Verify same customer loads

- [ ] **Step 4: Test refund modal**

1. Click Refund on an order → verify dropdown with 8 reason options
2. Verify cannot submit without selecting a reason
3. (Optional: process a test refund if you have a test order)

- [ ] **Step 5: Test cancel modal**

1. Click Cancel on an order → verify reason dropdown + toggles
2. (Optional: cancel a test order)

- [ ] **Step 6: Test duplicate modal**

1. Click Duplicate on an order → verify line items shown
2. Submit → verify draft order created with invoice URL

- [ ] **Step 7: Test disconnect**

1. Go to Settings → Integrations
2. Click Disconnect on Shopify → confirm
3. Verify reverts to Connect button
4. Go to inbox → verify "No Shopify data found" or similar shows

- [ ] **Step 8: Reconnect and final commit**

Reconnect the store for ongoing use. Final commit if any tweaks were needed:

```bash
git add -A && git commit -m "fix: polish from end-to-end verification"
```
