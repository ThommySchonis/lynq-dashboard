# Lynq & Flow Helpdesk — Onboarding Specification

**Version:** 1.1
**Status:** Approved for implementation
**Last updated:** 2026-05-05

---

## 1. Overview

Light-touch, self-service onboarding inspired by Gorgias' approach. New users get immediate access to a fully-functional dashboard. Each page has a clear empty state that guides the user to the integration or action they need.

**Core principles:**

- No forced setup wizards
- New workspaces start 100% empty — no default content, no demo data
- Each page tells the user what to do next via clear empty-state CTAs
- Premium UX at every emotionally important moment (trial expiry, payment success)

**Trial structure:** 7 days, no credit card required at signup. Card required at trial end if user wants to continue.

---

## 2. Pricing context

| Plan | Tickets/month | Price/month |
|---|---|---|
| Starter | 250 | $39 |
| Growth | 1,000 | $79 |
| Pro | 2,000 | $129 |
| Scale | 3,000 | $179 |
| Enterprise | 10,000+ | Custom (from $399) |

All plans include unlimited agents and all features. Annual: 20% off (≈ 2.4 months free).

**Overage:** Forced plan upgrade (no per-ticket overage billing). Soft block at 100% of limit, prompt to upgrade.

**Payment provider:** Whop (US company entity).

---

## 3. Signup flow

### 3.1 Entry points

User lands on signup via:
- Marketing site pricing page → "Start free trial" button on a plan
- Direct link / referral from Lynq & Flow agency

### 3.2 Signup form

Required fields:
- Work email
- Password (min 8 characters)
- First and last name
- Company name (becomes workspace name, editable later)

Optional:
- Plan preference dropdown (informational only, not binding — used for analytics/personalization)

**No credit card** required at signup.

### 3.3 Post-signup actions (server-side, automatic)

1. Create user in `auth.users` (Supabase Auth)
2. Create `workspace` record with `trial_ends_at = now() + 7 days`
3. Create `workspace_member` record (user as owner)
4. Create `user_profile` record
5. Send verification email (non-blocking — user can use product without verifying)
6. Send "Day 1" welcome email (see section 7)
7. Redirect to `/dashboard` (or `/home`)

No demo data is seeded. The workspace is empty until the user takes action.

---

## 4. Empty states

Klanten beginnen met een 100% lege workspace. Elke pagina heeft een duidelijke empty state die de klant naar de juiste integratie/actie stuurt.

### 4.1 Feature matrix

Welke koppeling unlock welke feature:

| Feature | Email | Shopify | Empty state CTA |
|---|---|---|---|
| Macros | nee | nee | Generate via AI Macro Generator |
| Inbox | ja | nee | Connect Email |
| Analytics | nee | ja | Connect Shopify |
| Performance | ja | nee | Connect Email |
| Tags | nee | nee | Direct werkbaar, geen empty state CTA |

### 4.2 Page-level empty states

**`/inbox` zonder email:**
- "📬 Your inbox is empty"
- "Connect your email to start receiving customer support tickets."
- [Connect Gmail] [Connect Outlook]

**`/inbox` met email maar zonder Shopify:**
- Inbox werkt normaal, tickets zijn zichtbaar
- Subtiele banner in ticket detail view: "ℹ️ Connect Shopify to see order details for this customer." [Connect Shopify]

**`/macros` leeg:**
- "✨ Generate your macro library with AI"
- "Answer a few questions about your store and policies, and we'll create a tailored macro library for you in 2 minutes."
- [Generate macros] (primary CTA → AI Macro Generator flow)
- "Or [create your first macro manually]" (secondary CTA)

**`/analytics` zonder Shopify:**
- "📊 No analytics data yet"
- "Connect your Shopify store to see revenue, order metrics, and customer insights."
- [Connect Shopify]

**`/performance` zonder email:**
- "👥 No performance data yet"
- "Connect your email to start tracking response time, ticket volume, and agent activity."
- [Connect Gmail] [Connect Outlook]

**`/tags` leeg:**
- "🏷️ No tags yet"
- "Create tags to organize and filter your tickets."
- [Create your first tag]

---

## 5. First login UX

### 5.1 Welcome banner (top of dashboard)

Shown on first login. Dismissable. Stored in `user_profiles.welcome_dismissed_at`.

```
👋 Welcome to Lynq & Flow, [Name]
You're on a 7-day free trial. Connect your email and Shopify
below to start handling customer support.

[Connect Gmail]  [Connect Outlook]  [Connect Shopify]  [Dismiss]
```

Banner styling: subtle gradient background, not too in-your-face. Auto-hides after first dismiss.

### 5.2 Setup checklist widget

Persistent (until completed or dismissed) widget in the sidebar or settings menu. Clickable.

