\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned
-- ===================== preparación (como administrador de la base) =====================
reset role;
insert into clubes (id, slug, nombre, nombre_corto) values
  ('00000000-0000-0000-0000-0000000000b0', 'berazategui', 'Municipalidad de Berazategui', 'Berazategui'),
  ('00000000-0000-0000-0000-0000000000c0', 'club-c', 'Club C', 'C'),
  ('00000000-0000-0000-0000-0000000000d0', 'club-d', 'Club D', 'D'),
  ('00000000-0000-0000-0000-0000000000e0', 'club-e', 'Club E', 'E'),
  ('00000000-0000-0000-0000-0000000000f0', 'club-f', 'Club F', 'F');
select id as obras from clubes where slug = 'obras' \gset

-- Registro de usuarios por el flujo real (trigger de auth.users)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'staff@bera', '{"club_slug":"berazategui","nombre":"Staff Bera","usuario":"staffbera","rol":"Cuerpo técnico"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'jug@bera',   '{"club_slug":"berazategui","usuario":"jugbera","rol":"Jugador","nombre_nuevo_jugador":"Jugador Bera 1","posicion_nueva":"Pilar"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'staff@c',    '{"club_slug":"club-c","nombre":"Staff C","usuario":"staffc","rol":"Manager"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'intruso@bera', '{"club_slug":"berazategui","nombre":"Intruso","usuario":"intruso","rol":"Jugador"}');
-- jugador de otro club intentando reclamar un jugador de Obras al registrarse
update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('jugador_id', (select id from jugadores where nombre = 'Jugador Obras 1'))
  where id = '00000000-0000-0000-0000-0000000000b3';
select 'T01 perfil registrado en su club', case when (select club_id from profiles where usuario = 'staffbera') = '00000000-0000-0000-0000-0000000000b0' then 'PASS' else 'FAIL' end;
select 'T02 jugador nuevo creado en su club', case when (select club_id from jugadores where nombre = 'Jugador Bera 1') = '00000000-0000-0000-0000-0000000000b0' then 'PASS' else 'FAIL' end;
select 'T03 notificación de pendiente va al club correcto', case when exists (select 1 from notificaciones where tipo = 'usuario_pendiente' and mensaje like '%Staff Bera%' and club_id = '00000000-0000-0000-0000-0000000000b0') then 'PASS' else 'FAIL' end;
select 'T04 datos existentes quedaron en Obras', case when (select count(*) from jugadores where club_id = :'obras') = 2 then 'PASS' else 'FAIL' end;

-- ===================== aislamiento entre clubes =====================
set role authenticated; select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select 'T05 Bera no ve jugadores de Obras', case when (select count(*) from jugadores where club_id = :'obras') = 0 and (select count(*) from jugadores) = 1 then 'PASS' else 'FAIL' end;
update jugadores set peso_kg = 1 where club_id = :'obras';
reset role; select 'T06 Bera no puede editar jugadores de Obras', case when not exists (select 1 from jugadores where peso_kg = 1) then 'PASS' else 'FAIL' end; set role authenticated;
insert into jugadores (nombre, posicion_ideal) values ('Jugador Bera 2', 'Hooker');
select 'T07 insert sin club_id queda en el club del usuario', case when (select club_id from jugadores where nombre = 'Jugador Bera 2') = '00000000-0000-0000-0000-0000000000b0' then 'PASS' else 'FAIL' end;
\echo 'T08 insertar en otro club debe fallar (se espera ERROR):'
insert into jugadores (nombre, posicion_ideal, club_id) values ('Infiltrado', 'Ala', :'obras');
select 'T09 mismo nombre de jugador permitido en clubes distintos', 'INFO';
insert into jugadores (nombre, posicion_ideal) values ('Jugador Obras 1', 'Ala');
select 'T09 mismo nombre en otro club', case when (select count(*) from jugadores where nombre = 'Jugador Obras 1') = 1 then 'PASS' else 'FAIL' end;
select 'T10 Bera no ve config ni wellness de Obras', case when (select count(*) from config) = 0 and (select count(*) from wellness_ventanas) = 0 then 'PASS' else 'FAIL' end;
insert into wellness_ventanas (fecha) values (current_date) on conflict (club_id, fecha) do update set abierta = true;
select 'T11 Bera abre su propio wellness del mismo día', case when (select count(*) from wellness_ventanas) = 1 then 'PASS' else 'FAIL' end;
select 'T12 categorías: ve solo las suyas', case when (select count(*) from categorias) = 0 then 'PASS' else 'FAIL' end;
\echo 'T13 crear categoría común sin ser ADN debe fallar (se espera ERROR):'
insert into categorias (nombre, club_id) values ('M17', null);
select 'T14 intruso no pudo reclamar jugador de Obras', case when (select jugador_id from profiles where usuario = 'intruso') is null then 'PASS' else 'FAIL' end;
\echo 'T15 ver/cambiar el club en mi perfil a Obras debe fallar (se espera ERROR):'
update profiles set club_id = :'obras' where usuario = 'staffbera';
select 'T16 no puede cambiar slug del club', 'INFO';

-- anónimo
reset role; set role anon; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', 'anon', false);
select 'T17 anónimo no lee jugadores', case when (select count(*) from jugadores) = 0 then 'PASS' else 'FAIL' end;
select 'T18 anónimo obtiene lista de registro de Obras', case when (select count(*) from jugadores_para_registro('obras')) = 2 then 'PASS' else 'FAIL' end;
select 'T19 lista de registro excluye jugadores con cuenta', case when (select count(*) from jugadores_para_registro('berazategui')) = 2 then 'PASS' else 'FAIL' end;
select 'T20 anónimo obtiene datos públicos del club', case when (select nombre_corto from club_publico('obras')) = 'Obras' then 'PASS' else 'FAIL' end;

-- proceso automático (service role) como la sincronización URBA
reset role; set role service_role; select set_config('request.jwt.claim.role', 'service_role', false);
insert into posiciones (categoria_id, es_obras, pts) select id, true, 10 from categorias where nombre = 'Superior';
reset role;
select 'T21 proceso automático guarda en club por defecto (Obras)', case when (select club_id from posiciones limit 1) = :'obras' then 'PASS' else 'FAIL' end;

-- ===================== torneos y partidos compartidos =====================
reset role;
insert into torneos (id, nombre, division, nivel, categoria, temporada) values
  ('10000000-0000-0000-0000-000000000001', 'Desarrollo Primera', 'Desarrollo', 'mayores', 'Primera', '2026'),
  ('10000000-0000-0000-0000-000000000002', 'Desarrollo Intermedia', 'Desarrollo', 'mayores', 'Intermedia', '2026'),
  ('10000000-0000-0000-0000-000000000003', 'Desarrollo M17', 'Desarrollo', 'juveniles', 'M17', '2026');
select 'T22 videoteca por defecto: Primera=division, Intermedia=privada, M17=participantes',
  case when (select string_agg(videoteca, ',' order by nombre) from torneos) = 'privada,participantes,division' then 'PASS' else 'FAIL ' || (select string_agg(videoteca, ',' order by nombre) from torneos) end;
\echo 'T23 torneo juvenil con videoteca de división debe fallar (se espera ERROR):'
insert into torneos (nombre, division, nivel, categoria, temporada, videoteca) values ('X', 'Desarrollo', 'juveniles', 'M15', '2026', 'division');
insert into torneo_clubes select t.id, c.id from torneos t cross join clubes c where c.slug in ('obras', 'berazategui', 'club-c');

-- Fixture: Obras vs Bera (hace 20 días), Bera vs C (hace 13 días), C vs Obras (próximo), juveniles Bera vs C
insert into partidos_liga (id, torneo_id, fecha, local_club_id, visitante_club_id, local_nombre, visitante_nombre, estado) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date - 20, :'obras', '00000000-0000-0000-0000-0000000000b0', 'Obras', 'Berazategui', 'Próximo'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', current_date - 13, '00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c0', 'Berazategui', 'Club C', 'Jugado'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', current_date + 5, '00000000-0000-0000-0000-0000000000c0', :'obras', 'Club C', 'Obras', 'Próximo'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', current_date - 13, '00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c0', 'Berazategui', 'Club C', 'Jugado'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', current_date - 13, '00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c0', 'Berazategui', 'Club C', 'Jugado');
update partidos set partido_liga_id = '20000000-0000-0000-0000-000000000001';  -- el partido de Obras de muestra
insert into categorias (nombre, club_id) values ('Superior', '00000000-0000-0000-0000-0000000000b0');
insert into partidos (categoria_id, fecha_numero, fecha, resultado, club_id, partido_liga_id)
  select id, 1, current_date - 20, 'Próximo', '00000000-0000-0000-0000-0000000000b0', '20000000-0000-0000-0000-000000000001' from categorias where club_id = '00000000-0000-0000-0000-0000000000b0';

