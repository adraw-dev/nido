-- =====================================================================
-- Nido · Migración MVP
-- Hogares, tareas, hábitos, finanzas y vehículos con RLS.
--
-- Modelo de privacidad (aplica a toda tabla "de dominio"):
--   household_id  -> a qué hogar pertenece el registro
--   owner_id      -> quién lo creó / a quién pertenece
--   visibility    -> 'personal' (solo owner_id) | 'shared' (todo el hogar)
-- Las tablas hijas (completions, logs, records, attachments) heredan la
-- visibilidad de su padre mediante subconsultas que también pasan por RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.visibility as enum ('personal', 'shared');
create type public.member_role as enum ('owner', 'member');
create type public.tx_kind as enum ('income', 'expense', 'saving');
create type public.habit_period as enum ('day', 'week', 'month');
create type public.vehicle_kind as enum ('moto', 'carro');
create type public.vehicle_record_type as enum (
  'aceite', 'llantas', 'frenos', 'bateria', 'repuestos', 'combustible',
  'soat', 'tecnomecanica', 'preventivo', 'correctivo', 'lavado', 'otro'
);

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Impide que un UPDATE cambie el dueño o el hogar de un registro.
create or replace function public.protect_ownership()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.owner_id := old.owner_id;
  new.household_id := old.household_id;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_path  text,
  accent       text,               -- color personal con el que "firma" sus acciones
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Hogares e integrantes
-- ---------------------------------------------------------------------
create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  currency   char(3) not null default 'COP',
  timezone   text not null default 'America/Bogota',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.household_invites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code         text not null unique
               default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by   uuid not null default auth.uid() references public.profiles (id),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_by      uuid references public.profiles (id),
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- Helpers de seguridad. SECURITY DEFINER evita la recursión de RLS
-- sobre household_members.
create or replace function public.is_member(hh uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hh and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_household_owner(hh uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hh and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create or replace function public.can_see(hh uuid, owner uuid, vis public.visibility)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_member(hh) and (vis = 'shared' or owner = (select auth.uid()));
$$;

create or replace function public.shares_household(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.household_members a
    join public.household_members b on b.household_id = a.household_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

-- Crear un hogar deja al creador como owner.
create or replace function public.create_household(p_name text)
returns public.households language plpgsql security definer set search_path = '' as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  insert into public.households (name, created_by) values (p_name, auth.uid()) returning * into h;
  insert into public.household_members (household_id, user_id, role) values (h.id, auth.uid(), 'owner');
  return h;
end $$;

-- Unirse a un hogar con un código de invitación de un solo uso.
create or replace function public.join_household(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inv public.household_invites;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  select * into inv from public.household_invites
  where code = upper(trim(p_code)) and used_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'Código inválido o vencido' using errcode = 'P0002';
  end if;
  insert into public.household_members (household_id, user_id)
  values (inv.household_id, auth.uid())
  on conflict do nothing;
  update public.household_invites set used_by = auth.uid(), used_at = now() where id = inv.id;
  return inv.household_id;
end $$;

-- ---------------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id     uuid not null default auth.uid() references public.profiles (id),
  visibility   public.visibility not null default 'shared',
  assignee_id  uuid references public.profiles (id),      -- null = responsabilidad compartida
  title        text not null check (char_length(title) between 1 and 120),
  notes        text,
  priority     smallint not null default 2 check (priority between 1 and 3), -- 1 alta · 2 normal · 3 baja
  due_on       date,                -- tarea única: fecha límite · recurrente: primera ocurrencia
  due_time     time,
  recurrence   text,                -- RRULE (RFC 5545), p. ej. 'FREQ=WEEKLY;BYDAY=MO,TH'. null = única
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint tasks_personal_is_own
    check (visibility = 'shared' or assignee_id is null or assignee_id = owner_id),
  constraint tasks_recurrence_needs_start
    check (recurrence is null or due_on is not null)
);
create index tasks_household_idx on public.tasks (household_id) where archived_at is null;

-- El asignado debe pertenecer al hogar.
create or replace function public.validate_task_assignee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from public.household_members
    where household_id = new.household_id and user_id = new.assignee_id
  ) then
    raise exception 'El asignado no pertenece al hogar' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger tasks_validate_assignee before insert or update of assignee_id on public.tasks
  for each row execute function public.validate_task_assignee();
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();
create trigger tasks_protect before update on public.tasks
  for each row execute function public.protect_ownership();

-- Una fila por ocurrencia cumplida. La restricción UNIQUE es la que evita
-- dobles registros (también desde QR). Las tareas recurrentes "se reinician"
-- porque cada día/semana es una ocurrencia nueva: no hay cron.
create table public.task_completions (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks (id) on delete cascade,
  household_id  uuid not null references public.households (id) on delete cascade, -- copiado del padre (filtros realtime)
  occurrence_on date not null,
  completed_by  uuid not null default auth.uid() references public.profiles (id),
  completed_at  timestamptz not null default now(),
  source        text not null default 'manual' check (source in ('manual', 'qr')),
  unique (task_id, occurrence_on)
);
create index task_completions_household_idx on public.task_completions (household_id, completed_at desc);

create or replace function public.fill_household_from_task()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select household_id into new.household_id from public.tasks where id = new.task_id;
  return new;
end $$;

create trigger task_completions_fill before insert on public.task_completions
  for each row execute function public.fill_household_from_task();

-- ---------------------------------------------------------------------
-- Hábitos
-- ---------------------------------------------------------------------
create table public.habits (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id     uuid not null default auth.uid() references public.profiles (id),
  visibility   public.visibility not null default 'personal',
  name         text not null check (char_length(name) between 1 and 60),
  icon         text,
  color        text,
  period       public.habit_period not null default 'day',
  target_count int not null default 1 check (target_count > 0),  -- veces por período
  weekdays     smallint[] check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]), -- ISO: 1 = lunes. null = todos
  unit         text,                -- 'vasos', 'min', 'páginas'…
  reminder_at  time,
  started_on   date not null default current_date,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index habits_owner_idx on public.habits (owner_id) where archived_at is null;

create trigger habits_touch before update on public.habits
  for each row execute function public.touch_updated_at();
create trigger habits_protect before update on public.habits
  for each row execute function public.protect_ownership();

create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid not null references public.habits (id) on delete cascade,
  logged_on  date not null,
  amount     int not null default 1 check (amount > 0),
  note       text,
  created_at timestamptz not null default now(),
  unique (habit_id, logged_on)
);

