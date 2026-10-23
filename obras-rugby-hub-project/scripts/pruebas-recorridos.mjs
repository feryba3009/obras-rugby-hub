// Pruebas automáticas de los recorridos más usados, sobre la versión demo (datos de ejemplo, sin cuentas
// reales). Cada prueba arranca de cero en su propia pestaña. Si una falla, guarda una captura en
// ./capturas-pruebas y lo marca en el resumen de GitHub.
// Uso: node scripts/pruebas-recorridos.mjs http://localhost:4173
import { chromium } from "playwright";
import fs from "node:fs";

const url = process.argv[2] || "http://localhost:4173";
const dir = "capturas-pruebas";
fs.mkdirSync(dir, { recursive: true });
const TZ = "America/Argentina/Buenos_Aires";
const navegador = await chromium.launch();
const resultados = [];

const BOTON_ROL = { staff: "Entrar como entrenador", jugador: "Entrar como jugador" };

async function cerrarAvisos(p) {
  for (let i = 0; i < 3; i++) {
    let cerro = false;
    for (const t of ["Entendido", "Ahora no"]) {
      const b = p.getByRole("button", { name: t, exact: true }).first();
      if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); cerro = true; await p.waitForTimeout(300); }
    }
    if (!cerro) return;
  }
}
async function ir(p, nombre) {
  await cerrarAvisos(p);
  await p.locator(`[aria-label="${nombre}"]:visible`).first().click({ timeout: 8000 });
  await p.mouse.move(900, 450); // que el menú lateral se vuelva a cerrar
  await p.waitForTimeout(1200);
  await cerrarAvisos(p);
}
async function verTexto(p, texto, timeout = 8000) {
  await p.getByText(texto).first().waitFor({ state: "visible", timeout });
}
async function noVerTexto(p, texto, timeout = 8000) {
  await p.getByText(texto).first().waitFor({ state: "hidden", timeout });
}
function afirmar(cond, msj) { if (!cond) throw new Error(msj); }
// Lee la base de la demo (vive en el navegador) para verificar que lo hecho quedó guardado.
const leerBase = (p) => p.evaluate(() => JSON.parse(sessionStorage.getItem("adn-demo-db-berazategui") || "null")?.datos);

async function prueba(nombre, rol, cuerpo, { preparar } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 860 }, timezoneId: TZ, locale: "es-AR" });
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", (e) => errores.push(`Error en la página: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR/i.test(m.text())) errores.push(`Consola: ${m.text().slice(0, 200)}`); });
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const t0 = Date.now();
  try {
    await p.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await p.getByText(BOTON_ROL[rol]).first().waitFor({ timeout: 20000 });
    if (preparar) { await p.evaluate(preparar); await p.reload({ waitUntil: "networkidle" }); await p.getByText(BOTON_ROL[rol]).first().waitFor({ timeout: 20000 }); }
    await p.getByText(BOTON_ROL[rol]).first().click();
    await p.waitForTimeout(2500);
    await cerrarAvisos(p);
    await cuerpo(p);
    const t = await p.locator("body").innerText();
    afirmar(!/Algo salió mal|Something went wrong/i.test(t), "La app mostró la pantalla de error");
    afirmar(!errores.length, errores[0]);
    resultados.push({ nombre, ok: true, seg: ((Date.now() - t0) / 1000).toFixed(1) });
  } catch (e) {
    const archivo = `${dir}/${nombre.replace(/[^a-zA-Z0-9]+/g, "-")}.png`;
    await p.screenshot({ path: archivo }).catch(() => {});
    resultados.push({ nombre, ok: false, motivo: String(e?.message || e).split("\n")[0].slice(0, 300) });
  }
  await ctx.close();
}

