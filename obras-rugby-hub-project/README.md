# ADN Obras

App del plantel de rugby de Obras, hecha por ADN Sports (React + Vite, base en Supabase).

## Correrla en la compu

```bash
npm install
cp .env.example .env   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

## Versiones de demostración

Con `VITE_DEMO=1` la app usa datos de ejemplo guardados en el navegador, sin base ni cuentas:

- demo genérica: `VITE_DEMO=1 VITE_DEMO_CLUB=generico VITE_CLUB_SLUG=demo`
- demo de Berazategui: `VITE_DEMO=1 VITE_CLUB_SLUG=berazategui`

## Pruebas

`scripts/pruebas-recorridos.mjs` recorre lo más usado sobre la demo; corre solo en GitHub con cada cambio.
