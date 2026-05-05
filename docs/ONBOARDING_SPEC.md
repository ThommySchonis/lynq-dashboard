# Lynq & Flow Helpdesk — Onboarding Specification

**Version:** 1.0
**Status:** Approved for implementation
**Last updated:** 2026-05-05

---

## 1. Overview

Light-touch, self-service onboarding inspired by Gorgias' approach. New users get immediate access to a fully-functional dashboard pre-populated with demo data, allowing them to explore the product before connecting their own Shopify store and email accounts.

**Core principles:**

- No forced setup wizards
- Demo data shows the product working from minute one
- Real data replaces demo data automatically once Shopify + email are connected
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
5. **Seed demo data** (see section 4)
6. Send verification email (non-blocking — user can use product without verifying)
7. Send "Day 1" welcome email (see section 8)
8. Redirect to `/dashboard` (or `/home`)

---

## 4. Demo data seeding

Triggered once at workspace creation. All demo records have `is_demo = true` flag.

### 4.1 Demo tickets (10 records)

Inserted into `email_conversations` (or appropriate ticket table) with mixed statuses:

| # | Subject | Status | Has reply |
|---|---|---|---|
| 1 | Where is my order #12345? | open | no |
| 2 | Can I exchange the medium for a large? | open | yes |
| 3 | My package arrived damaged | open | no |
| 4 | When will item X be back in stock? | closed | yes |
| 5 | I want to cancel my order | closed | yes |
| 6 | How long does shipping take to Germany? | open | no |
| 7 | I haven't received my refund yet | open | no |
| 8 | Wrong size sent | open | yes |
| 9 | Discount code not working | closed | yes |
| 10 | Can I change shipping address? | closed | yes |

Customer names: realistic-sounding fake names (e.g., "Sarah Johnson", "Marco Bianchi", "Lisa Chen").

### 4.2 Default macros (8 records)

Inserted into `macros` table with `is_demo = true`:

1. **WISMO Reply** — "Hi {customer_name}, thanks for reaching out! Your order is currently {status}..."
2. **Exchange Approval** — "Hi {customer_name}, we'd be happy to help with your exchange..."
3. **Refund Confirmation** — "Hi {customer_name}, your refund of {amount} has been processed..."
4. **Out of Stock Notification** — "Hi {customer_name}, unfortunately {product} is currently out of stock..."
5. **Shipping Delay Apology** — "Hi {customer_name}, we sincerely apologize for the delay..."
6. **Damaged Item Resolution** — "Hi {customer_name}, we're sorry your item arrived damaged..."
7. **Cancellation Confirmation** — "Hi {customer_name}, your order has been successfully cancelled..."
8. **Address Change Confirmation** — "Hi {customer_name}, we've updated the shipping address..."

### 4.3 Default tags (6 records)

Inserted into `tags` table with `is_demo = true`:
- Order Status (color: blue)
- Refund (color: red)
- Exchange (color: orange)
- Shipping (color: green)
- Product (color: purple)
- General (color: gray)

### 4.4 Sample analytics (30 days)

Inserted into `analytics_actions` (or relevant analytics table) with `is_demo = true`. Generated to show:
- 5–25 tickets per day (random distribution)
- Average response time: 2–6 hours
- Macro usage spread across the 8 default macros
- Realistic peaks (more on weekdays, fewer on weekends)

Watermark: All analytics charts in dashboard show subtle "DEMO DATA" overlay until cleanup happens.

---

## 5. First login UX

### 5.1 Welcome banner (top of dashboard)

Shown on first login. Dismissable. Stored in `user_profiles.welcome_dismissed_at`.

```
👋 Welcome to Lynq & Flow, [First Name]
You're on a 7-day free trial. We've added some demo data to help you
explore — connect Shopify and email when you're ready to use your own.

[Connect Shopify]  [Connect Email]  [Dismiss]
```

Banner styling: subtle gradient background, not too in-your-face. Auto-hides after first dismiss.

### 5.2 DEMO badges

Every demo record displays a yellow/orange pill with text "DEMO" in the corner of:
- Ticket cards in inbox
- Macro entries in macros library
- Tag chips
- Analytics charts (full-overlay watermark)

Tooltip on hover: "Demo data — replaced automatically when you connect Shopify and email."

### 5.3 Setup checklist widget

Persistent (until completed or dismissed) widget in the sidebar or settings menu. Clickable.

```
Setup checklist (2/6)
✓ Account created
✓ Workspace ready
○ Connect Shopify
○ Connect email account
○ Generate AI macro library
○ Invite first team member
```

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

## 7. Demo data cleanup

### 7.1 Trigger conditions

Demo data is **automatically removed** when **both** conditions are met:
1. Shopify integration `status = 'connected'`
2. At least one email account has `status = 'connected'`

This is a hard rule — partial connections (only Shopify, only email) keep demo data so user still has something to explore.

### 7.2 Cleanup actions

