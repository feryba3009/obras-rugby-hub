-- =====================================================================================
-- ADN Sports — base multi-club, datos compartidos, videoteca y benchmarks
-- =====================================================================================
-- Qué hace esta migración:
--   1. Crea la tabla de clubes y registra a Obras como primer club (y club por defecto).
--   2. Agrega club_id a todas las tablas "del club" y le asigna a Obras todo lo existente.
--   3. Reemplaza las políticas de seguridad (RLS): cada usuario ve y edita SOLO los datos
--      de su club. Se elimina la lectura anónima (sin login) de datos del plantel.
--   4. Datos comunes que mantiene ADN Sports: torneos y partidos de liga compartidos.
--      Cargar el resultado en un club lo actualiza en el otro club que jugó ese partido.
--   5. Videoteca: links de YouTube por partido, con las reglas acordadas
--      (Primera compartida con la división y recíproca; juveniles solo entre los dos
--      clubes que jugaron; Intermedia privada), plazo de carga hasta el miércoles
--      siguiente y hasta 2 partidos "sin video" por temporada.
--   6. Benchmarks anónimos por división (mínimo 5 clubes por promedio).
--
-- No borra datos. Está pensada para correr en un solo paso (todo o nada).
-- =====================================================================================

begin;

-- Las funciones se crean antes que algunas columnas que usan; se validan al ejecutarse.
set check_function_bodies = off;

-- -------------------------------------------------------------------------------------
-- 1. Clubes y administradores de ADN Sports
-- -------------------------------------------------------------------------------------
create table public.clubes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),   -- obras → obras.adnsports.com
  nombre text not null,
  nombre_corto text not null,
  logo_url text,
  color_primario text not null default '#f2c230',
  color_secundario text not null default '#0b0b0c',
  modulos jsonb not null default '{}'::jsonb,          -- módulos activos por club
  comparte_videoteca boolean not null default true,     -- solo aplica a torneos de Primera
  comparte_benchmarks boolean not null default false,   -- requiere consentimiento por contrato
  por_defecto boolean not null default false,
  created_at timestamptz not null default now()
);
-- Solo un club puede ser el "por defecto" (lo usan procesos automáticos sin usuario).
create unique index clubes_un_solo_por_defecto on public.clubes (por_defecto) where por_defecto;

create table public.adn_admins (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.clubes (slug, nombre, nombre_corto, color_primario, color_secundario, por_defecto)
values ('obras', 'Obras Sanitarias de la Nación', 'Obras', '#f2c230', '#0b0b0c', true);

-- -------------------------------------------------------------------------------------
-- 2. Funciones de identidad (security definer para no chocar con las propias políticas)
-- -------------------------------------------------------------------------------------
-- Club del usuario logueado. Null si no tiene perfil: en ese caso no ve nada.
create or replace function public.current_club_id()
returns uuid language sql stable security definer set search_path = public as $$
  select club_id from public.profiles where auth_user_id = auth.uid()
$$;

create or replace function public.club_por_defecto()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.clubes where por_defecto
$$;

-- Valor por defecto de club_id al insertar: el club del usuario o, para procesos
-- automáticos (sincronización URBA, triggers), el club por defecto.
create or replace function public.club_para_insert()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(public.current_club_id(), public.club_por_defecto())
$$;

create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.profiles where auth_user_id = auth.uid()
$$;

create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('Cuerpo técnico', 'Manager'), false)
$$;

create or replace function public.es_adn_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.adn_admins where auth_user_id = auth.uid())
$$;

-- -------------------------------------------------------------------------------------
-- 3. club_id en todas las tablas del club (todo lo existente pasa a Obras)
-- -------------------------------------------------------------------------------------
do $$
declare
  t text;
  v_obras uuid := (select id from public.clubes where slug = 'obras');
begin
  foreach t in array array[
    'profiles', 'jugadores', 'historial_medico', 'categorias', 'lineup_slots',
    'equipos_rivales', 'partidos', 'posiciones', 'sesiones', 'plan_gimnasio',
    'evaluaciones', 'wellness_respuestas', 'config', 'wellness_ventanas', 'gps_datos',
    'notificaciones', 'asistencias', 'lesiones', 'analisis_individual_partido'
  ] loop
    execute format('alter table public.%I add column club_id uuid references public.clubes (id)', t);
    execute format('update public.%I set club_id = %L', t, v_obras);
    execute format('alter table public.%I alter column club_id set default public.club_para_insert()', t);
    -- categorias admite club_id nulo: son las categorías comunes que mantiene ADN Sports
    if t <> 'categorias' then
      execute format('alter table public.%I alter column club_id set not null', t);
    end if;
    execute format('create index %I on public.%I (club_id)', t || '_club_id_idx', t);
  end loop;
