// Prueba de la demo (VITE_DEMO=1): entra con el botón, recorre las pantallas principales como
// entrenador y como jugador, y guarda capturas en ./capturas-demo. Falla si alguna pantalla se rompe.
// Uso: node scripts/prueba-demo.mjs http://localhost:4173
import { chromium } from "playwright";
import fs from "node:fs";

const url = process.argv[2] || "http://localhost:4173";
const dir = "capturas-demo";
fs.mkdirSync(dir, { recursive: true });
const fallas = [];
const navegador = await chromium.launch();

async function recorrer(rol, boton, pantallas, viewport) {
  const ctx = await navegador.newContext({ viewport });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => fallas.push(`[${rol}] Error en la página: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR/i.test(m.text())) fallas.push(`[${rol}] Consola: ${m.text().slice(0, 300)}`); });
  await p.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await p.getByText(boton).first().waitFor({ timeout: 20000 }).catch(() => fallas.push(`[${rol}] No aparece el botón "${boton}"`));
  await p.screenshot({ path: `${dir}/${rol}-00-entrada.png` });
  await p.getByText(boton).first().click().catch(() => {});
  await p.waitForTimeout(2500);
  let i = 1;
  for (const nombre of pantallas) {
    try {
      const entendido = p.getByRole("button", { name: "Entendido" }).first();
      if (await entendido.isVisible().catch(() => false)) { await entendido.click(); await p.waitForTimeout(300); }
      const porEtiqueta = p.locator(`[aria-label="${nombre}"]:visible`).first();
      if (await porEtiqueta.count()) await porEtiqueta.click({ timeout: 6000 });
      else await p.getByText(nombre, { exact: true }).first().click({ timeout: 6000 });
      await p.waitForTimeout(1800);
    } catch (e) { fallas.push(`[${rol}] No pude abrir "${nombre}"`); }
    const t = await p.locator("body").innerText().catch(() => "");
    if (/\bCuotas?\b/.test(t)) fallas.push(`[${rol}] En la demo no tiene que aparecer la cuota (es solo de Obras)`);
    if (/Algo salió mal|Something went wrong/i.test(t)) fallas.push(`[${rol}] "${nombre}" mostró la pantalla de error: ${t.replace(/\s+/g, " ").slice(0, 200)}`);
    await p.screenshot({ path: `${dir}/${rol}-${String(i++).padStart(2, "0")}-${nombre.replace(/[^a-zA-Z]+/g, "-")}.png` });
  }
  await ctx.close();
}

try {
  const escritorio = { width: 1280, height: 860 };
  await recorrer("staff", "Entrar como entrenador",
    ["Inicio", "Wellness", "Gimnasio", "Agenda", "Práctica del día", "Plantel", "Estado del plantel", "Tests físicos", "Torneo", "Equipo del partido", "Videos del rival", "Estadísticas", "Análisis de video", "Resúmenes", "Ajustes"], escritorio);
  await recorrer("jugador", "Entrar como jugador", ["Inicio", "Wellness", "Gimnasio", "Agenda", "Torneo"], escritorio);
  await recorrer("celular", "Entrar como entrenador", ["Inicio"], { width: 390, height: 844 });
} catch (e) { fallas.push(`La prueba no pudo terminar: ${e?.message || e}`); }
await navegador.close();

const unicas = [...new Set(fallas)];
if (unicas.length) {
  console.error("La prueba de la demo falló:\n- " + unicas.join("\n- "));
  for (const t of unicas.slice(0, 20)) console.log(`::error::${t.replace(/\s+/g, " ").slice(0, 400)}`);
  process.exitCode = 1;
} else console.log("Prueba de la demo OK.");
