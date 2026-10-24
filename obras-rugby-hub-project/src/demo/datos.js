// Datos de ejemplo para las demos de ADN (genérica o Berazategui, según VITE_DEMO_CLUB). Nada de esto
// es real: jugadores inventados,
// resultados inventados. Se generan siempre a partir de la fecha de hoy, así la demo se ve "viva"
// (wellness de hoy, el partido del sábado, la práctica de mañana) cualquier día que se abra.

// Qué demo se arma: "generico" (club inventado, para la web de ADN) o "berazategui" (por defecto).
export const VARIANTE = import.meta.env.VITE_DEMO_CLUB === "generico" ? "generico" : "berazategui";
export const CLUB_ID = VARIANTE === "generico" ? "demo-club-adn" : "demo-club-berazategui";
export const UID_STAFF = "demo-auth-staff";
export const UID_JUGADOR = "demo-auth-jugador";

// Números pseudoaleatorios con semilla fija: la demo es igual cada vez que se abre.
function azar(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function diaRel(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}
// Próximo día de la semana (0 = domingo … 6 = sábado), hoy incluido si incluirHoy.
function proximo(diaSemana, incluirHoy = false) {
  const d = diaRel(0);
  let dif = (diaSemana - d.getDay() + 7) % 7;
  if (dif === 0 && !incluirHoy) dif = 7;
  return diaRel(dif);
}

const NOMBRES = [
  "Tomás Ferreyra", "Matías Gómez", "Lautaro Sosa", "Franco Ibarra", "Joaquín Ledesma", "Nicolás Quiroga",
  "Agustín Paz", "Facundo Vera", "Santiago Molina", "Bruno Acosta", "Ignacio Ríos", "Martín Cabrera",
  "Gonzalo Medina", "Lucas Benítez", "Federico Ojeda", "Ezequiel Romero", "Julián Herrera", "Valentín Díaz",
  "Ramiro Castro", "Thiago Navarro", "Emiliano Suárez", "Mateo Correa", "Gastón Villalba", "Leandro Peralta",
  "Diego Aguirre", "Pablo Figueroa", "Sebastián Luna", "Kevin Ortiz", "Alan Domínguez", "Marcos Giménez",
  "Hernán Pereyra", "Cristian Rojas", "Germán Silva", "Axel Moreno", "Iván Torres", "Damián Juárez",
  "Ulises Campos", "Brian Maldonado", "Elías Vega", "Jonatan Ponce", "Rodrigo Arias", "Maximiliano Ruiz",
  "Leonel Bustos", "Nahuel Godoy", "Cristian Leiva", "Patricio Funes", "Ariel Mansilla", "Walter Cardozo",
];
// Puestos de una formación (1 a 15) y suplentes (16 a 23).
const SLOTS = [
  [1, "Primera línea", "forwards"], [2, "Hooker", "forwards"], [3, "Primera línea", "forwards"],
  [4, "Segunda línea", "forwards"], [5, "Segunda línea", "forwards"], [6, "Tercera línea", "forwards"],
  [7, "Tercera línea", "forwards"], [8, "Tercera línea", "forwards"], [9, "Medio scrum", "backs"],
  [10, "Apertura", "backs"], [11, "Wing", "backs"], [12, "Centro", "backs"], [13, "Centro", "backs"],
  [14, "Wing", "backs"], [15, "Fullback", "backs"], [16, "Hooker", "suplentes"], [17, "Primera línea", "suplentes"],
  [18, "Primera línea", "suplentes"], [19, "Segunda línea", "suplentes"], [20, "Tercera línea", "suplentes"],
  [21, "Medio scrum", "suplentes"], [22, "Centro", "suplentes"], [23, "Wing", "suplentes"],
];
const ALT = { "Primera línea": "Hooker", Hooker: "Primera línea", "Segunda línea": "Tercera línea", "Tercera línea": "Segunda línea",
  "Medio scrum": "Wing", Apertura: "Centro", Centro: "Wing", Wing: "Fullback", Fullback: "Apertura" };
const FISICO = { "Primera línea": [178, 112], Hooker: [176, 100], "Segunda línea": [193, 104], "Tercera línea": [186, 98],
  "Medio scrum": [170, 74], Apertura: [178, 82], Centro: [182, 90], Wing: [180, 84], Fullback: [182, 86] };

const ESCUDOS = "https://xnyleewcwrriodkaklqo.supabase.co/storage/v1/object/public/escudos/";
// Escudos inventados para la demo genérica: un escudo simple con iniciales y colores.
function escudoInventado(iniciales, c1, c2) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110"><path d="M50 4 L94 18 V52 C94 80 74 98 50 106 C26 98 6 80 6 52 V18 Z" fill="${c1}" stroke="${c2}" stroke-width="6"/><text x="50" y="66" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="${c2}" text-anchor="middle">${iniciales}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
const RIVALES_GENERICOS = [
  ["Atlético del Norte", escudoInventado("AN", "#1E4FA3", "#FFFFFF")],
  ["Deportivo Ribera", escudoInventado("DR", "#C8102E", "#FFFFFF")],
  ["Unión del Oeste", escudoInventado("UO", "#2F7A3B", "#F4E04D")],
  ["Club Social del Sur", escudoInventado("CS", "#5B2A86", "#FFFFFF")],
  ["Sporting Llanura", escudoInventado("SL", "#F2F2F2", "#1C1C1C")],
  ["Estrella del Parque", escudoInventado("EP", "#0B2545", "#E8B931")],
  ["Náutico Delta", escudoInventado("ND", "#0D6E8A", "#FFFFFF")],
  ["Racing de la Costa", escudoInventado("RC", "#7FB3E3", "#0E1620")],
  ["Juventud Serrana", escudoInventado("JS", "#8B4513", "#FFFFFF")],
];
const RIVALES = [
  ["Atlético San Andrés", "30725e07-03cd-4d24-9aeb-00af9e6c39d7.png"],
  ["Defensores de Glew", "16a01869-a2b1-4f1b-93f4-d17a57f3ad94.png"],
  ["Ezeiza", "22e2c50e-6f4b-453d-abcd-642db2c5dcda.png"],
  ["Floresta", "9a88df3a-4674-416c-bd2c-bbd69caeacbf.png"],
  ["Marcos Paz", "799d4fee-a107-40fc-a9fb-b1851662bdd9.png"],
  ["Rivadavia de Lobos", "b145172d-be55-4033-9e9c-a123a21a2007.png"],
  ["San José", "48d3c89e-7a7b-4405-ae56-985d3efa7db2.png"],
  ["Sociedad Hebraica", "36929bfc-664c-452d-bb41-f92feebc8b60.png"],
  ["Obras Sanitarias de la Nación", null],
];

export function generarDatos() {
  const r = azar(20261019);
  const entre = (a, b) => a + Math.floor(r() * (b - a + 1));
  const ahora = new Date().toISOString();
  const club_id = CLUB_ID;
  const db = {};

  const generico = VARIANTE === "generico";
  db.clubes = [{ id: club_id, ...(generico
      ? { slug: "demo", nombre: "Club Demo ADN", nombre_corto: "Demo", logo_url: "/logo-adn.svg", color_primario: "#1FA37A", color_secundario: "#0E1620" }
      : { slug: "berazategui", nombre: "Municipalidad de Berazategui", nombre_corto: "Berazategui", logo_url: "/escudo-berazategui.png", color_primario: "#F1A130", color_secundario: "#1C1C1C" }),
    modulos: {}, comparte_videoteca: true, comparte_benchmarks: false, por_defecto: true, created_at: ahora }];
  db.config = [{ clave: "temporada_activa", valor: "2026", club_id }, { clave: "gps_chalecos_disponibles", valor: 0, club_id }];
  db.wellness_horarios = [{ club_id, horarios: { semana: { abre: "07:00", cierra: "23:00" }, sabado: { Superior: { abre: "07:00", cierra: "12:00" }, Intermedia: { abre: "07:00", cierra: "11:00" }, Resto: { abre: "07:00", cierra: "11:00" } }, domingo: { abre: "10:00", cierra: "22:00" } } }];
  db.categorias = [
    { id: "cat-sup", nombre: "Superior", temporada: "2026", emoji: "", activa: true, club_id, torneo_id: null },
    { id: "cat-int", nombre: "Intermedia", temporada: "2026", emoji: "", activa: true, club_id, torneo_id: null },
  ];
  db.equipos_rivales = generico
    ? RIVALES_GENERICOS.map(([nombre, escudo], i) => ({ id: `riv-${i}`, nombre, emoji: "", escudo_url: escudo, club_id, club_plataforma_id: null }))
    : RIVALES.map(([nombre, f], i) => ({ id: `riv-${i}`, nombre, emoji: "", escudo_url: f ? ESCUDOS + f : "/escudo-icon-192.png", club_id, club_plataforma_id: null }));

  // Jugadores: 23 de Superior, 23 de Intermedia y 2 sin formación.
  db.jugadores = [];
  db.lineup_slots = [];
  NOMBRES.forEach((nombre, i) => {
    const cat = i < 23 ? "cat-sup" : i < 46 ? "cat-int" : null;
    const slot = SLOTS[i % 23];
    const puesto = slot[1];
    const [alt, peso] = FISICO[puesto];
    const id = `jug-${i}`;
    let apto = "Apto";
    if ([30, 37, 44].includes(i)) apto = "Pendiente";
    if ([41, 47].includes(i)) apto = "No apto";
    let estado = "Disponible", zona = null;
    if (i === 6) { estado = "Lesionado"; zona = "Rodilla"; }
    if (i === 27) { estado = "Lesionado"; zona = "Hombro"; }
    if (i === 12) estado = "A vigilar";
    db.jugadores.push({
      id, nombre, posicion_ideal: puesto, posicion_alternativa: ALT[puesto], posicion_emergencia: ALT[ALT[puesto]] || ALT[puesto],
      altura_cm: alt + entre(-4, 5), peso_kg: peso + entre(-6, 8), apto, estado, zona_lesion: zona, foto_url: null,
      club_id, fecha_nacimiento: `${entre(1993, 2006)}-${pad(entre(1, 12))}-${pad(entre(1, 28))}`, categoria_id: cat,
      created_at: ahora, updated_at: ahora,
    });
    if (cat) db.lineup_slots.push({ id: `slot-${i}`, categoria_id: cat, numero: slot[0], puesto, grupo: slot[2], jugador_id: id, club_id });
  });
  // El lesionado no está en la formación: lo reemplaza un suplente sin formación.
  const s6 = db.lineup_slots.find((s) => s.jugador_id === "jug-6");
  if (s6) s6.jugador_id = "jug-46";

  // Cuentas: el staff de la demo, el jugador de la demo, y 30 jugadores más registrados (uno sin aprobar).
  db.profiles = [
    { id: "perf-staff", auth_user_id: UID_STAFF, nombre: "Entrenador Demo", usuario: "entrenador", rol: "Cuerpo técnico", jugador_id: null, created_at: ahora, avatar_url: null, confirmado: true, bloqueado: false, club_id, fecha_nacimiento: null },
    { id: "perf-jug", auth_user_id: UID_JUGADOR, nombre: "Tomás Ferreyra", usuario: "tomas", rol: "Jugador", jugador_id: "jug-0", created_at: ahora, avatar_url: null, confirmado: true, bloqueado: false, club_id, fecha_nacimiento: null },
  ];
  for (let i = 1; i <= 34; i++) {
    db.profiles.push({ id: `perf-${i}`, auth_user_id: `demo-auth-${i}`, nombre: NOMBRES[i], usuario: null, rol: "Jugador", jugador_id: `jug-${i}`,
      created_at: ahora, avatar_url: null, confirmado: i !== 34, bloqueado: false, club_id, fecha_nacimiento: null });
  }
  const conCuenta = db.profiles.filter((p) => p.jugador_id && p.confirmado).map((p) => p.jugador_id);

  // Fixture: 10 fechas jugadas (sábados anteriores) y 3 por jugar.
  db.partidos = [];
  const proxSab = proximo(6, true);
  const resultados = [[24, 17], [12, 19], [31, 10], [22, 22], [15, 13], [8, 27], [29, 12], [17, 14], [20, 25], [26, 18]];
  ["cat-sup", "cat-int"].forEach((cat, ci) => {
    for (let f = 1; f <= 13; f++) {
      const d = new Date(proxSab);
      d.setDate(d.getDate() + (f - 11) * 7);
      const jugado = f <= 10;
      const [gf, gc] = resultados[(f - 1 + ci * 3) % 10];
      const res = !jugado ? "Próximo" : gf > gc ? "Ganado" : gf < gc ? "Perdido" : "Empate";
      db.partidos.push({
        id: `par-${cat}-${f}`, categoria_id: cat, fecha_numero: f, fecha: iso(d), rival_id: `riv-${(f - 1) % 9}`,
        condicion: f % 2 ? "Local" : "Visitante", goles_favor: jugado ? (ci ? gc : gf) : null, goles_contra: jugado ? (ci ? gf : gc) : null,
        resultado: jugado ? (ci ? (gc > gf ? "Ganado" : gc < gf ? "Perdido" : "Empate") : res) : "Próximo",
        temporada: "2026", veo_link: null, informe: null, club_id,
        partido_liga_id: null, convocatoria_publicada_at: f === 11 ? ahora : null,
        votacion_abre_at: f === 10 && !ci ? new Date(d.getTime() + 17 * 3600000).toISOString() : null,
      });
    }
  });

  // Tabla de posiciones.
  const tabla = [
    ["riv-6", 10, 8, 0, 2, 286, 160, 6, 1], [null, 10, 7, 1, 2, 204, 156, 4, 1], ["riv-1", 10, 7, 0, 3, 251, 170, 5, 2],
    ["riv-5", 10, 6, 0, 4, 230, 190, 3, 2], ["riv-0", 10, 5, 1, 4, 199, 201, 2, 3], ["riv-3", 10, 4, 0, 6, 180, 222, 2, 2],
    ["riv-8", 10, 3, 1, 6, 170, 240, 1, 2], ["riv-2", 10, 2, 1, 7, 150, 260, 0, 3], ["riv-4", 10, 1, 0, 9, 120, 300, 0, 2],
  ];
  db.posiciones = [];
  ["cat-sup", "cat-int"].forEach((cat) => {
    tabla.forEach(([eq, pj, g, e, p, pf, pc, bo, bd], k) => {
      db.posiciones.push({ id: `pos-${cat}-${k}`, categoria_id: cat, equipo_id: eq, es_obras: eq === null, pj, g, e, p, pf, pc, dif: pf - pc,
        bo, bd, pts: g * 4 + e * 2 + bo + bd, temporada: "2026", club_id, fase: "regular", zona: null });
    });
  });

  // Wellness de las últimas dos semanas (y de hoy) de los que tienen cuenta.
  db.wellness_respuestas = [];
  let wid = 0;
  for (let d = -14; d <= 0; d++) {
    conCuenta.forEach((jid, k) => {
      if (d === 0 && (k % 3 === 2 || jid === "jug-0")) return; // hoy todavía faltan algunos (y el jugador de la demo, para que lo pruebe)
      if (r() < 0.25 && d < 0) return;
      const base = jid === "jug-12" || jid === "jug-9" ? (d === 0 ? 2 : 4) : 5;
      const v = () => Math.max(1, Math.min(7, base + entre(-1, 2)));
      db.wellness_respuestas.push({ id: `w-${wid++}`, jugador_id: jid, fecha: iso(diaRel(d)), estres: v(), sueno: v(), doms: v(), fatiga: v(),
        observacion: null, estado_entrenamiento: jid === "jug-12" && d === 0 ? "Parcial" : "Full",
        observaciones: jid === "jug-12" && d === 0 ? "Dormí mal, molestia en el isquio" : null, club_id, escala: 7 });
    });
  }

  // Lesiones: una en recuperación y otra con posible alta.
  db.lesiones = [
    { id: "les-1", jugador_id: "jug-6", zona: "Rodilla", descripcion: "Esguince de ligamento lateral, grado I", fecha_lesion: iso(diaRel(-24)),
      semanas_estimadas: 5, fecha_vuelta_estimada: iso(diaRel(11)), activa: true, creado_por: null, created_at: ahora, club_id,
      etapa: "Recuperación", fecha_recuperacion: iso(diaRel(-10)), fecha_posible_alta: null, fecha_alta: null },
    { id: "les-2", jugador_id: "jug-27", zona: "Hombro", descripcion: "Contusión", fecha_lesion: iso(diaRel(-15)),
      semanas_estimadas: 3, fecha_vuelta_estimada: iso(diaRel(6)), activa: true, creado_por: null, created_at: ahora, club_id,
      etapa: "Posible alta", fecha_recuperacion: iso(diaRel(-8)), fecha_posible_alta: iso(diaRel(6)), fecha_alta: null },
  ];
  db.historial_medico = [
    { id: "hm-1", jugador_id: "jug-6", descripcion: "Esguince de tobillo, 2024", cargado_por: null, created_at: ahora, club_id },
    { id: "hm-2", jugador_id: "jug-3", descripcion: "Luxación de hombro, 2023", cargado_por: null, created_at: ahora, club_id },
  ];

  // Asistencia a las prácticas (martes y jueves) del último mes.
  db.asistencias = [];
  for (let d = -28; d < 0; d++) {
    const f = diaRel(d);
    if (![2, 4].includes(f.getDay())) continue;
    db.jugadores.forEach((j, k) => {
      if (k > 45) return;
      db.asistencias.push({ id: `as-${d}-${k}`, jugador_id: j.id, fecha: iso(f), dia: f.getDay() === 2 ? "Martes" : "Jueves", presente: r() > 0.2,
        temporada: "2026", marcado_por: "perf-staff", created_at: ahora, club_id });
    });
  }

  // Respuestas a la próxima práctica y a la convocatoria del sábado.
  const proxPractica = [2, 4].map((d) => proximo(d, true)).sort((a, b) => a - b)[0];
  db.practica_respuestas = conCuenta.slice(0, 22).map((jid, k) => ({ id: `pr-${k}`, club_id, fecha: iso(proxPractica), jugador_id: jid,
    respuesta: k % 7 === 3 ? "no_puedo" : "voy", motivo: k % 7 === 3 ? "Trabajo" : null, updated_at: ahora }));
  db.convocatoria_respuestas = db.lineup_slots.filter((s) => s.categoria_id === "cat-sup").slice(0, 17).map((s, k) => ({
    id: `cv-${k}`, club_id, partido_id: "par-cat-sup-11", jugador_id: s.jugador_id, respuesta: k === 9 ? "no_puedo" : "voy",
    motivo: k === 9 ? "Viaje familiar" : null, respondido_por: null, updated_at: ahora }));

  // Tests físicos de marzo y agosto.
  db.evaluaciones = [];
  db.jugadores.slice(0, 30).forEach((j, k) => {
    [["03-15", 0], ["08-20", 1]].forEach(([md, n]) => {
      const m = 1 + n * 0.06;
      db.evaluaciones.push({ id: `ev-${k}-${n}`, jugador_id: j.id, fecha: `2026-${md}`, potencia: +(38 + entre(0, 14) * m).toFixed(1),
        reactividad: +(1.6 + r() * 0.8 * m).toFixed(2), fuerza: +(1.3 + r() * 0.7 * m).toFixed(2), velocidad: +(4.6 + r() * 0.8 - n * 0.1).toFixed(2),
        resistencia: +(16 + r() * 5 * m).toFixed(1), cargado_por: "perf-staff", club_id });
    });
  });

  // Esfuerzo (RPE) de la última semana y cargas del gimnasio del jugador de la demo.
  db.rpe_sesiones = [];
  for (let d = -6; d < 0; d++) {
    conCuenta.slice(0, 20).forEach((jid, k) => {
      if (r() < 0.4) return;
      const rpe = entre(5, 9), minutos = [60, 75, 90][k % 3];
      db.rpe_sesiones.push({ id: `rpe-${d}-${k}`, club_id, jugador_id: jid, fecha: iso(diaRel(d)), tipo: "Práctica", rpe, minutos, carga: rpe * minutos, updated_at: ahora });
    });
  }
  db.registros_gimnasio = [];
  [-7, -5, -2].forEach((d, n) => {
    [["Sentadilla", 100], ["Press de banca", 80], ["Peso muerto rumano", 90]].forEach(([ej, kg], e) => {
      for (let s = 1; s <= 3; s++) db.registros_gimnasio.push({ id: `rg-${n}-${e}-${s}`, club_id, jugador_id: "jug-0", fecha: iso(diaRel(d)),
        dia_plan: "Lunes", ejercicio: ej, serie: s, repeticiones: 6, peso_kg: kg + n * 2.5, nota: null, cargado_por: "perf-jug", created_at: ahora });
    });
  });

  // Destrezas (función a medida de Berazategui): generales y del puesto, cada una en sus 3 etapas,
  // evaluadas tres veces en el año con mejoras.
  const ETAPAS_D = ["preparacion", "ejecucion", "terminacion"];
  const esFw = (p) => /primera|pilar|hooker|segunda|tercera|ala|octavo/i.test(String(p || ""));
  const COMENT = { "Pase y recepción": "Mejoró la preparación: llega con las manos listas. Falta terminar el pase al pecho del compañero.",
    Tackle: "Buena entrada y ejecución. Tiene que terminar ganando la pelota o levantándose rápido.",
    Duelo: "Gana más duelos que antes; seguir trabajando la preparación antes del contacto.",
    Breakdown: "Llega rápido; la terminación (limpiar o robar) todavía es irregular." };
  db.destrezas_evaluacion = [];
  db.jugadores.slice(0, 30).forEach((j, k) => {
    const lista = [...["Pase y recepción", "Tackle", "Duelo", "Breakdown"].map((d) => [d, "general"]),
      ...(esFw(j.posicion_ideal) ? ["Scrum", "Line"] : ["Pateo"]).map((d) => [d, "puesto"])];
    lista.forEach(([d, area], i) => {
      const base = ETAPAS_D.map(() => entre(1, 3));
      [["2026-03-20", 0], ["2026-06-18", 1], ["2026-09-24", 2]].forEach(([fecha, n]) => {
        ETAPAS_D.forEach((etapa, e) => {
          const nota = Math.max(1, Math.min(5, base[e] + (n >= 1 && (i + k + e) % 2 === 0 ? 1 : 0) + (n === 2 && (i + k + e) % 3 === 0 ? 1 : 0)));
          db.destrezas_evaluacion.push({ id: `de-${k}-${i}-${n}-${e}`, club_id, jugador_id: j.id, fecha, area, destreza: d, etapa, nota,
            comentario: n === 2 && COMENT[d] && (k + i) % 3 === 0 ? COMENT[d] : null, evaluador_id: "perf-staff", created_at: ahora });
        });
      });
    });
  });

  // Quiénes jugaron cada partido ya jugado (para la votación del jugador del partido).
  for (const pt of db.partidos) {
    if (pt.goles_favor == null) continue;
    pt.jugaron = db.lineup_slots.filter((s) => s.categoria_id === pt.categoria_id && s.jugador_id).map((s) => s.jugador_id);
  }

  // Jugador del partido del último partido (votación cerrada).
  db.votos_partido = conCuenta.slice(0, 24).map((jid, k) => ({ id: `vt-${k}`, club_id, partido_id: "par-cat-sup-10",
    votante: `demo-auth-${k + 1}`, jugador_id: k % 3 === 0 ? "jug-9" : k % 3 === 1 ? "jug-12" : "jug-9", created_at: ahora }));
  db.analisis_individual_partido = db.lineup_slots.filter((s) => s.categoria_id === "cat-sup" && s.numero <= 15).map((s, k) => ({
    id: `ai-${k}`, partido_id: "par-cat-sup-10", jugador_id: s.jugador_id, tackle_hecho: entre(4, 14), tackle_positivo: entre(1, 5), tackle_errado: entre(0, 3),
    quiebre_con_try: k === 10 ? 1 : 0, quiebre_sin_try: entre(0, 2), penal_a_favor: entre(0, 2), penal_en_contra_ruck: entre(0, 1), penal_en_contra_maul: 0,
    penal_en_contra_juego: entre(0, 1), penal_en_contra_inconducta: 0, es_pateador: s.numero === 10, drop_convertido: 0, cincuenta_22: s.numero === 10 ? 1 : 0,
    creado_por: "perf-staff", updated_at: ahora, club_id, tries: [10, 13].includes(k) ? 1 : k === 1 ? 1 : 0, recuperadas: entre(0, 3) }));

  db.notificaciones = [
    { id: "n-1", tipo: "convocatoria", mensaje: "Ya está el equipo del sábado. Fijate si estás convocado y confirmá.", roles_destino: ["Jugador"], creado_por: "perf-staff", created_at: new Date(Date.now() - 3 * 3600000).toISOString(), club_id, jugadores_destino: null, perfiles_destino: null },
    { id: "n-2", tipo: "mvp_ganador", mensaje: "🏆 Jugador del partido (Superior): Bruno Acosta. ¡Felicitaciones!", roles_destino: ["Jugador", "Cuerpo técnico", "Manager", "Cuerpo médico"], creado_por: null, created_at: new Date(Date.now() - 26 * 3600000).toISOString(), club_id, jugadores_destino: null, perfiles_destino: null },
    { id: "n-3", tipo: "lesion_etapa", mensaje: "Kevin Ortiz: posible alta deportiva en unos días (la puso kinesio).", roles_destino: ["Cuerpo técnico", "Manager"], creado_por: null, created_at: new Date(Date.now() - 30 * 3600000).toISOString(), club_id, jugadores_destino: null, perfiles_destino: null },
    { id: "n-4", tipo: "resultado_cargado", mensaje: `Resultado cargado: ${generico ? "Demo" : "Berazategui"} 26-18.`, roles_destino: null, creado_por: null, created_at: new Date(Date.now() - 40 * 3600000).toISOString(), club_id, jugadores_destino: null, perfiles_destino: null },
  ];

  // Aptos médicos de la temporada: la mayoría aprobados, algunos por revisar y el resto sin cargar.
  db.aptos_medicos = db.jugadores.slice(1, 27).map((j, k) => ({ id: `apto-${k}`, club_id, jugador_id: j.id, temporada: "2026",
    archivo: `${club_id}/${j.id}/2026-demo.pdf`, fecha_emision: "2026-02-20", estado: k < 21 ? "aprobado" : "cargado", nota: null,
    cargado_por: "perf-staff", revisado_por: k < 21 ? "perf-staff" : null, created_at: "2026-02-25T12:00:00Z", updated_at: "2026-02-25T12:00:00Z" }));

  // Ideas que mandaron jugadores y esperan al manager.
  db.adn_feedback = [
    { id: "fb-1", club_id, perfil_id: "perf-3", autor: NOMBRES[3], tipo: "Mejora", mensaje: "Estaría bueno ver en el celular el video de mis jugadas del partido.", estado: "Recibido", respuesta: null, origen: "jugador", para_adn: false, archivado: false, created_at: new Date(Date.now() - 20 * 3600000).toISOString(), updated_at: ahora },
    { id: "fb-2", club_id, perfil_id: "perf-7", autor: NOMBRES[7], tipo: "Error", mensaje: "El wellness no me dejó cargar el domingo a la noche.", estado: "Recibido", respuesta: null, origen: "jugador", para_adn: false, archivado: false, created_at: new Date(Date.now() - 50 * 3600000).toISOString(), updated_at: ahora },
  ];

  // Tablas que la demo usa vacías.
  for (const t of ["notificaciones_leidas", "plan_gimnasio_club", "sesiones_practica", "grupos_practica", "videos_partido", "partidos_liga",
    "reportes_video", "push_subscriptions", "adn_feedback", "convocatorias", "avatars", "escudos", "marcador_vivo"]) db[t] = db[t] || [];
  return db;
}
