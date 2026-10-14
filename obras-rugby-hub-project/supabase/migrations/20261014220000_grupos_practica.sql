-- Cómo arma cada club el Grupo 1 y el Grupo 2 de la práctica.
--   criterio 'equipos': Grupo 1 = los que están en las formaciones de los dos primeros equipos
--                       (Superior e Intermedia); Grupo 2 = el resto del plantel.
--   criterio 'mitades': el plantel partido en dos mitades parejas (alternando por puesto).
--   ajustes: cambios a mano del staff, { "<jugador_id>": 1 | 2 }, que pisan el criterio.
-- Lo lee todo el club (cada jugador ve su grupo); lo cambia el staff.
set check_function_bodies = off;

create table public.grupos_practica (
  club_id uuid primary key default public.club_para_insert() references public.clubes (id),
  criterio text not null default 'equipos' check (criterio in ('equipos', 'mitades')),
  ajustes jsonb not null default '{}'::jsonb,
  actualizado_por uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.grupos_practica enable row level security;

create policy "grupos practica: lectura" on public.grupos_practica for select to authenticated
  using (club_id = public.current_club_id());

create policy "grupos practica: alta" on public.grupos_practica for insert to authenticated
  with check (club_id = public.current_club_id() and public.es_staff());

create policy "grupos practica: edicion" on public.grupos_practica for update to authenticated
  using (club_id = public.current_club_id() and public.es_staff())
  with check (club_id = public.current_club_id() and public.es_staff());

grant select, insert, update on public.grupos_practica to authenticated;
revoke all on public.grupos_practica from anon;
