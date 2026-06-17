-- ============================================================
-- Notificaciones por correo (Resend) — tabla de control
-- ============================================================
-- Pégalo en el SQL Editor de Supabase DESPUÉS de schema.sql.
--
-- Registra qué (evento, tarea) ya fue notificada para no enviar
-- el mismo correo dos veces (re-marcas, reintentos del webhook…).
-- Solo la Edge Function (service_role) la escribe; RLS activo y sin
-- políticas => denegado para anon/authenticated, service_role la
-- salta por diseño.
-- ============================================================

create table if not exists public.task_notifications (
  event_id    text        not null references public.eventos(id) on delete cascade,
  task_id     text        not null,
  kind        text        not null default 'disponible',
  notified_at timestamptz not null default now(),
  primary key (event_id, task_id, kind)
);

alter table public.task_notifications enable row level security;
-- (sin policies a propósito: nadie del cliente lee/escribe esto)
