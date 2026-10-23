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
    .s{{font:400 52px/1.3 B;color:{SUB};margin:0}}
    .c{{position:absolute;left:84px;right:84px;top:110px;bottom:190px;display:flex;flex-direction:column;justify-content:center}}
    .n{{color:{NARANJA}}}
    </style></head><body><div class="p">{cuerpo}{marca(pagina, total)}</div></body></html>"""


def texto(kicker, titulo, sub, pagina, total, tam=170):
    return placa(f"""
    <div class="c" style="gap:44px">
      <div class="k">{kicker}</div>
      <h1 class="t" style="font-size:{tam}px">{titulo}</h1>
      <div style="width:140px;height:12px;background:{VERDE}"></div>
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
      <div style="font:500 42px B;color:{SUB}">Toda la información de tu club, en una app.</div>
    </div>""", 1, T),
    texto("Quiénes somos", 'Venimos <span class="n">del rugby.</span>',
          "Staff, entrenadores y preparadores. Los martes y jueves a la noche, al costado de la cancha.", 2, T),
    texto("El problema", 'Nos cansamos de <span class="n">las planillas.</span>',
          "Grupos de WhatsApp, un Excel que nadie actualiza y la lista de asistencia en papel. Todo en lugares distintos.", 3, T),
    texto("La solución", 'Armamos <span class="n">la app.</span>',
          "Toda la información del club resumida en una app, al alcance de la mano: plantel, wellness, partidos, GPS y video.", 4, T, 180),
    placa(f"""
    <div class="c" style="gap:44px">
      <div class="k">Ahora</div>
      <h1 class="t" style="font-size:150px">Lo puede usar <span class="n">tu club.</span></h1>
      <div style="width:120px;height:10px;background:{VERDE}"></div>
      <p class="s">Rugby, hockey, fútbol, básquet y más. Escribinos por mensaje directo y coordinamos una demo con los datos de tu club.</p>
      <div style="margin-top:20px;align-self:flex-start;background:{VERDE};color:{NOCHE};font:800 52px BC;padding:22px 40px;border-radius:14px;letter-spacing:.02em">@adn.sporthub</div>
    </div>""", 5, T),
]

# ---------- 4 · Wellness en 4 preguntas ----------
T = 6
def pregunta(n, nombre, pregunta_txt, mira, ejemplo):
    escala = ''.join(
        f'<div style="flex:1;height:120px;border-radius:16px;display:flex;align-items:center;justify-content:center;font:800 58px BC;'
        + (f'background:{VERDE};color:{NOCHE}">' if i == ejemplo else f'background:{TARJETA};color:{NOCHE}">')
        + f'{i}</div>' for i in range(1, 8))
    return placa(f"""
    <div class="c" style="gap:44px">
      <div style="display:flex;align-items:baseline;gap:32px">
        <div class="t n" style="font-size:280px">{n}</div>
        <h1 class="t" style="font-size:150px">{nombre}</h1>
      </div>
      <p class="s" style="font-size:58px;color:{NOCHE};font-weight:500">{pregunta_txt}</p>
      <div>
        <div style="display:flex;gap:12px">{escala}</div>
        <div style="display:flex;justify-content:space-between;font:600 30px B;color:{GRIS};margin-top:14px"><span>1 · peor</span><span>7 · mejor</span></div>
      </div>
      <div style="background:#FFFFFF;border-left:10px solid {VERDE};border-radius:0 16px 16px 0;padding:32px 36px">
        <p class="s" style="font-size:46px"><b style="color:{NOCHE};font-weight:600">Qué mirar:</b> {mira}</p>
      </div>
    </div>""", n + 1, T)

POSTS["04-wellness"] = [
    placa(f"""
    <div class="c" style="gap:48px">
      <div class="k">Método</div>
      <h1 class="t" style="font-size:190px">Wellness en <span class="n">4 preguntas.</span></h1>
      <p class="s">Lo que todo staff debería saber de cada jugador antes de entrenar o jugar.</p>
    </div>""", 1, T),
    pregunta(1, "Sueño", "¿Cómo dormiste anoche?", "dos o tres noches malas seguidas pesan más que una sola.", 5),
    pregunta(2, "Estrés", "¿Cuánto estrés tenés hoy, entre trabajo, estudio y casa?", "el deporte amateur se juega después de una jornada entera.", 3),
    pregunta(3, "Dolor muscular", "¿Cuánto dolor muscular sentís?", "si dura más de 48 horas después del partido, hay que hablar.", 4),
    pregunta(4, "Fatiga", "¿Qué tan cansado llegás al entrenamiento?", "comparalo siempre contra el promedio de ese mismo jugador.", 6),
    placa(f"""
    <div class="c" style="gap:48px">
      <div class="k">La clave</div>
      <h1 class="t" style="font-size:165px">No hace falta un laboratorio. <span class="n">Hace falta constancia.</span></h1>
      <p class="s">Las mismas 4 preguntas, cada día de entrenamiento. Guardá esta publicación para tu próxima pretemporada.</p>
    </div>""", 6, T),
]

# ---------- 6 · ¿Dónde está el video? ----------
POSTS["06-video"] = [
    placa(f"""
    <div style="position:absolute;left:84px;right:84px;top:170px;display:flex;flex-direction:column;gap:30px">
      <div style="display:flex;align-items:center;gap:20px;padding-bottom:26px;border-bottom:2px solid #D6D1C8">
        <div style="width:84px;height:84px;border-radius:50%;background:#1FA37A;color:#0E1620;display:flex;align-items:center;justify-content:center;font:800 36px BC">ST</div>
        <div><div style="font:600 40px B">Staff Primera</div><div style="font:400 30px B;color:{GRIS}">23 participantes</div></div>
      </div>
      <div style="align-self:flex-start;max-width:820px;background:#FFFFFF;border:2px solid #E2DDD3;border-radius:8px 32px 32px 32px;padding:34px 40px">
        <div style="font:600 30px B;color:{NARANJA};margin-bottom:10px">Entrenador de backs</div>
        <div style="font:500 62px/1.2 B">¿Alguien tiene el video del partido?</div>
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
    tarjetas = ''.join(
        f'<div style="background:#FFFFFF;border-left:10px solid {VERDE};border-radius:0 16px 16px 0;padding:30px 36px">'
        f'<p class="s" style="font-size:50px;color:{NOCHE}">{q}</p></div>' for q in preguntas)
    tam = 150 if len(nombre) > 10 else 190
    return placa(f"""
    <div class="c" style="gap:44px">
      <div class="k">Análisis del rival · {n} de 4</div>
      <div style="display:flex;align-items:baseline;gap:32px">
        <div class="t n" style="font-size:280px">{n}</div>
        <h1 class="t" style="font-size:{tam}px">{nombre}</h1>
      </div>
      <div style="display:flex;flex-direction:column;gap:22px">{tarjetas}</div>
    </div>""", n + 1, T)

