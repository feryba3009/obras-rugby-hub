-- ADN PANEL — esquema aplicado el 09/10/2026 en el proyecto de Supabase "ADN PANEL"
-- Todo es solo para administradores de ADN (email en la tabla admins y confirmado).

create table public.admins (
  email text primary key check (email = lower(email)),
  nombre text,
  created_at timestamptz not null default now()
);

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users u join public.admins a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  )
$$;

create table public.planes (
  codigo text primary key,
  nombre text not null,
  precio_usd numeric(10,2) not null check (precio_usd >= 0),
  meses integer not null check (meses > 0)
);
insert into public.planes values ('mensual', 'Mensual', 30, 1), ('anual', 'Anual', 300, 12);

create table public.hubs (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  club text not null,
  disciplina text not null default 'Rugby',
  url text,
  supabase_url text,
  anon_key text,
  token text,
  club_slug text,
  encargado_nombre text,
  encargado_email text,
  encargado_telefono text,
  estado text not null default 'activo' check (estado in ('activo', 'prueba', 'suspendido', 'baja')),
  plan text not null default 'mensual' references public.planes (codigo),
  fecha_alta date not null default current_date,
  inicio_facturacion date not null default current_date,
  fecha_baja date,
  notas text,
  created_at timestamptz not null default now()
);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs (id) on delete cascade,
  fecha date not null default current_date,
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  monto numeric(14,2) not null check (monto > 0),
  cotizacion numeric(12,4) check (cotizacion is null or cotizacion > 0),
  monto_usd numeric(12,2) generated always as (
    case when moneda = 'USD' then monto else round(monto / cotizacion, 2) end
  ) stored,
  medio text,
  nota text,
  created_at timestamptz not null default now(),
  check (moneda = 'USD' or cotizacion is not null)
);
create index pagos_hub_idx on public.pagos (hub_id, fecha);

create table public.ajustes (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs (id) on delete cascade,
  fecha date not null default current_date,
  monto_usd numeric(12,2) not null,
  motivo text not null,
  created_at timestamptz not null default now()
);

create table public.cotizaciones (
  fecha date primary key,
  compra numeric(12,4),
  venta numeric(12,4) not null,
  fuente text not null default 'Oficial BNA (DolarApi)',
  actualizado_en timestamptz not null default now()
);

create table public.actividad (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs (id) on delete cascade,
  tomado_en timestamptz not null default now(),
  datos jsonb not null
);
create index actividad_hub_idx on public.actividad (hub_id, tomado_en desc);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs (id) on delete cascade,
  id_origen uuid not null,
  club text,
  autor text,
  tipo text not null,
  mensaje text not null,
  estado text not null default 'Recibido' check (estado in ('Recibido', 'En curso', 'Resuelto', 'Descartado')),
  prioridad text not null default 'Normal' check (prioridad in ('Baja', 'Normal', 'Alta', 'Urgente')),
  respuesta text,
  creado_en timestamptz not null,
  actualizado_en timestamptz not null default now(),
  unique (hub_id, id_origen)
);

-- Estado de cuenta: un cargo por período adelantado desde el inicio de facturación.
-- Los Hubs en prueba no generan cargos.
create or replace function public.estado_cuenta()
returns table (
  hub_id uuid, hub text, club text, estado text, plan text, precio_usd numeric, meses integer,
  periodos integer, cargos_usd numeric, ajustes_usd numeric, pagos_usd numeric, saldo_usd numeric,
  ultimo_pago date, proximo_vencimiento date, impago_desde date, dias_atraso integer
) language sql stable security definer set search_path = public as $$
  with base as (
    select h.*, p.precio_usd, p.meses,
           least(coalesce(h.fecha_baja, current_date), current_date) as hasta
    from public.hubs h join public.planes p on p.codigo = h.plan
    where public.es_admin()
  ),
  calc as (
    select b.*,
      case when b.estado = 'prueba' or b.hasta < b.inicio_facturacion then 0
           else (((extract(year from age(b.hasta, b.inicio_facturacion)) * 12
                 + extract(month from age(b.hasta, b.inicio_facturacion)))::int / b.meses) + 1)
      end as n,
      coalesce((select sum(monto_usd) from public.ajustes a where a.hub_id = b.id), 0) as aj,
      coalesce((select sum(monto_usd) from public.pagos pg where pg.hub_id = b.id), 0) as pg,
      (select max(fecha) from public.pagos pg where pg.hub_id = b.id) as ult
    from base b
  )
  select c.id, c.nombre, c.club, c.estado, c.plan, c.precio_usd, c.meses, c.n,
         c.n * c.precio_usd, c.aj, c.pg,
         round(c.n * c.precio_usd + c.aj - c.pg, 2),
         c.ult,
         case when c.estado = 'prueba' then null
              else (c.inicio_facturacion + make_interval(months => c.n * c.meses))::date end,
         case when c.n * c.precio_usd + c.aj - c.pg > 0 and c.precio_usd > 0 then
           (c.inicio_facturacion + make_interval(months =>
              greatest(floor((c.pg - c.aj) / c.precio_usd), 0)::int * c.meses))::date
         end,
         case when c.n * c.precio_usd + c.aj - c.pg > 0 and c.precio_usd > 0 then
           current_date - (c.inicio_facturacion + make_interval(months =>
              greatest(floor((c.pg - c.aj) / c.precio_usd), 0)::int * c.meses))::date
         end
  from calc c
  order by c.nombre
$$;

do $$
declare t text;
begin
  foreach t in array array['admins','planes','hubs','pagos','ajustes','cotizaciones','actividad','feedback'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "solo admins" on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
end $$;

revoke execute on function public.estado_cuenta() from public, anon;
grant execute on function public.estado_cuenta() to authenticated;
revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;
