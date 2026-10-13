-- Registro de cargas del gimnasio: cada jugador anota peso y repeticiones por serie,
-- y el staff (cuerpo técnico / preparador físico) ve y carga el de todos.
set check_function_bodies = off;

-- Jugador vinculado al usuario logueado (null si no es jugador).
create or replace function public.mi_jugador_id()
returns uuid language sql stable security definer set search_path = public as $$
  select jugador_id from public.profiles where auth_user_id = auth.uid()
$$;

create table public.registros_gimnasio (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.club_para_insert() references public.clubes (id),
  jugador_id uuid not null references public.jugadores (id) on delete cascade,
  fecha date not null default current_date,
  dia_plan text,
  ejercicio text not null check (length(trim(ejercicio)) > 0),
  serie smallint not null default 1 check (serie between 1 and 20),
  repeticiones smallint check (repeticiones between 0 and 200),
  peso_kg numeric(6, 2) check (peso_kg between 0 and 1000),
  nota text,
  cargado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index registros_gimnasio_jugador_idx on public.registros_gimnasio (club_id, jugador_id, ejercicio, fecha desc);

create trigger mismo_club_jugador before insert or update on public.registros_gimnasio
  for each row execute function public.validar_mismo_club('jugador');

alter table public.registros_gimnasio enable row level security;

-- Ver: el propio jugador sus registros; staff y cuerpo médico, los de todo el club.
create policy "gimnasio: lectura" on public.registros_gimnasio for select to authenticated
  using (
    club_id = public.current_club_id()
    and (jugador_id = public.mi_jugador_id() or public.es_staff() or public.mi_rol() = 'Cuerpo médico')
  );

-- Cargar, corregir y borrar: el propio jugador lo suyo; el staff, lo de cualquiera del club.
create policy "gimnasio: alta" on public.registros_gimnasio for insert to authenticated
  with check (club_id = public.current_club_id() and (jugador_id = public.mi_jugador_id() or public.es_staff()));

create policy "gimnasio: edicion" on public.registros_gimnasio for update to authenticated
  using (club_id = public.current_club_id() and (jugador_id = public.mi_jugador_id() or public.es_staff()))
  with check (club_id = public.current_club_id() and (jugador_id = public.mi_jugador_id() or public.es_staff()));

create policy "gimnasio: baja" on public.registros_gimnasio for delete to authenticated
  using (club_id = public.current_club_id() and (jugador_id = public.mi_jugador_id() or public.es_staff()));

grant select, insert, update, delete on public.registros_gimnasio to authenticated;
revoke all on public.registros_gimnasio from anon;
revoke execute on function public.mi_jugador_id() from anon;
