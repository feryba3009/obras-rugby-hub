-- Errores que les pasan a los usuarios en la app. La app los reporta sola (también antes de iniciar
-- sesión, por ejemplo un registro que falla). Nadie los puede leer desde la app: solo ADN, y un
-- control automático (GitHub) que avisa por mail cuando aparecen.
create table if not exists public.errores_app (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  club_id uuid,
  perfil_id uuid,
  rol text,
  origen text,          -- 'pantalla' | 'promesa' | 'componente' | 'registro' | 'ingreso' | ...
  mensaje text not null,
  detalle text,
  pantalla text,
  agente text
);
create index if not exists errores_app_fecha_idx on public.errores_app (created_at desc);
alter table public.errores_app enable row level security;
revoke all on public.errores_app from anon, authenticated;

create or replace function public.reportar_error(p_origen text, p_mensaje text, p_detalle text, p_pantalla text, p_agente text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_perfil profiles%rowtype;
begin
  -- Freno para que una falla en bucle no llene la tabla.
  if (select count(*) from errores_app where created_at > now() - interval '1 hour') >= 300 then return; end if;
  select * into v_perfil from profiles where auth_user_id = auth.uid() limit 1;
  insert into errores_app (club_id, perfil_id, rol, origen, mensaje, detalle, pantalla, agente)
  values (coalesce(v_perfil.club_id, public.club_por_defecto()), v_perfil.id, v_perfil.rol,
          left(coalesce(p_origen, ''), 40), left(coalesce(nullif(p_mensaje, ''), 'sin mensaje'), 500),
          left(p_detalle, 4000), left(p_pantalla, 200), left(p_agente, 300));
end $$;
revoke all on function public.reportar_error(text, text, text, text, text) from public;
grant execute on function public.reportar_error(text, text, text, text, text) to anon, authenticated;

-- Solo cuántos errores hubo desde una fecha (sin detalles): lo consulta el control automático de GitHub.
create or replace function public.contar_errores(p_desde timestamptz)
returns table (cantidad int, usuarios int, distintos int)
language sql stable security definer set search_path to 'public' as $$
  select count(*)::int, count(distinct perfil_id)::int, count(distinct mensaje)::int
    from errores_app where created_at >= greatest(p_desde, now() - interval '7 days');
$$;
revoke all on function public.contar_errores(timestamptz) from public;
grant execute on function public.contar_errores(timestamptz) to anon, authenticated;

-- Se borran solos a los 90 días.
select cron.schedule('limpiar-errores-app', '30 6 * * *', $$delete from public.errores_app where created_at < now() - interval '90 days'$$);
