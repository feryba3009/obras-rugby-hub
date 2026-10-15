-- Confirmación de la convocatoria: cada convocado responde "voy" o "no puedo" (con motivo opcional).
create table public.convocatoria_respuestas (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.club_para_insert() references public.clubes (id),
  partido_id uuid not null references public.partidos (id) on delete cascade,
  jugador_id uuid not null references public.jugadores (id) on delete cascade,
  respuesta text not null check (respuesta in ('voy', 'no_puedo')),
  motivo text,
  respondido_por uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (partido_id, jugador_id)
);
alter table public.convocatoria_respuestas enable row level security;
create policy "convocatoria: lectura" on public.convocatoria_respuestas for select to authenticated
  using (club_id = public.current_club_id());
create policy "convocatoria: alta" on public.convocatoria_respuestas for insert to authenticated
  with check (club_id = public.current_club_id() and (jugador_id = public.mi_jugador_id() or public.es_staff()));
create policy "convocatoria: edicion" on public.convocatoria_respuestas for update to authenticated
  using (club_id = public.current_club_id() and (jugador_id = public.mi_jugador_id() or public.es_staff()))
  with check (club_id = public.current_club_id() and (jugador_id = public.mi_jugador_id() or public.es_staff()));
create policy "convocatoria: baja" on public.convocatoria_respuestas for delete to authenticated
  using (club_id = public.current_club_id() and (jugador_id = public.mi_jugador_id() or public.es_staff()));
grant select, insert, update, delete on public.convocatoria_respuestas to authenticated;
revoke all on public.convocatoria_respuestas from anon;
