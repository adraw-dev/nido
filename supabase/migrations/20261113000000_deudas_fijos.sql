-- =====================================================================
-- Nido · Deudas por pagar y gastos fijos
--
-- Gastos fijos: pagos recurrentes por día del mes (1 día = mensual,
-- 2 días = quincenal). Cada período pagado queda ligado a UN movimiento.
-- Deudas: lo que el hogar o una persona debe. El saldo pendiente se calcula
-- (saldo inicial − abonos); nada derivable se guarda.
--
-- El dinero vive en transactions: pagar crea el movimiento y el pago en una
-- sola operación (como create_vehicle_expense). Borrar el movimiento en
-- Dinero deshace el pago (on delete cascade).
-- Visibilidad: mismo patrón de dominio que transactions y savings_goals.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Categoría del sistema para los abonos a deudas
-- ---------------------------------------------------------------------
insert into public.finance_categories (household_id, kind, name, icon)
values (null, 'expense', 'Deudas', 'bank')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Gastos fijos
-- ---------------------------------------------------------------------
create table public.fixed_expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id     uuid not null default auth.uid() references public.profiles (id),
  visibility   public.visibility not null default 'shared',
  name         text not null check (char_length(name) between 1 and 60),
  amount       numeric(14, 2) not null check (amount > 0),
  category_id  uuid references public.finance_categories (id),
  -- Días del mes en que se paga: uno (mensual) o dos (quincenal). 29-31 en
  -- un mes más corto = último día de ese mes.
  pay_days     smallint[] not null,
  -- Desde cuándo cuenta: períodos anteriores no aparecen como vencidos.
  starts_on    date not null default current_date,
  notes        text check (notes is null or char_length(notes) <= 500),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint fixed_expenses_pay_days check (
    cardinality(pay_days) between 1 and 2
    and 1 <= all (pay_days) and 31 >= all (pay_days)
    and (cardinality(pay_days) = 1 or pay_days[1] <> pay_days[2])
  )
);
create index fixed_expenses_household_idx on public.fixed_expenses (household_id) where archived_at is null;

create trigger fixed_expenses_touch before update on public.fixed_expenses
  for each row execute function public.touch_updated_at();
create trigger fixed_expenses_protect before update on public.fixed_expenses
  for each row execute function public.protect_ownership();

-- Un período pagado = una fila, ligada a su movimiento en Dinero.
create table public.fixed_expense_payments (
  id               uuid primary key default gen_random_uuid(),
  fixed_expense_id uuid not null references public.fixed_expenses (id) on delete cascade,
  household_id     uuid not null references public.households (id) on delete cascade, -- copiado del padre (filtros realtime)
  period_on        date not null,  -- fecha de pago del período (p. ej. 2026-11-15)
  transaction_id   uuid not null unique references public.transactions (id) on delete cascade,
  created_by       uuid not null default auth.uid() references public.profiles (id),
  created_at       timestamptz not null default now(),
  unique (fixed_expense_id, period_on)
);
create index fixed_expense_payments_household_idx on public.fixed_expense_payments (household_id, period_on desc);

create or replace function public.fill_household_from_fixed_expense()
returns trigger language plpgsql set search_path = '' as $$
begin
  select household_id into new.household_id from public.fixed_expenses where id = new.fixed_expense_id;
  if new.household_id is null then
    raise exception 'Gasto fijo no encontrado' using errcode = 'P0002';
  end if;
  return new;
end $$;

create trigger fixed_expense_payments_fill before insert on public.fixed_expense_payments
  for each row execute function public.fill_household_from_fixed_expense();

-- ---------------------------------------------------------------------
-- Deudas por pagar
-- ---------------------------------------------------------------------
create table public.debts (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households (id) on delete cascade,
  owner_id           uuid not null default auth.uid() references public.profiles (id),
  visibility         public.visibility not null default 'shared',
  name               text not null check (char_length(name) between 1 and 60),   -- "Tarjeta Visa"
  creditor           text check (creditor is null or char_length(creditor) <= 60), -- a quién se le debe
  total_amount       numeric(14, 2) not null check (total_amount > 0),
  -- Lo que faltaba por pagar al registrarla en Nido. Pendiente = esto − abonos.
  opening_balance    numeric(14, 2) not null check (opening_balance >= 0),
  -- Cuota opcional: valor y día del mes. Desde starts_on.
  installment_amount numeric(14, 2) check (installment_amount is null or installment_amount > 0),
  installment_day    smallint check (installment_day is null or installment_day between 1 and 31),
  starts_on          date not null default current_date,
  due_on             date,           -- fecha límite para saldarla (opcional)
  category_id        uuid references public.finance_categories (id),
  notes              text check (notes is null or char_length(notes) <= 500),
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint debts_opening_le_total check (opening_balance <= total_amount),
  constraint debts_installment_pair check ((installment_amount is null) = (installment_day is null))
);
create index debts_household_idx on public.debts (household_id) where archived_at is null;

