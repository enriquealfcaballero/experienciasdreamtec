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
- **Fix por código** — nueva **Edge Function de Supabase** `supabase/functions/auth-email/index.ts` (misma infra que `notify-task`): genera el token con la Admin API (`/auth/v1/admin/generate_link`) y envía el correo **branded DREAMTEC por Resend** (logo `assets/dreamtec-logo.png`, FROM `MAIL_FROM` = `Dreamtec Experiencias <notificaciones@verticecorp.cl>`). El enlace se arma con el **`hashed_token`** apuntando a **la app** `https://expdt.verticecorp.cl/?th=...&vt=...(&dt=recovery)` — se **ignora el redirect de Supabase**, así no depende del Site URL ni cae en el portal.
- **Reusa los secrets del proyecto**: `RESEND_API_KEY` (el mismo de notify-task) + `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (inyectados por Supabase). **No requiere env nuevas en Netlify.**
- `auth.js`: `recover`/`register`/`resend` llaman a la Edge Function (`authEmail` → `CFG.url + "/functions/v1/auth-email"` con la anon key); `start()` detecta `th`/`vt` y hace `verifyOtp({token_hash,type})` (recovery → form de nueva contraseña; signup/magiclink → sesión). Se dejó de usar `resetPasswordForEmail`/`signUp`/`resend` del cliente. Dominios (@dreamtec.cl/@ofimundo.cl) validados también en la función. (Se eliminó el intento previo de función Netlify.)
- **DESPLEGADA (2026-07-14)** en el proyecto **pqhc** (Experiencias migró a la base del hub `pqhcmtvnoytuzuvxxrbq`; `supabase-config.js` ya apunta ahí). Deploy vía Management API (Edge Function `auth-email`, verify_jwt=true, se llama con la anon key). Salud verificada: correo inexistente → `{ok:true,sent:false}`; dominio no permitido → error correcto; **service role OK** (genera el enlace).
- **BLOQUEO ÚNICO**: el secret `RESEND_API_KEY` del proyecto pqhc (el que usa `notify-task`) **es inválido** → al enviar a un usuario real Resend responde "API key is invalid". Hay que **actualizarlo con una key válida `re_…`** (Supabase → pqhc → Edge Functions → Manage secrets, o `POST /v1/projects/pqhc/secrets`). Esto además **arregla los correos de notify-task** ("te toca una tarea"), que fallaban por lo mismo. (El hub campanas-vertice usa una key de Resend VÁLIDA pero en el env de Netlify, store distinto.)

## Gotchas
- El `schema.sql` no corre completo por `/database/query` de la Management API (el `$$` rompe el parser) → por partes o SQL Editor.
- Correos de Auth: ya NO usan el SMTP de Supabase → van por la Edge Function `auth-email` + Resend (marca Dreamtec, link a la app).

## Pendientes
1. **Desplegar la Edge Function `auth-email`** (+ secret `RESEND_API_KEY` si no está) para activar los correos de Auth branded Dreamtec.
2. Lo que surja del buzón de mejoras.