-- ---------------------------------------------------------------------
-- Finanzas
-- ---------------------------------------------------------------------
create table public.finance_categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade, -- null = categoría del sistema
  kind         public.tx_kind not null,
  name         text not null check (char_length(name) between 1 and 40),
  icon         text,
  color        text,
  parent_id    uuid references public.finance_categories (id),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique nulls not distinct (household_id, kind, name)
);

create table public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  owner_id      uuid not null default auth.uid() references public.profiles (id),
  visibility    public.visibility not null default 'shared',
  name          text not null check (char_length(name) between 1 and 60),
  target_amount numeric(14, 2) not null check (target_amount > 0),
  target_on     date,
  icon          text,
  color         text,
  achieved_at   timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger savings_goals_touch before update on public.savings_goals
  for each row execute function public.touch_updated_at();
create trigger savings_goals_protect before update on public.savings_goals
  for each row execute function public.protect_ownership();

-- EL libro único de movimientos. Todo dinero (incluido el de vehículos) vive aquí.
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id     uuid not null default auth.uid() references public.profiles (id), -- quién lo registró/pagó
  visibility   public.visibility not null default 'shared',
  kind         public.tx_kind not null,
  amount       numeric(14, 2) not null,
  category_id  uuid references public.finance_categories (id),
  goal_id      uuid references public.savings_goals (id) on delete set null,
  occurred_on  date not null default current_date,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- ingresos y gastos siempre positivos; el ahorro admite retiros (negativos)
  constraint transactions_amount_sign
    check ((kind = 'saving' and amount <> 0) or (kind <> 'saving' and amount > 0))
);
create index transactions_household_date_idx on public.transactions (household_id, occurred_on desc);
create index transactions_goal_idx on public.transactions (goal_id) where goal_id is not null;

