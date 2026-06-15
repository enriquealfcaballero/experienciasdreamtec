-- ============================================================
-- Tablero Operativo Dreamtec — esquema Supabase
-- ============================================================
-- Cada evento del tablero es una fila. El objeto completo del
-- evento (datos + estado de tareas) se guarda en `data` (jsonb),
-- mapeando 1:1 el modelo que antes vivía en localStorage.
-- ============================================================

create table if not exists public.eventos (
  id          text primary key,
  data        jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
-- Esta es una herramienta interna SIN login. Las políticas abren
-- lectura/escritura al rol anónimo (anon). Cualquiera con la URL
-- del sitio puede leer y marcar tareas.
--
-- Para endurecerlo más adelante: activar Supabase Auth y cambiar
-- `to anon` por `to authenticated`, o exigir un claim de equipo.
-- ------------------------------------------------------------
alter table public.eventos enable row level security;

drop policy if exists "eventos_select_anon" on public.eventos;
drop policy if exists "eventos_insert_anon" on public.eventos;
drop policy if exists "eventos_update_anon" on public.eventos;
drop policy if exists "eventos_delete_anon" on public.eventos;

create policy "eventos_select_anon" on public.eventos
  for select to anon using (true);
create policy "eventos_insert_anon" on public.eventos
  for insert to anon with check (true);
create policy "eventos_update_anon" on public.eventos
  for update to anon using (true) with check (true);
create policy "eventos_delete_anon" on public.eventos
  for delete to anon using (true);

-- ------------------------------------------------------------
-- Realtime: que los cambios se propaguen a todos los navegadores
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.eventos;

-- Mantener updated_at al día
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists eventos_set_updated_at on public.eventos;
create trigger eventos_set_updated_at
  before update on public.eventos
  for each row execute function public.set_updated_at();
