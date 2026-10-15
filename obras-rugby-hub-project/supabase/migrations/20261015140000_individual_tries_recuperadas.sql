-- Planilla individual: tries anotados y pelotas recuperadas (se cargan solos desde el análisis de video).
alter table public.analisis_individual_partido add column if not exists tries integer not null default 0;
alter table public.analisis_individual_partido add column if not exists recuperadas integer not null default 0;
