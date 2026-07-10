begin;

-- Tighten workspace-assets storage policies.
-- The original bucket (20260624090417_add-workspace-assets-bucket.sql) granted
-- the public/anon role insert/update/delete on every object via
-- with-check/using (bucket_id = 'workspace-assets'). The only legitimate writer
-- is the logo route (routes/workspaces.ts), which uses the service-role admin
-- client and bypasses RLS — so these write policies are pure attack surface
-- (anyone holding the anon key could upload, overwrite, or delete any object).
-- Drop the three write policies; keep only public read (needed for public URLs).
drop policy if exists "workspace_assets_upload" on storage.objects;
drop policy if exists "workspace_assets_update" on storage.objects;
drop policy if exists "workspace_assets_delete" on storage.objects;

commit;
