import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { CLUB_SLUG } from "./club";

// Seguimiento de destrezas (función a medida, hoy para Berazategui).
// Destrezas generales para todos y destrezas del puesto (forwards o backs). Cada destreza se evalúa
// de 1 a 5 en sus tres etapas: preparación, ejecución y terminación. Queda la evolución de cada una.

export const CLUBES_CON_DESTREZAS = ["berazategui"];
export const tieneDestrezas = () => CLUBES_CON_DESTREZAS.includes(CLUB_SLUG);

export const DESTREZAS_GENERALES = ["Pase y recepción", "Tackle", "Duelo", "Breakdown"];
export const DESTREZAS_PUESTO = { forwards: ["Scrum", "Line"], backs: ["Pateo"] };
export const ETAPAS = [["preparacion", "Preparación"], ["ejecucion", "Ejecución"], ["terminacion", "Terminación"]];
const CORTO = { "Pase y recepción": "Pase", Tackle: "Tackle", Duelo: "Duelo", Breakdown: "Breakdown" };

export const esForward = (puesto) => /primera|pilar|hooker|segunda|tercera|ala|octavo|forward/i.test(String(puesto || ""));
export function destrezasDe(puesto) {
  const grupo = esForward(puesto) ? "forwards" : "backs";
  return [
    ...DESTREZAS_GENERALES.map((d) => ({ d, area: "general" })),
    ...DESTREZAS_PUESTO[grupo].map((d) => ({ d, area: "puesto" })),
  ];
}

const tarjeta = { background: "var(--h-panel)", border: "1px solid var(--h-borde)", borderRadius: 14, padding: "16px 18px" };
const fechaCorta = (iso) => { const [y, m, d] = String(iso).split("-"); return `${d}/${m}/${String(y).slice(2)}`; };
const hoyISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
const uno = (n) => (n == null ? "—" : n.toFixed(1).replace(".", ","));
const prom = (xs) => { const v = xs.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

// filas → { destreza: [{ fecha, etapas: {preparacion: n, ...}, nota (promedio), comentario }] } de la más vieja a la más nueva.
export function historialDestrezas(filas) {
  const m = {};
  for (const f of filas) {
    const porFecha = (m[f.destreza] = m[f.destreza] || {});
    const e = (porFecha[f.fecha] = porFecha[f.fecha] || { fecha: f.fecha, etapas: {}, comentario: null });
    e.etapas[f.etapa] = f.nota;
    if (f.comentario) e.comentario = f.comentario;
  }
  const out = {};
  for (const [d, porFecha] of Object.entries(m)) {
    out[d] = Object.values(porFecha).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map((e) => ({ ...e, nota: prom(ETAPAS.map(([k]) => e.etapas[k])) }));
  }
  return out;
}
// Promedio de las destrezas generales en su última evaluación y en la primera.
export function resumenDestrezas(hist) {
  const ult = prom(DESTREZAS_GENERALES.map((d) => hist[d]?.[hist[d].length - 1]?.nota));
  const pri = prom(DESTREZAS_GENERALES.map((d) => (hist[d]?.length > 1 ? hist[d][0].nota : null)));
  return { ahora: ult, antes: pri };
}

function Barra({ nota }) {
  return (
    <span aria-label={nota ? `${nota} de 5` : "sin nota"} style={{ display: "inline-flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ width: 14, height: 7, borderRadius: 3, background: nota && i <= nota ? "var(--h-club)" : "var(--h-borde)" }} />
      ))}
    </span>
  );
}

function Cambio({ antes, ahora }) {
  if (antes == null || ahora == null || Math.abs(ahora - antes) < 0.05) return null;
  const sube = ahora > antes;
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: sube ? "var(--h-ok)" : "var(--h-error)", whiteSpace: "nowrap" }}>
      {sube ? "▲" : "▼"} {uno(Math.abs(ahora - antes))}
    </span>
  );
}

