# Dreamtec · Eventos de Experiencia

Sitio estático (sin build) con login y estado compartido en tiempo real vía **Supabase**:

- **`index.html`** — Carta Gantt del flujo completo (cronograma, dependencias, reglas).
- **`Tablero.html`** — Tablero operativo: checklist por evento. Cada área marca **solo sus tareas** y todos ven el avance en vivo.

Ambas páginas exigen **iniciar sesión**.

## Acceso (Supabase Auth)

- **Registro restringido** a correos `@dreamtec.cl` y `@ofimundo.cl` (validado en el servidor por un trigger en `auth.users`).
- En el registro la persona elige **su área una sola vez**; queda en su perfil. (Ya no se selecciona el área dentro del tablero.)
- **`enrique@dreamtec.cl` es administrador**: ve y aprueba todo, crea y elimina eventos.
- **Miembros**: solo pueden marcar/desmarcar las tareas de **su propia área**. Las demás aparecen bloqueadas. Esto se cumple en el servidor (RLS), no solo en la interfaz.
- **Crear eventos**: Ventas (área `comercial`) o admin. **Eliminar eventos**: solo admin.
- **Gestión de usuarios** (panel "Usuarios", solo admin): dar/quitar admin, cambiar el área y **eliminar usuarios** (vía la función `admin_delete_user`, que valida que quien llama sea admin).

> El registro **exige confirmación por correo**: al registrarse, la persona recibe un email con un enlace; hasta confirmarlo no puede ingresar. El envío usa el servicio de correo integrado de Supabase, que tiene **límites de tasa** y puede caer en spam; para uso intensivo conviene configurar **SMTP propio** (Supabase → Authentication → Emails → SMTP) y fijar el **Site URL** al dominio de Netlify (Authentication → URL Configuration).

## Arquitectura

- HTML/CSS/JS estático. React 18 + Babel + `@supabase/supabase-js` desde CDN.
- `auth.js` crea el cliente Supabase, bloquea la página con el login y comparte la sesión/perfil (`window.DT`).
- El estado del tablero vive en Supabase y se sincroniza con **Realtime**.

> Nota: al ser un sitio estático, los archivos HTML/JS son públicos (descargables). Lo que el login realmente protege son **los datos** (eventos y avance), gobernados por las políticas RLS de Supabase. La `anon key` es pública por diseño.

## Puesta en marcha

### 1. Base de datos (Supabase)
1. Crea un proyecto en https://supabase.com.
2. En **SQL Editor**, ejecuta [`supabase/schema.sql`](supabase/schema.sql) (tablas, triggers de auth, RLS y Realtime).
3. En **Project Settings → API**, copia el **Project URL** y la **anon public key** y pégalos en [`supabase-config.js`](supabase-config.js).
4. En **Authentication → Providers → Email**, deja habilitado el registro. (Autoconfirmación según la nota de arriba.)

### 2. Deploy (Netlify, conectado a Git)
1. Netlify → *Add new site → Import from Git* → este repo.
2. Build command: *(vacío)*. Publish directory: `.` (en `netlify.toml`).
3. Cada `git push` a `main` redespliega solo.

## Estructura

```
index.html            Carta Gantt (con gate de login)
Tablero.html          Tablero operativo (React + Supabase + Realtime + permisos por área)
auth.js               Login/registro compartido (restringe dominios, crea sesión)
supabase-config.js    URL + anon key del proyecto
supabase/schema.sql   Tablas, triggers de auth, RLS, Realtime
netlify.toml          Publish dir = "."
assets/dreamtec-logo.png
```

## Modelo de datos

- `eventos(id text pk, data jsonb, created_at, updated_at)` — metadatos del evento.
- `task_status(event_id, task_id, marked_by, marked_by_email, marked_at)` — una fila por tarea marcada.
- `task_areas(task_id pk, area)` — referencia tarea→área (la usa RLS para impedir falsear el área).
- `profiles(id uuid pk → auth.users, email, full_name, area, role)` — perfil del usuario.
