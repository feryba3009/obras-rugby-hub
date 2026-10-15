-- 1) Cuándo se avisó a los convocados de cada partido (las confirmaciones se muestran recién después).
alter table public.partidos add column if not exists convocatoria_publicada_at timestamptz;

-- 2) Videoteca: vincula los partidos de Obras con el fixture de la liga y copia los resultados
--    (lo llama la sincronización con la URBA de los domingos).
--    El fixture 2026 (fase regular + zona Formativo de la fase final, Superior e Intermedia) se cargó
--    una vez desde la API pública de la URBA el 15/10/2026.
create or replace function public.sync_partidos_liga()
returns void language plpgsql security definer set search_path = public as $$
begin
  update partidos p set partido_liga_id = pl.id
    from partidos_liga pl join torneos t on t.id = pl.torneo_id, categorias c
   where p.partido_liga_id is null and c.id = p.categoria_id
     and t.categoria = case c.nombre when 'Superior' then 'Primera' else c.nombre end
     and t.temporada = p.temporada and t.division = 'Desarrollo'
     and pl.fecha_numero = p.fecha_numero
     and (pl.local_club_id = p.club_id or pl.visitante_club_id = p.club_id);
  update partidos_liga pl
     set tantos_local = case when pl.local_club_id = p.club_id then p.goles_favor else p.goles_contra end,
         tantos_visitante = case when pl.local_club_id = p.club_id then p.goles_contra else p.goles_favor end,
         estado = 'Jugado', fecha = p.fecha, updated_at = now()
    from partidos p
   where p.partido_liga_id = pl.id and p.resultado in ('Ganado', 'Perdido', 'Empate')
     and (pl.estado <> 'Jugado' or pl.tantos_local is null);
end;
$$;
revoke execute on function public.sync_partidos_liga() from public, anon, authenticated;
