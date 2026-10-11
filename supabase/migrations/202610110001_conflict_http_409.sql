-- Run in Supabase SQL Editor for an already installed Coltivare database.
-- Preserve the existing function, ownership, grants and workspace data.
-- PostgREST 14 retries 40001 indefinitely; an application conflict must use PT409.
begin;
do $migration$
declare
  definition text := pg_get_functiondef('public.coltivare_save_workspace(bigint,jsonb,jsonb)'::regprocedure);
  previous_raise text := 'raise exception ''Workspace changed on another device'' using errcode = ''40001'';';
  corrected_raise text := 'raise exception ''Workspace changed on another device'' using errcode = ''PT409'';';
begin
  if strpos(definition, previous_raise) > 0 then
    execute replace(definition, previous_raise, corrected_raise);
  elsif strpos(definition, corrected_raise) = 0 then
    raise exception 'Unexpected Coltivare save function: inspect it before applying the conflict fix';
  end if;
end;
$migration$;
notify pgrst, 'reload schema';
commit;

-- If errors continue, terminate the existing looping backend; see docs/supabase.md.
