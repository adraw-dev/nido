import { router } from 'expo-router';

import { habitErrorMessage } from '@/features/habits/api';
import { HabitForm } from '@/features/habits/components/HabitForm';
import { useSaveHabit } from '@/features/habits/hooks';
import { useCurrentHousehold } from '@/features/household/hooks';

export default function NewHabitScreen() {
  const { household } = useCurrentHousehold();
  const save = useSaveHabit(household.id);

  return (
    <HabitForm
      submitLabel="Crear hábito"
      submitting={save.isPending}
      error={save.isError ? habitErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ input }, { onSuccess: () => router.back() })}
    />
  );
}
