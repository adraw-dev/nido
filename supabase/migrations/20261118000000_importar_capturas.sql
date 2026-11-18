-- =====================================================================
-- Nido · Importar movimientos desde capturas del banco
--
-- source: de dónde salió el movimiento (escrito a mano o leído de una captura).
-- import_key: huella del movimiento leído (fecha|tipo|valor|descripción#n).
-- Es única por hogar y persona, así que importar dos capturas que se
-- solapan no duplica nada: el insert usa ON CONFLICT DO NOTHING.
-- Los movimientos manuales llevan import_key null (los null no chocan).
-- =====================================================================

alter table public.transactions
  add column if not exists source text not null default 'manual',
  add column if not exists import_key text;

alter table public.transactions
  add constraint transactions_source_check check (source in ('manual', 'captura')),
  add constraint transactions_import_key_len check (import_key is null or char_length(import_key) between 1 and 200),
  add constraint transactions_import_key_unique unique (household_id, owner_id, import_key);
