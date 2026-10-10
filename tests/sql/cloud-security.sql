set role anon;
do $$ begin
  begin
    perform public.coltivare_read_workspace();
    raise exception 'FAIL: anonymous RPC allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.coltivare_records;
    raise exception 'FAIL: anonymous table access allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.coltivare_read_workspace();
select public.coltivare_save_workspace(0,
  '[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","kind":"workspace","workspaceId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","revision":1}]', '[]');
do $$ begin
  begin
    perform public.coltivare_save_workspace(0,
      '[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","kind":"workspace","workspaceId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","revision":2}]', '[]');
    raise exception 'FAIL: stale write accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.coltivare_save_workspace(1,
      '[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","kind":"workspace","workspaceId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","revision":2},
        {"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","kind":"placement","workspaceId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","revision":1,"gardenId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}]', '[]');
    raise exception 'FAIL: missing reference accepted';
  exception when foreign_key_violation then null; end;
  begin
    perform public.coltivare_save_workspace(1,
      '[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","kind":"workspace","workspaceId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","revision":-1}]', '[]');
    raise exception 'FAIL: invalid record accepted';
  exception when check_violation then null; end;
  if (select version from public.coltivare_workspaces) <> 1
    or (select count(*) from public.coltivare_records) <> 1
    or (select payload->>'revision' from public.coltivare_records) <> '1' then
    raise exception 'FAIL: failed write changed records/version';
  end if;
end $$;

set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$ begin
  if (select count(*) from public.coltivare_records) <> 0 then
    raise exception 'FAIL: another user can read records';
  end if;
  if jsonb_array_length(public.coltivare_read_workspace()->'records') <> 0 then
    raise exception 'FAIL: RPC leaks records';
  end if;
  begin
    update public.coltivare_workspaces set version = 99 where owner_id = '11111111-1111-4111-8111-111111111111';
    raise exception 'FAIL: direct version writes allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.coltivare_records where owner_id = '11111111-1111-4111-8111-111111111111';
    raise exception 'FAIL: direct record deletion allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.coltivare_records(owner_id, id, kind, workspace_id, payload)
      values ('11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'workspace', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '{"id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","kind":"workspace","workspaceId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","revision":1}');
    raise exception 'FAIL: forged ownership accepted';
  exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$ begin
  if (public.coltivare_read_workspace()->>'version')::int <> 1
    or jsonb_array_length(public.coltivare_read_workspace()->'records') <> 1 then
    raise exception 'FAIL: other user changed workspace';
  end if;
end $$;
reset role;
select 'PASS: anonymous denial, owner isolation, CAS conflicts, invalid-reference rejection and rollback';
