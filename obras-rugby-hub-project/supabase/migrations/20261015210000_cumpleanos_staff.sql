-- El staff también carga su fecha de nacimiento y recibe su saludo.
-- Las notificaciones pueden ir a perfiles puntuales (perfiles_destino), además de por rol o por jugador.
set check_function_bodies = off;

alter table public.profiles add column if not exists fecha_nacimiento date;
alter table public.notificaciones add column if not exists perfiles_destino uuid[];

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_jugador_id uuid;
  v_nombre_nuevo text;
  v_posicion_nueva text;
  v_club uuid;
  v_nacimiento date;
begin
  select id into v_club from public.clubes where slug = nullif(new.raw_user_meta_data->>'club_slug', '');
  v_club := coalesce(v_club, public.club_por_defecto());

  v_jugador_id := nullif(new.raw_user_meta_data->>'jugador_id', '')::uuid;
  if v_jugador_id is not null and not exists (select 1 from public.jugadores where id = v_jugador_id and club_id = v_club) then
    v_jugador_id := null;
  end if;
  v_nombre_nuevo := nullif(new.raw_user_meta_data->>'nombre_nuevo_jugador', '');
  v_posicion_nueva := nullif(new.raw_user_meta_data->>'posicion_nueva', '');
  begin
    v_nacimiento := nullif(new.raw_user_meta_data->>'fecha_nacimiento', '')::date;
    if v_nacimiento < date '1940-01-01' or v_nacimiento > current_date then v_nacimiento := null; end if;
  exception when others then
    v_nacimiento := null;
  end;

  if v_jugador_id is null and v_nombre_nuevo is not null then
    insert into public.jugadores (nombre, posicion_ideal, apto, estado, club_id, fecha_nacimiento)
    values (v_nombre_nuevo, coalesce(v_posicion_nueva, 'Centro'), 'Pendiente', 'Disponible', v_club, v_nacimiento)
    returning id into v_jugador_id;
  end if;

  insert into public.profiles (auth_user_id, nombre, usuario, rol, jugador_id, confirmado, club_id, fecha_nacimiento)
  values (
    new.id,
    coalesce(v_nombre_nuevo, new.raw_user_meta_data->>'nombre'),
    new.raw_user_meta_data->>'usuario',
    coalesce(new.raw_user_meta_data->>'rol', 'Jugador'),
    v_jugador_id,
    false,
    v_club,
    v_nacimiento
  )
  on conflict (auth_user_id) do nothing;

  if v_jugador_id is not null then
    update public.jugadores
    set altura_cm = coalesce(nullif(new.raw_user_meta_data->>'altura', '')::int, altura_cm),
        peso_kg = coalesce(nullif(new.raw_user_meta_data->>'peso', '')::int, peso_kg),
        fecha_nacimiento = coalesce(v_nacimiento, fecha_nacimiento)
    where id = v_jugador_id;
  end if;

  return new;
end $function$;

create or replace function public.cumpleanos_saludar()
returns void language plpgsql security definer set search_path = public as $$
declare
  hoy date := ahora_ar()::date;
  c record;
  j record;
  nombres text;
begin
  for c in select id, coalesce(nombre_corto, nombre) as club from clubes loop
    continue when exists (select 1 from alertas_staff_enviadas where club_id = c.id and fecha = hoy and clave = 'cumpleanos');
    nombres := null;
    -- Jugadores
    for j in
      select id, nombre from jugadores
       where club_id = c.id and fecha_nacimiento is not null
         and to_char(fecha_nacimiento, 'MM-DD') = to_char(hoy, 'MM-DD')
    loop
      insert into notificaciones (club_id, tipo, mensaje, roles_destino, jugadores_destino)
      values (c.id, 'cumpleanos', format('¡Feliz cumpleaños, %s! Que lo pases muy bien. Un abrazo de todo %s.', split_part(j.nombre, ' ', 1), c.club), array['Jugador'], array[j.id]);
      nombres := coalesce(nombres || ', ', '') || j.nombre;
    end loop;
    -- Staff (los que no son jugadores)
    for j in
      select id, nombre, rol from profiles
       where club_id = c.id and rol <> 'Jugador' and fecha_nacimiento is not null
         and to_char(fecha_nacimiento, 'MM-DD') = to_char(hoy, 'MM-DD')
    loop
      insert into notificaciones (club_id, tipo, mensaje, perfiles_destino)
      values (c.id, 'cumpleanos', format('¡Feliz cumpleaños, %s! Que lo pases muy bien. Un abrazo de todo %s.', split_part(j.nombre, ' ', 1), c.club), array[j.id]);
      nombres := coalesce(nombres || ', ', '') || j.nombre || ' (' || lower(j.rol) || ')';
    end loop;
    if nombres is not null then
      insert into alertas_staff_enviadas (club_id, fecha, clave) values (c.id, hoy, 'cumpleanos');
      insert into notificaciones (club_id, tipo, mensaje, roles_destino)
      values (c.id, 'cumpleanos', 'Hoy cumple años: ' || nombres || '.', array['Cuerpo técnico', 'Cuerpo médico', 'Manager']);
    end if;
  end loop;
end;
$$;
revoke execute on function public.cumpleanos_saludar() from public, anon, authenticated;
