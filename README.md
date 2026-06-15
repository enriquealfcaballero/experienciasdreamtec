# Dreamtec · Eventos de Experiencia

Sitio estático con dos vistas, conectado a **Supabase** para estado compartido en tiempo real:

- **`index.html`** — Carta Gantt completa (cronograma, dependencias, reglas).
- **`Tablero.html`** — Tablero operativo: checklist por evento. Cualquier área marca sus tareas y **todos ven el avance en vivo** (persistido en Supabase, ya no en el navegador).

## Arquitectura

- HTML/CSS/JS estático, **sin build**. React 18 + Babel + `@supabase/supabase-js` se cargan desde CDN.
- El Tablero guarda cada evento como una fila en la tabla `eventos` (columna `data` jsonb) y se suscribe a **Realtime** para reflejar cambios de otras personas al instante.
- La Carta Gantt (`index.html`) es de solo lectura, no usa backend.

## Puesta en marcha

### 1. Base de datos (Supabase)
1. Crea un proyecto en https://supabase.com.
2. En **SQL Editor**, ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql) (crea la tabla `eventos`, las políticas RLS y habilita Realtime).
3. En **Project Settings → API**, copia el **Project URL** y la **anon public key**.
4. Pégalos en [`supabase-config.js`](supabase-config.js).

> La `anon key` es pública por diseño (viaja al navegador). El acceso real lo controlan
> las políticas RLS. Hoy son **abiertas al rol anónimo** (herramienta interna sin login).
> Para endurecerlo, activa Supabase Auth y cambia las políticas a `to authenticated`.

### 2. Deploy (Netlify)
**Desde Git (recomendado, redeploy automático en cada push):**
1. Sube este repo a GitHub.
2. Netlify → *Add new site → Import from Git* → selecciona el repo.
3. Build command: *(vacío)*. Publish directory: `.` (ya configurado en `netlify.toml`).

**O drag & drop:** arrastra la carpeta a https://app.netlify.com/drop (con `supabase-config.js` ya completado).

## Estructura

```
index.html            Carta Gantt (autocontenida)
Tablero.html          Tablero operativo (React + Supabase + Realtime)
supabase-config.js    URL + anon key del proyecto Supabase
supabase/schema.sql   Tabla eventos + RLS + Realtime
netlify.toml          Publish dir = "."
assets/dreamtec-logo.png
```

## Modelo de datos

Tabla `eventos`: `id text pk`, `data jsonb`, `created_at`, `updated_at`.
`data` contiene el evento completo: `name, client, eventDate, paymentMode, seller, venue, attendees, amount, notes, createdAt, taskStatus`.
`taskStatus[taskId] = { done, by, at }` registra qué área marcó cada tarea y cuándo.
