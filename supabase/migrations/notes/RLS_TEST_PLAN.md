# RLS Test Plan — workspace-aware policies

Test plan voor `20260505_rls_workspace_aware_policies.sql`. Doel: bevestigen dat de 19 helpdesk-tabellen workspace-aware RLS hebben, dat data isolatie 100% werkt, en dat de bestaande server-side routes ongestoord blijven.

## Vooraf — wat verandert er

- Alle 19 helpdesk-tabellen krijgen `ROW LEVEL SECURITY` aan (idempotent).
- 76 policies in totaal (16 data-tabellen × 4 + 3 meta-tabellen × 4).
- 3 helper functies in `public`: `user_workspace_ids()`, `user_role_in_workspace(uuid)`, `user_is_workspace_owner(uuid)`. Allemaal `SECURITY DEFINER` zodat ze `workspace_members` kunnen lezen zonder RLS-recursie.

### Belangrijk: service-role bypass

De server-side API routes gebruiken `supabaseAdmin` (service role key). **Service-role bypassed RLS volledig.** Deze migration heeft dus geen invloed op `app/api/*` routes — die blijven gewoon werken zoals ze deden, met de expliciete `eq('workspace_id', ctx.workspaceId)` checks die in Block C zijn ingebouwd.

RLS dekt:
- Directe browser-side queries via `lib/supabase.js` (anon key + JWT)
- Eventuele toekomstige client-side Supabase-queries
- Defense-in-depth voor als iemand per ongeluk service-role weghaalt

## Pre-deploy checklist

- [ ] `lib/supabase.js` gebruikt `NEXT_PUBLIC_SUPABASE_ANON_KEY` (niet service-role) — het hoort, maar dubbelcheck.
- [ ] `lib/supabaseAdmin.js` gebruikt `SUPABASE_SECRET_KEY` (service-role) — bypass RLS.
- [ ] Migration handmatig draaien in Supabase SQL editor (project `cvrzvhnsltjubmfkcxql`).
- [ ] Verwacht onderaan: `NOTICE: OK — 76 RLS policies created across helpdesk tables`. Als < 60 → exception, transactie rollback.

## Verificatiestappen

### 1. Bevestig RLS aan op alle 19 tabellen

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'workspaces','workspace_members','workspace_invites','team_members',
    'clients','integrations','email_accounts','email_conversations',
    'email_messages','shopify_orders','shipments','analytics_actions',
    'ai_settings','agents','agent_actions','time_sessions','macros',
    'macro_onboarding','tags'
  )
order by tablename;
```
Verwacht: 19 rijen, allemaal `rowsecurity = true`.

### 2. Bevestig policy-aantal per tabel

```sql
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in (
    'workspaces','workspace_members','workspace_invites','team_members',
    'clients','integrations','email_accounts','email_conversations',
    'email_messages','shopify_orders','shipments','analytics_actions',
    'ai_settings','agents','agent_actions','time_sessions','macros',
    'macro_onboarding','tags'
  )
group by tablename
order by tablename;
```
Verwacht: elke tabel heeft `policy_count = 4`. Totaal 76.

### 3. Bevestig dat de helper-functies bestaan en `SECURITY DEFINER` zijn

```sql
select proname, prosecdef as is_security_definer, provolatile
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('user_workspace_ids', 'user_role_in_workspace', 'user_is_workspace_owner')
order by proname;
```
Verwacht: 3 rijen, `is_security_definer = true`, `provolatile = s` (stable).

### 4. Functioneel — agent ziet alleen eigen workspace

**Setup**: workspace `1d1405e2-...` heeft 2 members:
- `info@lynqagency.com` (owner)
- `info.lynqagency@gmail.com` (agent)

**Test 4a — Owner login, lees macros**:
1. Open `lynq-dashboard.vercel.app` in incognito.
2. Login als `info@lynqagency.com`.
3. Open browser devtools console:
   ```js
   const { data, error } = await supabase.from('macros').select('id, name')
   console.log({ data, error })
   ```
4. Verwacht: `data` is een array (kan leeg zijn als nog geen macros), `error` is `null`. Geen RLS-violation.

**Test 4b — Agent login, zelfde query**:
1. Tweede incognito venster.
2. Login als `info.lynqagency@gmail.com`.
3. Zelfde query in console.
4. Verwacht: zelfde resultaten als 4a — agent en owner delen workspace, dus zien dezelfde macros.

**Test 4c — Cross-workspace probe**:
1. Maak een tweede testworkspace + testuser via SQL editor (of via signup-flow).
2. Login als die testuser.
3. Probeer macros van workspace `1d1405e2-...` te lezen via expliciete WHERE:
   ```js
   const { data, error } = await supabase.from('macros')
     .select('*')
     .eq('workspace_id', '1d1405e2-accd-4c22-bf3f-936327f02fef')
   console.log({ data, error })
   ```
4. Verwacht: `data` is een lege array, `error` is `null`. RLS filtert silently.

### 5. Rol-restricties — owner-only operations

**Test 5a — Agent kan workspace niet updaten**:
1. Login als `info.lynqagency@gmail.com` (agent).
2. Console:
   ```js
   const { data, error } = await supabase.from('workspaces')
     .update({ name: 'Hacked' })
     .eq('id', '1d1405e2-accd-4c22-bf3f-936327f02fef')
   console.log({ data, error })
   ```
3. Verwacht: `data` is een lege array (`[]` — UPDATE matched 0 rows door RLS), `error` is `null`. Workspace naam onveranderd.

**Test 5b — Owner kan wel updaten**:
1. Login als `info@lynqagency.com` (owner).
2. Zelfde query met andere naam.
3. Verwacht: `data` heeft 1 rij, `error` is `null`. Naam is gewijzigd.
4. Reset naam meteen terug.

**Test 5c — Agent kan members niet inviten**:
1. Agent in console:
   ```js
   const { data, error } = await supabase.from('workspace_invites')
     .insert({
       workspace_id: '1d1405e2-accd-4c22-bf3f-936327f02fef',
       email: 'attacker@evil.com',
       role: 'agent',
       token: 'fake',
       expires_at: '2026-12-31',
     })
   console.log({ data, error })
   ```
2. Verwacht: `error` met code 42501 of "new row violates row-level security policy".

### 6. Server-side routes blijven werken

Service-role bypass moet onaangetast zijn. Quick sanity:

- [ ] Open `/inbox` — laadt zonder errors
- [ ] Open `/settings/personal/profile` — laadt
- [ ] Open `/settings/integrations` (of het exacte pad voor integrations) — laadt
- [ ] Macros pagina — laadt
- [ ] Members pagina — laadt + ziet 2 members

Bevestig in Vercel logs dat geen enkele API route 500's terugkrijgt na de migration. Als er wel een 500 ophopt:
1. Dat zou betekenen dat de route per ongeluk `lib/supabase.js` (anon) gebruikt waar `lib/supabaseAdmin.js` zou moeten — fix is dan in de code, niet in RLS.
2. Of dat de helper-function een edge-case raakt (bv. ongeauthenticeerde call). Check Postgres logs.

### 7. `pg_policies` snapshot voor audit

Bewaar een dump van alle policies na migratie als reference:
```sql
select schemaname, tablename, policyname, permissive, roles, cmd,
       qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'workspaces','workspace_members','workspace_invites','team_members',
    'clients','integrations','email_accounts','email_conversations',
    'email_messages','shopify_orders','shipments','analytics_actions',
    'ai_settings','agents','agent_actions','time_sessions','macros',
    'macro_onboarding','tags'
  )
