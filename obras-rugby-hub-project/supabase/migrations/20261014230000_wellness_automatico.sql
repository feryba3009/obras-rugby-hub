-- Wellness automático:
--  · La carga se abre y se cierra sola según los horarios del club (hora de Argentina):
--      lunes a viernes 12:00–19:00, domingo 12:00–20:00 y el sábado según el equipo en que juega cada uno.
--  · Aviso automático al abrirse y 10 minutos antes de cerrarse (este último, solo a los que faltan).
--  · Nueva escala de 1 a 5 (las respuestas viejas quedan marcadas con escala 7).
--  · Las notificaciones pueden ir a jugadores puntuales (jugadores_destino).
set check_function_bodies = off;

-- 1) Escala de las respuestas: las existentes quedan en 7, las nuevas son de 1 a 5.
alter table public.wellness_respuestas add column if not exists escala smallint not null default 7 check (escala in (5, 7));
alter table public.wellness_respuestas alter column escala set default 5;

-- 2) Notificaciones para jugadores puntuales (null = todos los del rol)
alter table public.notificaciones add column if not exists jugadores_destino uuid[];

-- 3) Horarios por club
create or replace function public.wellness_horarios_defecto()
returns jsonb language sql immutable as $$
  select '{
    "semana":  {"abre": "12:00", "cierra": "19:00"},
    "domingo": {"abre": "12:00", "cierra": "20:00"},
    "sabado": {
      "Superior":   {"abre": "08:00", "cierra": "12:00"},
      "Intermedia": {"abre": "08:00", "cierra": "10:30"},
      "Resto":      {"abre": "08:00", "cierra": "10:30"}
    }
  }'::jsonb
$$;

create table public.wellness_horarios (
  club_id uuid primary key default public.club_para_insert() references public.clubes (id),
  horarios jsonb not null default public.wellness_horarios_defecto(),
  actualizado_por uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.wellness_horarios enable row level security;
create policy "wellness horarios: lectura" on public.wellness_horarios for select to authenticated
  using (club_id = public.current_club_id());
create policy "wellness horarios: alta" on public.wellness_horarios for insert to authenticated
  with check (club_id = public.current_club_id() and public.es_staff());
create policy "wellness horarios: edicion" on public.wellness_horarios for update to authenticated
  using (club_id = public.current_club_id() and public.es_staff())
  with check (club_id = public.current_club_id() and public.es_staff());
grant select, insert, update on public.wellness_horarios to authenticated;
revoke all on public.wellness_horarios from anon;

-- Hora actual en Argentina
create or replace function public.ahora_ar()
returns timestamp language sql stable as $$
  select now() at time zone 'America/Argentina/Buenos_Aires'
$$;

-- Equipo en el que juega un jugador: el de la formación (Superior antes que Intermedia),
-- si no, su categoría; si no está en ninguno, "Resto".
create or replace function public.equipo_jugador(p_jugador uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.nombre from lineup_slots ls join categorias c on c.id = ls.categoria_id
      where ls.jugador_id = p_jugador and c.nombre in ('Superior', 'Intermedia')
      order by case c.nombre when 'Superior' then 1 else 2 end limit 1),
    (select c.nombre from jugadores j join categorias c on c.id = j.categoria_id
      where j.id = p_jugador and c.nombre in ('Superior', 'Intermedia')),
    'Resto'
  )
$$;

-- Horario de un día para un equipo: { abre, cierra } (horas de Argentina).
create or replace function public.wellness_horario(p_club uuid, p_dia date, p_equipo text)
returns table (abre time, cierra time)
language plpgsql stable security definer set search_path = public as $$
declare
  h jsonb := coalesce((select horarios from wellness_horarios where club_id = p_club), wellness_horarios_defecto());
  d int := extract(dow from p_dia);
  tramo jsonb;
begin
  if d = 0 then tramo := h -> 'domingo';
  elsif d = 6 then tramo := coalesce(h -> 'sabado' -> p_equipo, h -> 'sabado' -> 'Resto');
  else tramo := h -> 'semana';
  end if;
  if tramo is null or tramo ->> 'abre' is null or tramo ->> 'cierra' is null then
    return;
  end if;
  abre := (tramo ->> 'abre')::time;
  cierra := (tramo ->> 'cierra')::time;
  return next;
end;
$$;

-- Ventana de hoy para el usuario logueado (jugador): equipo, horario y si está abierta ahora.
create or replace function public.wellness_mi_ventana()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  j uuid := mi_jugador_id();
  club uuid := current_club_id();
  ahora timestamp := ahora_ar();
  eq text;
  h record;
begin
  if club is null then return null; end if;
  eq := case when j is null then 'Resto' else equipo_jugador(j) end;
  select * into h from wellness_horario(club, ahora::date, eq);
  if h.abre is null then
    return jsonb_build_object('equipo', eq, 'abierta', false);
  end if;
  return jsonb_build_object(
    'equipo', eq,
    'abre', to_char(h.abre, 'HH24:MI'),
    'cierra', to_char(h.cierra, 'HH24:MI'),
    'abierta', ahora::time >= h.abre and ahora::time < h.cierra
  );
end;
$$;

-- Solo se puede cargar dentro del horario (para los jugadores; el staff puede corregir siempre).
create or replace function public.wellness_validar_horario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
begin
  if mi_rol() is distinct from 'Jugador' then
    return new;
  end if;
  if new.jugador_id is distinct from mi_jugador_id() then
    raise exception 'Solo podés cargar tu propio wellness.';
  end if;
  v := wellness_mi_ventana();
  if new.fecha <> ahora_ar()::date or coalesce((v ->> 'abierta')::boolean, false) = false then
    raise exception 'La carga de wellness está cerrada en este momento.';
  end if;
  return new;
end;
$$;

drop trigger if exists wellness_en_horario on public.wellness_respuestas;
create trigger wellness_en_horario before insert or update on public.wellness_respuestas
  for each row execute function public.wellness_validar_horario();

-- 4) Avisos automáticos (los corre pg_cron cada minuto)
create table public.wellness_avisos_enviados (
  club_id uuid not null references public.clubes (id),
  fecha date not null,
  clave text not null,
  enviado_en timestamptz not null default now(),
  primary key (club_id, fecha, clave)
);
alter table public.wellness_avisos_enviados enable row level security;
revoke all on public.wellness_avisos_enviados from anon, authenticated;

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
              '🟢 Ya podés cargar tu wellness de hoy. Tenés tiempo hasta las ' || to_char(h.cierra, 'HH24:MI') || '.',
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
              '⏰ Quedan 10 minutos para cargar tu wellness (cierra a las ' || to_char(h.cierra, 'HH24:MI') || ').',
              array['Jugador'], destino);
          end if;
        end if;
      end if;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.wellness_enviar_avisos() from public, anon, authenticated;
revoke execute on function public.wellness_horarios_defecto() from anon;
revoke execute on function public.wellness_mi_ventana() from anon;
revoke execute on function public.equipo_jugador(uuid) from anon;
revoke execute on function public.wellness_horario(uuid, date, text) from anon;

select cron.schedule('wellness-avisos', '* * * * *', 'select public.wellness_enviar_avisos()');
