# Incident Response Guide

What to do when things break. This is for both the developer and the platform owner — you don't need to be technical to follow along.

- **Developer** — digs in, figures out what's wrong, and fixes it
- **Owner** — stays in the loop, handles client communication if needed

For the actual fix-it steps, check the [Technical Runbook](./technical-runbook.md).

---

## How Bad Is It?

| Level | Name | What's happening | How fast to respond |
|-------|------|------------------|---------------------|
| SEV1 | Critical | Everything's down — nobody can log in, database is gone | Drop everything |
| SEV2 | Major | Something important is broken — orders aren't syncing, inbox is dead, deploys are failing | Within 30 minutes |
| SEV3 | Minor | Things are slow or flaky — intermittent errors, one integration acting up | Within 2 hours |
| SEV4 | Low | Small stuff — a UI glitch, a non-critical cron running late | Next business day |

### Quick way to figure it out

- **Can users log in?** No → SEV1
- **Is a core feature totally broken (orders, inbox, settings)?** Yes → SEV2
- **Is something slow or hit-or-miss?** → SEV3
- **Is it cosmetic or not blocking anyone?** → SEV4

---

## What Happens When Something Goes Wrong

### SEV1/SEV2 — the serious stuff

1. **Alert comes in** — Sentry, Vercel, or Supabase pings Slack
2. **Developer checks it out** — figure out how bad it is, drop a message in Slack
3. **Developer digs in** — follow the [Technical Runbook](./technical-runbook.md) to fix it
4. **Developer keeps owner posted** — Slack message when the cause is found and again when it's fixed
5. **Write it up** — developer writes a quick incident brief within 24 hours (template below)

### SEV3/SEV4 — the smaller stuff

Developer looks into it during normal hours. Posts a quick summary in Slack when it's sorted. No need to bug the owner in real-time for these.

### Owner spots something first?

Just drop a message in Slack — what you were doing, what went wrong, any error messages or screenshots you can grab. The developer will take it from there.

---

## Message Templates

### Developer → Owner (Slack)

**Something's up:**
> Hey, looks like [describe issue] is acting up. Looking into it now — it's a [SEV level]. I'll ping you again in [15/30] minutes with an update.

**Found it:**
> Found the issue — [brief non-technical explanation]. Working on a fix now, should take about [estimated time].

**All good:**
> Fixed as of [time]. [One sentence on what happened and what was done]. I'll write up a quick summary by tomorrow.

### Client-facing messages (if needed — SEV1/SEV2 only)

For the owner to send to clients:

**We're on it:**
> Hey, we're having a bit of trouble with [feature name] right now. The team's on it and we'll keep you posted.

**Back to normal:**
> [Feature name] is back up and running. Sorry about that, and thanks for hanging in there. Let us know if anything still looks off.

---

## Post-Incident Brief

After any SEV1 or SEV2, write a quick brief within 24 hours. Save it to `docs/recovery/incidents/YYYY-MM-DD-<short-description>.md`.

### Template

```markdown
# Incident: [Short Description]

**Date:** YYYY-MM-DD
**Severity:** SEV[1-4]
**Duration:** [start time] — [end time] ([total duration])

## What happened

- **HH:MM** — Alert came in: [what triggered it]
- **HH:MM** — Started looking into it
- **HH:MM** — Found the cause: [what]
- **HH:MM** — Applied the fix: [what was done]
- **HH:MM** — Confirmed everything's back to normal

## Why it broke

[2-3 sentences — what went wrong and why]

## Who was affected

- **Users:** [all users, specific workspaces, etc.]
- **Features:** [what was down or degraded]
- **Data:** [any data lost or corrupted, or "none"]

## What we'll do to prevent this

- [ ] [Action item 1]
- [ ] [Action item 2]
```

---

## Where Alerts Come From

| Source | What it watches | Where you'll see it |
|--------|----------------|---------------------|
| **Sentry** | App errors, crashes, unhandled exceptions | Slack |
| **Vercel** | Deploy failures, build errors | Slack / Vercel dashboard |
| **Supabase** | Database health, connection problems | Supabase dashboard |

### Dashboards to check

- **Sentry:** Look for error spikes or new exceptions you haven't seen before
- **Vercel:** Deployments tab for deploy status, Functions tab for runtime errors
- **Supabase:** Database tab for connection pool health, Logs tab for query errors
