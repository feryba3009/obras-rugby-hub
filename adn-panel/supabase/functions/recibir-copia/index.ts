import { createClient } from "jsr:@supabase/supabase-js@2";

// Recibe la copia de seguridad semanal de cada club y la guarda en el bucket privado "copias-clubes"
// (una carpeta por club, se conservan las últimas 12). Solo acepta el token guardado en config_privada.
const CONSERVAR = 12;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método no permitido", { status: 405 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfg } = await supabase.from("config_privada").select("valor").eq("clave", "copia_token").maybeSingle();
  const token = req.headers.get("x-copia-token");
  if (!cfg?.valor || !token || token !== cfg.valor) return new Response("no autorizado", { status: 401 });

  const nombre = (req.headers.get("x-nombre") || "").trim();
  const m = nombre.match(/^([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})\.json\.gz$/);
  if (!m) return new Response("nombre inválido", { status: 400 });
  const club = m[1];
  const cuerpo = new Uint8Array(await req.arrayBuffer());
  if (!cuerpo.length || cuerpo.length > 50 * 1024 * 1024) return new Response("tamaño inválido", { status: 400 });

  const ruta = `${club}/${nombre}`;
  const { error } = await supabase.storage.from("copias-clubes").upload(ruta, cuerpo, { contentType: "application/gzip", upsert: true });
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });

  const { data: lista } = await supabase.storage.from("copias-clubes").list(club, { limit: 1000, sortBy: { column: "name", order: "desc" } });
  const viejas = (lista || []).slice(CONSERVAR).map((f) => `${club}/${f.name}`);
  if (viejas.length) await supabase.storage.from("copias-clubes").remove(viejas);

  return new Response(JSON.stringify({ ok: true, ruta, bytes: cuerpo.length }), { headers: { "Content-Type": "application/json" } });
});