```
Setup checklist (2/6)
✓ Account created
✓ Workspace ready
○ Generate AI macro library  (optional, no integration required)
○ Connect email account
○ Connect Shopify
○ Invite first team member
```

Generate AI macros zit hoog in de lijst omdat het geen koppeling vereist — een directe quick-win die de klant meteen waarde laat zien.

Each unchecked item links to the relevant settings page or feature.

Widget is dismissable but reappears in settings under "Setup progress" so user can return.

---

## 6. Connect Shopify / Connect Email — settings pages

These pages exist from day 1 but the actual integration is built later by external developer.

### 6.1 Connect Shopify page (`/settings/integrations/shopify`)

UI layout:

```
[Back to Settings]

Connect your Shopify store
─────────────────────────

To pull order info into your tickets and unlock the AI Macro Generator,
connect your Shopify store below.

[ Shopify store URL: ________________ ]
[ Connect Shopify ]

⚠️ Integration coming soon — your settings will be saved.
```

Behavior for v1 (pre-developer):
- User can fill in Shopify URL
- "Connect" button stores the URL in `integrations` table with `status = 'pending'`
- Confirmation: "Settings saved. Connection will activate when integration is live."
- Once developer ships the integration, those pending integrations auto-activate or user gets an email to complete OAuth

### 6.2 Connect Email page (`/settings/integrations/email`)

UI layout:

```
[Back to Settings]

Connect your email account
──────────────────────────

Choose your email provider to start receiving customer emails as tickets:

[ Connect Gmail ]    [ Connect Outlook ]

⚠️ Integration coming soon — your settings will be saved.
```

Same pattern as Shopify: button stores intent in `email_accounts` table with `status = 'pending'`.

### 6.3 Settings UI design

Settings should follow Lynq & Flow brand styling. Each integration section shows:
- Icon (Shopify, Gmail, Outlook)
- Status indicator: Not connected / Pending / Connected / Error
- Action button appropriate to status
- "Last synced" timestamp once connected

---

## 7. Trial reminder emails

Sent via email provider (Resend or similar). Templates managed in code.

| Day | Subject | Trigger | Content focus |
|---|---|---|---|
| 1 | Welcome to Lynq & Flow | Immediately after signup | 2-min onboarding video, key features tour, links to settings |
| 3 | Tip: AI Macro Generator | If user has not generated macros yet | Show how AI Macro Generator builds custom library in 2 min |
| 5 | 2 days left — see what your team is missing | Always | Trial recap, social proof, CTA to pricing |
| 7 | Your trial ends today | Always | Direct CTA + Whop checkout link |
| 8 | Trial ended — your work is saved | If trial expired without upgrade | Reminder data is saved 60 days, CTA to choose plan |

Each email is sent only if user has not yet upgraded. Tracking via `workspaces.subscription_status` (`trial`, `paying`, `expired`).

---

## 8. Trial expiry — premium UX (Day 7)

This is the highest-stakes UX moment in the entire onboarding. Must feel premium and respectful, not punitive.

### 8.1 Day 6 — Soft warning

Top-of-dashboard banner (dismissable but reappears next session):

```
⏰ Your trial ends tomorrow
Pick a plan to continue using Lynq & Flow

[See plans] [Remind me tomorrow]
```

### 8.2 Day 7 — Full-screen modal

When user logs in on day 7 (or trial actively expires during session), show a full-screen modal that **cannot be dismissed**.

**Design requirements:**
- Custom typography (not default UI fonts)
- Subtle entrance animation (fade-in, optional confetti or particle effect)
- Lynq & Flow logo prominently displayed
- Behind the modal: dashboard is visible but heavily blurred
- Premium feel: spacious layout, generous whitespace, high-quality micro-interactions

**Content structure:**

```
Lynq & Flow logo
↓
Headline: "Ready to keep going, [First Name]?"
Subhead: "Your 7-day trial ended. Pick a plan to continue
         where you left off — your data is exactly as you left it."

[Plan card 1: Starter]    [Plan card 2: Growth]
$39/mo                     $79/mo
250 tickets                1,000 tickets
[Continue with Starter]    [Continue with Growth]

[Plan card 3: Pro]         [Plan card 4: Scale]
"MOST POPULAR" badge       $179/mo
$129/mo                    3,000 tickets
2,000 tickets              [Continue with Scale]
[Continue with Pro]

— or —
Need more? [Contact us for Enterprise]

Footer: "Your data is safe with us. We'll keep everything for 60 days
         in case you change your mind."
```

Each plan card CTA → Whop checkout for that plan → success returns to `/welcome-back`.

### 8.3 Toggle for monthly/annual

In the modal, prominent toggle: **Monthly** / **Annual (save 20%)**

When toggled, prices update to annual figures with strikethrough monthly price showing the savings.

---

## 9. Post-payment success

Whop checkout success → redirect to `/welcome-back`:

