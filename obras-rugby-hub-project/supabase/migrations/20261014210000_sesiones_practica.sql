-- Práctica del día: el plan semanal de cada club (un registro por día de la semana),
-- con los bloques de Grupo 1 y Grupo 2. Lo ve todo el club; lo edita el staff.
set check_function_bodies = off;

create table public.sesiones_practica (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.club_para_insert() references public.clubes (id),
  dia text not null check (dia in ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo')),
  grupos jsonb not null default '{"grupo1": [], "grupo2": []}'::jsonb,
  actualizado_por uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (club_id, dia)
);

alter table public.sesiones_practica enable row level security;

create policy "practica: lectura" on public.sesiones_practica for select to authenticated
  using (club_id = public.current_club_id());

create policy "practica: alta" on public.sesiones_practica for insert to authenticated
  with check (club_id = public.current_club_id() and public.es_staff());

create policy "practica: edicion" on public.sesiones_practica for update to authenticated
  using (club_id = public.current_club_id() and public.es_staff())
  with check (club_id = public.current_club_id() and public.es_staff());

create policy "practica: baja" on public.sesiones_practica for delete to authenticated
  using (club_id = public.current_club_id() and public.es_staff());

grant select, insert, update, delete on public.sesiones_practica to authenticated;
revoke all on public.sesiones_practica from anon;
