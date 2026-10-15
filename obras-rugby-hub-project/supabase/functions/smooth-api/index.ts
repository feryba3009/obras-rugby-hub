import { createClient } from "jsr:@supabase/supabase-js@2";

// Sincroniza con la URBA (lo corre pg_cron los domingos):
//  · Fase regular: carga los resultados de los partidos que estaban "Próximo" y actualiza la tabla.
//  · Fase final (Desarrollo se divide en dos zonas, Campeonato y Formativo): busca en qué zona quedó
//    Obras y agrega sus partidos (fechas 19 en adelante = fecha 1 en adelante de la fase final),
//    con el resultado cuando ya se jugaron.
const REGULAR = { Superior: 2025182, Intermedia: 2025207 };
const FASE_FINAL = { Superior: [2025326, 2025327], Intermedia: [2025328, 2025329] };
const FECHAS_FASE_REGULAR = 18;
const OBRAS = "Obras Sanitarias";

const NOMBRE_MAP: Record<string, string> = {
  "Municipalida de Berazategui": "Municipalidad de Berazategui",
  "Munic. de Berazategui": "Municipalidad de Berazategui",
  "San Jose": "San José",
  "Atletico San Andres": "Atlético San Andrés",
};
const normalizar = (n: string) => NOMBRE_MAP[n] || n;

async function traer(id: number) {
  const r = await fetch(`https://urba.org.ar/api/fixture/championship/${id}`);
  if (!r.ok) throw new Error(`URBA respondió ${r.status} para ${id}`);
  return await r.json();
}
const tieneObras = (data: any) => (data?.championship?.rounds || []).some((r: any) => r.matches.some((m: any) => m.local_team.name === OBRAS || m.visit_team.name === OBRAS));

Deno.serve(async () => {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: club } = await supabase.from("clubes").select("id").eq("slug", "obras").single();
    const clubId = club?.id;
    const resumen: any[] = [];

    async function rivalId(nombre: string) {
      const n = normalizar(nombre);
      const { data } = await supabase.from("equipos_rivales").select("id").eq("nombre", n).maybeSingle();
      if (data?.id) return data.id;
      const { data: nuevo } = await supabase.from("equipos_rivales").insert({ nombre: n, club_id: clubId }).select("id").single();
      return nuevo?.id || null;
    }

    for (const [categoriaNombre, champId] of Object.entries(REGULAR)) {
      const { data: catRow } = await supabase.from("categorias").select("id").eq("nombre", categoriaNombre).single();
      if (!catRow) continue;
      const categoriaId = catRow.id;
      const info: any = { categoria: categoriaNombre, resultados: 0, faseFinalNuevos: 0, faseFinalResultados: 0 };

      // Fase regular: resultados y tabla
      try {
        const data = await traer(champId);
        for (const round of data.championship.rounds) {
          const fechaNumero = parseInt(round.name.replace(/\D/g, ""), 10);
          for (const m of round.matches) {
            const local = m.local_team.name === OBRAS, visita = m.visit_team.name === OBRAS;
            if (!local && !visita) continue;
            if (!m.fulfilled || m.suspended) continue;
            const gf = local ? m.local_team_score : m.visit_team_score;
            const gc = local ? m.visit_team_score : m.local_team_score;
            const resultado = gf > gc ? "Ganado" : gf < gc ? "Perdido" : "Empate";
            const { data: upd } = await supabase.from("partidos").update({ goles_favor: gf, goles_contra: gc, resultado })
              .eq("categoria_id", categoriaId).eq("fecha_numero", fechaNumero).eq("resultado", "Próximo").select("id");
            info.resultados += upd?.length || 0;
          }
        }
        await supabase.from("posiciones").delete().eq("categoria_id", categoriaId);
        for (const fila of data.standings) {
          const nombre = normalizar(fila.team.name);
          const esObras = nombre === OBRAS;
          const equipoId = esObras ? null : (await supabase.from("equipos_rivales").select("id").eq("nombre", nombre).maybeSingle()).data?.id || null;
          await supabase.from("posiciones").insert({
            categoria_id: categoriaId, equipo_id: equipoId, es_obras: esObras,
            pj: fila.played, g: fila.won, e: fila.tied, p: fila.lost, pf: fila.points_favor, pc: fila.points_against,
            dif: fila.points_favor - fila.points_against, bo: fila.bonus_offensive, bd: fila.bonus_defensive, pts: fila.points_total,
            temporada: "2026", ...(clubId ? { club_id: clubId } : {}),
          });
        }
      } catch (e) {
        info.errorRegular = String(e);
      }

      // Fase final: la zona donde está Obras
      for (const id of FASE_FINAL[categoriaNombre as keyof typeof FASE_FINAL] || []) {
        let data: any;
        try { data = await traer(id); } catch (e) { info.errorFinal = String(e); continue; }
        if (!tieneObras(data)) continue;
        info.zona = data.championship.name;
        for (const round of data.championship.rounds) {
          const n = parseInt(round.name.replace(/\D/g, ""), 10);
          const fechaNumero = FECHAS_FASE_REGULAR + n;
          const fecha = String(round.playdate || "").slice(0, 10);
          for (const m of round.matches) {
            const local = m.local_team.name === OBRAS, visita = m.visit_team.name === OBRAS;
            if (!local && !visita) continue;
            const rivalNombre = local ? m.visit_team.name : m.local_team.name;
            if (/^bye$/i.test(rivalNombre)) continue; // fecha libre
            const jugado = m.fulfilled && !m.suspended;
            const gf = local ? m.local_team_score : m.visit_team_score;
            const gc = local ? m.visit_team_score : m.local_team_score;
            const resultado = jugado ? (gf > gc ? "Ganado" : gf < gc ? "Perdido" : "Empate") : "Próximo";
            const { data: existente } = await supabase.from("partidos").select("id, resultado").eq("categoria_id", categoriaId).eq("fecha_numero", fechaNumero).maybeSingle();
            if (!existente) {
              await supabase.from("partidos").insert({
                categoria_id: categoriaId, fecha_numero: fechaNumero, fecha, rival_id: await rivalId(rivalNombre),
                condicion: local ? "Local" : "Visitante", resultado,
                ...(jugado ? { goles_favor: gf, goles_contra: gc } : {}),
                temporada: "2026", ...(clubId ? { club_id: clubId } : {}),
              });
              info.faseFinalNuevos++;
            } else if (existente.resultado === "Próximo" && jugado) {
              await supabase.from("partidos").update({ goles_favor: gf, goles_contra: gc, resultado }).eq("id", existente.id);
              info.faseFinalResultados++;
            } else if (existente.resultado === "Próximo") {
              await supabase.from("partidos").update({ fecha }).eq("id", existente.id); // por si se reprogramó
            }
          }
        }
      }
      resumen.push(info);
    }

    // Resultados de Obras también al fixture de la videoteca ("Videos del rival")
    await supabase.rpc("sync_partidos_liga");

    await supabase.from("notificaciones").insert({
      tipo: "sync_urba",
      mensaje: "Tabla, resultados y partidos de la fase final actualizados desde URBA.",
      roles_destino: ["Cuerpo técnico", "Manager"],
      ...(clubId ? { club_id: clubId } : {}),
    });

    return new Response(JSON.stringify({ ok: true, resumen }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
