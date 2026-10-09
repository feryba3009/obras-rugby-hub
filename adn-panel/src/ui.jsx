import React from "react";

export const C = {
  fondo: "#0E1620",
  panel: "#152130",
  panel2: "#1B2A3C",
  borde: "#26374B",
  texto: "#F4F2EE",
  suave: "#C3CBD5",
  apagado: "#8D9AAA",
  acento: "#FF5A1F",
  acentoSuave: "#3A2219",
  ok: "#4FC38A",
  alerta: "#F2B33D",
  error: "#FF6B5B",
};

export const titulo = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: "0.01em" };

export function Card({ children, style }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, ...style }}>
      {children}
    </div>
  );
}

export function Titulo({ children, extra }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <h2 style={{ ...titulo, fontSize: 22, margin: 0, color: C.texto }}>{children}</h2>
      {extra}
    </div>
  );
}

export function Boton({ children, principal, peligro, style, ...props }) {
  return (
    <button
      type="button"
      {...props}
      style={{
        padding: "9px 14px", minHeight: 40, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: props.disabled ? "default" : "pointer",
        border: `1px solid ${principal ? C.acento : peligro ? C.error : C.borde}`,
        background: principal ? C.acento : "transparent",
        color: principal ? "#0E1620" : peligro ? C.error : C.texto,
        opacity: props.disabled ? 0.55 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Etiqueta({ color = C.suave, children }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: C.panel2, color, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function Campo({ label, id, children, ayuda }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label htmlFor={id} style={{ fontSize: 13, color: C.apagado, fontWeight: 500 }}>{label}</label>
      {children}
      {ayuda && <div style={{ fontSize: 12, color: C.apagado }}>{ayuda}</div>}
    </div>
  );
}

export const input = {
  width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 15, minHeight: 42,
  background: "#0B121B", border: `1px solid ${C.borde}`, color: C.texto,
};

export function Dato({ label, valor, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.apagado }}>{label}</div>
      <div style={{ ...titulo, fontSize: 26, color: color || C.texto, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{valor}</div>
    </div>
  );
}

export function Grilla({ children, min = 150 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 12 }}>
      {children}
    </div>
  );
}

export function Aviso({ tipo = "info", children }) {
  const color = tipo === "error" ? C.error : tipo === "ok" ? C.ok : tipo === "alerta" ? C.alerta : C.suave;
  return <div style={{ fontSize: 14, color, padding: "4px 0" }}>{children}</div>;
}

export function Logo({ size = 28 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={size * 0.5} height={size} viewBox="-6 -6 92 172" aria-hidden="true">
        <path d="M10 0 C10 40 70 40 70 80 C70 120 10 120 10 160" fill="none" stroke={C.texto} strokeWidth="12" strokeLinecap="round" />
        <path d="M70 0 C70 40 10 40 10 80 C10 120 70 120 70 160" fill="none" stroke={C.acento} strokeWidth="12" strokeLinecap="round" />
        {[24, 56, 104, 136].map((y) => (
          <line key={y} x1="20" y1={y} x2="60" y2={y} stroke={C.texto} strokeWidth="6" strokeLinecap="round" />
        ))}
      </svg>
      <div style={{ ...titulo, fontSize: size * 0.8, lineHeight: 1 }}>
        ADN <span style={{ fontWeight: 600, fontSize: size * 0.5, letterSpacing: "0.3em", color: C.suave }}>SPORTS</span>
      </div>
    </div>
  );
}
