import { router, useLocalSearchParams } from 'expo-router';

import { financeErrorMessage } from '@/features/finance/api';
import { DebtForm } from '@/features/finance/components/DebtForm';
import { useSaveDebt } from '@/features/finance/hooks';
import type { Scope } from '@/features/finance/types';
import { useCurrentHousehold } from '@/features/household/hooks';

export default function NewDebtScreen() {
  const { scope } = useLocalSearchParams<{ scope?: Scope }>();
  const { household } = useCurrentHousehold();
  const save = useSaveDebt(household.id);

  return (
    <DebtForm
      defaultScope={scope}
      submitLabel="Crear deuda"
      submitting={save.isPending}
      error={save.isError ? financeErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ input }, { onSuccess: () => router.back() })}
    />
  );
}
