import { router, useLocalSearchParams } from 'expo-router';

import { financeErrorMessage } from '@/features/finance/api';
import { TransactionForm } from '@/features/finance/components/TransactionForm';
import { useSaveTransaction } from '@/features/finance/hooks';
import type { Scope, TxKind } from '@/features/finance/types';
import { useCurrentHousehold } from '@/features/household/hooks';

export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{ kind?: TxKind; scope?: Scope; goal?: string; retiro?: string }>();
  const { household } = useCurrentHousehold();
  const save = useSaveTransaction(household.id);

  return (
    <TransactionForm
      householdId={household.id}
      defaults={{ kind: params.kind, scope: params.scope, goalId: params.goal ?? null, withdraw: params.retiro === '1' }}
      submitting={save.isPending}
      error={save.isError ? financeErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ input }, { onSuccess: () => router.back() })}
    />
  );
}
