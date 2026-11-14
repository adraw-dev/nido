import { router, useLocalSearchParams } from 'expo-router';

import { financeErrorMessage } from '@/features/finance/api';
import { DebtForm } from '@/features/finance/components/DebtForm';
import { useDebts, useSaveDebt } from '@/features/finance/hooks';
import { useCurrentHousehold } from '@/features/household/hooks';
import { useToday } from '@/lib/useToday';
import { Screen, Text } from '@/ui';

export default function EditDebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useToday();
  const { household } = useCurrentHousehold();
  const debts = useDebts(household.id, today);
  const save = useSaveDebt(household.id);
  const state = debts.states.find((s) => s.debt.id === id);

  if (!state) {
    return (
      <Screen edges={['bottom']}>
        <Text tone="muted">{debts.isPending ? 'Cargando…' : 'Esta deuda ya no existe.'}</Text>
      </Screen>
    );
  }

  return (
    <DebtForm
      initial={state.debt}
      current={{ pending: state.pending, paidInNido: state.paidInNido }}
      submitLabel="Guardar cambios"
      submitting={save.isPending}
      error={save.isError ? financeErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ id, input }, { onSuccess: () => router.back() })}
    />
  );
}
