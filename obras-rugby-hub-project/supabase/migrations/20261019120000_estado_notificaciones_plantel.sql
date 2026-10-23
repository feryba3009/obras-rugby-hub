-- Para el staff: qué jugadores (con cuenta aprobada) tienen las notificaciones activadas en algún dispositivo.
-- No expone las suscripciones (son secretas), solo sí/no por jugador.
create or replace function public.estado_notificaciones_plantel()
returns table (jugador_id uuid, nombre text, posicion text, activadas boolean, dispositivos int)
language sql stable security definer set search_path to 'public' as $$
  select j.id, j.nombre, j.posicion_ideal,
         exists (select 1 from push_subscriptions s where s.perfil_id = p.id),
         (select count(*)::int from push_subscriptions s where s.perfil_id = p.id)
    from profiles p join jugadores j on j.id = p.jugador_id
   where p.club_id = current_club_id() and p.confirmado and not coalesce(p.bloqueado, false)
     and es_staff_o_medico()
   order by j.nombre;
$$;
revoke all on function public.estado_notificaciones_plantel() from public, anon;
grant execute on function public.estado_notificaciones_plantel() to authenticated;
