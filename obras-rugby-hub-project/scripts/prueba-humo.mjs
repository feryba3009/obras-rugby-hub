// Prueba de humo: abre la app ya compilada en un navegador real y verifica que la pantalla de
// ingreso cargue sin errores (si la app se rompe al arrancar, esto falla y GitHub avisa por mail).
// Uso: node scripts/prueba-humo.mjs http://localhost:4173
import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:4173";
const fallas = [];
const errores = [];
let texto = "";
const navegador = await chromium.launch();
try {
  const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 } });
  pagina.on("pageerror", (e) => errores.push(`Error en la página: ${e.message}`));
  pagina.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR/i.test(m.text())) errores.push(`Consola: ${m.text()}`);
  });

  await pagina.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  // La app primero carga los datos del club; esperamos a que aparezca la pantalla de ingreso.
  await pagina.getByText("Crear cuenta").first().waitFor({ timeout: 30000 }).catch(() => {});
  texto = await pagina.locator("body").innerText({ timeout: 30000 });
  for (const esperado of ["Ingresar", "Crear cuenta"]) {
    if (!texto.includes(esperado)) fallas.push(`No aparece "${esperado}" en la pantalla de ingreso.`);
  }
  if (/Algo salió mal|Something went wrong/i.test(texto)) fallas.push("La app mostró la pantalla de error.");

  if (!fallas.length) {
    // El formulario de registro también tiene que abrir.
    await pagina.getByRole("button", { name: "Crear cuenta" }).first().click({ timeout: 10000 });
    await pagina.waitForTimeout(800);
    const registro = await pagina.locator("body").innerText();
    if (!registro.includes("Crear mi cuenta")) fallas.push("No abre el formulario de registro.");
  }
} catch (e) {
  fallas.push(`La prueba no pudo terminar: ${e?.message || e}`);
} finally {
  await navegador.close();
}

const todo = [...fallas, ...errores];
if (todo.length) {
  console.error("La prueba de humo falló:\n- " + todo.join("\n- "));
  // Para que el motivo aparezca en el resumen del control (anotaciones de GitHub).
  for (const t of todo.slice(0, 8)) console.log(`::error::${t.replace(/\s+/g, " ").slice(0, 400)}`);
  console.log(`::error::Texto de la pantalla: ${texto.replace(/\s+/g, " ").slice(0, 300) || "(vacía)"}`);
  process.exit(1);
}
console.log("Prueba de humo OK: la app carga y el registro abre.");
