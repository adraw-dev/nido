import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { financeErrorMessage } from '@/features/finance/api';
import { GoalCard } from '@/features/finance/components/GoalCard';
import { TxRow } from '@/features/finance/components/TxRow';
import { useArchiveGoal, useDeleteGoal, useGoals } from '@/features/finance/hooks';
import { scopeOf } from '@/features/finance/types';
import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { relativeDay } from '@/lib/dates';
import { useToday } from '@/lib/useToday';
import { Button, Screen, Text, space, touchTarget, useTheme } from '@/ui';

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const today = useToday();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { colorOf, nameOf } = useLineLookup(household.id);
  const goals = useGoals(household.id);
  const archive = useArchiveGoal(household.id);
  const remove = useDeleteGoal(household.id);

  const progress = goals.progress.find((g) => g.goal.id === id);
  if (!progress) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: '' }} />
        <Text tone="muted">{goals.isPending ? 'Cargando…' : 'Esta meta ya no existe o fue archivada.'}</Text>
      </Screen>
    );
  }

  const { goal } = progress;
  const color = goal.visibility === 'shared' ? colors.trunk : colorOf(goal.owner_id);
  const scope = scopeOf(goal);
  const movements = goals.savings.filter((t) => t.goal_id === goal.id);
  const mine = goal.owner_id === userId;

  function confirmArchive() {
    Alert.alert('¿Archivar la meta?', 'Deja de aparecer. Sus aportes siguen en los movimientos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar',
        onPress: () =>
          archive.mutate(goal.id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('No se pudo archivar', financeErrorMessage(e)),
          }),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert('¿Borrar la meta?', 'Los aportes quedan como ahorro sin meta. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          remove.mutate(goal.id, {
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
              accessibilityLabel="Editar meta"
              onPress={() => router.push({ pathname: '/dinero/metas/[id]/editar', params: { id: goal.id } })}
              style={styles.headerButton}
            >
              <MaterialCommunityIcons name="pencil-outline" size={24} color={colors.ink} />
            </Pressable>
          ),
        }}
      />

      <GoalCard progress={progress} color={color} today={today} />

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            label="Aportar"
            color={color}
            onPress={() => router.push({ pathname: '/dinero/nuevo', params: { kind: 'saving', goal: goal.id, scope } })}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label="Retirar"
            variant="outline"
            disabled={progress.saved <= 0}
            onPress={() => router.push({ pathname: '/dinero/nuevo', params: { kind: 'saving', goal: goal.id, scope, retiro: '1' } })}
          />
        </View>
      </View>
      <Text variant="caption" tone="subtle">
        Creada por {nameOf(goal.owner_id)}
        {goal.target_on ? ` · para ${relativeDay(goal.target_on, today)}` : ''}.
      </Text>

      <Text variant="title" style={styles.sectionTitle}>
        Aportes y retiros
      </Text>
      {movements.length ? (
        movements.map((t) => (
          <TxRow
            key={t.id}
            tx={t}
            ownerName={`${nameOf(t.owner_id)} · ${relativeDay(t.occurred_on, today)}`}
            ownerColor={colorOf(t.owner_id)}
            onPress={() => router.push({ pathname: '/dinero/[id]', params: { id: t.id } })}
          />
        ))
      ) : (
        <Text tone="muted">Todavía no hay aportes.</Text>
      )}

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
  sectionTitle: { marginTop: space.md },
  footer: { gap: space.sm, marginTop: space.lg },
});