create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();
create trigger transactions_protect before update on public.transactions
  for each row execute function public.protect_ownership();

-- ---------------------------------------------------------------------
-- Vehículos
-- ---------------------------------------------------------------------
create table public.vehicles (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id     uuid not null default auth.uid() references public.profiles (id),
  visibility   public.visibility not null default 'shared',
  nickname     text not null check (char_length(nickname) between 1 and 40), -- "Himalayan", "Mazda"
  kind         public.vehicle_kind not null,
  brand        text,
  model        text,
  year         smallint check (year between 1950 and 2100),
  plate        text,
  odometer_km  int not null default 0 check (odometer_km >= 0),
  acquired_on  date,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, plate)
);

create trigger vehicles_touch before update on public.vehicles
  for each row execute function public.touch_updated_at();
create trigger vehicles_protect before update on public.vehicles
  for each row execute function public.protect_ownership();

-- Historial del vehículo. El VALOR no vive aquí: vive en transactions.
create table public.vehicle_records (
  id             uuid primary key default gen_random_uuid(),
  vehicle_id     uuid not null references public.vehicles (id) on delete cascade,
  household_id   uuid not null references public.households (id) on delete cascade,
  transaction_id uuid unique references public.transactions (id) on delete set null, -- null = evento sin costo
  type           public.vehicle_record_type not null,
  title          text not null check (char_length(title) between 1 and 80),            -- concepto
  odometer_km    int check (odometer_km >= 0),
  performed_on   date not null default current_date,
  notes          text,
  created_by     uuid not null default auth.uid() references public.profiles (id),
  created_at     timestamptz not null default now()
);
create index vehicle_records_vehicle_idx on public.vehicle_records (vehicle_id, performed_on desc);

create or replace function public.vehicle_record_sync()
returns trigger language plpgsql set search_path = '' as $$
begin
  select household_id into new.household_id from public.vehicles where id = new.vehicle_id;
  if new.household_id is null then
    raise exception 'Vehículo no encontrado' using errcode = 'P0002';
  end if;
  return new;
end $$;

create trigger vehicle_records_sync before insert on public.vehicle_records
  for each row execute function public.vehicle_record_sync();

-- El kilometraje del vehículo avanza con el registro más alto.
create or replace function public.vehicle_bump_odometer()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.odometer_km is not null then
    update public.vehicles
    set odometer_km = new.odometer_km
    where id = new.vehicle_id and odometer_km < new.odometer_km;
  end if;
  return new;
end $$;

create trigger vehicle_records_bump_odometer after insert or update of odometer_km on public.vehicle_records
  for each row execute function public.vehicle_bump_odometer();

-- Registrar un gasto de vehículo = UNA transacción + UN registro, atómico.
-- SECURITY INVOKER: corre con los permisos (y la RLS) del usuario.
create or replace function public.create_vehicle_expense(
  p_vehicle_id   uuid,
  p_type         public.vehicle_record_type,
  p_title        text,
  p_amount       numeric default null,
  p_performed_on date default current_date,
  p_odometer_km  int default null,
  p_notes        text default null,
  p_visibility   public.visibility default null,
  p_category_id  uuid default null
) returns public.vehicle_records
language plpgsql security invoker set search_path = '' as $$
declare
  v   public.vehicles;
  txid uuid;
  rec public.vehicle_records;
begin
  select * into v from public.vehicles where id = p_vehicle_id;
  if not found then
    raise exception 'Vehículo no encontrado' using errcode = 'P0002';
  end if;

  if p_amount is not null and p_amount > 0 then
    insert into public.transactions (household_id, visibility, kind, amount, category_id, occurred_on, description)
    values (
      v.household_id,
      coalesce(p_visibility, v.visibility),
      'expense',
      p_amount,
      coalesce(p_category_id, (
        select id from public.finance_categories
        where household_id is null and kind = 'expense' and name = 'Vehículos'
      )),
      p_performed_on,
      p_title || ' · ' || v.nickname
    )
    returning id into txid;
  end if;

  insert into public.vehicle_records (vehicle_id, transaction_id, type, title, odometer_km, performed_on, notes)
  values (p_vehicle_id, txid, p_type, p_title, p_odometer_km, p_performed_on, p_notes)
  returning * into rec;

  return rec;
