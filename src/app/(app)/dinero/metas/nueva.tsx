import { router, useLocalSearchParams } from 'expo-router';

import { financeErrorMessage } from '@/features/finance/api';
import { GoalForm } from '@/features/finance/components/GoalForm';
import { useSaveGoal } from '@/features/finance/hooks';
import type { Scope } from '@/features/finance/types';
import { useCurrentHousehold } from '@/features/household/hooks';

export default function NewGoalScreen() {
  const { scope } = useLocalSearchParams<{ scope?: Scope }>();
  const { household } = useCurrentHousehold();
  const save = useSaveGoal(household.id);

  return (
    <GoalForm
      defaultScope={scope}
      submitLabel="Crear meta"
      submitting={save.isPending}
      error={save.isError ? financeErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ input }, { onSuccess: () => router.back() })}
    />
  );
}
