// Base de datos de mentira para la DEMO: reemplaza a Supabase cuando la app se compila con VITE_DEMO=1.
// Todo vive en el navegador (sessionStorage): no hay cuentas, no se conecta a ninguna base real y lo que
// se toca se borra al cerrar la pestaña. Implementa lo que la app usa del cliente de Supabase:
// from(tabla) con select/insert/upsert/update/delete y sus filtros, rpc, auth y storage.
import { generarDatos, CLUB_ID, UID_STAFF, UID_JUGADOR, VARIANTE } from "./datos.js";

const CLAVE_DB = `adn-demo-db-${VARIANTE}`;  // cada demo guarda sus datos aparte
const CLAVE_ROL = "adn-demo-rol";
const hoyClave = () => new Date().toDateString();

function leerSS(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function escribirSS(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* nada */ } }

let db = null;
function base() {
  if (db) return db;
  try {
    const g = JSON.parse(leerSS(CLAVE_DB) || "null");
    if (g && g.dia === hoyClave()) db = g.datos;
  } catch { /* nada */ }
  if (!db) { db = generarDatos(); guardar(); }
  return db;
}
function guardar() { escribirSS(CLAVE_DB, JSON.stringify({ dia: hoyClave(), datos: db })); }
const tabla = (t) => (base()[t] = base()[t] || []);
const uid = () => "demo-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const copia = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

export function mantenerSesion() { return true; }
export function setMantenerSesion() { /* en la demo no aplica */ }

// ── Relaciones que la app pide con select("…, tabla(campos)") ──
const RELACIONES = {
  jugadores: { tabla: "jugadores", fk: "jugador_id" },
  equipos_rivales: { tabla: "equipos_rivales", fk: (t) => (t === "posiciones" ? "equipo_id" : "rival_id") },
  partidos_liga: { tabla: "partidos_liga", fk: "partido_liga_id" },
  categorias: { tabla: "categorias", fk: "categoria_id" },
  profiles: { tabla: "profiles", fk: "perfil_id" },
  historial_medico: { tabla: "historial_medico", muchos: "jugador_id" },
};

function partirCampos(s) {
  const out = [];
  let prof = 0, act = "";
  for (const ch of s) {
    if (ch === "(") prof++;
    if (ch === ")") prof--;
    if (ch === "," && prof === 0) { out.push(act.trim()); act = ""; } else act += ch;
  }
  if (act.trim()) out.push(act.trim());
  return out;
}
function proyectar(t, fila, campos) {
  const lista = partirCampos(campos || "*");
  const res = lista.includes("*") ? { ...fila } : {};
  for (const c of lista) {
    if (c === "*") continue;
    const m = c.match(/^([a-z_]+)(!inner)?\((.*)\)$/s);
    if (m) {
      const rel = RELACIONES[m[1]];
      if (!rel) { res[m[1]] = null; continue; }
      if (rel.muchos) {
        res[m[1]] = tabla(rel.tabla).filter((x) => x[rel.muchos] === fila.id).map((x) => proyectar(rel.tabla, x, m[3]));
      } else {
        const fk = typeof rel.fk === "function" ? rel.fk(t) : rel.fk;
        const rf = tabla(rel.tabla).find((x) => x.id === fila[fk]);
        if (!rf && m[2]) return null; // !inner sin relación: la fila no va
        res[m[1]] = rf ? proyectar(rel.tabla, rf, m[3]) : null;
      }
    } else {
      const [nombre, alias] = c.split(":").reverse();
      res[alias || nombre] = fila[nombre] ?? null;
    }
  }
  return res;
}

