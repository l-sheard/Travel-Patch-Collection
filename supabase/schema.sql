-- My Travel Patches: database schema
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
-- [{ "name", "url", "rating": 1-5|null, "notes", "nights": number|null, "people": number|null }].
alter table patches add column if not exists accommodations jsonb not null default '[]';

-- Good restaurants for this stop — same jsonb-array pattern:
-- [{ "name": "...", "url": "..." }]. Memorable dishes (which need a photo
-- each) live in the separate patch_dishes table below instead.
alter table patches add column if not exists restaurants jsonb not null default '[]';

-- Per-stop rating/review/journal, independent of the trip-level versions below.
alter table patches add column if not exists rating smallint check (rating between 1 and 5);
alter table patches add column if not exists review text;
alter table patches add column if not exists itinerary text;
alter table patches add column if not exists highlights text;

-- Cost of this specific stop. No currency column — displayed as a plain
-- number since the app doesn't ask which currency the user tracks in.
alter table patches add column if not exists price numeric(10, 2);

-- Free-form tags from a fixed vocabulary (see src/lib/holidayTypes.ts) —
-- text[] rather than an enum so the app-side list can grow without a migration.
alter table patches add column if not exists holiday_types text[] not null default '{}';

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

-- The insert/update policies for patches are further down, immediately after
-- the trip_id column is added: they also check that the referenced trip is
-- yours, which can't be written here because trips doesn't exist yet.

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
alter table trips add column if not exists price numeric(10, 2);

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

-- Owning the row isn't enough: the trip it points at has to be yours too.
-- Foreign keys are validated by the system and so ignore RLS, which means
-- `auth.uid() = user_id` alone would let a patch be filed under someone else's
-- trip. create_patch_with_cover() already refuses that explicitly; these
-- policies close the same hole for a plain insert or update.
--
-- The update policy has to restate `auth.uid() = user_id`: naming `with check`
-- replaces the implicit copy of `using`, so leaving it out here would drop the
-- protection against reassigning a row to another user.

drop policy if exists "patches_insert_own" on patches;
create policy "patches_insert_own" on patches
  for insert with check (
    auth.uid() = user_id
    and (
      trip_id is null
      or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
    )
  );

drop policy if exists "patches_update_own" on patches;
create policy "patches_update_own" on patches
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      trip_id is null
      or exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid())
    )
  );

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

-- Small square version of the gallery image, used by the dashboard cards so
-- they don't download the full-size sticker. Nullable: photos processed before
-- this existed, or whose thumbnail failed to generate, simply fall back to the
-- gallery image.
alter table patch_photos add column if not exists storage_path_thumb text;

create index if not exists patch_photos_patch_id_idx on patch_photos (patch_id);

alter table patch_photos enable row level security;

drop policy if exists "patch_photos_select_own" on patch_photos;
create policy "patch_photos_select_own" on patch_photos
  for select using (auth.uid() = user_id);

-- Owning the row isn't enough: the patch it hangs off has to be yours too.
-- Foreign keys are validated by the system and so ignore RLS, so without the
-- exists() a row could be attached to another user's patch. That leaks
-- nothing by itself — select is still scoped to your own rows — but an
-- is_cover row planted on someone else's patch would collide with their cover
-- in the (non-RLS-scoped) patch_photos_one_cover_per_patch unique index and
-- permanently break replace_patch_cover() for them.
--
-- Update needs the same clause or the insert check is pointless: you could
-- insert against your own patch and then repoint patch_id. And naming
-- `with check` replaces the implicit copy of `using`, so it has to restate
-- `auth.uid() = user_id` to keep blocking row handover to another user.

drop policy if exists "patch_photos_insert_own" on patch_photos;
create policy "patch_photos_insert_own" on patch_photos
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from patches p where p.id = patch_id and p.user_id = auth.uid())
  );

drop policy if exists "patch_photos_update_own" on patch_photos;
create policy "patch_photos_update_own" on patch_photos
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from patches p where p.id = patch_id and p.user_id = auth.uid())
  );

