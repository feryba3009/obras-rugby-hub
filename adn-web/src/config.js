// Datos que ADN Sports puede cambiar sin tocar el resto del sitio.

export const INSTAGRAM = "adn.sporthub";
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM}`;
// Abre un mensaje directo a la cuenta de ADN
export const MENSAJE_URL = `https://ig.me/m/${INSTAGRAM}`;

export const PLANES = [
  {
    id: "mensual",
    nombre: "Mensual",
    usd: 30,
    periodo: "por mes",
    detalle: "Se renueva todos los meses. Cancelás cuando quieras.",
    // Link de suscripción de Mercado Pago (cuando esté creado). Vacío = el botón abre un mensaje.
    mercadoPago: "",
  },
  {
    id: "anual",
    nombre: "Anual",
    usd: 300,
    periodo: "por año",
    detalle: "Un solo pago por la temporada. Equivale a 10 meses: 2 meses bonificados.",
    mercadoPago: "",
  },
];
