-- Jugador del partido: la votación dura 24 horas desde que se carga el resultado y el voto no se cambia.
alter table public.partidos add column if not exists votacion_abre_at timestamptz;

create or replace function public.votacion_abierta(p_partido uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from partidos
     where id = p_partido
       and resultado in ('Ganado', 'Perdido', 'Empate')
       and votacion_abre_at is not null
       and now() < votacion_abre_at + interval '24 hours'
  );
$$;

-- Marca la apertura cuando el resultado se carga por primera vez (solo partidos recientes).
create or replace function public.mvp_marcar_apertura()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.resultado in ('Ganado', 'Perdido', 'Empate')
     and coalesce(old.resultado, 'Próximo') not in ('Ganado', 'Perdido', 'Empate')
     and new.votacion_abre_at is null
     and new.fecha is not null and new.fecha >= ahora_ar()::date - 3 then
    new.votacion_abre_at := now();
  end if;
  return new;
end $$;
create trigger mvp_marcar_apertura before update of resultado on public.partidos
  for each row execute function public.mvp_marcar_apertura();

create or replace function public.mvp_abrir_votacion()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_rival text;
  v_cat text;
begin
  if new.votacion_abre_at is not null and old.votacion_abre_at is null then
    select nombre into v_rival from equipos_rivales where id = new.rival_id;
    select nombre into v_cat from categorias where id = new.categoria_id;
    insert into notificaciones (club_id, tipo, mensaje, roles_destino)
    values (new.club_id, 'votar_mvp',
            '🏉 Votá al jugador del partido' || coalesce(' (' || v_cat || ')', '') || coalesce(' vs ' || v_rival, '') || '. Tenés 24 horas.',
            array['Jugador', 'Cuerpo técnico', 'Manager', 'Cuerpo médico']);
  end if;
  return new;
end $$;

-- Sin cambio de voto.
alter policy "votos: cambio" on public.votos_partido using (false) with check (false);

-- Anuncio del ganador apenas cierra (se revisa cada hora).
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
            where votacion_abre_at is not null
              and votacion_abre_at + interval '24 hours' <= now()
              and votacion_abre_at > now() - interval '7 days' loop
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
select cron.schedule('mvp-anunciar', '5 * * * *', 'select public.mvp_anunciar()');

-- Esfuerzo: uno solo por día, por el total de la sesión.
create unique index if not exists rpe_sesiones_un_dia_idx on public.rpe_sesiones (jugador_id, fecha);
