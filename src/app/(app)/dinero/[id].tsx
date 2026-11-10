import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { financeErrorMessage } from '@/features/finance/api';
import { TransactionForm } from '@/features/finance/components/TransactionForm';
import { useDeleteTransaction, useSaveTransaction } from '@/features/finance/hooks';
import type { Transaction } from '@/features/finance/types';
import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { supabase } from '@/lib/supabase';
import { Button, Screen, Text } from '@/ui';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { nameOf } = useLineLookup(household.id);
  const save = useSaveTransaction(household.id);
  const remove = useDeleteTransaction(household.id);

  const tx = useQuery({
    queryKey: ['finance', household.id, 'one', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as Transaction | null;
    },
  });

  if (!tx.data) {
    return (
      <Screen edges={['bottom']}>
        <Text tone="muted">{tx.isPending ? 'Cargando…' : 'Este movimiento ya no existe.'}</Text>
      </Screen>
    );
  }

  const mine = tx.data.owner_id === userId;

  function confirmDelete() {
    Alert.alert('¿Borrar el movimiento?', 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          remove.mutate(id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('No se pudo borrar', financeErrorMessage(e)),
          }),
      },
    ]);
  }

  return (
    <TransactionForm
      householdId={household.id}
      initial={tx.data}
      submitting={save.isPending}
      error={save.isError ? financeErrorMessage(save.error) : null}
      onSubmit={(input) => save.mutate({ id, input }, { onSuccess: () => router.back() })}
      footerExtra={
        mine ? (
          <Button label="Borrar" variant="text" onPress={confirmDelete} loading={remove.isPending} />
        ) : (
          <Text variant="caption" tone="subtle">
            Lo registró {nameOf(tx.data.owner_id)}; solo esa persona puede borrarlo.
          </Text>
        )
      }
    />
  );
}
