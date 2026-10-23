import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// Apto médico obligatorio de la UAR: uno por jugador por temporada.
// El jugador lo sube (foto o PDF) y el manager o el cuerpo médico lo aprueban; al aprobarlo, el
// jugador queda "Apto" en toda la app. Los archivos son privados: los ve el jugador y el staff.

const BUCKET = "aptos-medicos";
const tarjeta = { background: "var(--h-panel)", border: "1px solid var(--h-borde)", borderRadius: 14, padding: "16px 18px" };
const boton = (principal) => ({
  padding: "9px 16px", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: 13.5,
  border: principal ? "none" : "1px solid var(--h-borde2)", background: principal ? "var(--h-club)" : "transparent",
  color: principal ? "var(--h-club-txt)" : "var(--h-texto2)",
});
const fechaCorta = (iso) => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
const ESTADO = {
  aprobado: { t: "Aprobado", c: "var(--h-ok)", f: "var(--h-ok-suave)" },
  cargado: { t: "Por revisar", c: "var(--h-alerta)", f: "var(--h-alerta-suave)" },
  rechazado: { t: "Hay que volver a subirlo", c: "var(--h-error)", f: "var(--h-error-suave)" },
  falta: { t: "Sin cargar", c: "var(--h-sub)", f: "var(--h-panel2)" },
};
const Estado = ({ e }) => (
  <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: ESTADO[e].f, color: ESTADO[e].c, whiteSpace: "nowrap" }}>{ESTADO[e].t}</span>
);

async function abrirArchivo(ruta) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 300);
  if (error || !data?.signedUrl) { console.error("No se pudo abrir el apto:", error); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

// Sube (o reemplaza) el apto de un jugador para la temporada.
async function subirApto({ perfil, jugadorId, temporada, archivo, fechaEmision, previo, aprobarYa }) {
  const ext = (archivo.name.split(".").pop() || "pdf").toLowerCase();
  const ruta = `${perfil.club_id}/${jugadorId}/${temporada}-${Date.now()}.${ext}`;
  const { error: e1 } = await supabase.storage.from(BUCKET).upload(ruta, archivo, { upsert: true, contentType: archivo.type || undefined });
  if (e1) { console.error("Error subiendo el apto:", e1); return false; }
  const fila = { archivo: ruta, fecha_emision: fechaEmision || null, estado: aprobarYa ? "aprobado" : "cargado", nota: null,
    cargado_por: perfil.id, updated_at: new Date().toISOString(), ...(aprobarYa ? { revisado_por: perfil.id } : {}) };
  const { error: e2 } = previo
    ? await supabase.from("aptos_medicos").update(fila).eq("id", previo.id)
    : await supabase.from("aptos_medicos").insert({ ...fila, jugador_id: jugadorId, temporada });
  if (e2) { console.error("Error guardando el apto:", e2); return false; }
  return true;
}

function Subida({ texto, onArchivo, ocupado }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onArchivo(f); }} />
      <button type="button" disabled={ocupado} onClick={() => ref.current?.click()} style={boton(true)}>{ocupado ? "Subiendo…" : texto}</button>
    </>
  );
}

