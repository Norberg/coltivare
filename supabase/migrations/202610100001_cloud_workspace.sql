-- Run once in the Supabase SQL Editor. Tables are namespaced for this app.
begin;

create table public.coltivare_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 0 check (version >= 0)
);
create table public.coltivare_records (
  owner_id uuid not null references public.coltivare_workspaces(owner_id) on delete cascade,
  id uuid not null,
  kind text not null check (kind in ('workspace', 'garden', 'object', 'plantGrid', 'plant', 'planting', 'placement', 'event')),
  workspace_id uuid not null,
  payload jsonb not null,
  primary key (owner_id, id),
  constraint coltivare_record_identity check (
    jsonb_typeof(payload) = 'object' and
    payload->>'id' is not null and (payload->>'id')::uuid = id and
    payload->>'kind' is not null and payload->>'kind' = kind and
    payload->>'workspaceId' is not null and (payload->>'workspaceId')::uuid = workspace_id and
    payload->>'revision' is not null and (payload->>'revision')::bigint >= 0
  ),
  foreign key (owner_id, workspace_id) references public.coltivare_records(owner_id, id) deferrable initially deferred
);
create unique index coltivare_one_workspace on public.coltivare_records(owner_id) where kind = 'workspace';
create table public.coltivare_histories (
  owner_id uuid not null references public.coltivare_workspaces(owner_id) on delete cascade,
  garden_id uuid not null,
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object' and payload->>'id' is not null and
    (payload->>'id')::uuid = garden_id and
    jsonb_typeof(payload->'undo') is not distinct from 'array' and jsonb_typeof(payload->'redo') is not distinct from 'array'
  ),
  primary key (owner_id, garden_id)
);

alter table public.coltivare_workspaces enable row level security;
alter table public.coltivare_records enable row level security;
alter table public.coltivare_histories enable row level security;

create policy coltivare_workspace_owner on public.coltivare_workspaces
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy coltivare_record_owner on public.coltivare_records
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy coltivare_history_owner on public.coltivare_histories
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke all on public.coltivare_workspaces, public.coltivare_records, public.coltivare_histories from public, anon, authenticated;
grant select on public.coltivare_workspaces, public.coltivare_records, public.coltivare_histories to authenticated;

create function public.coltivare_read_workspace() returns jsonb
-- Definer is needed because direct writes are revoked: all mutations must use CAS.
-- Ownership always comes from the verified JWT, never an argument.
language plpgsql security definer set search_path = '' as $$
declare
  account uuid := auth.uid();
  current_version bigint;
  result jsonb;
begin
  if account is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  insert into public.coltivare_workspaces(owner_id) values (account) on conflict do nothing;
  -- Lock across all reads so records and history belong to the same revision.
  select version into current_version from public.coltivare_workspaces where owner_id = account for share;
  select jsonb_build_object(
    'version', current_version,
    'records', coalesce((select jsonb_agg(payload order by id) from public.coltivare_records where owner_id = account), '[]'::jsonb),
    'histories', coalesce((select jsonb_agg(payload order by garden_id) from public.coltivare_histories where owner_id = account), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create function public.coltivare_save_workspace(expected_version bigint, next_records jsonb, next_histories jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  account uuid := auth.uid();
  current_version bigint;
  workspace uuid;
begin
  if account is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if jsonb_typeof(next_records) is distinct from 'array' or jsonb_typeof(next_histories) is distinct from 'array'
    or pg_column_size(next_records) + pg_column_size(next_histories) > 20971520 then
    raise exception 'Invalid workspace or workspace exceeds 20 MB' using errcode = '22023';
  end if;
  select version into current_version from public.coltivare_workspaces where owner_id = account for update;
  if current_version is null or current_version is distinct from expected_version then
    raise exception 'Workspace changed on another device' using errcode = '40001';
  end if;
  if (select count(*) from jsonb_array_elements(next_records) r where r->>'kind' = 'workspace') <> 1 then
    raise exception 'Exactly one workspace is required' using errcode = '22023';
  end if;
  select (r->>'id')::uuid into workspace from jsonb_array_elements(next_records) r where r->>'kind' = 'workspace';
  if exists (select 1 from jsonb_array_elements(next_records) r where (r->>'workspaceId')::uuid is distinct from workspace) then
    raise exception 'Records must belong to this workspace' using errcode = '22023';
  end if;
  -- Validate direct references before replacing rows. Any failure rolls back everything.
  if exists (
    select 1 from jsonb_array_elements(next_records) r
    cross join lateral jsonb_each_text(r) field
    where field.key in ('gardenId', 'plantId', 'plantingId', 'objectId', 'targetId')
      and field.value is not null
      and not exists (select 1 from jsonb_array_elements(next_records) target where target->>'id' = field.value)
  ) then raise exception 'Missing record reference' using errcode = '23503'; end if;
  delete from public.coltivare_histories where owner_id = account;
  delete from public.coltivare_records where owner_id = account;
  insert into public.coltivare_records(owner_id, id, kind, workspace_id, payload)
    select account, (r->>'id')::uuid, r->>'kind', (r->>'workspaceId')::uuid, r from jsonb_array_elements(next_records) r;
  insert into public.coltivare_histories(owner_id, garden_id, payload)
    select account, (h->>'id')::uuid, h from jsonb_array_elements(next_histories) h;
  update public.coltivare_workspaces set version = version + 1 where owner_id = account returning version into current_version;
  return current_version;
end;
$$;

revoke all on function public.coltivare_read_workspace() from public, anon;
revoke all on function public.coltivare_save_workspace(bigint, jsonb, jsonb) from public, anon;
grant execute on function public.coltivare_read_workspace() to authenticated;
grant execute on function public.coltivare_save_workspace(bigint, jsonb, jsonb) to authenticated;
commit;