create trigger debts_touch before update on public.debts
  for each row execute function public.touch_updated_at();
create trigger debts_protect before update on public.debts
  for each row execute function public.protect_ownership();

-- Abono: su valor queda aquí (el saldo de la deuda no depende de poder ver
-- el movimiento) y el movimiento vive en Dinero.
create table public.debt_payments (
  id             uuid primary key default gen_random_uuid(),
  debt_id        uuid not null references public.debts (id) on delete cascade,
  household_id   uuid not null references public.households (id) on delete cascade,
  amount         numeric(14, 2) not null check (amount > 0),
  paid_on        date not null default current_date,
  period_on      date,  -- si el abono fue la cuota de un período (su fecha); null = abono extra
  transaction_id uuid not null unique references public.transactions (id) on delete cascade,
  created_by     uuid not null default auth.uid() references public.profiles (id),
  created_at     timestamptz not null default now(),
  unique (debt_id, period_on)
);
create index debt_payments_debt_idx on public.debt_payments (debt_id, paid_on desc);

create or replace function public.fill_household_from_debt()
returns trigger language plpgsql set search_path = '' as $$
begin
  select household_id into new.household_id from public.debts where id = new.debt_id;
  if new.household_id is null then
    raise exception 'Deuda no encontrada' using errcode = 'P0002';
  end if;
  return new;
end $$;

create trigger debt_payments_fill before insert on public.debt_payments
  for each row execute function public.fill_household_from_debt();

-- Si alguien edita el valor o la fecha del movimiento en Dinero, el abono lo sigue.
-- SECURITY DEFINER: solo toca el abono ligado a ese movimiento.
create or replace function public.sync_debt_payment_from_transaction()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.debt_payments
  set amount = new.amount, paid_on = new.occurred_on
  where transaction_id = new.id
    and (amount <> new.amount or paid_on <> new.occurred_on);
  return new;
end $$;

create trigger transactions_sync_debt_payment
  after update of amount, occurred_on on public.transactions
  for each row execute function public.sync_debt_payment_from_transaction();

-- ---------------------------------------------------------------------
-- RPCs de pago: movimiento + pago, atómicos. SECURITY INVOKER (pasan por RLS).
-- ---------------------------------------------------------------------

-- ¿p_on es una fecha de pago de esos días? (29-31 = último día en meses cortos)
create or replace function public.is_pay_date(p_days smallint[], p_on date)
returns boolean language sql immutable set search_path = '' as $$
  select exists (
    select 1 from unnest(p_days) d
    where least(d::int, extract(day from (date_trunc('month', p_on::timestamp) + interval '1 month - 1 day'))::int)
          = extract(day from p_on)::int
  );
$$;

create or replace function public.pay_fixed_expense(
  p_fixed_expense_id uuid,
  p_period_on        date,
  p_amount           numeric default null,
  p_paid_on          date default current_date
) returns public.fixed_expense_payments
language plpgsql security invoker set search_path = '' as $$
declare
  f    public.fixed_expenses;
  txid uuid;
  pay  public.fixed_expense_payments;
begin
  select * into f from public.fixed_expenses where id = p_fixed_expense_id;
  if not found then
    raise exception 'Gasto fijo no encontrado' using errcode = 'P0002';
  end if;
  if not public.is_pay_date(f.pay_days, p_period_on) then
    raise exception 'Esa fecha no es un período de este gasto fijo' using errcode = '22023';
  end if;
  if exists (select 1 from public.fixed_expense_payments where fixed_expense_id = f.id and period_on = p_period_on) then
    raise exception 'Este período ya está pagado' using errcode = '23505';
  end if;

  insert into public.transactions (household_id, visibility, kind, amount, category_id, occurred_on, description)
  values (
    f.household_id,
    f.visibility,
    'expense',
    coalesce(p_amount, f.amount),
    coalesce(f.category_id, (
      select id from public.finance_categories
      where household_id is null and kind = 'expense' and name = 'Otros'
    )),
    coalesce(p_paid_on, current_date),
    f.name || ' · ' || to_char(p_period_on, 'DD/MM')
  )
  returning id into txid;

  insert into public.fixed_expense_payments (fixed_expense_id, period_on, transaction_id)
  values (f.id, p_period_on, txid)
  returning * into pay;

  return pay;
