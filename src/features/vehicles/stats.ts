/** Totales y línea de kilometraje de un vehículo, calculados desde su historial. */
import type { DateKey } from '@/lib/dates';

import { OIL_INTERVAL_KM, type RecordType, type Vehicle, type VehicleRecord } from './types';

/** Valor visible de un registro (0 si no tiene costo o si es privado de otra persona). */
export const visibleAmount = (r: VehicleRecord) => r.transaction?.amount ?? 0;

export function totalSpent(records: VehicleRecord[], from?: DateKey): number {
  return records.filter((r) => !from || r.performed_on >= from).reduce((s, r) => s + visibleAmount(r), 0);
}

export function spentByType(records: VehicleRecord[], from?: DateKey): { type: RecordType; total: number; count: number }[] {
  const map = new Map<RecordType, { total: number; count: number }>();
  for (const r of records) {
    if (from && r.performed_on < from) continue;
    const cur = map.get(r.type) ?? { total: 0, count: 0 };
    map.set(r.type, { total: cur.total + visibleAmount(r), count: cur.count + 1 });
  }
  return [...map.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.total - a.total || b.count - a.count);
}

export type KmStation = { km: number; label: string; kind: 'done' | 'current' | 'next' };

/**
 * Línea de kilometraje: los últimos registros con km (estaciones hechas), el
 * kilometraje actual y, como siguiente estación, el próximo cambio de aceite
 * estimado (último aceite + intervalo del tipo de vehículo).
 */
export function kmLine(vehicle: Vehicle, records: VehicleRecord[], typeLabel: (t: RecordType) => string) {
  const withKm = records
    .filter((r) => r.odometer_km !== null && r.odometer_km <= vehicle.odometer_km)
    .sort((a, b) => a.odometer_km! - b.odometer_km!);
  const recent = withKm.slice(-3);
  const lastOil = [...withKm].reverse().find((r) => r.type === 'aceite');
  const nextOilKm = lastOil ? lastOil.odometer_km! + OIL_INTERVAL_KM[vehicle.kind] : null;

  const stations: KmStation[] = recent.map((r) => ({ km: r.odometer_km!, label: typeLabel(r.type), kind: 'done' }));
  stations.push({ km: vehicle.odometer_km, label: 'Hoy', kind: 'current' });
  if (nextOilKm !== null) stations.push({ km: nextOilKm, label: 'Aceite', kind: 'next' });

  return {
    stations,
    nextOilKm,
    kmToOil: nextOilKm !== null ? nextOilKm - vehicle.odometer_km : null,
  };
}

/** "12.345 km" */
export function formatKm(km: number): string {
  return `${Math.round(km).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} km`;
}
