# Technical Runbook

The go-to reference when something breaks. Covers backups, database restores, and how to recover each service.

For the incident response process and who to notify, see the [Incident Response Guide](./incident-response.md).

---

## 1. Backup Procedures

### What we have

| Component | How it's backed up | Retention | Notes |
|-----------|-------------------|-----------|-------|
| **Supabase database** | Automatic daily backups + PITR | 7 days | Supabase Pro plan |
| **Vercel deployments** | Immutable deploys | Indefinite | Can roll back to any previous deploy |
| **Codebase** | Git (GitHub) | Full history | `github.com/ThommySchonis/lynq-dashboard` |
| **Environment variables** | Vercel + Supabase dashboards | N/A | Not auto-backed up — see Section 3 |

### Check that backups are working

1. Go to **Supabase Dashboard → Project Settings → Database → Backups**
2. Make sure PITR is on (look for the "Point in Time Recovery" toggle)
3. Check that the latest backup is less than 24 hours old
4. Confirm the retention window says 7 days

### Manual database export

Good to do every now and then as an extra safety net:

```bash
# Full dump via Supabase CLI (needs SUPABASE_ACCESS_TOKEN)
supabase db dump --project-ref cvrzvhnsltjubmfkcxql -f backup-YYYY-MM-DD.sql

# Or just the critical tables via psql
pg_dump -h db.cvrzvhnsltjubmfkcxql.supabase.co -U postgres \
  -t workspaces -t workspace_members -t shopify_orders -t email_conversations \
  -f critical-tables-YYYY-MM-DD.sql
```

Try to do this weekly. Store the exports somewhere safe outside Supabase.

---

## 2. Database Restore Procedures

### Point-in-time restore (PITR)

**Use when:** data got corrupted, something got accidentally deleted, or a bad migration went out.

1. Go to **Supabase Dashboard → Project Settings → Database → Backups**
2. Pick **Point in Time Recovery**
3. Choose the timestamp right before things went wrong
4. Hit restore

**Heads up:**
- This creates a **new database instance** — your connection strings will change
- You'll need to update `SUPABASE_URL` and connection strings in Vercel env vars
- Expect 5-30 minutes of downtime depending on DB size
- Everything after your chosen timestamp is gone

### Daily snapshot restore

**Use when:** PITR isn't available or the issue happened before the PITR window.

1. Go to **Supabase Dashboard → Project Settings → Database → Backups**
2. Pick the closest daily snapshot
3. Restore it
4. Same follow-up as PITR (update connection strings if needed)

### Common scenarios

**Messed up a migration (e.g., dropped a column):**
1. PITR to right before the migration ran
2. Check the data looks right
3. Write a corrected migration and apply it
4. Test on a branch database first if you can

**Accidentally deleted rows or a table:**
1. PITR to just before the deletion
2. Export the missing data from the restored instance
3. Import it back into the live database
4. Double-check everything looks correct

**Broke an RLS policy (data leaking or hidden):**
1. Figure out which tables are affected (check Sentry or user reports)
2. Write a fix migration with the corrected RLS policy
3. Apply it: `supabase db push`
4. If data was exposed to the wrong users, log it in `docs/recovery/incidents/`

---

## 3. Secrets & Environment Variables

### Where everything lives

| Location | What's there | How to get to it |
|----------|-------------|------------------|
| **Vercel** (project env vars) | All Next.js runtime secrets | Vercel Dashboard → Project → Settings → Environment Variables |
| **Supabase** (project settings) | Database URL, anon key, service role key | Supabase Dashboard → Project Settings → API |
| **Supabase** (Edge Function secrets) | Secrets for Edge Functions | `supabase secrets list` / Supabase Dashboard → Edge Functions |
| **Local** (`.env.local`) | Dev copy of everything | On your machine only |

### All the env vars you need

