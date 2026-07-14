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

## Correos de Auth por Resend, marca DREAMTEC, link a la app (2026-07-14)
- **Problema**: los correos de recuperación/confirmación salían con el email por defecto de Supabase (marca genérica/Vértice, limitado) y el enlace redirigía a la **página principal de Vértice (www.verticecorp.cl, password-protected)** — porque Supabase caía al Site URL en vez de a la app.
- **Fix por código** (misma estrategia del hub): nueva función `netlify/functions/auth-email.mjs` que genera el token con la Admin API de Supabase (`/auth/v1/admin/generate_link`) y envía el correo **branded DREAMTEC por Resend** (logo `assets/dreamtec-logo.png`, FROM `Dreamtec <no-reply@verticecorp.cl>`). El enlace se arma con el **`hashed_token`** apuntando a **la app** `https://expdt.verticecorp.cl/?th=...&vt=...(&dt=recovery)` — se **ignora el redirect de Supabase**, así no depende del Site URL/dashboard ni cae en el portal.
- `auth.js`: `recover`/`register`/`resend` llaman a la función (`authEmail(mode,...)`); `start()` detecta `th`/`vt` y hace `verifyOtp({token_hash,type})` (recovery → form de nueva contraseña; signup/magiclink → sesión). Se dejó de usar `resetPasswordForEmail`/`signUp`/`resend` del cliente para el envío. Dominios permitidos (@dreamtec.cl/@ofimundo.cl) también validados en la función.
- **FALTA (acción del usuario)**: agregar en el sitio Netlify de Experiencias las env vars **`EXPDT_SERVICE_KEY`** (service_role del proyecto qzsd…) y **`RESEND_API_KEY`**. Sin ellas la función responde 500. (La URL de Supabase va hardcodeada; overridable con `EXPDT_SUPABASE_URL`.)

## Gotchas
- El `schema.sql` no corre completo por `/database/query` de la Management API (el `$$` rompe el parser) → por partes o SQL Editor.
- Correos de Auth: ya NO usan el SMTP de Supabase → van por la función `auth-email` + Resend (marca Dreamtec).

## Pendientes
1. Cargar env vars `EXPDT_SERVICE_KEY` + `RESEND_API_KEY` en Netlify (Experiencias) para activar los correos de Auth.
2. Lo que surja del buzón de mejoras.
