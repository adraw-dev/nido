import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { DateKey } from '@/lib/dates';

export type VehicleKind = 'moto' | 'carro';

export type RecordType =
  | 'aceite'
  | 'llantas'
  | 'frenos'
  | 'bateria'
  | 'repuestos'
  | 'combustible'
  | 'soat'
  | 'tecnomecanica'
  | 'preventivo'
  | 'correctivo'
  | 'lavado'
  | 'otro';

export type Vehicle = {
  id: string;
  household_id: string;
  owner_id: string;
  visibility: 'personal' | 'shared';
  nickname: string;
  kind: VehicleKind;
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  odometer_km: number;
  acquired_on: DateKey | null;
  archived_at: string | null;
  created_at: string;
};

export type VehicleInput = {
  nickname: string;
  kind: VehicleKind;
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  odometer_km: number;
  visibility: 'personal' | 'shared';
};

/** Movimiento vinculado. null si no tiene costo o si es personal de otra persona (la RLS lo oculta). */
export type LinkedTx = { id: string; amount: number; visibility: 'personal' | 'shared'; owner_id: string };

export type VehicleRecord = {
  id: string;
  vehicle_id: string;
  household_id: string;
  transaction_id: string | null;
  type: RecordType;
  title: string;
  odometer_km: number | null;
  performed_on: DateKey;
  notes: string | null;
  created_by: string;
  created_at: string;
  transaction: LinkedTx | null;
};

export type RecordInput = {
  vehicleId: string;
  type: RecordType;
  title: string;
  amount: number | null;
  performedOn: DateKey;
  odometerKm: number | null;
  notes: string | null;
  visibility: 'personal' | 'shared';
};

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const RECORD_TYPES: { type: RecordType; label: string; icon: IconName }[] = [
  { type: 'combustible', label: 'Combustible', icon: 'gas-station' },
  { type: 'aceite', label: 'Aceite', icon: 'oil' },
  { type: 'llantas', label: 'Llantas', icon: 'tire' },
  { type: 'frenos', label: 'Frenos', icon: 'car-brake-alert' },
  { type: 'bateria', label: 'Batería', icon: 'car-battery' },
  { type: 'repuestos', label: 'Repuestos', icon: 'cog' },
  { type: 'preventivo', label: 'Preventivo', icon: 'wrench-clock' },
  { type: 'correctivo', label: 'Correctivo', icon: 'wrench' },
  { type: 'soat', label: 'SOAT', icon: 'shield-car' },
  { type: 'tecnomecanica', label: 'Tecnomecánica', icon: 'clipboard-check-outline' },
  { type: 'lavado', label: 'Lavado', icon: 'car-wash' },
  { type: 'otro', label: 'Otro', icon: 'dots-horizontal' },
];

export const RECORD_META = Object.fromEntries(RECORD_TYPES.map((r) => [r.type, r])) as Record<
  RecordType,
  (typeof RECORD_TYPES)[number]
>;

export const KIND_ICON: Record<VehicleKind, IconName> = { moto: 'motorbike', carro: 'car-side' };

/**
 * Intervalo de cambio de aceite para estimar la siguiente estación de la
 * línea de kilometraje. La fase 8 lo vuelve configurable por vehículo.
 */
export const OIL_INTERVAL_KM: Record<VehicleKind, number> = { moto: 3000, carro: 5000 };