**Vercel (Next.js):**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public (anon) key
- `SUPABASE_SECRET_KEY` — Supabase service role key (server-only)
- `OAUTH_STATE_SECRET` — Shopify OAuth state signing
- `EMAIL_WEBHOOK_SECRET` — Email webhook verification
- `WHOP_WEBHOOK_SECRET` — Whop payment webhook verification
- `WEBHOOK_RETRY_SECRET` — Internal webhook retry auth
- `RESEND_API_KEY` — Resend email sending service
- `PAYMENTS_ENABLED` — Feature flag for billing

**Supabase Edge Functions:**
- Set secrets: `supabase secrets set KEY=VALUE`
- List what's there: `supabase secrets list`

### If you need to recreate things

**Vercel project:**
1. Grab all env vars from `.env.local`
2. Add them back in Vercel Dashboard → Settings → Environment Variables
3. Set the right scopes (Production, Preview, Development)
4. Redeploy so the new vars take effect

**Supabase project:**
1. New project = new URL, anon key, and service role key
2. Update all of those in Vercel env vars
3. Re-set Edge Function secrets: `supabase secrets set`
4. Restore the database from the latest backup
5. Make sure RLS policies are still intact

**Pro tip:** Keep an encrypted record of all your API keys and where they came from (password manager works great). Update it whenever you rotate keys.

---

## 4. Service Recovery: Supabase

### Database unreachable

**Looks like:** Everything's broken at once, "connection refused" in logs, Sentry is blowing up.

