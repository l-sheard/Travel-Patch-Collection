-- Manual verification of the RLS parent-ownership rules and the RPC execute
-- grants added by schema.sql.
--
-- Separate from verify-invariants.sql on purpose. That file checks constraints
-- and triggers, which apply to everyone including the table owner, so it can
-- run as-is in the SQL editor. RLS does *not* apply to the table owner, so
-- everything here has to `set local role authenticated` first — otherwise every
-- check would pass trivially without testing a single policy.
--
-- Run it in the Supabase SQL Editor after applying schema.sql.
--
-- Expect a table of seven rows, every result PASS. A failed check raises
-- instead, so an error message is also a meaningful result — read what it says.
--
-- Everything runs inside one transaction that is rolled back at the end, so no
-- patch, photo or trip created here survives. No storage objects are touched;
-- the paths below are only strings.

begin;

create or replace function pg_temp.verify_rls()
returns table (check_no int, policy_rule text, result text)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_patch_a uuid := gen_random_uuid();
  v_patch_b uuid := gen_random_uuid();
  v_trip_b uuid := gen_random_uuid();
  v_photo_a uuid := gen_random_uuid();
  v_foreign_patch uuid;
  v_foreign_trip uuid;
  v_mode text;
  v_fn text;
  v_oid oid;
