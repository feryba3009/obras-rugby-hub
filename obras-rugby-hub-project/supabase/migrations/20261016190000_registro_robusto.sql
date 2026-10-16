-- Registro más robusto (problemas reales del 15/10):
--  · Altura "1,88" (en metros, con coma) hacía fallar todo el registro (error 500). Ahora se interpreta:
--    1,88 / 1.88 → 188 cm; "188 cm" → 188. Peso igual ("95,5" → 96). Si no se entiende, se ignora.
--  · Un nombre de usuario ya tomado también hacía fallar el registro. Ahora se le agrega un número.
--  · "Soy nuevo" con un nombre que ya estaba en la lista (otra mayúscula, un segundo nombre de más)
--    creaba un jugador duplicado. Ahora, si coincide con un jugador del club sin cuenta, se vincula a ese.

create or replace function public.numero_suelto(t text, minimo numeric, maximo numeric, metros boolean default false)
returns int language plpgsql immutable as $$
declare v numeric;
begin
  if t is null or btrim(t) = '' then return null; end if;
  v := nullif(regexp_replace(replace(btrim(t), ',', '.'), '[^0-9.]', '', 'g'), '')::numeric;
  if metros and v < 3 then v := v * 100; end if;
  if v < minimo or v > maximo then return null; end if;
  return round(v)::int;
exception when others then
  return null;
end $$;

create or replace function public.nombre_clave(t text)
returns text language sql immutable as $$
  select btrim(regexp_replace(lower(translate(coalesce(t, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '\s+', ' ', 'g'));
$$;

-- Jugador del club sin cuenta que es "el mismo" que el nombre escrito: igual nombre completo,
-- o mismo primer nombre y mismo último apellido.
create or replace function public.jugador_parecido(p_club uuid, p_nombre text)
returns uuid language sql stable security definer set search_path to 'public' as $$
  with b as (select nombre_clave(p_nombre) k, string_to_array(nombre_clave(p_nombre), ' ') p)
  select j.id from jugadores j, b
   where j.club_id = p_club
     and not exists (select 1 from profiles pr where pr.jugador_id = j.id)
     and (nombre_clave(j.nombre) = b.k
          or (array_length(b.p, 1) > 1
              and split_part(nombre_clave(j.nombre), ' ', 1) = b.p[1]
              and (string_to_array(nombre_clave(j.nombre), ' '))[array_length(string_to_array(nombre_clave(j.nombre), ' '), 1)] = b.p[array_length(b.p, 1)]))
   order by (nombre_clave(j.nombre) = b.k) desc, j.created_at
   limit 1;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_jugador_id uuid;
  v_nombre_nuevo text;
  v_posicion_nueva text;
  v_club uuid;
  v_nacimiento date;
  v_usuario text;
  v_n int := 1;
begin
  select id into v_club from public.clubes where slug = nullif(new.raw_user_meta_data->>'club_slug', '');
  v_club := coalesce(v_club, public.club_por_defecto());

  begin
    v_jugador_id := nullif(new.raw_user_meta_data->>'jugador_id', '')::uuid;
  exception when others then v_jugador_id := null;
  end;
  if v_jugador_id is not null and not exists (select 1 from public.jugadores where id = v_jugador_id and club_id = v_club) then
    v_jugador_id := null;
  end if;
  v_nombre_nuevo := nullif(btrim(new.raw_user_meta_data->>'nombre_nuevo_jugador'), '');
  v_posicion_nueva := nullif(new.raw_user_meta_data->>'posicion_nueva', '');
  begin
    v_nacimiento := nullif(new.raw_user_meta_data->>'fecha_nacimiento', '')::date;
    if v_nacimiento < date '1940-01-01' or v_nacimiento > current_date then v_nacimiento := null; end if;
  exception when others then
    v_nacimiento := null;
  end;

  if v_jugador_id is null and v_nombre_nuevo is not null then
    v_jugador_id := public.jugador_parecido(v_club, v_nombre_nuevo);
    if v_jugador_id is null then
      insert into public.jugadores (nombre, posicion_ideal, apto, estado, club_id, fecha_nacimiento)
      values (v_nombre_nuevo, coalesce(v_posicion_nueva, 'Centro'), 'Pendiente', 'Disponible', v_club, v_nacimiento)
      returning id into v_jugador_id;
    else
      v_nombre_nuevo := (select nombre from public.jugadores where id = v_jugador_id);
    end if;
  end if;

  -- Usuario único: si ya existe, se le agrega un número.
  v_usuario := nullif(btrim(new.raw_user_meta_data->>'usuario'), '');
  if v_usuario is not null then
    while exists (select 1 from public.profiles where usuario = v_usuario || case when v_n = 1 then '' else v_n::text end) loop
      v_n := v_n + 1;
    end loop;
    v_usuario := v_usuario || case when v_n = 1 then '' else v_n::text end;
  end if;

  insert into public.profiles (auth_user_id, nombre, usuario, rol, jugador_id, confirmado, club_id, fecha_nacimiento)
  values (
    new.id,
    coalesce(v_nombre_nuevo, (select nombre from public.jugadores where id = v_jugador_id), new.raw_user_meta_data->>'nombre'),
    v_usuario,
    coalesce(new.raw_user_meta_data->>'rol', 'Jugador'),
    v_jugador_id,
    false,
    v_club,
    v_nacimiento
  )
  on conflict (auth_user_id) do nothing;

  if v_jugador_id is not null then
    update public.jugadores
    set altura_cm = coalesce(public.numero_suelto(new.raw_user_meta_data->>'altura', 120, 230, true), altura_cm),
        peso_kg = coalesce(public.numero_suelto(new.raw_user_meta_data->>'peso', 35, 200), peso_kg),
        fecha_nacimiento = coalesce(v_nacimiento, fecha_nacimiento)
    where id = v_jugador_id;
  end if;

  return new;
end $function$;
