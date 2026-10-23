-- El wellness de cada jugador lo ve él mismo y el staff (técnico, manager, médico); no el resto del plantel.
alter policy "club: lectura" on public.wellness_respuestas
  using (club_id = current_club_id() and (jugador_id = mi_jugador_id() or es_staff_o_medico()));