function TarjetaDestreza({ d, h }) {
  const ult = h?.[h.length - 1], prev = h?.[h.length - 2];
  return (
    <div style={tarjeta}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "var(--h-titulo)", fontSize: 21, fontWeight: 800, color: "var(--h-texto)" }}>{d}</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "var(--h-titulo)", fontSize: 24, fontWeight: 800, color: ult ? "var(--h-texto)" : "var(--h-sub2)" }}>{uno(ult?.nota)}</span>
          <Cambio antes={prev?.nota} ahora={ult?.nota} />
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--h-sub)", marginBottom: 6 }}>
        {ult ? `Evaluada el ${fechaCorta(ult.fecha)}${prev ? ` · antes, el ${fechaCorta(prev.fecha)}` : ""}` : "Sin evaluar todavía"}
      </div>
      {ETAPAS.map(([k, l]) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto 18px 44px", gap: 8, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--h-borde)" }}>
          <span style={{ fontSize: 14, color: "var(--h-texto)" }}>{l}</span>
          <Barra nota={ult?.etapas[k]} />
          <b style={{ fontSize: 14, color: "var(--h-texto)", textAlign: "right" }}>{ult?.etapas[k] ?? ""}</b>
          <span style={{ textAlign: "right" }}><Cambio antes={prev?.etapas[k]} ahora={ult?.etapas[k]} /></span>
        </div>
      ))}
      {ult?.comentario && (
        <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--h-texto2)", background: "var(--h-panel2)", borderRadius: 10, padding: "9px 12px", lineHeight: 1.45 }}>
          {ult.comentario}
        </div>
      )}
    </div>
  );
}

// Lo que ve el jugador (y el staff dentro de la ficha).
export function DestrezasJugador({ jugadorId, nombre, puesto }) {
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
  const hist = historialDestrezas(filas);
  const lista = destrezasDe(puesto);
  const grupo = (area) => lista.filter((x) => x.area === area);
  const titulo = (t) => <div style={{ fontSize: 13, fontWeight: 700, color: "var(--h-sub)", margin: "4px 2px 0" }}>{t}</div>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontSize: 13, color: "var(--h-sub)" }}>Cada destreza, de 1 (inicial) a 5 (destacado), en sus tres etapas: preparación, ejecución y terminación.</div>
      {titulo("Destrezas generales")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {grupo("general").map(({ d }) => <TarjetaDestreza key={d} d={d} h={hist[d]} />)}
      </div>
      {titulo(`Del puesto (${esForward(puesto) ? "forwards" : "backs"})`)}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {grupo("puesto").map(({ d }) => <TarjetaDestreza key={d} d={d} h={hist[d]} />)}
      </div>
    </div>
  );
}

