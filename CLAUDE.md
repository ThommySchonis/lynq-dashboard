@AGENTS.md

# Lynq & Flow — Dashboard Platform

## Wat is dit?
Een client dashboard platform voor Lynq & Flow agency. Elke klant krijgt een eigen login en ziet zijn eigen Shopify data (orders, refunds, KPIs). De admin (info@lynqagency.com) beheert alles via een apart admin panel.

## Tech Stack
- **Frontend:** Next.js 16.2.3 (app router), React 19
- **Database/Auth:** Supabase (project: cvrzvhnsltjubmfkcxql.supabase.co)
- **Hosting:** Vercel (lynq-dashboard.vercel.app)
- **Repo:** github.com/ThommySchonis/lynq-dashboard
- **Dashboard UI:** Static HTML in /public/dashboard.html (prototype: /Users/thommy.schonisziggo.nl/agency-dashboard/dashboard_prototype.html)

## Design
- Achtergrond: `#1C0F36`
- Surface: `#241352`
- Accent: `#A175FC`
- Font: Rethink Sans
- Border: `rgba(255,255,255,0.07)`

## Bestandsstructuur
```
app/
  admin/
    page.js          — Admin panel (clients, broadcasts, notifications tabs)
    login/page.js    — Admin login (alleen info@lynqagency.com)
  login/
    page.js          — Client login → redirect naar /dashboard.html
  api/
    shopify/
      kpis/route.js      — Live KPIs ophalen via Shopify API
      orders/route.js    — Live orders ophalen via Shopify API
      refunds/route.js   — Live refunds ophalen via Shopify API
  page.tsx           — Root redirect
lib/
  supabase.js        — Supabase client (use client, public key)
  supabaseAdmin.js   — Supabase admin client (secret key, server-only)
public/
  dashboard.html     — Het volledige client dashboard (statische HTML)
  logo.png           — Lynq & Flow logo
middleware.js        — Passthrough (geen auth check op middleware niveau)
```

## Supabase Tabellen
- **clients** — id, company_name, email, shopify_domain, shopify_api_key, gorgias_domain, gorgias_api_key, parcel_panel_api_key, status, created_at
- **broadcasts** — id, title, body, type (update/tip/video/industry), created_at
- **notifications** — id, title, body, type (info/warn/danger), created_at

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://cvrzvhnsltjubmfkcxql.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...   ← server-only, nooit in client code
OAUTH_STATE_SECRET=...              ← optioneel; valt terug op SUPABASE_SECRET_KEY
EMAIL_WEBHOOK_SECRET=...            ← verplicht voor inbound email webhook verificatie
```
Staan lokaal in .env.local en in Vercel onder Settings → Environment Variables.

## Hoe de Shopify koppeling werkt
1. Admin voert per klant `shopify_domain` (bijv. `jouw-shop.myshopify.com`) + `shopify_api_key` in via het admin panel
2. Bij inloggen haalt dashboard.html een Supabase session op
3. Met dat session token roept dashboard.html de Next.js API routes aan (`/api/shopify/kpis` etc.)
4. API routes halen de Shopify credentials op uit de `clients` tabel via de admin Supabase client
5. Data wordt live opgehaald van Shopify en teruggestuurd naar het dashboard

## Live data in dashboard.html
Het dashboard gebruikt `@supabase/supabase-js` via CDN. Bij laden:
- `initDashboard()` → controleert session, anders redirect naar /login
- `loadKPIs(token)` → vult KPI cards (revenue, refund rate, cancellations etc.)
- `loadOrders(token)` → vult de recente orders tabel onderaan home pagina
- `loadBroadcasts()` → vervangt Value Feed content met broadcasts uit Supabase

## Admin Panel
- URL: `/admin` (login via `/admin/login`)
- Alleen toegankelijk voor `info@lynqagency.com`
- Tabs: Clients (aanmaken), Broadcasts (pushen naar klanten), Notifications
- Bij client aanmaken: Supabase auth account + clients tabel record

## Workflow: aanpassen en deployen
1. Pas `dashboard_prototype.html` aan in `/Users/thommy.schonisziggo.nl/agency-dashboard/`
2. Kopieer naar `/Users/thommy.schonisziggo.nl/lynq-dashboard/public/dashboard.html`
3. Commit + push naar GitHub → Vercel deployt automatisch

## Volgende fases
- Fase 3: Refunds tabel live koppelen in dashboard
- Fase 4: Eigen domein (dashboard.lynqagency.com)
- Fase 5: Email notificaties bij nieuwe broadcasts
- Fase 6: Onboarding flow voor nieuwe klanten
