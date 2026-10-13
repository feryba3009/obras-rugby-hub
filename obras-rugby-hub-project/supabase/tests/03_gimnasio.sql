\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned
reset role;
insert into clubes (id, slug, nombre, nombre_corto) values
  ('00000000-0000-0000-0000-0000000a0a00', 'gym-a', 'Club A', 'A') on conflict do nothing;
insert into clubes (id, slug, nombre, nombre_corto) values ('00000000-0000-0000-0000-0000000b0b00', 'gym-b', 'Club B', 'B');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000a0a01', 'pf@a', '{"club_slug":"gym-a","nombre":"PF A","usuario":"pfa","rol":"Cuerpo técnico"}'),
  ('00000000-0000-0000-0000-0000000a0a02', 'j1@a', '{"club_slug":"gym-a","usuario":"j1a","rol":"Jugador","nombre_nuevo_jugador":"J1 A","posicion_nueva":"Pilar"}'),
  ('00000000-0000-0000-0000-0000000a0a03', 'j2@a', '{"club_slug":"gym-a","usuario":"j2a","rol":"Jugador","nombre_nuevo_jugador":"J2 A","posicion_nueva":"Ala"}'),
  ('00000000-0000-0000-0000-0000000b0b01', 'pf@b', '{"club_slug":"gym-b","nombre":"PF B","usuario":"pfb","rol":"Cuerpo técnico"}');
update profiles set confirmado = true;
select id as j1 from jugadores where nombre = 'J1 A' \gset
select id as j2 from jugadores where nombre = 'J2 A' \gset
select 'G00 jugadores vinculados', case when (select count(*) from profiles where jugador_id in (:'j1', :'j2')) = 2 then 'PASS' else 'FAIL' end;

set role authenticated; select set_config('request.jwt.claim.role', 'authenticated', false);
-- Jugador 1
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000a0a02', false);
insert into registros_gimnasio (jugador_id, ejercicio, serie, repeticiones, peso_kg) values (:'j1', 'Sentadilla trasera', 1, 6, 100);
select 'G01 jugador carga lo suyo', case when (select count(*) from registros_gimnasio) = 1 then 'PASS' else 'FAIL' end;
\echo 'G02 jugador no puede cargar a otro (se espera ERROR):'
insert into registros_gimnasio (jugador_id, ejercicio, peso_kg) values (:'j2', 'Sentadilla trasera', 50);
-- Jugador 2
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000a0a03', false);
select 'G03 jugador no ve lo de otro', case when (select count(*) from registros_gimnasio) = 0 then 'PASS' else 'FAIL' end;
update registros_gimnasio set peso_kg = 1;
delete from registros_gimnasio;
-- PF del club
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000a0a01', false);
select 'G04 jugador 2 no pudo editar ni borrar lo de otro', case when (select peso_kg from registros_gimnasio) = 100 then 'PASS' else 'FAIL' end;
insert into registros_gimnasio (jugador_id, ejercicio, serie, repeticiones, peso_kg) values (:'j2', 'Peso muerto rumano', 1, 8, 80);
select 'G05 PF ve y carga a todos', case when (select count(*) from registros_gimnasio) = 2 then 'PASS' else 'FAIL' end;
select 'G06 queda en el club A', case when (select count(distinct club_id) from registros_gimnasio) = 1 then 'PASS' else 'FAIL' end;
-- PF de otro club
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b0b01', false);
select 'G07 otro club no ve nada', case when (select count(*) from registros_gimnasio) = 0 then 'PASS' else 'FAIL' end;
\echo 'G08 otro club no puede cargar a un jugador ajeno (se espera ERROR):'
insert into registros_gimnasio (jugador_id, ejercicio, peso_kg) values (:'j1', 'X', 1);
-- anónimo
reset role; set role anon;
\echo 'G09 anónimo sin acceso (se espera ERROR):'
select count(*) from registros_gimnasio;
reset role;
select 'G10 total final', case when (select count(*) from registros_gimnasio) = 2 then 'PASS' else 'FAIL' end;
