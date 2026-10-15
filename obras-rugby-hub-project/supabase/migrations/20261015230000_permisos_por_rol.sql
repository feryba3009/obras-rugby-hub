-- Permisos por rol: solo el staff (cuerpo técnico, manager y cuerpo médico) modifica los datos del club
-- y de los jugadores. Cada jugador carga lo suyo: su wellness, sus datos personales (fecha de nacimiento,
-- altura, peso, foto) y sus antecedentes. Todo el club sigue pudiendo VER lo de su club.
set check_function_bodies = off;

create or replace function public.es_staff_o_medico()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('Cuerpo técnico', 'Manager', 'Cuerpo médico'), false)
$$;
revoke execute on function public.es_staff_o_medico() from anon;

-- La escritura general ("club: escritura") pasa a ser solo del staff
do $$
declare t text;
begin
  foreach t in array array['config', 'equipos_rivales', 'evaluaciones', 'gps_datos', 'lineup_slots', 'partidos',
                           'plan_gimnasio', 'posiciones', 'sesiones', 'wellness_ventanas',
                           'jugadores', 'historial_medico', 'wellness_respuestas', 'notificaciones'] loop
    execute format('alter policy "club: escritura" on public.%I using (club_id = public.current_club_id() and public.es_staff_o_medico()) with check (club_id = public.current_club_id() and public.es_staff_o_medico())', t);
  end loop;
end $$;

-- Jugador: edita solo su ficha y solo sus datos personales (lo controla el trigger)
create policy "jugadores: el propio" on public.jugadores for update to authenticated
  using (club_id = public.current_club_id() and id = public.mi_jugador_id())
  with check (club_id = public.current_club_id() and id = public.mi_jugador_id());

create or replace function public.proteger_jugador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.es_staff_o_medico() then return new; end if;
  if new.nombre is distinct from old.nombre
     or new.posicion_ideal is distinct from old.posicion_ideal
     or new.posicion_alternativa is distinct from old.posicion_alternativa
     or new.posicion_emergencia is distinct from old.posicion_emergencia
     or new.apto is distinct from old.apto
     or new.estado is distinct from old.estado
     or new.zona_lesion is distinct from old.zona_lesion
     or new.categoria_id is distinct from old.categoria_id
     or new.club_id is distinct from old.club_id then
    raise exception 'Ese dato lo cambia el staff del club.';
  end if;
  return new;
end;
$$;
create trigger proteger_jugador before update on public.jugadores
  for each row execute function public.proteger_jugador();

create policy "historial: el propio" on public.historial_medico for insert to authenticated
  with check (club_id = public.current_club_id() and jugador_id = public.mi_jugador_id());

create policy "wellness: el propio alta" on public.wellness_respuestas for insert to authenticated
  with check (club_id = public.current_club_id() and jugador_id = public.mi_jugador_id());
create policy "wellness: el propio edicion" on public.wellness_respuestas for update to authenticated
  using (club_id = public.current_club_id() and jugador_id = public.mi_jugador_id())
  with check (club_id = public.current_club_id() and jugador_id = public.mi_jugador_id());

-- Cualquiera del club puede generar un aviso (ej. "no voy a la práctica"); editar o borrar, solo el staff
create policy "notificaciones: alta" on public.notificaciones for insert to authenticated
  with check (club_id = public.current_club_id());
