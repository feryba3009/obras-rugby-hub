import React from "react";
import { createRoot } from "react-dom/client";
import "./estilos.css";
import Landing from "./Landing.jsx";
import Demo from "./demo/Demo.jsx";

// Dos páginas: el sitio (/) y la demo navegable (/demo)
const enDemo = window.location.pathname.replace(/\/+$/, "") === "/demo";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>{enDemo ? <Demo /> : <Landing />}</React.StrictMode>
);