end $$;

create or replace function public.pay_debt(
  p_debt_id   uuid,
  p_amount    numeric,
  p_paid_on   date default current_date,
  p_period_on date default null
) returns public.debt_payments
language plpgsql security invoker set search_path = '' as $$
declare
  d       public.debts;
  pending numeric;
  txid    uuid;
  pay     public.debt_payments;
begin
  select * into d from public.debts where id = p_debt_id;
  if not found then
    raise exception 'Deuda no encontrada' using errcode = 'P0002';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El abono debe ser mayor que cero' using errcode = '22023';
  end if;

  select d.opening_balance - coalesce(sum(amount), 0) into pending
  from public.debt_payments where debt_id = d.id;
  if p_amount > pending then
    raise exception 'El abono supera el saldo pendiente' using errcode = '22023';
  end if;

  if p_period_on is not null then
    if d.installment_day is null
       or not public.is_pay_date(array[d.installment_day], p_period_on) then
      raise exception 'Esa fecha no es una cuota de esta deuda' using errcode = '22023';
    end if;
    if exists (select 1 from public.debt_payments where debt_id = d.id and period_on = p_period_on) then
      raise exception 'Esta cuota ya está pagada' using errcode = '23505';
    end if;
  end if;

  insert into public.transactions (household_id, visibility, kind, amount, category_id, occurred_on, description)
  values (
    d.household_id,
    d.visibility,
    'expense',
    p_amount,
    coalesce(d.category_id, (
      select id from public.finance_categories
      where household_id is null and kind = 'expense' and name = 'Deudas'
    )),
    coalesce(p_paid_on, current_date),
    'Abono · ' || d.name
  )
  returning id into txid;

  insert into public.debt_payments (debt_id, amount, paid_on, period_on, transaction_id)
  values (d.id, p_amount, coalesce(p_paid_on, current_date), p_period_on, txid)
  returning * into pay;

  return pay;
end $$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.fixed_expenses         enable row level security;
alter table public.fixed_expense_payments enable row level security;
alter table public.debts                  enable row level security;
alter table public.debt_payments          enable row level security;

-- Patrón de dominio: leer/editar lo compartido del hogar + lo personal propio;
-- crear a mi nombre en mi hogar; borrar solo el autor (lo demás se archiva).
do $$
declare
  t text;
begin
  foreach t in array array['fixed_expenses', 'debts'] loop
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

-- Pagos: visibles si su padre es visible; cualquiera que lo vea puede pagar,
-- firmando como sí mismo. No hay UPDATE ni DELETE directos: deshacer un pago
-- es borrar su movimiento en Dinero (la cascada borra el pago).
create policy fixed_expense_payments_select on public.fixed_expense_payments for select to authenticated
  using (exists (select 1 from public.fixed_expenses f where f.id = fixed_expense_id));
create policy fixed_expense_payments_insert on public.fixed_expense_payments for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.fixed_expenses f where f.id = fixed_expense_id and f.archived_at is null)
  );

create policy debt_payments_select on public.debt_payments for select to authenticated
  using (exists (select 1 from public.debts d where d.id = debt_id));
create policy debt_payments_insert on public.debt_payments for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.debts d where d.id = debt_id and d.archived_at is null)
  );

-- =====================================================================
-- Realtime (respeta RLS)
-- =====================================================================
alter publication supabase_realtime add table
  public.fixed_expenses,
  public.fixed_expense_payments,
  public.debts,
  public.debt_payments;

-- =====================================================================
-- Permisos de las funciones
-- =====================================================================
revoke execute on function
  public.pay_fixed_expense(uuid, date, numeric, date),
  public.pay_debt(uuid, numeric, date, date),
  public.is_pay_date(smallint[], date)
from anon, public;
grant execute on function
  public.pay_fixed_expense(uuid, date, numeric, date),
  public.pay_debt(uuid, numeric, date, date),
  public.is_pay_date(smallint[], date)
to authenticated;
