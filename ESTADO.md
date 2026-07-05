# ESTADO — experienciasdreamtec

> Actualizado: 2026-07-04 · Resumen del estado del proyecto para contexto rápido (personas y asistentes).

## Qué es
App de **eventos de experiencia de Dreamtec**: Carta Gantt (`index.html`, lectura) + **Tablero operativo** (`Tablero.html`, checklist por evento y por área, en tiempo real). Sitio estático sin build (React + Babel + supabase-js por CDN), originado en claude.ai/design.

## URLs y deploy
- **Producción:** https://expdt.verticecorp.cl (también https://experienciasdreamtec.netlify.app, Site URL en Supabase Auth).
- **Deploy continuo:** Netlify conectado al repo → push a `main` redespliega. Publish dir `.`, sin build.

## Backend (Supabase PROPIO `qzsdurpcrnkiyhjzhpks`, región sa-east-1)
- Tablas: `eventos` (id text + data jsonb), `profiles`, `task_status`, `task_areas`. Realtime activo (eventos y task_status en `supabase_realtime`; `realtime.setAuth(token)` para RLS).
- **Auth real** (email+contraseña, confirmación por correo activada, SMTP integrado de Supabase — rate-limited). Registro restringido a `@dreamtec.cl`/`@ofimundo.cl` (trigger `check_email_domain`). `handle_new_user` crea el perfil con área; `enrique@dreamtec.cl` = admin.
- Permisos por RLS: miembro marca solo tareas de SU área; admin todo; crear evento = comercial/admin; eliminar = admin. RPC `admin_delete_user` para eliminar usuarios.
- `auth.js` (vanilla) es el gate en ambas páginas y comparte `window.DT`.

## Estado actual
- Tablero migrado de localStorage a Supabase (todas las áreas ven el avance en vivo).
- Panel Usuarios (admin): dar/quitar admin, cambiar área, eliminar.
- Dashboard: eventos y monto vendido por mes.
- Deep-link `#mejoras` desde el portal (abre el buzón de mejoras, módulo compartido VxMejoras).

## Gotchas
- El `schema.sql` no corre completo por `/database/query` de la Management API (el `$$` rompe el parser) → por partes o SQL Editor.
- SMTP propio (Resend) pendiente de configurar aquí (hoy usa el de Supabase, limitado).

## Pendientes
1. SMTP propio para correos de Auth.
2. Lo que surja del buzón de mejoras.