**Figure out what's wrong:**
1. Check [Supabase Status](https://status.supabase.com/) — could be a platform-wide thing
2. Check Supabase Dashboard → Database → Connection Pooling (Supavisor)
3. Check if the project got paused (free tier does this after inactivity)
4. Look at Sentry for specific error messages

**Fix it:**
- Supabase is down: wait it out, keep an eye on the status page
- Project paused: unpause it from the Supabase Dashboard
- Connection pooler acting up: restart it from the dashboard, or temporarily switch to a direct connection
- Data corruption: restore from backup (see Section 2)

**Make sure it's actually fixed:**
- Load the app, try logging in
- Check the dashboard shows data
- Confirm Sentry errors are back to normal

### RLS policy breakage

**Looks like:** Users seeing other workspaces' data, or seeing nothing at all.

**Figure out what's wrong:**
1. Check Sentry for permission or data-related errors
2. Figure out which tables are affected
3. Look at recent migrations for RLS changes

**Fix it:**
1. Write a corrected migration: `supabase migration new fix-rls-<table>`
2. Push it: `supabase db push`
3. If data was exposed, document it in `docs/recovery/incidents/`

**Make sure it's actually fixed:**
- Log in as two different workspaces, confirm they only see their own data
- Check the affected tables look right

### Edge Function failures

**Looks like:** Webhooks stop processing, cron jobs aren't running, specific features break.

**Figure out what's wrong:**
1. Check Supabase Dashboard → Edge Functions → pick the function → Logs
2. Look for errors, timeouts, or missing secrets
3. Run `supabase secrets list` to check secrets are set

**Our Edge Functions:**
| Function | What it does |
|----------|-------------|
| `shopify-sync` | Syncs Shopify orders on a schedule |
| `gmail-watch-renewal` | Keeps Gmail push notifications alive |
| `shopify-webhook` | Handles incoming Shopify webhooks |
| `webhook-retry` | Retries failed webhook deliveries |
| `webhook-cleanup` | Cleans up old processed webhooks |

**Fix it:**
1. Fix the function code if needed
2. Redeploy: `supabase functions deploy <function-name>`
3. Re-set any missing secrets: `supabase secrets list` to check, `supabase secrets set` to fix

**Make sure it's actually fixed:**
- Check function logs for successful runs
- Verify the feature it powers is working (e.g., orders are syncing again)

---

## 5. Service Recovery: Vercel

### Bad deployment

**Looks like:** App crashes, blank pages, new errors right after a deploy.

**Figure out what's wrong:**
1. Check Vercel Dashboard → Deployments → latest deploy
2. Look at the build logs
3. Check the Functions tab for runtime errors

**Fix it:**
- **From the dashboard:** Vercel Dashboard → Deployments → find the last good deploy → "..." → "Redeploy"
- **From the CLI:** `vercel rollback`
- Both are instant, zero downtime

**Make sure it's actually fixed:**
- Load the app, click around
- Check Sentry isn't showing new errors
- Confirm the rollback is now marked as "Production"

### Build failures

**Looks like:** Deploy fails, but the previous version stays live (so users aren't affected).

**Figure out what's wrong:**
1. Read the build logs: Vercel Dashboard → Deployments → failed deploy → Build Logs
2. Usually it's a TypeScript error, missing env var, or dependency issue

**Fix it:**
1. Fix the code locally
2. Push to trigger a new deploy
3. If it's an env var issue: fix it in Vercel Dashboard → Settings → Environment Variables, then redeploy

### Cron jobs not running

**Looks like:** Data going stale — usage warnings not sent, trials not expiring, old data not getting cleaned up.

**Figure out what's wrong:**
1. Check Vercel Dashboard → Crons tab for run history
2. Make sure `vercel.json` has the right config

**Our cron jobs:**
| Path | Schedule | What it does |
|------|----------|-------------|
| `/api/cron/data-retention` | `0 3 * * *` (daily 3am) | Cleans up old data |
| `/api/cron/trial-expiry` | `30 3 * * *` (daily 3:30am) | Expires trial workspaces |
| `/api/cron/usage-warnings` | `0 * * * *` (every hour) | Sends usage limit warnings |

**Fix it:**
1. Cron just stopped: check Vercel for errors, try hitting the endpoint manually (`curl https://lynq-dashboard.vercel.app/api/cron/usage-warnings`)
2. `vercel.json` got messed up: restore from git and redeploy
3. Endpoint itself is broken: fix the code, push, redeploy

**Make sure it's actually fixed:**
- Check the Crons tab shows a recent successful run
- Hit each endpoint manually and confirm you get a 200

### Domain/DNS issues

**Looks like:** App won't load on the custom domain, SSL errors, DNS not resolving.

**Figure out what's wrong:**
1. Check Vercel Dashboard → Project → Domains tab
2. Make sure DNS records point to Vercel (CNAME or A record)
3. Check SSL certificate status

**Fix it:**
1. DNS wrong: update records at your domain registrar to point to Vercel
2. SSL expired: Vercel handles renewals automatically — try removing and re-adding the domain
3. Domain gone from Vercel: re-add it in Dashboard → Domains → Add Domain

**Make sure it's actually fixed:**
- Hit `https://lynq-dashboard.vercel.app` and confirm it loads
- Check the padlock icon in the browser (SSL is valid)
- Try both root and www

---

## 6. Service Recovery: Shopify Integration

### OAuth token expiry

**Looks like:** Shopify API calls returning 401, orders stop syncing, store shows as disconnected.

**Figure out what's wrong:**
1. Check Sentry for Shopify 401 errors
2. Look at the `integrations` table for the workspace's store credentials
3. Verify the Shopify app is still installed in the merchant's Shopify admin

**Fix it:**
1. Have the workspace owner reconnect via Settings → Integrations → Reconnect Shopify
2. That kicks off a fresh OAuth flow and saves new credentials

**Make sure it's actually fixed:**
- Orders should start showing up on the dashboard again
- Check the `integrations` table has fresh credentials

### Webhook delivery failures

**Looks like:** New orders or events from Shopify aren't showing up.

**Figure out what's wrong:**
1. Check Shopify Admin → Settings → Notifications → Webhooks for failed deliveries
2. Look at the `shopify-webhook` Edge Function logs in Supabase
3. Check Sentry for webhook processing errors

**Fix it:**
1. Endpoint down: fix and redeploy the Edge Function
2. Missed webhooks: Shopify retries on its own for 48 hours. For older stuff, kick off a manual sync
3. Webhook registration lost: re-register in Shopify Admin or have the user reconnect the integration

**Make sure it's actually fixed:**
- Create a test order in Shopify — it should show up in the dashboard
- Check Edge Function logs for successful processing

### Order sync drift

**Looks like:** Order counts in the dashboard don't match Shopify, recent orders are missing.

**Figure out what's wrong:**
1. Compare order counts between dashboard and Shopify admin
2. Check `shopify-sync` Edge Function logs for errors
3. Look at `shopify_orders` table — when was the last order synced?

**Fix it:**
1. Fix any issues with the `shopify-sync` Edge Function
2. Redeploy if needed: `supabase functions deploy shopify-sync`
3. The next sync cycle will catch up on what's missing

**Make sure it's actually fixed:**
- Wait for the next sync or redeploy to trigger one
- Compare order counts again

---

## 7. Service Recovery: Email Integration (Gmail / Outlook)

### Gmail watch expiry

**Looks like:** New emails stop showing up in the inbox, no push notifications from Gmail.

**Figure out what's wrong:**
1. Check `gmail-watch-renewal` Edge Function logs in Supabase
2. Gmail watches expire every 7 days — the renewal cron should handle this
3. Check `email_accounts` table for watch expiry timestamps

**Fix it:**
1. If the cron broke: fix the `gmail-watch-renewal` Edge Function
2. Redeploy: `supabase functions deploy gmail-watch-renewal`
3. If you need to manually re-register: trigger the watch renewal endpoint directly

**Make sure it's actually fixed:**
- Send a test email to the connected Gmail account
- Should show up in the Lynq inbox within a couple minutes

### Outlook token refresh failure

**Looks like:** Outlook inboxes stop receiving emails, Microsoft Graph API errors in Sentry.

**Figure out what's wrong:**
1. Check Sentry for Microsoft Graph 401/403 errors
2. Look at `email_accounts` for Outlook accounts with expired tokens
3. Make sure the Azure AD app registration is still active

**Fix it:**
1. Have the user reconnect Outlook via Settings → Integrations → Reconnect Email
2. That runs a fresh OAuth flow with Microsoft

**Make sure it's actually fixed:**
- Send a test email to the Outlook account
- Should appear in the Lynq inbox

### Email forwarding breakage

**Looks like:** Forwarded emails aren't arriving, forwarding setup shows errors.

**Figure out what's wrong:**
1. Check Sentry for webhook endpoint errors
2. Verify DNS records are set up correctly for the domain

**What the DNS records should look like:**
- **SPF (TXT):** `v=spf1 include:_spf.google.com ~all` (Google) or `v=spf1 include:spf.protection.outlook.com ~all` (Microsoft)
- **DMARC (TXT):** `v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>; ...` at `_dmarc.<domain>`
- **MX records:** Google (`ASPMX.L.GOOGLE.COM` priority 1, etc.) or Microsoft (`<domain>.mail.protection.outlook.com`)
- **DKIM:** Google uses `google._domainkey`, Microsoft handles it automatically

You can also check with the DNS endpoint: `GET /api/email/dns?domain=<domain>&provider=<google|microsoft>`

**Fix it:**
1. Compare current DNS records against the baseline above
2. Fix anything that's missing or wrong in the domain's DNS settings
3. Wait for propagation (can take up to 24-48 hours — check at [mxtoolbox.com](https://mxtoolbox.com))
4. Make sure the webhook endpoint is responding

**Make sure it's actually fixed:**
- Send a test email to the forwarding address
- Should show up in the Lynq inbox

---

## 8. Post-Recovery Checklist

Run through this after any recovery to make sure everything's actually back to normal:

- [ ] **Auth:** Log in and out — does it work?
- [ ] **Database:** Dashboard loads, shows real data
- [ ] **Shopify orders:** Recent orders are there, timestamps look right
- [ ] **Inbox:** Send a test email, make sure it arrives
- [ ] **Cron jobs:** Vercel Crons tab shows recent successful runs for all three jobs
- [ ] **Edge Functions:** Supabase shows recent invocations for all five functions
- [ ] **Sentry:** No new error spikes or weird exceptions
- [ ] **Workspace isolation:** Spot-check a couple workspaces — each should only see their own data
