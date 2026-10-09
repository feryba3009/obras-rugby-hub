import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, actualizarCotizacion, sincronizarHub, ars, fecha } from "./datos";
import { C, titulo, Card, Boton, Logo, Aviso, input, Campo } from "./ui";
import { ResumenPage, HubsPage, CuentasPage, FeedbackPage, AjustesPage } from "./paginas";

const SECCIONES = [
  { key: "resumen", label: "Resumen" },
  { key: "hubs", label: "Hubs" },
  { key: "cuentas", label: "Cuentas" },
  { key: "feedback", label: "Feedback" },
  { key: "ajustes", label: "Ajustes" },
];

export default function App() {
  const [sesion, setSesion] = useState(undefined);
  const [esAdmin, setEsAdmin] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sesion) return setEsAdmin(null);
    supabase.rpc("es_admin").then(({ data }) => setEsAdmin(!!data));
  }, [sesion?.user?.id]);

  if (sesion === undefined) return <Pantalla>Cargando…</Pantalla>;
  if (!sesion) return <Login />;
  if (esAdmin === null) return <Pantalla>Cargando…</Pantalla>;
  if (!esAdmin) {
    return (
      <Pantalla>
        <Card style={{ maxWidth: 420 }}>
          <div style={{ ...titulo, fontSize: 22, marginBottom: 8 }}>Sin acceso</div>
          <div style={{ color: C.suave, fontSize: 15, marginBottom: 16 }}>
            La cuenta {sesion.user.email} no es administradora de ADN Sports. Si recién la creaste, confirmá el email y volvé a entrar.
          </div>
          <Boton onClick={() => supabase.auth.signOut()}>Salir</Boton>
        </Card>
      </Pantalla>
    );
  }
  return <Panel sesion={sesion} />;
}

function Pantalla({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 16, color: C.suave }}>
      <Logo size={40} />
      {children}
    </div>
  );
}

function Login() {
  const [modo, setModo] = useState("ingresar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setMsg(null);
    setCargando(true);
    const fn = modo === "ingresar"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    const { data, error } = await fn;
    setCargando(false);
    if (error) return setMsg({ tipo: "error", texto: error.message });
    if (modo === "crear" && !data.session) {
      setMsg({ tipo: "ok", texto: "Cuenta creada. Revisá tu email para confirmarla y después ingresá." });
      setModo("ingresar");
    }
  }

  return (
    <Pantalla>
      <Card style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ ...titulo, fontSize: 24, marginBottom: 4 }}>Panel de control</div>
        <div style={{ color: C.apagado, fontSize: 14, marginBottom: 16 }}>Solo para administradores de ADN Sports.</div>
        <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Campo label="Email" id="email">
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
          </Campo>
          <Campo label="Contraseña" id="password" ayuda={modo === "crear" ? "Mínimo 6 caracteres." : null}>
            <input id="password" type="password" autoComplete={modo === "crear" ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
          </Campo>
          {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
          <button type="submit" disabled={cargando} style={{ padding: "11px 14px", minHeight: 44, borderRadius: 8, border: "none", background: C.acento, color: C.fondo, fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: cargando ? 0.6 : 1 }}>
            {cargando ? "Un momento…" : modo === "ingresar" ? "Ingresar" : "Crear cuenta"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => { setModo(modo === "ingresar" ? "crear" : "ingresar"); setMsg(null); }}
          style={{ marginTop: 14, background: "none", border: "none", color: C.suave, fontSize: 14, cursor: "pointer", padding: 8, textDecoration: "underline" }}
        >
          {modo === "ingresar" ? "Primera vez: crear mi cuenta" : "Ya tengo cuenta"}
        </button>
      </Card>
    </Pantalla>
  );
}

function Panel({ sesion }) {
  const [seccion, setSeccion] = useState("resumen");
  const [hubs, setHubs] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [actividad, setActividad] = useState({});
  const [feedback, setFeedback] = useState([]);
  const [cotizacion, setCotizacion] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [errores, setErrores] = useState({});

  const cargar = useCallback(async () => {
    const [{ data: h }, { data: c }, { data: a }, { data: f }] = await Promise.all([
      supabase.from("hubs").select("*").order("nombre"),
      supabase.rpc("estado_cuenta"),
      supabase.from("actividad").select("hub_id, tomado_en, datos").order("tomado_en", { ascending: false }).limit(200),
      supabase.from("feedback").select("*").order("creado_en", { ascending: false }),
    ]);
    setHubs(h || []);
    setCuentas(c || []);
    const ultima = {};
    for (const fila of a || []) if (!ultima[fila.hub_id]) ultima[fila.hub_id] = fila;
    setActividad(ultima);
    setFeedback(f || []);
    return { hubs: h || [], ultima };
  }, []);

  const sincronizar = useCallback(async (lista) => {
    setSincronizando(true);
    const errs = {};
    for (const hub of lista) {
      if (hub.estado === "baja") continue;
      try { await sincronizarHub(hub); } catch (e) { errs[hub.id] = e.message; }
    }
    setErrores(errs);
    await cargar();
    setSincronizando(false);
  }, [cargar]);

  useEffect(() => {
    actualizarCotizacion().then(setCotizacion);
    cargar().then(({ hubs: h, ultima }) => {
      // Al entrar, actualiza los Hubs cuya última foto tiene más de 6 horas
      const viejos = h.filter((x) => !ultima[x.id] || Date.now() - new Date(ultima[x.id].tomado_en).getTime() > 6 * 3600e3);
      if (viejos.length) sincronizar(viejos);
    });
  }, [cargar, sincronizar]);

  const pendientesFeedback = useMemo(() => feedback.filter((f) => f.estado === "Recibido").length, [feedback]);
  const ctx = { hubs, cuentas, actividad, feedback, cotizacion, cargar, sincronizar, sincronizando, errores, irA: setSeccion };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 84 }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: C.fondo, borderBottom: `1px solid ${C.borde}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Logo size={28} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {cotizacion && (
              <span style={{ fontSize: 13, color: C.suave }} title={cotizacion.fuente}>
                Dólar BNA {ars(cotizacion.venta)} · {fecha(cotizacion.fecha)}
              </span>
            )}
            <Boton onClick={() => supabase.auth.signOut()} style={{ minHeight: 34, padding: "6px 10px", fontSize: 13 }}>Salir</Boton>
          </div>
        </div>
        <nav aria-label="Secciones" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 8px", display: "flex", gap: 2, overflowX: "auto" }}>
          {SECCIONES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSeccion(s.key)}
              aria-current={seccion === s.key ? "page" : undefined}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "10px 12px", minHeight: 44, fontSize: 15, fontWeight: 600,
                color: seccion === s.key ? C.texto : C.apagado,
                borderBottom: `3px solid ${seccion === s.key ? C.acento : "transparent"}`, whiteSpace: "nowrap",
              }}
            >
              {s.label}
              {s.key === "feedback" && pendientesFeedback > 0 && (
                <span style={{ marginLeft: 6, background: C.acento, color: C.fondo, borderRadius: 999, padding: "1px 7px", fontSize: 12 }}>{pendientesFeedback}</span>
              )}
            </button>
          ))}
        </nav>
      </header>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        {seccion === "resumen" && <ResumenPage {...ctx} />}
        {seccion === "hubs" && <HubsPage {...ctx} />}
        {seccion === "cuentas" && <CuentasPage {...ctx} />}
        {seccion === "feedback" && <FeedbackPage {...ctx} />}
        {seccion === "ajustes" && <AjustesPage {...ctx} sesion={sesion} />}
      </main>
    </div>
  );
}
