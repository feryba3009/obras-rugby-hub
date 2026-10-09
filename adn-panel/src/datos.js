import { createClient } from "@supabase/supabase-js";

// Base propia del panel de ADN Sports (proyecto "ADN PANEL"). Todo lo que hay acá está
// protegido para que solo lo vean los administradores de ADN con email confirmado.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function usd(n) {
  const v = Number(n || 0);
  return "USD " + v.toLocaleString("es-AR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export function ars(n) {
  return "$ " + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

export function fecha(iso) {
  if (!iso) return "—";
  const s = String(iso);
  const d = s.length === 10 ? new Date(s + "T12:00:00") : new Date(s);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function haceCuanto(iso) {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `hace ${Math.max(min, 1)} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

// Dólar oficial del Banco Nación (vendedor), vía DolarApi. Se guarda una vez por día;
// si la consulta falla, se usa la última cotización guardada.
export async function actualizarCotizacion() {
  try {
    const r = await fetch("https://dolarapi.com/v1/dolares/oficial");
    if (r.ok) {
      const d = await r.json();
      if (d?.venta) {
        await supabase.from("cotizaciones").upsert({
          fecha: hoyISO(),
          compra: d.compra ?? null,
          venta: d.venta,
          fuente: "Oficial BNA (DolarApi)",
          actualizado_en: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.warn("No se pudo actualizar la cotización:", e);
  }
  const { data } = await supabase.from("cotizaciones").select("*").order("fecha", { ascending: false }).limit(1).maybeSingle();
  return data;
}

// Pide al Hub su resumen (cantidades de uso + feedback) con el token secreto de ese Hub,
// guarda la foto de actividad y sincroniza la bandeja de feedback.
export async function sincronizarHub(hub) {
  if (!hub.supabase_url || !hub.anon_key || !hub.token) {
    throw new Error("Falta completar la conexión del Hub (URL, clave pública y token).");
  }
  const r = await fetch(`${hub.supabase_url.replace(/\/$/, "")}/rest/v1/rpc/adn_resumen`, {
    method: "POST",
    headers: { apikey: hub.anon_key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: hub.token }),
  });
  if (!r.ok) throw new Error(`El Hub respondió ${r.status}. Revisá la conexión y el token.`);
  const datos = await r.json();

  // Si la base del Hub tiene varios clubes, el panel se queda con el de este contrato
  const clubes = hub.club_slug ? (datos.clubes || []).filter((c) => c.slug === hub.club_slug) : datos.clubes || [];
  const feedback = (datos.feedback || []).filter((f) => !hub.club_slug || clubes.some((c) => c.club === f.club));

  const { error: e1 } = await supabase.from("actividad").insert({ hub_id: hub.id, datos: { generado_en: datos.generado_en, clubes } });
  if (e1) throw e1;

  if (feedback.length) {
    const filas = feedback.map((f) => ({
      hub_id: hub.id,
      id_origen: f.id,
      club: f.club,
      autor: f.autor,
      tipo: f.tipo,
      mensaje: f.mensaje,
      estado: f.estado,
      respuesta: f.respuesta,
      creado_en: f.creado_en,
      actualizado_en: f.actualizado_en,
    }));
    // La prioridad la maneja ADN en el panel, así que no se pisa al sincronizar
    const { error: e2 } = await supabase.from("feedback").upsert(filas, { onConflict: "hub_id,id_origen" });
    if (e2) throw e2;
  }
  return clubes;
}

// Responde un feedback: se escribe en el Hub (el club recibe la notificación) y en el panel
export async function responderFeedback(hub, item, estado, respuesta) {
  const r = await fetch(`${hub.supabase_url.replace(/\/$/, "")}/rest/v1/rpc/adn_responder_feedback`, {
    method: "POST",
    headers: { apikey: hub.anon_key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: hub.token, p_id: item.id_origen, p_estado: estado, p_respuesta: respuesta }),
  });
  if (!r.ok) throw new Error(`El Hub respondió ${r.status}.`);
  const { error } = await supabase
    .from("feedback")
    .update({ estado, respuesta: respuesta?.trim() || null, actualizado_en: new Date().toISOString() })
    .eq("id", item.id);
  if (error) throw error;
}