const igual = (a, b) => a === b || (a != null && b != null && String(a) === String(b));
const cmp = (a, b) => (a == null ? -1 : b == null ? 1 : typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));
const valorTexto = (v) => (v === "true" ? true : v === "false" ? false : v === "null" ? null : v);
function condicion(col, op, val) {
  switch (op) {
    case "eq": return (r) => igual(r[col], val);
    case "neq": return (r) => !igual(r[col], val);
    case "gt": return (r) => r[col] != null && cmp(r[col], val) > 0;
    case "gte": return (r) => r[col] != null && cmp(r[col], val) >= 0;
    case "lt": return (r) => r[col] != null && cmp(r[col], val) < 0;
    case "lte": return (r) => r[col] != null && cmp(r[col], val) <= 0;
    case "is": return (r) => (val === null ? r[col] == null : r[col] === val);
    case "in": {
      const arr = Array.isArray(val) ? val : String(val).replace(/^\(|\)$/g, "").split(",");
      return (r) => arr.some((v) => igual(r[col], v));
    }
    case "ilike": case "like": {
      const re = new RegExp("^" + String(val).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", op === "ilike" ? "i" : "");
      return (r) => re.test(String(r[col] ?? ""));
    }
    case "cs": case "contains": return (r) => Array.isArray(r[col]) && [].concat(val).every((v) => r[col].includes(v));
    default: return () => true;
  }
}

class Consulta {
  constructor(t) { this.t = t; this.filtros = []; this.op = "select"; this.campos = "*"; this.orden = []; this.lim = null; this.rango = null; this.uno = null; this.carga = null; this.opc = {}; this.devolver = false; this.contar = null; }
  select(c = "*", o = {}) { if (this.op === "select") { this.campos = c; this.contar = o.count || null; this.soloCuenta = !!o.head; } else { this.devolver = true; this.campos = c; } return this; }
  insert(f) { this.op = "insert"; this.carga = f; return this; }
  upsert(f, o = {}) { this.op = "upsert"; this.carga = f; this.opc = o; return this; }
  update(v) { this.op = "update"; this.carga = v; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c, v) { this.filtros.push(condicion(c, "eq", v)); return this; }
  neq(c, v) { this.filtros.push(condicion(c, "neq", v)); return this; }
  gt(c, v) { this.filtros.push(condicion(c, "gt", v)); return this; }
  gte(c, v) { this.filtros.push(condicion(c, "gte", v)); return this; }
  lt(c, v) { this.filtros.push(condicion(c, "lt", v)); return this; }
  lte(c, v) { this.filtros.push(condicion(c, "lte", v)); return this; }
  is(c, v) { this.filtros.push(condicion(c, "is", v)); return this; }
  in(c, v) { this.filtros.push(condicion(c, "in", v)); return this; }
  like(c, v) { this.filtros.push(condicion(c, "like", v)); return this; }
  ilike(c, v) { this.filtros.push(condicion(c, "ilike", v)); return this; }
  contains(c, v) { this.filtros.push(condicion(c, "contains", v)); return this; }
  match(o) { Object.entries(o).forEach(([c, v]) => this.eq(c, v)); return this; }
  filter(c, op, v) { this.filtros.push(condicion(c, op, valorTexto(v))); return this; }
  not(c, op, v) { const f = condicion(c, op, valorTexto(v)); this.filtros.push((r) => !f(r)); return this; }
  or(s) {
    const partes = String(s).split(",").map((p) => { const [c, op, ...v] = p.split("."); return condicion(c, op, valorTexto(v.join("."))); });
    this.filtros.push((r) => partes.some((f) => f(r)));
    return this;
  }
  order(c, o = {}) { this.orden.push([c, o.ascending !== false, o.nullsFirst]); return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.rango = [a, b]; return this; }
  single() { this.uno = "single"; return this; }
  maybeSingle() { this.uno = "maybe"; return this; }
  abortSignal() { return this; }
  then(ok, mal) { return Promise.resolve().then(() => this.correr()).then(ok, mal); }
  catch(mal) { return this.then(undefined, mal); }

  correr() {
    const filas = tabla(this.t);
    const pasa = (r) => this.filtros.every((f) => f(r));
    let res = [];
    if (this.op === "select") {
      res = filas.filter(pasa);
    } else if (this.op === "insert" || this.op === "upsert") {
      const nuevos = [].concat(this.carga || []);
      const claves = (this.opc.onConflict || "id").split(",").map((x) => x.trim());
      for (const n of nuevos) {
        let existente = this.op === "upsert" ? filas.find((r) => claves.every((k) => n[k] !== undefined && igual(r[k], n[k]))) : null;
        if (existente) { Object.assign(existente, n); res.push(existente); }
        else {
          const fila = { id: uid(), club_id: CLUB_ID, created_at: new Date().toISOString(), ...n };
          filas.push(fila);
          res.push(fila);
        }
      }
      guardar();
    } else if (this.op === "update") {
      res = filas.filter(pasa);
      res.forEach((r) => Object.assign(r, this.carga));
      guardar();
    } else if (this.op === "delete") {
      res = filas.filter(pasa);
      base()[this.t] = filas.filter((r) => !pasa(r));
      guardar();
    }
    if (this.op !== "select" && !this.devolver) return { data: null, error: null, count: res.length };
    for (const [c, asc] of [...this.orden].reverse()) res = [...res].sort((a, b) => (asc ? 1 : -1) * cmp(a[c], b[c]));
    const total = res.length;
    if (this.rango) res = res.slice(this.rango[0], this.rango[1] + 1);
    if (this.lim != null) res = res.slice(0, this.lim);
    let data = res.map((r) => proyectar(this.t, r, this.campos)).filter(Boolean).map(copia);
    if (this.soloCuenta) return { data: null, error: null, count: total };
    if (this.uno === "single") {
      if (data.length !== 1) return { data: null, error: { message: "No se encontró el dato", code: "PGRST116" } };
      return { data: data[0], error: null };
    }
    if (this.uno === "maybe") return { data: data[0] ?? null, error: null };
    return { data, error: null, count: this.contar ? total : null };
  }
}

// ── Funciones del servidor (rpc) que usa la app ──
const perfilActual = () => tabla("profiles").find((p) => p.auth_user_id === sesion()?.user?.id) || null;
function ganadoresMvp() {
  const porPartido = {};
  tabla("votos_partido").forEach((v) => { (porPartido[v.partido_id] = porPartido[v.partido_id] || {})[v.jugador_id] = (porPartido[v.partido_id]?.[v.jugador_id] || 0) + 1; });
  const out = [];
  for (const [partido_id, conteo] of Object.entries(porPartido)) {
    const p = tabla("partidos").find((x) => x.id === partido_id);
    if (!p || (p.votacion_abre_at && Date.now() < new Date(p.votacion_abre_at).getTime() + 86400000)) continue;
    const total = Object.values(conteo).reduce((a, b) => a + b, 0);
    const max = Math.max(...Object.values(conteo));
    for (const [jugador_id, votos] of Object.entries(conteo)) if (votos === max) out.push({ partido_id, jugador_id, votos, total });
  }
  return out;
}
const RPC = {
  club_publico: () => tabla("clubes").map(({ id, slug, nombre, nombre_corto, logo_url, color_primario, color_secundario }) => ({ id, slug, nombre, nombre_corto, logo_url, color_primario, color_secundario })),
  jugadores_para_registro: () => tabla("jugadores").filter((j) => !tabla("profiles").some((p) => p.jugador_id === j.id)).map((j) => ({ id: j.id, nombre: j.nombre })),
  mvp_ganadores: () => ganadoresMvp(),
  mvp_resultado: ({ p_partido } = {}) => {
    const c = {};
    tabla("votos_partido").filter((v) => v.partido_id === p_partido).forEach((v) => { c[v.jugador_id] = (c[v.jugador_id] || 0) + 1; });
    return Object.entries(c).map(([jugador_id, votos]) => ({ jugador_id, votos })).sort((a, b) => b.votos - a.votos);
  },
  estado_notificaciones_plantel: () => tabla("profiles").filter((p) => p.jugador_id && p.confirmado).map((p, k) => {
    const j = tabla("jugadores").find((x) => x.id === p.jugador_id) || {};
    const si = k % 3 !== 1;
    return { jugador_id: j.id, nombre: j.nombre, posicion: j.posicion_ideal, activadas: si, dispositivos: si ? 1 : 0 };
  }).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))),
  wellness_mi_ventana: () => ({ abre: "07:00", cierra: "23:00", abierta: true }),
  estado_videoteca: () => [],
  rival_cargo_video: () => false,
  reportar_error: () => null,
  contar_errores: () => [{ cantidad: 0, usuarios: 0, distintos: 0 }],
};

