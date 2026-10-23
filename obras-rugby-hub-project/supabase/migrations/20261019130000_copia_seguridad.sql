-- Copia de seguridad semanal: una función arma un JSON con todas las tablas del club (menos las
-- suscripciones de notificaciones, que son secretas) y una edge function lo guarda comprimido en un
-- bucket privado de este proyecto y otra copia en el proyecto del Panel de ADN (otra región).

-- Datos internos que solo usan las funciones del servidor (nadie los puede leer desde la app).
create table if not exists public.config_privada (clave text primary key, valor text not null);
alter table public.config_privada enable row level security;
revoke all on public.config_privada from anon, authenticated;

create or replace function public.exportar_copia()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  t record;
  datos jsonb := '{}'::jsonb;
  filas jsonb;
begin
  for t in select table_name from information_schema.tables
            where table_schema = 'public' and table_type = 'BASE TABLE'
              and table_name not in ('push_subscriptions', 'config_privada')
            order by table_name loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t.table_name) into filas;
    datos := datos || jsonb_build_object(t.table_name, filas);
  end loop;
  return jsonb_build_object('proyecto', 'adn-obras', 'generada', now(), 'tablas', datos);
end $$;
revoke all on function public.exportar_copia() from public, anon, authenticated;
grant execute on function public.exportar_copia() to service_role;

insert into storage.buckets (id, name, public) values ('copias', 'copias', false) on conflict (id) do nothing;

-- Todos los lunes 04:00 de Argentina (07:00 UTC). El token se lee de config_privada al momento de correr.
-- (El valor del token se cargó aparte, no está en el repositorio.)
select cron.schedule('copia-seguridad-semanal', '0 7 * * 1', $$select net.http_post(url := 'https://xnyleewcwrriodkaklqo.supabase.co/functions/v1/copia-seguridad', headers := jsonb_build_object('Content-Type','application/json','x-copia-token',(select valor from public.config_privada where clave='copia_token')), body := '{}'::jsonb, timeout_milliseconds := 60000)$$);
