-- ============================================================
-- Adjuntos (Storage) + cambios de permisos — aplicar DESPUÉS de schema.sql
-- ============================================================
-- Incluye:
--   1) Nueva área para "Brief con el anfitrión" (t_brief_anf -> comercial)
--   2) Deshacer una tarea: SOLO admin (RLS de borrado en task_status)
--   3) Tabla task_attachments (evidencias por tarea) + RLS + Realtime
--   4) Bucket de Storage 'evidencias' (privado) + políticas
-- Idempotente: se puede correr varias veces.
-- ============================================================

-- 1) Área de la tarea nueva (necesaria para que RLS permita a Ventas marcarla)
insert into public.task_areas (task_id, area) values ('t_brief_anf', 'comercial')
on conflict (task_id) do update set area = excluded.area;

-- 2) Solo el admin puede DESHACER (borrar) una tarea ya marcada.
--    Los miembros siguen pudiendo marcar (insert), pero no desmarcar.
drop policy if exists ts_delete on public.task_status;
create policy ts_delete on public.task_status for delete to authenticated
  using (public.is_admin());

-- 3) Tabla de adjuntos -------------------------------------------------
create table if not exists public.task_attachments (
  id                bigint generated always as identity primary key,
  event_id          text        not null references public.eventos(id) on delete cascade,
  task_id           text        not null,
  name              text        not null,
  path              text        not null,
  mime              text,
  size              bigint,
  uploaded_by       uuid        references auth.users(id) on delete set null,
  uploaded_by_email text,
  uploaded_at       timestamptz not null default now()
);
create index if not exists task_attachments_event_idx on public.task_attachments (event_id, task_id);

alter table public.task_attachments enable row level security;

-- ver: cualquier autenticado
drop policy if exists ta_att_select on public.task_attachments;
create policy ta_att_select on public.task_attachments for select to authenticated using (true);

-- subir: admin o miembro del área de la tarea (mismo criterio que task_status)
drop policy if exists ta_att_insert on public.task_attachments;
create policy ta_att_insert on public.task_attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (public.is_admin() or public.my_area() = (select area from public.task_areas where task_id = task_attachments.task_id))
  );

-- borrar adjunto: admin o quien lo subió
drop policy if exists ta_att_delete on public.task_attachments;
create policy ta_att_delete on public.task_attachments for delete to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

-- Realtime (para que el tablero vea adjuntos en vivo)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_attachments'
  ) then
    alter publication supabase_realtime add table public.task_attachments;
  end if;
end $$;

-- 4) Bucket de Storage 'evidencias' (privado) + políticas ---------------
insert into storage.buckets (id, name, public) values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

-- ver/descargar (necesario también para generar signed URLs): autenticado
drop policy if exists evidencias_select on storage.objects;
create policy evidencias_select on storage.objects for select to authenticated
  using (bucket_id = 'evidencias');

-- subir: autenticado (el control fino de área lo da la RLS de task_attachments)
drop policy if exists evidencias_insert on storage.objects;
create policy evidencias_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and owner = auth.uid());

-- borrar archivo: admin o dueño del archivo
drop policy if exists evidencias_delete on storage.objects;
create policy evidencias_delete on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and (owner = auth.uid() or public.is_admin()));
