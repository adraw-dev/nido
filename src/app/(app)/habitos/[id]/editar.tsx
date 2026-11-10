import { router, useLocalSearchParams } from 'expo-router';

import { habitErrorMessage } from '@/features/habits/api';
import { HabitForm } from '@/features/habits/components/HabitForm';
import { useHabits, useSaveHabit } from '@/features/habits/hooks';
import { useCurrentHousehold } from '@/features/household/hooks';
import { Screen, Text } from '@/ui';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useCurrentHousehold();
  const habits = useHabits(household.id);
  const save = useSaveHabit(household.id);
  const habit = habits.data?.find((h) => h.id === id);

  if (!habit) {
    return (
      <Screen edges={['bottom']}>
        <Text tone="muted">{habits.isPending ? 'Cargando…' : 'Este hábito ya no existe.'}</Text>
      </Screen>
    );
  }

  return (
    <HabitForm
      initial={habit}
      submitLabel="Guardar cambios"
      submitting={save.isPending}
      error={save.isError ? habitErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ id, input }, { onSuccess: () => router.back() })}
    />
  );
}
