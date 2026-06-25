begin;

-- Storage bucket for workspace assets (logos uploaded via POST /workspaces/logo)
-- Public bucket: logo_url is served as a public URL on the dashboard.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-assets',
  'workspace-assets',
  true,
  2097152, -- 2 MB, matches MAX_BYTES in routes/workspaces.ts
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "workspace_assets_upload"
  on storage.objects for insert
  with check (bucket_id = 'workspace-assets');

create policy "workspace_assets_read"
  on storage.objects for select
  using (bucket_id = 'workspace-assets');

create policy "workspace_assets_update"
  on storage.objects for update
  using (bucket_id = 'workspace-assets');

create policy "workspace_assets_delete"
  on storage.objects for delete
  using (bucket_id = 'workspace-assets');

commit;
