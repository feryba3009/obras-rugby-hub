-- Cuota del club, mes a mes.
--  · El manager configura el monto, el link de Mercado Pago (y/o alias) y desde qué mes se cobra.
--  · Cada mes de cada jugador está pagado (lo marca el manager), informado (el jugador avisó que pagó y
--    el manager lo tiene que confirmar) o, si no hay fila, adeudado.
--  · Lo ven el cuerpo técnico y el manager; cada jugador ve solo lo suyo. Marca los pagos solo el manager.

create or replace function public.es_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() = 'Manager', false)
$$;

create table if not exists public.cuota_config (
  club_id uuid primary key default public.club_para_insert() references public.clubes(id),
  desde date not null default date_trunc('month', public.ahora_ar())::date,   -- primer mes que se cobra
  dia_vencimiento int not null default 10 check (dia_vencimiento between 1 and 28),
  monto numeric(12, 2),
  link_pago text,          -- link de pago de Mercado Pago del club
  alias text,              -- alias o CVU para transferir
  nota text,
  updated_at timestamptz not null default now()
);
alter table public.cuota_config enable row level security;
create policy "cuota_config: lectura" on public.cuota_config for select to authenticated
  using (club_id = current_club_id());
create policy "cuota_config: alta" on public.cuota_config for insert to authenticated
  with check (club_id = current_club_id() and es_manager());
create policy "cuota_config: edicion" on public.cuota_config for update to authenticated
  using (club_id = current_club_id() and es_manager())
  with check (club_id = current_club_id() and es_manager());

-- Excepciones por jugador: becado (no paga) o empieza a pagar desde otro mes (se sumó después).
create table if not exists public.cuota_jugadores (
  jugador_id uuid primary key references public.jugadores(id) on delete cascade,
  club_id uuid not null default public.club_para_insert() references public.clubes(id),
  becado boolean not null default false,
  desde date,
  updated_at timestamptz not null default now()
);
alter table public.cuota_jugadores enable row level security;
create policy "cuota_jugadores: lectura" on public.cuota_jugadores for select to authenticated
  using (club_id = current_club_id() and (jugador_id = mi_jugador_id() or es_staff()));
create policy "cuota_jugadores: alta" on public.cuota_jugadores for insert to authenticated
  with check (club_id = current_club_id() and es_manager());
create policy "cuota_jugadores: edicion" on public.cuota_jugadores for update to authenticated
  using (club_id = current_club_id() and es_manager())
  with check (club_id = current_club_id() and es_manager());
create trigger mismo_club_jugador before insert or update on public.cuota_jugadores
  for each row execute function validar_mismo_club('jugador');

create table if not exists public.cuotas_pagos (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default public.club_para_insert() references public.clubes(id),
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  estado text not null default 'pagada' check (estado in ('pagada', 'informada')),
  marcado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jugador_id, mes)
);
create index if not exists cuotas_pagos_club_mes_idx on public.cuotas_pagos (club_id, mes);
alter table public.cuotas_pagos enable row level security;
create policy "cuotas: lectura" on public.cuotas_pagos for select to authenticated
  using (club_id = current_club_id() and (jugador_id = mi_jugador_id() or es_staff()));
-- El jugador solo puede avisar que pagó lo suyo; el manager marca y confirma.
create policy "cuotas: alta" on public.cuotas_pagos for insert to authenticated
  with check (club_id = current_club_id() and (es_manager() or (jugador_id = mi_jugador_id() and estado = 'informada')));
create policy "cuotas: edicion" on public.cuotas_pagos for update to authenticated
  using (club_id = current_club_id() and es_manager())
  with check (club_id = current_club_id() and es_manager());
create policy "cuotas: baja" on public.cuotas_pagos for delete to authenticated
  using (club_id = current_club_id() and (es_manager() or (jugador_id = mi_jugador_id() and estado = 'informada')));
create trigger mismo_club_jugador before insert or update on public.cuotas_pagos
  for each row execute function validar_mismo_club('jugador');
