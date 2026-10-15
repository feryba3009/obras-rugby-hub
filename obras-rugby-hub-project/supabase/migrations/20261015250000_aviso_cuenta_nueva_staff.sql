-- El aviso de "nueva cuenta esperando aprobación" llega a Manager y Cuerpo técnico (los dos pueden confirmar).
create or replace function public.notificar_usuario_pendiente()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.confirmado = false then
    insert into notificaciones (tipo, mensaje, roles_destino, club_id)
    values ('usuario_pendiente', '👤 Nueva cuenta esperando aprobación: ' || coalesce(new.nombre, new.usuario, 'sin nombre'),
            array['Manager', 'Cuerpo técnico'], new.club_id);
  end if;
  return new;
end $function$;
