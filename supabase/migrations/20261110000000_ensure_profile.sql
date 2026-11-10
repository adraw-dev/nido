-- =====================================================================
-- Nido · Perfil garantizado
-- Cuentas creadas antes de aplicar la migración MVP quedaron sin fila en
-- profiles (el trigger on_auth_user_created no existía), y crear o unirse
-- a un hogar fallaba por la llave foránea hacia profiles.
-- =====================================================================

-- 1. Crea los perfiles que falten para cuentas ya existentes.
insert into public.profiles (id, display_name)
select
  u.id,
  left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1), 'Integrante'), 40)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 2. Garantiza el perfil del usuario actual antes de operar con hogares.
create or replace function public.ensure_profile()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  insert into public.profiles (id, display_name)
  select
    u.id,
    left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1), 'Integrante'), 40)
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;

  -- La sesión puede pertenecer a una cuenta borrada: su token sigue siendo válido un rato.
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Cuenta no encontrada' using errcode = 'P0001';
  end if;
end $$;

revoke execute on function public.ensure_profile() from anon;

create or replace function public.create_household(p_name text)
returns public.households language plpgsql security definer set search_path = '' as $$
declare
  h public.households;
begin
  perform public.ensure_profile();
  insert into public.households (name, created_by) values (p_name, auth.uid()) returning * into h;
  insert into public.household_members (household_id, user_id, role) values (h.id, auth.uid(), 'owner');
  return h;
end $$;

create or replace function public.join_household(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inv public.household_invites;
begin
  perform public.ensure_profile();
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
