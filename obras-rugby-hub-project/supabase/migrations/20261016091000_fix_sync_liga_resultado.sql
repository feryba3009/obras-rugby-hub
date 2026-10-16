-- Bug: si el rival no es un club de ADN (local_club_id nulo), "p.club_id = new.local_club_id" da NULL y el
-- partido quedaba "Perdido" aunque Obras ganara de visitante. Se compara con IS NOT DISTINCT FROM.
create or replace function public.sync_liga_a_clubes()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.estado = 'Jugado' and new.tantos_local is not null and new.tantos_visitante is not null then
    update public.partidos p set
      goles_favor   = case when p.club_id is not distinct from new.local_club_id then new.tantos_local else new.tantos_visitante end,
      goles_contra  = case when p.club_id is not distinct from new.local_club_id then new.tantos_visitante else new.tantos_local end,
      resultado = case
        when new.tantos_local = new.tantos_visitante then 'Empate'
        when (p.club_id is not distinct from new.local_club_id) = (new.tantos_local > new.tantos_visitante) then 'Ganado'
        else 'Perdido'
      end
    where p.partido_liga_id = new.id
      and p.club_id in (new.local_club_id, new.visitante_club_id);
  end if;
  return new;
end $function$;

update public.partidos
set resultado = case when goles_favor > goles_contra then 'Ganado' when goles_favor < goles_contra then 'Perdido' else 'Empate' end
where resultado in ('Ganado', 'Perdido', 'Empate') and goles_favor is not null and goles_contra is not null
  and resultado <> case when goles_favor > goles_contra then 'Ganado' when goles_favor < goles_contra then 'Perdido' else 'Empate' end;
