import React, { useEffect, useMemo, useState } from "react";
import { supabase, ars, usd, fecha, haceCuanto, hoyISO, responderFeedback } from "./datos";
import { C, titulo, Card, Titulo, Boton, Etiqueta, Aviso, Campo, input, Dato, Grilla } from "./ui";

const COLOR_ESTADO_HUB = { activo: C.ok, prueba: C.alerta, suspendido: C.error, baja: C.apagado };
const COLOR_FEEDBACK = { Recibido: C.acento, "En curso": C.alerta, Resuelto: C.ok, Descartado: C.apagado };
const COLOR_PRIORIDAD = { Baja: C.apagado, Normal: C.suave, Alta: C.alerta, Urgente: C.error };

function sumaClubes(act) {
  const clubes = act?.datos?.clubes || [];
  const t = {};
  for (const c of clubes) for (const [k, v] of Object.entries(c)) if (typeof v === "number") t[k] = (t[k] || 0) + v;
  t.ultimo_ingreso = clubes.map((c) => c.ultimo_ingreso).filter(Boolean).sort().pop() || null;
  return t;
}

function cuentaDe(cuentas, hubId) {
  return cuentas.find((c) => c.hub_id === hubId);
}

// ===================================== RESUMEN =====================================
export function ResumenPage({ hubs, cuentas, actividad, feedback, sincronizar, sincronizando, errores, irA }) {
  const activos = hubs.filter((h) => h.estado === "activo");
  const mrr = useMemo(() => {
    return cuentas
      .filter((c) => c.estado === "activo")
      .reduce((s, c) => s + Number(c.precio_usd) / c.meses, 0);
  }, [cuentas]);
  const deuda = cuentas.reduce((s, c) => s + Math.max(Number(c.saldo_usd), 0), 0);
  const vencidos = cuentas.filter((c) => Number(c.saldo_usd) > 0);
  const sinUso = hubs.filter((h) => h.estado !== "baja" && actividad[h.id] && sumaClubes(actividad[h.id]).activos_7d === 0);
  const fbPendiente = feedback.filter((f) => f.estado === "Recibido");
  const proximos = cuentas
    .filter((c) => c.proximo_vencimiento && Number(c.saldo_usd) <= 0)
    .filter((c) => (new Date(c.proximo_vencimiento) - new Date()) / 864e5 <= (c.meses === 12 ? 30 : 7))
    .sort((a, b) => a.proximo_vencimiento.localeCompare(b.proximo_vencimiento));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <Grilla min={140}>
          <Dato label="Hubs activos" valor={`${activos.length} / ${hubs.filter((h) => h.estado !== "baja").length}`} />
          <Dato label="Ingreso mensual" valor={usd(mrr)} />
          <Dato label="Por cobrar" valor={usd(deuda)} color={deuda > 0 ? C.error : C.texto} />
          <Dato label="Feedback sin responder" valor={fbPendiente.length} color={fbPendiente.length ? C.acento : C.texto} />
        </Grilla>
      </Card>

      <Card>
        <Titulo extra={<Boton onClick={() => sincronizar(hubs)} disabled={sincronizando}>{sincronizando ? "Actualizando…" : "Actualizar actividad"}</Boton>}>
          Para atender
        </Titulo>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {vencidos.map((c) => (
            <Fila key={"v" + c.hub_id} color={C.error} onClick={() => irA("cuentas")}>
              <b>{c.hub}</b> debe {usd(c.saldo_usd)} · impago desde {fecha(c.impago_desde)} ({c.dias_atraso} días)
            </Fila>
          ))}
          {sinUso.map((h) => (
            <Fila key={"u" + h.id} color={C.alerta} onClick={() => irA("hubs")}>
              <b>{h.nombre}</b>: nadie ingresó en los últimos 7 días
            </Fila>
          ))}
          {fbPendiente.slice(0, 5).map((f) => (
            <Fila key={"f" + f.id} color={C.acento} onClick={() => irA("feedback")}>
              <b>{f.tipo}</b> de {f.autor || "un encargado"} ({f.club}): {f.mensaje.slice(0, 90)}{f.mensaje.length > 90 ? "…" : ""}
            </Fila>
          ))}
          {proximos.map((c) => (
            <Fila key={"p" + c.hub_id} color={C.suave} onClick={() => irA("cuentas")}>
              <b>{c.hub}</b> vence el {fecha(c.proximo_vencimiento)} ({usd(c.precio_usd)})
            </Fila>
          ))}
          {Object.entries(errores).map(([id, msg]) => (
            <Fila key={"e" + id} color={C.error} onClick={() => irA("hubs")}>
              No se pudo leer <b>{hubs.find((h) => h.id === id)?.nombre}</b>: {msg}
            </Fila>
          ))}
          {!vencidos.length && !sinUso.length && !fbPendiente.length && !proximos.length && !Object.keys(errores).length && (
            <Aviso tipo="ok">Todo en orden.</Aviso>
          )}
        </div>
      </Card>

      <Card>
        <Titulo>Actividad por Hub</Titulo>
        <TablaActividad hubs={hubs.filter((h) => h.estado !== "baja")} actividad={actividad} />
      </Card>
    </div>
  );
}

