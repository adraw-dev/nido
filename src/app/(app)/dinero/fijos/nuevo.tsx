import { router, useLocalSearchParams } from 'expo-router';

import { financeErrorMessage } from '@/features/finance/api';
import { FixedExpenseForm } from '@/features/finance/components/FixedExpenseForm';
import { useSaveFixedExpense } from '@/features/finance/hooks';
import type { Scope } from '@/features/finance/types';
import { useCurrentHousehold } from '@/features/household/hooks';

export default function NewFixedExpenseScreen() {
  const { scope } = useLocalSearchParams<{ scope?: Scope }>();
  const { household } = useCurrentHousehold();
  const save = useSaveFixedExpense(household.id);

  return (
    <FixedExpenseForm
      householdId={household.id}
      defaultScope={scope}
      submitLabel="Crear gasto fijo"
      submitting={save.isPending}
      error={save.isError ? financeErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ input }, { onSuccess: () => router.back() })}
    />
  );
}
