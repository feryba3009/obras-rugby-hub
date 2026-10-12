// Datos 100% ficticios para la demo. Ningún nombre corresponde a un jugador real.

export const CLUB = { nombre: "Club Ejemplo", corto: "Ejemplo", color: "#8C1D2C", siglas: "CE" };

const NOMBRES = [
  "Tomás", "Joaquín", "Mateo", "Santiago", "Felipe", "Bruno", "Lautaro", "Ignacio", "Facundo", "Manuel",
  "Agustín", "Nicolás", "Valentín", "Franco", "Benjamín", "Julián", "Matías", "Lucas", "Gonzalo", "Federico",
  "Bautista", "Ramiro", "Tobías", "Martín", "Juan Cruz", "Emiliano", "Thiago", "Germán", "Pedro", "Simón",
];
const APELLIDOS = [
  "Ferraro", "Quintana", "Belmonte", "Aranda", "Villafañe", "Cuesta", "Echagüe", "Larrea", "Montalvo", "Peralta",
  "Sosa Ríos", "Tolosa", "Urquiza", "Varela", "Zabala", "Bonfanti", "Cabral", "Domínguez", "Esquivel", "Funes",
  "Garay", "Iturbe", "Juárez", "Lobos", "Medina", "Navarro", "Olmedo", "Prado", "Rinaldi", "Saravia",
];
const PUESTOS = [
  "Pilar izquierdo", "Hooker", "Pilar derecho", "Segunda línea", "Segunda línea", "Ala", "Ala", "Octavo",
  "Medio scrum", "Apertura", "Wing", "Centro", "Centro", "Wing", "Fullback",
];

