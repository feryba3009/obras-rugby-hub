import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Manda el push de una notificación a los perfiles que corresponden:
// solo del mismo club, de los roles indicados y, si viene jugadores_destino o perfiles_destino, solo a esos.
// La dispara el trigger on_notificacion_creada (función notificar_push) en cada alta de notificaciones.
Deno.serve(async (req) => {
  try {
    const { notificacion_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: noti, error: errNoti } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("id", notificacion_id)
      .single();
    if (errNoti || !noti) {
      return new Response(JSON.stringify({ error: "notificacion no encontrada" }), { status: 404 });
    }

    const { data: secretos, error: errSecretos } = await supabase
      .from("app_secrets")
      .select("clave, valor")
      .in("clave", ["vapid_public_key", "vapid_private_key"]);
    if (errSecretos || !secretos) {
      return new Response(JSON.stringify({ error: "no se pudieron leer las claves VAPID" }), { status: 500 });
    }
    const vapidPublic = secretos.find((s) => s.clave === "vapid_public_key")?.valor;
    const vapidPrivate = secretos.find((s) => s.clave === "vapid_private_key")?.valor;
    webpush.setVapidDetails("mailto:admin@obrasrugbyhub.app", vapidPublic, vapidPrivate);

    let perfilesQuery = supabase.from("profiles").select("id");
    if (noti.club_id) perfilesQuery = perfilesQuery.eq("club_id", noti.club_id);
    if (noti.roles_destino && noti.roles_destino.length > 0) {
      perfilesQuery = perfilesQuery.in("rol", noti.roles_destino);
    }
    if (noti.jugadores_destino && noti.jugadores_destino.length > 0) {
      perfilesQuery = perfilesQuery.in("jugador_id", noti.jugadores_destino);
    }
    if (noti.perfiles_destino && noti.perfiles_destino.length > 0) {
      perfilesQuery = perfilesQuery.in("id", noti.perfiles_destino);
    }
    const { data: perfiles } = await perfilesQuery;
    const perfilIds = (perfiles || []).map((p) => p.id);
    if (perfilIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviados: 0 }), { status: 200 });
    }

    let titulo = "ADN Sports";
    if (noti.club_id) {
      const { data: club } = await supabase.from("clubes").select("nombre, nombre_corto").eq("id", noti.club_id).maybeSingle();
      const nombre = club?.nombre_corto || club?.nombre;
      if (nombre) titulo = `ADN ${nombre}`;
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("perfil_id", perfilIds);

    const payload = JSON.stringify({
      title: titulo,
      body: noti.mensaje,
      tag: noti.tipo,
    });

    let enviados = 0;
    const vencidas = [];

    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        enviados++;
      } catch (err) {
        const status = err.statusCode;
        if (status === 404 || status === 410) vencidas.push(sub.id);
      }
    }

    if (vencidas.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", vencidas);
    }

    return new Response(JSON.stringify({ ok: true, enviados, vencidas: vencidas.length }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
