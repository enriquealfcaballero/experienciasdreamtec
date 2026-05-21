# Dreamtec · Eventos de Experiencia

Sitio estático autocontenido con dos vistas:

- **`index.html`** — Carta Gantt completa (cronograma, dependencias, reglas).
- **`Tablero.html`** — Tablero operativo (checklist por evento, persistido en el navegador del usuario).

Ambas vistas comparten datos y están enlazadas entre sí: desde la Gantt hay un link al Tablero y viceversa.

## Deploy en Netlify

**Opción 1 — Drag & drop (más rápido)**
1. Entra a https://app.netlify.com/drop
2. Arrastra esta carpeta completa.
3. Listo: Netlify entrega una URL pública en segundos.

**Opción 2 — Desde repo Git**
1. Sube esta carpeta a un repo.
2. En Netlify: *Add new site → Import from Git*.
3. Build command: *(vacío)*. Publish directory: `.`

## Estructura

```
index.html              Carta Gantt (CSS + JSX embebidos)
Tablero.html            Tablero operativo (CSS + JSX embebidos)
assets/
  dreamtec-logo.png
```

## Notas

- React 18 y Babel se cargan desde CDN (unpkg).
- Todo el código (datos, componentes, estilos, logo) está embebido en cada HTML.
- El Tablero guarda los eventos y el avance en `localStorage` del navegador.
