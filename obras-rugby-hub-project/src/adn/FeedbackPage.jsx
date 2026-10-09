import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Feedback del encargado del Hub para ADN Sports. Se guarda en la base del Hub y el panel de
// ADN lo lee con su token; las respuestas de ADN vuelven acá y llegan como notificación.

const C = {
  card: "#141415", borde: "#232324", texto: "#f5f4f0", suave: "#c9c9c6", apagado: "#8f8f8c",
  acento: "#f2c230", ok: "#5fbf7a", alerta: "#e8a33d", error: "#e5674f",
};
const card = { background: C.card, border: `1px solid ${C.borde}`, borderRadius: 10, padding: 16 };
const boton = {
  padding: "8px 14px", minHeight: 36, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer",
  fontFamily: "'Inter', sans-serif", border: `1px solid ${C.borde}`, background: "#1c1c1d", color: C.texto,
};
const input = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 6, fontSize: 13,
  background: "#0f0f10", border: `1px solid ${C.borde}`, color: C.texto, fontFamily: "'Inter', sans-serif",
};
const COLOR_ESTADO = { Recibido: C.suave, "En curso": C.alerta, Resuelto: C.ok, Descartado: C.apagado };

function fecha(iso) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function FeedbackPage({ perfil }) {
  const esStaff = perfil?.rol === "Cuerpo técnico" || perfil?.rol === "Manager";
  const [lista, setLista] = useState(null);
  const [tipo, setTipo] = useState("Mejora");
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!esStaff) return;
    supabase
      .from("adn_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Error cargando feedback:", error);
        setLista(data || []);
      });
  }, [esStaff, recarga]);

  async function enviar() {
    setAviso("");
    if (!mensaje.trim()) return setAviso("Escribí el mensaje antes de enviar.");
    setEnviando(true);
    const { error } = await supabase
      .from("adn_feedback")
      .insert({ tipo, mensaje: mensaje.trim(), perfil_id: perfil.id, autor: perfil.nombre });
    setEnviando(false);
    if (error) {
      console.error("Error enviando feedback:", error);
      return setAviso("No se pudo enviar. Probá de nuevo en un rato.");
    }
    setMensaje("");
    setAviso("¡Enviado! ADN Sports lo va a revisar y te va a llegar la respuesta como notificación.");
    setRecarga((n) => n + 1);
  }

  if (!esStaff) {
    return (
      <div style={{ ...card, maxWidth: 520 }}>
        <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 6 }}>Feedback a ADN Sports</div>
        <div style={{ fontSize: 13, color: C.apagado }}>Esta sección es para el cuerpo técnico y el manager del club.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
      <div style={card}>
        <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 4 }}>Enviar feedback a ADN Sports</div>
        <div style={{ fontSize: 12.5, color: C.apagado, marginBottom: 12 }}>
          Contanos un error, una idea para mejorar el Hub o una consulta.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {["Error", "Mejora", "Consulta"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              style={{ ...boton, ...(tipo === t ? { background: "#1d1a0c", color: C.acento, borderColor: "#3a3215" } : {}) }}
            >
              {t}
            </button>
          ))}
        </div>
        <label htmlFor="adn-feedback-msg" style={{ fontSize: 12, color: C.apagado, display: "block", marginBottom: 6 }}>
          Mensaje
        </label>
        <textarea
          id="adn-feedback-msg"
          rows={4}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder={tipo === "Error" ? "¿Qué pasó y en qué pantalla?" : tipo === "Mejora" ? "¿Qué te gustaría que haga el Hub?" : "¿Qué querés saber?"}
          style={{ ...input, resize: "vertical" }}
        />
        {aviso && <div style={{ fontSize: 12.5, color: C.alerta, marginTop: 8 }}>{aviso}</div>}
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          style={{ ...boton, background: C.acento, color: "#0b0b0c", border: "none", marginTop: 10, opacity: enviando ? 0.6 : 1 }}
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 12 }}>Enviados</div>
        {lista === null && <div style={{ fontSize: 13, color: C.apagado }}>Cargando…</div>}
        {lista?.length === 0 && <div style={{ fontSize: 13, color: C.apagado }}>Todavía no enviaron feedback.</div>}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {lista?.map((f) => (
            <div key={f.id} style={{ borderTop: `1px solid ${C.borde}`, padding: "12px 0", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: C.apagado }}>
                  {f.tipo} · {fecha(f.created_at)}{f.autor ? ` · ${f.autor}` : ""}
                </div>
                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "#1c1c1d", color: COLOR_ESTADO[f.estado] }}>
                  {f.estado}
                </span>
              </div>
              <div style={{ fontSize: 13.5, color: C.texto, whiteSpace: "pre-wrap" }}>{f.mensaje}</div>
              {f.respuesta && (
                <div style={{ fontSize: 13, color: C.suave, background: "#0f0f10", borderRadius: 6, padding: "8px 10px", whiteSpace: "pre-wrap" }}>
                  <span style={{ color: C.acento, fontWeight: 600 }}>ADN Sports: </span>
                  {f.respuesta}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
