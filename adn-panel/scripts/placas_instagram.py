"""Renderiza las placas de Instagram de ADN Sports (1080x1350, 4:5) a JPG."""
import pathlib, sys
from playwright.sync_api import sync_playwright

F = pathlib.Path("/tmp/claude-0/-home-claude/210c9a9b-53fb-5a3f-9fec-4ea0bb0edbc8/scratchpad/gfonts/ofl")
OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

FONTS = f"""
@font-face{{font-family:BC;font-weight:800;src:url('file://{F}/barlowcondensed/BarlowCondensed-ExtraBold.ttf')}}
@font-face{{font-family:BC;font-weight:700;src:url('file://{F}/barlowcondensed/BarlowCondensed-Bold.ttf')}}
@font-face{{font-family:BC;font-weight:600;src:url('file://{F}/barlowcondensed/BarlowCondensed-SemiBold.ttf')}}
@font-face{{font-family:B;font-weight:400;src:url('file://{F}/barlow/Barlow-Regular.ttf')}}
@font-face{{font-family:B;font-weight:500;src:url('file://{F}/barlow/Barlow-Medium.ttf')}}
@font-face{{font-family:B;font-weight:600;src:url('file://{F}/barlow/Barlow-SemiBold.ttf')}}
"""

NOCHE, CREMA, GRIS = "#0E1620", "#F4F2EE", "#5E6B78"
VERDE, VERDE_TXT, SUB, TARJETA = "#1FA37A", "#157A5A", "#3A4654", "#E7E3DC"
NARANJA = VERDE_TXT  # acento de texto (verde oscuro para que se lea bien sobre crema)


def helice(h, c1=NOCHE, c2=CREMA, peldanos=NOCHE, sw=12):
    w = h * 0.5
    lines = "".join(
        f'<line x1="20" y1="{y}" x2="60" y2="{y}" stroke="{peldanos}" stroke-width="{sw/2}" stroke-linecap="round"/>'
        for y in (24, 56, 104, 136)
    )
    return (
        f'<svg width="{w}" height="{h}" viewBox="-6 -6 92 172">'
        f'<path d="M10 0 C10 40 70 40 70 80 C70 120 10 120 10 160" fill="none" stroke="{c1}" stroke-width="{sw}" stroke-linecap="round"/>'
        f'<path d="M70 0 C70 40 10 40 10 80 C10 120 70 120 70 160" fill="none" stroke="{c2}" stroke-width="{sw}" stroke-linecap="round"/>'
        f"{lines}</svg>"
    )


def insignia(d, sw=13):
    return (f'<div style="width:{d}px;height:{d}px;border-radius:50%;background:{VERDE};display:flex;'
            f'align-items:center;justify-content:center;flex-shrink:0">{helice(d*0.66, sw=sw)}</div>')


def marca(pagina=None, total=None):
    pag = f'<div style="font:600 26px B;color:{GRIS}">{pagina} / {total}</div>' if pagina else "<div></div>"
    return f"""
    <div style="position:absolute;left:84px;right:84px;bottom:64px;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:16px">{insignia(60, sw=16)}
        <div style="font:800 34px BC;color:{NOCHE};letter-spacing:.02em">ADN <span style="font-weight:600;font-size:22px;letter-spacing:.32em;color:{GRIS}">SPORTS</span></div>
      </div>{pag}
    </div>"""


