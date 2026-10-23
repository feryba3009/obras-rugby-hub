-- Apto médico obligatorio de la UAR: uno por jugador por temporada. Lo sube el jugador (o el staff por
-- él) como foto o PDF; el manager o el cuerpo médico lo aprueba y ahí el jugador queda "Apto".
-- Los archivos van a un bucket privado: los ve solo el propio jugador y el staff/cuerpo médico del club.
create table if not exists public.aptos_medicos (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.club_para_insert() references public.clubes(id),
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  temporada text not null,
  archivo text not null,                 -- ruta en el bucket aptos-medicos: club/jugador/archivo
  fecha_emision date,
  estado text not null default 'cargado' check (estado in ('cargado', 'aprobado', 'rechazado')),
  nota text,                             -- motivo si se rechaza
  cargado_por uuid references public.profiles(id) on delete set null,
  revisado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jugador_id, temporada)
);
create index if not exists aptos_medicos_club_idx on public.aptos_medicos (club_id, temporada);
create index if not exists aptos_medicos_cargado_idx on public.aptos_medicos (cargado_por);
create index if not exists aptos_medicos_revisado_idx on public.aptos_medicos (revisado_por);
alter table public.aptos_medicos enable row level security;
create policy "aptos: lectura" on public.aptos_medicos for select to authenticated
  using (club_id = (select public.current_club_id()) and ((select public.es_staff_o_medico()) or jugador_id = (select public.mi_jugador_id())));
create policy "aptos: alta" on public.aptos_medicos for insert to authenticated
  with check (club_id = (select public.current_club_id()) and ((select public.es_staff_o_medico())
              or (jugador_id = (select public.mi_jugador_id()) and estado = 'cargado')));
create policy "aptos: edicion staff" on public.aptos_medicos for update to authenticated
  using (club_id = (select public.current_club_id()) and (select public.es_staff_o_medico()))
  with check (club_id = (select public.current_club_id()) and (select public.es_staff_o_medico()));
-- El jugador puede volver a subirlo mientras no esté aprobado.
create policy "aptos: el propio lo reemplaza" on public.aptos_medicos for update to authenticated
  using (club_id = (select public.current_club_id()) and jugador_id = (select public.mi_jugador_id()) and estado <> 'aprobado')
  with check (club_id = (select public.current_club_id()) and jugador_id = (select public.mi_jugador_id()) and estado = 'cargado');
grant select, insert, update on public.aptos_medicos to authenticated;

-- Al aprobar, el jugador queda Apto; avisos al staff cuando llega uno y al jugador cuando se revisa.
create or replace function public.apto_medico_cambio()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nombre text;
begin
  select nombre into v_nombre from public.jugadores where id = new.jugador_id;
  if new.estado = 'aprobado' and (tg_op = 'INSERT' or old.estado is distinct from 'aprobado') then
    update public.jugadores set apto = 'Apto' where id = new.jugador_id;
    insert into public.notificaciones (tipo, mensaje, roles_destino, jugadores_destino, club_id)
    values ('apto_medico', 'Tu apto médico ' || new.temporada || ' quedó aprobado.', array['Jugador'], array[new.jugador_id], new.club_id);
  elsif new.estado = 'rechazado' and (tg_op = 'INSERT' or old.estado is distinct from 'rechazado') then
    insert into public.notificaciones (tipo, mensaje, roles_destino, jugadores_destino, club_id)
    values ('apto_medico', 'Hay que volver a subir tu apto médico' || coalesce(': ' || new.nota, '.'), array['Jugador'], array[new.jugador_id], new.club_id);
  elsif new.estado = 'cargado' and (tg_op = 'INSERT' or old.archivo is distinct from new.archivo) then
    insert into public.notificaciones (tipo, mensaje, roles_destino, club_id)
    values ('apto_medico_cargado', coalesce(v_nombre, 'Un jugador') || ' subió su apto médico ' || new.temporada || '. Falta revisarlo.', array['Manager', 'Cuerpo médico'], new.club_id);
  end if;
  return new;
end $$;
revoke execute on function public.apto_medico_cambio() from public, anon, authenticated;
create trigger aptos_medicos_cambio after insert or update on public.aptos_medicos
  for each row execute function public.apto_medico_cambio();

-- Bucket privado para los archivos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aptos-medicos', 'aptos-medicos', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;
create policy "aptos medicos: lectura" on storage.objects for select to authenticated
  using (bucket_id = 'aptos-medicos' and (storage.foldername(name))[1] = (select public.current_club_id())::text
         and ((select public.es_staff_o_medico()) or (storage.foldername(name))[2] = (select public.mi_jugador_id())::text));
create policy "aptos medicos: subida" on storage.objects for insert to authenticated
  with check (bucket_id = 'aptos-medicos' and (storage.foldername(name))[1] = (select public.current_club_id())::text
              and ((select public.es_staff_o_medico()) or (storage.foldername(name))[2] = (select public.mi_jugador_id())::text));
create policy "aptos medicos: reemplazo" on storage.objects for update to authenticated
  using (bucket_id = 'aptos-medicos' and (storage.foldername(name))[1] = (select public.current_club_id())::text
         and ((select public.es_staff_o_medico()) or (storage.foldername(name))[2] = (select public.mi_jugador_id())::text));