drop policy if exists "patch_photos_delete_own" on patch_photos;
create policy "patch_photos_delete_own" on patch_photos
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- patch_dishes
-- Favorite dishes for a stop — optionally has its own photo (a text-only
-- dish entry is fine), so unlike restaurants/accommodations this is a real
-- table, not a jsonb array.
-- ---------------------------------------------------------------------------

create table if not exists patch_dishes (
  id uuid primary key default gen_random_uuid(),
  patch_id uuid not null references patches(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  name text not null,
  storage_path text,

  created_at timestamptz not null default now()
);

-- No-op if already nullable — safe to re-run.
alter table patch_dishes alter column storage_path drop not null;

create index if not exists patch_dishes_patch_id_idx on patch_dishes (patch_id);

alter table patch_dishes enable row level security;

drop policy if exists "patch_dishes_select_own" on patch_dishes;
create policy "patch_dishes_select_own" on patch_dishes
  for select using (auth.uid() = user_id);

-- Same parent-ownership check as patch_photos above, for the same reason.

drop policy if exists "patch_dishes_insert_own" on patch_dishes;
create policy "patch_dishes_insert_own" on patch_dishes
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from patches p where p.id = patch_id and p.user_id = auth.uid())
  );

drop policy if exists "patch_dishes_update_own" on patch_dishes;
create policy "patch_dishes_update_own" on patch_dishes
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from patches p where p.id = patch_id and p.user_id = auth.uid())
  );

drop policy if exists "patch_dishes_delete_own" on patch_dishes;
create policy "patch_dishes_delete_own" on patch_dishes
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Patch photo invariants
--
-- is_cover marks the photo *of the physical patch* — the gallery sticker and
-- the scan-match reference. It is a role, not a preference: the other rows on
-- a patch are trip/holiday photos and are never promoted into it. So:
--   * at most one cover per patch          -> partial unique index (immediate)
--   * never zero once a patch has photos   -> deferred constraint trigger
--   * the cover is never deleted on its own, only replaced
--                                          -> falls out of the same trigger
--   * replace_patch_cover() below is the only thing that writes is_cover.
-- ---------------------------------------------------------------------------

-- One-time data fix so the unique index can be created on existing data.
-- Keeps the newest cover; older duplicates become trip photos rather than
-- being deleted, so no photo is ever lost by applying this file.
update patch_photos p
set is_cover = false
where p.is_cover
  and exists (
    select 1
    from patch_photos q
    where q.patch_id = p.patch_id
      and q.is_cover
      and (q.created_at, q.id) > (p.created_at, p.id)
  );

create unique index if not exists patch_photos_one_cover_per_patch
  on patch_photos (patch_id)
  where is_cover;

-- Deferred so replace_patch_cover() can delete the outgoing cover and insert
-- the incoming one inside a single transaction: the check runs at commit, by
-- which point exactly one cover must exist again. Deleting a cover in its own
-- transaction therefore fails, which is what makes the patch photo
-- non-deletable without a replacement.
--
-- A patch with no photos at all is allowed, because the patch row is created
-- before its photo has been uploaded.
create or replace function assert_patch_keeps_cover()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_patch_id uuid;
begin
  if tg_op = 'DELETE' then
    v_patch_id := old.patch_id;
  else
    v_patch_id := new.patch_id;
  end if;

  -- The patch itself is gone and took its photos with it (on delete cascade).
  if not exists (select 1 from patches where id = v_patch_id) then
    return null;
  end if;

  if exists (select 1 from patch_photos where patch_id = v_patch_id)
    and not exists (select 1 from patch_photos where patch_id = v_patch_id and is_cover)
  then
    raise exception
      'A patch must keep exactly one patch photo — replace it instead of deleting it'
      using errcode = 'restrict_violation';
  end if;

  return null;
end;
$$;

drop trigger if exists patch_photos_keep_cover on patch_photos;
create constraint trigger patch_photos_keep_cover
  after insert or update or delete on patch_photos
  deferrable initially deferred
  for each row execute function assert_patch_keeps_cover();

