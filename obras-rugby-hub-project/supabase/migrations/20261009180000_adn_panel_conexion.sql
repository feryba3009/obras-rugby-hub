-- Aplicada en producción el 09/10/2026. Conecta el Hub con el panel de control de ADN Sports.
-- El panel guarda un token secreto (app_secrets.adn_panel_token, generado al aplicar esto) y
-- con él pide un resumen de uso (solo cantidades) y el feedback de los encargados.

create table public.adn_feedback (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.club_para_insert() references public.clubes (id),
  perfil_id uuid references public.profiles (id) on delete set null,
  autor text,
  tipo text not null check (tipo in ('Error', 'Mejora', 'Consulta')),
  mensaje text not null check (length(trim(mensaje)) > 0),
  estado text not null default 'Recibido' check (estado in ('Recibido', 'En curso', 'Resuelto', 'Descartado')),
  respuesta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index adn_feedback_club_idx on public.adn_feedback (club_id, created_at desc);
alter table public.adn_feedback enable row level security;
create policy "club: staff ve su feedback" on public.adn_feedback for select to authenticated
  using (club_id = public.current_club_id() and public.es_staff());
create policy "club: staff envía feedback" on public.adn_feedback for insert to authenticated
  with check (club_id = public.current_club_id() and public.es_staff() and estado = 'Recibido' and respuesta is null);

insert into public.app_secrets (clave, valor)
values ('adn_panel_token', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (clave) do nothing;

create or replace function public.adn_token_valido(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_token is not null and length(p_token) >= 32
     and p_token = (select valor from public.app_secrets where clave = 'adn_panel_token')
$$;

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
        'estado', f.estado, 'respuesta', f.respuesta, 'creado_en', f.created_at, 'actualizado_en', f.updated_at
      ) order by f.created_at desc)
      from public.adn_feedback f join public.clubes c on c.id = f.club_id
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.adn_responder_feedback(p_token text, p_id uuid, p_estado text, p_respuesta text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_club uuid;
  v_resp_anterior text;
begin
  if not public.adn_token_valido(p_token) then
    raise exception 'Token inválido' using errcode = '42501';
  end if;
  select club_id, respuesta into v_club, v_resp_anterior from public.adn_feedback where id = p_id;
  if not found then raise exception 'Feedback inexistente'; end if;
  update public.adn_feedback
     set estado = p_estado, respuesta = nullif(trim(p_respuesta), ''), updated_at = now()
   where id = p_id;
  if nullif(trim(p_respuesta), '') is distinct from v_resp_anterior and nullif(trim(p_respuesta), '') is not null then
    insert into public.notificaciones (tipo, mensaje, roles_destino, club_id)
    values ('adn_feedback', '💬 ADN Sports respondió tu feedback: ' || left(trim(p_respuesta), 140),
            array['Cuerpo técnico', 'Manager'], v_club);
  end if;
end $$;

revoke execute on function public.adn_token_valido(text) from public, anon, authenticated;
revoke execute on function public.adn_resumen(text), public.adn_responder_feedback(text, uuid, text, text) from public;
grant execute on function public.adn_resumen(text), public.adn_responder_feedback(text, uuid, text, text) to anon, authenticated;
grant select, insert on public.adn_feedback to authenticated;
