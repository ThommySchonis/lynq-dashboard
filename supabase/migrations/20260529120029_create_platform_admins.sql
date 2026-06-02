create table if not exists platform_admins (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  role       text not null check (role in ('admin', 'tester')),
  created_at timestamptz not null default now()
);

-- Seed current admins
insert into platform_admins (email, role) values
  ('info@lynqagency.com',     'admin'),
  ('denver9523@gmail.com',    'admin'),
  ('del.socorro10@gmail.com', 'admin')
on conflict (email) do nothing;
