-- Seguimiento de destrezas (función a medida, hoy para Berazategui): el staff evalúa cada destreza de
-- ataque y de defensa de 1 a 5; cada fila es una destreza en una fecha. El jugador ve solo las suyas.
create table if not exists public.destrezas_evaluacion (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.club_para_insert() references public.clubes(id),
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  fecha date not null default (public.ahora_ar())::date,
  area text not null check (area in ('ataque', 'defensa')),
  destreza text not null check (length(trim(destreza)) > 0),
  nota smallint not null check (nota between 1 and 5),
  comentario text,
  evaluador_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists destrezas_evaluacion_jugador_idx on public.destrezas_evaluacion (jugador_id, fecha);
create index if not exists destrezas_evaluacion_club_idx on public.destrezas_evaluacion (club_id);
create index if not exists destrezas_evaluacion_evaluador_idx on public.destrezas_evaluacion (evaluador_id);
alter table public.destrezas_evaluacion enable row level security;
create policy "destrezas: lectura" on public.destrezas_evaluacion for select to authenticated
  using (club_id = (select public.current_club_id()) and ((select public.es_staff()) or jugador_id = (select public.mi_jugador_id())));
create policy "destrezas: alta" on public.destrezas_evaluacion for insert to authenticated
  with check (club_id = (select public.current_club_id()) and (select public.es_staff()));
create policy "destrezas: edicion" on public.destrezas_evaluacion for update to authenticated
  using (club_id = (select public.current_club_id()) and (select public.es_staff()))
  with check (club_id = (select public.current_club_id()) and (select public.es_staff()));
create policy "destrezas: baja" on public.destrezas_evaluacion for delete to authenticated
  using (club_id = (select public.current_club_id()) and (select public.es_staff()));
grant select, insert, update, delete on public.destrezas_evaluacion to authenticated;
