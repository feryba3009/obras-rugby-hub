-- Esfuerzo de la sesión (RPE): al terminar cada práctica, gimnasio o partido el jugador marca del 1 al 10
-- qué tan dura fue y cuántos minutos duró. Carga = esfuerzo × minutos.

create table if not exists public.rpe_sesiones (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.club_para_insert() references public.clubes(id),
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  fecha date not null default (public.ahora_ar())::date,
  tipo text not null check (tipo in ('Práctica', 'Gimnasio', 'Partido')),
  rpe int not null check (rpe between 1 and 10),
  minutos int not null check (minutos between 1 and 300),
  carga int generated always as (rpe * minutos) stored,
  updated_at timestamptz not null default now(),
  unique (jugador_id, fecha, tipo)
);
create index if not exists rpe_sesiones_club_fecha_idx on public.rpe_sesiones (club_id, fecha desc);

alter table public.rpe_sesiones enable row level security;
create policy "rpe: lectura" on public.rpe_sesiones for select to authenticated
  using (club_id = current_club_id() and (jugador_id = mi_jugador_id() or es_staff_o_medico()));
create policy "rpe: alta" on public.rpe_sesiones for insert to authenticated
  with check (club_id = current_club_id() and (jugador_id = mi_jugador_id() or es_staff()));
create policy "rpe: edicion" on public.rpe_sesiones for update to authenticated
  using (club_id = current_club_id() and (jugador_id = mi_jugador_id() or es_staff()))
  with check (club_id = current_club_id() and (jugador_id = mi_jugador_id() or es_staff()));
create policy "rpe: baja" on public.rpe_sesiones for delete to authenticated
  using (club_id = current_club_id() and (jugador_id = mi_jugador_id() or es_staff()));

create trigger mismo_club_jugador before insert or update on public.rpe_sesiones
  for each row execute function validar_mismo_club('jugador');

-- Recordatorio a la noche (22 h de Argentina) a los que entrenaron o jugaron hoy y no cargaron el esfuerzo:
--  · práctica: los que confirmaron que iban;
--  · gimnasio: los que anotaron cargas hoy;
--  · partido: los que dijeron "Voy" a la convocatoria del partido de hoy.
create or replace function public.rpe_recordar()
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  hoy date := ahora_ar()::date;
  c record;
  destino uuid[];
begin
  for c in select id from clubes loop
    continue when exists (select 1 from alertas_staff_enviadas where club_id = c.id and fecha = hoy and clave = 'rpe-recordatorio');
    select array_agg(distinct j.id) into destino
      from jugadores j join profiles p on p.jugador_id = j.id and p.confirmado
     where j.club_id = c.id
       and not exists (select 1 from rpe_sesiones r where r.jugador_id = j.id and r.fecha = hoy)
       and (
         (hay_practica(c.id, hoy) and exists (select 1 from practica_respuestas pr where pr.jugador_id = j.id and pr.fecha = hoy and pr.respuesta = 'voy'))
         or exists (select 1 from registros_gimnasio g where g.jugador_id = j.id and g.fecha = hoy)
         or exists (select 1 from convocatoria_respuestas cr join partidos pa on pa.id = cr.partido_id
                     where cr.jugador_id = j.id and cr.respuesta = 'voy' and pa.fecha = hoy)
       );
    continue when destino is null;
    insert into alertas_staff_enviadas (club_id, fecha, clave) values (c.id, hoy, 'rpe-recordatorio');
    insert into notificaciones (club_id, tipo, mensaje, roles_destino, jugadores_destino)
    values (c.id, 'rpe_cargar', '¿Qué tan dura fue la sesión de hoy? Marcalo del 1 al 10 en la app, son 10 segundos.', array['Jugador'], destino);
  end loop;
end $$;

select cron.schedule('rpe-recordatorio', '0 1 * * *', 'select public.rpe_recordar()');
