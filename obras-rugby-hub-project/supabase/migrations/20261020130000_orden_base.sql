-- Orden de la base (sin borrar nada):
-- 1) Índice para cada relación entre tablas que no lo tenía (consultas más rápidas cuando crezcan los datos).
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tabla, c.conname, c.conrelid, c.conkey,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as columnas
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f' and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
      )
  loop
    execute format('create index if not exists %I on %s (%s)', left(r.conname || '_idx', 63), r.tabla, r.columnas);
  end loop;
end $$;

-- 2) Funciones auxiliares con ruta de búsqueda fija (recomendación de seguridad de Supabase).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('wellness_horarios_defecto', 'ahora_ar', 'wellness_pct', 'numero_suelto', 'nombre_clave')
  loop
    execute format('alter function %s set search_path = public', r.f);
  end loop;
end $$;

-- 3) Reglas que calculaban el usuario fila por fila: ahora una sola vez por consulta.
alter policy "cada uno ve y gestiona las suyas" on public.push_subscriptions
  using (perfil_id in (select profiles.id from profiles where profiles.auth_user_id = (select auth.uid())))
  with check (perfil_id in (select profiles.id from profiles where profiles.auth_user_id = (select auth.uid())));
alter policy "votos: lectura" on public.votos_partido
  using (club_id = current_club_id() and (votante = (select auth.uid()) or es_staff()));
alter policy "votos: alta" on public.votos_partido
  with check (club_id = current_club_id() and votante = (select auth.uid()) and votacion_abierta(partido_id)
              and jugador_id is distinct from mi_jugador_id());
