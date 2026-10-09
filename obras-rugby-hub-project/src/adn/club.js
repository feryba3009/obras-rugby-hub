import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Qué club es este sitio. En producción cada club entra por su subdominio
// (obras.adnsports.com → "obras"). Mientras tanto, o en desarrollo, se usa VITE_CLUB_SLUG.
const DOMINIO_ADN = import.meta.env.VITE_ADN_DOMAIN || "adnsports.com";

function detectarSlug() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (host.endsWith("." + DOMINIO_ADN)) {
    const sub = host.slice(0, -(DOMINIO_ADN.length + 1)).split(".").pop();
    if (sub && sub !== "www" && sub !== "app") return sub;
  }
  return import.meta.env.VITE_CLUB_SLUG || "obras";
}

export const CLUB_SLUG = detectarSlug();

// Datos públicos del club (nombre, logo, colores). Se piden una sola vez por carga de página.
let clubCache = null;
let clubPromesa = null;

export function cargarClub() {
  if (clubCache) return Promise.resolve(clubCache);
  if (!clubPromesa) {
    clubPromesa = supabase
      .rpc("club_publico", { p_slug: CLUB_SLUG })
      .then(({ data, error }) => {
        if (error) console.error("Error cargando el club:", error);
        clubCache = (data && data[0]) || { slug: CLUB_SLUG, nombre: CLUB_SLUG, nombre_corto: CLUB_SLUG };
        return clubCache;
      });
  }
  return clubPromesa;
}

export function useClub() {
  const [club, setClub] = useState(clubCache);
  useEffect(() => {
    if (!clubCache) cargarClub().then(setClub);
  }, []);
  return club;
}

export function iniciales(nombre = "") {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
