-- ============================================================
-- Tablero Operativo Dreamtec — esquema Supabase (con Auth)
-- ============================================================
-- Pégalo completo en el SQL Editor de Supabase. (El endpoint
-- /database/query de la Management API no procesa bien los
-- bloques $$ mezclados; el SQL Editor sí.)
--
-- Modelo:
--   eventos      — metadatos de cada evento (jsonb)
--   task_status  — una fila por tarea marcada (quién/ cuándo)
--   task_areas   — referencia tarea -> área (evita falsear el área en RLS)
--   profiles     — perfil de cada usuario (área + rol)
-- Permisos:
--   - registro restringido a @dreamtec.cl / @ofimundo.cl (trigger)
--   - enrique@dreamtec.cl = admin (trigger)
--   - cada miembro solo marca tareas de su área; admin marca todo
--   - crear eventos: Ventas (comercial) o admin; eliminar: solo admin
-- ============================================================

-- ---------- Eventos (metadatos) ----------
create table if not exists public.eventos (
  id          text primary key,
  data        jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Perfiles ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  area       text not null,
  role       text not null default 'member',  -- 'member' | 'admin'
  created_at timestamptz not null default now()
);

-- ---------- Referencia tarea -> área ----------
create table if not exists public.task_areas (task_id text primary key, area text not null);
insert into public.task_areas (task_id, area) values
('t01','comercial'),('t02','comercial'),('t03','comercial'),('t04','comercial'),('t05','comercial'),('t06','comercial'),
('t11','contabilidad'),('t11b','comercial'),('t12','contabilidad'),
('t07','facturacion'),('t08','facturacion'),('t09','comercial'),('t09b','facturacion'),
('t10','finanzas'),('t10b','contabilidad'),
('t_vta_insumos','comercial'),('t_mesa_def','mesa'),('t_log_def','logistica'),
('t21b','compras'),('t20','compras'),('t21','compras'),
('t13','logistica'),('t16','logistica'),('t14','logistica'),('t15','logistica'),
('t17','mesa'),('t19','mesa'),('t_bod_recep','bodega'),('t_orq','comercial'),
('t22','finanzas'),('t23','finanzas'),('t24','marketing'),('t25','marketing'),('t_go','facturacion'),
('t26','mesa'),('t27','comercial'),('t28','comercial'),('t_cont','comercial'),
('t29','logistica'),('t30','bodega'),('t31','marketing'),
('t32','contabilidad'),('t33','facturacion'),('t33b','contabilidad'),('t34','facturacion')
on conflict (task_id) do update set area = excluded.area;

-- ---------- Estado de tareas (una fila = tarea marcada) ----------
create table if not exists public.task_status (
  event_id        text not null references public.eventos(id) on delete cascade,
  task_id         text not null,
  marked_by       uuid references auth.users(id) on delete set null,
  marked_by_email text,
  marked_at       timestamptz not null default now(),
  primary key (event_id, task_id)
);

-- ---------- Helpers (security definer para evitar recursión de RLS) ----------
create or replace function public.my_area() returns text
  language sql stable security definer set search_path = public
  as $$ select area from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;

-- ---------- Restricción de dominio en el registro ----------
create or replace function public.check_email_domain() returns trigger
  language plpgsql security definer set search_path = public as $$
declare dom text;
begin
  dom := lower(split_part(new.email, '@', 2));
  if dom not in ('dreamtec.cl', 'ofimundo.cl') then
    raise exception 'Solo se permiten correos @dreamtec.cl o @ofimundo.cl';
  end if;
  return new;
end; $$;
drop trigger if exists check_email_domain_trg on auth.users;
create trigger check_email_domain_trg before insert on auth.users
  for each row execute function public.check_email_domain();

-- ---------- Creación de perfil al registrarse ----------
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare a text; fn text; r text;
begin
  a  := coalesce(nullif(new.raw_user_meta_data->>'area',''), 'comercial');
  fn := coalesce(new.raw_user_meta_data->>'full_name', '');
  r  := case when lower(new.email) = 'enrique@dreamtec.cl' then 'admin' else 'member' end;
  insert into public.profiles (id, email, full_name, area, role)
  values (new.id, new.email, fn, a, r)
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, area = excluded.area;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Eliminar usuario (solo admin) ----------
-- Se llama por RPC desde el cliente: sb.rpc('admin_delete_user', { target }).
-- SECURITY DEFINER para poder borrar de auth.users; valida que quien llama sea admin.
create or replace function public.admin_delete_user(target uuid) returns void
  language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede eliminar usuarios';
  end if;
  if target = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta';
  end if;
  delete from auth.users where id = target;  -- cascada a profiles
end; $$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------- updated_at en eventos ----------
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists eventos_set_updated_at on public.eventos;
create trigger eventos_set_updated_at before update on public.eventos
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.eventos     enable row level security;
alter table public.profiles    enable row level security;
alter table public.task_areas  enable row level security;
alter table public.task_status enable row level security;

-- profiles: lees tu propio perfil; admin ve todos; solo admin edita
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- task_areas: solo lectura
drop policy if exists ta_select on public.task_areas;
create policy ta_select on public.task_areas for select to authenticated using (true);

-- task_status: marcar solo tareas de tu área (o admin)
drop policy if exists ts_select on public.task_status;
create policy ts_select on public.task_status for select to authenticated using (true);
drop policy if exists ts_insert on public.task_status;
create policy ts_insert on public.task_status for insert to authenticated
  with check (public.is_admin() or public.my_area() = (select area from public.task_areas where task_id = task_status.task_id));
drop policy if exists ts_delete on public.task_status;
create policy ts_delete on public.task_status for delete to authenticated
  using (public.is_admin() or public.my_area() = (select area from public.task_areas where task_id = task_status.task_id));

-- eventos: ven todos los autenticados; crea Ventas/admin; elimina solo admin
drop policy if exists eventos_select_anon on public.eventos;
drop policy if exists eventos_insert_anon on public.eventos;
drop policy if exists eventos_update_anon on public.eventos;
drop policy if exists eventos_delete_anon on public.eventos;
drop policy if exists eventos_select_auth on public.eventos;
drop policy if exists eventos_insert_auth on public.eventos;
drop policy if exists eventos_update_auth on public.eventos;
drop policy if exists eventos_delete_auth on public.eventos;
create policy eventos_select_auth on public.eventos for select to authenticated using (true);
create policy eventos_insert_auth on public.eventos for insert to authenticated
  with check (public.is_admin() or public.my_area() = 'comercial');
create policy eventos_update_auth on public.eventos for update to authenticated
  using (public.is_admin() or public.my_area() = 'comercial')
  with check (public.is_admin() or public.my_area() = 'comercial');
create policy eventos_delete_auth on public.eventos for delete to authenticated
  using (public.is_admin());

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.eventos;
alter publication supabase_realtime add table public.task_status;