-- Obras carga el resultado en SU pantalla de siempre: 24-17
set role authenticated; select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update partidos set goles_favor = 24, goles_contra = 17, resultado = 'Ganado' where partido_liga_id = '20000000-0000-0000-0000-000000000001';
reset role;
select 'T24 resultado llega al partido común', case when (select tantos_local || '-' || tantos_visitante || ' ' || estado from partidos_liga where id = '20000000-0000-0000-0000-000000000001') = '24-17 Jugado' then 'PASS' else 'FAIL' end;
select 'T25 resultado llega espejado a Berazategui', case when (select goles_favor || '-' || goles_contra || ' ' || resultado from partidos where club_id = '00000000-0000-0000-0000-0000000000b0') = '17-24 Perdido' then 'PASS' else 'FAIL' end;

set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
\echo 'T26 un club no puede cambiar el fixture (se espera ERROR):'
update partidos_liga set fecha = current_date where id = '20000000-0000-0000-0000-000000000001';
select 'T27 Bera ve el fixture del torneo', case when (select count(*) from partidos_liga) = 5 then 'PASS' else 'FAIL' end;

-- ===================== videoteca =====================
-- Bera sube sus videos (Bera vs C de Primera, juveniles e Intermedia) y el de Obras vs Bera
insert into videos_partido (partido_liga_id, youtube_id) values
  ('20000000-0000-0000-0000-000000000002', 'AAAAAAAAAAA'),
  ('20000000-0000-0000-0000-000000000004', 'BBBBBBBBBBB'),
  ('20000000-0000-0000-0000-000000000005', 'CCCCCCCCCCC'),
  ('20000000-0000-0000-0000-000000000001', 'DDDDDDDDDDD');