end $$;

-- Unicidades que antes eran globales pasan a ser por club
alter table public.jugadores drop constraint jugadores_nombre_key;
alter table public.jugadores add constraint jugadores_club_nombre_key unique (club_id, nombre);

alter table public.categorias drop constraint categorias_nombre_key;
alter table public.categorias add constraint categorias_club_nombre_key unique nulls not distinct (club_id, nombre);

alter table public.equipos_rivales drop constraint equipos_rivales_nombre_key;
alter table public.equipos_rivales add constraint equipos_rivales_club_nombre_key unique (club_id, nombre);

alter table public.config drop constraint config_pkey;
alter table public.config add primary key (club_id, clave);

alter table public.wellness_ventanas drop constraint wellness_ventanas_pkey;
alter table public.wellness_ventanas add primary key (club_id, fecha);

-- Datos para benchmarks: edad y plantel/categoría principal del jugador (opcionales)
alter table public.jugadores add column fecha_nacimiento date;
alter table public.jugadores add column categoria_id uuid references public.categorias (id) on delete set null;

-- Un rival puede ser también un club de la plataforma
alter table public.equipos_rivales add column club_plataforma_id uuid references public.clubes (id);

-- Coherencia: un registro no puede apuntar a un jugador / partido de otro club
create or replace function public.validar_mismo_club()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_otro uuid;
  v_ref uuid := (to_jsonb(new) ->> (tg_argv[0] || '_id'))::uuid;  -- jugador_id / partido_id / categoria_id
begin
  if v_ref is null then return new; end if;
  if tg_argv[0] = 'jugador' then
    select club_id into v_otro from public.jugadores where id = v_ref;
  elsif tg_argv[0] = 'partido' then
    select club_id into v_otro from public.partidos where id = v_ref;
  elsif tg_argv[0] = 'categoria' then
    select club_id into v_otro from public.categorias where id = v_ref;
    if v_otro is null then return new; end if;  -- categoría común: válida para todos
  end if;
  if v_otro is not null and v_otro <> new.club_id then
    raise exception 'El registro pertenece a otro club';
  end if;
  return new;
end $$;

create trigger mismo_club_jugador before insert or update on public.historial_medico for each row execute function public.validar_mismo_club('jugador');
create trigger mismo_club_jugador before insert or update on public.lineup_slots for each row execute function public.validar_mismo_club('jugador');
create trigger mismo_club_jugador before insert or update on public.evaluaciones for each row execute function public.validar_mismo_club('jugador');
create trigger mismo_club_jugador before insert or update on public.wellness_respuestas for each row execute function public.validar_mismo_club('jugador');
create trigger mismo_club_jugador before insert or update on public.gps_datos for each row execute function public.validar_mismo_club('jugador');
create trigger mismo_club_jugador before insert or update on public.asistencias for each row execute function public.validar_mismo_club('jugador');
create trigger mismo_club_jugador before insert or update on public.lesiones for each row execute function public.validar_mismo_club('jugador');
create trigger mismo_club_jugador before insert or update on public.analisis_individual_partido for each row execute function public.validar_mismo_club('jugador');
create trigger mismo_club_jugador before insert or update on public.profiles for each row execute function public.validar_mismo_club('jugador');
create trigger mismo_club_partido before insert or update on public.gps_datos for each row execute function public.validar_mismo_club('partido');
create trigger mismo_club_partido before insert or update on public.analisis_individual_partido for each row execute function public.validar_mismo_club('partido');
create trigger mismo_club_categoria before insert or update on public.partidos for each row execute function public.validar_mismo_club('categoria');
create trigger mismo_club_categoria before insert or update on public.lineup_slots for each row execute function public.validar_mismo_club('categoria');
create trigger mismo_club_categoria before insert or update on public.posiciones for each row execute function public.validar_mismo_club('categoria');
create trigger mismo_club_categoria before insert or update on public.jugadores for each row execute function public.validar_mismo_club('categoria');

-- -------------------------------------------------------------------------------------
-- 4. Políticas de seguridad: cada club ve solo lo suyo
-- -------------------------------------------------------------------------------------
-- Se borran todas las políticas anteriores de estas tablas (incluida la lectura anónima)
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'profiles', 'jugadores', 'historial_medico', 'categorias', 'lineup_slots',
      'equipos_rivales', 'partidos', 'posiciones', 'sesiones', 'plan_gimnasio',
      'evaluaciones', 'wellness_respuestas', 'config', 'wellness_ventanas', 'gps_datos',
      'notificaciones', 'notificaciones_leidas', 'asistencias', 'lesiones',
      'analisis_individual_partido'
    )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Lectura: usuarios logueados de ese club
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'jugadores', 'historial_medico', 'lineup_slots', 'equipos_rivales',
    'partidos', 'posiciones', 'sesiones', 'plan_gimnasio', 'evaluaciones',
    'wellness_respuestas', 'config', 'wellness_ventanas', 'gps_datos', 'notificaciones',
    'asistencias', 'lesiones', 'analisis_individual_partido'
  ] loop
    execute format(
      'create policy "club: lectura" on public.%I for select to authenticated using (club_id = public.current_club_id())', t);
  end loop;
