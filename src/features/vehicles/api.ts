import { supabase } from '@/lib/supabase';

import type { RecordInput, Vehicle, VehicleInput, VehicleRecord } from './types';

const PAGE = 1000;

export async function fetchVehicles(householdId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('household_id', householdId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Vehicle[];
}

/** Historial con su movimiento vinculado (la RLS oculta el valor si es personal de otra persona). */
export async function fetchRecords(householdId: string): Promise<VehicleRecord[]> {
  const all: VehicleRecord[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from('vehicle_records')
      .select('*, transaction:transactions(id, amount, visibility, owner_id)')
      .eq('household_id', householdId)
      .order('performed_on', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as VehicleRecord[];
    all.push(...rows.map((r) => ({ ...r, transaction: r.transaction ? { ...r.transaction, amount: Number(r.transaction.amount) } : null })));
    if (rows.length < PAGE) break;
  }
  return all;
}

export async function createVehicle(householdId: string, input: VehicleInput): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({ household_id: householdId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as Vehicle;
}

export async function updateVehicle(id: string, input: Partial<VehicleInput>): Promise<Vehicle> {
  const { data, error } = await supabase.from('vehicles').update(input).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Vehicle;
}

export async function archiveVehicle(id: string) {
  const { error } = await supabase.from('vehicles').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteVehicle(id: string) {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
}

/** Registro + gasto en una sola operación (RPC create_vehicle_expense). */
export async function createRecord(input: RecordInput): Promise<void> {
  const { error } = await supabase.rpc('create_vehicle_expense', {
    p_vehicle_id: input.vehicleId,
    p_type: input.type,
    p_title: input.title,
    p_amount: input.amount && input.amount > 0 ? input.amount : null,
    p_performed_on: input.performedOn,
    p_odometer_km: input.odometerKm,
    p_notes: input.notes,
    p_visibility: input.visibility,
  });
  if (error) throw error;
}

async function vehicleCategoryId(): Promise<string | null> {
  const { data } = await supabase
    .from('finance_categories')
    .select('id')
    .is('household_id', null)
    .eq('kind', 'expense')
    .eq('name', 'Vehículos')
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Editar un registro y, según el valor, crear, actualizar o quitar su gasto.
 * No es atómico como la RPC de creación, pero cada paso respeta la RLS.
 */
export async function updateRecord(record: VehicleRecord, input: RecordInput, userId: string, nickname: string) {
  const { error } = await supabase
    .from('vehicle_records')
    .update({
      type: input.type,
      title: input.title,
      performed_on: input.performedOn,
      odometer_km: input.odometerKm,
      notes: input.notes,
    })
    .eq('id', record.id);
  if (error) throw error;

  const amount = input.amount && input.amount > 0 ? input.amount : null;
  const tx = record.transaction;
  const description = `${input.title} · ${nickname}`;

  if (tx) {
    if (amount) {
      const patch: Record<string, unknown> = { amount, occurred_on: input.performedOn, description };
      if (tx.owner_id === userId) patch.visibility = input.visibility;
      const { error: e } = await supabase.from('transactions').update(patch).eq('id', tx.id);
      if (e) throw e;
    } else if (tx.owner_id === userId) {
      const { error: e } = await supabase.from('transactions').delete().eq('id', tx.id);
      if (e) throw e;
    }
  } else if (!record.transaction_id && amount) {
    const { data, error: e } = await supabase
      .from('transactions')
      .insert({
        household_id: record.household_id,
        kind: 'expense',
        amount,
        category_id: await vehicleCategoryId(),
        occurred_on: input.performedOn,
        description,
        visibility: input.visibility,
      })
      .select('id')
      .single();
    if (e) throw e;
    const { error: e2 } = await supabase
      .from('vehicle_records')
      .update({ transaction_id: (data as { id: string }).id })
      .eq('id', record.id);
    if (e2) throw e2;
  }
}

/** Borra el registro y, si el gasto es mío, también el movimiento en Dinero. */
export async function deleteRecord(record: VehicleRecord, userId: string) {
  const { error } = await supabase.from('vehicle_records').delete().eq('id', record.id);
  if (error) throw error;
  if (record.transaction && record.transaction.owner_id === userId) {
    const { error: e } = await supabase.from('transactions').delete().eq('id', record.transaction.id);
    if (e) throw e;
  }
}

export async function setOdometer(vehicleId: string, km: number) {
  const { error } = await supabase.from('vehicles').update({ odometer_km: km }).eq('id', vehicleId);
  if (error) throw error;
}

export function vehicleErrorMessage(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message.includes('vehicles_household_id_plate_key') || message.includes('duplicate key'))
    return 'Ya hay un vehículo con esa placa en el hogar.';
  if (message.includes('year')) return 'Revisa el año: entre 1950 y 2100.';
  if (message.includes('row-level security')) return 'No tienes permiso para cambiar esto.';
  if (message.includes('Vehículo no encontrado')) return 'Ese vehículo ya no existe.';
  if (message.toLowerCase().includes('fetch')) return 'Sin conexión con el servidor. Revisa tu internet.';
  return message || 'Algo salió mal. Intenta de nuevo.';
}