```
🎉 You're all set, [First Name]!

Your [Plan Name] plan is active.
✓ [N] tickets per month
✓ Unlimited team members
✓ All features included

[Continue to dashboard]
```

Subtle confetti animation on load. Auto-redirect to dashboard after 5 seconds if user doesn't click.

Server-side actions on payment success webhook:
- Update `workspaces.subscription_status = 'paying'`
- Update `workspaces.plan = '<chosen plan>'`
- Update `workspaces.subscription_started_at = now()`
- Update `workspaces.trial_ends_at = null` (no longer relevant)
- Send "Welcome to [Plan]" email with receipt

---

## 10. Post-trial blocked state (no upgrade)

If user does not pay by trial end, account enters **blocked state** (option C from spec discussions).

### 10.1 Blocked state behavior

- Login still works (account preserved)
- Every page request → middleware checks `workspaces.subscription_status`
- If `expired` or `null` and trial has ended → redirect to `/pricing-required`
- The only accessible pages: `/pricing-required`, `/settings/billing`, `/logout`

### 10.2 `/pricing-required` page

Same modal as Day 7 modal, but:
- Headline: "Welcome back, [First Name]"
- Subhead: "Pick a plan to access your account again. Your data is saved for [N] more days."
- [N] dynamically calculated: 60 days minus days since expiry
- Same 4 plan cards, same Whop checkout links

### 10.3 Data retention

- `workspaces.subscription_status = 'expired'` for 60 days post-trial-end
- Day 60: scheduled job marks `workspaces.scheduled_for_deletion_at = now() + 7 days`
- User receives email warning 7 days before deletion
- Day 67: full workspace deletion (GDPR-compliant cascade delete)

If user pays during the 60-day window: status flips to `paying`, account immediately accessible, no data loss.

---

## 11. Database schema changes required

New columns on existing tables:

```sql
-- workspaces table
alter table public.workspaces add column if not exists
  trial_ends_at timestamptz,
  subscription_status text default 'trial' check (
    subscription_status in ('trial', 'paying', 'expired')
  ),
  plan text,
  subscription_started_at timestamptz,
  demo_data_removed_at timestamptz,
  scheduled_for_deletion_at timestamptz,
  whop_membership_id text,
  whop_user_id text;

-- user_profiles for UI state
alter table public.user_profiles add column if not exists
  welcome_dismissed_at timestamptz,
  setup_checklist_dismissed_at timestamptz;
```

Indexes:

```sql
create index if not exists idx_workspaces_subscription_status on public.workspaces(subscription_status);
create index if not exists idx_workspaces_trial_ends_at on public.workspaces(trial_ends_at) where subscription_status = 'trial';
```

> **Note:** v1.0 specced `is_demo` columns on `email_conversations`, `email_messages`, `macros`, `tags`, and `analytics_actions`. Those columns are dropped in v1.1 — see migration `20260505_drop_is_demo_columns.sql`. The `demo_data_removed_at` column on `workspaces` remains as a historical timestamp marker (no longer the trigger for cleanup; new workspaces never have demo data to remove).

---

## 12. Build order (recommended)

For implementation, work in this sequence to enable progressive testing:

1. **Database schema migration** — add the new columns and indexes
2. **Empty state components per pagina** — inbox, macros, analytics, performance, tags
3. **Welcome banner + setup checklist widget**
4. **Signup flow** — wire workspace + member + user_profile creation (no demo seeding)
5. **Connect Shopify + Connect Email settings pages** (UI only, no working integration)
6. **Trial countdown logic** — middleware + day 6 banner
7. **Day 7 premium modal** — design first, then build (separate sprint)
8. **Whop integration** — checkout, webhooks, subscription state sync
9. **Post-payment success page**
10. **Blocked state middleware + `/pricing-required` page**
11. **Trial reminder emails** — Resend integration + 5 templates
12. **Data retention cleanup job** — scheduled function for 60+7 day deletion

---

## 13. Open items / future iterations

Parked for later:
- A/B test trial length (7 vs 14 days)
- Onboarding video production (referenced in Day 1 email)
- In-app tour / tooltips (currently relying on welcome banner only)
- Self-service plan changes mid-subscription (upgrade/downgrade UI)
- Annual ↔ monthly switching post-purchase
- Refund flow UI (Whop handles backend)
- Re-activation flow for users in 60-day grace window
- Custom enterprise contracts and pricing display

---

## Changelog

- **v1.1** (2026-05-05) — switched from demo data seeding to empty states. `is_demo` columns dropped via migration `20260505_drop_is_demo_columns.sql`. Sections 4 (Demo data seeding), 5.2 (DEMO badges), and 7 (Demo data cleanup) removed. New section 4 (Empty states) replaces them. Build order updated. Welcome banner + setup checklist text rewritten.
- **v1.0** (2026-05-05) — initial spec.
