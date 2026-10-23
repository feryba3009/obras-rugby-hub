-- 1) Procesos automáticos (votación del jugador del partido, recordatorio de esfuerzo): los corre solo
--    el reloj de la base (cron). Antes cualquiera podía dispararlos desde afuera y mandar notificaciones.
revoke execute on function public.mvp_abrir_votacion() from public, anon, authenticated;
revoke execute on function public.mvp_anunciar() from public, anon, authenticated;
revoke execute on function public.mvp_marcar_apertura() from public, anon, authenticated;
revoke execute on function public.rpe_recordar() from public, anon, authenticated;

-- 2) Datos de salud y rendimiento: cada jugador ve los suyos; el staff y el cuerpo médico, todos.
--    (Las lesiones siguen visibles para el plantel: quién está lesionado es información del equipo.)
alter policy "club: lectura" on public.historial_medico
  using (club_id = current_club_id() and (jugador_id = mi_jugador_id() or es_staff_o_medico()));
alter policy "club: lectura" on public.gps_datos
  using (club_id = current_club_id() and (jugador_id = mi_jugador_id() or es_staff_o_medico()));
alter policy "club: lectura" on public.evaluaciones
  using (club_id = current_club_id() and (jugador_id = mi_jugador_id() or es_staff_o_medico()));