// Generador determinístico: la demo se ve igual cada vez que se abre
function rnd(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const r = rnd(20261012);
const entre = (a, b) => Math.round(a + r() * (b - a));

const FORWARDS = new Set(["Pilar izquierdo", "Hooker", "Pilar derecho", "Segunda línea", "Ala", "Octavo"]);

export const JUGADORES = NOMBRES.map((nombre, i) => {
  const puesto = PUESTOS[i % 15];
  const forward = FORWARDS.has(puesto);
  const peso = forward ? entre(98, 122) : entre(76, 92);
  const altura = puesto === "Segunda línea" ? entre(192, 201) : forward ? entre(176, 188) : entre(171, 185);
  // Wellness de los últimos 7 días (sueño, estrés, dolor, fatiga del 1 al 7; 7 = mejor)
  const base = entre(4, 6);
  const semana = Array.from({ length: 7 }, (_, d) => {
    const v = (x) => Math.max(1, Math.min(7, base + x));
    return { sueno: v(entre(-2, 1)), estres: v(entre(-2, 1)), dolor: v(entre(-2, 1)), fatiga: v(entre(-2, 1)) };
  });
  return {
    id: i + 1,
    nombre: `${nombre} ${APELLIDOS[i]}`,
    puesto,
    linea: forward ? "Forwards" : "Backs",
    numero: i < 15 ? i + 1 : i < 23 ? i + 1 : null,
    peso,
    altura,
    edad: entre(19, 31),
    asistencia: entre(58, 100),
    semana,
    estado: "Disponible",
    lesion: null,
    gps: { minutos: 0, distancia: 0, altaInt: 0, velMax: 0, sprints: 0 },
  };
});

// Algunos casos para que la demo cuente algo
const set = (i, cambios) => Object.assign(JUGADORES[i], cambios);
set(3, { estado: "Lesionado", lesion: { zona: "Tobillo derecho", vuelve: "en 3 semanas" } });
set(11, { estado: "Lesionado", lesion: { zona: "Isquiotibial izquierdo", vuelve: "en 10 días" } });
set(6, { estado: "A vigilar", lesion: { zona: "Hombro", vuelve: "entrena diferenciado" } });
set(21, { estado: "A vigilar", lesion: { zona: "Rodilla", vuelve: "a evaluar el jueves" } });
// Wellness en baja sostenida: el tipo de alerta que el Hub levanta
for (const i of [8, 17, 25]) {
  JUGADORES[i].semana = JUGADORES[i].semana.map((d, k) => ({
    sueno: Math.max(1, 6 - Math.floor(k * 0.6)), estres: Math.max(1, 5 - Math.floor(k * 0.5)),
    dolor: Math.max(1, 6 - Math.floor(k * 0.7)), fatiga: Math.max(1, 5 - Math.floor(k * 0.6)),
  }));
}
set(17, { asistencia: 54 });

// Quiénes respondieron hoy el wellness (22 de 30)
const SIN_RESPONDER = new Set([2, 9, 14, 19, 23, 26, 27, 29]);
for (const j of JUGADORES) j.respondioHoy = !SIN_RESPONDER.has(j.id - 1);

// GPS del último partido (titulares y suplentes que entraron)
JUGADORES.forEach((j, i) => {
  if (i >= 23 || j.estado === "Lesionado") return;
  const titular = i < 15;
  const min = titular ? entre(58, 80) : entre(12, 30);
  const back = j.linea === "Backs";
  j.gps = {
    minutos: min,
    distancia: Math.round((min / 80) * (back ? entre(5900, 7100) : entre(4800, 5900))),
    altaInt: Math.round((min / 80) * (back ? entre(520, 820) : entre(260, 480))),
    velMax: back ? +(entre(290, 340) / 10).toFixed(1) : +(entre(245, 285) / 10).toFixed(1),
    sprints: Math.round((min / 80) * (back ? entre(14, 26) : entre(5, 12))),
  };
});

export function wellnessHoy(j) {
  const d = j.semana[j.semana.length - 1];
  return Math.round(((d.sueno + d.estres + d.dolor + d.fatiga) / 28) * 100);
}
export function wellnessDia(d) {
  return Math.round(((d.sueno + d.estres + d.dolor + d.fatiga) / 28) * 100);
}
export function tendencia(j) {
  const s = j.semana.map(wellnessDia);
  return s[s.length - 1] - s[0];
}

export const RIVALES = ["Atlético del Sur", "Deportivo Ribera", "Club Los Álamos", "Unión Oeste", "Sociedad Norte", "Club Puerto Viejo", "Atlético Llanura"];

export const PARTIDOS = [
  { fecha: "06/09", rival: "Atlético del Sur", condicion: "Local", gf: 27, gc: 19 },
  { fecha: "13/09", rival: "Deportivo Ribera", condicion: "Visitante", gf: 14, gc: 22 },
  { fecha: "20/09", rival: "Club Los Álamos", condicion: "Local", gf: 31, gc: 10 },
  { fecha: "27/09", rival: "Unión Oeste", condicion: "Visitante", gf: 20, gc: 20 },
  { fecha: "04/10", rival: "Sociedad Norte", condicion: "Local", gf: 24, gc: 17 },
  { fecha: "11/10", rival: "Club Puerto Viejo", condicion: "Visitante", gf: 33, gc: 26 },
  { fecha: "18/10", rival: "Atlético Llanura", condicion: "Local", gf: null, gc: null },
];

export const TABLA = [
  { equipo: "Deportivo Ribera", pj: 6, g: 5, e: 0, p: 1, pf: 168, pc: 92, pts: 24 },
  { equipo: "Club Ejemplo", pj: 6, g: 4, e: 1, p: 1, pf: 149, pc: 114, pts: 21, propio: true },
  { equipo: "Atlético Llanura", pj: 6, g: 4, e: 0, p: 2, pf: 140, pc: 101, pts: 19 },
  { equipo: "Unión Oeste", pj: 6, g: 3, e: 1, p: 2, pf: 121, pc: 118, pts: 16 },
  { equipo: "Sociedad Norte", pj: 6, g: 2, e: 0, p: 4, pf: 110, pc: 133, pts: 11 },
  { equipo: "Atlético del Sur", pj: 6, g: 2, e: 0, p: 4, pf: 98, pc: 141, pts: 10 },
  { equipo: "Club Puerto Viejo", pj: 6, g: 1, e: 0, p: 5, pf: 102, pc: 150, pts: 6 },
  { equipo: "Club Los Álamos", pj: 6, g: 1, e: 0, p: 5, pf: 87, pc: 176, pts: 5 },
];

// Videoteca: últimos 3 partidos del próximo rival (Atlético Llanura)
export const VIDEOS_RIVAL = [
  { fecha: "11/10", partido: "Atlético Llanura 29 – 15 Sociedad Norte", duracion: "84 min" },
  { fecha: "04/10", partido: "Unión Oeste 18 – 21 Atlético Llanura", duracion: "81 min" },
  { fecha: "27/09", partido: "Atlético Llanura 12 – 25 Deportivo Ribera", duracion: "86 min" },
];

export const SESION_HOY = [
  { hora: "19:30", bloque: "Entrada en calor y movilidad", min: 15 },
  { hora: "19:45", bloque: "Skills: pase y descarga en contacto", min: 20 },
  { hora: "20:05", bloque: "Forwards: line y maul · Backs: ataque desde scrum", min: 25 },
  { hora: "20:30", bloque: "Juego condicionado 15 vs 15, defensa en las 22", min: 25 },
  { hora: "20:55", bloque: "Vuelta a la calma y charla del sábado", min: 10 },
];