// Carga de una evaluación: se tocan las destrezas que se evalúan hoy y cada una se puntúa en sus 3 etapas.
function Evaluar({ jugador, hist, perfil, onListo, onCancelar }) {
  const lista = destrezasDe(jugador.posicionIdeal);
  const [elegidas, setElegidas] = useState({});
  const [notas, setNotas] = useState({});
  const [comentarios, setComentarios] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  function alternar(d) {
    setElegidas((x) => ({ ...x, [d]: !x[d] }));
    // Arranca con la última evaluación de esa destreza (si tiene).
    const ult = hist[d]?.[hist[d].length - 1];
    if (!notas[d] && ult) setNotas((x) => ({ ...x, [d]: { ...ult.etapas } }));
  }
  const marcadas = lista.filter(({ d }) => elegidas[d]);
  async function guardar() {
    if (!marcadas.length) return setError("Elegí al menos una destreza.");
    const incompleta = marcadas.find(({ d }) => ETAPAS.some(([k]) => !notas[d]?.[k]));
    if (incompleta) return setError(`A ${incompleta.d} le falta la nota de alguna etapa.`);
    setGuardando(true); setError("");
    const fecha = hoyISO();
    const filas = marcadas.flatMap(({ d, area }) => ETAPAS.map(([k]) => ({
      jugador_id: jugador.dbId, fecha, area, destreza: d, etapa: k, nota: notas[d][k],
      comentario: comentarios[d]?.trim() || null, evaluador_id: perfil?.id || null,
    })));
    // Si esa destreza ya se evaluó hoy, se reemplaza.
    for (const { d } of marcadas) await supabase.from("destrezas_evaluacion").delete().eq("jugador_id", jugador.dbId).eq("fecha", fecha).eq("destreza", d);
    const { error: e } = await supabase.from("destrezas_evaluacion").insert(filas);
    if (!e) {
      const nombres = marcadas.map(({ d }) => d).join(", ");
      await supabase.from("notificaciones").insert({ tipo: "destrezas", mensaje: `Tenés una evaluación nueva de ${nombres}. Mirala en tu ficha.`, roles_destino: ["Jugador"], jugadores_destino: [jugador.dbId], creado_por: perfil?.id || null });
    }
    setGuardando(false);
    if (e) { console.error("Error guardando destrezas:", e); return setError("No se pudo guardar. Probá de nuevo."); }
    onListo();
  }
  return (
    <div style={{ ...tarjeta, borderColor: "var(--h-club)" }}>
      <div style={{ fontFamily: "var(--h-titulo)", fontSize: 20, fontWeight: 800, color: "var(--h-texto)" }}>Evaluar a {jugador.id}</div>
      <div style={{ fontSize: 12.5, color: "var(--h-sub)", marginBottom: 10 }}>Tocá las destrezas que evaluás hoy y poné de 1 a 5 cada etapa.</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {lista.map(({ d }) => (
          <button key={d} type="button" onClick={() => alternar(d)} aria-pressed={!!elegidas[d]}
            style={{ padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontSize: 13.5, fontWeight: 700,
              border: "1.5px solid " + (elegidas[d] ? "var(--h-club)" : "var(--h-borde2)"), background: elegidas[d] ? "var(--h-club)" : "transparent",
              color: elegidas[d] ? "var(--h-club-txt)" : "var(--h-texto2)" }}>{d}</button>
        ))}
      </div>
      {marcadas.map(({ d }) => (
        <div key={d} style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--h-borde)" }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--h-texto)", marginBottom: 4 }}>{d}</div>
          {ETAPAS.map(([k, l]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "5px 0", flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: "var(--h-texto2)" }}>{l}</span>
              <span role="radiogroup" aria-label={`${d} · ${l}`} style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const activo = notas[d]?.[k] === n;
                  return (
                    <button key={n} type="button" role="radio" aria-checked={activo} aria-label={`${d} · ${l}: ${n}`}
                      onClick={() => setNotas((x) => ({ ...x, [d]: { ...(x[d] || {}), [k]: n } }))}
                      style={{ width: 36, height: 36, borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 15,
                        border: "1.5px solid " + (activo ? "var(--h-club)" : "var(--h-borde2)"),
                        background: activo ? "var(--h-club)" : "transparent", color: activo ? "var(--h-club-txt)" : "var(--h-texto2)" }}>{n}</button>
                  );
                })}
              </span>
            </div>
          ))}
          <input value={comentarios[d] || ""} onChange={(e) => setComentarios((x) => ({ ...x, [d]: e.target.value }))} placeholder={`Comentario sobre ${d.toLowerCase()} (opcional)`}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 6, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--h-borde2)", background: "var(--h-campo)", color: "var(--h-texto)", fontSize: 14 }} />
        </div>
      ))}
      {error && <div style={{ color: "var(--h-error)", fontSize: 13, marginTop: 8 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancelar} style={{ padding: "9px 16px", borderRadius: 999, border: "1px solid var(--h-borde2)", background: "transparent", color: "var(--h-texto2)", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
        <button type="button" onClick={guardar} disabled={guardando} style={{ padding: "9px 18px", borderRadius: 999, border: "none", background: "var(--h-club)", color: "var(--h-club-txt)", cursor: "pointer", fontWeight: 700 }}>{guardando ? "Guardando…" : "Guardar evaluación"}</button>
      </div>
    </div>
  );
}

// Pantalla del staff: todo el plantel con su nivel en cada destreza general y en las de su puesto.
export function DestrezasPage({ perfil, jugadores }) {
  const [filas, setFilas] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [elegido, setElegido] = useState(null);
  const [evaluando, setEvaluando] = useState(false);
  const [orden, setOrden] = useState("nombre");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    supabase.from("destrezas_evaluacion").select("*").order("fecha", { ascending: true })
      .then(({ data, error }) => { if (error) console.error("Error cargando destrezas:", error); setFilas(data || []); });
  }, [recarga]);
  const histDe = useMemo(() => {
    const m = {};
    for (const f of filas || []) (m[f.jugador_id] = m[f.jugador_id] || []).push(f);
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, historialDestrezas(v)]));
  }, [filas]);
  const columnas = [...DESTREZAS_GENERALES, "Puesto"];
  const valor = (j, col) => {
    const h = histDe[j.dbId] || {};
    const ultimaDe = (d) => h[d]?.[h[d].length - 1]?.nota ?? null;
    const previaDe = (d) => (h[d]?.length > 1 ? h[d][h[d].length - 2].nota : null);
    if (col !== "Puesto") return { ahora: ultimaDe(col), antes: previaDe(col) };
    const delPuesto = destrezasDe(j.posicionIdeal).filter((x) => x.area === "puesto").map((x) => x.d);
    return { ahora: prom(delPuesto.map(ultimaDe)), antes: prom(delPuesto.map(previaDe)) };
  };
  const ultimaFecha = (j) => Object.values(histDe[j.dbId] || {}).flat().map((e) => e.fecha).sort().pop() || null;
  const lista = jugadores
    .filter((j) => !busca.trim() || j.id.toLowerCase().includes(busca.trim().toLowerCase()))
    .sort((a, b) => orden === "nombre" ? a.id.localeCompare(b.id) : (valor(a, orden).ahora ?? 9) - (valor(b, orden).ahora ?? 9));

  const sel = elegido && jugadores.find((j) => j.dbId === elegido);
  if (sel) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <button onClick={() => { setElegido(null); setEvaluando(false); }} style={{ justifySelf: "start", background: "none", border: "none", color: "var(--h-acento)", cursor: "pointer", fontSize: 14, padding: 0, fontWeight: 600 }}>← Todo el plantel</button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--h-titulo)", fontSize: 30, fontWeight: 800, color: "var(--h-texto)", lineHeight: 1.05 }}>{sel.id}</div>
            <div style={{ fontSize: 13.5, color: "var(--h-sub)" }}>{sel.posicionIdeal || "Sin puesto"} · {esForward(sel.posicionIdeal) ? "forward" : "back"}</div>
          </div>
          {!evaluando && (
            <button onClick={() => setEvaluando(true)} style={{ padding: "10px 18px", borderRadius: 999, border: "none", background: "var(--h-club)", color: "var(--h-club-txt)", cursor: "pointer", fontWeight: 700 }}>
              Evaluar
            </button>
          )}
        </div>
        {evaluando && (
          <Evaluar jugador={sel} hist={histDe[sel.dbId] || {}} perfil={perfil}
            onCancelar={() => setEvaluando(false)} onListo={() => { setEvaluando(false); setRecarga((n) => n + 1); }} />
        )}
        <DestrezasJugador key={recarga} jugadorId={sel.dbId} nombre={sel.id} puesto={sel.posicionIdeal} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontFamily: "var(--h-titulo)", fontSize: 34, fontWeight: 800, color: "var(--h-texto)", lineHeight: 1.05 }}>Destrezas</div>
        <div style={{ fontSize: 13.5, color: "var(--h-sub)", marginTop: 2 }}>
          Pase y recepción, tackle, duelo y breakdown, más las del puesto. Cada una de 1 a 5 en preparación, ejecución y terminación. Tocá un jugador para ver su evolución o evaluarlo.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar jugador" aria-label="Buscar jugador"
          style={{ flex: "1 1 200px", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--h-borde2)", background: "var(--h-campo)", color: "var(--h-texto)", fontSize: 14 }} />
        <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar"
          style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid var(--h-borde2)", background: "var(--h-campo)", color: "var(--h-texto)", fontSize: 14 }}>
          <option value="nombre">Por nombre</option>
          {columnas.map((c) => <option key={c} value={c}>A mejorar: {c === "Puesto" ? "las del puesto" : c.toLowerCase()}</option>)}
        </select>
      </div>
      <div style={{ ...tarjeta, padding: 0, overflowX: "auto" }}>
        {filas === null && <div style={{ padding: 16, color: "var(--h-sub)" }}>Cargando…</div>}
        <div style={{ minWidth: 560 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(170px, 1fr) repeat(5, 72px)", gap: 8, padding: "10px 16px", fontSize: 11.5, fontWeight: 700, color: "var(--h-sub)" }}>
            <span>Jugador</span>
            {columnas.map((c) => <span key={c} style={{ textAlign: "right" }}>{CORTO[c] || c}</span>)}
          </div>
          {lista.map((j) => {
            const f = ultimaFecha(j);
            return (
              <button key={j.dbId} onClick={() => setElegido(j.dbId)} aria-label={`Destrezas de ${j.id}`}
                style={{ display: "grid", gridTemplateColumns: "minmax(170px, 1fr) repeat(5, 72px)", gap: 8, alignItems: "center", width: "100%", textAlign: "left", padding: "11px 16px", border: "none", borderTop: "1px solid var(--h-borde)", background: "transparent", cursor: "pointer" }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "var(--h-texto)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.id}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--h-sub)" }}>{j.posicionIdeal || "Sin puesto"}{f ? ` · ${fechaCorta(f)}` : " · sin evaluar"}</span>
                </span>
                {columnas.map((c) => {
                  const v = valor(j, c);
                  return (
                    <span key={c} style={{ textAlign: "right" }}>
                      <span style={{ fontFamily: "var(--h-titulo)", fontSize: 19, fontWeight: 800, color: v.ahora == null ? "var(--h-sub2)" : "var(--h-texto)" }}>{uno(v.ahora)}</span>
                      <span style={{ display: "block", minHeight: 14 }}><Cambio antes={v.antes} ahora={v.ahora} /></span>
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
