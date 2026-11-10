-- =====================================================================
-- Nido · Limpiar datos de prueba
-- Borra: tareas (y sus cumplimientos), hábitos (y sus registros), y todo
--        lo de dinero (movimientos y metas de ahorro).
-- Conserva: hogares, integrantes, perfiles, usuarios de Auth, invitaciones,
--           categorías, vehículos y su historial de mantenimientos.
--
-- Se corre a mano en Supabase → SQL Editor. NO es una migración.
-- Todo va en una transacción: si algo falla, no se borra nada.
-- =====================================================================

begin;

-- Antes: cuántos registros hay.
select 'antes' as momento,
  (select count(*) from public.tasks)            as tareas,
  (select count(*) from public.task_completions) as cumplimientos,
  (select count(*) from public.habits)           as habitos,
  (select count(*) from public.habit_logs)       as registros_habitos,
  (select count(*) from public.transactions)     as movimientos,
  (select count(*) from public.savings_goals)    as metas,
  (select count(*) from public.vehicles)         as vehiculos,
  (select count(*) from public.vehicle_records)  as mantenimientos;

-- Tareas: task_completions se borra en cascada.
delete from public.tasks;

-- Hábitos: habit_logs se borra en cascada.
delete from public.habits;

-- Dinero. Los mantenimientos de vehículos que tenían valor se conservan
-- (fecha, km, concepto), pero quedan "Sin valor": transaction_id pasa a null.
delete from public.transactions;
delete from public.savings_goals;

-- Después: tareas, hábitos y dinero en 0; vehículos y mantenimientos igual que antes.
select 'despues' as momento,
  (select count(*) from public.tasks)            as tareas,
  (select count(*) from public.task_completions) as cumplimientos,
  (select count(*) from public.habits)           as habitos,
  (select count(*) from public.habit_logs)       as registros_habitos,
  (select count(*) from public.transactions)     as movimientos,
  (select count(*) from public.savings_goals)    as metas,
  (select count(*) from public.vehicles)         as vehiculos,
  (select count(*) from public.vehicle_records)  as mantenimientos;

commit;

-- ---------------------------------------------------------------------
-- OPCIONAL (descomentar si también quieren vaciar el historial de los
-- vehículos, sin borrar los vehículos):
-- delete from public.vehicle_records;
-- ---------------------------------------------------------------------