def placa(cuerpo, pagina=None, total=None, fondo=CREMA):
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{FONTS}
    html,body{{margin:0}} *{{box-sizing:border-box}}
    .p{{width:1080px;height:1350px;position:relative;overflow:hidden;background:{fondo};color:{NOCHE};font-family:B}}
    .t{{font-family:BC;font-weight:800;line-height:.95;letter-spacing:-.005em;margin:0}}
    .k{{font:700 30px BC;letter-spacing:.24em;color:{NARANJA};text-transform:uppercase}}
    .s{{font:400 44px/1.32 B;color:{SUB};margin:0}}
    .n{{color:{NARANJA}}}
    </style></head><body><div class="p">{cuerpo}{marca(pagina, total)}</div></body></html>"""


def texto(kicker, titulo, sub, pagina, total, tam=128):
    return placa(f"""
    <div style="position:absolute;left:84px;right:84px;top:170px;display:flex;flex-direction:column;gap:44px">
      <div class="k">{kicker}</div>
      <h1 class="t" style="font-size:{tam}px">{titulo}</h1>
      <div style="width:120px;height:10px;background:{VERDE}"></div>
      <p class="s">{sub}</p>
    </div>""", pagina, total)


POSTS = {}

# ---------- 1 · Presentación ----------
T = 5
POSTS["01-presentacion"] = [
    placa(f"""
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:90px;padding-bottom:110px">
      <div style="display:flex;align-items:center;gap:56px">
        {insignia(400, sw=12)}
        <div style="display:flex;flex-direction:column;gap:22px">
          <div class="t" style="font-size:210px;line-height:.8">ADN</div>
          <div style="width:110px;height:12px;background:{VERDE}"></div>
          <div style="font:600 60px BC;letter-spacing:.32em">SPORTS</div>
        </div>
      </div>
      <div style="font:500 42px B;color:{SUB}">El Hub de tu club, hecho por gente de rugby.</div>
    </div>""", 1, T),
    texto("Quiénes somos", 'Somos gente <span class="n">de rugby.</span>',
          "Staff, entrenadores y preparadores. Los martes y jueves a la noche, al costado de la cancha.", 2, T),
    texto("El problema", 'Nos cansamos de <span class="n">las planillas.</span>',
          "Grupos de WhatsApp, un Excel que nadie actualiza y la lista de asistencia en papel. Todo en lugares distintos.", 3, T),
    texto("La solución", 'Armamos <span class="n">el Hub.</span>',
          "Plantel, wellness, partidos, GPS y video de los partidos en un solo lugar, desde el celular.", 4, T, 150),
    placa(f"""
    <div style="position:absolute;left:84px;right:84px;top:170px;display:flex;flex-direction:column;gap:44px">
      <div class="k">Ahora</div>
      <h1 class="t" style="font-size:128px">Lo pueden usar <span class="n">otros clubes.</span></h1>
      <div style="width:120px;height:10px;background:{VERDE}"></div>
      <p class="s">Escribinos por mensaje directo y coordinamos una demo con los datos de tu club.</p>
      <div style="margin-top:20px;align-self:flex-start;background:{VERDE};color:{NOCHE};font:800 52px BC;padding:22px 40px;border-radius:14px;letter-spacing:.02em">@adn.sporthub</div>
    </div>""", 5, T),
]

# ---------- 4 · Wellness en 4 preguntas ----------
T = 6
def pregunta(n, nombre, pregunta_txt, mira):
    return placa(f"""
    <div style="position:absolute;left:84px;right:84px;top:150px;display:flex;flex-direction:column;gap:40px">
      <div style="display:flex;align-items:baseline;gap:28px">
        <div class="t n" style="font-size:220px">{n}</div>
        <h1 class="t" style="font-size:128px">{nombre}</h1>
      </div>
      <p class="s" style="font-size:50px;color:{NOCHE};font-weight:500">{pregunta_txt}</p>
      <div style="display:flex;gap:12px;margin:8px 0">
        {''.join(f'<div style="flex:1;height:84px;border-radius:12px;background:{TARJETA};display:flex;align-items:center;justify-content:center;font:700 44px BC;color:{NOCHE}">{i}</div>' for i in range(1, 8))}
      </div>
      <p class="s"><b style="color:{NOCHE};font-weight:600">Qué mirar:</b> {mira}</p>
    </div>""", n + 1, T)

POSTS["04-wellness"] = [
    placa(f"""
    <div style="position:absolute;left:84px;right:84px;top:200px;display:flex;flex-direction:column;gap:48px">
      <div class="k">Rugby y método</div>
      <h1 class="t" style="font-size:170px">Wellness en <span class="n">4 preguntas.</span></h1>
      <p class="s">Lo que todo staff debería saber de cada jugador antes de que pise la cancha.</p>
    </div>""", 1, T),
    pregunta(1, "Sueño", "¿Cómo dormiste anoche?", "dos o tres noches malas seguidas pesan más que una sola."),
    pregunta(2, "Estrés", "¿Cuánto estrés tenés hoy, entre trabajo, estudio y casa?", "el rugby amateur se juega después de una jornada entera."),
    pregunta(3, "Dolor muscular", "¿Cuánto dolor muscular sentís?", "si dura más de 48 horas después del partido, hay que hablar."),
    pregunta(4, "Fatiga", "¿Qué tan cansado llegás al entrenamiento?", "comparalo siempre contra el promedio de ese mismo jugador."),
    placa(f"""
    <div style="position:absolute;left:84px;right:84px;top:200px;display:flex;flex-direction:column;gap:48px">
      <div class="k">La clave</div>
      <h1 class="t" style="font-size:150px">No hace falta un laboratorio. <span class="n">Hace falta constancia.</span></h1>
      <p class="s">Las mismas 4 preguntas, cada día de entrenamiento. Guardá esta publicación para tu próxima pretemporada.</p>
    </div>""", 6, T),
]

# ---------- 6 · ¿Dónde está el video? ----------
POSTS["06-video"] = [
    placa(f"""
    <div style="position:absolute;left:84px;right:84px;top:170px;display:flex;flex-direction:column;gap:30px">
      <div style="display:flex;align-items:center;gap:20px;padding-bottom:26px;border-bottom:2px solid #D6D1C8">
        <div style="width:84px;height:84px;border-radius:50%;background:#1FA37A;color:#0E1620;display:flex;align-items:center;justify-content:center;font:800 36px BC">ST</div>
        <div><div style="font:600 40px B">Staff Primera 🏉</div><div style="font:400 30px B;color:{GRIS}">23 participantes</div></div>
      </div>
      <div style="align-self:flex-start;max-width:820px;background:#FFFFFF;border:2px solid #E2DDD3;border-radius:8px 32px 32px 32px;padding:34px 40px">
        <div style="font:600 30px B;color:{NARANJA};margin-bottom:10px">Entrenador de backs</div>
        <div style="font:500 62px/1.2 B">¿Alguien tiene el video del sábado?</div>
        <div style="font:400 28px B;color:{GRIS};text-align:right;margin-top:14px">Lunes 21:47</div>
      </div>
      <div style="align-self:flex-start;font:500 34px B;color:{GRIS};padding-left:8px">Visto por 23 · 0 respuestas</div>
    </div>
    <div style="position:absolute;left:84px;right:84px;top:880px">
      <h1 class="t" style="font-size:96px">El mensaje más leído <span class="n">de cualquier grupo de staff.</span></h1>
    </div>"""),
]

# ---------- 8 · Qué mirar del rival ----------
T = 6
def item(n, nombre, preguntas):
    return placa(f"""
    <div style="position:absolute;left:84px;right:84px;top:170px;display:flex;flex-direction:column;gap:44px">
      <div class="k">Análisis del rival · {n} de 4</div>
      <h1 class="t" style="font-size:180px">{nombre}</h1>
      <div style="width:120px;height:10px;background:{VERDE}"></div>
      {''.join(f'<p class="s" style="display:flex;gap:24px"><span class="n" style="font-weight:600">—</span><span>{q}</span></p>' for q in preguntas)}
    </div>""", n + 1, T)

POSTS["08-rival"] = [
    placa(f"""
    <div style="position:absolute;left:84px;right:84px;top:200px;display:flex;flex-direction:column;gap:48px">
      <div class="k">Rugby y método</div>
      <h1 class="t" style="font-size:160px">Qué mirar del rival <span class="n">antes del sábado.</span></h1>
      <p class="s">Tener el video sirve si sabés qué buscar. Cuatro cosas que miramos de cada rival.</p>
    </div>""", 1, T),
    item(1, "Scrum", ["¿Empuja recto o gira?", "¿Cuántas veces sale por octavo y por dónde?"]),
    item(2, "Line", ["¿A qué zona tira con 5, 6 o 7 hombres?", "¿Arma maul cerca del ingoal?"]),
    item(3, "Salidas", ["¿Patea largo, corto o juega desde su campo?", "¿Quién persigue y quién recibe?"]),
    item(4, "Defensa en las 22", ["¿Sube rápido o se desliza?", "¿Dónde quedan los huecos cuando se cansa?"]),
    placa(f"""
    <div style="position:absolute;left:84px;right:84px;top:200px;display:flex;flex-direction:column;gap:48px">
      <div class="k">Tu turno</div>
      <h1 class="t" style="font-size:170px">¿Qué <span class="n">agregarías vos?</span></h1>
      <p class="s">Dejalo en los comentarios. Las mejores ideas van a la próxima publicación.</p>
    </div>""", 6, T),
]

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1080, "height": 1350}, device_scale_factor=1)
    for nombre, placas in POSTS.items():
        for i, html in enumerate(placas, 1):
            f = OUT / f"_tmp.html"
            f.write_text(html)
            pg.goto(f"file://{f}")
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(150)
            pg.screenshot(path=str(OUT / f"{nombre}-{i}.jpg"), type="jpeg", quality=92)
        print(nombre, len(placas))
    (OUT / "_tmp.html").unlink()
    b.close()
