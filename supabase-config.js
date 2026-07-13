// Configuración pública de Supabase.
// La "anon key" está diseñada para ser pública (va en el navegador); el acceso
// real se controla con las políticas RLS definidas en supabase/schema.sql.
//   Supabase Dashboard → Project Settings → API
// MIGRADO (2026-07): ahora vive en el Supabase del HUB (proyecto compartido), tablas con prefijo exp_.
window.SUPABASE_CONFIG = {
  url: "https://pqhcmtvnoytuzuvxxrbq.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxaGNtdHZub3l0dXp1dnh4cmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMDQ1MjcsImV4cCI6MjA5Njg4MDUyN30.43HAQ9n-LOWHa7huittqRnzGek24OD2kGFIpUcLBXms"
};