begin
  select id into v_user_a from auth.users order by created_at limit 1;
  if v_user_a is null then
    raise exception 'No users exist yet — sign up in the app once before running this.';
  end if;

  -- A second account makes these checks exact: the row being rejected points at
  -- a patch that genuinely belongs to somebody else. With only one account we
  -- fall back to an id that belongs to nobody, which the same clause in the
  -- same policy rejects for the same reason — a weaker test, but not a
  -- different code path. The result text says which mode ran.
  select id into v_user_b from auth.users where id <> v_user_a order by created_at limit 1;

  -- Setup runs as the owner, with RLS not yet in force.
  insert into patches (id, user_id, location_name)
  values (v_patch_a, v_user_a, '__rls check mine__');

  insert into patch_photos (id, patch_id, user_id, storage_path_original, is_cover)
  values (v_photo_a, v_patch_a, v_user_a, format('%s/%s/cover.jpg', v_user_a, v_patch_a), true);

  if v_user_b is not null then
    insert into patches (id, user_id, location_name)
    values (v_patch_b, v_user_b, '__rls check theirs__');
    insert into trips (id, user_id, name) values (v_trip_b, v_user_b, '__rls check their trip__');
    v_foreign_patch := v_patch_b;
    v_foreign_trip := v_trip_b;
    v_mode := 'a patch owned by another account';
  else
    v_foreign_patch := gen_random_uuid();
    v_foreign_trip := gen_random_uuid();
    v_mode := 'an id owned by nobody (only one account exists)';
  end if;

  -- From here on, act as a signed-in user rather than the table owner.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a)::text, true);
  set local role authenticated;

  -- 1. The baseline this must not break: a photo on your own patch.
  insert into patch_photos (patch_id, user_id, storage_path_original)
  values (v_patch_a, v_user_a, format('%s/%s/trip-photo.jpg', v_user_a, v_patch_a));
  check_no := 1;
  policy_rule := 'a photo can still be added to your own patch';
  result := 'PASS';
  return next;

  -- 2. The finding itself. Distinguishing the two failure modes is the whole
  -- point: before the fix the policy allowed the row and only the foreign key
  -- stopped it, which means a *real* patch id would have been accepted.
  begin
    insert into patch_photos (patch_id, user_id, storage_path_original)
    values (v_foreign_patch, v_user_a, format('%s/%s/planted.jpg', v_user_a, v_foreign_patch));
    raise exception 'FAIL: a photo was attached to a patch that is not yours';
  exception
    when insufficient_privilege then null;
    when foreign_key_violation then
      raise exception
        'FAIL: the policy accepted the row and only the foreign key refused it — the parent-ownership clause is missing from patch_photos_insert_own';
  end;
  check_no := 2;
  policy_rule := format('a photo cannot be attached to %s', v_mode);
  result := 'PASS';
  return next;

  -- 3. Insert-side only would be pointless: insert against your own patch,
  -- then repoint it.
  begin
    update patch_photos set patch_id = v_foreign_patch where id = v_photo_a;
    raise exception 'FAIL: a photo was repointed at a patch that is not yours';
  exception
    when insufficient_privilege then null;
    when foreign_key_violation then
      raise exception
        'FAIL: the policy accepted the update and only the foreign key refused it — the parent-ownership clause is missing from patch_photos_update_own';
  end;
  check_no := 3;
  policy_rule := 'an existing photo cannot be repointed at someone else''s patch';
  result := 'PASS';
  return next;

  -- 4. Same rule for dishes.
  begin
    insert into patch_dishes (patch_id, user_id, name)
    values (v_foreign_patch, v_user_a, '__rls check dish__');
    raise exception 'FAIL: a dish was attached to a patch that is not yours';
  exception
    when insufficient_privilege then null;
    when foreign_key_violation then
      raise exception
        'FAIL: the policy accepted the row and only the foreign key refused it — the parent-ownership clause is missing from patch_dishes_insert_own';
  end;
  check_no := 4;
  policy_rule := 'a dish cannot be attached to someone else''s patch';
  result := 'PASS';
  return next;

  -- 5. The same shape of hole one level up: patches.trip_id.
  begin
    update patches set trip_id = v_foreign_trip where id = v_patch_a;
    raise exception 'FAIL: a patch was filed under a trip that is not yours';
  exception
    when insufficient_privilege then null;
    when foreign_key_violation then
      raise exception
        'FAIL: the policy accepted the update and only the foreign key refused it — the trip-ownership clause is missing from patches_update_own';
  end;
  check_no := 5;
  policy_rule := 'a patch cannot be filed under someone else''s trip';
  result := 'PASS';
  return next;

  -- 6. Naming `with check` on an update policy replaces the implicit copy of
  -- `using`, so this guards against the restated clause being dropped.
  if v_user_b is not null then
    begin
      update patches set user_id = v_user_b where id = v_patch_a;
      raise exception 'FAIL: a patch was handed over to another account';
    exception
      when insufficient_privilege then null;
    end;
    policy_rule := 'a patch cannot be reassigned to another account';
    result := 'PASS';
  else
    policy_rule := 'a patch cannot be reassigned to another account (needs a second account)';
    result := 'SKIP';
  end if;
  check_no := 6;
  return next;

  reset role;

  -- 7. Execute on the RPCs: not PUBLIC, not anon, yes authenticated.
  foreach v_fn in array array[
    'create_patch_with_cover(uuid, jsonb, uuid, text)',
    'replace_patch_cover(uuid, uuid, text)',
    'delete_patch_returning_storage_paths(uuid)'
  ]
  loop
    v_oid := format('public.%s', v_fn)::regprocedure;

    -- A null proacl means the function still has default privileges, and the
    -- default for a function *includes* EXECUTE for PUBLIC. Checking only the
    -- ACL entries would read that as "PUBLIC not listed, so not granted".
    if not exists (select 1 from pg_proc where oid = v_oid and proacl is not null) then
      raise exception
        'FAIL: % still has default privileges, which grant EXECUTE to PUBLIC', v_fn;
    end if;

    -- grantee 0 in an ACL entry is PUBLIC.
    if exists (
      select 1
      from pg_proc p
      cross join lateral aclexplode(p.proacl) a
      where p.oid = v_oid
        and a.grantee = 0
        and a.privilege_type = 'EXECUTE'
    ) then
      raise exception 'FAIL: % is still executable by PUBLIC', v_fn;
    end if;

    if has_function_privilege('anon', v_oid, 'execute') then
      raise exception 'FAIL: % is still executable by anon', v_fn;
    end if;

    if not has_function_privilege('authenticated', v_oid, 'execute') then
      raise exception 'FAIL: % is not executable by authenticated', v_fn;
    end if;
  end loop;
  check_no := 7;
  policy_rule := 'the three RPCs are executable by authenticated only, not PUBLIC or anon';
  result := 'PASS';
  return next;
end;
$$;

select * from pg_temp.verify_rls() order by check_no;

rollback;
