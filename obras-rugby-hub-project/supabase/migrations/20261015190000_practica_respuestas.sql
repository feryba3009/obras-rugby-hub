-- Confirmación de asistencia a la práctica: cada jugador responde "voy" o "no puedo" (con motivo opcional).
-- Aviso automático los días de práctica a las 10 (pedido de confirmación) y a las 16 (recordatorio a los que faltan).
set check_function_bodies = off;

create table public.practica_respuestas (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.club_para_insert() references public.clubes (id),
  fecha date not null,
  jugador_id uuid not null references public.jugadores (id) on delete cascade,
  respuesta text not null check (respuesta in ('voy', 'no_puedo')),
  motivo text,
  updated_at timestamptz not null default now(),
  unique (fecha, jugador_id)
);
alter table public.practica_respuestas enable row level security;
create policy "practica: lectura" on public.practica_respuestas for select to authenticated
  using (club_id = public.current_club_id());
create policy "practica: alta" on public.practica_respuestas for insert to authenticated
  with check (club_id = public.current_club_id() and (jugador_id = public.mi_jugador_id() or public.es_staff()));
create policy "practica: edicion" on public.practica_respuestas for update to authenticated
  using (club_id = public.current_club_id() and (jugador_id = public.mi_jugador_id() or public.es_staff()))
  with check (club_id = public.current_club_id() and (jugador_id = public.mi_jugador_id() or public.es_staff()));
grant select, insert, update on public.practica_respuestas to authenticated;
revoke all on public.practica_respuestas from anon;

-- ¿Hay práctica hoy? Si el club cargó la práctica, manda eso; si no cargó nada todavía, martes y jueves.
create or replace function public.hay_practica(p_club uuid, p_dia date)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  nombres text[] := array['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  nombre text := nombres[extract(dow from p_dia)::int + 1];
begin
  if exists (select 1 from sesiones_practica where club_id = p_club) then
    return exists (
      select 1 from sesiones_practica where club_id = p_club and dia = nombre
        and (jsonb_array_length(coalesce(grupos->'grupo1', '[]'::jsonb)) + jsonb_array_length(coalesce(grupos->'grupo2', '[]'::jsonb))) > 0
    );
  end if;
  return nombre in ('Martes', 'Jueves');
end;
$$;

create or replace function public.practica_avisar(p_tipo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  hoy date := ahora_ar()::date;
  c record;
  destino uuid[];
  v_clave text := 'practica-' || p_tipo;
begin
  for c in select id from clubes loop
    continue when not hay_practica(c.id, hoy);
    continue when exists (select 1 from alertas_staff_enviadas where club_id = c.id and fecha = hoy and clave = v_clave);
    insert into alertas_staff_enviadas (club_id, fecha, clave) values (c.id, hoy, v_clave);
    if p_tipo = 'pedido' then
      insert into notificaciones (club_id, tipo, mensaje, roles_destino)
      values (c.id, 'practica_confirmar', 'Hoy hay práctica. Entrá y confirmá si venís.', array['Jugador']);
    else
      select array_agg(j.id) into destino from jugadores j
        join profiles p on p.jugador_id = j.id and p.confirmado
       where j.club_id = c.id
         and not exists (select 1 from practica_respuestas r where r.jugador_id = j.id and r.fecha = hoy);
      if destino is not null then
        insert into notificaciones (club_id, tipo, mensaje, roles_destino, jugadores_destino)
        values (c.id, 'practica_confirmar', 'Todavía no confirmaste si venís a la práctica de hoy.', array['Jugador'], destino);
      end if;
    end if;
  end loop;
end;
$$;
revoke execute on function public.practica_avisar(text) from public, anon, authenticated;

select cron.schedule('practica-pedido', '0 13 * * *', $$select public.practica_avisar('pedido')$$);
select cron.schedule('practica-recordatorio', '0 19 * * *', $$select public.practica_avisar('recordatorio')$$);
