import { createClient } from "jsr:@supabase/supabase-js@2";

// Copia de seguridad semanal (la dispara pg_cron los lunes a la madrugada).
//  1. Arma un JSON con todas las tablas (función exportar_copia de la base).
//  2. Lo guarda comprimido en el bucket privado "copias" de este proyecto (se conservan las últimas 12).
//  3. Manda otra copia al Panel de ADN (otro proyecto, otra región), por si este proyecto se pierde.
// Solo responde a quien manda el token guardado en config_privada (lo usa el cron; nadie más lo tiene).
const PANEL_URL = "https://jjbpkdthnokfkivifpkr.supabase.co/functions/v1/recibir-copia";
const CONSERVAR = 12;

async function gzip(texto: string): Promise<Uint8Array> {
  const stream = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

Deno.serve(async (req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfg } = await supabase.from("config_privada").select("valor").eq("clave", "copia_token").maybeSingle();
  const token = req.headers.get("x-copia-token");
  if (!cfg?.valor || !token || token !== cfg.valor) return new Response("no autorizado", { status: 401 });

  try {
    const { data: copia, error } = await supabase.rpc("exportar_copia");
    if (error) throw error;
    const texto = JSON.stringify(copia);
    const archivo = await gzip(texto);
    const fecha = new Date().toISOString().slice(0, 10);
    const nombre = `obras-${fecha}.json.gz`;

    const { error: errSubida } = await supabase.storage.from("copias").upload(nombre, archivo, { contentType: "application/gzip", upsert: true });
    if (errSubida) throw errSubida;

    // Se conservan solo las últimas copias.
    const { data: lista } = await supabase.storage.from("copias").list("", { limit: 1000, sortBy: { column: "name", order: "desc" } });
    const viejas = (lista || []).filter((f) => f.name.startsWith("obras-")).slice(CONSERVAR).map((f) => f.name);
    if (viejas.length) await supabase.storage.from("copias").remove(viejas);

    // Copia afuera, en el Panel de ADN.
    let panel = "sin enviar";
    try {
      const r = await fetch(PANEL_URL, { method: "POST", headers: { "x-copia-token": token, "x-nombre": nombre, "Content-Type": "application/gzip" }, body: archivo });
      panel = r.ok ? "ok" : `error ${r.status}`;
    } catch (e) {
      panel = `error ${String(e)}`;
    }

    const tablas = Object.keys((copia as any)?.tablas || {}).length;
    return new Response(JSON.stringify({ ok: true, nombre, tablas, bytes: archivo.length, sinComprimir: texto.length, panel }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message || e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