\echo 'T28 link con formato inválido debe fallar (se espera ERROR):'
reset role; insert into videos_partido (partido_liga_id, club_id, youtube_id) values ('20000000-0000-0000-0000-000000000003', :'obras', 'https://youtu.be/x'); set role authenticated;
\echo 'T29 subir video de un partido que no jugó debe fallar (se espera ERROR):'
reset role; insert into partidos_liga (id, torneo_id, fecha, local_club_id, visitante_club_id, local_nombre, visitante_nombre, estado) values
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', current_date - 13, :'obras', '00000000-0000-0000-0000-0000000000c0', 'Obras', 'Club C', 'Jugado');
set role authenticated;
insert into videos_partido (partido_liga_id, youtube_id) values ('20000000-0000-0000-0000-000000000009', 'EEEEEEEEEEE');

-- Obras: jugó Obras vs Bera (vencido, sin video) y Obras vs C (vencido) → sin acceso
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select 'T30 Obras atrasada: no ve Primera de otros', case when not exists (select 1 from videos_partido where youtube_id = 'AAAAAAAAAAA') then 'PASS' else 'FAIL' end;
select 'T31 estado_videoteca muestra 2 vencidos', case when (select vencidos from estado_videoteca() where torneo_id = '10000000-0000-0000-0000-000000000001') = 2 then 'PASS' else 'FAIL' end;
insert into videos_partido (partido_liga_id, youtube_id) values ('20000000-0000-0000-0000-000000000001', 'FFFFFFFFFFF');
insert into videos_partido (partido_liga_id, sin_video, motivo_sin_video) values ('20000000-0000-0000-0000-000000000009', true, 'Falló la cámara');
select 'T32 Obras al día: ve el Primera de Bera vs C', case when exists (select 1 from videos_partido where youtube_id = 'AAAAAAAAAAA') then 'PASS' else 'FAIL' end;
select 'T33 Obras NO ve juveniles de otros', case when not exists (select 1 from videos_partido where youtube_id = 'BBBBBBBBBBB') then 'PASS' else 'FAIL' end;
select 'T34 Obras NO ve Intermedia de otros', case when not exists (select 1 from videos_partido where youtube_id = 'CCCCCCCCCCC') then 'PASS' else 'FAIL' end;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select 'T35 C ve juvenil que jugó (Bera vs C)', case when exists (select 1 from videos_partido where youtube_id = 'BBBBBBBBBBB') then 'PASS' else 'FAIL' end;
select 'T36 C no ve Intermedia de Bera aunque jugó (privada)', case when not exists (select 1 from videos_partido where youtube_id = 'CCCCCCCCCCC') then 'PASS' else 'FAIL' end;
select 'T37 C (sin subir lo suyo) no ve Primera compartida', case when not exists (select 1 from videos_partido where youtube_id = 'DDDDDDDDDDD') then 'PASS' else 'FAIL' end;
insert into reportes_video (partido_liga_id, club_reportado) values ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b0');
\echo 'T38 reportar a un club que no jugó ese partido debe fallar (se espera ERROR):'
insert into reportes_video (partido_liga_id, club_reportado) values ('20000000-0000-0000-0000-000000000002', :'obras');