// Lo que ve el jugador: su apto de esta temporada.
function MiApto({ perfil, temporada }) {
  const [apto, setApto] = useState(undefined);
  const [fecha, setFecha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const cargar = () => supabase.from("aptos_medicos").select("*").eq("jugador_id", perfil.jugador_id).eq("temporada", temporada).maybeSingle()
    .then(({ data }) => setApto(data || null));
  useEffect(() => { if (perfil?.jugador_id) cargar(); }, [perfil?.jugador_id, temporada]);
  if (!perfil?.jugador_id) return <div style={{ ...tarjeta, color: "var(--h-sub)" }}>Tu cuenta todavía no está unida a un jugador del plantel. Avisale al staff.</div>;
  if (apto === undefined) return <div style={{ ...tarjeta, color: "var(--h-sub)" }}>Cargando…</div>;
  const e = apto ? apto.estado : "falta";
  async function subir(f) {
    if (f.size > 10 * 1024 * 1024) return setAviso("El archivo pesa más de 10 MB. Probá con una foto más liviana.");
    setOcupado(true); setAviso("");
    const ok = await subirApto({ perfil, jugadorId: perfil.jugador_id, temporada, archivo: f, fechaEmision: fecha, previo: apto });
    setOcupado(false);
    setAviso(ok ? "¡Listo! Le llegó al club para revisarlo." : "No se pudo subir. Probá de nuevo.");
    if (ok) cargar();
  }
  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 620 }}>
      <div>
        <div style={{ fontFamily: "var(--h-titulo)", fontSize: 34, fontWeight: 800, color: "var(--h-texto)", lineHeight: 1.05 }}>Mi apto médico</div>
        <div style={{ fontSize: 13.5, color: "var(--h-sub)", marginTop: 2 }}>El apto obligatorio de la UAR para jugar la temporada {temporada}.</div>
      </div>
      <div style={{ ...tarjeta, borderTop: `3px solid ${ESTADO[e].c}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--h-titulo)", fontSize: 22, fontWeight: 800, color: "var(--h-texto)" }}>Temporada {temporada}</span>
          <Estado e={e} />
        </div>
        <div style={{ fontSize: 14, color: "var(--h-texto2)", marginTop: 8, lineHeight: 1.5 }}>
          {e === "falta" && "Todavía no lo subiste. Sacale una foto clara (o subí el PDF) y el club lo revisa."}
          {e === "cargado" && `Lo subiste el ${fechaCorta(apto.updated_at || apto.created_at)}. El club lo tiene que revisar.`}
          {e === "aprobado" && "Está aprobado: estás habilitado para jugar."}
          {e === "rechazado" && <>Hay que volver a subirlo{apto.nota ? <>: <b>{apto.nota}</b></> : "."}</>}
        </div>
        {apto?.archivo && (
          <button type="button" onClick={() => abrirArchivo(apto.archivo)} style={{ ...boton(false), marginTop: 12 }}>Ver el que subí</button>
        )}
        {e !== "aprobado" && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--h-borde)", display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12.5, color: "var(--h-sub)" }}>
              Fecha del apto (opcional)
              <input type="date" value={fecha} onChange={(ev) => setFecha(ev.target.value)}
                style={{ display: "block", marginTop: 4, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--h-borde2)", background: "var(--h-campo)", color: "var(--h-texto)", fontSize: 14 }} />
            </label>
            <div><Subida texto={apto ? "Subir uno nuevo" : "Subir foto o PDF"} onArchivo={subir} ocupado={ocupado} /></div>
          </div>
        )}
        {aviso && <div style={{ fontSize: 13, marginTop: 10, color: aviso.startsWith("¡") ? "var(--h-ok)" : "var(--h-error)" }}>{aviso}</div>}
      </div>
    </div>
  );
}

// Lo que ve el staff: todo el plantel con el estado de su apto de la temporada.
function AptosPlantel({ perfil, jugadores, temporada }) {
  const puedeAprobar = ["Manager", "Cuerpo médico"].includes(perfil?.rol) || (import.meta.env.VITE_DEMO === "1" && perfil?.rol !== "Jugador");
  const [aptos, setAptos] = useState(null);
  const [tab, setTab] = useState("revisar");
  const [ocupado, setOcupado] = useState(null);
  const [rechazando, setRechazando] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState("");
  const cargar = () => supabase.from("aptos_medicos").select("*").eq("temporada", temporada).then(({ data }) => setAptos(data || []));
  useEffect(() => { cargar(); }, [temporada]);
  const de = Object.fromEntries((aptos || []).map((a) => [a.jugador_id, a]));
  const estadoDe = (j) => de[j.dbId]?.estado || "falta";
  const grupos = {
    revisar: jugadores.filter((j) => estadoDe(j) === "cargado"),
    faltan: jugadores.filter((j) => ["falta", "rechazado"].includes(estadoDe(j))),
    aprobados: jugadores.filter((j) => estadoDe(j) === "aprobado"),
  };
  async function revisar(j, estado, nota) {
    setOcupado(j.dbId);
    const { error } = await supabase.from("aptos_medicos").update({ estado, nota: nota || null, revisado_por: perfil.id, updated_at: new Date().toISOString() }).eq("id", de[j.dbId].id);
    if (!error && estado === "aprobado") j.apto = "Apto";
    setOcupado(null); setRechazando(null); setMotivo("");
    if (error) console.error("Error revisando el apto:", error);
    cargar();
  }
  async function subirPor(j, f) {
    setOcupado(j.dbId);
    const ok = await subirApto({ perfil, jugadorId: j.dbId, temporada, archivo: f, previo: de[j.dbId], aprobarYa: puedeAprobar });
    if (ok && puedeAprobar) j.apto = "Apto";
    setOcupado(null);
    if (!ok) setAviso("No se pudo subir el archivo. Probá de nuevo.");
    cargar();
  }
  async function recordar() {
    const ids = grupos.faltan.map((j) => j.dbId);
    if (!ids.length) return;
    const { error } = await supabase.from("notificaciones").insert({ tipo: "apto_medico", mensaje: `Falta tu apto médico ${temporada}. Subilo desde la app en El club › Mi apto médico.`, roles_destino: ["Jugador"], jugadores_destino: ids, creado_por: perfil.id });
    setAviso(error ? "No se pudo mandar el aviso." : `Les llegó el aviso a ${ids.length} ${ids.length === 1 ? "jugador" : "jugadores"}.`);
  }
  const total = jugadores.length;
  const pestaña = (k, l) => (
    <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
      style={{ ...boton(tab === k), padding: "8px 14px" }}>{l} · {grupos[k].length}</button>
  );
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontFamily: "var(--h-titulo)", fontSize: 34, fontWeight: 800, color: "var(--h-texto)", lineHeight: 1.05 }}>Aptos médicos</div>
        <div style={{ fontSize: 13.5, color: "var(--h-sub)", marginTop: 2 }}>El apto obligatorio de la UAR, uno por jugador para la temporada {temporada}. Al aprobarlo, el jugador queda apto en toda la app.</div>
      </div>
      {aptos && (
        <div style={tarjeta}>
          <div style={{ fontSize: 15, color: "var(--h-texto)" }}>
            <b>{grupos.aprobados.length} de {total}</b> aprobados · <b style={{ color: "var(--h-alerta)" }}>{grupos.revisar.length}</b> por revisar · <b>{grupos.faltan.length}</b> sin cargar
          </div>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 10, background: "var(--h-borde)" }}>
            <span style={{ flex: grupos.aprobados.length, background: "var(--h-ok)" }} />
            <span style={{ flex: grupos.revisar.length, background: "var(--h-alerta)" }} />
            <span style={{ flex: grupos.faltan.length }} />
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {pestaña("revisar", "Por revisar")}{pestaña("faltan", "Sin cargar")}{pestaña("aprobados", "Aprobados")}
        {tab === "faltan" && grupos.faltan.length > 0 && (
          <button onClick={recordar} style={{ ...boton(false), marginLeft: "auto" }}>Recordarles a los que faltan</button>
        )}
      </div>
      {aviso && <div style={{ fontSize: 13, color: "var(--h-ok)" }}>{aviso}</div>}
      <div style={{ ...tarjeta, padding: 0, overflow: "hidden" }}>
        {aptos === null && <div style={{ padding: 16, color: "var(--h-sub)" }}>Cargando…</div>}
        {aptos && grupos[tab].length === 0 && (
          <div style={{ padding: 16, color: "var(--h-sub)", fontSize: 14 }}>
            {tab === "revisar" ? "No hay aptos para revisar." : tab === "faltan" ? "Todos subieron su apto." : "Todavía no hay aptos aprobados."}
          </div>
        )}
        {grupos[tab].map((j, i) => {
          const a = de[j.dbId];
          return (
            <div key={j.dbId} style={{ padding: "12px 16px", borderTop: i ? "1px solid var(--h-borde)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--h-texto)" }}>{j.id}</div>
                  <div style={{ fontSize: 12, color: "var(--h-sub)" }}>
                    {j.posicionIdeal || "Sin puesto"}
                    {a?.fecha_emision ? ` · apto del ${fechaCorta(a.fecha_emision)}` : ""}
                    {a && a.estado !== "falta" ? ` · subido el ${fechaCorta(a.updated_at || a.created_at)}` : ""}
                  </div>
                  {a?.estado === "rechazado" && a.nota && <div style={{ fontSize: 12.5, color: "var(--h-error)" }}>Motivo: {a.nota}</div>}
                </div>
                <Estado e={a?.estado || "falta"} />
                {a?.archivo && <button onClick={() => abrirArchivo(a.archivo)} style={boton(false)}>Ver</button>}
                {puedeAprobar && a?.estado === "cargado" && (
                  <>
                    <button disabled={ocupado === j.dbId} onClick={() => revisar(j, "aprobado")} style={boton(true)}>Aprobar</button>
                    <button onClick={() => { setRechazando(j.dbId); setMotivo(""); }} style={boton(false)}>Rechazar</button>
                  </>
                )}
                {tab === "faltan" && <Subida texto="Subirlo yo" ocupado={ocupado === j.dbId} onArchivo={(f) => subirPor(j, f)} />}
              </div>
              {rechazando === j.dbId && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (ej: no se lee, es de otra temporada)"
                    style={{ flex: "1 1 220px", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--h-borde2)", background: "var(--h-campo)", color: "var(--h-texto)", fontSize: 14 }} />
                  <button onClick={() => revisar(j, "rechazado", motivo.trim())} style={boton(true)}>Pedir que lo suba de nuevo</button>
                  <button onClick={() => setRechazando(null)} style={boton(false)}>Cancelar</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AptosMedicosPage({ perfil, jugadores, temporada }) {
  if (perfil?.rol === "Jugador") return <MiApto perfil={perfil} temporada={temporada} />;
  return <AptosPlantel perfil={perfil} jugadores={jugadores} temporada={temporada} />;
}
