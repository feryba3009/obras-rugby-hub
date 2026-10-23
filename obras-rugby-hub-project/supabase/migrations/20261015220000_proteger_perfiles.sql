-- Seguridad de los perfiles: un jugador solo puede editar SU perfil y solo sus datos personales
-- (nombre, usuario, foto, fecha de nacimiento). Rol, aprobación, bloqueo, jugador y club los maneja el staff.
-- Lo que corre del lado del servidor (registro, funciones internas) no pasa por esta regla.
create or replace function public.proteger_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.es_staff() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'No podés crear perfiles.';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'No podés borrar perfiles.';
  end if;
  if old.auth_user_id is distinct from auth.uid() then
    raise exception 'Solo podés editar tu propio perfil.';
  end if;
  if new.rol is distinct from old.rol
     or new.confirmado is distinct from old.confirmado
     or new.bloqueado is distinct from old.bloqueado
     or new.jugador_id is distinct from old.jugador_id
     or new.club_id is distinct from old.club_id
     or new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'Ese dato lo cambia el staff del club.';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_perfil on public.profiles;
create trigger proteger_perfil before insert or update or delete on public.profiles
  for each row execute function public.proteger_perfil();
