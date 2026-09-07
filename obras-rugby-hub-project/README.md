# Obras Rugby Hub — BETA

## Probarlo en tu máquina

```bash
npm install
cp .env.example .env
npm run dev
```

Abrí http://localhost:5173

## Subir a GitHub

```bash
git init
git add .
git commit -m "Obras Rugby Hub — beta inicial"
```

Creá un repo nuevo en GitHub (podés hacerlo desde github.com/new) y seguí las instrucciones que te da para
conectar este repo local (`git remote add origin ...` y `git push`).

## Desplegar en Railway

1. Entrá a [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Elegí el repositorio que acabás de subir.
3. Railway va a detectar que es un proyecto Node/Vite automáticamente.
4. Andá a la pestaña **Variables** del servicio y agregá las dos que están en `.env.example`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. En **Settings → Deploy**, configurá:
   - **Build command**: `npm run build`
   - **Start command**: `npm run preview`
6. Guardá — Railway hace el deploy solo y te da una URL pública (`algo.up.railway.app`).

## Qué es "beta" hoy

Ya está conectado a Supabase de verdad:
- Login y registro reales (con confirmación de email si tu proyecto la tiene activada)
- Plantel, calendario, y formaciones de Equipos se leen y se guardan en la base

Todavía en memoria local (se resetea al refrescar la página):
- Wellness, Evaluaciones, GPS/VEO Cam, Sesión del día, Plan de gimnasio, Disponibilidad
