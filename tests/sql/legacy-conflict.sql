-- Reproduce an existing installation, before applying the upgrade migration.
do $$
declare
  definition text := pg_get_functiondef('public.coltivare_save_workspace(bigint,jsonb,jsonb)'::regprocedure);
begin
  execute replace(definition, 'errcode = ''PT409''', 'errcode = ''40001''');
end;
$$;
