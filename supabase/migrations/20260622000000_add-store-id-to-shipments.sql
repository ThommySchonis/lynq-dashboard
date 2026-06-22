-- ParcelPanel tracking is per-store: scope shipments by store_id.
alter table public.shipments
  add column if not exists store_id uuid references public.stores(id) on delete cascade;

create index if not exists shipments_workspace_store_idx
  on public.shipments (workspace_id, store_id);

-- Replace the (workspace_id, tracking_number) unique index with a store-aware one
-- so the same tracking number can exist for different stores, and upserts key on store.
drop index if exists public.uq_shipments_workspace_tracking;

create unique index if not exists uq_shipments_ws_store_tracking
  on public.shipments (workspace_id, store_id, tracking_number);