end $$;

-- Escritura general (mismo alcance que antes: cualquier usuario logueado del club)
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'jugadores', 'historial_medico', 'lineup_slots', 'equipos_rivales',
    'partidos', 'posiciones', 'sesiones', 'plan_gimnasio', 'evaluaciones',
    'wellness_respuestas', 'config', 'wellness_ventanas', 'gps_datos', 'notificaciones'
  ] loop
    execute format(
      'create policy "club: escritura" on public.%I for all to authenticated using (club_id = public.current_club_id()) with check (club_id = public.current_club_id())', t);
  end loop;
end $$;

-- Escritura restringida por rol (se mantienen las reglas que ya existían)
create policy "club: cuerpo técnico escribe" on public.analisis_individual_partido for all to authenticated
  using (club_id = public.current_club_id() and public.mi_rol() = 'Cuerpo técnico')
  with check (club_id = public.current_club_id() and public.mi_rol() = 'Cuerpo técnico');

create policy "club: técnico y manager escriben" on public.asistencias for all to authenticated
  using (club_id = public.current_club_id() and public.es_staff())
  with check (club_id = public.current_club_id() and public.es_staff());

create policy "club: cuerpo médico escribe" on public.lesiones for all to authenticated
  using (club_id = public.current_club_id() and public.mi_rol() = 'Cuerpo médico')
  with check (club_id = public.current_club_id() and public.mi_rol() = 'Cuerpo médico');

-- Categorías: las del club + las comunes (club_id nulo). Las comunes solo las edita ADN Sports.
create policy "club: lectura categorías" on public.categorias for select to authenticated
  using (club_id = public.current_club_id() or club_id is null);
create policy "club: escritura categorías" on public.categorias for all to authenticated
  using (club_id = public.current_club_id()) with check (club_id = public.current_club_id());
create policy "adn: categorías comunes" on public.categorias for all to authenticated
  using (club_id is null and public.es_adn_admin()) with check (club_id is null and public.es_adn_admin());

-- Lecturas de notificaciones: solo perfiles del propio club
create policy "club: notificaciones leídas" on public.notificaciones_leidas for all to authenticated
  using (perfil_id in (select id from public.profiles where club_id = public.current_club_id()))
  with check (perfil_id in (select id from public.profiles where club_id = public.current_club_id()));

-- Clubes: cada uno ve su propio club; ADN Sports ve y edita todos.
-- El manager puede cambiar su configuración (logo, colores, compartir videoteca).
alter table public.clubes enable row level security;
create policy "club: ver el propio" on public.clubes for select to authenticated
  using (id = public.current_club_id() or public.es_adn_admin());
create policy "club: manager edita el propio" on public.clubes for update to authenticated
  using (id = public.current_club_id() and public.mi_rol() = 'Manager')
  with check (id = public.current_club_id() and public.mi_rol() = 'Manager');
create policy "adn: administra clubes" on public.clubes for all to authenticated
  using (public.es_adn_admin()) with check (public.es_adn_admin());

-- El manager no puede auto-marcar su club como "por defecto" ni cambiarle el slug
create or replace function public.proteger_campos_club()
returns trigger language plpgsql as $$
begin
  if not public.es_adn_admin() and coalesce(auth.role(), '') <> 'service_role' then
    if new.slug is distinct from old.slug or new.por_defecto is distinct from old.por_defecto then
      raise exception 'Solo ADN Sports puede cambiar el slug o el club por defecto';
    end if;
  end if;
  return new;
end $$;
create trigger proteger_campos_club before update on public.clubes for each row execute function public.proteger_campos_club();

alter table public.adn_admins enable row level security;
create policy "adn: ver admins" on public.adn_admins for select to authenticated using (public.es_adn_admin());

