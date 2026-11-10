import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSession } from '@/features/session/SessionProvider';
import { supabase } from '@/lib/supabase';

import {
  archiveVehicle,
  createRecord,
  createVehicle,
  deleteRecord,
  deleteVehicle,
  fetchRecords,
  fetchVehicles,
  setOdometer,
  updateRecord,
  updateVehicle,
} from './api';
import type { RecordInput, VehicleInput, VehicleRecord } from './types';

export const vehicleKeys = {
  all: (hh: string) => ['vehicles', hh] as const,
  list: (hh: string) => ['vehicles', hh, 'list'] as const,
  records: (hh: string) => ['vehicles', hh, 'records'] as const,
};

export function useVehicles(householdId: string) {
  return useQuery({ queryKey: vehicleKeys.list(householdId), queryFn: () => fetchVehicles(householdId) });
}

export function useRecords(householdId: string) {
  return useQuery({ queryKey: vehicleKeys.records(householdId), queryFn: () => fetchRecords(householdId) });
}

/** Cambios en vehículos tocan también Dinero (los gastos viven en transactions). */
function useInvalidate(householdId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: vehicleKeys.all(householdId) }),
      qc.invalidateQueries({ queryKey: ['finance', householdId] }),
    ]);
}

export function useSaveVehicle(householdId: string) {
  const invalidate = useInvalidate(householdId);
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: VehicleInput }) =>
      id ? updateVehicle(id, input) : createVehicle(householdId, input),
    onSuccess: invalidate,
  });
}

export function useArchiveVehicle(householdId: string) {
  const invalidate = useInvalidate(householdId);
  return useMutation({ mutationFn: archiveVehicle, onSuccess: invalidate });
}

export function useDeleteVehicle(householdId: string) {
  const invalidate = useInvalidate(householdId);
  return useMutation({ mutationFn: deleteVehicle, onSuccess: invalidate });
}

export function useSetOdometer(householdId: string) {
  const invalidate = useInvalidate(householdId);
  return useMutation({
    mutationFn: ({ vehicleId, km }: { vehicleId: string; km: number }) => setOdometer(vehicleId, km),
    onSuccess: invalidate,
  });
}

export function useSaveRecord(householdId: string) {
  const invalidate = useInvalidate(householdId);
  const { session } = useSession();
  return useMutation({
    mutationFn: ({ record, input, nickname }: { record?: VehicleRecord; input: RecordInput; nickname: string }) =>
      record ? updateRecord(record, input, session!.user.id, nickname) : createRecord(input),
    onSuccess: invalidate,
  });
}

export function useDeleteRecord(householdId: string) {
  const invalidate = useInvalidate(householdId);
  const { session } = useSession();
  return useMutation({
    mutationFn: (record: VehicleRecord) => deleteRecord(record, session!.user.id),
    onSuccess: invalidate,
  });
}

/** Lo que registra la pareja en el garaje aparece en segundos. */
export function useVehicleRealtime(householdId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!householdId) return;
    const refresh = () => qc.invalidateQueries({ queryKey: vehicleKeys.all(householdId) });
    const filter = `household_id=eq.${householdId}`;
    const channel = supabase
      .channel(`garaje:${householdId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vehicle_records', filter }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicle_records', filter }, refresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'vehicle_records' }, refresh)
      // El valor de un registro vive en transactions.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions', filter }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, qc]);
}