-- ---------------------------------------------------------------------------
-- Storage/database consistency
--
-- Postgres is the source of truth: a storage object counts as part of the app
-- only while a row references it. Storage cannot join a Postgres transaction,
-- so the application orders its calls around that — upload before insert,
-- delete rows before deleting objects (see src/lib/storageLifecycle.ts).
--
-- These functions exist only for the places where several *row* writes have to
-- land together, which is what a transaction is actually for. All are security
-- invoker (the default), so RLS still applies: a caller can only touch their
-- own rows, and user_id comes from auth.uid() rather than from the client.
-- ---------------------------------------------------------------------------

-- Creates a patch together with its mandatory photo of the physical patch.
--
-- Invariant protected: a patch row never exists without its patch photo. Done
-- as two client statements, a failure after the first leaves a patch that the
-- app considers invalid — no gallery sticker, not scannable, and (by the
-- trigger above) unable to accept trip photos until a patch photo arrives.
--
-- The caller uploads the image first and passes the id it chose, so the only
-- thing this has to get right is that both rows commit together. Patch columns
-- arrive as one jsonb payload and are extracted explicitly below — nothing is
-- mass-assigned, so the client can't set id, user_id or timestamps.
create or replace function create_patch_with_cover(
  p_patch_id uuid,
  p_patch jsonb,
  p_photo_id uuid,
  p_storage_path_original text
)
returns setof patches
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_patch patches;
  v_trip_id uuid := (p_patch ->> 'trip_id')::uuid;
begin
  -- Invisible under RLS is indistinguishable from absent: this refuses to
  -- attach the new patch to somebody else's trip.
  if v_trip_id is not null and not exists (select 1 from trips where id = v_trip_id) then
    raise exception 'Trip not found' using errcode = 'no_data_found';
  end if;

  insert into patches (
    id,
    user_id,
    location_name,
    country,
    lat,
    lng,
    geocode_raw,
    trip_start_date,
    trip_end_date,
    purchased_date,
    companions,
    description,
    trip_id,
    accommodations,
    restaurants,
    rating,
    review,
    itinerary,
    highlights,
    holiday_types,
    price
  )
  values (
    p_patch_id,
    auth.uid(),
    p_patch ->> 'location_name',
    p_patch ->> 'country',
    (p_patch ->> 'lat')::double precision,
    (p_patch ->> 'lng')::double precision,
    nullif(p_patch -> 'geocode_raw', 'null'::jsonb),
    (p_patch ->> 'trip_start_date')::date,
    (p_patch ->> 'trip_end_date')::date,
    (p_patch ->> 'purchased_date')::date,
    array(
      select t.value
      from jsonb_array_elements_text(coalesce(nullif(p_patch -> 'companions', 'null'::jsonb), '[]'::jsonb)) as t(value)
    ),
    p_patch ->> 'description',
    v_trip_id,
    coalesce(nullif(p_patch -> 'accommodations', 'null'::jsonb), '[]'::jsonb),
    coalesce(nullif(p_patch -> 'restaurants', 'null'::jsonb), '[]'::jsonb),
    (p_patch ->> 'rating')::smallint,
    p_patch ->> 'review',
    p_patch ->> 'itinerary',
    p_patch ->> 'highlights',
    array(
      select t.value
      from jsonb_array_elements_text(coalesce(nullif(p_patch -> 'holiday_types', 'null'::jsonb), '[]'::jsonb)) as t(value)
    ),
    (p_patch ->> 'price')::numeric
  )
  returning * into v_patch;

  insert into patch_photos (id, patch_id, user_id, role, storage_path_original, is_cover)
  values (p_photo_id, p_patch_id, auth.uid(), 'original', p_storage_path_original, true);

  return next v_patch;
end;
$$;