-- -------------------------------------------------------------------------------------
-- 5. Datos comunes: torneos y partidos de liga compartidos
-- -------------------------------------------------------------------------------------
create table public.torneos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                                  -- "URBA Desarrollo 2027 — Primera"
  division text not null,                                -- "Desarrollo", "Primera C"…
  nivel text not null check (nivel in ('mayores', 'juveniles')),
  categoria text not null,                               -- "Primera", "Intermedia", "M17"…
  temporada text not null,
  -- Alcance de la videoteca: 'division' (compartida y recíproca), 'participantes'
  -- (solo los dos clubes que jugaron) o 'privada' (solo el club que subió el video)
  videoteca text not null,
  urba_championship_id integer,
  created_at timestamptz not null default now(),
  check (videoteca in ('division', 'participantes', 'privada')),
  check (nivel <> 'juveniles' or videoteca <> 'division')   -- juveniles nunca se comparte con futuros rivales
);

-- Regla por defecto si no se indica: Primera de mayores → división; juveniles → participantes;
-- el resto (Intermedia, etc.) → privada.
create or replace function public.videoteca_por_defecto()
returns trigger language plpgsql as $$
begin
  if new.videoteca is null then
    new.videoteca := case
      when new.nivel = 'juveniles' then 'participantes'
      when new.categoria = 'Primera' then 'division'
      else 'privada'
    end;
  end if;
  return new;
end $$;
create trigger videoteca_por_defecto before insert on public.torneos for each row execute function public.videoteca_por_defecto();

create table public.torneo_clubes (
  torneo_id uuid not null references public.torneos (id) on delete cascade,
  club_id uuid not null references public.clubes (id) on delete cascade,
  primary key (torneo_id, club_id)
);
create index torneo_clubes_club_idx on public.torneo_clubes (club_id);

-- Las categorías de cada club se vinculan a un torneo común
alter table public.categorias add column torneo_id uuid references public.torneos (id) on delete set null;

create table public.partidos_liga (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references public.torneos (id) on delete cascade,
  fecha_numero integer,
  fecha date not null,
  local_club_id uuid references public.clubes (id),
  visitante_club_id uuid references public.clubes (id),
  local_nombre text not null,        -- siempre se guarda el nombre (el rival puede no usar ADN Sports)
  visitante_nombre text not null,
  tantos_local integer,
  tantos_visitante integer,
  estado text not null default 'Próximo' check (estado in ('Próximo', 'Jugado', 'Suspendido')),
  updated_at timestamptz not null default now(),
  check (local_club_id is distinct from visitante_club_id or local_club_id is null)
);
create index partidos_liga_torneo_fecha_idx on public.partidos_liga (torneo_id, fecha);
create index partidos_liga_local_idx on public.partidos_liga (local_club_id);
create index partidos_liga_visitante_idx on public.partidos_liga (visitante_club_id);

-- Cada club tiene su propio registro de partido (formación, informe, GPS…) vinculado al común
alter table public.partidos add column partido_liga_id uuid references public.partidos_liga (id) on delete set null;
create unique index partidos_club_partido_liga_key on public.partidos (club_id, partido_liga_id) where partido_liga_id is not null;

create or replace function public.club_en_torneo(p_club uuid, p_torneo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.torneo_clubes where club_id = p_club and torneo_id = p_torneo)
$$;

alter table public.torneos enable row level security;
alter table public.torneo_clubes enable row level security;
alter table public.partidos_liga enable row level security;

create policy "club: ver sus torneos" on public.torneos for select to authenticated
  using (public.club_en_torneo(public.current_club_id(), id) or public.es_adn_admin());
create policy "adn: administra torneos" on public.torneos for all to authenticated
  using (public.es_adn_admin()) with check (public.es_adn_admin());

create policy "club: ver participantes" on public.torneo_clubes for select to authenticated
  using (public.club_en_torneo(public.current_club_id(), torneo_id) or public.es_adn_admin());
create policy "adn: administra participantes" on public.torneo_clubes for all to authenticated
  using (public.es_adn_admin()) with check (public.es_adn_admin());

-- Fixture: lo ven todos los clubes del torneo. El resultado lo carga el staff de
-- cualquiera de los dos clubes que jugaron; el fixture completo lo administra ADN Sports.
create policy "club: ver fixture" on public.partidos_liga for select to authenticated
  using (public.club_en_torneo(public.current_club_id(), torneo_id) or public.es_adn_admin());
create policy "club: cargar resultado" on public.partidos_liga for update to authenticated
  using (public.es_staff() and public.current_club_id() in (local_club_id, visitante_club_id))
  with check (public.es_staff() and public.current_club_id() in (local_club_id, visitante_club_id));
create policy "adn: administra fixture" on public.partidos_liga for all to authenticated
  using (public.es_adn_admin()) with check (public.es_adn_admin());

