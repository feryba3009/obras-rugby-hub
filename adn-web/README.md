# ADN Sports · Sitio web

Sitio público de ADN Sports: qué es el Hub, planes, cómo se paga y una demo navegable.

- `/` — landing. Precios en `src/config.js` (USD 30 por mes, USD 300 por año). El estimado en pesos
  se calcula en el navegador con el dólar oficial del Banco Nación (vendedor), vía DolarApi.
- `/demo` — demo del Hub con un club y jugadores **ficticios** (`src/demo/datos.js`). Todo vive en
  memoria: no hay base de datos ni registro. `/demo?embed=1` es la versión que se muestra dentro
  del celular del inicio.

## Mercado Pago

Cuando estén creados los links (suscripción mensual y pago anual) en la cuenta de Mercado Pago de
ADN, pegarlos en `mercadoPago` de cada plan en `src/config.js`. Mientras estén vacíos, los botones
abren un mensaje directo a @adn.sporthub.

## Desarrollo

```bash
npm install
npm run dev
```
