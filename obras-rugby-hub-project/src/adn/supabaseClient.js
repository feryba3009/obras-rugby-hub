import { createClient } from "@supabase/supabase-js";

// "Mantener la sesión abierta": si está tildado (por defecto), la sesión se guarda en el
// dispositivo (localStorage) y sigue abierta aunque cierres el navegador. Si no, se guarda solo
// para esta pestaña (sessionStorage) y se cierra sola al cerrar el navegador.
const CLAVE_MANTENER = "adn-mantener-sesion";

function leer(st, k) { try { return st.getItem(k); } catch { return null; } }
function escribir(st, k, v) { try { st.setItem(k, v); } catch { /* sin almacenamiento */ } }
function borrar(st, k) { try { st.removeItem(k); } catch { /* sin almacenamiento */ } }

const local = typeof window !== "undefined" ? window.localStorage : null;
const sesionTab = typeof window !== "undefined" ? window.sessionStorage : null;

export function mantenerSesion() {
  return local ? leer(local, CLAVE_MANTENER) !== "0" : true;
}
export function setMantenerSesion(si) {
  if (local) escribir(local, CLAVE_MANTENER, si ? "1" : "0");
}

const almacenamiento = {
  getItem: (k) => (local && leer(local, k)) ?? (sesionTab && leer(sesionTab, k)) ?? null,
  setItem: (k, v) => {
    if (mantenerSesion()) { if (local) escribir(local, k, v); if (sesionTab) borrar(sesionTab, k); }
    else { if (sesionTab) escribir(sesionTab, k, v); if (local) borrar(local, k); }
  },
  removeItem: (k) => { if (local) borrar(local, k); if (sesionTab) borrar(sesionTab, k); },
};

// Conexión a Supabase. La publishable key es segura para el frontend: el acceso real está
// controlado por las políticas de seguridad (RLS) de la base, que separan los datos por club.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { storage: almacenamiento, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
