# Correos con Resend (registro + "te toca una tarea")

Esta guía deja funcionando dos cosas:

- **A. Correos de registro / confirmación** (Supabase Auth) saliendo por el **SMTP de Resend**.
- **B. Correos "le toca a tu área una tarea"** — una **Edge Function** (`notify-task`) que se dispara con **Database Webhooks** y envía por la **API de Resend** a todos los usuarios del área.

Remitente acordado: **`Dreamtec Experiencias <notificaciones@verticecorp.cl>`**
(el dominio `verticecorp.cl` ya está verificado en Resend).

---

## 0. Una sola API key de Resend para todo

1. Entra a Resend → **API Keys** → **Create API Key** (permiso *Sending access*).
2. Copia la clave (empieza con `re_…`). **Se muestra una sola vez.**
3. La usarás en dos lugares: como **password del SMTP** (parte A) y como **secret `RESEND_API_KEY`** de la Edge Function (parte B).

---

## A. SMTP de Resend en Supabase (correos de registro)

Supabase → tu proyecto → **Authentication → Emails → SMTP Settings** (en algunas versiones: *Project Settings → Authentication → SMTP*). Activa **Enable Custom SMTP** y completa:

| Campo                | Valor                          |
| -------------------- | ------------------------------ |
| Sender email         | `notificaciones@verticecorp.cl`|
| Sender name          | `Dreamtec Experiencias`        |
| Host                 | `smtp.resend.com`              |
| Port                 | `465`                          |
| Username             | `resend`                       |
| Password             | tu API key `re_…`              |
| Minimum interval     | (déjalo por defecto)           |

Guarda. Luego, en **Authentication → URL Configuration**:

- **Site URL** = la URL pública de Netlify, por ej. `https://experienciasdreamtec.netlify.app`
  (así el enlace de confirmación apunta a tu sitio y no a `localhost`).
- En **Redirect URLs** agrega también `https://TU-SITIO.netlify.app/**`.

> A partir de aquí, los correos de **confirmación de registro**, **recuperar contraseña**, etc.
> salen por Resend (mejor entrega que el SMTP compartido de Supabase, que además tiene límite de ~3–4 correos/hora).

**Probar:** registra un usuario de prueba `@dreamtec.cl` y revisa que llegue el correo. En Resend → **Logs** verás cada envío.

---

## B. Correos "te toca una tarea" (Edge Function + Webhooks)

### B.1 Crear la tabla de control

Supabase → **SQL Editor** → pega y ejecuta [`notifications.sql`](notifications.sql).
(Crea `public.task_notifications`, que evita correos duplicados.)

### B.2 Desplegar la Edge Function `notify-task`

**Opción 1 — Panel (sin instalar nada):**

1. Supabase → **Edge Functions** → **Deploy a new function** (o *Create function*).
2. Nombre: **`notify-task`**.
3. Pega el contenido de [`functions/notify-task/index.ts`](functions/notify-task/index.ts).
4. **Desactiva "Verify JWT"** (toggle en la config de la función): el webhook no manda JWT; la seguridad la damos con `WEBHOOK_SECRET`.
5. Deploy.

**Opción 2 — CLI (si luego instalas Supabase CLI):**

```bash
supabase login
supabase link --project-ref qzsdurpcrnkiyhjzhpks
supabase functions deploy notify-task --no-verify-jwt
```

### B.3 Secrets de la función

Supabase → **Edge Functions → notify-task → Secrets** (o *Settings → Edge Functions → Secrets*). Agrega:

| Secret           | Valor                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| `RESEND_API_KEY` | tu API key `re_…`                                                     |
| `MAIL_FROM`      | `Dreamtec Experiencias <notificaciones@verticecorp.cl>`               |
| `SITE_URL`       | `https://TU-SITIO.netlify.app/Tablero.html`                           |
| `WEBHOOK_SECRET` | una cadena larga al azar (la repetirás en el header del webhook)      |
| `FALLBACK_EMAIL` | `enrique@dreamtec.cl` (a quién avisar si un área no tiene usuarios)    |

> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles para la función; no hay que agregarlos.

### B.4 Crear los Database Webhooks

Supabase → **Database → Webhooks** → **Create a new hook**. Crea **DOS** hooks idénticos salvo la tabla:

**Webhook 1 — tareas desbloqueadas**
- Table: **`task_status`**
- Events: **Insert**
- Type: **Supabase Edge Functions** → función **`notify-task`**
  (o HTTP Request `POST` a `https://qzsdurpcrnkiyhjzhpks.supabase.co/functions/v1/notify-task`)
- HTTP Headers (añade uno): `x-webhook-secret` = el mismo valor de `WEBHOOK_SECRET`.

**Webhook 2 — evento nuevo (tareas iniciales)**
- Table: **`eventos`**
- Events: **Insert**
- Resto, idéntico al Webhook 1 (misma función, mismo header `x-webhook-secret`).

### B.5 Probar

1. Crea un evento nuevo desde el Tablero → el área **Ventas** (comercial) debería recibir
   "Le toca a Ventas: Generar cotización".
2. Marca tareas en orden; cuando completes el último prerequisito de una tarea, el área
   correspondiente recibe su aviso (todos los del área en el mismo "Para:").
3. Diagnóstico: **Edge Functions → notify-task → Logs** (qué envió / errores) y
   **Resend → Logs** (entrega real). La respuesta de la función trae un JSON `notified`
   con a quién se envió o por qué se omitió.

---

## Cómo decide a quién y cuándo enviar

- A una tarea "le toca" cuando **todos sus `prereq` están marcados** para ese evento
  (respeta la modalidad **Contado/Crédito** del evento).
- Al **crear** un evento, avisa solo las tareas iniciales reales (sin `prereq` y que parten el día 0):
  hoy eso es **Generar cotización** (Ventas).
- Destinatarios = **todos los usuarios cuyo perfil tiene esa área** (`profiles.area`), en un único correo.
- `task_notifications` garantiza **un correo por (evento, tarea)**: marcar/desmarcar no reenvía.

> ⚠️ El grafo de tareas está **duplicado** dentro de `functions/notify-task/index.ts`
> (constante `TASKS`) como espejo del `window.GANTT_DATA` de `Tablero.html`.
> Si agregas/cambias tareas, dependencias o áreas en el Tablero, **actualiza también**
> esa constante y vuelve a desplegar la función.