function Fila({ color, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left", background: C.panel2, border: "none", borderLeft: `4px solid ${color}`, borderRadius: 8,
        padding: "10px 12px", color: C.texto, fontSize: 15, cursor: "pointer", lineHeight: 1.35,
      }}
    >
      {children}
    </button>
  );
}

function TablaActividad({ hubs, actividad }) {
  if (!hubs.length) return <Aviso>Todavía no hay Hubs cargados.</Aviso>;
  const th = { textAlign: "right", padding: "8px 10px", fontSize: 12, color: C.apagado, fontWeight: 600, whiteSpace: "nowrap" };
  const td = { textAlign: "right", padding: "10px", fontSize: 15, fontVariantNumeric: "tabular-nums", borderTop: `1px solid ${C.borde}` };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Hub</th>
            <th style={th}>Usuarios</th>
            <th style={th}>Activos 7 d</th>
            <th style={th}>Último ingreso</th>
            <th style={th}>Wellness 7 d</th>
            <th style={th}>Asistencias 7 d</th>
            <th style={th}>Videos</th>
            <th style={th}>Actualizado</th>
          </tr>
        </thead>
        <tbody>
          {hubs.map((h) => {
            const a = actividad[h.id];
            const t = sumaClubes(a);
            return (
              <tr key={h.id}>
                <td style={{ ...td, textAlign: "left" }}>{h.nombre}</td>
                <td style={td}>{a ? t.usuarios ?? 0 : "—"}</td>
                <td style={{ ...td, color: a && !t.activos_7d ? C.alerta : C.texto }}>{a ? t.activos_7d ?? 0 : "—"}</td>
                <td style={td}>{a ? haceCuanto(t.ultimo_ingreso) : "—"}</td>
                <td style={td}>{a ? t.wellness_7d ?? 0 : "—"}</td>
                <td style={td}>{a ? t.asistencias_7d ?? 0 : "—"}</td>
                <td style={td}>{a ? t.videos ?? 0 : "—"}</td>
                <td style={{ ...td, color: C.apagado, fontSize: 13 }}>{a ? haceCuanto(a.tomado_en) : "nunca"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ======================================= HUBS =======================================
const HUB_VACIO = {
  nombre: "", club: "", disciplina: "Rugby", url: "", supabase_url: "", anon_key: "", token: "", club_slug: "",
  encargado_nombre: "", encargado_email: "", encargado_telefono: "", estado: "prueba", plan: "mensual",
  fecha_alta: hoyISO(), inicio_facturacion: hoyISO(), fecha_baja: "", notas: "",
};

export function HubsPage({ hubs, cuentas, actividad, cargar, sincronizar, sincronizando, errores }) {
  const [editando, setEditando] = useState(null);
  const [abierto, setAbierto] = useState(null);

  if (editando) return <FormHub hub={editando} onCerrar={() => setEditando(null)} onGuardado={async () => { setEditando(null); await cargar(); }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Titulo extra={<Boton principal onClick={() => setEditando({ ...HUB_VACIO })}>Nuevo Hub</Boton>}>Hubs</Titulo>
      {!hubs.length && <Aviso>Todavía no hay Hubs cargados.</Aviso>}
      {hubs.map((h) => {
        const a = actividad[h.id];
        const t = sumaClubes(a);
        const c = cuentaDe(cuentas, h.id);
        const ab = abierto === h.id;
        return (
          <Card key={h.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <div style={{ ...titulo, fontSize: 22 }}>{h.nombre}</div>
                <div style={{ color: C.apagado, fontSize: 14 }}>{h.club} · {h.disciplina}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Etiqueta color={COLOR_ESTADO_HUB[h.estado]}>{h.estado}</Etiqueta>
                <Etiqueta>Plan {h.plan}</Etiqueta>
                {c && Number(c.saldo_usd) > 0 && <Etiqueta color={C.error}>Debe {usd(c.saldo_usd)}</Etiqueta>}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <Grilla min={120}>
                <Dato label="Usuarios" valor={a ? t.usuarios ?? 0 : "—"} />
                <Dato label="Activos 7 d" valor={a ? t.activos_7d ?? 0 : "—"} color={a && !t.activos_7d ? C.alerta : undefined} />
                <Dato label="Jugadores" valor={a ? t.jugadores ?? 0 : "—"} />
                <Dato label="Wellness 7 d" valor={a ? t.wellness_7d ?? 0 : "—"} />
              </Grilla>
            </div>
            {errores[h.id] && <Aviso tipo="error">{errores[h.id]}</Aviso>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <Boton onClick={() => setAbierto(ab ? null : h.id)}>{ab ? "Ocultar detalle" : "Ver detalle"}</Boton>
              <Boton onClick={() => sincronizar([h])} disabled={sincronizando}>Actualizar</Boton>
              <Boton onClick={() => setEditando({ ...HUB_VACIO, ...h, fecha_baja: h.fecha_baja || "" })}>Editar</Boton>
              {h.url && <a href={h.url} target="_blank" rel="noreferrer" style={{ alignSelf: "center", fontSize: 14 }}>Abrir Hub ↗</a>}
            </div>
            {ab && <DetalleHub hub={h} act={a} />}
          </Card>
        );
      })}
    </div>
  );
}

function DetalleHub({ hub, act }) {
  const clubes = act?.datos?.clubes || [];
  const filas = [
    ["Usuarios", "usuarios"], ["Cuentas por aprobar", "usuarios_pendientes"], ["Activos 7 días", "activos_7d"],
    ["Activos 30 días", "activos_30d"], ["Jugadores", "jugadores"], ["Wellness 7 días", "wellness_7d"],
    ["Asistencias 7 días", "asistencias_7d"], ["Evaluaciones 30 días", "evaluaciones_30d"], ["Partidos", "partidos"],
    ["Partidos jugados", "partidos_jugados"], ["Registros GPS", "gps_registros"], ["Videos", "videos"],
    ["Notificaciones 7 días", "notificaciones_7d"],
  ];
  return (
    <div style={{ marginTop: 16, borderTop: `1px solid ${C.borde}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, fontSize: 14 }}>
        <div><span style={{ color: C.apagado }}>Encargado: </span>{hub.encargado_nombre || "—"}</div>
        <div><span style={{ color: C.apagado }}>Email: </span>{hub.encargado_email || "—"}</div>
        <div><span style={{ color: C.apagado }}>Teléfono: </span>{hub.encargado_telefono || "—"}</div>
        <div><span style={{ color: C.apagado }}>Alta: </span>{fecha(hub.fecha_alta)}</div>
        <div><span style={{ color: C.apagado }}>Factura desde: </span>{fecha(hub.inicio_facturacion)}</div>
        <div><span style={{ color: C.apagado }}>Último dato: </span>{act ? haceCuanto(act.tomado_en) : "nunca"}</div>
      </div>
      {hub.notas && <div style={{ fontSize: 14, color: C.suave, whiteSpace: "pre-wrap" }}>{hub.notas}</div>}
      {clubes.map((c) => (
        <div key={c.slug}>
          {clubes.length > 1 && <div style={{ fontWeight: 600, marginBottom: 6 }}>{c.club}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "6px 16px", fontSize: 14 }}>
            {filas.map(([label, k]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: `1px solid ${C.borde}`, padding: "5px 0" }}>
                <span style={{ color: C.apagado }}>{label}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{c[k] ?? 0}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: C.apagado, marginTop: 6 }}>Último ingreso: {c.ultimo_ingreso ? fecha(c.ultimo_ingreso) : "nunca"}</div>
        </div>
      ))}
      <div style={{ fontSize: 12, color: C.apagado }}>El panel solo recibe cantidades: nunca ve datos de jugadores.</div>
    </div>
  );
}

function FormHub({ hub, onCerrar, onGuardado }) {
  const [f, setF] = useState(hub);
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function guardar() {
    if (!f.nombre.trim() || !f.club.trim()) return setMsg("Completá el nombre del Hub y el club.");
    setGuardando(true);
    const fila = { ...f, fecha_baja: f.fecha_baja || null };
    delete fila.created_at;
    const q = f.id ? supabase.from("hubs").update(fila).eq("id", f.id) : supabase.from("hubs").insert(fila);
    const { error } = await q;
    setGuardando(false);
    if (error) return setMsg("No se pudo guardar: " + error.message);
    onGuardado();
  }

  const t = (k, label, extra = {}) => (
    <Campo label={label} id={"h-" + k}>
      <input id={"h-" + k} value={f[k] ?? ""} onChange={set(k)} style={input} {...extra} />
    </Campo>
  );

  return (
    <Card>
      <Titulo>{f.id ? `Editar ${hub.nombre}` : "Nuevo Hub"}</Titulo>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {t("nombre", "Nombre del Hub")}
        {t("club", "Club")}
        {t("disciplina", "Disciplina")}
        <Campo label="Estado" id="h-estado">
          <select id="h-estado" value={f.estado} onChange={set("estado")} style={input}>
            <option value="prueba">En prueba (no se cobra)</option>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
            <option value="baja">Baja</option>
          </select>
        </Campo>
        <Campo label="Plan" id="h-plan">
          <select id="h-plan" value={f.plan} onChange={set("plan")} style={input}>
            <option value="mensual">Mensual · USD 30</option>
            <option value="anual">Anual · USD 300</option>
          </select>
        </Campo>
        {t("fecha_alta", "Fecha de alta", { type: "date" })}
        {t("inicio_facturacion", "Inicio de facturación", { type: "date" })}
        {t("fecha_baja", "Fecha de baja (opcional)", { type: "date" })}
        {t("encargado_nombre", "Encargado")}
        {t("encargado_email", "Email del encargado", { type: "email" })}
        {t("encargado_telefono", "Teléfono del encargado", { type: "tel" })}
        {t("url", "Dirección del Hub", { type: "url", placeholder: "https://…" })}
      </div>
      <div style={{ ...titulo, fontSize: 18, margin: "18px 0 8px" }}>Conexión</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {t("supabase_url", "URL de Supabase del Hub", { placeholder: "https://xxxx.supabase.co" })}
        {t("anon_key", "Clave pública del Hub")}
        {t("token", "Token del panel", { type: "password", autoComplete: "off" })}
        {t("club_slug", "Club dentro del Hub (slug)", { placeholder: "obras" })}
      </div>
      <div style={{ marginTop: 12 }}>
        <Campo label="Notas" id="h-notas">
          <textarea id="h-notas" rows={3} value={f.notas ?? ""} onChange={set("notas")} style={{ ...input, resize: "vertical" }} />
        </Campo>
      </div>
      {msg && <Aviso tipo="error">{msg}</Aviso>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Boton principal onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Boton>
        <Boton onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Card>
  );
}

// ====================================== CUENTAS ======================================
export function CuentasPage({ hubs, cuentas, cotizacion, cargar }) {
  const [hubSel, setHubSel] = useState(null);
  const total = cuentas.reduce((s, c) => s + Math.max(Number(c.saldo_usd), 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Titulo extra={<Etiqueta color={total > 0 ? C.error : C.ok}>Por cobrar {usd(total)}</Etiqueta>}>Estados de cuenta</Titulo>
      <div style={{ fontSize: 14, color: C.apagado }}>
        Cuota por período adelantado desde el inicio de facturación: USD 30 por mes o USD 300 por año. Los Hubs en prueba no generan cargos.
      </div>
      {cuentas.map((c) => {
        const sel = hubSel === c.hub_id;
        const saldo = Number(c.saldo_usd);
        return (
          <Card key={c.hub_id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ ...titulo, fontSize: 20 }}>{c.hub}</div>
                <div style={{ color: C.apagado, fontSize: 14 }}>
                  Plan {c.plan} · {usd(c.precio_usd)} · {c.estado}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...titulo, fontSize: 26, color: saldo > 0 ? C.error : saldo < 0 ? C.ok : C.texto }}>
                  {saldo > 0 ? `Debe ${usd(saldo)}` : saldo < 0 ? `A favor ${usd(-saldo)}` : "Al día"}
                </div>
                {saldo > 0 && <div style={{ fontSize: 13, color: C.error }}>impago desde {fecha(c.impago_desde)} · {c.dias_atraso} días</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14, color: C.suave, marginTop: 10 }}>
              <span>Cargos {usd(c.cargos_usd)}</span>
              {Number(c.ajustes_usd) !== 0 && <span>Ajustes {usd(c.ajustes_usd)}</span>}
              <span>Pagado {usd(c.pagos_usd)}</span>
              <span>Último pago {fecha(c.ultimo_pago)}</span>
              <span>Próximo vencimiento {fecha(c.proximo_vencimiento)}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <Boton onClick={() => setHubSel(sel ? null : c.hub_id)}>{sel ? "Cerrar" : "Pagos y ajustes"}</Boton>
            </div>
            {sel && <Movimientos hub={hubs.find((h) => h.id === c.hub_id)} cotizacion={cotizacion} onCambio={cargar} />}
          </Card>
        );
      })}
      {!cuentas.length && <Aviso>Todavía no hay Hubs cargados.</Aviso>}
    </div>
  );
}

function Movimientos({ hub, cotizacion, onCambio }) {
  const [pagos, setPagos] = useState([]);
  const [ajustes, setAjustes] = useState([]);
  const [p, setP] = useState({ fecha: hoyISO(), moneda: "ARS", monto: "", cotizacion: cotizacion?.venta ?? "", medio: "Transferencia", nota: "" });
  const [a, setA] = useState({ fecha: hoyISO(), monto_usd: "", motivo: "" });
  const [msg, setMsg] = useState(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    Promise.all([
      supabase.from("pagos").select("*").eq("hub_id", hub.id).order("fecha", { ascending: false }),
      supabase.from("ajustes").select("*").eq("hub_id", hub.id).order("fecha", { ascending: false }),
    ]).then(([{ data: pg }, { data: aj }]) => { setPagos(pg || []); setAjustes(aj || []); });
  }, [hub.id, recarga]);

  // Al cambiar la fecha del pago, propone la cotización guardada de ese día (o la última anterior)
  async function cambiarFecha(v) {
    setP((x) => ({ ...x, fecha: v }));
    const { data } = await supabase.from("cotizaciones").select("venta").lte("fecha", v).order("fecha", { ascending: false }).limit(1).maybeSingle();
    if (data?.venta) setP((x) => ({ ...x, cotizacion: data.venta }));
  }

  const equivalente = p.moneda === "USD" ? Number(p.monto || 0) : Number(p.monto || 0) / Number(p.cotizacion || 1);

  async function guardarPago() {
    setMsg(null);
    if (!(Number(p.monto) > 0)) return setMsg({ tipo: "error", texto: "Ingresá el monto." });
    if (p.moneda === "ARS" && !(Number(p.cotizacion) > 0)) return setMsg({ tipo: "error", texto: "Falta la cotización." });
    const { error } = await supabase.from("pagos").insert({
      hub_id: hub.id, fecha: p.fecha, moneda: p.moneda, monto: Number(p.monto),
      cotizacion: p.moneda === "ARS" ? Number(p.cotizacion) : null, medio: p.medio || null, nota: p.nota || null,
    });
    if (error) return setMsg({ tipo: "error", texto: error.message });
    setP({ ...p, monto: "", nota: "" });
    setMsg({ tipo: "ok", texto: "Pago registrado." });
    setRecarga((n) => n + 1);
    onCambio();
  }

  async function guardarAjuste() {
    setMsg(null);
    if (!Number(a.monto_usd) || !a.motivo.trim()) return setMsg({ tipo: "error", texto: "Completá monto y motivo del ajuste." });
    const { error } = await supabase.from("ajustes").insert({ hub_id: hub.id, fecha: a.fecha, monto_usd: Number(a.monto_usd), motivo: a.motivo.trim() });
    if (error) return setMsg({ tipo: "error", texto: error.message });
    setA({ ...a, monto_usd: "", motivo: "" });
    setMsg({ tipo: "ok", texto: "Ajuste registrado." });
    setRecarga((n) => n + 1);
    onCambio();
  }

  async function borrar(tabla, id) {
    if (!window.confirm("¿Borrar este movimiento? No se puede deshacer.")) return;
    const { error } = await supabase.from(tabla).delete().eq("id", id);
    if (error) return setMsg({ tipo: "error", texto: error.message });
    setRecarga((n) => n + 1);
    onCambio();
  }

  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 };
  return (
    <div style={{ marginTop: 16, borderTop: `1px solid ${C.borde}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ ...titulo, fontSize: 18, marginBottom: 8 }}>Registrar pago</div>
        <div style={grid}>
          <Campo label="Fecha" id="p-fecha"><input id="p-fecha" type="date" value={p.fecha} onChange={(e) => cambiarFecha(e.target.value)} style={input} /></Campo>
          <Campo label="Moneda" id="p-moneda">
            <select id="p-moneda" value={p.moneda} onChange={(e) => setP({ ...p, moneda: e.target.value })} style={input}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </Campo>
          <Campo label="Monto" id="p-monto"><input id="p-monto" type="number" inputMode="decimal" min="0" step="0.01" value={p.monto} onChange={(e) => setP({ ...p, monto: e.target.value })} style={input} /></Campo>
          {p.moneda === "ARS" && (
            <Campo label="Dólar BNA" id="p-cot" ayuda="Se propone sola; podés corregirla.">
              <input id="p-cot" type="number" inputMode="decimal" min="0" step="0.01" value={p.cotizacion} onChange={(e) => setP({ ...p, cotizacion: e.target.value })} style={input} />
            </Campo>
          )}
          <Campo label="Medio" id="p-medio"><input id="p-medio" value={p.medio} onChange={(e) => setP({ ...p, medio: e.target.value })} style={input} /></Campo>
          <Campo label="Nota" id="p-nota"><input id="p-nota" value={p.nota} onChange={(e) => setP({ ...p, nota: e.target.value })} style={input} /></Campo>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          <Boton principal onClick={guardarPago}>Registrar pago</Boton>
          {Number(p.monto) > 0 && <span style={{ color: C.suave, fontSize: 14 }}>Equivale a {usd(equivalente.toFixed(2))}</span>}
        </div>
      </div>

      <div>
        <div style={{ ...titulo, fontSize: 18, marginBottom: 8 }}>Ajuste en dólares</div>
        <div style={grid}>
          <Campo label="Fecha" id="a-fecha"><input id="a-fecha" type="date" value={a.fecha} onChange={(e) => setA({ ...a, fecha: e.target.value })} style={input} /></Campo>
          <Campo label="Monto USD" id="a-monto" ayuda="Negativo = bonificación">
            <input id="a-monto" type="number" inputMode="decimal" step="0.01" value={a.monto_usd} onChange={(e) => setA({ ...a, monto_usd: e.target.value })} style={input} />
          </Campo>
          <Campo label="Motivo" id="a-motivo"><input id="a-motivo" value={a.motivo} onChange={(e) => setA({ ...a, motivo: e.target.value })} style={input} /></Campo>
        </div>
        <div style={{ marginTop: 10 }}><Boton onClick={guardarAjuste}>Registrar ajuste</Boton></div>
      </div>

      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}

      <div>
        <div style={{ ...titulo, fontSize: 18, marginBottom: 8 }}>Movimientos</div>
        {!pagos.length && !ajustes.length && <Aviso>Sin movimientos.</Aviso>}
        {[...pagos.map((x) => ({ ...x, t: "pagos" })), ...ajustes.map((x) => ({ ...x, t: "ajustes" }))]
          .sort((x, y) => y.fecha.localeCompare(x.fecha))
          .map((m) => (
            <div key={m.t + m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderTop: `1px solid ${C.borde}`, padding: "8px 0", fontSize: 14, flexWrap: "wrap" }}>
              <div>
                <div>{fecha(m.fecha)} · {m.t === "pagos" ? `Pago ${m.medio ? "(" + m.medio + ")" : ""}` : `Ajuste: ${m.motivo}`}</div>
                {m.t === "pagos" && (
                  <div style={{ color: C.apagado, fontSize: 13 }}>
                    {m.moneda === "ARS" ? `${ars(m.monto)} a ${ars(m.cotizacion)}` : usd(m.monto)}{m.nota ? ` · ${m.nota}` : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 600, color: m.t === "pagos" ? C.ok : Number(m.monto_usd) < 0 ? C.ok : C.alerta }}>
                  {m.t === "pagos" ? "−" : Number(m.monto_usd) < 0 ? "−" : "+"} {usd(Math.abs(Number(m.monto_usd)))}
                </span>
                <button type="button" onClick={() => borrar(m.t, m.id)} aria-label="Borrar movimiento" style={{ background: "none", border: "none", color: C.apagado, cursor: "pointer", fontSize: 18, minWidth: 36, minHeight: 36 }}>×</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ===================================== FEEDBACK =====================================
export function FeedbackPage({ hubs, feedback, cargar, sincronizar, sincronizando }) {
  const [filtro, setFiltro] = useState("Pendientes");
  const lista = feedback.filter((f) =>
    filtro === "Pendientes" ? ["Recibido", "En curso"].includes(f.estado) : filtro === "Todos" ? true : f.estado === filtro
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Titulo extra={<Boton onClick={() => sincronizar(hubs)} disabled={sincronizando}>{sincronizando ? "Buscando…" : "Buscar nuevos"}</Boton>}>
        Feedback de los Hubs
      </Titulo>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["Pendientes", "Resuelto", "Descartado", "Todos"].map((x) => (
          <Boton key={x} onClick={() => setFiltro(x)} style={filtro === x ? { borderColor: C.acento, color: C.acento } : {}}>{x}</Boton>
        ))}
      </div>
      {!lista.length && <Aviso>No hay feedback en esta vista.</Aviso>}
      {lista.map((f) => <ItemFeedback key={f.id} item={f} hub={hubs.find((h) => h.id === f.hub_id)} onCambio={cargar} />)}
    </div>
  );
}

function ItemFeedback({ item, hub, onCambio }) {
  const [estado, setEstado] = useState(item.estado);
  const [respuesta, setRespuesta] = useState(item.respuesta || "");
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function cambiarPrioridad(v) {
    await supabase.from("feedback").update({ prioridad: v }).eq("id", item.id);
    onCambio();
  }

  async function enviar() {
    setMsg(null);
    setGuardando(true);
    try {
      await responderFeedback(hub, item, estado, respuesta);
      setMsg({ tipo: "ok", texto: respuesta.trim() && respuesta.trim() !== (item.respuesta || "") ? "Enviado: el club recibe la respuesta como notificación." : "Guardado." });
      onCambio();
    } catch (e) {
      setMsg({ tipo: "error", texto: "No se pudo enviar al Hub: " + e.message });
    }
    setGuardando(false);
  }

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ fontSize: 13, color: C.apagado }}>
          {hub?.nombre} · {item.club} · {item.autor || "sin nombre"} · {fecha(item.creado_en)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Etiqueta color={COLOR_FEEDBACK[item.estado]}>{item.estado}</Etiqueta>
          <Etiqueta>{item.tipo}</Etiqueta>
        </div>
      </div>
      <div style={{ fontSize: 16, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{item.mensaje}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 12 }}>
        <Campo label="Prioridad" id={"pr-" + item.id}>
          <select id={"pr-" + item.id} value={item.prioridad} onChange={(e) => cambiarPrioridad(e.target.value)} style={{ ...input, color: COLOR_PRIORIDAD[item.prioridad] }}>
            {["Baja", "Normal", "Alta", "Urgente"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Campo>
        <Campo label="Estado" id={"es-" + item.id}>
          <select id={"es-" + item.id} value={estado} onChange={(e) => setEstado(e.target.value)} style={input}>
            {["Recibido", "En curso", "Resuelto", "Descartado"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Campo>
      </div>
      <div style={{ marginTop: 10 }}>
        <Campo label="Respuesta al club" id={"re-" + item.id}>
          <textarea id={"re-" + item.id} rows={3} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} style={{ ...input, resize: "vertical" }} />
        </Campo>
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div style={{ marginTop: 10 }}>
        <Boton principal onClick={enviar} disabled={guardando || !hub}>{guardando ? "Enviando…" : "Guardar y enviar"}</Boton>
      </div>
    </Card>
  );
}

// ===================================== AJUSTES =====================================
export function AjustesPage({ sesion }) {
  const [admins, setAdmins] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [nuevo, setNuevo] = useState({ email: "", nombre: "" });
  const [msg, setMsg] = useState(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    Promise.all([
      supabase.from("admins").select("*").order("email"),
      supabase.from("planes").select("*").order("meses"),
    ]).then(([{ data: ad }, { data: pl }]) => { setAdmins(ad || []); setPlanes(pl || []); });
  }, [recarga]);

  async function agregar() {
    setMsg(null);
    const email = nuevo.email.trim().toLowerCase();
    if (!email.includes("@")) return setMsg({ tipo: "error", texto: "Ingresá un email válido." });
    const { error } = await supabase.from("admins").insert({ email, nombre: nuevo.nombre.trim() || null });
    if (error) return setMsg({ tipo: "error", texto: error.message });
    setNuevo({ email: "", nombre: "" });
    setMsg({ tipo: "ok", texto: "Agregado. Esa persona crea su cuenta en este panel con ese email y la confirma." });
    setRecarga((n) => n + 1);
  }

  async function quitar(email) {
    if (email === sesion.user.email.toLowerCase()) return setMsg({ tipo: "error", texto: "No podés quitarte a vos mismo." });
    if (!window.confirm(`¿Quitar a ${email} como administrador?`)) return;
    const { error } = await supabase.from("admins").delete().eq("email", email);
    if (error) return setMsg({ tipo: "error", texto: error.message });
    setRecarga((n) => n + 1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <Titulo>Administradores de ADN</Titulo>
        {admins.map((a) => (
          <div key={a.email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderTop: `1px solid ${C.borde}`, padding: "8px 0", fontSize: 15 }}>
            <span>{a.nombre ? `${a.nombre} · ` : ""}{a.email}</span>
            <Boton peligro onClick={() => quitar(a.email)} style={{ minHeight: 34, padding: "5px 10px", fontSize: 13 }}>Quitar</Boton>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginTop: 12 }}>
          <Campo label="Email" id="ad-email"><input id="ad-email" type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} style={input} /></Campo>
          <Campo label="Nombre" id="ad-nombre"><input id="ad-nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} style={input} /></Campo>
        </div>
        <div style={{ marginTop: 10 }}><Boton onClick={agregar}>Agregar administrador</Boton></div>
        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      </Card>
      <Card>
        <Titulo>Planes</Titulo>
        {planes.map((p) => (
          <div key={p.codigo} style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.borde}`, padding: "8px 0", fontSize: 15 }}>
            <span>{p.nombre}</span>
            <span>{usd(p.precio_usd)} cada {p.meses === 1 ? "mes" : `${p.meses} meses`}</span>
          </div>
        ))}
        <div style={{ fontSize: 13, color: C.apagado, marginTop: 8 }}>
          La cotización es el dólar oficial del Banco Nación (vendedor), que se actualiza sola cada vez que se abre el panel.
        </div>
      </Card>
    </div>
  );
}
