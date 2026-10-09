import { createClient } from "@supabase/supabase-js";

// Conexión a Supabase. La publishable key es segura para el frontend: el acceso real está
// controlado por las políticas de seguridad (RLS) de la base, que separan los datos por club.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