Triggered server-side via background job or webhook handler:

1. Delete all records where `is_demo = true` from:
   - `email_conversations`
   - `email_messages`
   - `macros`
   - `tags`
   - `analytics_actions`
2. Update `workspaces.demo_data_removed_at = now()`
3. Send notification email: "Your real data is now syncing — demo content has been removed."

### 7.3 Edge case: cleanup mid-edit

If user is currently editing a demo macro and connects Shopify+email at that moment:
- Save their edits, but flip `is_demo = false`
- That macro becomes a permanent custom macro
- Other demo macros are deleted as planned

---

## 8. Trial reminder emails

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

## 9. Trial expiry — premium UX (Day 7)

This is the highest-stakes UX moment in the entire onboarding. Must feel premium and respectful, not punitive.

### 9.1 Day 6 — Soft warning

Top-of-dashboard banner (dismissable but reappears next session):

```
⏰ Your trial ends tomorrow
Pick a plan to continue using Lynq & Flow

[See plans] [Remind me tomorrow]
```

### 9.2 Day 7 — Full-screen modal

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

### 9.3 Toggle for monthly/annual

In the modal, prominent toggle: **Monthly** / **Annual (save 20%)**

When toggled, prices update to annual figures with strikethrough monthly price showing the savings.

---

## 10. Post-payment success

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

## 11. Post-trial blocked state (no upgrade)

If user does not pay by trial end, account enters **blocked state** (option C from spec discussions).

### 11.1 Blocked state behavior

- Login still works (account preserved)
- Every page request → middleware checks `workspaces.subscription_status`
- If `expired` or `null` and trial has ended → redirect to `/pricing-required`
- The only accessible pages: `/pricing-required`, `/settings/billing`, `/logout`

### 11.2 `/pricing-required` page

Same modal as Day 7 modal, but:
- Headline: "Welcome back, [First Name]"
- Subhead: "Pick a plan to access your account again. Your data is saved for [N] more days."
- [N] dynamically calculated: 60 days minus days since expiry
- Same 4 plan cards, same Whop checkout links

### 11.3 Data retention

- `workspaces.subscription_status = 'expired'` for 60 days post-trial-end
- Day 60: scheduled job marks `workspaces.scheduled_for_deletion_at = now() + 7 days`
- User receives email warning 7 days before deletion
- Day 67: full workspace deletion (GDPR-compliant cascade delete)

If user pays during the 60-day window: status flips to `paying`, account immediately accessible, no data loss.

---

## 12. Database schema changes required

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

-- demo flag on relevant tables
alter table public.email_conversations add column if not exists is_demo boolean default false;
alter table public.email_messages add column if not exists is_demo boolean default false;
alter table public.macros add column if not exists is_demo boolean default false;
alter table public.tags add column if not exists is_demo boolean default false;
alter table public.analytics_actions add column if not exists is_demo boolean default false;

-- user_profiles for UI state
alter table public.user_profiles add column if not exists
  welcome_dismissed_at timestamptz,
  setup_checklist_dismissed_at timestamptz;
```

Indexes:

```sql
create index if not exists idx_workspaces_subscription_status on public.workspaces(subscription_status);
create index if not exists idx_workspaces_trial_ends_at on public.workspaces(trial_ends_at) where subscription_status = 'trial';
create index if not exists idx_email_conversations_is_demo on public.email_conversations(workspace_id, is_demo);
create index if not exists idx_macros_is_demo on public.macros(workspace_id, is_demo);
```

---

## 13. Build order (recommended)

For implementation, work in this sequence to enable progressive testing:

1. **Database schema migration** — add the new columns and indexes
2. **Demo data seed function** — `seedDemoData(workspaceId)` server function that inserts all demo records
3. **Signup flow** — wire up `seedDemoData` to fire post-workspace-creation
4. **DEMO badges in UI** — show pill on every demo record
5. **Welcome banner + setup checklist widget**
6. **Connect Shopify + Connect Email settings pages** (UI only, no working integration)
7. **Demo cleanup logic** — server-side check on integration connect events
8. **Trial countdown logic** — middleware + day 6 banner
9. **Day 7 premium modal** — design first, then build (separate sprint)
10. **Whop integration** — checkout, webhooks, subscription state sync
11. **Post-payment success page**
12. **Blocked state middleware + `/pricing-required` page**
13. **Trial reminder emails** — Resend integration + 5 templates
14. **Data retention cleanup job** — scheduled function for 60+7 day deletion

---

## 14. Open items / future iterations

Parked for later:
- A/B test trial length (7 vs 14 days)
- Onboarding video production (referenced in Day 1 email)
- In-app tour / tooltips (currently relying on welcome banner only)
- Self-service plan changes mid-subscription (upgrade/downgrade UI)
- Annual ↔ monthly switching post-purchase
- Refund flow UI (Whop handles backend)
- Re-activation flow for users in 60-day grace window
- Custom enterprise contracts and pricing display
