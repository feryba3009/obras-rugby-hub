# Arma las páginas del sitio de ADN Sports con el mismo encabezado y pie. Uso: python3 sitio-adn-fuente/armar.py
import pathlib
fuente = pathlib.Path(__file__).resolve().parent
raiz = fuente.parent / "sitio-adn"
MENU = [("/", "Inicio"), ("/ayuda/", "Ayuda"), ("/soporte/", "Soporte")]

def pagina(ruta, titulo, descripcion, cuerpo, activo):
    menu = "".join(f'<a href="{h}"{" aria-current=\"page\"" if h == activo else ""}>{t}</a>' for h, t in MENU)
    html = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo}</title>
<meta name="description" content="{descripcion}">
<link rel="icon" href="/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/estilos.css">
</head>
<body>
<header class="sitio"><div class="contenedor">
<a class="marca" href="/"><img src="/logo.svg" alt=""><span>ADN<small>SPORTS</small></span></a>
<nav class="menu">{menu}</nav>
</div></header>
<main class="contenedor">
{cuerpo}
</main>
<footer class="sitio"><div class="contenedor">
<span>ADN Sports · Cada club tiene su ADN</span>
<span><a href="/privacidad/">Privacidad</a> · <a href="/soporte/">Soporte</a> · <a href="mailto:contacto@adnsports.com.ar">contacto@adnsports.com.ar</a></span>
</div></footer>
</body>
</html>
"""
    destino = raiz / ruta
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding="utf-8")

for archivo, titulo, desc, activo in [
    ("index.html", "ADN Sports · La app de tu club", "Plantel, wellness, entrenamiento, partido y análisis en una sola app con la identidad de tu club.", "/"),
    ("ayuda/index.html", "Ayuda · ADN Sports", "Guías cortas para jugadores, cuerpo técnico y managers.", "/ayuda/"),
    ("privacidad/index.html", "Política de privacidad · ADN Sports", "Qué datos guarda la app, para qué y quién los ve.", "/privacidad/"),
    ("soporte/index.html", "Soporte · ADN Sports", "Cómo contactarnos si algo no funciona.", "/soporte/"),
]:
    cuerpo = (fuente / (archivo.replace("/index.html", "").replace(".html", "") + ".html")).read_text(encoding="utf-8")
    pagina(archivo, titulo, desc, cuerpo, activo)
print("listo")
