import { router, useLocalSearchParams } from 'expo-router';

import { useCurrentHousehold } from '@/features/household/hooks';
import { vehicleErrorMessage } from '@/features/vehicles/api';
import { RecordForm } from '@/features/vehicles/components/RecordForm';
import { useSaveRecord, useVehicles } from '@/features/vehicles/hooks';
import { Screen, Text } from '@/ui';

export default function NewRecordScreen() {
  const { vehicle } = useLocalSearchParams<{ vehicle?: string }>();
  const { household } = useCurrentHousehold();
  const vehicles = useVehicles(household.id);
  const save = useSaveRecord(household.id);

  if (!vehicles.data?.length) {
    return (
      <Screen edges={['bottom']}>
        <Text tone="muted">{vehicles.isPending ? 'Cargando…' : 'Primero agrega un vehículo.'}</Text>
      </Screen>
    );
  }

  return (
    <RecordForm
      vehicles={vehicles.data}
      defaultVehicleId={vehicle}
      submitting={save.isPending}
      error={save.isError ? vehicleErrorMessage(save.error) : null}
      onSubmit={(input, v) => save.mutate({ input, nickname: v.nickname }, { onSuccess: () => router.back() })}
    />
  );
}
