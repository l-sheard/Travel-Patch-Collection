-- Travel Patches: database schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: all statements are idempotent.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- patches
-- ---------------------------------------------------------------------------

create table if not exists patches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  location_name text not null,
  country text,
  lat double precision,
  lng double precision,
  geocode_raw jsonb,

  trip_start_date date,
  trip_end_date date,
  purchased_date date,

  companions text[] not null default '{}',
  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patches_user_id_idx on patches (user_id);

-- Where you stayed for this specific stop — a small bounded list scoped to
-- one patch, so a jsonb array is simpler here than a separate table:
-- [{ "name": "...", "url": "..." }].
alter table patches add column if not exists accommodations jsonb not null default '[]';

-- Per-stop rating/review/journal, independent of the trip-level versions below.
alter table patches add column if not exists rating smallint check (rating between 1 and 5);
alter table patches add column if not exists review text;
alter table patches add column if not exists itinerary text;
alter table patches add column if not exists highlights text;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists patches_set_updated_at on patches;
create trigger patches_set_updated_at
  before update on patches
  for each row execute function set_updated_at();

alter table patches enable row level security;

drop policy if exists "patches_select_own" on patches;
create policy "patches_select_own" on patches
  for select using (auth.uid() = user_id);

drop policy if exists "patches_insert_own" on patches;
create policy "patches_insert_own" on patches
  for insert with check (auth.uid() = user_id);

drop policy if exists "patches_update_own" on patches;
create policy "patches_update_own" on patches
  for update using (auth.uid() = user_id);

drop policy if exists "patches_delete_own" on patches;
create policy "patches_delete_own" on patches
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- trips
-- Optional grouping so multiple patches from one trip can link to each other.
-- ---------------------------------------------------------------------------

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx on trips (user_id);

-- Trip-level journal fields, shared across every patch/stop on the trip.
alter table trips add column if not exists itinerary text;
alter table trips add column if not exists highlights text;
alter table trips add column if not exists trip_review text;
alter table trips add column if not exists rating smallint check (rating between 1 and 5);

alter table trips enable row level security;

drop policy if exists "trips_select_own" on trips;
create policy "trips_select_own" on trips
  for select using (auth.uid() = user_id);

drop policy if exists "trips_insert_own" on trips;
create policy "trips_insert_own" on trips
  for insert with check (auth.uid() = user_id);

drop policy if exists "trips_update_own" on trips;
create policy "trips_update_own" on trips
  for update using (auth.uid() = user_id);

drop policy if exists "trips_delete_own" on trips;
create policy "trips_delete_own" on trips
  for delete using (auth.uid() = user_id);

alter table patches add column if not exists trip_id uuid references trips(id) on delete set null;
create index if not exists patches_trip_id_idx on patches (trip_id);

-- ---------------------------------------------------------------------------
-- patch_photos
-- ---------------------------------------------------------------------------

create table if not exists patch_photos (
  id uuid primary key default gen_random_uuid(),
  patch_id uuid not null references patches(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  role text not null default 'original' check (role in ('original', 'reference')),

  storage_path_original text not null,
  storage_path_gallery text,
  gallery_status text not null default 'pending'
    check (gallery_status in ('pending', 'processing', 'done', 'failed')),

  embedding vector(1024),
  phash bigint,

  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists patch_photos_patch_id_idx on patch_photos (patch_id);

alter table patch_photos enable row level security;

drop policy if exists "patch_photos_select_own" on patch_photos;
create policy "patch_photos_select_own" on patch_photos
  for select using (auth.uid() = user_id);

drop policy if exists "patch_photos_insert_own" on patch_photos;
create policy "patch_photos_insert_own" on patch_photos
  for insert with check (auth.uid() = user_id);

drop policy if exists "patch_photos_update_own" on patch_photos;
create policy "patch_photos_update_own" on patch_photos
  for update using (auth.uid() = user_id);

drop policy if exists "patch_photos_delete_own" on patch_photos;
create policy "patch_photos_delete_own" on patch_photos
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage buckets
-- Both private; the app reads photos via signed URLs / the authenticated client.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('patch-originals', 'patch-originals', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('patch-gallery', 'patch-gallery', false)
on conflict (id) do nothing;

-- Objects must live under a "<user_id>/..." path so this policy can scope
-- access to their owner (see src/lib/storagePaths.ts for the upload path shape).

drop policy if exists "patch_originals_select_own" on storage.objects;
create policy "patch_originals_select_own" on storage.objects
  for select using (
    bucket_id = 'patch-originals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "patch_originals_insert_own" on storage.objects;
create policy "patch_originals_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'patch-originals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "patch_originals_update_own" on storage.objects;
create policy "patch_originals_update_own" on storage.objects
  for update using (
    bucket_id = 'patch-originals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "patch_originals_delete_own" on storage.objects;
create policy "patch_originals_delete_own" on storage.objects
  for delete using (
    bucket_id = 'patch-originals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "patch_gallery_select_own" on storage.objects;
create policy "patch_gallery_select_own" on storage.objects
  for select using (
    bucket_id = 'patch-gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "patch_gallery_insert_own" on storage.objects;
create policy "patch_gallery_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'patch-gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "patch_gallery_update_own" on storage.objects;
create policy "patch_gallery_update_own" on storage.objects
  for update using (
    bucket_id = 'patch-gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "patch_gallery_delete_own" on storage.objects;
create policy "patch_gallery_delete_own" on storage.objects
  for delete using (
    bucket_id = 'patch-gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
