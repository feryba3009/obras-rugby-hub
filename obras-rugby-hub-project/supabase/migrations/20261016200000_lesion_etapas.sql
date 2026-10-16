-- Lesiones en 3 etapas: 1. Lesión → 2. Recuperación → 3. Posible alta deportiva (la fecha la pone kinesio).
-- Solo el cuerpo médico puede escribir en lesiones (política existente), así que nadie más mueve las fechas.
alter table public.lesiones add column if not exists etapa text not null default 'Lesión'
  check (etapa in ('Lesión', 'Recuperación', 'Posible alta'));
alter table public.lesiones add column if not exists fecha_recuperacion date;
alter table public.lesiones add column if not exists fecha_posible_alta date;
alter table public.lesiones add column if not exists fecha_alta date;

-- Al cambiar de etapa: se guarda el día y se avisa al staff y al jugador.
create or replace function public.lesion_cambio_etapa()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_nombre text;
  v_msg text;
begin
  if new.etapa = 'Recuperación' and new.fecha_recuperacion is null then new.fecha_recuperacion := ahora_ar()::date; end if;
  if old.activa and not new.activa and new.fecha_alta is null then new.fecha_alta := ahora_ar()::date; end if;
  if new.fecha_posible_alta is not null then new.fecha_vuelta_estimada := new.fecha_posible_alta; end if;

  select nombre into v_nombre from jugadores where id = new.jugador_id;
  if new.etapa is distinct from old.etapa or new.fecha_posible_alta is distinct from old.fecha_posible_alta then
    v_msg := case
      when new.etapa = 'Recuperación' and old.etapa is distinct from 'Recuperación' then coalesce(v_nombre, 'Un jugador') || ' pasó a recuperación (' || coalesce(new.zona, 'lesión') || ').'
      when new.etapa = 'Posible alta' then coalesce(v_nombre, 'Un jugador') || ': posible alta deportiva el ' || coalesce(to_char(new.fecha_posible_alta, 'DD/MM'), 'a confirmar') || ' (la puso kinesio).'
      else null end;
    if v_msg is not null then
      insert into notificaciones (club_id, tipo, mensaje, roles_destino)
      values (new.club_id, 'lesion_etapa', v_msg, array['Cuerpo técnico', 'Manager']);
      insert into notificaciones (club_id, tipo, mensaje, roles_destino, jugadores_destino)
      values (new.club_id, 'lesion_etapa',
              case when new.etapa = 'Posible alta'
                   then 'Kinesio marcó tu posible alta deportiva para el ' || coalesce(to_char(new.fecha_posible_alta, 'DD/MM'), 'a confirmar') || '.'
                   else 'Pasaste a la etapa de recuperación. ¡Seguí así!' end,
              array['Jugador'], array[new.jugador_id]);
    end if;
  end if;
  return new;
end $$;

create trigger lesion_cambio_etapa before update on public.lesiones
  for each row execute function public.lesion_cambio_etapa();
