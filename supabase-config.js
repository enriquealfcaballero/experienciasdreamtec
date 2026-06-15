// Configuración pública de Supabase.
// La "anon key" está diseñada para ser pública (va en el navegador); el acceso
// real se controla con las políticas RLS definidas en supabase/schema.sql.
//
// Reemplaza estos valores con los de tu proyecto:
//   Supabase Dashboard → Project Settings → API
//     - Project URL        -> url
//     - Project API keys -> anon public -> anonKey
window.SUPABASE_CONFIG = {
  url: "https://TU-PROYECTO.supabase.co",
  anonKey: "TU-ANON-KEY"
};
