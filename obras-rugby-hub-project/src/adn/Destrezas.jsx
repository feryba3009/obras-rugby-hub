import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { CLUB_SLUG } from "./club";

// Seguimiento de destrezas: el staff evalúa cada destreza de ataque y de defensa de 1 a 5 cada tanto,
// y queda la evolución. El jugador ve la suya en su ficha. Por ahora es una función a medida de
// Berazategui (ataque a cargo del head coach, defensa del entrenador de backs).

export const CLUBES_CON_DESTREZAS = ["berazategui"];
export const tieneDestrezas = () => CLUBES_CON_DESTREZAS.includes(CLUB_SLUG);

export const AREAS_DESTREZA = {
  ataque: { label: "Ataque", destrezas: ["Pase", "Recepción", "Carrera con pelota", "Contacto y descarga", "Juego con el pie", "Toma de decisiones"] },
  defensa: { label: "Defensa", destrezas: ["Tackle", "Línea defensiva", "Lucha por la pelota", "Comunicación", "Cobertura y recuperación"] },
};
export const NIVELES = ["", "Inicial", "En desarrollo", "Cumple", "Muy bien", "Destacado"];

const tarjeta = { background: "var(--h-panel)", border: "1px solid var(--h-borde)", borderRadius: 14, padding: "16px 18px" };
const fechaCorta = (iso) => { const [y, m, d] = String(iso).split("-"); return `${d}/${m}/${String(y).slice(2)}`; };
const hoyISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
const uno = (n) => (n == null ? "—" : n.toFixed(1).replace(".", ","));

// Historial por destreza: [{fecha, nota, comentario}] de la más vieja a la más nueva.
function agrupar(filas) {
  const por = {};
  for (const f of [...filas].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))) {
    (por[f.destreza] = por[f.destreza] || []).push(f);
  }
  return por;
}
function promedioArea(por, area, cual = "ultima") {
  const notas = AREAS_DESTREZA[area].destrezas
    .map((d) => por[d])
    .filter((h) => h && h.length)
    .map((h) => (cual === "ultima" ? h[h.length - 1].nota : h.length > 1 ? h[h.length - 2].nota : null))
    .filter((n) => n != null);
  return notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
}

function Barra({ nota, color = "var(--h-club)", chica }) {
  return (
    <span aria-label={`${nota} de 5`} style={{ display: "inline-flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ width: chica ? 10 : 16, height: chica ? 6 : 8, borderRadius: 3, background: i <= nota ? color : "var(--h-borde)" }} />
      ))}
    </span>
  );
}

function Cambio({ antes, ahora }) {
  if (antes == null || ahora == null || Math.abs(ahora - antes) < 0.05) return null;
  const sube = ahora > antes;
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: sube ? "var(--h-ok)" : "var(--h-error)" }}>
      {sube ? "▲" : "▼"} {uno(Math.abs(ahora - antes))}
    </span>
  );
}