-- un jugador nunca ve videos
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select 'T39 jugador no ve videos', case when (select count(*) from videos_partido) = 0 then 'PASS' else 'FAIL' end;

-- Obras deja de compartir → no ve los de otros y los demás no ven los suyos
reset role; update clubes set comparte_videoteca = false where slug = 'obras';
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select 'T40 Obras sin compartir no ve la videoteca de otros', case when not exists (select 1 from videos_partido where youtube_id = 'AAAAAAAAAAA') then 'PASS' else 'FAIL' end;
select 'T41 Obras sigue viendo sus propios videos', case when exists (select 1 from videos_partido where youtube_id = 'FFFFFFFFFFF') then 'PASS' else 'FAIL' end;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select 'T42 Bera no ve el video que subió Obras (no comparte)', case when not exists (select 1 from videos_partido where youtube_id = 'FFFFFFFFFFF') then 'PASS' else 'FAIL' end;
select 'T43 Bera sí ve videos de Obras vs Bera que subió ella', case when exists (select 1 from videos_partido where youtube_id = 'DDDDDDDDDDD') then 'PASS' else 'FAIL' end;
reset role; update clubes set comparte_videoteca = true where slug = 'obras';

-- límite de "sin video": 3 en la temporada → pierde acceso
reset role;
insert into partidos_liga (id, torneo_id, fecha, local_club_id, visitante_club_id, local_nombre, visitante_nombre, estado)
  select ('20000000-0000-0000-0000-00000000001' || g)::uuid, '10000000-0000-0000-0000-000000000001', current_date - 30 - g, '00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000c0', 'Berazategui', 'Club C', 'Jugado'
  from generate_series(1, 3) g;
insert into videos_partido (partido_liga_id, club_id, sin_video, motivo_sin_video)
  select ('20000000-0000-0000-0000-00000000001' || g)::uuid, '00000000-0000-0000-0000-0000000000b0', true, 'Lluvia' from generate_series(1, 3) g;
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select 'T44 con 3 partidos sin video pierde acceso', case when (select con_acceso from estado_videoteca() where torneo_id = '10000000-0000-0000-0000-000000000001') = false then 'PASS' else 'FAIL' end;
select 'T45 aun así ve lo propio', case when exists (select 1 from videos_partido where youtube_id = 'AAAAAAAAAAA') then 'PASS' else 'FAIL' end;
reset role;
select 'T46 reporte generó aviso al club reportado', case when exists (select 1 from notificaciones where tipo = 'video_faltante' and club_id = '00000000-0000-0000-0000-0000000000b0') then 'PASS' else 'FAIL' end;
select 'T47 plazo: partido sábado 10/10 → miércoles 14/10', case when plazo_video('2026-10-10') = '2026-10-14' then 'PASS' else 'FAIL' end;
select 'T48 plazo: partido miércoles → miércoles siguiente', case when plazo_video('2026-10-14') = '2026-10-21' then 'PASS' else 'FAIL' end;