end $$;

-- ---------------------------------------------------------------------
-- Adjuntos (fotos de vehículos, soportes de gastos y mantenimientos)
-- Archivo en Storage: bucket 'media', ruta '{household_id}/{user_id}/{uuid}.{ext}'
-- ---------------------------------------------------------------------
create table public.attachments (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  owner_id          uuid not null default auth.uid() references public.profiles (id),
  vehicle_id        uuid references public.vehicles (id) on delete cascade,
  vehicle_record_id uuid references public.vehicle_records (id) on delete cascade,
  transaction_id    uuid references public.transactions (id) on delete cascade,
  storage_path      text not null unique,
  mime_type         text,
  size_bytes        int,
  is_cover          boolean not null default false,  -- foto principal del vehículo
  created_at        timestamptz not null default now(),
  constraint attachments_one_parent
    check (num_nonnulls(vehicle_id, vehicle_record_id, transaction_id) = 1)
);
create unique index attachments_one_cover_idx on public.attachments (vehicle_id) where is_cover;

-- ---------------------------------------------------------------------
-- Categorías del sistema
-- ---------------------------------------------------------------------
insert into public.finance_categories (household_id, kind, name, icon) values
  (null, 'expense', 'Mercado', 'cart'),
  (null, 'expense', 'Hogar', 'home'),
  (null, 'expense', 'Servicios', 'bolt'),
  (null, 'expense', 'Vehículos', 'car'),
  (null, 'expense', 'Transporte', 'bus'),
  (null, 'expense', 'Salud', 'heart'),
  (null, 'expense', 'Restaurantes', 'fork'),
  (null, 'expense', 'Ocio', 'ticket'),
  (null, 'expense', 'Educación', 'book'),
  (null, 'expense', 'Ropa', 'shirt'),
  (null, 'expense', 'Mascotas', 'paw'),
  (null, 'expense', 'Regalos', 'gift'),
  (null, 'expense', 'Otros', 'dots'),
  (null, 'income',  'Salario', 'wallet'),
  (null, 'income',  'Independiente', 'briefcase'),
  (null, 'income',  'Ventas', 'tag'),
  (null, 'income',  'Otros', 'dots');

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles           enable row level security;
alter table public.households         enable row level security;
alter table public.household_members  enable row level security;
alter table public.household_invites  enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_completions   enable row level security;
alter table public.habits             enable row level security;
alter table public.habit_logs         enable row level security;
alter table public.finance_categories enable row level security;
alter table public.savings_goals      enable row level security;
alter table public.transactions       enable row level security;
alter table public.vehicles           enable row level security;
alter table public.vehicle_records    enable row level security;
alter table public.attachments        enable row level security;

-- Perfiles: me veo a mí y a quienes comparten hogar conmigo.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_household(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Hogares: se crean y se unen solo por RPC (create_household / join_household).
create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_household_owner(id)) with check (public.is_household_owner(id));
create policy households_delete on public.households for delete to authenticated
  using (public.is_household_owner(id));

create policy members_select on public.household_members for select to authenticated
  using (public.is_member(household_id));
create policy members_delete on public.household_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_household_owner(household_id));

create policy invites_select on public.household_invites for select to authenticated
  using (public.is_member(household_id));
create policy invites_insert on public.household_invites for insert to authenticated
  with check (public.is_member(household_id) and created_by = (select auth.uid()));
create policy invites_delete on public.household_invites for delete to authenticated
  using (created_by = (select auth.uid()));

-- Patrón de dominio (tasks, habits, savings_goals, transactions, vehicles):
--   leer/editar: lo compartido del hogar + lo personal propio
--   crear:       en un hogar del que soy miembro, a mi nombre
--   borrar:      solo el autor (lo demás se archiva)
do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'habits', 'savings_goals', 'transactions', 'vehicles'] loop
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using (public.can_see(household_id, owner_id, visibility))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check (public.is_member(household_id) and owner_id = (select auth.uid()))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using (public.can_see(household_id, owner_id, visibility))
         with check (public.can_see(household_id, owner_id, visibility))', t);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated
         using (owner_id = (select auth.uid()) and public.is_member(household_id))', t);
  end loop;