order by tablename, policyname;
```
Output bewaren als `supabase/migrations/notes/RLS_SNAPSHOT_20260505.txt` voor latere diff bij wijzigingen.

## Rollback

Niet aanbevolen na deploy, maar mogelijk:

```sql
-- Disable RLS op alle 19 tabellen
do $$
declare t text;
begin
  for t in select unnest(array[
    'workspaces','workspace_members','workspace_invites','team_members',
    'clients','integrations','email_accounts','email_conversations',
    'email_messages','shopify_orders','shipments','analytics_actions',
    'ai_settings','agents','agent_actions','time_sessions','macros',
    'macro_onboarding','tags'
  ])
  loop
    execute format('alter table public.%I disable row level security', t);
  end loop;
end $$;

-- Drop alle policies (zelfde DO-block als STAP B)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'workspaces','workspace_members','workspace_invites','team_members',
        'clients','integrations','email_accounts','email_conversations',
        'email_messages','shopify_orders','shipments','analytics_actions',
        'ai_settings','agents','agent_actions','time_sessions','macros',
        'macro_onboarding','tags'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Drop helper functions
drop function if exists public.user_workspace_ids();
drop function if exists public.user_role_in_workspace(uuid);
drop function if exists public.user_is_workspace_owner(uuid);
```

## Bekende caveats

1. **Service-role queries bypassen RLS**. Dit is bewust — de server-side API routes vertrouwen op de Block C `eq('workspace_id', ctx.workspaceId)` filter. RLS is hier "defense in depth", niet de primaire toegangscontrole.
2. **`workspaces.insert` policy is permissief** (`auth.uid() is not null`). Iedereen die ingelogd is kan een workspace aanmaken. Direct daarna moet via `provision_workspace` RPC een `workspace_members` row gemaakt worden, anders kan de user de net-aangemaakte workspace niet meer lezen. Bestaand patroon, niet gewijzigd door deze migration.
3. **Helpers hebben `set search_path = public, pg_temp` — best-practice toegepast.**
4. **`team_members` is workspace-scoped**, niet per-user. Iedere member van een workspace ziet de hele teamlijst van die workspace. Komt overeen met de bestaande `/api/time` admin-branch logic.
5. **Geen role-onderscheid in data-tabel policies**. Zowel agent als admin als owner hebben volledig CRUD-recht op alle data binnen hun workspace. Rol-checks (bijv. "alleen owner mag macro deleten") gebeuren server-side in `lib/permissions.js`. Als je RLS dat strenger wil maken, voeg ik een `user_role_in_workspace(workspace_id) in ('owner','admin')` toe aan de DELETE-policies van bepaalde tabellen — dat is een follow-up.
6. **Helper-function performance**: `workspace_id in (select public.user_workspace_ids())` voert de SETOF-functie uit voor élke rij-check. Voor grotere queries kan dit prestatieverlies opleveren. Alternatief: `workspace_id = any(array(select public.user_workspace_ids()))` of een geïndexeerde view. Geen acuut probleem met huidige dataset (1 workspace × kleine tabellen).
