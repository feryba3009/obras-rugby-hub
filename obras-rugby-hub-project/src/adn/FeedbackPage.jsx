import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Feedback del encargado de la app para ADN Sports. Se guarda en la base de la app y el panel de
// ADN lo lee con su token; las respuestas de ADN vuelven acá y llegan como notificación.

const C = {
  card: "var(--h-panel)", borde: "var(--h-borde)", texto: "var(--h-texto)", suave: "var(--h-texto2)", apagado: "var(--h-sub)",
  acento: "var(--h-acento)", ok: "var(--h-ok)", alerta: "var(--h-alerta)", error: "var(--h-error)",
};
const card = { background: C.card, border: `1px solid ${C.borde}`, borderRadius: 10, padding: 16 };
const boton = {
  padding: "8px 14px", minHeight: 36, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer",
  fontFamily: "var(--h-texto-fuente)", border: `1px solid ${C.borde}`, background: "var(--h-panel2)", color: C.texto,
};
const input = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 6, fontSize: 13,
  background: "var(--h-fondo)", border: `1px solid ${C.borde}`, color: C.texto, fontFamily: "var(--h-texto-fuente)",
};
const COLOR_ESTADO = { Recibido: C.suave, "En curso": C.alerta, Resuelto: C.ok, Descartado: C.apagado };

function fecha(iso) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const ES_DEMO = import.meta.env.VITE_DEMO === "1";
const TIPOS = [["Error", "Algo no anda"], ["Mejora", "Una idea"], ["Consulta", "Una pregunta"]];
const PLACEHOLDER = { Error: "¿Qué pasó y en qué pantalla?", Mejora: "¿Qué te gustaría que haga la app?", Consulta: "¿Qué querés saber?" };

function Formulario({ titulo, bajada, onEnviar, textoOk }) {
  const [tipo, setTipo] = useState("Mejora");
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function enviar() {
    setAviso("");
    if (!mensaje.trim()) return setAviso("Escribí el mensaje antes de enviar.");
    setEnviando(true);
    const ok = await onEnviar(tipo, mensaje.trim());
    setEnviando(false);
    if (!ok) return setAviso("No se pudo enviar. Probá de nuevo en un rato.");
    setMensaje("");
    setAviso(textoOk);
  }
  return (
    <div style={card}>
      <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 12.5, color: C.apagado, marginBottom: 12 }}>{bajada}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {TIPOS.map(([t, l]) => (
          <button key={t} type="button" onClick={() => setTipo(t)}
            style={{ ...boton, ...(tipo === t ? { background: "var(--h-acento-suave)", color: C.acento, borderColor: "var(--h-acento-suave)" } : {}) }}>
            {l}
          </button>
        ))}
      </div>
      <label htmlFor="adn-feedback-msg" style={{ fontSize: 12, color: C.apagado, display: "block", marginBottom: 6 }}>Mensaje</label>
      <textarea id="adn-feedback-msg" rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder={PLACEHOLDER[tipo]} style={{ ...input, resize: "vertical" }} />
      {aviso && <div style={{ fontSize: 12.5, color: aviso === textoOk ? C.ok : C.alerta, marginTop: 8 }}>{aviso}</div>}
      <button type="button" onClick={enviar} disabled={enviando}
        style={{ ...boton, background: C.acento, color: "var(--h-fondo)", border: "none", marginTop: 10, opacity: enviando ? 0.6 : 1 }}>
        {enviando ? "Enviando…" : "Enviar"}
      </button>
    </div>
  );
}

function Item({ f, extra, acciones }) {
  const etiqueta = (TIPOS.find(([t]) => t === f.tipo) || [])[1] || f.tipo;
  return (
    <div style={{ borderTop: `1px solid ${C.borde}`, padding: "12px 0", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: C.apagado }}>{etiqueta} · {fecha(f.created_at)}{f.autor ? ` · ${f.autor}` : ""}</div>
        {extra}
      </div>
      <div style={{ fontSize: 13.5, color: C.texto, whiteSpace: "pre-wrap" }}>{f.mensaje}</div>
      {f.respuesta && (
        <div style={{ fontSize: 13, color: C.suave, background: "var(--h-fondo)", borderRadius: 6, padding: "8px 10px", whiteSpace: "pre-wrap" }}>
          <span style={{ color: C.acento, fontWeight: 600 }}>ADN Sports: </span>{f.respuesta}
        </div>
      )}
      {acciones}
    </div>
  );
}
const Etiqueta = ({ color, children }) => (
  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "var(--h-panel2)", color }}>{children}</span>
);

