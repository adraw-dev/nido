import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { vehicleErrorMessage } from '@/features/vehicles/api';
import { RecordForm } from '@/features/vehicles/components/RecordForm';
import { useDeleteRecord, useRecords, useSaveRecord, useVehicles } from '@/features/vehicles/hooks';
import { Button, Screen, Text } from '@/ui';

export default function EditRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { nameOf } = useLineLookup(household.id);
  const vehicles = useVehicles(household.id);
  const records = useRecords(household.id);
  const save = useSaveRecord(household.id);
  const remove = useDeleteRecord(household.id);
  const record = records.data?.find((r) => r.id === id);

  if (!record || !vehicles.data) {
    return (
      <Screen edges={['bottom']}>
        <Text tone="muted">{records.isPending || vehicles.isPending ? 'Cargando…' : 'Este registro ya no existe.'}</Text>
      </Screen>
    );
  }

  const mine = record.created_by === userId;
  const ownsTx = record.transaction?.owner_id === userId;

  function confirmDelete() {
    Alert.alert(
      '¿Borrar el registro?',
      ownsTx
        ? 'También se borra su gasto en Dinero. No se puede deshacer.'
        : record!.transaction
          ? 'El gasto en Dinero lo registró otra persona y se conserva.'
          : 'No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () =>
            remove.mutate(record!, {
              onSuccess: () => router.back(),
              onError: (e) => Alert.alert('No se pudo borrar', vehicleErrorMessage(e)),
            }),
        },
      ],
    );
  }

  return (
    <RecordForm
      vehicles={vehicles.data}
      initial={record}
      submitting={save.isPending}
      error={save.isError ? vehicleErrorMessage(save.error) : null}
      onSubmit={(input, v) => save.mutate({ record, input, nickname: v.nickname }, { onSuccess: () => router.back() })}
      footerExtra={
        mine ? (
          <Button label="Borrar" variant="text" onPress={confirmDelete} loading={remove.isPending} />
        ) : (
          <Text variant="caption" tone="subtle">
            Lo registró {nameOf(record.created_by)}; solo esa persona puede borrarlo.
          </Text>
        )
      }
    />
  );
}