// ── Jugador ──
await prueba("Jugador carga el wellness", "jugador", async (p) => {
  await ir(p, "Wellness");
  if (!(await p.getByRole("button", { name: /^Full/ }).first().isVisible().catch(() => false))) {
    await p.getByRole("button", { name: /Cargar/ }).first().click({ timeout: 5000 });
  }
  await p.getByRole("button", { name: /^Full/ }).first().click();
  for (const op of ["Muy tranquilo", "Muy bien", "Nada", "Muy fresco"]) {
    await p.getByRole("button", { name: new RegExp(`^${op}`) }).first().click({ timeout: 5000 });
  }
  await p.locator("textarea:visible").first().fill("Prueba automática");
  await p.getByRole("button", { name: "Enviar", exact: true }).click();
  await p.getByRole("button", { name: "Enviar", exact: true }).waitFor({ state: "hidden", timeout: 8000 });
  const db = await leerBase(p);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const fila = db.wellness_respuestas.find((w) => w.jugador_id === "jug-0" && w.fecha === hoy);
  afirmar(fila && fila.estado_entrenamiento === "Full" && fila.observaciones === "Prueba automática", "El wellness no quedó guardado");
});

await prueba("Jugador responde la convocatoria", "jugador", async (p) => {
  // La tarjeta de la convocatoria (la de la práctica tiene botones con el mismo texto).
  const tarjeta = p.getByText("Estás en el equipo").locator("..");
  await tarjeta.getByText("Confirmaste que vas.").waitFor({ timeout: 8000 });
  await tarjeta.getByRole("button", { name: "Al final no puedo" }).click();
  await p.getByPlaceholder("¿Por qué? (opcional)").fill("Viaje de trabajo");
  await tarjeta.getByRole("button", { name: "Mandar el aviso" }).click();
  await tarjeta.getByText("Avisaste que no podés (Viaje de trabajo).").waitFor({ timeout: 8000 });
  await tarjeta.getByRole("button", { name: "Al final sí voy" }).click();
  await tarjeta.getByText("Confirmaste que vas.").waitFor({ timeout: 8000 });
});

await prueba("Jugador no ve el equipo antes de que se publique", "jugador", async (p) => {
  const t0 = await p.locator("body").innerText();
  afirmar(!t0.includes("Estás en el equipo"), "En el inicio aparece la convocatoria sin publicar");
  await verTexto(p, "El equipo se publica antes del partido");
  await ir(p, "Equipo del partido");
  await verTexto(p, /todavía no se publicó/);
  const t = await p.locator("body").innerText();
  afirmar(!/Banco/.test(t), "Se ve el borrador del equipo");
}, {
  // El partido de Superior de la demo pasa a estar sin publicar.
  preparar: () => {
    const g = JSON.parse(sessionStorage.getItem("adn-demo-db-berazategui"));
    g.datos.partidos.find((x) => x.id === "par-cat-sup-11").convocatoria_publicada_at = null;
    sessionStorage.setItem("adn-demo-db-berazategui", JSON.stringify(g));
  },
});

await prueba("Jugador ve su camiseta en la tarjeta del partido", "jugador", async (p) => {
  await verTexto(p, /Estás convocado · camiseta \d+/);
});

await prueba("Entrenador ve el estado de los equipos en el inicio", "staff", async (p) => {
  await verTexto(p, /Publicado · \d+ van/);
  await p.getByRole("button", { name: "Ver el equipo" }).first().click();
  await p.waitForTimeout(1200);
  await verTexto(p, "Banco");
});

await prueba("Jugador no ve secciones de manager", "jugador", async (p) => {
  const t = await p.locator("nav, aside").first().innerText().catch(() => "");
  afirmar(!/Cuotas/.test(t), "El jugador ve la sección Cuotas");
});

// ── Entrenador ──
await prueba("Entrenador toca un jugador para cuidar y ve solo su wellness", "staff", async (p) => {
  await verTexto(p, "Para cuidar hoy");
  await p.getByRole("button", { name: /Bruno Acosta/ }).first().click();
  await p.waitForTimeout(1500);
  await verTexto(p, "Bruno Acosta");
  const t = await p.locator("main, body").first().innerText();
  afirmar(!t.includes("Gonzalo Medina"), "Abrió el wellness de todos en lugar del de ese jugador");
});

