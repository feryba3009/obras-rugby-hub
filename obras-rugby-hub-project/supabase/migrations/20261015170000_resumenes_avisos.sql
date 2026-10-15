-- Aviso al staff cuando están listos los resúmenes:
--  · el de la semana (lunes a viernes), el viernes a las 21 de Argentina;
--  · el de los partidos del mes, el día 1 a las 10 de Argentina (del mes que terminó).
create or replace function public.resumenes_avisar(p_tipo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  meses text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  mes_ant date := (date_trunc('month', ahora_ar()) - interval '1 month')::date;
  c record;
begin
  for c in select id from clubes loop
    if p_tipo = 'semana' then
      insert into notificaciones (club_id, tipo, mensaje, roles_destino)
      values (c.id, 'resumen_semanal', 'Ya está el resumen de la semana: prácticas, wellness, gimnasio y lesiones de lunes a viernes.', array['Cuerpo técnico', 'Cuerpo médico', 'Manager']);
    else
      insert into notificaciones (club_id, tipo, mensaje, roles_destino)
      values (c.id, 'resumen_mensual', format('Ya está el resumen de los partidos de %s, con el postpartido de cada uno.', meses[extract(month from mes_ant)::int]), array['Cuerpo técnico', 'Cuerpo médico', 'Manager']);
    end if;
  end loop;
end;
$$;
revoke execute on function public.resumenes_avisar(text) from public, anon, authenticated;

select cron.schedule('resumen-semanal', '0 0 * * 6', $$select public.resumenes_avisar('semana')$$);
select cron.schedule('resumen-mensual', '0 13 1 * *', $$select public.resumenes_avisar('mes')$$);