// Lo que ve el jugador (y el staff dentro de la ficha): cada destreza con su nivel y cómo cambió.
export function DestrezasJugador({ jugadorId, nombre }) {
  const [filas, setFilas] = useState(null);
  useEffect(() => {
    if (!jugadorId) { setFilas([]); return; }
    let vivo = true;
    supabase.from("destrezas_evaluacion").select("*").eq("jugador_id", jugadorId).order("fecha", { ascending: true })
      .then(({ data, error }) => { if (error) console.error("Error cargando destrezas:", error); if (vivo) setFilas(data || []); });
    return () => { vivo = false; };
  }, [jugadorId]);
  if (filas === null) return <div style={{ ...tarjeta, color: "var(--h-sub)", fontSize: 13.5 }}>Cargando…</div>;
  if (!filas.length) {
    return (
      <div style={{ ...tarjeta, color: "var(--h-sub)", fontSize: 14, lineHeight: 1.5 }}>
        Todavía no hay evaluaciones de destrezas{nombre ? ` de ${nombre}` : ""}. Aparecen acá cuando el staff las carga.
      </div>
    );
  }
  const por = agrupar(filas);
  const fechas = [...new Set(filas.map((f) => f.fecha))].sort();
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontSize: 13, color: "var(--h-sub)" }}>
        {fechas.length === 1 ? `Evaluado el ${fechaCorta(fechas[0])}.` : `${fechas.length} evaluaciones, la última el ${fechaCorta(fechas[fechas.length - 1])}.`} Escala de 1 (inicial) a 5 (destacado).
      </div>
      {Object.entries(AREAS_DESTREZA).map(([area, { label, destrezas }]) => {
        const ahora = promedioArea(por, area), antes = promedioArea(por, area, "anterior");
        const comentario = filas.filter((f) => f.area === area && f.comentario).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
        return (
          <div key={area} style={tarjeta}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: "var(--h-titulo)", fontSize: 22, fontWeight: 800, color: "var(--h-texto)" }}>{label}</span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "var(--h-titulo)", fontSize: 26, fontWeight: 800, color: "var(--h-texto)" }}>{uno(ahora)}</span>
                <Cambio antes={antes} ahora={ahora} />
              </span>
            </div>
            {destrezas.map((d) => {
              const h = por[d] || [];
              const ult = h[h.length - 1], prev = h[h.length - 2];
              return (
                <div key={d} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--h-borde)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--h-texto)" }}>{d}</div>
                    <div style={{ fontSize: 12, color: "var(--h-sub)" }}>
                      {ult ? NIVELES[ult.nota] : "Sin evaluar"}
                      {prev && prev.nota !== ult.nota && <> · antes {prev.nota} ({fechaCorta(prev.fecha)})</>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {ult && <Barra nota={ult.nota} />}
                    <span style={{ minWidth: 28, textAlign: "right" }}><Cambio antes={prev?.nota} ahora={ult?.nota} /></span>
                  </div>
                </div>
              );
            })}
            {comentario && (
              <div style={{ marginTop: 10, fontSize: 13.5, color: "var(--h-texto2)", background: "var(--h-panel2)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.45 }}>
                <b>Lo que dice el staff:</b> {comentario.comentario} <span style={{ color: "var(--h-sub)" }}>({fechaCorta(comentario.fecha)})</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Carga de una evaluación (de un área) para un jugador. Arranca con las últimas notas.
function Evaluar({ jugador, area, por, perfil, onListo, onCancelar }) {
  const { label, destrezas } = AREAS_DESTREZA[area];
  const [notas, setNotas] = useState(() => Object.fromEntries(destrezas.map((d) => [d, por[d]?.[por[d].length - 1]?.nota || 0])));
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const completas = destrezas.every((d) => notas[d] > 0);
  async function guardar() {
    if (!completas) return setError("Poné una nota a cada destreza.");
    setGuardando(true); setError("");
    const fecha = hoyISO();
    const filas = destrezas.map((d) => ({ jugador_id: jugador.dbId, fecha, area, destreza: d, nota: notas[d], comentario: comentario.trim() || null, evaluador_id: perfil?.id || null }));
    // Una evaluación por día y área: si ya había una hoy, se reemplaza.
    await supabase.from("destrezas_evaluacion").delete().eq("jugador_id", jugador.dbId).eq("fecha", fecha).eq("area", area);
    const { error: e } = await supabase.from("destrezas_evaluacion").insert(filas);
    if (!e) {
      await supabase.from("notificaciones").insert({ tipo: "destrezas", mensaje: `Se actualizó tu evaluación de ${label.toLowerCase()}. Mirala en tu ficha.`, roles_destino: ["Jugador"], jugadores_destino: [jugador.dbId], creado_por: perfil?.id || null });
    }
    setGuardando(false);
    if (e) { console.error("Error guardando destrezas:", e); return setError("No se pudo guardar. Probá de nuevo."); }
    onListo();
  }
  return (
    <div style={{ ...tarjeta, borderColor: "var(--h-club)" }}>
      <div style={{ fontFamily: "var(--h-titulo)", fontSize: 20, fontWeight: 800, color: "var(--h-texto)", marginBottom: 2 }}>{label} · {jugador.id}</div>
      <div style={{ fontSize: 12.5, color: "var(--h-sub)", marginBottom: 10 }}>Tocá el nivel de cada destreza (1 inicial, 5 destacado).</div>
      {destrezas.map((d) => (
        <div key={d} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid var(--h-borde)", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--h-texto)" }}>{d}</span>
          <span role="radiogroup" aria-label={d} style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const activo = notas[d] === n;
              return (
                <button key={n} type="button" role="radio" aria-checked={activo} aria-label={`${d}: ${n}`} title={NIVELES[n]}
                  onClick={() => setNotas((x) => ({ ...x, [d]: n }))}
                  style={{ width: 36, height: 36, borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 15,
                    border: "1.5px solid " + (activo ? "var(--h-club)" : "var(--h-borde2)"),
                    background: activo ? "var(--h-club)" : n <= notas[d] ? "var(--h-panel2)" : "transparent",
                    color: activo ? "var(--h-club-txt)" : "var(--h-texto2)" }}>{n}</button>
              );
            })}
          </span>
        </div>
      ))}
      <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Comentario para el jugador (opcional)"
        style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--h-borde2)", background: "var(--h-campo)", color: "var(--h-texto)", fontSize: 14, resize: "vertical" }} />
      {error && <div style={{ color: "var(--h-error)", fontSize: 13, marginTop: 6 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancelar} style={{ padding: "9px 16px", borderRadius: 999, border: "1px solid var(--h-borde2)", background: "transparent", color: "var(--h-texto2)", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
        <button type="button" onClick={guardar} disabled={guardando} style={{ padding: "9px 18px", borderRadius: 999, border: "none", background: "var(--h-club)", color: "var(--h-club-txt)", cursor: "pointer", fontWeight: 700 }}>{guardando ? "Guardando…" : "Guardar evaluación"}</button>
      </div>
    </div>
  );
}

// Pantalla del staff: todo el plantel con su nivel en ataque y defensa, y la carga de evaluaciones.
export function DestrezasPage({ perfil, jugadores }) {
  const [filas, setFilas] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [elegido, setElegido] = useState(null);
  const [evaluando, setEvaluando] = useState(null);
  const [orden, setOrden] = useState("nombre");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    supabase.from("destrezas_evaluacion").select("*").order("fecha", { ascending: true })
      .then(({ data, error }) => { if (error) console.error("Error cargando destrezas:", error); setFilas(data || []); });
  }, [recarga]);
  const porJugador = useMemo(() => {
    const m = {};
    for (const f of filas || []) (m[f.jugador_id] = m[f.jugador_id] || []).push(f);
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, agrupar(v)]));
  }, [filas]);
  const resumen = (j) => {
    const por = porJugador[j.dbId] || {};
    const fechas = Object.values(por).flat().map((f) => f.fecha).sort();
    return { por, ataque: promedioArea(por, "ataque"), defensa: promedioArea(por, "defensa"),
      ataqueAntes: promedioArea(por, "ataque", "anterior"), defensaAntes: promedioArea(por, "defensa", "anterior"), ultima: fechas[fechas.length - 1] || null };
  };
  const lista = jugadores
    .filter((j) => !busca.trim() || j.id.toLowerCase().includes(busca.trim().toLowerCase()))
    .map((j) => ({ j, r: resumen(j) }))
    .sort((a, b) => orden === "nombre" ? a.j.id.localeCompare(b.j.id)
      : orden === "ataque" ? (a.r.ataque ?? 9) - (b.r.ataque ?? 9) : (a.r.defensa ?? 9) - (b.r.defensa ?? 9));

  const sel = elegido && jugadores.find((j) => j.dbId === elegido);
  if (sel) {
    const r = resumen(sel);
    return (
      <div style={{ display: "grid", gap: 14, maxWidth: 760 }}>
        <button onClick={() => { setElegido(null); setEvaluando(null); }} style={{ justifySelf: "start", background: "none", border: "none", color: "var(--h-acento)", cursor: "pointer", fontSize: 14, padding: 0, fontWeight: 600 }}>← Todo el plantel</button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--h-titulo)", fontSize: 30, fontWeight: 800, color: "var(--h-texto)", lineHeight: 1.05 }}>{sel.id}</div>
            <div style={{ fontSize: 13.5, color: "var(--h-sub)" }}>{sel.posicionIdeal || "Sin puesto"}</div>
          </div>
          {!evaluando && (
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(AREAS_DESTREZA).map(([k, a]) => (
                <button key={k} onClick={() => setEvaluando(k)} style={{ padding: "9px 16px", borderRadius: 999, border: "1.5px solid var(--h-club)", background: "transparent", color: "var(--h-club-tinta)", cursor: "pointer", fontWeight: 700 }}>
                  Evaluar {a.label.toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </div>
        {evaluando && (
          <Evaluar key={evaluando} jugador={sel} area={evaluando} por={r.por} perfil={perfil}
            onCancelar={() => setEvaluando(null)} onListo={() => { setEvaluando(null); setRecarga((n) => n + 1); }} />
        )}
        <DestrezasJugador key={recarga} jugadorId={sel.dbId} nombre={sel.id} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontFamily: "var(--h-titulo)", fontSize: 34, fontWeight: 800, color: "var(--h-texto)", lineHeight: 1.05 }}>Destrezas</div>
        <div style={{ fontSize: 13.5, color: "var(--h-sub)", marginTop: 2 }}>Ataque y defensa de cada jugador, de 1 a 5. Tocá un jugador para ver su evolución o evaluarlo.</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar jugador" aria-label="Buscar jugador"
          style={{ flex: "1 1 200px", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--h-borde2)", background: "var(--h-campo)", color: "var(--h-texto)", fontSize: 14 }} />
        {[["nombre", "Por nombre"], ["ataque", "A mejorar en ataque"], ["defensa", "A mejorar en defensa"]].map(([k, l]) => (
          <button key={k} onClick={() => setOrden(k)} aria-pressed={orden === k}
            style={{ padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: "1px solid " + (orden === k ? "var(--h-club)" : "var(--h-borde2)"), background: orden === k ? "var(--h-club)" : "transparent", color: orden === k ? "var(--h-club-txt)" : "var(--h-texto2)" }}>{l}</button>
        ))}
      </div>
      <div style={{ ...tarjeta, padding: 0, overflow: "hidden" }}>
        {filas === null && <div style={{ padding: 16, color: "var(--h-sub)" }}>Cargando…</div>}
        {lista.map(({ j, r }, i) => (
          <button key={j.dbId} onClick={() => setElegido(j.dbId)} aria-label={`Destrezas de ${j.id}`}
            style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 14, alignItems: "center", width: "100%", textAlign: "left", padding: "12px 16px", border: "none", borderTop: i ? "1px solid var(--h-borde)" : "none", background: "transparent", cursor: "pointer" }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--h-texto)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.id}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--h-sub)" }}>{j.posicionIdeal || "Sin puesto"}{r.ultima ? ` · evaluado el ${fechaCorta(r.ultima)}` : " · sin evaluar"}</span>
            </span>
            {[["Ataque", r.ataque, r.ataqueAntes], ["Defensa", r.defensa, r.defensaAntes]].map(([l, v, a]) => (
              <span key={l} style={{ textAlign: "right", minWidth: 64 }}>
                <span style={{ display: "block", fontSize: 11, color: "var(--h-sub)" }}>{l}</span>
                <span style={{ fontFamily: "var(--h-titulo)", fontSize: 20, fontWeight: 800, color: v == null ? "var(--h-sub2)" : "var(--h-texto)" }}>{uno(v)}</span>{" "}
                <Cambio antes={a} ahora={v} />
              </span>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}
