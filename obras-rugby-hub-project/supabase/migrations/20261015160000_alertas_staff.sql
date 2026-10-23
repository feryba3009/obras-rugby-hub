-- Avisos automáticos al staff (una vez por día, 20:30 de Argentina, cuando ya cerró el wellness):
--  · Wellness bajo (menos de 40%) dos días seguidos.
--  · Jugador con la app que lleva 4 días sin cargar wellness (se avisa una vez por racha).
--  · Lesión que hoy llega a su fecha estimada de vuelta, y recordatorio si a la semana sigue abierta.
set check_function_bodies = off;

create table if not exists public.alertas_staff_enviadas (
  club_id uuid not null references public.clubes (id),
  fecha date not null,
  clave text not null,
  enviado_en timestamptz not null default now(),
  primary key (club_id, fecha, clave)
);
alter table public.alertas_staff_enviadas enable row level security;
revoke all on public.alertas_staff_enviadas from anon, authenticated;

create or replace function public.wellness_pct(r public.wellness_respuestas)
returns int language sql immutable as $$
  select greatest(0, least(100, round(
    ((coalesce(r.estres, 0) + coalesce(r.sueno, 0) + coalesce(r.doms, 0) + coalesce(r.fatiga, 0) - 4)::numeric
      / (4 * (coalesce(r.escala, 7) - 1))) * 100)))::int
$$;

create or replace function public.alertas_staff_enviar()
returns void language plpgsql security definer set search_path = public as $$
declare
  hoy date := ahora_ar()::date;
  c record;
  txt text;
  l record;
  roles_staff text[] := array['Cuerpo técnico', 'Cuerpo médico', 'Manager'];
begin
  for c in select id from clubes loop
    -- 1) Wellness bajo dos días seguidos (hoy y ayer)
    if not exists (select 1 from alertas_staff_enviadas where club_id = c.id and fecha = hoy and clave = 'wellness-bajo') then
      select string_agg(format('%s (%s%% y %s%%)', j.nombre, wellness_pct(h), wellness_pct(a)), ', ' order by j.nombre)
        into txt
        from jugadores j
        join wellness_respuestas h on h.jugador_id = j.id and h.fecha = hoy
        join wellness_respuestas a on a.jugador_id = j.id and a.fecha = hoy - 1
       where j.club_id = c.id and wellness_pct(h) < 40 and wellness_pct(a) < 40;
      if txt is not null then
        insert into alertas_staff_enviadas (club_id, fecha, clave) values (c.id, hoy, 'wellness-bajo');
        insert into notificaciones (club_id, tipo, mensaje, roles_destino)
        values (c.id, 'alerta_wellness', 'Wellness bajo dos días seguidos: ' || txt || '.', roles_staff);
      end if;
    end if;

    -- 2) Cuatro días sin cargar wellness (solo jugadores que tienen la app; se avisa el día que cumplen 4)
    if not exists (select 1 from alertas_staff_enviadas where club_id = c.id and fecha = hoy and clave = 'wellness-sin-cargar') then
      select string_agg(x.nombre, ', ' order by x.nombre) into txt
        from (
          select j.nombre, max(w.fecha) as ultima
            from jugadores j
            join profiles p on p.jugador_id = j.id and p.confirmado and not coalesce(p.bloqueado, false)
            join wellness_respuestas w on w.jugador_id = j.id
           where j.club_id = c.id
           group by j.id, j.nombre
        ) x
       where x.ultima = hoy - 4;
      if txt is not null then
        insert into alertas_staff_enviadas (club_id, fecha, clave) values (c.id, hoy, 'wellness-sin-cargar');
        insert into notificaciones (club_id, tipo, mensaje, roles_destino)
        values (c.id, 'alerta_wellness', 'Hace 4 días que no cargan wellness: ' || txt || '.', roles_staff);
      end if;
    end if;

    -- 3) Lesiones: hoy es la fecha estimada de vuelta, o ya pasó una semana y sigue abierta
    for l in
      select le.id, le.zona, le.fecha_vuelta_estimada, j.nombre
        from lesiones le join jugadores j on j.id = le.jugador_id
       where le.club_id = c.id and le.activa
         and le.fecha_vuelta_estimada in (hoy, hoy - 7)
    loop
      if not exists (select 1 from alertas_staff_enviadas where club_id = c.id and fecha = hoy and clave = 'lesion-' || l.id) then
        insert into alertas_staff_enviadas (club_id, fecha, clave) values (c.id, hoy, 'lesion-' || l.id);
        insert into notificaciones (club_id, tipo, mensaje, roles_destino)
        values (c.id, 'alerta_lesion',
          case when l.fecha_vuelta_estimada = hoy
            then format('Hoy se cumple la fecha estimada de vuelta de %s (%s). Si ya está bien, dalo de alta desde su ficha.', l.nombre, lower(coalesce(l.zona, 'lesión')))
            else format('%s (%s) pasó una semana de su fecha estimada de vuelta y la lesión sigue abierta.', l.nombre, lower(coalesce(l.zona, 'lesión')))
          end,
          array['Cuerpo médico', 'Cuerpo técnico']);
      end if;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.alertas_staff_enviar() from public, anon, authenticated;

select cron.schedule('alertas-staff', '30 23 * * *', 'select public.alertas_staff_enviar()');
