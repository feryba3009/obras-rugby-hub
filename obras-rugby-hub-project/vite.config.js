import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Demo (VITE_DEMO=1): la app usa una base de datos de ejemplo dentro del navegador en lugar de
// Supabase, y se presenta como Berazategui o como un club genérico (VITE_DEMO_CLUB=generico).
// La app real no cambia.
const ES_DEMO = process.env.VITE_DEMO === "1";
const CLIENTE_DEMO = path.resolve(__dirname, "src/demo/supabaseDemo.js");

function demo() {
  return {
    name: "adn-demo",
    enforce: "pre",
    resolveId(fuente, importador) {
      if (!ES_DEMO || !importador || importador.includes(`${path.sep}demo${path.sep}`)) return null;
      if (/(^|\/)supabaseClient(\.js)?$/.test(fuente)) return CLIENTE_DEMO;
      return null;
    },
    transformIndexHtml(html) {
      if (!ES_DEMO) return html;
      const g = process.env.VITE_DEMO_CLUB === "generico";
      return html
        .replace(/<title>[^<]*<\/title>/, g ? "<title>ADN Sports · Demo</title>" : "<title>ADN Berazategui · Demo</title>")
        .replace(/content="ADN Obras"/, g ? 'content="ADN Demo"' : 'content="ADN Bera"')
        .replace("/manifest.json", g ? "/manifest-demo.json" : "/manifest-berazategui.json")
        .replace("/escudo-icon-192.png", g ? "/adn-icon-192.png" : "/bera-icon-192.png")
        .replace("/escudo-icon-180.png", g ? "/adn-icon-180.png" : "/bera-icon-180.png");
    },
  };
}

export default defineConfig({
  plugins: [demo(), react()],
  preview: {
    allowedHosts: true,
  },
});