-- ===================== benchmarks =====================
reset role;
insert into torneo_clubes select '10000000-0000-0000-0000-000000000001', id from clubes where slug in ('club-d', 'club-e', 'club-f');
update clubes set comparte_benchmarks = true where slug in ('obras', 'berazategui', 'club-c', 'club-d');
update categorias set torneo_id = '10000000-0000-0000-0000-000000000001' where nombre = 'Superior';
insert into categorias (id, nombre, club_id, torneo_id) select gen_random_uuid(), 'Superior', id, '10000000-0000-0000-0000-000000000001' from clubes where slug in ('club-c', 'club-d', 'club-e', 'club-f');
insert into jugadores (nombre, posicion_ideal, altura_cm, peso_kg, club_id, categoria_id)
  select 'Pilar ' || c.slug, 'Pilar', 180, 115, c.id, cat.id from clubes c join categorias cat on cat.club_id = c.id and cat.nombre = 'Superior'
  where c.slug in ('berazategui', 'club-c', 'club-d', 'club-e', 'club-f');
update jugadores set categoria_id = (select id from categorias where nombre = 'Superior' and club_id = :'obras') where club_id = :'obras';
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select 'T49 con 4 clubes que comparten no hay promedios', case when (select count(*) from benchmark_division('Desarrollo', 'mayores', '2026')) = 0 then 'PASS' else 'FAIL' end;
reset role; update clubes set comparte_benchmarks = true where slug = 'club-e';
set role authenticated;
select 'T50 con 5 clubes aparecen promedios de Pilar y Todos', case when (select string_agg(puesto, ',') from benchmark_division('Desarrollo', 'mayores', '2026')) = 'Todos,Pilar' then 'PASS' else 'FAIL ' || coalesce((select string_agg(puesto || ':' || clubes, ',') from benchmark_division('Desarrollo', 'mayores', '2026')), 'nada') end;
select 'T51 Centro (1 club) no se muestra', case when not exists (select 1 from benchmark_division('Desarrollo', 'mayores', '2026') where puesto = 'Centro') then 'PASS' else 'FAIL' end;
reset role; update clubes set comparte_benchmarks = false where slug = 'obras'; update clubes set comparte_benchmarks = true where slug = 'club-f';
set role authenticated;
select 'T52 club que no comparte no ve benchmarks', case when (select count(*) from benchmark_division('Desarrollo', 'mayores', '2026')) = 0 then 'PASS' else 'FAIL' end;

-- ===================== club =====================
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select 'T53 manager ve solo su club', case when (select count(*) from clubes) = 1 then 'PASS' else 'FAIL' end;
update clubes set logo_url = 'https://x/logo.png' where slug = 'club-c';
select 'T54 manager edita logo', case when (select logo_url from clubes) = 'https://x/logo.png' then 'PASS' else 'FAIL' end;
\echo 'T55 manager no puede cambiar el slug (se espera ERROR):'
update clubes set slug = 'otro' where slug = 'club-c';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
update clubes set logo_url = 'x';
reset role; select 'T56 cuerpo técnico (no manager) no edita el club', case when not exists (select 1 from clubes where logo_url = 'x') then 'PASS' else 'FAIL' end;
-- ===================== aviso de video del rival =====================
reset role; set role authenticated; select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select 'T57 C sabe que Bera cargó el video de Bera vs C', case when rival_cargo_video('20000000-0000-0000-0000-000000000002') then 'PASS' else 'FAIL' end;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select 'T58 Bera sabe que C NO cargó el video', case when rival_cargo_video('20000000-0000-0000-0000-000000000002') = false then 'PASS' else 'FAIL' end;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select 'T59 Obras (no jugó) no obtiene información', case when rival_cargo_video('20000000-0000-0000-0000-000000000002') is null then 'PASS' else 'FAIL' end;
