import React, { useEffect, useMemo, useState } from "react";
import { CLUB, JUGADORES, PARTIDOS, TABLA, VIDEOS_RIVAL, SESION_HOY, wellnessHoy, wellnessDia, tendencia } from "./datos";
import { MENSAJE_URL } from "../config";

// Demo del Hub con un club ficticio. Todo vive en memoria: nada se guarda ni se envía.
const embebida = new URLSearchParams(window.location.search).has("embed");

const SECCIONES = [
  { key: "hoy", label: "Hoy", icono: "M4 5h16v15H4zM4 9h16M9 3v4M15 3v4" },
  { key: "plantel", label: "Plantel", icono: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M18 15c2 .6 4 2.2 4 5" },
  { key: "wellness", label: "Wellness", icono: "M3 12h4l3-7 4 14 3-7h4" },
  { key: "partidos", label: "Partidos", icono: "M12 3c4 3 6 6 6 9s-2 6-6 9c-4-3-6-6-6-9s2-6 6-9zM9 9l6 6M15 9l-6 6" },
  { key: "matchday", label: "Matchday", icono: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M10 2h4" },
  { key: "videoteca", label: "Videoteca", corto: "Video", icono: "M3 6h13v12H3zM16 10l5-3v10l-5-3" },
  { key: "gps", label: "GPS", icono: "M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
];

function Icono({ d, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const colorEstado = { Disponible: "var(--d-ok)", "A vigilar": "var(--d-alerta)", Lesionado: "var(--d-error)" };
function colorWellness(v) {
  return v >= 70 ? "var(--d-ok)" : v >= 55 ? "var(--d-alerta)" : "var(--d-error)";
}

export default function Demo() {
  const [seccion, setSeccion] = useState("hoy");
  const [jugadorId, setJugadorId] = useState(null);
  const jugador = JUGADORES.find((j) => j.id === jugadorId);

  function ir(key) {
    setSeccion(key);
    setJugadorId(null);
    document.querySelector(".d-main")?.scrollTo?.({ top: 0 });
  }

  return (
    <div className={`d-app${embebida ? " d-embed" : ""}`}>
      {!embebida && (
        <div className="d-aviso">
          <a href="/" className="d-aviso-marca" aria-label="Volver a ADN Sports">
            <img src="/icon.svg" alt="" width="26" height="26" />
            <span>ADN Sports</span>
          </a>
          <span className="d-aviso-txt">Demo con un club y datos ficticios. Tocá todo lo que quieras.</span>
          <a className="d-aviso-btn" href={MENSAJE_URL} target="_blank" rel="noreferrer">Quiero un Hub para mi club</a>
        </div>
      )}
      <div className="d-cuerpo">
        <nav className="d-lateral" aria-label="Secciones del Hub">
          <div className="d-club">
            <span className="d-escudo" style={{ background: CLUB.color }}>{CLUB.siglas}</span>
            <span>{CLUB.nombre}</span>
          </div>
          {SECCIONES.map((s) => (
            <button key={s.key} type="button" className={`d-nav${seccion === s.key ? " activo" : ""}`} aria-current={seccion === s.key ? "page" : undefined} onClick={() => ir(s.key)}>
              <Icono d={s.icono} />
              {s.label}
            </button>
          ))}
        </nav>
        <main className="d-main">
          {jugador ? (
            <Ficha j={jugador} onVolver={() => setJugadorId(null)} />
          ) : seccion === "hoy" ? (
            <Hoy ir={ir} verJugador={setJugadorId} />
          ) : seccion === "plantel" ? (
            <Plantel verJugador={setJugadorId} />
          ) : seccion === "wellness" ? (
            <Wellness verJugador={setJugadorId} />
          ) : seccion === "partidos" ? (
            <Partidos ir={ir} />
          ) : seccion === "matchday" ? (
            <Matchday />
          ) : seccion === "videoteca" ? (
            <Videoteca />
          ) : (
            <Gps verJugador={setJugadorId} />
          )}
        </main>
      </div>
      <nav className="d-inferior" aria-label="Secciones del Hub">
        {SECCIONES.map((s) => (
          <button key={s.key} type="button" className={`d-inf${seccion === s.key ? " activo" : ""}`} aria-current={seccion === s.key ? "page" : undefined} onClick={() => ir(s.key)}>
            <Icono d={s.icono} size={22} />
            <span>{s.corto || s.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Encabezado({ titulo, sub }) {
  return (
    <header className="d-enc">
      <h1>{titulo}</h1>
      {sub && <p>{sub}</p>}
    </header>
  );
}

function Fila({ j, children, onClick }) {
  return (
    <button type="button" className="d-fila" onClick={onClick}>
      <span className="d-avatar">{j.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
      <span className="d-fila-txt">
        <span className="d-fila-nombre">{j.nombre}</span>
        <span className="d-fila-sub">{j.puesto}</span>
      </span>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Hoy
function Hoy({ ir, verJugador }) {
  const disponibles = JUGADORES.filter((j) => j.estado === "Disponible").length;
  const respondieron = JUGADORES.filter((j) => j.respondioHoy).length;
  const alertas = JUGADORES.filter((j) => j.estado === "Disponible" && j.respondioHoy && (wellnessHoy(j) < 50 || tendencia(j) <= -20));
  const proximo = PARTIDOS.find((p) => p.gf === null);

  return (
    <>
      <Encabezado titulo="Martes" sub="Entrenamiento 19:30 · Cancha 2" />
      <div className="d-grilla">
        <button type="button" className="d-tarjeta d-dato" onClick={() => ir("plantel")}>
          <span className="d-dato-n">{disponibles}<small>/{JUGADORES.length}</small></span>
          <span>Disponibles para el sábado</span>
        </button>
        <button type="button" className="d-tarjeta d-dato" onClick={() => ir("wellness")}>
          <span className="d-dato-n">{respondieron}<small>/{JUGADORES.length}</small></span>
          <span>Completaron el wellness</span>
        </button>
      </div>

      <section className="d-tarjeta">
        <h2>Próximo partido</h2>
        <div className="d-partido">
          <span className="d-escudo grande" style={{ background: CLUB.color }}>{CLUB.siglas}</span>
          <div>
            <div className="d-partido-vs">vs {proximo.rival}</div>
            <div className="d-sub">Sábado {proximo.fecha} · 15:30 · {proximo.condicion}</div>
          </div>
        </div>
        <div className="d-links">
          <button type="button" className="d-link" onClick={() => ir("videoteca")}>Ver sus últimos 3 partidos</button>
          <button type="button" className="d-link" onClick={() => ir("matchday")}>Probar el Matchday</button>
        </div>
      </section>

      <section className="d-tarjeta">
        <h2>Para mirar hoy</h2>
        {alertas.map((j) => (
          <Fila key={j.id} j={j} onClick={() => verJugador(j.id)}>
            <span className="d-chip" style={{ color: "var(--d-error)" }}>Wellness {wellnessHoy(j)}%</span>
          </Fila>
        ))}
        {JUGADORES.filter((j) => j.estado !== "Disponible").map((j) => (
          <Fila key={j.id} j={j} onClick={() => verJugador(j.id)}>
            <span className="d-chip" style={{ color: colorEstado[j.estado] }}>{j.estado}</span>
          </Fila>
        ))}
      </section>

      <section className="d-tarjeta">
        <h2>Sesión de hoy</h2>
        <ol className="d-sesion">
          {SESION_HOY.map((b) => (
            <li key={b.hora}>
              <span className="d-hora">{b.hora}</span>
              <span>{b.bloque}</span>
              <span className="d-sub">{b.min}′</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ Plantel
function Plantel({ verJugador }) {
  const [filtro, setFiltro] = useState("Todos");
  const lista = JUGADORES.filter((j) => filtro === "Todos" || j.linea === filtro || j.estado === filtro);
  return (
    <>
      <Encabezado titulo="Plantel" sub={`${JUGADORES.length} jugadores · Primera`} />
      <div className="d-filtros" role="group" aria-label="Filtrar plantel">
        {["Todos", "Forwards", "Backs", "Lesionado", "A vigilar"].map((f) => (
          <button key={f} type="button" className={`d-filtro${filtro === f ? " activo" : ""}`} aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
            {f === "Lesionado" ? "Lesionados" : f}
          </button>
        ))}
      </div>
      <section className="d-tarjeta d-lista">
        {lista.map((j) => (
          <Fila key={j.id} j={j} onClick={() => verJugador(j.id)}>
            <span className="d-punto" style={{ background: colorEstado[j.estado] }} title={j.estado} />
          </Fila>
        ))}
      </section>
    </>
  );
}

// ------------------------------------------------------------------ Ficha
function Ficha({ j, onVolver }) {
  const dias = ["Mié", "Jue", "Vie", "Sáb", "Dom", "Lun", "Mar"];
  return (
    <>
      <button type="button" className="d-volver" onClick={onVolver}>‹ Volver</button>
      <header className="d-ficha">
        <span className="d-avatar grande">{j.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
        <div>
          <h1>{j.nombre}</h1>
          <p>{j.puesto} · {j.edad} años</p>
          <span className="d-chip" style={{ color: colorEstado[j.estado] }}>{j.estado}</span>
        </div>
      </header>
      {j.lesion && (
        <section className="d-tarjeta">
          <h2>Cuerpo médico</h2>
          <p className="d-txt">{j.lesion.zona}: {j.lesion.vuelve}.</p>
        </section>
      )}
      <div className="d-grilla tres">
        <div className="d-tarjeta d-dato"><span className="d-dato-n">{j.altura}<small> cm</small></span><span>Altura</span></div>
        <div className="d-tarjeta d-dato"><span className="d-dato-n">{j.peso}<small> kg</small></span><span>Peso</span></div>
        <div className="d-tarjeta d-dato"><span className="d-dato-n">{j.asistencia}<small>%</small></span><span>Asistencia</span></div>
      </div>
      <section className="d-tarjeta">
        <h2>Wellness, últimos 7 días</h2>
        <div className="d-barras" role="img" aria-label={`Wellness de los últimos 7 días: ${j.semana.map(wellnessDia).join(", ")} por ciento`}>
          {j.semana.map((d, i) => {
            const v = wellnessDia(d);
            return (
              <div key={i} className="d-barra">
                <span className="d-barra-v">{v}</span>
                <span className="d-barra-col" style={{ height: `${v}%`, background: colorWellness(v) }} />
                <span className="d-sub">{dias[i]}</span>
              </div>
            );
          })}
        </div>
      </section>
      {j.gps.minutos > 0 && (
        <section className="d-tarjeta">
          <h2>GPS, último partido</h2>
          <div className="d-grilla tres sin-borde">
            <div className="d-dato"><span className="d-dato-n">{(j.gps.distancia / 1000).toFixed(1)}<small> km</small></span><span>Distancia</span></div>
            <div className="d-dato"><span className="d-dato-n">{j.gps.altaInt}<small> m</small></span><span>Alta intensidad</span></div>
            <div className="d-dato"><span className="d-dato-n">{j.gps.velMax}<small> km/h</small></span><span>Velocidad máx.</span></div>
          </div>
        </section>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Wellness
function Wellness({ verJugador }) {
  const [orden, setOrden] = useState("peor");
  const respondieron = JUGADORES.filter((j) => j.respondioHoy);
  const faltan = JUGADORES.filter((j) => !j.respondioHoy);
  const lista = useMemo(
    () => [...respondieron].sort((a, b) => (orden === "peor" ? wellnessHoy(a) - wellnessHoy(b) : a.nombre.localeCompare(b.nombre))),
    [orden]
  );
  const prom = Math.round(respondieron.reduce((s, j) => s + wellnessHoy(j), 0) / respondieron.length);
  return (
    <>
      <Encabezado titulo="Wellness de hoy" sub={`${respondieron.length} de ${JUGADORES.length} respondieron · promedio ${prom}%`} />
      <div className="d-filtros" role="group" aria-label="Ordenar">
        <button type="button" className={`d-filtro${orden === "peor" ? " activo" : ""}`} aria-pressed={orden === "peor"} onClick={() => setOrden("peor")}>Peor primero</button>
        <button type="button" className={`d-filtro${orden === "az" ? " activo" : ""}`} aria-pressed={orden === "az"} onClick={() => setOrden("az")}>Por nombre</button>
      </div>
      <section className="d-tarjeta d-lista">
        <div className="d-wl-enc" aria-hidden="true"><span /><span>Sueño</span><span>Estrés</span><span>Dolor</span><span>Fatiga</span><span>Total</span></div>
        {lista.map((j) => {
          const d = j.semana[6];
          const t = wellnessHoy(j);
          return (
            <button key={j.id} type="button" className="d-wl" onClick={() => verJugador(j.id)}>
              <span className="d-fila-nombre">{j.nombre}</span>
              {[d.sueno, d.estres, d.dolor, d.fatiga].map((v, i) => (
                <span key={i} className="d-wl-v" style={{ color: v <= 3 ? "var(--d-error)" : v <= 4 ? "var(--d-alerta)" : "var(--d-texto)" }}>{v}</span>
              ))}
              <span className="d-wl-t" style={{ background: colorWellness(t) }}>{t}%</span>
            </button>
          );
        })}
      </section>
      <section className="d-tarjeta">
        <h2>Faltan responder ({faltan.length})</h2>
        <p className="d-txt">{faltan.map((j) => j.nombre).join(", ")}.</p>
        <p className="d-sub">En un Hub real les llega un recordatorio al celular.</p>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ Partidos
function Partidos({ ir }) {
  return (
    <>
      <Encabezado titulo="Partidos" sub="Torneo de ejemplo · Primera" />
      <section className="d-tarjeta d-lista">
        {[...PARTIDOS].reverse().map((p) => {
          const res = p.gf === null ? "Próximo" : p.gf > p.gc ? "Ganado" : p.gf < p.gc ? "Perdido" : "Empate";
          const color = { Ganado: "var(--d-ok)", Perdido: "var(--d-error)", Empate: "var(--d-alerta)", Próximo: "var(--d-sub)" }[res];
          return (
            <div key={p.fecha} className="d-pt">
              <span className="d-sub">{p.fecha}</span>
              <span className="d-pt-rival">{p.condicion === "Local" ? "vs" : "en"} {p.rival}</span>
              <span className="d-pt-res">{p.gf === null ? "Sáb 15:30" : `${p.gf} – ${p.gc}`}</span>
              <span className="d-chip" style={{ color }}>{res}</span>
            </div>
          );
        })}
      </section>
      <section className="d-tarjeta">
        <h2>Posiciones</h2>
        <div className="d-tabla-scroll">
          <table className="d-tabla">
            <thead>
              <tr><th scope="col">Equipo</th><th scope="col">PJ</th><th scope="col">G</th><th scope="col">E</th><th scope="col">P</th><th scope="col">Dif</th><th scope="col">Pts</th></tr>
            </thead>
            <tbody>
              {TABLA.map((t) => (
                <tr key={t.equipo} className={t.propio ? "propio" : ""}>
                  <td>{t.equipo}</td><td>{t.pj}</td><td>{t.g}</td><td>{t.e}</td><td>{t.p}</td><td>{t.pf - t.pc > 0 ? "+" : ""}{t.pf - t.pc}</td><td><b>{t.pts}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="d-sub">Cuando los dos clubes tienen su Hub, el resultado se carga una sola vez y aparece en los dos.</p>
      </section>
      <button type="button" className="d-tarjeta d-cta-md" onClick={() => ir("matchday")}>
        <span className="d-vivo">● Sábado: día de partido</span>
        <b>Abrir el Matchday vs Atlético Llanura</b>
        <span className="d-sub">Reloj, marcador, tarjetas y registro del partido en vivo.</span>
      </button>
    </>
  );
}

// ------------------------------------------------------------------ Matchday
const reloj = (seg) => `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
const apellido = (j) => j.nombre.split(" ").slice(1).join(" ");

function Matchday() {
  const rival = PARTIDOS.find((p) => p.gf === null).rival;
  const titulares = useMemo(() => JUGADORES.filter((j) => j.estado === "Disponible").slice(0, 15), []);
  const [seg, setSeg] = useState(0);
  const [corre, setCorre] = useState(false);
  const [gf, setGf] = useState(0);
  const [gc, setGc] = useState(0);
  const [pendiente, setPendiente] = useState(null);
  const [eligiendo, setEligiendo] = useState(null);
  const [afuera, setAfuera] = useState({});
  const [expulsados, setExpulsados] = useState([]);
  const [registro, setRegistro] = useState([]);
  const [terminado, setTerminado] = useState(false);

  useEffect(() => {
    if (!corre) return undefined;
    const t = setInterval(() => {
      setSeg((s) => s + 1);
      setAfuera((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v > 1).map(([k, v]) => [k, v - 1])));
    }, 1000);
    return () => clearInterval(t);
  }, [corre]);

  const anotar = (texto, extra = {}) =>
    setRegistro((r) => [{ id: Date.now() + Math.random(), min: Math.floor(seg / 60), texto, ...extra }, ...r]);

  function resolver(convierte) {
    const { equipo, tipo } = pendiente;
    const pts = tipo === "Try" ? (convierte ? 7 : 5) : convierte ? 3 : 0;
    if (equipo === "club") setGf((v) => v + pts);
    else setGc((v) => v + pts);
    const nombre = equipo === "club" ? CLUB.corto : rival;
    const detalle = tipo === "Try" ? (convierte ? "convertido" : "sin convertir") : convierte ? "adentro" : "errado";
    anotar(`${nombre}: ${tipo.toLowerCase()} ${detalle}`, { equipo, puntos: pts, tipo });
    setPendiente(null);
  }

  function tarjeta(j) {
    const n = apellido(j);
    if (eligiendo === "amarilla") {
      setAfuera((a) => ({ ...a, [n]: 600 }));
      anotar(`🟨 ${n}: amarilla, 10 minutos afuera`);
    } else {
      setExpulsados((e) => [...e, n]);
      anotar(`🟥 ${n}: roja, no vuelve a entrar`);
    }
    setEligiendo(null);
  }

  function borrar(i) {
    if (i.puntos) (i.equipo === "club" ? setGf : setGc)((v) => Math.max(0, v - i.puntos));
    setRegistro((r) => r.filter((x) => x.id !== i.id));
  }

  if (terminado) {
    const tries = (eq) => registro.filter((i) => i.equipo === eq && i.tipo === "Try").length;
    return (
      <>
        <Encabezado titulo="Partido finalizado" sub={`${CLUB.corto} vs ${rival}`} />
        <section className="d-tarjeta d-md-fin">
          <div className="d-md-res">{gf} – {gc}</div>
          <p className="d-sub">Tries: {tries("club")} a {tries("rival")} · Tarjetas: {registro.filter((i) => /^🟨|^🟥/.test(i.texto)).length} · Duración: {reloj(seg)}</p>
          <p className="d-txt">En un Hub real, el resultado se guarda en el calendario, el minuto de cada try pasa al análisis del partido y las tarjetas quedan en la ficha de cada jugador.</p>
          <button type="button" className="d-filtro" onClick={() => { setTerminado(false); setSeg(0); setGf(0); setGc(0); setRegistro([]); setAfuera({}); setExpulsados([]); }}>Empezar otro partido</button>
        </section>
      </>
    );
  }

  return (
    <>
      <Encabezado titulo="Matchday" sub={`Primera · vs ${rival} · simulación`} />
      <section className="d-tarjeta d-md">
        <div className="d-md-marcador">
          <div className="d-md-eq"><span className="d-escudo grande" style={{ background: CLUB.color }}>{CLUB.siglas}</span><span>{CLUB.corto}</span></div>
          <div className="d-md-centro">
            <div className="d-md-res" aria-live="polite">{gf} – {gc}</div>
            <div className="d-md-reloj">{reloj(seg)}</div>
          </div>
          <div className="d-md-eq"><span className="d-escudo grande d-escudo-rival">AL</span><span>{rival}</span></div>
        </div>
        <div className="d-md-botones">
          <button type="button" className={`d-filtro${corre ? "" : " activo"}`} onClick={() => setCorre((c) => !c)}>{corre ? "Pausar" : seg ? "Reanudar" : "Empezar partido"}</button>
          <button type="button" className="d-filtro" onClick={() => { setCorre(false); setTerminado(true); }} disabled={!seg && !registro.length}>Finalizar</button>
        </div>
      </section>

      {pendiente ? (
        <section className="d-tarjeta d-md-pregunta">
          <b>{pendiente.equipo === "club" ? CLUB.corto : rival}: {pendiente.tipo}. ¿Convierte?</b>
          <div className="d-md-botones">
            <button type="button" className="d-filtro activo" onClick={() => resolver(true)}>Sí</button>
            <button type="button" className="d-filtro" onClick={() => resolver(false)}>No</button>
          </div>
        </section>
      ) : eligiendo ? (
        <section className="d-tarjeta d-md-pregunta">
          <b>{eligiendo === "amarilla" ? "🟨 ¿Quién recibe la amarilla?" : "🟥 ¿Quién recibe la roja?"}</b>
          <div className="d-md-jugadores">
            {titulares.map((j) => {
              const n = apellido(j);
              const bloqueado = expulsados.includes(n) || n in afuera;
              return <button key={j.id} type="button" className="d-filtro" disabled={bloqueado} onClick={() => tarjeta(j)}>{j.numero ? `${j.numero}. ` : ""}{n}</button>;
            })}
          </div>
          <button type="button" className="d-link" onClick={() => setEligiendo(null)}>Cancelar</button>
        </section>
      ) : (
        <div className="d-md-acciones">
          {[["club", CLUB.corto], ["rival", rival]].map(([eq, nombre]) => (
            <section key={eq} className="d-tarjeta">
              <h2>{nombre}</h2>
              {["Try", "Penal", "Drop"].map((t) => (
                <button key={t} type="button" className={`d-md-accion ${eq}`} onClick={() => setPendiente({ equipo: eq, tipo: t })}>+ {t}</button>
              ))}
            </section>
          ))}
          <section className="d-tarjeta">
            <h2>Tarjetas</h2>
            <button type="button" className="d-md-accion amarilla" onClick={() => setEligiendo("amarilla")}>Amarilla</button>
            <button type="button" className="d-md-accion roja" onClick={() => setEligiendo("roja")}>Roja</button>
          </section>
        </div>
      )}

      {(Object.keys(afuera).length > 0 || expulsados.length > 0) && (
        <section className="d-tarjeta">
          <h2>Afuera</h2>
          {Object.entries(afuera).map(([n, v]) => (
            <div key={n} className="d-md-afuera"><span>🟨 {n}</span><span className="d-md-cuenta">vuelve en {reloj(v)}</span></div>
          ))}
          {expulsados.map((n) => (
            <div key={n} className="d-md-afuera"><span>🟥 {n}</span><span className="d-sub">expulsado</span></div>
          ))}
        </section>
      )}

      <section className="d-tarjeta">
        <h2>Registro del partido</h2>
        {registro.length === 0 ? (
          <p className="d-sub">Tocá «Empezar partido» y cargá un try, un penal o una tarjeta. Cada acción queda con su minuto.</p>
        ) : (
          registro.map((i) => (
            <div key={i.id} className="d-md-log">
              <span className="d-hora">{i.min}′</span>
              <span>{i.texto}</span>
              <button type="button" className="d-md-borrar" onClick={() => borrar(i)} aria-label={`Borrar: ${i.texto}`}>×</button>
            </div>
          ))
        )}
      </section>
      <p className="d-sub d-pie">Lo carga una persona del staff desde el costado de la cancha. El resto del club ve el resultado al instante.</p>
    </>
  );
}

// ------------------------------------------------------------------ Videoteca
function Videoteca() {
  const [abierto, setAbierto] = useState(null);
  return (
    <>
      <Encabezado titulo="Videoteca" sub="Próximo rival: Atlético Llanura" />
      <section className="d-tarjeta d-estado-vt">
        <span className="d-punto" style={{ background: "var(--d-ok)" }} />
        <div>
          <b>Tu club está al día</b>
          <p className="d-sub">Subiste los videos de tus 6 partidos, así que ves la videoteca de toda la división.</p>
        </div>
      </section>
      {VIDEOS_RIVAL.map((v, i) => (
        <section key={v.fecha} className="d-tarjeta d-video">
          <button type="button" className="d-video-play" onClick={() => setAbierto(abierto === i ? null : i)} aria-expanded={abierto === i}>
            <span className="d-video-cancha" aria-hidden="true">
              <svg viewBox="0 0 160 90" width="100%" height="100%" preserveAspectRatio="none">
                <rect width="160" height="90" fill="#1d4d36" />
                {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <rect key={k} x={k * 20} width="10" height="90" fill="#22573d" />)}
                <g stroke="#e8efe9" strokeWidth=".8" fill="none" opacity=".8"><rect x="8" y="6" width="144" height="78" /><line x1="80" y1="6" x2="80" y2="84" /><line x1="44" y1="6" x2="44" y2="84" strokeDasharray="3 3" /><line x1="116" y1="6" x2="116" y2="84" strokeDasharray="3 3" /></g>
              </svg>
              <span className="d-video-icono">▶</span>
            </span>
            <span className="d-video-info">
              <b>{v.partido}</b>
              <span className="d-sub">{v.fecha} · {v.duracion}</span>
            </span>
          </button>
          {abierto === i && (
            <p className="d-txt d-video-nota">En un Hub real acá se reproduce el partido completo desde YouTube, sin salir de la app. Solo lo ve el cuerpo técnico.</p>
          )}
        </section>
      ))}
      <p className="d-sub d-pie">Primera: compartida con la división, solo si tu club también comparte. Juveniles: cada video lo ven solo los dos clubes que jugaron.</p>
    </>
  );
}

// ------------------------------------------------------------------ GPS
function Gps({ verJugador }) {
  const [metrica, setMetrica] = useState("distancia");
  const M = {
    distancia: { label: "Distancia", fmt: (v) => `${(v / 1000).toFixed(2)} km` },
    altaInt: { label: "Alta intensidad", fmt: (v) => `${v} m` },
    velMax: { label: "Velocidad máx.", fmt: (v) => `${v} km/h` },
    sprints: { label: "Sprints", fmt: (v) => `${v}` },
  };
  const lista = JUGADORES.filter((j) => j.gps.minutos > 0).sort((a, b) => b.gps[metrica] - a.gps[metrica]);
  const max = Math.max(...lista.map((j) => j.gps[metrica]));
  return (
    <>
      <Encabezado titulo="GPS" sub="Último partido · vs Club Puerto Viejo" />
      <div className="d-filtros" role="group" aria-label="Métrica">
        {Object.entries(M).map(([k, m]) => (
          <button key={k} type="button" className={`d-filtro${metrica === k ? " activo" : ""}`} aria-pressed={metrica === k} onClick={() => setMetrica(k)}>{m.label}</button>
        ))}
      </div>
      <section className="d-tarjeta d-lista">
        {lista.map((j) => (
          <button key={j.id} type="button" className="d-gps" onClick={() => verJugador(j.id)}>
            <span className="d-gps-nombre">
              <span className="d-fila-nombre">{j.nombre}</span>
              <span className="d-sub">{j.gps.minutos}′ · {j.linea}</span>
            </span>
            <span className="d-gps-barra"><span style={{ width: `${(j.gps[metrica] / max) * 100}%` }} /></span>
            <span className="d-gps-v">{M[metrica].fmt(j.gps[metrica])}</span>
          </button>
        ))}
      </section>
    </>
  );
}
