-- Limpieza: copia manual del 9/10 (ya reemplazada por la copia semanal automática) y una regla de
-- "usuario único" repetida en perfiles (queda profiles_auth_user_id_key, que hace lo mismo).
drop schema if exists respaldo_20261009 cascade;
alter table public.profiles drop constraint if exists profiles_auth_user_id_unique;
