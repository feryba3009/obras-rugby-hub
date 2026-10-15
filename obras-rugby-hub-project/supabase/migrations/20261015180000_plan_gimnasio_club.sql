-- Plan de gimnasio del club guardado entero (días, bloques y ejercicios). Lo edita el staff, lo ven todos.
create table public.plan_gimnasio_club (
  club_id uuid primary key default public.club_para_insert() references public.clubes (id),
  plan jsonb not null,
  actualizado_por uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.plan_gimnasio_club enable row level security;
create policy "plan gimnasio: lectura" on public.plan_gimnasio_club for select to authenticated
  using (club_id = public.current_club_id());
create policy "plan gimnasio: alta" on public.plan_gimnasio_club for insert to authenticated
  with check (club_id = public.current_club_id() and public.es_staff());
create policy "plan gimnasio: edicion" on public.plan_gimnasio_club for update to authenticated
  using (club_id = public.current_club_id() and public.es_staff())
  with check (club_id = public.current_club_id() and public.es_staff());
grant select, insert, update on public.plan_gimnasio_club to authenticated;
revoke all on public.plan_gimnasio_club from anon;