POSTS["08-rival"] = [
    placa(f"""
    <div class="c" style="gap:48px">
      <div class="k">Rugby y método</div>
      <h1 class="t" style="font-size:175px">Qué mirar del rival <span class="n">antes del partido.</span></h1>
      <p class="s">Tener el video sirve si sabés qué buscar. Cuatro cosas que miramos de cada rival.</p>
    </div>""", 1, T),
    item(1, "Scrum", ["¿Empuja recto o gira?", "¿Cuántas veces sale por octavo y por dónde?"]),
    item(2, "Line", ["¿A qué zona tira con 5, 6 o 7 hombres?", "¿Arma maul cerca del ingoal?"]),
    item(3, "Salidas", ["¿Patea largo, corto o juega desde su campo?", "¿Quién persigue y quién recibe?"]),
    item(4, "Defensa en las 22", ["¿Sube rápido o se desliza?", "¿Dónde quedan los huecos cuando se cansa?"]),
    placa(f"""
    <div class="c" style="gap:48px">
      <div class="k">Tu turno</div>
      <h1 class="t" style="font-size:200px">¿Qué <span class="n">agregarías vos?</span></h1>
      <p class="s">Dejalo en los comentarios. Las mejores ideas van a la próxima publicación.</p>
    </div>""", 6, T),
]

# ---------- 10 · Matchday ----------
T = 5
def panel(contenido):
    return f'<div style="background:{NOCHE};color:{CREMA};border-radius:28px;padding:44px 48px">{contenido}</div>'

