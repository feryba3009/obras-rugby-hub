-- Tabla de posiciones por fase: la regular y la de la zona de la fase final donde quedó el club.
alter table public.posiciones add column if not exists fase text not null default 'regular';
alter table public.posiciones add column if not exists zona text;

-- Resultados mal etiquetados (el tanteo era correcto, la etiqueta Ganado/Perdido no).
update public.partidos
set resultado = case when goles_favor > goles_contra then 'Ganado' when goles_favor < goles_contra then 'Perdido' else 'Empate' end
where resultado in ('Ganado', 'Perdido', 'Empate') and goles_favor is not null and goles_contra is not null
  and resultado <> case when goles_favor > goles_contra then 'Ganado' when goles_favor < goles_contra then 'Perdido' else 'Empate' end;