-- Swaps a patch's physical-patch photo for a newly uploaded one and returns
-- the outgoing photo's storage objects for the caller to delete afterwards.
--
-- Invariant protected: a patch is never left without its patch photo. The
-- delete and the insert are both required for the deferred trigger above to
-- pass at commit, so either the swap happens completely or not at all — a
-- failure leaves the existing cover exactly as it was.
--
-- p_photo_id is excluded from the capture and the delete so that retrying with
-- the same photo id cannot return the path the new row itself references.
create or replace function replace_patch_cover(
  p_patch_id uuid,
  p_photo_id uuid,
  p_storage_path_original text
)
returns table (bucket text, path text)
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Invisible under RLS is indistinguishable from absent, which is what we
  -- want: this refuses to attach a photo to someone else's patch.
  if not exists (select 1 from patches where id = p_patch_id) then
    raise exception 'Patch not found' using errcode = 'no_data_found';
  end if;

  return query
  select 'patch-originals'::text, ph.storage_path_original
  from patch_photos ph
  where ph.patch_id = p_patch_id
    and ph.is_cover
    and ph.id <> p_photo_id
  union all
  select 'patch-gallery'::text, ph.storage_path_gallery
  from patch_photos ph
  where ph.patch_id = p_patch_id
    and ph.is_cover
    and ph.id <> p_photo_id
    and ph.storage_path_gallery is not null
  union all
  select 'patch-gallery'::text, ph.storage_path_thumb
  from patch_photos ph
  where ph.patch_id = p_patch_id
    and ph.is_cover
    and ph.id <> p_photo_id
    and ph.storage_path_thumb is not null;

  delete from patch_photos
  where patch_id = p_patch_id
    and is_cover
    and id <> p_photo_id;

  insert into patch_photos (id, patch_id, user_id, role, storage_path_original, is_cover)
  values (p_photo_id, p_patch_id, auth.uid(), 'original', p_storage_path_original, true)
  on conflict (id) do update
    set storage_path_original = excluded.storage_path_original,
        is_cover = true;
end;
$$;

-- Deletes a patch and returns every storage object its rows referenced,
-- captured inside the same transaction as the delete. Child rows go away via
-- the existing on-delete-cascade foreign keys; the caller deletes the returned
-- objects afterwards, best-effort.
--
-- Invariant protected: the cleanup list matches exactly what the delete
-- removed. Reading the paths and deleting the patch as two separate client
-- statements leaves a window where a concurrent upload adds a photo that gets
-- cascaded away without its object ever reaching the cleanup list.
--
-- Returns no rows, and deletes nothing, when the patch does not exist or is
-- not visible to the caller — so a retry is a safe no-op.
create or replace function delete_patch_returning_storage_paths(p_patch_id uuid)
returns table (bucket text, path text)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  select 'patch-originals'::text, ph.storage_path_original
  from patch_photos ph
  where ph.patch_id = p_patch_id
  union all
  select 'patch-gallery'::text, ph.storage_path_gallery
  from patch_photos ph
  where ph.patch_id = p_patch_id
    and ph.storage_path_gallery is not null
  union all
  select 'patch-gallery'::text, ph.storage_path_thumb
  from patch_photos ph
  where ph.patch_id = p_patch_id
    and ph.storage_path_thumb is not null
  union all
  select 'patch-dishes'::text, d.storage_path
  from patch_dishes d
  where d.patch_id = p_patch_id
    and d.storage_path is not null;

  delete from patches where id = p_patch_id;
end;
$$;

