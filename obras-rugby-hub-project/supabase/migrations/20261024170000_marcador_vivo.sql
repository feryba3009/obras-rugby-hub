-- Marcador en vivo: mientras el staff lleva el partido en vivo, el resultado, el reloj y las últimas
-- incidencias se publican acá y todo el club lo puede seguir desde la app. Solo el cuerpo técnico y el
-- manager lo actualizan. El reloj se guarda como segundos acumulados + hora en que arrancó a correr,
-- así cada celular lo calcula solo sin que haya que mandar cada segundo.
create table if not exists public.marcador_vivo (
  partido_id uuid primary key references public.partidos(id) on delete cascade,
  club_id uuid not null default public.club_para_insert() references public.clubes(id),
  categoria text,
  rival text,
  gf int not null default 0,
  gc int not null default 0,
  reloj_acumulado int not null default 0,
  reloj_inicio timestamptz,
  estado text not null default 'en_juego' check (estado in ('en_juego', 'pausa', 'final')),
  incidencias jsonb not null default '[]'::jsonb,
  actualizado_por uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists marcador_vivo_club_idx on public.marcador_vivo (club_id, updated_at desc);
create index if not exists marcador_vivo_actualizado_idx on public.marcador_vivo (actualizado_por);
alter table public.marcador_vivo enable row level security;
create policy "marcador: lectura" on public.marcador_vivo for select to authenticated
  using (club_id = (select public.current_club_id()));
create policy "marcador: alta" on public.marcador_vivo for insert to authenticated
  with check (club_id = (select public.current_club_id()) and (select public.es_staff()));
create policy "marcador: edicion" on public.marcador_vivo for update to authenticated
  using (club_id = (select public.current_club_id()) and (select public.es_staff()))
  with check (club_id = (select public.current_club_id()) and (select public.es_staff()));
grant select, insert, update on public.marcador_vivo to authenticated;
