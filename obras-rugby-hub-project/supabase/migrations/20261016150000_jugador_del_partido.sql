-- Jugador del partido: después de cada partido el plantel y el staff votan al mejor.
-- La votación queda abierta desde que se carga el resultado hasta 3 días después del partido.
-- Mientras está abierta, cada uno ve solo su voto (el staff ve el conteo); al cerrar se anuncia el ganador.

create table if not exists public.votos_partido (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.club_para_insert() references public.clubes(id),
  partido_id uuid not null references public.partidos(id) on delete cascade,
  votante uuid not null default auth.uid(),
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (partido_id, votante)
);
create index if not exists votos_partido_partido_idx on public.votos_partido (partido_id);

create or replace function public.votacion_abierta(p_partido uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from partidos
     where id = p_partido
       and resultado in ('Ganado', 'Perdido', 'Empate')
       and fecha is not null
       and ahora_ar()::date <= fecha + 3
  );
$$;

alter table public.votos_partido enable row level security;
create policy "votos: lectura" on public.votos_partido for select to authenticated
  using (club_id = current_club_id() and (votante = auth.uid() or es_staff()));
create policy "votos: alta" on public.votos_partido for insert to authenticated
  with check (club_id = current_club_id() and votante = auth.uid() and votacion_abierta(partido_id)
              and jugador_id is distinct from mi_jugador_id());
create policy "votos: cambio" on public.votos_partido for update to authenticated
  using (club_id = current_club_id() and votante = auth.uid() and votacion_abierta(partido_id))
  with check (club_id = current_club_id() and votante = auth.uid() and votacion_abierta(partido_id)
              and jugador_id is distinct from mi_jugador_id());

create trigger mismo_club_jugador before insert or update on public.votos_partido
  for each row execute function validar_mismo_club('jugador');

-- Resultado: el staff lo ve en vivo; el resto, cuando cierra la votación.
create or replace function public.mvp_resultado(p_partido uuid)
returns table (jugador_id uuid, votos int)
language sql stable security definer set search_path to 'public' as $$
  select v.jugador_id, count(*)::int
    from votos_partido v join partidos p on p.id = v.partido_id
   where v.partido_id = p_partido and p.club_id = current_club_id()
     and (es_staff() or not votacion_abierta(p_partido))
   group by v.jugador_id
   order by 2 desc;
$$;

-- Ganadores de las votaciones cerradas (para la ficha y los resúmenes). Empate: todos los más votados.
create or replace function public.mvp_ganadores()
returns table (partido_id uuid, jugador_id uuid, votos int, total int)
language sql stable security definer set search_path to 'public' as $$
  with conteo as (
    select v.partido_id, v.jugador_id, count(*)::int as votos,
           sum(count(*)) over (partition by v.partido_id)::int as total,
           max(count(*)) over (partition by v.partido_id) as maximo
      from votos_partido v join partidos p on p.id = v.partido_id
     where p.club_id = current_club_id() and not votacion_abierta(p.id)
     group by v.partido_id, v.jugador_id
  )
  select partido_id, jugador_id, votos, total from conteo where votos = maximo;
$$;

-- Aviso al cargar el resultado: "Votá al jugador del partido".
create or replace function public.mvp_abrir_votacion()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_rival text;
  v_cat text;
begin
  if new.resultado in ('Ganado', 'Perdido', 'Empate')
     and coalesce(old.resultado, 'Próximo') not in ('Ganado', 'Perdido', 'Empate')
     and new.fecha is not null and ahora_ar()::date <= new.fecha + 3 then
    select nombre into v_rival from equipos_rivales where id = new.rival_id;
    select nombre into v_cat from categorias where id = new.categoria_id;
    insert into notificaciones (club_id, tipo, mensaje, roles_destino)
    values (new.club_id, 'votar_mvp',
            '🏉 Votá al jugador del partido' || coalesce(' (' || v_cat || ')', '') || coalesce(' vs ' || v_rival, '') || '. Tenés hasta el ' || to_char(new.fecha + 3, 'DD/MM') || '.',
            array['Jugador', 'Cuerpo técnico', 'Manager', 'Cuerpo médico']);
  end if;
  return new;
end $$;
create trigger mvp_abrir_votacion after update of resultado on public.partidos
  for each row execute function public.mvp_abrir_votacion();

-- Anuncio diario del ganador de las votaciones que cerraron ayer.
create or replace function public.mvp_anunciar()
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  p record;
  v_ganadores text;
  v_rival text;
  v_cat text;
  v_clave text;
begin
  for p in select * from partidos
            where resultado in ('Ganado', 'Perdido', 'Empate') and fecha is not null
              and fecha + 3 < ahora_ar()::date and fecha + 10 >= ahora_ar()::date loop
    v_clave := 'mvp-' || p.id;
    continue when exists (select 1 from alertas_staff_enviadas where club_id = p.club_id and clave = v_clave);
    with conteo as (
      select v.jugador_id, count(*) as votos, max(count(*)) over () as maximo
        from votos_partido v where v.partido_id = p.id group by v.jugador_id
    )
    select string_agg(j.nombre, ' y ' order by j.nombre) into v_ganadores
      from conteo c join jugadores j on j.id = c.jugador_id where c.votos = c.maximo;
    insert into alertas_staff_enviadas (club_id, fecha, clave) values (p.club_id, ahora_ar()::date, v_clave);
    continue when v_ganadores is null;
    select nombre into v_rival from equipos_rivales where id = p.rival_id;
    select nombre into v_cat from categorias where id = p.categoria_id;
    insert into notificaciones (club_id, tipo, mensaje, roles_destino)
    values (p.club_id, 'mvp_ganador',
            '🏆 Jugador del partido' || coalesce(' (' || v_cat || ')', '') || coalesce(' vs ' || v_rival, '') || ': ' || v_ganadores || '. ¡Felicitaciones!',
            array['Jugador', 'Cuerpo técnico', 'Manager', 'Cuerpo médico']);
  end loop;
end $$;

select cron.schedule('mvp-anunciar', '0 14 * * *', 'select public.mvp_anunciar()');
