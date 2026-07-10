begin;

-- Value Feed cover images: optional cover image on broadcasts, shown on the
-- featured card. Uploaded via POST /api/admin/broadcasts/image.
alter table public.broadcasts
  add column if not exists image_url text;

-- Public bucket for broadcast cover images (mirrors workspace-assets).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'broadcast-assets',
  'broadcast-assets',
  true,
  2097152, -- 2 MB, matches the upload route limit
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "broadcast_assets_read"
  on storage.objects for select
  using (bucket_id = 'broadcast-assets');

commit;