export default function FeedbackPage({ perfil }) {
  const esJugador = perfil?.rol === "Jugador";
  const esStaff = perfil?.rol === "Cuerpo técnico" || perfil?.rol === "Manager";
  // Las ideas del plantel le llegan al manager (en la demo también al entrenador, para poder mostrarlo).
  const recibeIdeas = perfil?.rol === "Manager" || (ES_DEMO && esStaff);
  const [lista, setLista] = useState(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!esStaff && !esJugador) return;
    let q = supabase.from("adn_feedback").select("*").order("created_at", { ascending: false });
    if (esJugador) q = q.eq("perfil_id", perfil.id);
    q.then(({ data, error }) => {
      if (error) console.error("Error cargando feedback:", error);
      setLista(data || []);
    });
  }, [esStaff, esJugador, recarga]);

  async function insertar(fila) {
    const { error } = await supabase.from("adn_feedback").insert({ ...fila, perfil_id: perfil.id, autor: perfil.nombre });
    if (error) { console.error("Error enviando feedback:", error); return false; }
    setRecarga((n) => n + 1);
    return true;
  }
  async function reenviar(f, aAdn) {
    const cambios = aAdn ? { para_adn: true, enviado_por: perfil.id, enviado_en: new Date().toISOString() } : { archivado: true };
    const { error } = await supabase.from("adn_feedback").update(cambios).eq("id", f.id);
    if (error) console.error("Error actualizando la idea:", error);
    setRecarga((n) => n + 1);
  }

  if (esJugador) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
        <Formulario
          titulo="Tus ideas para la app"
          bajada="Contanos algo que no anda, una idea o una duda. Le llega al manager del club, que se la pasa a ADN Sports."
          textoOk="¡Listo! Le llegó al manager del club."
          onEnviar={(tipo, mensaje) => insertar({ tipo, mensaje, origen: "jugador", para_adn: false })}
        />
        <div style={card}>
          <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 12 }}>Lo que mandaste</div>
          {lista === null && <div style={{ fontSize: 13, color: C.apagado }}>Cargando…</div>}
          {lista?.length === 0 && <div style={{ fontSize: 13, color: C.apagado }}>Todavía no mandaste nada.</div>}
          {lista?.map((f) => (
            <Item key={f.id} f={f} extra={
              f.para_adn ? <Etiqueta color={COLOR_ESTADO[f.estado] || C.suave}>{f.estado === "Recibido" ? "En ADN Sports" : f.estado}</Etiqueta>
              : f.archivado ? <Etiqueta color={C.apagado}>La leyó el manager</Etiqueta>
              : <Etiqueta color={C.alerta}>Esperando al manager</Etiqueta>} />
          ))}
        </div>
      </div>
    );
  }

  if (!esStaff) {
    return (
      <div style={{ ...card, maxWidth: 520 }}>
        <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 6 }}>Ideas para ADN Sports</div>
        <div style={{ fontSize: 13, color: C.apagado }}>Si tenés una idea o algo no anda, contáselo al manager del club.</div>
      </div>
    );
  }

  const delPlantel = (lista || []).filter((f) => f.origen === "jugador" && !f.para_adn && !f.archivado);
  const enviados = (lista || []).filter((f) => f.para_adn);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
      {recibeIdeas && (
        <div style={{ ...card, borderColor: delPlantel.length ? "var(--h-club)" : C.borde }}>
          <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 4 }}>Ideas del plantel {delPlantel.length ? `(${delPlantel.length})` : ""}</div>
          <div style={{ fontSize: 12.5, color: C.apagado, marginBottom: 4 }}>Lo que mandan los jugadores. Las que valgan la pena, mandáselas a ADN Sports.</div>
          {lista !== null && !delPlantel.length && <div style={{ fontSize: 13, color: C.apagado, paddingTop: 8 }}>No hay ideas nuevas del plantel.</div>}
          {delPlantel.map((f) => (
            <Item key={f.id} f={f} acciones={
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => reenviar(f, true)} style={{ ...boton, background: C.acento, color: "var(--h-fondo)", border: "none" }}>Mandar a ADN</button>
                <button type="button" onClick={() => reenviar(f, false)} style={boton}>Archivar</button>
              </div>} />
          ))}
        </div>
      )}
      <Formulario
        titulo="Enviar a ADN Sports"
        bajada="Contanos un error, una idea para mejorar la app o una consulta."
        textoOk="¡Enviado! ADN Sports lo va a revisar y te va a llegar la respuesta como notificación."
        onEnviar={(tipo, mensaje) => insertar({ tipo, mensaje, origen: "staff", para_adn: true })}
      />
      <div style={card}>
        <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 12 }}>Enviados a ADN Sports</div>
        {lista === null && <div style={{ fontSize: 13, color: C.apagado }}>Cargando…</div>}
        {lista !== null && !enviados.length && <div style={{ fontSize: 13, color: C.apagado }}>Todavía no enviaron nada.</div>}
        {enviados.map((f) => (
          <Item key={f.id} f={f} extra={<Etiqueta color={COLOR_ESTADO[f.estado]}>{f.origen === "jugador" ? "Del plantel · " : ""}{f.estado}</Etiqueta>} />
        ))}
      </div>
    </div>
  );
}