-- These were callable by the anon role, by two separate routes:
--
--   * Postgres grants EXECUTE to PUBLIC on every newly created function.
--   * Supabase additionally ships `alter default privileges in schema public
--     grant all on functions to anon, authenticated, service_role`, so a new
--     function in this schema also gets a *direct* grant to anon. Revoking
--     from PUBLIC does not remove that one — it has to be named.
--
-- Nothing could come of either: all three are security invoker, so RLS applies
-- and auth.uid() is null for anon, which fails the not-null on user_id and
-- makes every select and delete match no rows. But the grants should say
-- what's intended rather than lean on that.
--
-- service_role keeps its grant. It bypasses RLS by design and is only ever
-- used server-side with the service key, so revoking it would buy nothing.
--
-- Revoke first, then grant: revoking from PUBLIC also takes the implicit grant
-- away from authenticated.
--
-- Idempotent: revoking a privilege that isn't held and granting one that is
-- are both no-ops. create or replace function preserves grants, so re-running
-- this file doesn't reintroduce either grant.
revoke execute on function create_patch_with_cover(uuid, jsonb, uuid, text) from public, anon;
revoke execute on function replace_patch_cover(uuid, uuid, text) from public, anon;
revoke execute on function delete_patch_returning_storage_paths(uuid) from public, anon;

grant execute on function create_patch_with_cover(uuid, jsonb, uuid, text) to authenticated;
grant execute on function replace_patch_cover(uuid, uuid, text) to authenticated;
grant execute on function delete_patch_returning_storage_paths(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- All private; the app reads photos via signed URLs / the authenticated client.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('patch-originals', 'patch-originals', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('patch-gallery', 'patch-gallery', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('patch-dishes', 'patch-dishes', false)
on conflict (id) do nothing;

-- Cap upload size/type per bucket (defense in depth alongside the client-side
-- check in src/lib/fileValidation.ts) so a public signup can't fill storage
-- quota with oversized or non-image files.
update storage.buckets
set file_size_limit = 15728640, -- 15MB, keep in sync with MAX_IMAGE_BYTES
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id in ('patch-originals', 'patch-gallery', 'patch-dishes');

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

drop policy if exists "patch_dishes_photos_select_own" on storage.objects;
create policy "patch_dishes_photos_select_own" on storage.objects
  for select using (
    bucket_id = 'patch-dishes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "patch_dishes_photos_insert_own" on storage.objects;
create policy "patch_dishes_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'patch-dishes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "patch_dishes_photos_update_own" on storage.objects;
create policy "patch_dishes_photos_update_own" on storage.objects
  for update using (
    bucket_id = 'patch-dishes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "patch_dishes_photos_delete_own" on storage.objects;
create policy "patch_dishes_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'patch-dishes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Manual reconciliation (no scheduled sweeper — see CLAUDE.md)
--
-- The app compensates immediately when a storage write is followed by a failed
-- database write, so orphans only arise if the browser or Edge Function dies
-- between the two steps, or if cleanup after a successful delete failed. At
-- this scale that's rare enough to reconcile by hand instead of running a job.
--
-- Run this to list objects nothing references. The age filter is what keeps an
-- in-flight upload from being reported as an orphan.
--
-- IMPORTANT: delete anything it reports through the Storage API or the
-- dashboard, not with SQL — removing a row from storage.objects leaves the
-- file itself behind in the storage backend.
--
--   with referenced as (
--     select 'patch-originals' as bucket_id, storage_path_original as name from patch_photos
--     union all
--     select 'patch-gallery', storage_path_gallery from patch_photos where storage_path_gallery is not null
--     union all
--     select 'patch-gallery', storage_path_thumb from patch_photos where storage_path_thumb is not null
--     union all
--     select 'patch-dishes', storage_path from patch_dishes where storage_path is not null
--   )
--   select o.bucket_id, o.name, o.created_at
--   from storage.objects o
--   where o.bucket_id in ('patch-originals', 'patch-gallery', 'patch-dishes')
--     and o.created_at < now() - interval '1 day'
--     and not exists (
--       select 1 from referenced r
--       where r.bucket_id = o.bucket_id and r.name = o.name
--     )
--   order by o.created_at;
--
-- And this to list patches whose photo set somehow lost its patch photo — the
-- constraint trigger prevents new ones, but it does not retro-validate rows
-- that predate it. Fix by adding a patch photo from Edit patch.
--
--   select p.id, p.location_name
--   from patches p
--   where exists (select 1 from patch_photos ph where ph.patch_id = p.id)
--     and not exists (select 1 from patch_photos ph where ph.patch_id = p.id and ph.is_cover);
