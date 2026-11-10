import { router } from 'expo-router';

import { useCurrentHousehold } from '@/features/household/hooks';
import { vehicleErrorMessage } from '@/features/vehicles/api';
import { VehicleForm } from '@/features/vehicles/components/VehicleForm';
import { useSaveVehicle } from '@/features/vehicles/hooks';

export default function NewVehicleScreen() {
  const { household } = useCurrentHousehold();
  const save = useSaveVehicle(household.id);
  return (
    <VehicleForm
      submitLabel="Agregar vehículo"
      submitting={save.isPending}
      error={save.isError ? vehicleErrorMessage(save.error) : null}
      onSubmit={(input) =>
        save.mutate(
          { input },
          { onSuccess: (v) => router.replace({ pathname: '/garaje/[id]', params: { id: v.id } }) },
        )
      }
    />
  );
}
