-- Manual verification of the patch-photo invariants enforced by schema.sql.
--
-- These checks need a real Postgres, so they can't run in CI (the app's test
-- suite is jsdom-only). Run this in the Supabase SQL Editor after applying
-- schema.sql, and again if you ever change the cover-photo rules.
--
-- Expect a table of eight rows, every result PASS. A failed invariant raises
-- instead, so an error message is also a meaningful result — read what it says.
--
-- The checks run inside a temporary function (pg_temp) rather than a DO block
-- so the results come back as rows: the dashboard's SQL editor doesn't show
-- RAISE NOTICE output, which would otherwise make a passing run look identical
-- to one that did nothing. Nothing is left behind — pg_temp functions vanish
-- when the session ends.
--
-- The script creates one temporary patch named "__invariant check__" and
-- deletes it again at the end; it never touches your real patches, and it
-- never uploads or deletes storage objects (the paths below are just strings).

create or replace function pg_temp.verify_patch_invariants()
returns table (check_no int, invariant text, result text)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_patch_id uuid := gen_random_uuid();
  v_rolled_back_patch_id uuid := gen_random_uuid();
  v_cover_id uuid := gen_random_uuid();
  v_trip_photo_id uuid := gen_random_uuid();
  v_new_cover_id uuid := gen_random_uuid();
  v_covers int;
  v_returned int;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise exception 'No users exist yet — sign up in the app once before running this.';
  end if;

  -- The RPCs read auth.uid(), which is empty in the SQL editor, so stand in a
  -- JWT claim for the duration of this transaction.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);

  -- 1. A patch and its mandatory patch photo are created together.
  perform *
  from create_patch_with_cover(
    v_patch_id,
    jsonb_build_object('location_name', '__invariant check__'),
    v_cover_id,
    format('%s/%s/cover.jpg', v_user_id, v_patch_id)
  );

  if not exists (select 1 from patches where id = v_patch_id) then
    raise exception 'FAIL: the patch row was not created';
  end if;
  select count(*) into v_covers from patch_photos where patch_id = v_patch_id and is_cover;
  if v_covers <> 1 then
    raise exception 'FAIL: % cover photos after creation, expected 1', v_covers;
  end if;
  if not exists (select 1 from patch_photos where id = v_cover_id and is_cover) then
    raise exception 'FAIL: the created photo is not the cover';
  end if;
  check_no := 1;
  invariant := 'a patch is created together with exactly one patch photo';
  result := 'PASS';
  return next;

  -- 2. A failed creation leaves neither row. The null storage path trips the
  -- not-null constraint *after* the patches row has already been inserted, so
  -- this only passes if the whole function call rolls back as one unit.
  begin
    perform *
    from create_patch_with_cover(
      v_rolled_back_patch_id,
      jsonb_build_object('location_name', '__invariant check rollback__'),
      gen_random_uuid(),
      null
    );
    raise exception 'FAIL: creation accepted a null storage path';
  exception
    when not_null_violation then
      if exists (select 1 from patches where id = v_rolled_back_patch_id) then
        raise exception 'FAIL: the patch row survived a failed creation';
      end if;
  end;
  check_no := 2;
  invariant := 'a failed creation leaves neither the patch nor a cover behind';
  result := 'PASS';
  return next;

  insert into patch_photos (id, patch_id, user_id, storage_path_original, is_cover)
  values (v_trip_photo_id, v_patch_id, v_user_id, format('%s/%s/trip.jpg', v_user_id, v_patch_id), false);

  -- 3. A patch cannot end up with multiple cover photos.
  begin
    insert into patch_photos (patch_id, user_id, storage_path_original, is_cover)
    values (v_patch_id, v_user_id, format('%s/%s/second.jpg', v_user_id, v_patch_id), true);
    raise exception 'FAIL: a second cover photo was accepted';
  exception
    when unique_violation then null;
  end;
  check_no := 3;
  invariant := 'a patch cannot have two cover photos';
  result := 'PASS';
  return next;

  -- 4. A trip photo is never promoted to cover.
  begin
    update patch_photos set is_cover = true where id = v_trip_photo_id;
    raise exception 'FAIL: a trip photo was promoted while a cover already existed';
  exception
    when unique_violation then null;
  end;
  check_no := 4;
  invariant := 'a trip photo cannot be promoted alongside the cover';
  result := 'PASS';
  return next;

  -- 5. The cover cannot be deleted on its own. The guard is a deferred
  -- constraint trigger, so force it to run rather than waiting for commit.
  begin
    delete from patch_photos where id = v_cover_id;
    set constraints all immediate;
    raise exception 'FAIL: the cover photo was deleted on its own';
  exception
    when restrict_violation then null;
  end;
  set constraints all deferred;
  check_no := 5;
  invariant := 'the cover photo cannot be deleted on its own';
  result := 'PASS';
  return next;

  -- 6. Ordinary trip photos can still be deleted independently.
  delete from patch_photos where id = v_trip_photo_id;
  set constraints all immediate;
  set constraints all deferred;
  check_no := 6;
  invariant := 'a trip photo can be deleted independently';
  result := 'PASS';
  return next;

  -- 7. Replacing the cover is atomic: old row gone, new row is the only cover,
  -- and the outgoing object comes back for the caller to clean up.
  select count(*) into v_returned
  from replace_patch_cover(
    v_patch_id,
    v_new_cover_id,
    format('%s/%s/new-cover.jpg', v_user_id, v_patch_id)
  );

  select count(*) into v_covers from patch_photos where patch_id = v_patch_id and is_cover;
  if v_covers <> 1 then
    raise exception 'FAIL: % cover photos after replacement, expected 1', v_covers;
  end if;
  if not exists (select 1 from patch_photos where id = v_new_cover_id and is_cover) then
    raise exception 'FAIL: the replacement photo is not the cover';
  end if;
  if exists (select 1 from patch_photos where id = v_cover_id) then
    raise exception 'FAIL: the replaced cover row survived';
  end if;
  if v_returned = 0 then
    raise exception 'FAIL: replacement returned no storage paths to clean up';
  end if;
  check_no := 7;
  invariant := format('replacement swapped the cover atomically, returning %s object(s) to clean up', v_returned);
  result := 'PASS';
  return next;

  -- 8. A failed replacement leaves the existing cover intact. A null storage
  -- path trips the not-null constraint *after* the function has already
  -- deleted the outgoing cover row, so this only passes if the whole function
  -- call rolls back as one unit.
  begin
    perform * from replace_patch_cover(v_patch_id, gen_random_uuid(), null);
    raise exception 'FAIL: replacement accepted a null storage path';
  exception
    when not_null_violation then null;
  end;

  if not exists (select 1 from patch_photos where id = v_new_cover_id and is_cover) then
    raise exception 'FAIL: the cover did not survive a failed replacement';
  end if;
  check_no := 8;
  invariant := 'a failed replacement leaves the existing cover intact';
  result := 'PASS';
  return next;

  delete from patches where id = v_patch_id;
end;
$$;

select * from pg_temp.verify_patch_invariants() order by check_no;
