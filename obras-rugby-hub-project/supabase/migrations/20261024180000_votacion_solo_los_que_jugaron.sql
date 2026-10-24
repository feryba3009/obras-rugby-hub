-- Jugador del partido: solo se puede votar a los que jugaron ese partido. Al cargarse el resultado se
-- guarda en el partido quiénes estaban en la formación (titulares y banco) de esa categoría, y el voto
-- se rechaza si el jugador no está en esa lista.
alter table public.partidos add column if not exists jugaron uuid[];

create or replace function public.guardar_jugaron()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.jugaron is null and new.goles_favor is not null and new.goles_contra is not null
     and (tg_op = 'INSERT' or old.goles_favor is null or old.goles_contra is null) then
    new.jugaron := array(select ls.jugador_id from public.lineup_slots ls
                          where ls.categoria_id = new.categoria_id and ls.jugador_id is not null);
    if array_length(new.jugaron, 1) is null then new.jugaron := null; end if;
  end if;
  return new;
end $$;
revoke execute on function public.guardar_jugaron() from public, anon, authenticated;
create trigger partidos_guardar_jugaron before insert or update on public.partidos
  for each row execute function public.guardar_jugaron();

create or replace function public.voto_solo_jugaron()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_jugaron uuid[];
begin
  select jugaron into v_jugaron from public.partidos where id = new.partido_id;
  if v_jugaron is not null and not (new.jugador_id = any(v_jugaron)) then
    raise exception 'Solo se puede votar a los que jugaron el partido.';
  end if;
  return new;
end $$;
revoke execute on function public.voto_solo_jugaron() from public, anon, authenticated;
create trigger votos_solo_jugaron before insert or update on public.votos_partido
  for each row execute function public.voto_solo_jugaron();

-- Partidos ya jugados con la votación todavía abierta: se toma la formación actual.
update public.partidos p
   set jugaron = nullif(array(select ls.jugador_id from public.lineup_slots ls where ls.categoria_id = p.categoria_id and ls.jugador_id is not null), '{}'::uuid[])
 where p.jugaron is null and p.goles_favor is not null and p.votacion_abre_at > now() - interval '24 hours';
