import React, { useEffect, useState } from "react";
import { PLANES, MENSAJE_URL, INSTAGRAM, INSTAGRAM_URL } from "./config";

function Helice({ size = 64 }) {
  return (
    <svg width={size * 0.5} height={size} viewBox="-6 -6 92 172" aria-hidden="true">
      <path d="M10 0 C10 40 70 40 70 80 C70 120 10 120 10 160" fill="none" stroke="#0E1620" strokeWidth="12" strokeLinecap="round" />
      <path d="M70 0 C70 40 10 40 10 80 C10 120 70 120 70 160" fill="none" stroke="#F4F2EE" strokeWidth="12" strokeLinecap="round" />
      {[24, 56, 104, 136].map((y) => (
        <line key={y} x1="20" y1={y} x2="60" y2={y} stroke="#0E1620" strokeWidth="6" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function Insignia({ size = 44 }) {
  return (
    <span className="insignia" style={{ width: size, height: size }}>
      <Helice size={size * 0.66} />
    </span>
  );
}

function Marca() {
  return (
    <a href="/" className="marca" aria-label="ADN Sports, inicio">
      <Insignia size={42} />
      <span className="marca-txt">
        <span className="marca-adn">ADN</span>
        <span className="marca-sports">Sports</span>
      </span>
    </a>
  );
}

// Dólar oficial del Banco Nación (vendedor), para mostrar el precio aproximado en pesos
function useDolar() {
  const [dolar, setDolar] = useState(null);
  useEffect(() => {
    fetch("https://dolarapi.com/v1/dolares/oficial")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.venta && setDolar(d))
      .catch(() => {});
  }, []);
  return dolar;
}

const pesos = (n) => "$ " + Math.round(n).toLocaleString("es-AR");

const ANTES = [
  "Un grupo de WhatsApp para preguntar quién está para el fin de semana",
  "Un Excel con pesos y alturas que nadie actualiza desde marzo",
  "La lista de asistencia en un papel que se moja en el vestuario",
  "El video del partido en el celular de alguien que no contesta",
  "El resultado y las tarjetas anotados en un papel al costado de la cancha",
];
const CON_HUB = [
  "El plantel con su estado: disponible, a vigilar o lesionado",
  "El wellness de cada jugador antes de entrenar o jugar",
  "Asistencia, sesiones y plan de gimnasio en el mismo lugar",
  "El partido cargado en vivo y el informe listo al terminar",
  "Los partidos de tu club y los de tu próximo rival, a un toque",
];

const MOMENTOS = [
  {
    titulo: "Durante la semana",
    modulos: [
      ["Plantel y disponibilidad", "Puestos, datos físicos y estado de cada jugador, con los puestos de tu deporte. Sabés quién está disponible sin preguntar."],
      ["Wellness diario", "Cuatro preguntas que el jugador responde en 20 segundos desde el celular. El staff ve las alertas al instante."],
      ["Sesiones y gimnasio", "La sesión del día, el plan de gimnasio de cada jugador y quién vino a cada entrenamiento."],
      ["Evaluaciones físicas", "Los tests del preparador físico, con el último resultado siempre a mano en la ficha del jugador."],
      ["Cuerpo médico y Return to Play", "Lesiones, tiempos de vuelta, alta médica e historial. Solo lo ve quien tiene que verlo."],
    ],
  },
  {
    titulo: "El día del partido",
    modulos: [
      ["Equipos", "Titulares y suplentes armados sobre la formación de tu deporte, con los disponibles de la semana."],
      ["Matchday en vivo", "Reloj, marcador, tries, penales y tarjetas cargados desde el costado de la cancha. Avisa cuándo vuelve cada amonestado y el club ve el resultado al instante."],
      ["Avisos", "Notificaciones al celular: wellness abierto, video nuevo, resultado cargado."],
    ],
  },
  {
    titulo: "Después del partido",
    modulos: [
      ["Informe de partido", "Estadísticas del equipo y de cada jugador. Lo que se cargó en el Matchday ya está adentro."],
      ["Análisis de video", "Mientras mirás el partido, marcás posesión, territorio y obtención. La app calcula sola el tiempo de juego efectivo y las secuencias."],
      ["Videoteca", "Los partidos de tu club y los del próximo rival, sin salir de la app."],
      ["GPS", "Si tu club usa GPS, distancia, alta intensidad y velocidad por jugador en cada partido y entrenamiento."],
      ["Reportes individuales", "Cualidades físicas, estadísticas de la temporada e historial médico de cada jugador en una sola página."],
    ],
  },
];

const PASOS = [
  ["Nos escribís", "Por mensaje directo en Instagram. Vemos qué deporte y qué categorías tiene tu club, y qué módulos necesitás."],
  ["Armamos tu Hub", "Con el nombre, el escudo y los colores de tu club. Cargamos el plantel y le explicamos al staff cómo usarlo."],
  ["Pagás con Mercado Pago", "Elegís el plan mensual o el anual. Se paga en pesos, al dólar oficial del Banco Nación del día del pago."],
];

const DEPORTES = [
  ["Rugby", "Donde nació nuestro primer Hub. Puestos del 1 al 15, formaciones y análisis de partido."],
  ["Hockey", "Plantel por línea, rotaciones, córners cortos y carga de partido."],
  ["Fútbol", "Esquemas tácticos, minutos jugados, tarjetas y carga semanal."],
  ["Básquet", "Rotaciones, minutos, estadísticas por cuarto y carga en temporada larga."],
];

const PREGUNTAS = [
  ["¿Sirve para mi deporte?", "Sí. Wellness, asistencia, sesiones, cuerpo médico, videoteca y avisos funcionan igual en cualquier deporte. Lo que cambia según el deporte (puestos, formación, estadísticas del partido) lo adaptamos para tu club durante la puesta en marcha."],
  ["¿Quién ve los datos de mi club?", "Solo las personas de tu club, según su rol: el jugador ve lo suyo, el cuerpo médico ve las lesiones y el staff ve el plantel. Otros clubes nunca ven tus datos. ADN Sports solo ve cantidades de uso para dar soporte, nunca datos de jugadores."],
  ["¿Los jugadores tienen que instalar algo?", "No. La app se abre desde el navegador del celular y se puede agregar a la pantalla de inicio como una app."],
  ["¿Sirve para juveniles?", "Sí. En juveniles los videos solo los ven los dos clubes que jugaron ese partido, y los datos de menores nunca se comparten."],
  ["¿Cómo funciona la Videoteca compartida?", "En Primera, los clubes de una misma división comparten los videos de sus partidos. Si tu club sube los suyos, ve los de los demás. Si no sube, no ve."],
  ["¿Puedo cancelar?", "Sí. El plan mensual se cancela cuando quieras desde Mercado Pago. El anual cubre los 12 meses ya pagados."],
  ["¿Por qué el precio está en dólares?", "Para que no cambie mes a mes. Se paga en pesos, convertido al dólar oficial del Banco Nación del día."],
];

export default function Landing() {
  const dolar = useDolar();
  return (
    <>
      <a href="#contenido" className="saltar">Ir al contenido</a>
      <header className="cabecera">
        <div className="ancho cabecera-fila">
          <Marca />
          <nav className="menu" aria-label="Secciones">
            <a href="#hub">Qué tiene</a>
            <a href="#planes">Planes</a>
            <a href="#pago">Cómo se paga</a>
            <a className="boton chico" href="/demo">Probar la demo</a>
          </nav>
        </div>
      </header>

      <main id="contenido">
        <section className="hero ancho">
          <div className="hero-txt">
            <h1>Toda la información de tu club, en una app.</h1>
            <p className="bajada">
              Plantel, wellness, Matchday en vivo, análisis de video, GPS y cuerpo médico, resumidos y al alcance de tu mano. Nació en el rugby, para nuestro propio cuerpo técnico, y
              lo adaptamos al deporte de tu club: básquet, fútbol, hockey y más.
            </p>
            <div className="acciones">
              <a className="boton" href="/demo">Probar la demo</a>
              <a className="boton secundario" href="#planes">Ver planes</a>
            </div>
            <p className="nota">La demo muestra un club de rugby ficticio. No hace falta registrarse.</p>
          </div>
          <div className="telefono" aria-label="Demo de un Hub funcionando">
            <div className="telefono-marco">
              <iframe src="/demo?embed=1" title="Demo de un Hub con un club ficticio" loading="lazy" />
            </div>
            <a className="telefono-pie" href="/demo">Abrir la demo en pantalla completa</a>
          </div>
        </section>

        <section className="deportes ancho" aria-labelledby="deportes-t">
          <h2 id="deportes-t">Un Hub para cada deporte</h2>
          <p className="bajada">La base es la misma para todos. Los puestos, la formación y las estadísticas se adaptan a lo que juega tu club.</p>
          <ul className="deportes-lista">
            {DEPORTES.map(([t, d]) => (
              <li key={t} className={t === "Rugby" ? "activo" : undefined}>
                <span className="deportes-cab">
                  <b>{t}</b>
                  <span className="deportes-estado">{t === "Rugby" ? "En uso" : "A medida"}</span>
                </span>
                <span className="deportes-txt">{d}</span>
              </li>
            ))}
          </ul>
          <p className="nota">¿Tu club juega otro deporte? Escribinos y lo vemos.</p>
        </section>

        <section className="semana" aria-labelledby="semana-t">
          <div className="ancho">
            <h2 id="semana-t">La semana de un staff, antes y después</h2>
            <div className="semana-cols">
              <div className="semana-col antes">
                <h3>Hoy</h3>
                <ul>{ANTES.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
              <div className="semana-col despues">
                <h3>Con un Hub</h3>
                <ul>{CON_HUB.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            </div>
          </div>
        </section>

        <section id="hub" className="ancho modulos" aria-labelledby="hub-t">
          <h2 id="hub-t">Qué tiene tu Hub</h2>
          <p className="bajada">Toda la semana del staff, de lunes al partido y después. Cada club tiene su propio Hub, con su escudo y sus colores, y activa los módulos que usa.</p>
          {MOMENTOS.map((m) => (
            <div key={m.titulo} className="momento">
              <h3 className="momento-t">{m.titulo}</h3>
              <dl className="modulos-lista">
                {m.modulos.map(([t, d]) => (
                  <div key={t} className={`modulo${t === "Matchday en vivo" ? " estrella" : ""}`}>
                    <dt>{t}</dt>
                    <dd>{d}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>

        <section className="red" aria-labelledby="red-t">
          <div className="ancho red-fila">
            <div>
              <h2 id="red-t">Cuantos más clubes, más vale tu Hub.</h2>
              <p>
                Los clubes de una misma división comparten los videos de sus partidos de Primera. Antes del sábado, tu staff
                mira los últimos tres partidos del rival. Funciona igual en cualquier deporte con liga.
              </p>
            </div>
            <ul className="red-reglas">
              <li><b>Primera</b>Videoteca compartida con la división. Para ver, tu club también comparte y está al día.</li>
              <li><b>Intermedia</b>Privada: cada club ve solo sus videos.</li>
              <li><b>Juveniles</b>Cada video lo ven solo los dos clubes que jugaron.</li>
            </ul>
          </div>
        </section>

        <section id="planes" className="ancho planes" aria-labelledby="planes-t">
          <h2 id="planes-t">Planes</h2>
          <p className="bajada">Los dos planes incluyen un Hub completo para tu club, la puesta en marcha y soporte por mensaje.</p>
          <div className="planes-fila">
            {PLANES.map((p) => (
              <article key={p.id} className={`plan${p.id === "anual" ? " destacado" : ""}`}>
                <h3>{p.nombre}</h3>
                {p.id === "anual" && <span className="plan-ahorro">2 meses bonificados</span>}
                <p className="plan-precio">
                  <span className="plan-usd">USD {p.usd}</span> <span className="plan-periodo">{p.periodo}</span>
                </p>
                <p className="plan-pesos">
                  {dolar ? `Hoy son ${pesos(p.usd * dolar.venta)}` : "Se paga en pesos al dólar oficial BNA"}
                </p>
                <p className="plan-detalle">{p.detalle}</p>
                <a
                  className={`boton${p.id === "anual" ? "" : " secundario"}`}
                  href={p.mercadoPago || MENSAJE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.mercadoPago ? `Pagar el plan ${p.nombre.toLowerCase()}` : `Quiero el plan ${p.nombre.toLowerCase()}`}
                </a>
              </article>
            ))}
          </div>
          {dolar && (
            <p className="nota">
              Precio en pesos calculado con el dólar oficial del Banco Nación, vendedor: {pesos(dolar.venta)}. El monto final es el del día del pago.
            </p>
          )}
        </section>

        <section id="pago" className="pago" aria-labelledby="pago-t">
          <div className="ancho">
            <h2 id="pago-t">Cómo se paga</h2>
            <ol className="pasos">
              {PASOS.map(([t, d]) => (
                <li key={t}>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </li>
              ))}
            </ol>
            <div className="mp">
              <span className="mp-logo" aria-hidden="true">MP</span>
              <p>
                Cobramos con <b>Mercado Pago</b>: suscripción automática en el plan mensual o un solo pago en el anual. Podés usar
                tarjeta de crédito, débito o dinero en cuenta.
              </p>
            </div>
          </div>
        </section>

        <section className="ancho faq" aria-labelledby="faq-t">
          <h2 id="faq-t">Preguntas frecuentes</h2>
          {PREGUNTAS.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>

        <section className="cierre" aria-labelledby="cierre-t">
          <div className="ancho cierre-fila">
            <Insignia size={120} />
            <div>
              <h2 id="cierre-t">¿Lo quieren para su club?</h2>
              <p>Escribinos por Instagram y coordinamos una demo con los datos de tu club.</p>
              <div className="acciones">
                <a className="boton" href={MENSAJE_URL} target="_blank" rel="noreferrer">Escribir a @{INSTAGRAM}</a>
                <a className="boton secundario claro" href="/demo">Probar la demo</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="pie">
        <div className="ancho pie-fila">
          <Marca />
          <p>Hecho por gente del deporte, en Buenos Aires.</p>
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">Instagram @{INSTAGRAM}</a>
        </div>
      </footer>
    </>
  );
}
