import { router, useLocalSearchParams } from 'expo-router';

import { financeErrorMessage } from '@/features/finance/api';
import { FixedExpenseForm } from '@/features/finance/components/FixedExpenseForm';
import { useFixedExpenses, useSaveFixedExpense } from '@/features/finance/hooks';
import { useCurrentHousehold } from '@/features/household/hooks';
import { Screen, Text } from '@/ui';

export default function EditFixedExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household } = useCurrentHousehold();
  const fixed = useFixedExpenses(household.id);
  const save = useSaveFixedExpense(household.id);
  const item = fixed.list.find((f) => f.id === id);

  if (!item) {
    return (
      <Screen edges={['bottom']}>
        <Text tone="muted">{fixed.isPending ? 'Cargando…' : 'Este gasto fijo ya no existe.'}</Text>
      </Screen>
    );
  }

  return (
    <FixedExpenseForm
      householdId={household.id}
      initial={item}
      submitLabel="Guardar cambios"
      submitting={save.isPending}
      error={save.isError ? financeErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ id, input }, { onSuccess: () => router.back() })}
    />
  );
}