-- Un club solo puede cambiar el resultado, no rearmar el fixture
create or replace function public.proteger_fixture()
returns trigger language plpgsql as $$
begin
  if not public.es_adn_admin() and coalesce(auth.role(), '') <> 'service_role' and pg_trigger_depth() = 1 then
    if (new.torneo_id, new.fecha, new.local_club_id, new.visitante_club_id, new.local_nombre, new.visitante_nombre)
       is distinct from
       (old.torneo_id, old.fecha, old.local_club_id, old.visitante_club_id, old.local_nombre, old.visitante_nombre) then
      raise exception 'Solo ADN Sports puede modificar el fixture';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger proteger_fixture before update on public.partidos_liga for each row execute function public.proteger_fixture();

-- Sincronización: resultado común → registro de cada club
create or replace function public.sync_liga_a_clubes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'Jugado' and new.tantos_local is not null and new.tantos_visitante is not null then
    update public.partidos p set
      goles_favor   = case when p.club_id = new.local_club_id then new.tantos_local else new.tantos_visitante end,
      goles_contra  = case when p.club_id = new.local_club_id then new.tantos_visitante else new.tantos_local end,
      resultado = case
        when new.tantos_local = new.tantos_visitante then 'Empate'
        when (p.club_id = new.local_club_id) = (new.tantos_local > new.tantos_visitante) then 'Ganado'
        else 'Perdido'
      end
    where p.partido_liga_id = new.id
      and p.club_id in (new.local_club_id, new.visitante_club_id);
  end if;
  return new;
end $$;
create trigger sync_liga_a_clubes after insert or update of tantos_local, tantos_visitante, estado
  on public.partidos_liga for each row execute function public.sync_liga_a_clubes();

-- Sincronización: un club carga el resultado en su pantalla de siempre → se actualiza el
-- partido común → y por el trigger anterior, el registro del otro club.
create or replace function public.sync_club_a_liga()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_liga public.partidos_liga;
begin
  if pg_trigger_depth() > 1 then return new; end if;  -- vino de la sincronización inversa
  if new.partido_liga_id is null or new.goles_favor is null or new.goles_contra is null
     or new.resultado = 'Próximo' then
    return new;
  end if;
  select * into v_liga from public.partidos_liga where id = new.partido_liga_id;
  if not found then return new; end if;
  if new.club_id = v_liga.local_club_id then
    update public.partidos_liga set tantos_local = new.goles_favor, tantos_visitante = new.goles_contra, estado = 'Jugado'
    where id = v_liga.id;
  elsif new.club_id = v_liga.visitante_club_id then
    update public.partidos_liga set tantos_local = new.goles_contra, tantos_visitante = new.goles_favor, estado = 'Jugado'
    where id = v_liga.id;
  end if;
  return new;
end $$;
create trigger sync_club_a_liga after insert or update of goles_favor, goles_contra, resultado, partido_liga_id
  on public.partidos for each row execute function public.sync_club_a_liga();

-- -------------------------------------------------------------------------------------
-- 6. Videoteca
-- -------------------------------------------------------------------------------------
create table public.videos_partido (
  id uuid primary key default gen_random_uuid(),
  partido_liga_id uuid not null references public.partidos_liga (id) on delete cascade,
  club_id uuid not null default public.club_para_insert() references public.clubes (id),  -- club que filmó y subió
  youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  sin_video boolean not null default false,
  motivo_sin_video text,
  cargado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partido_liga_id, club_id),
  check (
    (sin_video and youtube_id is null and length(trim(coalesce(motivo_sin_video, ''))) > 0)
    or (not sin_video and youtube_id is not null)
  )
);
create index videos_partido_club_idx on public.videos_partido (club_id);

create table public.reportes_video (
  id uuid primary key default gen_random_uuid(),
  partido_liga_id uuid not null references public.partidos_liga (id) on delete cascade,
  club_reportado uuid not null references public.clubes (id),
  reportado_por_club uuid not null default public.club_para_insert() references public.clubes (id),
  resuelto boolean not null default false,
  created_at timestamptz not null default now(),
  unique (partido_liga_id, club_reportado, reportado_por_club),
  check (club_reportado <> reportado_por_club)
);

-- Plazo para subir el video: el miércoles siguiente al partido (inclusive)
create or replace function public.plazo_video(p_fecha date)
returns date language sql immutable as $$
  select p_fecha + case when (3 - extract(isodow from p_fecha)::int + 7) % 7 = 0 then 7
                        else (3 - extract(isodow from p_fecha)::int + 7) % 7 end
$$;

-- Máximo de partidos "sin video" por club, torneo y temporada antes de perder el acceso
create or replace function public.max_sin_video()
returns integer language sql immutable as $$ select 2 $$;

