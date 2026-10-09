-- Aplicada en producción el 09/10/2026 junto con la migración multi-club.

-- Temporal: la app anterior lee la lista de jugadores para el registro sin iniciar sesión.
-- BORRAR cuando se publique la app nueva:
--   drop policy "temporal: registro app anterior" on public.jugadores;
create policy "temporal: registro app anterior" on public.jugadores
  for select to anon using (club_id = public.club_por_defecto());

-- Funciones internas: solo las usa la base por dentro (triggers y otras funciones)
revoke execute on function public.acceso_videoteca(uuid, uuid), public.videos_vencidos(uuid, uuid), public.sin_video_usados(uuid, uuid),
  public.handle_new_user(), public.notificar_push(), public.notificar_reporte_video(), public.notificar_usuario_pendiente(),
  public.sync_club_a_liga(), public.sync_liga_a_clubes(), public.validar_mismo_club(), public.proteger_campos_club(),
  public.proteger_fixture(), public.tocar_updated_at(), public.videoteca_por_defecto()
  from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- Funciones para usuarios logueados
revoke execute on function public.estado_videoteca(), public.benchmark_division(text, text, text), public.rival_cargo_video(uuid),
  public.puede_ver_video(uuid), public.club_en_torneo(uuid, uuid), public.mi_rol(), public.es_staff(), public.es_adn_admin()
  from public, anon;
grant execute on function public.estado_videoteca(), public.benchmark_division(text, text, text), public.rival_cargo_video(uuid),
  public.puede_ver_video(uuid), public.club_en_torneo(uuid, uuid), public.mi_rol(), public.es_staff(), public.es_adn_admin()
  to authenticated;

alter function public.proteger_campos_club() set search_path = public;
alter function public.videoteca_por_defecto() set search_path = public;
alter function public.proteger_fixture() set search_path = public;
alter function public.plazo_video(date) set search_path = public;
alter function public.max_sin_video() set search_path = public;
alter function public.tocar_updated_at() set search_path = public;
alter function public.min_clubes_benchmark() set search_path = public;
