import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { financeErrorMessage } from '@/features/finance/api';
import { DebtCard, PaymentsLine } from '@/features/finance/components/Bills';
import { useArchiveDebt, useDebts, useDeleteDebt } from '@/features/finance/hooks';
import { payDaysLabel } from '@/features/finance/schedule';
import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { fromKey, relativeDay } from '@/lib/dates';
import { formatCOP } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { Button, Screen, Text, radius, space, touchTarget, useTheme } from '@/ui';

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const today = useToday();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { colorOf, nameOf } = useLineLookup(household.id);
  const debts = useDebts(household.id, today);
  const archive = useArchiveDebt(household.id);
  const remove = useDeleteDebt(household.id);
  const state = debts.states.find((s) => s.debt.id === id);

  if (!state) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: '' }} />
        <Text tone="muted">{debts.isPending ? 'Cargando…' : 'Esta deuda ya no existe o fue archivada.'}</Text>
      </Screen>
    );
  }

  const { debt, settled, next, installments, payments } = state;
  const color = debt.visibility === 'shared' ? colors.trunk : colorOf(debt.owner_id);
  const mine = debt.owner_id === userId;
  const recent = installments.slice(-7);
  const shortDate = (d: string) => format(fromKey(d), 'd MMM', { locale: es });

  function confirmArchive() {
    Alert.alert('¿Archivar la deuda?', 'Deja de aparecer en Pagos. Los abonos siguen en los movimientos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar',
        onPress: () =>
          archive.mutate(debt.id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('No se pudo archivar', financeErrorMessage(e)),
          }),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert('¿Borrar la deuda?', 'Se borra su historial de abonos; los movimientos quedan en Dinero. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          remove.mutate(debt.id, {
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
              accessibilityLabel="Editar deuda"
              onPress={() => router.push({ pathname: '/dinero/deudas/[id]/editar', params: { id: debt.id } })}
              style={styles.headerButton}
            >
              <MaterialCommunityIcons name="pencil-outline" size={24} color={colors.ink} />
            </Pressable>
          ),
        }}
      />

      <DebtCard state={state} color={color} today={today} />

      {!settled ? (
        <View style={styles.actions}>
          {next ? (
            <View style={styles.flex}>
              <Button
                label={`Pagar cuota ${shortDate(next.period)}`}
                color={next.status === 'overdue' ? colors.danger : color}
                onPress={() => router.push({ pathname: '/dinero/pagar', params: { deuda: debt.id, cuota: next.period } })}
              />
            </View>
          ) : null}
          <View style={styles.flex}>
            <Button
              label={next ? 'Abono extra' : 'Abonar'}
              variant={next ? 'outline' : 'filled'}
              color={next ? undefined : color}
              onPress={() => router.push({ pathname: '/dinero/pagar', params: { deuda: debt.id } })}
            />
          </View>
        </View>
      ) : null}

      {debt.installment_day && debt.installment_amount ? (
        <View style={styles.block}>
          <Text variant="title" style={styles.sectionTitle}>
            Cuotas
          </Text>
          <Text tone="muted">
            {formatCOP(debt.installment_amount)} · {payDaysLabel([debt.installment_day])} de cada mes
          </Text>
          {recent.length ? (
            <PaymentsLine
              color={color}
              stops={recent.map((i) => ({ key: i.period, status: i.status, label: shortDate(i.period) }))}
              accessibilityLabel={`Cuotas recientes: ${recent.filter((i) => i.status === 'paid').length} de ${recent.length} pagadas`}
            />
          ) : null}
        </View>
      ) : null}

      <Text variant="title" style={styles.sectionTitle}>
        Abonos
      </Text>
      {payments.length ? (
        payments.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`Abono de ${formatCOP(p.amount)}, ${relativeDay(p.paid_on, today)}, pagó ${nameOf(p.created_by)}`}
            onPress={() => router.push({ pathname: '/dinero/[id]', params: { id: p.transaction_id } })}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
              <MaterialCommunityIcons name="bank" size={20} color={colors.inkMuted} />
              <View style={[styles.sign, { backgroundColor: colorOf(p.created_by), borderColor: colors.bg }]} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {p.period_on ? `Cuota ${shortDate(p.period_on)}` : 'Abono extra'}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {nameOf(p.created_by)} · {relativeDay(p.paid_on, today)}
              </Text>
            </View>
            <Text variant="figure">{formatCOP(-Number(p.amount))}</Text>
          </Pressable>
        ))
      ) : (
        <Text tone="muted">Todavía no hay abonos.</Text>
      )}

      <Text variant="caption" tone="subtle">
        Creada por {nameOf(debt.owner_id)} · {debt.visibility === 'shared' ? 'Del hogar' : 'Solo mía'}. Para deshacer un abono, ábrelo y borra su
        movimiento.
        {debt.notes ? `\n${debt.notes}` : ''}
      </Text>

      <View style={styles.footer}>
        <Button label="Archivar" variant="outline" onPress={confirmArchive} loading={archive.isPending} />
        {mine ? <Button label="Borrar" variant="text" onPress={confirmDelete} loading={remove.isPending} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerButton: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: space.md },
  block: { gap: space.sm },
  sectionTitle: { marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.sm },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sign: { position: 'absolute', right: -3, bottom: -3, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  footer: { gap: space.sm, marginTop: space.lg },
});
