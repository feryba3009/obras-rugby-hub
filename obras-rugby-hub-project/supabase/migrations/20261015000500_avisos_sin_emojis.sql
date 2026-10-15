-- Avisos automáticos de wellness sin emojis (estilo propio de ADN).
set check_function_bodies = off;

create or replace function public.wellness_enviar_avisos()
returns void language plpgsql security definer set search_path = public as $$
declare
  ahora timestamp := ahora_ar();
  hoy date := ahora::date;
  hora time := ahora::time;
  c record;
  eq text;
  equipos text[];
  h record;
  destino uuid[];
  v_clave text;
begin
  equipos := case when extract(dow from hoy) = 6 then array['Superior', 'Intermedia', 'Resto'] else array['Todos'] end;
  for c in select id from clubes loop
    foreach eq in array equipos loop
      select * into h from wellness_horario(c.id, hoy, case when eq = 'Todos' then 'Resto' else eq end);
      continue when h.abre is null;

      -- Se abrió la carga
      if hora >= h.abre and hora < h.abre + interval '15 minutes' then
        v_clave := 'abre-' || eq;
        if not exists (select 1 from wellness_avisos_enviados where club_id = c.id and fecha = hoy and clave = v_clave) then
          insert into wellness_avisos_enviados (club_id, fecha, clave) values (c.id, hoy, v_clave);
          select array_agg(j.id) into destino from jugadores j
            where j.club_id = c.id and (eq = 'Todos' or equipo_jugador(j.id) = eq);
          if destino is not null then
            insert into notificaciones (club_id, tipo, mensaje, roles_destino, jugadores_destino)
            values (c.id, 'wellness_abierto',
              'Ya podés cargar tu wellness de hoy. Tenés tiempo hasta las ' || to_char(h.cierra, 'HH24:MI') || '.',
              array['Jugador'], destino);
          end if;
        end if;
      end if;

      -- Faltan 10 minutos para el cierre: solo a los que todavía no respondieron
      if hora >= h.cierra - interval '10 minutes' and hora < h.cierra then
        v_clave := 'cierre-' || eq;
        if not exists (select 1 from wellness_avisos_enviados where club_id = c.id and fecha = hoy and clave = v_clave) then
          insert into wellness_avisos_enviados (club_id, fecha, clave) values (c.id, hoy, v_clave);
          select array_agg(j.id) into destino from jugadores j
            where j.club_id = c.id and (eq = 'Todos' or equipo_jugador(j.id) = eq)
              and not exists (select 1 from wellness_respuestas r where r.jugador_id = j.id and r.fecha = hoy);
          if destino is not null then
            insert into notificaciones (club_id, tipo, mensaje, roles_destino, jugadores_destino)
            values (c.id, 'wellness_por_cerrar',
              'Quedan 10 minutos para cargar tu wellness (cierra a las ' || to_char(h.cierra, 'HH24:MI') || ').',
              array['Jugador'], destino);
          end if;
        end if;
      end if;
    end loop;
  end loop;
end;
$$;
