# ADN Sports — base multi-club y videoteca

Este cambio convierte el Hub de Obras en la primera versión de la plataforma de ADN Sports:
una sola base para varios clubes, donde cada club ve **solo sus datos**.

## Qué incluye

**Base de datos** (`migrations/20261009120000_adn_multiclub_videoteca.sql`)

- Tabla `clubes`. Obras queda cargado como primer club y como "club por defecto".
- `club_id` en todas las tablas del club. Todo lo existente pasa a Obras; no se borra nada.
- Reglas de seguridad nuevas: cada usuario ve y edita solo lo de su club.
  Se quita la lectura sin iniciar sesión (antes cualquiera podía leer el plantel, lesiones, etc.).
- Datos comunes de ADN Sports: `torneos`, `torneo_clubes` y `partidos_liga` (fixture compartido).
  Cuando un club carga un resultado en su pantalla de siempre, se actualiza el partido común
  y el registro del otro club que jugó.
- Videoteca (`videos_partido`, `reportes_video`):
  - **Primera**: compartida con toda la división y recíproca. Para ver los videos de los demás,
    el club tiene que compartir y estar al día.
  - **Juveniles**: cada video lo ven solo los dos clubes que jugaron.
  - **Intermedia**: privada.
  - Plazo para cargar: hasta el miércoles siguiente al partido. Hasta 2 partidos "sin video"
    por torneo y temporada sin perder el acceso.
  - Solo cuerpo técnico y manager ven videos.
  - Un club puede avisar al rival que le falta subir su video (le llega una notificación).
- Benchmarks anónimos por división (`benchmark_division`): promedios por puesto, solo si hay
  al menos 5 clubes que comparten, y solo para clubes que también comparten.

**App**

- `src/adn/club.js`: detecta qué club es el sitio (subdominio `club.adnsports.com` o la variable
  `VITE_CLUB_SLUG`; si no hay ninguna, usa `obras`).
- El escudo del menú usa el logo del club.
- El registro manda el club y pide la lista de jugadores a una función segura de la base.
- Nueva sección **🎬 Videoteca** en "Análisis".

## Cómo se probó

`tests/` arma una copia de la estructura actual de producción en un Postgres local, aplica la
migración y corre 49 pruebas: aislamiento entre clubes, registro, sincronización de resultados,
todas las reglas de la videoteca, plazos y benchmarks. Todas pasan.

```bash
createdb adn
psql -d adn -f tests/00_supabase_stub.sql
psql -d adn -f tests/01_prod_schema.sql
psql -d adn -f migrations/20261009120000_adn_multiclub_videoteca.sql
psql -d adn -f tests/02_tests.sql | grep -E "PASS|FAIL"
```

## Estado en producción (09/10/2026)

- Base: migraciones aplicadas. Respaldo previo completo en el esquema `respaldo_20261009`.
- App: publicada en Railway con `VITE_CLUB_SLUG=obras`.
- La regla temporal de registro ya se borró: sin iniciar sesión no se lee ningún dato del club.

## Tareas de ADN Sports (por ahora, por SQL)

```sql
-- Sumar un club
insert into clubes (slug, nombre, nombre_corto) values ('berazategui', 'Municipalidad de Berazategui', 'Berazategui');

-- Darse permisos de administrador de ADN Sports
insert into adn_admins (auth_user_id) values ('<id del usuario en auth.users>');

-- Crear un torneo e inscribir clubes (la regla de videoteca se completa sola:
-- Primera → división, juveniles → participantes, el resto → privada)
insert into torneos (nombre, division, nivel, categoria, temporada)
values ('URBA Desarrollo 2027 — Primera', 'Desarrollo', 'mayores', 'Primera', '2027');
insert into torneo_clubes (torneo_id, club_id) values ('<torneo>', '<club>');

-- Cargar el fixture y vincular el partido de cada club
insert into partidos_liga (torneo_id, fecha_numero, fecha, local_club_id, visitante_club_id, local_nombre, visitante_nombre)
values ('<torneo>', 1, '2027-03-20', '<club local>', '<club visitante>', 'Obras', 'Berazategui');
update partidos set partido_liga_id = '<partido_liga>' where id = '<partido del club>';
```

## Pendiente para cuando llegue el segundo club

- La función automática que sincroniza con la URBA (`smooth-api`) busca la categoría por nombre
  y a "Obras Sanitarias" por nombre. Hay que pasarle el club para que no mezcle datos.
- Quedan textos que dicen "Obras" dentro de la app (por ejemplo, en el marcador en vivo).
  Hay que reemplazarlos por el nombre corto del club.
- Los archivos (fotos, escudos, avatares) siguen en carpetas públicas comunes; conviene
  separarlos por club.
