import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { financeErrorMessage } from '@/features/finance/api';
import { fixedPeriods, type FixedPeriod } from '@/features/finance/bills';
import { FixedPeriodRow, PaymentsLine } from '@/features/finance/components/Bills';
import { useArchiveFixedExpense, useCategories, useDeleteFixedExpense, useFixedExpenses } from '@/features/finance/hooks';
import { frequencyLabel, nextPayDate, payDaysLabel } from '@/features/finance/schedule';
import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { addDaysKey, fromKey, relativeDay, toKey } from '@/lib/dates';
import { formatCOP } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { Button, Screen, Text, space, touchTarget, useTheme } from '@/ui';

export default function FixedExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const today = useToday();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { colorOf, nameOf } = useLineLookup(household.id);
  const fixed = useFixedExpenses(household.id);
  const categories = useCategories(household.id);
  const archive = useArchiveFixedExpense(household.id);
  const remove = useDeleteFixedExpense(household.id);
  const item = fixed.list.find((f) => f.id === id);

  // Último año de períodos y el próximo por venir, del más reciente al más antiguo.
  const periods = useMemo<FixedPeriod[]>(() => {
    if (!item) return [];
    const until = nextPayDate(item.pay_days, addDaysKey(today, 1)) ?? today;
    const from = toKey(addMonths(fromKey(today), -12));
    return fixedPeriods(item, fixed.payments, from, until, today).reverse();
  }, [item, fixed.payments, today]);

  if (!item) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: '' }} />
        <Text tone="muted">{fixed.isPending ? 'Cargando…' : 'Este gasto fijo ya no existe o fue archivado.'}</Text>
      </Screen>
    );
  }

  const color = item.visibility === 'shared' ? colors.trunk : colorOf(item.owner_id);
  const mine = item.owner_id === userId;
  const category = item.category_id ? categories.byId.get(item.category_id) : undefined;
  const due = [...periods].reverse().find((p) => p.status !== 'paid');
  const recent = periods.slice(0, 7).reverse();

  const pay = (p: FixedPeriod) => router.push({ pathname: '/dinero/pagar', params: { fijo: item.id, periodo: p.period } });
  const openPeriod = (p: FixedPeriod) => {
    if (p.status !== 'paid') return pay(p);
    if (p.payment?.transaction) router.push({ pathname: '/dinero/[id]', params: { id: p.payment.transaction.id } });
  };

  function confirmArchive() {
    Alert.alert('¿Archivar el gasto fijo?', 'Deja de aparecer en Pagos. Lo pagado sigue en los movimientos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar',
        onPress: () =>
          archive.mutate(item!.id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('No se pudo archivar', financeErrorMessage(e)),
          }),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert('¿Borrar el gasto fijo?', 'Se borra su historial de pagos; los movimientos quedan en Dinero. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          remove.mutate(item!.id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('No se pudo borrar', financeErrorMessage(e)),
          }),
      },
    ]);
  }

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Editar gasto fijo"
              onPress={() => router.push({ pathname: '/dinero/fijos/[id]/editar', params: { id: item.id } })}
              style={styles.headerButton}
            >
              <MaterialCommunityIcons name="pencil-outline" size={24} color={colors.ink} />
            </Pressable>
          ),
        }}
      />

      <View style={styles.head}>
        <Text variant="headline">{item.name}</Text>
        <Text variant="display" style={styles.tabular}>
          {formatCOP(item.amount)}
        </Text>
        <Text tone="muted">
          {[frequencyLabel(item.pay_days), payDaysLabel(item.pay_days), category?.name ?? 'Otros', item.visibility === 'shared' ? 'Del hogar' : 'Solo mío']
            .join(' · ')}
        </Text>
      </View>

      {due ? (
        <Button
          label={`${due.status === 'overdue' ? 'Pagar vencido' : 'Marcar pagado'} · ${relativeDay(due.period, today)}`}
          color={due.status === 'overdue' ? colors.danger : color}
          onPress={() => pay(due)}
        />
      ) : null}

      <PaymentsLine
        color={color}
        stops={recent.map((p) => ({ key: p.period, status: p.status, label: format(fromKey(p.period), 'd MMM', { locale: es }) }))}
        accessibilityLabel={`Últimos pagos: ${recent.filter((p) => p.status === 'paid').length} de ${recent.length} pagados`}
      />

      <Text variant="title" style={styles.sectionTitle}>
        Historial
      </Text>
      {periods.length ? (
        periods.map((p) => (
          <FixedPeriodRow
            key={p.period}
            item={p}
            color={color}
            today={today}
            showName={false}
            payerName={p.payment ? nameOf(p.payment.created_by) : undefined}
            onPress={() => openPeriod(p)}
            onPay={() => pay(p)}
          />
        ))
      ) : (
        <Text tone="muted">Todavía no hay períodos.</Text>
      )}
      <Text variant="caption" tone="subtle">
        Creado por {nameOf(item.owner_id)}. Para deshacer un pago, ábrelo y borra su movimiento.
        {item.notes ? `\n${item.notes}` : ''}
      </Text>

      <View style={styles.footer}>
        <Button label="Archivar" variant="outline" onPress={confirmArchive} loading={archive.isPending} />
        {mine ? <Button label="Borrar" variant="text" onPress={confirmDelete} loading={remove.isPending} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerButton: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  head: { gap: space.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  sectionTitle: { marginTop: space.md },
  footer: { gap: space.sm, marginTop: space.lg },
});