await prueba("Entrenador abre la ficha y ve la lesión", "staff", async (p) => {
  await ir(p, "Plantel");
  await p.getByText("Kevin Ortiz", { exact: true }).first().click({ timeout: 8000 });
  await p.waitForTimeout(1000);
  await verTexto(p, "Kevin Ortiz");
  await p.getByText("Salud", { exact: true }).first().click({ timeout: 8000 });
  await p.waitForTimeout(800);
  await verTexto(p, /Posible alta/);
});

await prueba("Entrenador ve el equipo del partido", "staff", async (p) => {
  await ir(p, "Equipo del partido");
  await verTexto(p, "Banco");
  await verTexto(p, /Defensores de Glew/);
});

await prueba("Partido en vivo de punta a punta", "staff", async (p) => {
  await p.getByRole("button", { name: "Abrir el partido en vivo" }).first().click({ timeout: 8000 });
  await p.getByRole("button", { name: /Reanudar/ }).first().click();
  await p.waitForTimeout(2500);
  await p.getByRole("button", { name: "Try", exact: true }).first().click();
  await p.getByRole("button", { name: /Sí/ }).first().click();
  await verTexto(p, /Try convertido \(7 pts\)/);
  await p.getByRole("button", { name: "Frenar" }).first().click().catch(() => {});
  await p.getByRole("button", { name: /Finalizar partido y subir resultado/ }).click();
  await p.waitForTimeout(2500);
  const db = await leerBase(p);
  const par = db.partidos.find((x) => x.id === "par-cat-int-11");
  afirmar(par && par.goles_favor === 7 && par.goles_contra === 0, `El resultado no se guardó (quedó ${par?.goles_favor}-${par?.goles_contra})`);
}, {
  // El partido de Intermedia de la demo pasa a ser hoy, para poder abrir el partido en vivo.
  preparar: () => {
    const g = JSON.parse(sessionStorage.getItem("adn-demo-db-berazategui"));
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    g.datos.partidos.find((x) => x.id === "par-cat-int-11").fecha = hoy;
    sessionStorage.setItem("adn-demo-db-berazategui", JSON.stringify(g));
  },
});

await prueba("Ajustes: filas que se despliegan y tema oscuro", "staff", async (p) => {
  await cerrarAvisos(p);
  await p.locator('[aria-label="Ajustes"]:visible').first().click();
  await p.waitForTimeout(800);
  await verTexto(p, "Quién entra a la app");
  const t = await p.locator("body").innerText();
  afirmar(!/Cuenta y seguridad|Apariencia y preferencias|Staff y usuarios|Barra abajo/.test(t), "Quedan secciones de Ajustes con el armado viejo");
  await p.getByRole("button", { name: /Claro u oscuro/ }).click();
  await p.getByRole("button", { name: /^Oscuro/ }).click();
  const tema = await p.evaluate(() => document.documentElement.dataset.tema);
  afirmar(tema === "oscuro", "No se aplicó el tema oscuro");
});

await prueba("Práctica: grupos A y B con el lugar del grupo", "staff", async (p) => {
  await ir(p, "Práctica del día");
  await verTexto(p, /Grupo A/);
  const t = await p.locator("main, body").first().innerText();
  afirmar(!/Grupo 1|Grupo 2/.test(t), "Quedan los grupos numerados");
});

await prueba("Cambiar de entrenador a jugador", "staff", async (p) => {
  await p.getByRole("button", { name: "Ver como jugador" }).click();
  await p.waitForTimeout(3000);
  await cerrarAvisos(p);
  await verTexto(p, /viendo como jugador/);
});

await navegador.close();

const fallas = resultados.filter((r) => !r.ok);
console.log("\nResultado de las pruebas:");
for (const r of resultados) console.log(`${r.ok ? "✓" : "✗"} ${r.nombre}${r.ok ? ` (${r.seg} s)` : ` — ${r.motivo}`}`);
for (const r of fallas) console.log(`::error::${r.nombre}: ${r.motivo.replace(/\s+/g, " ")}`);
console.log(`\n${resultados.length - fallas.length} de ${resultados.length} pruebas bien.`);
if (fallas.length) process.exitCode = 1;
