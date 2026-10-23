-- Ideas del plantel: el jugador manda su idea o problema al manager del club; el manager decide si
-- se la reenvía a ADN Sports. El panel de ADN solo ve lo que el club le manda (para_adn).
alter table public.adn_feedback add column if not exists origen text not null default 'staff' check (origen in ('staff', 'jugador'));
alter table public.adn_feedback add column if not exists para_adn boolean not null default true;
alter table public.adn_feedback add column if not exists archivado boolean not null default false;
alter table public.adn_feedback add column if not exists enviado_por uuid references public.profiles(id) on delete set null;
alter table public.adn_feedback add column if not exists enviado_en timestamptz;
create index if not exists adn_feedback_perfil_idx on public.adn_feedback (perfil_id);
create index if not exists adn_feedback_enviado_por_idx on public.adn_feedback (enviado_por);

create or replace function public.mi_perfil_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid()
$$;
revoke execute on function public.mi_perfil_id() from public, anon;
grant execute on function public.mi_perfil_id() to authenticated;

-- El jugador ve lo que mandó él.
create policy "club: jugador ve sus ideas" on public.adn_feedback for select to authenticated
  using (club_id = (select public.current_club_id()) and perfil_id = (select public.mi_perfil_id()));
-- El jugador manda su idea al manager (nunca directo a ADN).
create policy "club: jugador manda idea al manager" on public.adn_feedback for insert to authenticated
  with check (club_id = (select public.current_club_id()) and (select public.mi_rol()) = 'Jugador'
              and origen = 'jugador' and not para_adn and estado = 'Recibido' and respuesta is null
              and perfil_id = (select public.mi_perfil_id()));
-- El manager reenvía a ADN o archiva las ideas del plantel.
create policy "club: manager reenvía ideas" on public.adn_feedback for update to authenticated
  using (club_id = (select public.current_club_id()) and (select public.es_manager()) and origen = 'jugador')
  with check (club_id = (select public.current_club_id()) and (select public.es_manager()) and origen = 'jugador');
grant update (para_adn, archivado, enviado_por, enviado_en) on public.adn_feedback to authenticated;

-- Aviso al manager cuando llega una idea del plantel.
create or replace function public.aviso_idea_plantel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origen = 'jugador' then
    insert into public.notificaciones (tipo, mensaje, roles_destino, club_id)
    values ('idea_plantel', coalesce(new.autor, 'Un jugador') || ' mandó una idea para la app: ' || left(new.mensaje, 120), array['Manager'], new.club_id);
  end if;
  return new;
end $$;
revoke execute on function public.aviso_idea_plantel() from public, anon, authenticated;

create trigger adn_feedback_aviso_idea after insert on public.adn_feedback for each row execute function public.aviso_idea_plantel();

-- El panel de ADN solo recibe lo que el club le mandó.
create or replace function public.adn_resumen(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.adn_token_valido(p_token) then
    raise exception 'Token inválido' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'generado_en', now(),
    'clubes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', c.slug,
        'club', c.nombre,
        'usuarios', (select count(*) from public.profiles p where p.club_id = c.id),
        'usuarios_pendientes', (select count(*) from public.profiles p where p.club_id = c.id and not p.confirmado),
        'activos_7d', (select count(*) from public.profiles p join auth.users u on u.id = p.auth_user_id
                       where p.club_id = c.id and u.last_sign_in_at > now() - interval '7 days'),
        'activos_30d', (select count(*) from public.profiles p join auth.users u on u.id = p.auth_user_id
                        where p.club_id = c.id and u.last_sign_in_at > now() - interval '30 days'),
        'ultimo_ingreso', (select max(u.last_sign_in_at) from public.profiles p join auth.users u on u.id = p.auth_user_id
                           where p.club_id = c.id),
        'jugadores', (select count(*) from public.jugadores j where j.club_id = c.id),
        'wellness_7d', (select count(*) from public.wellness_respuestas w where w.club_id = c.id and w.fecha > current_date - 7),
        'asistencias_7d', (select count(*) from public.asistencias a where a.club_id = c.id and a.fecha > current_date - 7),
        'evaluaciones_30d', (select count(*) from public.evaluaciones e where e.club_id = c.id and e.fecha > current_date - 30),
        'partidos', (select count(*) from public.partidos pa where pa.club_id = c.id),
        'partidos_jugados', (select count(*) from public.partidos pa where pa.club_id = c.id and pa.resultado <> 'Próximo'),
        'gps_registros', (select count(*) from public.gps_datos g where g.club_id = c.id),
        'videos', (select count(*) from public.videos_partido v where v.club_id = c.id and not v.sin_video),
        'notificaciones_7d', (select count(*) from public.notificaciones n where n.club_id = c.id and n.created_at > now() - interval '7 days')
      ) order by c.nombre)
      from public.clubes c
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'club', c.nombre, 'autor', f.autor, 'tipo', f.tipo, 'mensaje', f.mensaje,
        'estado', f.estado, 'respuesta', f.respuesta, 'creado_en', coalesce(f.enviado_en, f.created_at), 'actualizado_en', f.updated_at
      ) order by coalesce(f.enviado_en, f.created_at) desc)
      from public.adn_feedback f join public.clubes c on c.id = f.club_id
      where f.para_adn
    ), '[]'::jsonb)
  );
end $$;

-- Cuando ADN responde, también le llega al jugador que mandó la idea.
create or replace function public.adn_responder_feedback(p_token text, p_id uuid, p_estado text, p_respuesta text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_club uuid;
  v_resp_anterior text;
  v_origen text;
  v_perfil uuid;
begin
  if not public.adn_token_valido(p_token) then
    raise exception 'Token inválido' using errcode = '42501';
  end if;
  select club_id, respuesta, origen, perfil_id into v_club, v_resp_anterior, v_origen, v_perfil from public.adn_feedback where id = p_id;
  if not found then raise exception 'Feedback inexistente'; end if;
  update public.adn_feedback
     set estado = p_estado, respuesta = nullif(trim(p_respuesta), ''), updated_at = now()
   where id = p_id;
  if nullif(trim(p_respuesta), '') is distinct from v_resp_anterior and nullif(trim(p_respuesta), '') is not null then
    insert into public.notificaciones (tipo, mensaje, roles_destino, club_id)
    values ('adn_feedback', 'ADN Sports respondió una idea: ' || left(trim(p_respuesta), 140),
            array['Cuerpo técnico', 'Manager'], v_club);
    if v_origen = 'jugador' and v_perfil is not null then
      insert into public.notificaciones (tipo, mensaje, perfiles_destino, club_id)
      values ('adn_feedback', 'ADN Sports respondió tu idea: ' || left(trim(p_respuesta), 140), array[v_perfil], v_club);
    end if;
  end if;
end $$;