// ── Sesión: se entra con un botón como staff o como jugador ──
const oyentes = new Set();
function sesion() {
  const rol = leerSS(CLAVE_ROL);
  if (!rol) return null;
  const id = rol === "jugador" ? UID_JUGADOR : UID_STAFF;
  return { access_token: "demo", token_type: "bearer", user: { id, email: `${rol}@demo.adnsports`, user_metadata: {} } };
}
function avisar(evento) { const s = sesion(); oyentes.forEach((cb) => { try { cb(evento, s); } catch { /* nada */ } }); }

export function entrarDemo(rol) {
  escribirSS(CLAVE_ROL, rol === "jugador" ? "jugador" : "staff");
  avisar("SIGNED_IN");
}
export function rolDemo() { return leerSS(CLAVE_ROL); }
export function reiniciarDemo() { escribirSS(CLAVE_DB, null); db = null; }

export const supabase = {
  from: (t) => new Consulta(t),
  rpc: (nombre, args) => {
    const f = RPC[nombre];
    const p = Promise.resolve().then(() => ({ data: f ? copia(f(args || {})) : null, error: null }));
    return { then: (ok, mal) => p.then(ok, mal), catch: (mal) => p.catch(mal) };
  },
  functions: { invoke: async () => ({ data: { ok: true, demo: true }, error: null }) },
  storage: {
    from: () => ({
      upload: async (ruta) => ({ data: { path: ruta }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: VARIANTE === "generico" ? "/logo-adn.svg" : "/escudo-berazategui.png" } }),
      remove: async () => ({ data: [], error: null }),
      list: async () => ({ data: [], error: null }),
    }),
  },
  auth: {
    getSession: async () => ({ data: { session: sesion() }, error: null }),
    getUser: async () => ({ data: { user: sesion()?.user || null }, error: null }),
    onAuthStateChange: (cb) => {
      oyentes.add(cb);
      setTimeout(() => { try { cb("INITIAL_SESSION", sesion()); } catch { /* nada */ } }, 0);
      return { data: { subscription: { unsubscribe: () => oyentes.delete(cb) } } };
    },
    signInWithPassword: async () => ({ data: null, error: { message: "En la demo no hace falta cuenta: entrá con los botones." } }),
    signUp: async () => ({ data: null, error: { message: "En la demo no se crean cuentas: entrá con los botones." } }),
    signOut: async () => { escribirSS(CLAVE_ROL, null); avisar("SIGNED_OUT"); return { error: null }; },
    updateUser: async () => ({ data: { user: sesion()?.user }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
  },
  channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }),
  // Solo existe en la demo: entrar con un botón, saber con qué rol, empezar de cero.
  demo: { entrar: entrarDemo, rol: rolDemo, reiniciar: reiniciarDemo },
  removeChannel: () => {},
};
export { perfilActual };