def boton(txt, fondo, color):
    return f'<div style="flex:1;background:{fondo};color:{color};border-radius:16px;padding:26px 0;text-align:center;font:800 44px BC">{txt}</div>'

MARCADOR = panel(f"""
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div style="font:700 34px BC;letter-spacing:.06em;color:#9AA3AD">TU CLUB</div>
    <div style="font:700 30px B;color:{VERDE};display:flex;align-items:center;gap:12px"><span style="width:16px;height:16px;border-radius:50%;background:#FF7A6B;display:inline-block"></span>EN VIVO</div>
    <div style="font:700 34px BC;letter-spacing:.06em;color:#9AA3AD">RIVAL</div>
  </div>
  <div style="text-align:center;font:800 210px/1 BC;margin:26px 0 6px;font-variant-numeric:tabular-nums">17 – 10</div>
  <div style="text-align:center;font:700 64px BC;color:{VERDE};font-variant-numeric:tabular-nums">52:14</div>
  <div style="display:flex;gap:16px;margin-top:36px">{boton("+ Try", VERDE, NOCHE)}{boton("+ Penal", "#20262E", CREMA)}{boton("+ Drop", "#20262E", CREMA)}</div>""")

AFUERA = panel(f"""
  <div style="font:700 34px BC;letter-spacing:.12em;color:#9AA3AD;margin-bottom:22px">AFUERA</div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:22px 0;border-top:2px solid #2A313A">
    <div style="font:500 50px B">🟨 Jugador 6</div><div style="font:800 64px BC;color:#F2B33D">vuelve en 06:42</div></div>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:22px 0;border-top:2px solid #2A313A">
    <div style="font:500 50px B">🟨 Jugador 12</div><div style="font:800 64px BC;color:#F2B33D">vuelve en 09:10</div></div>""")

REGISTRO = panel(f"""
  <div style="font:700 34px BC;letter-spacing:.12em;color:#9AA3AD;margin-bottom:12px">REGISTRO DEL PARTIDO</div>
  {''.join(f'<div style="display:flex;gap:30px;padding:20px 0;border-top:2px solid #2A313A;font:500 44px B"><span style="font:800 44px BC;color:{VERDE};width:80px">{m}′</span><span>{t}</span></div>' for m, t in [("12", "Try convertido"), ("25", "Penal adentro"), ("31", "Try del rival"), ("38", "🟨 Amarilla, Jugador 6"), ("49", "Try sin convertir")])}""")

POSTS["10-matchday"] = [
    placa(f"""
    <div class="c" style="gap:48px">
      <div class="k">Matchday</div>
      <h1 class="t" style="font-size:190px">El partido, <span class="n">en vivo.</span></h1>
      <p class="s">Reloj, marcador y tarjetas cargados desde el costado de la cancha. Sin papel, sin planillas.</p>
    </div>""", 1, T),
    placa(f"""
    <div class="c" style="gap:52px">
      <h1 class="t" style="font-size:120px">Un toque <span class="n">y suma.</span></h1>
      {MARCADOR}
      <p class="s">Try, penal o drop: la app pregunta si convirtió y calcula el resultado.</p>
    </div>""", 2, T),
    placa(f"""
    <div class="c" style="gap:52px">
      <h1 class="t" style="font-size:120px">Sabés cuándo <span class="n">vuelve cada uno.</span></h1>
      {AFUERA}
      <p class="s">Cada amarilla arranca su cuenta regresiva. La roja deja al jugador afuera del resto del partido.</p>
    </div>""", 3, T),
    placa(f"""
    <div class="c" style="gap:52px">
      <h1 class="t" style="font-size:120px">Cada jugada, <span class="n">con su minuto.</span></h1>
      {REGISTRO}
    </div>""", 4, T),
    placa(f"""
    <div class="c" style="gap:48px">
      <div class="k">Al terminar</div>
      <h1 class="t" style="font-size:165px">El informe <span class="n">ya está armado.</span></h1>
      <div style="width:140px;height:12px;background:{VERDE}"></div>
      <p class="s">El resultado pasa al calendario, el minuto de cada try al análisis y las tarjetas a la ficha de cada jugador.</p>
      <div style="align-self:flex-start;background:{VERDE};color:{NOCHE};font:800 52px BC;padding:22px 40px;border-radius:14px">Probalo en la demo</div>
    </div>""", 5, T),
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
