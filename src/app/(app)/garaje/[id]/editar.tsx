import { router, useLocalSearchParams } from 'expo-router';

import { useCurrentHousehold } from '@/features/household/hooks';
import { vehicleErrorMessage } from '@/features/vehicles/api';
import { VehicleForm } from '@/features/vehicles/components/VehicleForm';
import { useSaveVehicle, useVehicles } from '@/features/vehicles/hooks';
import { Screen, Text } from '@/ui';

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useCurrentHousehold();
  const vehicles = useVehicles(household.id);
  const save = useSaveVehicle(household.id);
  const vehicle = vehicles.data?.find((v) => v.id === id);

  if (!vehicle) {
    return (
      <Screen edges={['bottom']}>
        <Text tone="muted">{vehicles.isPending ? 'Cargando…' : 'Este vehículo ya no existe.'}</Text>
      </Screen>
    );
  }

  return (
    <VehicleForm
      initial={vehicle}
      submitLabel="Guardar cambios"
      submitting={save.isPending}
      error={save.isError ? vehicleErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ id, input }, { onSuccess: () => router.back() })}
    />
  );
}