-- Partidos jugados del club en el torneo cuyo plazo venció y no tienen ni video ni "sin video"
create or replace function public.videos_vencidos(p_club uuid, p_torneo uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.partidos_liga pl
  where pl.torneo_id = p_torneo
    and pl.estado = 'Jugado'
    and p_club in (pl.local_club_id, pl.visitante_club_id)
    and public.plazo_video(pl.fecha) < current_date
    and not exists (select 1 from public.videos_partido v where v.partido_liga_id = pl.id and v.club_id = p_club)
$$;

create or replace function public.sin_video_usados(p_club uuid, p_torneo uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.videos_partido v join public.partidos_liga pl on pl.id = v.partido_liga_id
  where v.club_id = p_club and pl.torneo_id = p_torneo and v.sin_video
$$;

-- ¿El club tiene acceso a la videoteca compartida de este torneo?
-- Debe compartir, estar al día con sus videos y no pasarse del máximo de "sin video".
create or replace function public.acceso_videoteca(p_club uuid, p_torneo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select comparte_videoteca from public.clubes where id = p_club), false)
     and public.club_en_torneo(p_club, p_torneo)
     and public.videos_vencidos(p_club, p_torneo) = 0
     and public.sin_video_usados(p_club, p_torneo) <= public.max_sin_video()
$$;

-- Regla central: ¿puede el usuario actual ver este video?
create or replace function public.puede_ver_video(p_video uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_mi_club uuid := public.current_club_id();
  v record;
begin
  if v_mi_club is null or not public.es_staff() then
    return false;  -- solo cuerpo técnico y manager
  end if;

  select vp.club_id as club_video, vp.sin_video, pl.torneo_id, pl.local_club_id, pl.visitante_club_id,
         t.videoteca
    into v
  from public.videos_partido vp
  join public.partidos_liga pl on pl.id = vp.partido_liga_id
  join public.torneos t on t.id = pl.torneo_id
  where vp.id = p_video;

  if not found then return false; end if;
  if v.club_video = v_mi_club then return true; end if;   -- lo propio siempre
  if v.sin_video then return false; end if;

  if v.videoteca = 'participantes' then
    return v_mi_club in (v.local_club_id, v.visitante_club_id);
  elsif v.videoteca = 'division' then
    -- recíproco: el dueño del video comparte y mi club comparte y está al día
    return coalesce((select comparte_videoteca from public.clubes where id = v.club_video), false)
       and public.acceso_videoteca(v_mi_club, v.torneo_id);
  end if;
  return false;  -- privada
end $$;

alter table public.videos_partido enable row level security;
alter table public.reportes_video enable row level security;

create policy "videoteca: ver" on public.videos_partido for select to authenticated
  using (public.puede_ver_video(id));
-- Cargar o corregir el video propio: staff de un club que jugó ese partido
create policy "videoteca: cargar propio" on public.videos_partido for insert to authenticated
  with check (
    club_id = public.current_club_id() and public.es_staff()
    and exists (select 1 from public.partidos_liga pl where pl.id = partido_liga_id
                and public.current_club_id() in (pl.local_club_id, pl.visitante_club_id))
  );
create policy "videoteca: editar propio" on public.videos_partido for update to authenticated
  using (club_id = public.current_club_id() and public.es_staff())
  with check (club_id = public.current_club_id() and public.es_staff());
create policy "videoteca: borrar propio" on public.videos_partido for delete to authenticated
  using (club_id = public.current_club_id() and public.es_staff());

-- Un club puede avisar que su rival no subió el video del partido que jugaron
create policy "reportes: crear" on public.reportes_video for insert to authenticated
  with check (
    reportado_por_club = public.current_club_id() and public.es_staff()
    and exists (select 1 from public.partidos_liga pl where pl.id = partido_liga_id
                and public.current_club_id() in (pl.local_club_id, pl.visitante_club_id)
                and club_reportado in (pl.local_club_id, pl.visitante_club_id))
  );
create policy "reportes: ver" on public.reportes_video for select to authenticated
  using (public.current_club_id() in (reportado_por_club, club_reportado) or public.es_adn_admin());
create policy "adn: gestiona reportes" on public.reportes_video for update to authenticated
  using (public.es_adn_admin()) with check (public.es_adn_admin());

create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger videos_updated_at before update on public.videos_partido for each row execute function public.tocar_updated_at();

-- Al reportar, avisa al staff del club reportado
create or replace function public.notificar_reporte_video()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pl public.partidos_liga;
begin
  select * into v_pl from public.partidos_liga where id = new.partido_liga_id;
  insert into public.notificaciones (tipo, mensaje, roles_destino, club_id)
  values ('video_faltante',
          '🎬 Falta subir el video de ' || v_pl.local_nombre || ' vs ' || v_pl.visitante_nombre ||
          ' (' || to_char(v_pl.fecha, 'DD/MM') || '). Sin ese video el club pierde acceso a la videoteca.',
          array['Cuerpo técnico', 'Manager'], new.club_reportado);
  return new;
end $$;
create trigger notificar_reporte_video after insert on public.reportes_video for each row execute function public.notificar_reporte_video();

-- Estado de la videoteca de mi club, por torneo (para la pantalla)
create or replace function public.estado_videoteca()
returns table (
  torneo_id uuid, torneo text, categoria text, nivel text, videoteca text,
  comparte boolean, vencidos integer, sin_video_usados integer, max_sin_video integer, con_acceso boolean
) language sql stable security definer set search_path = public as $$
  select t.id, t.nombre, t.categoria, t.nivel, t.videoteca,
         c.comparte_videoteca,
         public.videos_vencidos(c.id, t.id),
         public.sin_video_usados(c.id, t.id),
         public.max_sin_video(),
         case when t.videoteca = 'division' then public.acceso_videoteca(c.id, t.id) else null end
  from public.torneos t
  join public.torneo_clubes tc on tc.torneo_id = t.id
  join public.clubes c on c.id = tc.club_id
  where c.id = public.current_club_id() and public.es_staff()
  order by t.temporada desc, t.nivel, t.categoria
$$;

-- Para los dos clubes que jugaron un partido: ¿el rival ya cargó su video (o lo marcó
-- "sin video")? Sirve para avisar, aunque el video en sí no sea visible para mí.
create or replace function public.rival_cargo_video(p_partido_liga uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.videos_partido v
    where v.partido_liga_id = pl.id
      and v.club_id = case when pl.local_club_id = public.current_club_id() then pl.visitante_club_id else pl.local_club_id end
  )
  from public.partidos_liga pl
  where pl.id = p_partido_liga and public.es_staff()
    and public.current_club_id() in (pl.local_club_id, pl.visitante_club_id)
$$;
grant execute on function public.rival_cargo_video(uuid) to authenticated;

-- -------------------------------------------------------------------------------------
-- 7. Benchmarks anónimos por división
-- -------------------------------------------------------------------------------------
create or replace function public.min_clubes_benchmark()
returns integer language sql immutable as $$ select 5 $$;

-- Promedios por puesto de los clubes que comparten benchmarks en la división y nivel
-- indicados. Solo devuelve filas con al menos 5 clubes; nunca datos individuales.
-- Mi club solo puede verlos si también comparte (reciprocidad).
create or replace function public.benchmark_division(p_division text, p_nivel text, p_temporada text)
returns table (
  puesto text, clubes integer, jugadores integer,
  altura_cm numeric, peso_kg numeric, edad numeric,
  potencia numeric, reactividad numeric, fuerza numeric, velocidad numeric, resistencia numeric,
  mi_altura_cm numeric, mi_peso_kg numeric, mi_edad numeric
) language sql stable security definer set search_path = public as $$
  with mi as (
    select c.id from public.clubes c
    where c.id = public.current_club_id() and c.comparte_benchmarks and public.es_staff()
  ),
  torneos_div as (
    select id from public.torneos where division = p_division and nivel = p_nivel and temporada = p_temporada
  ),
  clubes_ok as (
    select distinct tc.club_id from public.torneo_clubes tc
    join public.clubes c on c.id = tc.club_id and c.comparte_benchmarks
    where tc.torneo_id in (select id from torneos_div)
  ),
  base as (
    select j.club_id, j.posicion_ideal as puesto, j.altura_cm, j.peso_kg,
           extract(year from age(j.fecha_nacimiento))::numeric as edad,
           e.potencia, e.reactividad, e.fuerza, e.velocidad, e.resistencia
    from public.jugadores j
    join public.categorias cat on cat.id = j.categoria_id and cat.torneo_id in (select id from torneos_div)
    left join lateral (
      select * from public.evaluaciones ev where ev.jugador_id = j.id order by ev.fecha desc limit 1
    ) e on true
    where j.club_id in (select club_id from clubes_ok)
  ),
  agg as (
    select coalesce(puesto, 'Todos') as puesto,
           count(distinct club_id)::int as clubes, count(*)::int as jugadores,
           round(avg(altura_cm), 1) altura_cm, round(avg(peso_kg), 1) peso_kg, round(avg(edad), 1) edad,
           round(avg(potencia), 2) potencia, round(avg(reactividad), 2) reactividad,
           round(avg(fuerza), 2) fuerza, round(avg(velocidad), 2) velocidad, round(avg(resistencia), 2) resistencia,
           round(avg(altura_cm) filter (where club_id = (select id from mi)), 1) mi_altura_cm,
           round(avg(peso_kg) filter (where club_id = (select id from mi)), 1) mi_peso_kg,
           round(avg(edad) filter (where club_id = (select id from mi)), 1) mi_edad
    from base
    group by grouping sets ((puesto), ())
  )
  select * from agg
  where exists (select 1 from mi)
    and clubes >= public.min_clubes_benchmark()
  order by puesto = 'Todos' desc, puesto
$$;

-- -------------------------------------------------------------------------------------
-- 8. Registro y procesos automáticos que ahora deben saber el club
-- -------------------------------------------------------------------------------------
-- Datos públicos mínimos del club (login sin sesión: nombre, logo, colores)
create or replace function public.club_publico(p_slug text)
returns table (id uuid, slug text, nombre text, nombre_corto text, logo_url text, color_primario text, color_secundario text)
language sql stable security definer set search_path = public as $$
  select id, slug, nombre, nombre_corto, logo_url, color_primario, color_secundario
  from public.clubes where slug = p_slug
$$;

-- Lista para el selector "¿quién sos?" del registro: solo nombres de jugadores del club
-- que todavía no tienen cuenta. Reemplaza la lectura anónima de la tabla jugadores.
create or replace function public.jugadores_para_registro(p_slug text)
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select j.id, j.nombre
  from public.jugadores j
  join public.clubes c on c.id = j.club_id and c.slug = p_slug
  where not exists (select 1 from public.profiles p where p.jugador_id = j.id)
  order by j.nombre
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_jugador_id uuid;
  v_nombre_nuevo text;
  v_posicion_nueva text;
  v_club uuid;
begin
  -- El club sale del sitio desde el que se registró (obras.adnsports.com → 'obras')
  select id into v_club from public.clubes where slug = nullif(new.raw_user_meta_data->>'club_slug', '');
  v_club := coalesce(v_club, public.club_por_defecto());

  v_jugador_id := nullif(new.raw_user_meta_data->>'jugador_id', '')::uuid;
  -- No se puede reclamar un jugador de otro club
  if v_jugador_id is not null and not exists (select 1 from public.jugadores where id = v_jugador_id and club_id = v_club) then
    v_jugador_id := null;
  end if;
  v_nombre_nuevo := nullif(new.raw_user_meta_data->>'nombre_nuevo_jugador', '');
  v_posicion_nueva := nullif(new.raw_user_meta_data->>'posicion_nueva', '');

  if v_jugador_id is null and v_nombre_nuevo is not null then
    insert into public.jugadores (nombre, posicion_ideal, apto, estado, club_id)
    values (v_nombre_nuevo, coalesce(v_posicion_nueva, 'Centro'), 'Pendiente', 'Disponible', v_club)
    returning id into v_jugador_id;
  end if;

  insert into public.profiles (auth_user_id, nombre, usuario, rol, jugador_id, confirmado, club_id)
  values (
    new.id,
    coalesce(v_nombre_nuevo, new.raw_user_meta_data->>'nombre'),
    new.raw_user_meta_data->>'usuario',
    coalesce(new.raw_user_meta_data->>'rol', 'Jugador'),
    v_jugador_id,
    false,
    v_club
  )
  on conflict (auth_user_id) do nothing;

  if v_jugador_id is not null then
    update public.jugadores
    set altura_cm = coalesce(nullif(new.raw_user_meta_data->>'altura', '')::int, altura_cm),
        peso_kg = coalesce(nullif(new.raw_user_meta_data->>'peso', '')::int, peso_kg)
    where id = v_jugador_id;
  end if;

  return new;
end $$;

create or replace function public.notificar_usuario_pendiente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.confirmado = false then
    insert into notificaciones (tipo, mensaje, roles_destino, club_id)
    values ('usuario_pendiente', '👤 Nueva cuenta esperando aprobación: ' || coalesce(new.nombre, new.usuario, 'sin nombre'),
            array['Manager'], new.club_id);
  end if;
  return new;
end $$;

-- Permisos de ejecución
revoke all on function public.club_publico(text) from public;
revoke all on function public.jugadores_para_registro(text) from public;
grant execute on function public.club_publico(text) to anon, authenticated;
grant execute on function public.jugadores_para_registro(text) to anon, authenticated;
grant execute on function public.estado_videoteca() to authenticated;
grant execute on function public.benchmark_division(text, text, text) to authenticated;

grant select, insert, update, delete on public.clubes, public.adn_admins, public.torneos, public.torneo_clubes,
  public.partidos_liga, public.videos_partido, public.reportes_video to authenticated;
grant all on public.clubes, public.adn_admins, public.torneos, public.torneo_clubes,
  public.partidos_liga, public.videos_partido, public.reportes_video to service_role;

commit;