end $$;

-- Cumplimientos: visibles si la tarea es visible; cualquiera que vea la tarea
-- puede cumplirla, siempre firmando como sí mismo. Deshacer: solo quien la cumplió.
create policy completions_select on public.task_completions for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy completions_insert on public.task_completions for insert to authenticated
  with check (
    completed_by = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id and t.archived_at is null)
  );
create policy completions_delete on public.task_completions for delete to authenticated
  using (completed_by = (select auth.uid()));

-- Registros de hábitos: los ve quien ve el hábito; los escribe solo su dueño.
create policy habit_logs_select on public.habit_logs for select to authenticated
  using (exists (select 1 from public.habits h where h.id = habit_id));
create policy habit_logs_write on public.habit_logs for all to authenticated
  using (exists (select 1 from public.habits h where h.id = habit_id and h.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.habits h where h.id = habit_id and h.owner_id = (select auth.uid())));

-- Categorías: las del sistema para todos; las del hogar para sus miembros.
create policy categories_select on public.finance_categories for select to authenticated
  using (household_id is null or public.is_member(household_id));
create policy categories_write on public.finance_categories for all to authenticated
  using (household_id is not null and public.is_member(household_id))
  with check (household_id is not null and public.is_member(household_id));

-- Registros de vehículo: heredan la visibilidad del vehículo. Si el gasto
-- vinculado es personal, el otro integrante ve el mantenimiento pero no el valor.
create policy vehicle_records_select on public.vehicle_records for select to authenticated
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id));
create policy vehicle_records_insert on public.vehicle_records for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.vehicles v where v.id = vehicle_id)
  );
create policy vehicle_records_update on public.vehicle_records for update to authenticated
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id))
  with check (exists (select 1 from public.vehicles v where v.id = vehicle_id));
create policy vehicle_records_delete on public.vehicle_records for delete to authenticated
  using (created_by = (select auth.uid()));

-- Adjuntos: visibles si su padre es visible (las subconsultas pasan por RLS).
create policy attachments_select on public.attachments for select to authenticated
  using (
    public.is_member(household_id) and (
      exists (select 1 from public.vehicles v where v.id = vehicle_id)
      or exists (select 1 from public.vehicle_records r where r.id = vehicle_record_id)
      or exists (select 1 from public.transactions x where x.id = transaction_id)
    )
  );
create policy attachments_insert on public.attachments for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.is_member(household_id)
    and split_part(storage_path, '/', 1) = household_id::text
    and split_part(storage_path, '/', 2) = (select auth.uid())::text
  );
create policy attachments_delete on public.attachments for delete to authenticated
  using (owner_id = (select auth.uid()));

-- =====================================================================
-- Storage
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Leer un archivo exige que exista un adjunto visible para mí que lo apunte.
create policy media_select on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and exists (select 1 from public.attachments a where a.storage_path = name)
  );
-- Subir solo a mi propia carpeta dentro de un hogar del que soy miembro.
create policy media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.is_member(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
create policy media_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- =====================================================================
-- Realtime (respeta RLS: cada cliente solo recibe lo que puede leer)
-- =====================================================================
alter publication supabase_realtime add table
  public.tasks,
  public.task_completions,
  public.habit_logs,
  public.transactions,
  public.vehicle_records;

-- Los helpers no deben ser invocables por usuarios anónimos.
revoke execute on function
  public.is_member(uuid),
  public.is_household_owner(uuid),
  public.can_see(uuid, uuid, public.visibility),
  public.shares_household(uuid),
  public.create_household(text),
  public.join_household(text)
from anon, public;
grant execute on function
  public.is_member(uuid),
  public.is_household_owner(uuid),
  public.can_see(uuid, uuid, public.visibility),
  public.shares_household(uuid),
  public.create_household(text),
  public.join_household(text)
to authenticated;
