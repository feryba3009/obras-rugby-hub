import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

// =====================================================================================
// Videoteca — videos de partidos (links de YouTube) compartidos según las reglas de ADN:
//   · Primera: videoteca de la división, recíproca (para ver hay que compartir y estar al día)
//   · Juveniles: solo entre los dos clubes que jugaron ese partido
//   · Intermedia: privada (cada club ve solo lo suyo)
// La base de datos es la que decide qué video puede ver cada uno; esta pantalla solo muestra
// lo que la base devuelve, así que no se puede "saltar" la regla desde el navegador.
// =====================================================================================

const C = {
  fondoCard: "#141415",
  borde: "#232324",
  texto: "#f5f4f0",
  suave: "#c9c9c6",
  apagado: "#8f8f8c",
  acento: "#f2c230",
  ok: "#5fbf7a",
  alerta: "#e8a33d",
  error: "#e5674f",
};

const card = { background: C.fondoCard, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "16px 16px" };
const boton = {
  padding: "8px 14px", minHeight: 36, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer",
  fontFamily: "'Inter', sans-serif", border: `1px solid ${C.borde}`, background: "#1c1c1d", color: C.texto,
};
const botonPrincipal = { ...boton, background: C.acento, color: "#0b0b0c", border: "none" };
const input = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 6, fontSize: 13,
  background: "#0f0f10", border: `1px solid ${C.borde}`, color: C.texto, fontFamily: "'Inter', sans-serif",
};

