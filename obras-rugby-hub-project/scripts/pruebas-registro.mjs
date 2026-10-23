// Pruebas del alta de cuenta (la versión real de la app, no la demo). La base se simula: el navegador
// automático intercepta los pedidos a Supabase y contesta con un plantel de ejemplo, así no se toca
// ninguna base real ni se crea ninguna cuenta.
// Uso: node scripts/pruebas-registro.mjs http://localhost:4174
import { chromium } from "playwright";
import fs from "node:fs";

const url = process.argv[2] || "http://localhost:4174";
const dir = "capturas-pruebas";
fs.mkdirSync(dir, { recursive: true });
const PLANTEL = [
  { id: "11111111-1111-4111-8111-111111111111", nombre: "Kevin Ortiz" },
  { id: "22222222-2222-4222-8222-222222222222", nombre: "Bruno Acosta" },
  { id: "33333333-3333-4333-8333-333333333333", nombre: "Gonzalo Medina" },
];
const navegador = await chromium.launch();
const resultados = [];
const afirmar = (c, m) => { if (!c) throw new Error(m); };

async function prueba(nombre, ruta, cuerpo) {
  const ctx = await navegador.newContext({ viewport: { width: 420, height: 900 }, locale: "es-AR" });
  const p = await ctx.newPage();
  const altas = [];
  await p.route(/prueba\.invalid/, async (r) => {
    const u = r.request().url();
    if (u.includes("/rpc/jugadores_para_registro")) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PLANTEL) });
    if (u.includes("/auth/v1/signup")) {
      altas.push(JSON.parse(r.request().postData() || "{}"));
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "u1", email: "x@y.com", user_metadata: {} }) });
    }
    return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  try {
    await p.goto(url + ruta, { waitUntil: "networkidle", timeout: 60000 });
    await cuerpo(p, altas);
    resultados.push({ nombre, ok: true });
  } catch (e) {
    await p.screenshot({ path: `${dir}/registro-${nombre.replace(/[^a-zA-Z0-9]+/g, "-")}.png`, fullPage: true }).catch(() => {});
    resultados.push({ nombre, ok: false, motivo: String(e?.message || e).split("\n")[0].slice(0, 300) });
  }
  await ctx.close();
}

async function completarYCrear(p) {
  await p.locator('input[type="date"]').first().fill("1999-05-10");
  await p.getByPlaceholder("tu@email.com").fill("jugador@prueba.com");
  await p.getByPlaceholder("Mínimo 6 caracteres").fill("secreta1");
  await p.locator('input[type="password"]').nth(1).fill("secreta1");
  await p.getByRole("button", { name: "Crear la cuenta" }).click();
  await p.waitForTimeout(1500);
}

await prueba("El jugador se encuentra escribiendo su nombre", "/", async (p, altas) => {
  await p.getByRole("button", { name: /Creá tu cuenta/ }).click();
  const t0 = await p.locator("body").innerText();
  afirmar(!t0.includes("Bruno Acosta"), "Se muestra la lista entera del plantel antes de escribir");
  await p.getByPlaceholder("Tu nombre y apellido").fill("kev ort");
  await p.getByRole("button", { name: /Kevin Ortiz/ }).click();
  await p.getByText("Sos").first().waitFor({ timeout: 5000 });
  await completarYCrear(p);
  afirmar(altas.length === 1, "No se pidió el alta");
  const d = altas[0].data || {};
  afirmar(d.jugador_id === PLANTEL[0].id && d.nombre === "Kevin Ortiz" && d.rol === "Jugador", `Alta con datos raros: ${JSON.stringify(d)}`);
});

await prueba("Link personal: la app ya sabe quién es", `/?soy=${PLANTEL[2].id}`, async (p, altas) => {
  await p.getByText("¡Hola, Gonzalo!").waitFor({ timeout: 8000 });
  await completarYCrear(p);
  const d = altas[0]?.data || {};
  afirmar(d.jugador_id === PLANTEL[2].id, `El alta no quedó atada al jugador del link: ${JSON.stringify(d)}`);
});

await prueba("Jugador nuevo que no está en el plantel", "/", async (p, altas) => {
  await p.getByRole("button", { name: /Creá tu cuenta/ }).click();
  await p.getByPlaceholder("Tu nombre y apellido").fill("Tomás Rivero");
  await p.getByRole("button", { name: "No aparezco: soy nuevo" }).click();
  await completarYCrear(p);
  const d = altas[0]?.data || {};
  afirmar(!d.jugador_id && d.nombre_nuevo_jugador === "Tomás Rivero", `Alta de nuevo con datos raros: ${JSON.stringify(d)}`);
});

await prueba("Alta del staff", "/", async (p, altas) => {
  await p.getByRole("button", { name: /Creá tu cuenta/ }).click();
  await p.getByRole("button", { name: "Soy del staff" }).click();
  await p.getByRole("button", { name: "Cuerpo médico" }).click();
  await p.locator("input:not([type])").first().fill("Laura Gómez");
  await completarYCrear(p);
  const d = altas[0]?.data || {};
  afirmar(d.rol === "Cuerpo médico" && d.nombre === "Laura Gómez", `Alta de staff con datos raros: ${JSON.stringify(d)}`);
});

await navegador.close();
const fallas = resultados.filter((r) => !r.ok);
console.log("\nAlta de cuenta:");
for (const r of resultados) console.log(`${r.ok ? "✓" : "✗"} ${r.nombre}${r.ok ? "" : ` — ${r.motivo}`}`);
for (const r of fallas) console.log(`::error::${r.nombre}: ${r.motivo.replace(/\s+/g, " ")}`);
if (fallas.length) process.exitCode = 1;
