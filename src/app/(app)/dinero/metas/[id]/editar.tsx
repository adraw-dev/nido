import { router, useLocalSearchParams } from 'expo-router';

import { financeErrorMessage } from '@/features/finance/api';
import { GoalForm } from '@/features/finance/components/GoalForm';
import { useGoals, useSaveGoal } from '@/features/finance/hooks';
import { useCurrentHousehold } from '@/features/household/hooks';
import { Screen, Text } from '@/ui';

export default function EditGoalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useCurrentHousehold();
  const goals = useGoals(household.id);
  const save = useSaveGoal(household.id);
  const goal = goals.progress.find((g) => g.goal.id === id)?.goal;

  if (!goal) {
    return (
      <Screen edges={['bottom']}>
        <Text tone="muted">{goals.isPending ? 'Cargando…' : 'Esta meta ya no existe.'}</Text>
      </Screen>
    );
  }

  return (
    <GoalForm
      initial={goal}
      submitLabel="Guardar cambios"
      submitting={save.isPending}
      error={save.isError ? financeErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ id, input }, { onSuccess: () => router.back() })}
    />
  );
}