// Acepta youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID, /live/ID o el ID solo
export function extraerYoutubeId(texto) {
  const t = (texto || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  const m =
    t.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    t.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    t.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Mismo cálculo que la base: hasta el miércoles siguiente al partido
export function plazoVideo(fechaISO) {
  const d = new Date(fechaISO + "T12:00:00");
  const dow = d.getDay(); // 0 domingo … 3 miércoles
  let dias = (3 - dow + 7) % 7;
  if (dias === 0) dias = 7;
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function fechaCorta(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function Etiqueta({ color, children }) {
  return (
    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "#1c1c1d", color, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Reproductor({ youtubeId, titulo }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} style={boton}>
        ▶ Ver video
      </button>
    );
  }
  return (
    <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", borderRadius: 8, overflow: "hidden", background: "#000" }}>
      <iframe
        title={titulo}
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

function nombrePartido(p) {
  return `${p.local_nombre} ${p.estado === "Jugado" && p.tantos_local != null ? `${p.tantos_local}-${p.tantos_visitante}` : "vs"} ${p.visitante_nombre}`;
}

export default function VideotecaPage({ perfil }) {
  const esStaff = perfil?.rol === "Cuerpo técnico" || perfil?.rol === "Manager";
  const esManager = perfil?.rol === "Manager";
  const miClub = perfil?.club_id;

  const [estados, setEstados] = useState(null);
  const [torneoId, setTorneoId] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [rivalCargo, setRivalCargo] = useState({});
  const [club, setClub] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!esStaff) return;
    Promise.all([
      supabase.rpc("estado_videoteca"),
      supabase.from("clubes").select("id, nombre_corto, comparte_videoteca").maybeSingle(),
    ]).then(([{ data: est, error }, { data: cl }]) => {
      if (error) console.error("Error cargando videoteca:", error);
      setEstados(est || []);
      setClub(cl || null);
      setTorneoId((actual) => actual || est?.[0]?.torneo_id || null);
    });
  }, [esStaff, recarga]);

  useEffect(() => {
    if (!torneoId) return;
    Promise.all([
      supabase.from("partidos_liga").select("*").eq("torneo_id", torneoId).order("fecha", { ascending: true }),
      supabase.from("videos_partido").select("*, partidos_liga!inner(torneo_id)").eq("partidos_liga.torneo_id", torneoId),
    ]).then(async ([{ data: pl, error: e1 }, { data: vs, error: e2 }]) => {
      if (e1 || e2) console.error("Error cargando partidos o videos:", e1 || e2);
      setPartidos(pl || []);
      setVideos(vs || []);
      // Para mis partidos ya vencidos: ¿el rival cargó su video? (para poder avisarle)
      const hoy = hoyISO();
      const mios = (pl || []).filter(
        (p) => p.estado === "Jugado" && [p.local_club_id, p.visitante_club_id].includes(miClub) &&
          p.local_club_id && p.visitante_club_id && plazoVideo(p.fecha) < hoy
      );
      const res = {};
      await Promise.all(
        mios.map(async (p) => {
          const { data } = await supabase.rpc("rival_cargo_video", { p_partido_liga: p.id });
          res[p.id] = data;
        })
      );
      setRivalCargo(res);
    });
  }, [torneoId, miClub, recarga]);

  const estado = estados?.find((e) => e.torneo_id === torneoId);
  const videosPorPartido = useMemo(() => {
    const m = {};
    for (const v of videos) (m[v.partido_liga_id] ||= []).push(v);
    return m;
  }, [videos]);

  const misPartidos = partidos
    .filter((p) => p.estado === "Jugado" && [p.local_club_id, p.visitante_club_id].includes(miClub))
    .reverse();

  const proximo = partidos.find(
    (p) => p.estado === "Próximo" && [p.local_club_id, p.visitante_club_id].includes(miClub) && p.fecha >= hoyISO()
  );
  const rivalId = proximo ? (proximo.local_club_id === miClub ? proximo.visitante_club_id : proximo.local_club_id) : null;
  const rivalNombre = proximo ? (proximo.local_club_id === miClub ? proximo.visitante_nombre : proximo.local_nombre) : "";
  const ultimosDelRival = rivalId
    ? partidos
        .filter((p) => p.estado === "Jugado" && [p.local_club_id, p.visitante_club_id].includes(rivalId))
        .slice(-3)
        .reverse()
    : [];

  const otrosConVideo = partidos
    .filter(
      (p) => p.estado === "Jugado" && ![p.local_club_id, p.visitante_club_id].includes(miClub) &&
        (videosPorPartido[p.id] || []).some((v) => !v.sin_video)
    )
    .reverse();

  async function guardarVideo(partidoId, { youtubeId, sinVideo, motivo }) {
    setMensaje("");
    const fila = sinVideo
      ? { partido_liga_id: partidoId, youtube_id: null, sin_video: true, motivo_sin_video: motivo, cargado_por: perfil.id }
      : { partido_liga_id: partidoId, youtube_id: youtubeId, sin_video: false, motivo_sin_video: null, cargado_por: perfil.id };
    const { error } = await supabase.from("videos_partido").upsert(fila, { onConflict: "partido_liga_id,club_id" });
    if (error) {
      console.error("Error guardando video:", error);
      setMensaje("No se pudo guardar. Revisá el link e intentá de nuevo.");
      return false;
    }
    setRecarga((n) => n + 1);
    return true;
  }

  async function avisarRival(p) {
    const rival = p.local_club_id === miClub ? p.visitante_club_id : p.local_club_id;
    const { error } = await supabase.from("reportes_video").insert({ partido_liga_id: p.id, club_reportado: rival });
    setMensaje(error ? (error.code === "23505" ? "Ya habías avisado por este partido." : "No se pudo enviar el aviso.") : "Aviso enviado al club rival.");
  }

  async function cambiarCompartir(valor) {
    const { error } = await supabase.from("clubes").update({ comparte_videoteca: valor }).eq("id", club.id);
    if (error) setMensaje("No se pudo cambiar la configuración.");
    setRecarga((n) => n + 1);
  }

  if (!esStaff) {
    return (
      <div style={{ ...card, maxWidth: 520 }}>
        <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 6 }}>Videoteca</div>
        <div style={{ fontSize: 13, color: C.apagado }}>La videoteca es solo para el cuerpo técnico y el manager del club.</div>
      </div>
    );
  }
  if (estados === null) return <div style={{ color: C.apagado, fontSize: 13 }}>Cargando videoteca…</div>;
  if (estados.length === 0) {
    return (
      <div style={{ ...card, maxWidth: 560 }}>
        <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 6 }}>Videoteca</div>
        <div style={{ fontSize: 13, color: C.apagado }}>
          Tu club todavía no está inscripto en ningún torneo de ADN Sports. Cuando lo esté, acá vas a ver el fixture
          y vas a poder cargar y mirar videos de partidos.
        </div>
      </div>
    );
  }

  const esDivision = estado?.videoteca === "division";
  const reglaTexto = {
    division: "Videoteca compartida con la división. Para ver la de otros clubes, tu club tiene que compartir y estar al día con sus videos.",
    participantes: "Juveniles: cada video lo ven solo los dos clubes que jugaron ese partido.",
    privada: "Videoteca privada: solo tu club ve sus videos.",
  }[estado?.videoteca];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      {/* Torneos */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {estados.map((e) => (
          <button
            key={e.torneo_id}
            type="button"
            onClick={() => setTorneoId(e.torneo_id)}
            style={{ ...boton, ...(e.torneo_id === torneoId ? { background: "#1d1a0c", color: C.acento, borderColor: "#3a3215" } : {}) }}
          >
            {e.torneo}
          </button>
        ))}
      </div>

      {/* Estado del club */}
      {estado && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontSize: 15, color: C.texto, fontWeight: 600 }}>Estado de tu videoteca</div>
            {esDivision &&
              (estado.con_acceso ? <Etiqueta color={C.ok}>Con acceso a la división</Etiqueta> : <Etiqueta color={C.error}>Sin acceso a la división</Etiqueta>)}
          </div>
          <div style={{ fontSize: 12.5, color: C.apagado, marginBottom: 10 }}>{reglaTexto}</div>
          {esDivision && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Etiqueta color={estado.vencidos > 0 ? C.error : C.suave}>
                {estado.vencidos > 0 ? `${estado.vencidos} video${estado.vencidos > 1 ? "s" : ""} vencido${estado.vencidos > 1 ? "s" : ""}` : "Videos al día"}
              </Etiqueta>
              <Etiqueta color={estado.sin_video_usados > estado.max_sin_video ? C.error : C.suave}>
                Partidos sin video: {estado.sin_video_usados} de {estado.max_sin_video}
              </Etiqueta>
              {!estado.comparte && <Etiqueta color={C.error}>Tu club no comparte</Etiqueta>}
            </div>
          )}
          {esDivision && esManager && club && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 13, color: C.suave, cursor: "pointer" }}>
              <input type="checkbox" checked={!!club.comparte_videoteca} onChange={(e) => cambiarCompartir(e.target.checked)} style={{ width: 18, height: 18 }} />
              Compartir los videos de Primera con la división (si se desactiva, el club tampoco ve los de los demás)
            </label>
          )}
        </div>
      )}

      {mensaje && <div style={{ fontSize: 13, color: C.alerta }}>{mensaje}</div>}

      {/* Próximo rival */}
      {esDivision && proximo && (
        <div style={card}>
          <div style={{ fontSize: 15, color: C.texto, fontWeight: 600 }}>Próximo rival: {rivalNombre}</div>
          <div style={{ fontSize: 12.5, color: C.apagado, marginBottom: 12 }}>
            {fechaCorta(proximo.fecha)} · {proximo.local_club_id === miClub ? "Local" : "Visitante"} · sus últimos 3 partidos
          </div>
          {!rivalId && <div style={{ fontSize: 13, color: C.apagado }}>Este rival todavía no usa ADN Sports, así que no hay videos compartidos.</div>}
          {rivalId && !estado?.con_acceso && (
            <div style={{ fontSize: 13, color: C.alerta }}>Poné tu videoteca al día para ver los videos del rival.</div>
          )}
          {rivalId && estado?.con_acceso && ultimosDelRival.length === 0 && (
            <div style={{ fontSize: 13, color: C.apagado }}>Todavía no jugó partidos en este torneo.</div>
          )}
          {rivalId && estado?.con_acceso && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ultimosDelRival.map((p) => {
                const vs = (videosPorPartido[p.id] || []).filter((v) => !v.sin_video);
                return (
                  <div key={p.id} style={{ borderTop: `1px solid ${C.borde}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 13.5, color: C.texto, marginBottom: 8 }}>
                      {fechaCorta(p.fecha)} · {nombrePartido(p)}
                    </div>
                    {vs.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: C.apagado }}>Sin video disponible.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {vs.map((v) => (
                          <Reproductor key={v.id} youtubeId={v.youtube_id} titulo={nombrePartido(p)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mis partidos: cargar video */}
      <div style={card}>
        <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 4 }}>Videos de tus partidos</div>
        <div style={{ fontSize: 12.5, color: C.apagado, marginBottom: 12 }}>
          Subí el partido a YouTube como "No listado" y pegá el link. Plazo: hasta el miércoles siguiente al partido.
        </div>
        {misPartidos.length === 0 && <div style={{ fontSize: 13, color: C.apagado }}>Todavía no hay partidos jugados.</div>}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {misPartidos.map((p) => (
            <FilaMiPartido
              key={p.id}
              partido={p}
              miVideo={(videosPorPartido[p.id] || []).find((v) => v.club_id === miClub)}
              rivalCargo={rivalCargo[p.id]}
              onGuardar={guardarVideo}
              onAvisar={() => avisarRival(p)}
            />
          ))}
        </div>
      </div>

      {/* Videoteca de la división */}
      {esDivision && estado?.con_acceso && (
        <div style={card}>
          <div style={{ fontSize: 15, color: C.texto, fontWeight: 600, marginBottom: 12 }}>Videoteca de la división</div>
          {otrosConVideo.length === 0 && <div style={{ fontSize: 13, color: C.apagado }}>Todavía no hay videos de otros partidos.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {otrosConVideo.map((p) => (
              <div key={p.id} style={{ borderTop: `1px solid ${C.borde}`, paddingTop: 12 }}>
                <div style={{ fontSize: 13.5, color: C.texto, marginBottom: 8 }}>
                  {fechaCorta(p.fecha)} · {nombrePartido(p)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(videosPorPartido[p.id] || []).filter((v) => !v.sin_video).map((v) => (
                    <Reproductor key={v.id} youtubeId={v.youtube_id} titulo={nombrePartido(p)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilaMiPartido({ partido, miVideo, rivalCargo, onGuardar, onAvisar }) {
  const [editando, setEditando] = useState(false);
  const [link, setLink] = useState("");
  const [modoSinVideo, setModoSinVideo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  const plazo = plazoVideo(partido.fecha);
  const vencido = !miVideo && plazo < hoyISO();
  const idDetectado = extraerYoutubeId(link);

  async function guardar() {
    setError("");
    if (modoSinVideo) {
      if (!motivo.trim()) return setError("Contá brevemente por qué no hay video.");
      if (await onGuardar(partido.id, { sinVideo: true, motivo: motivo.trim() })) setEditando(false);
    } else {
      if (!idDetectado) return setError("No reconozco ese link de YouTube.");
      if (await onGuardar(partido.id, { youtubeId: idDetectado })) setEditando(false);
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${C.borde}`, padding: "12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: C.texto }}>
          {fechaCorta(partido.fecha)} · {nombrePartido(partido)}
        </div>
        {miVideo?.sin_video ? (
          <Etiqueta color={C.alerta}>Sin video</Etiqueta>
        ) : miVideo ? (
          <Etiqueta color={C.ok}>Cargado</Etiqueta>
        ) : vencido ? (
          <Etiqueta color={C.error}>Vencido ({fechaCorta(plazo)})</Etiqueta>
        ) : (
          <Etiqueta color={C.suave}>Pendiente · hasta el {fechaCorta(plazo)}</Etiqueta>
        )}
      </div>

      {miVideo?.sin_video && <div style={{ fontSize: 12.5, color: C.apagado }}>Motivo: {miVideo.motivo_sin_video}</div>}
      {miVideo && !miVideo.sin_video && !editando && <Reproductor youtubeId={miVideo.youtube_id} titulo={nombrePartido(partido)} />}

      {!editando ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={miVideo ? boton : botonPrincipal} onClick={() => { setEditando(true); setModoSinVideo(false); }}>
            {miVideo ? "Cambiar" : "Cargar video"}
          </button>
          {rivalCargo === false && (
            <button type="button" style={boton} onClick={onAvisar}>
              Avisar al rival que falta su video
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!modoSinVideo ? (
            <>
              <label style={{ fontSize: 12, color: C.apagado }} htmlFor={`link-${partido.id}`}>Link de YouTube</label>
              <input id={`link-${partido.id}`} style={input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/…" />
            </>
          ) : (
            <>
              <label style={{ fontSize: 12, color: C.apagado }} htmlFor={`motivo-${partido.id}`}>¿Por qué no hay video?</label>
              <input id={`motivo-${partido.id}`} style={input} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Falla de cámara, lluvia…" />
              <div style={{ fontSize: 12, color: C.alerta }}>Cada club puede marcar hasta 2 partidos sin video por temporada sin perder el acceso.</div>
            </>
          )}
          {error && <div style={{ fontSize: 12.5, color: C.error }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={botonPrincipal} onClick={guardar}>Guardar</button>
            <button type="button" style={boton} onClick={() => setModoSinVideo((v) => !v)}>
              {modoSinVideo ? "Tengo el video" : "No hay video"}
            </button>
            <button type="button" style={boton} onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
