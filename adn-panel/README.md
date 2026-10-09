# ADN Sports · Panel de control

App interna de ADN Sports para ver la actividad de los Hubs, llevar los estados de cuenta y
responder el feedback de los encargados. Los clubes no tienen acceso.

- **Base:** proyecto de Supabase "ADN PANEL" (separado de los Hubs). Esquema en `supabase/schema.sql`.
- **Acceso:** solo emails cargados en la tabla `admins`, con la cuenta confirmada.
- **Actividad y feedback:** el panel le pide a cada Hub `adn_resumen(token)`, que devuelve solo
  cantidades (usuarios, ingresos, cargas de wellness, partidos, videos…) y el feedback. Las
  respuestas vuelven al Hub con `adn_responder_feedback`, y el club recibe una notificación.
- **Cuentas:** USD 30 por mes o USD 300 por año, por período adelantado desde el inicio de
  facturación. Los pagos en pesos se convierten con el dólar oficial del Banco Nación (vendedor),
  que el panel toma de DolarApi al abrirse; se puede corregir a mano en cada pago.

## Sumar un Hub nuevo

1. En la base del Hub, aplicar la migración de conexión (ver
   `obras-rugby-hub-project/supabase/migrations/20261009180000_adn_panel_conexion.sql`).
2. Leer el token generado: `select valor from app_secrets where clave = 'adn_panel_token';`
3. En el panel → Hubs → Nuevo Hub, completar la URL de Supabase, la clave pública y el token.

## Desarrollo

```bash
npm install
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run dev
```
