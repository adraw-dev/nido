import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { taskErrorMessage } from '@/features/tasks/api';
import { lineOf } from '@/features/tasks/derive';
import { useArchiveTask, useDeleteTask, useTaskHistory, useTaskViews } from '@/features/tasks/hooks';
import { PRIORITY_LABEL } from '@/features/tasks/types';
import { useToggleView } from '@/features/tasks/useToggleView';
import { formatMoment, formatTime, relativeDay } from '@/lib/dates';
import { describeRule, parseRule } from '@/lib/recurrence';
import { Button, LinePlate, Screen, StationBadge, Text, radius, space, touchTarget, useTheme } from '@/ui';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { views, today, isPending } = useTaskViews(household.id);
  const history = useTaskHistory(household.id, id);
  const { colorOf, nameOf } = useLineLookup(household.id);
  const toggle = useToggleView(household.id);
  const archive = useArchiveTask(household.id);
  const remove = useDeleteTask(household.id);

  const view = views.find((v) => v.task.id === id);

  if (!view) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: '' }} />
        <Text tone="muted">{isPending ? 'Cargando…' : 'Esta tarea ya no existe o fue archivada.'}</Text>
      </Screen>
    );
  }

  const { task, state } = view;
  const line = lineOf(task);
  const lineColor = colorOf(line);
  const rule = parseRule(task.recurrence);
  const isOwner = task.owner_id === userId;
  const done = state === 'done';

  const facts: { label: string; value: string; danger?: boolean }[] = [];
  if (rule) facts.push({ label: 'Se repite', value: describeRule(rule, task.due_on) });
  if (state === 'overdue' && view.showOn) facts.push({ label: 'Venció', value: relativeDay(view.showOn, today), danger: true });
  else if (view.showOn) facts.push({ label: rule ? 'Siguiente' : 'Fecha', value: relativeDay(view.showOn, today) });
  const time = formatTime(task.due_time);
  if (time) facts.push({ label: 'Hora', value: time });
  facts.push({ label: 'Prioridad', value: PRIORITY_LABEL[task.priority] });
  facts.push({ label: 'Creada por', value: nameOf(task.owner_id) });

  function confirmArchive() {
    Alert.alert('¿Archivar la tarea?', 'Deja de aparecer en las listas. El historial se conserva.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar',
        onPress: () =>
          archive.mutate(task.id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('No se pudo archivar', taskErrorMessage(e)),
          }),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert('¿Borrar la tarea?', 'Se borra con todo su historial. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          remove.mutate(task.id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('No se pudo borrar', taskErrorMessage(e)),
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
              accessibilityLabel="Editar tarea"
              onPress={() => router.push({ pathname: '/tareas/[id]/editar', params: { id: task.id } })}
              style={styles.headerButton}
            >
              <MaterialCommunityIcons name="pencil-outline" size={24} color={colors.ink} />
            </Pressable>
          ),
        }}
      />

      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={done ? 'Deshacer' : 'Completar'}
          onPress={() => toggle(view)}
          style={styles.station}
        >
          <StationBadge color={lineColor} state={state} size={40} />
        </Pressable>
        <View style={styles.flex}>
          <Text variant="headline" style={done && styles.struck}>
            {task.title}
          </Text>
          <View style={styles.plates}>
            <LinePlate label={nameOf(line)} color={lineColor} />
            {task.visibility === 'personal' ? (
              <Text variant="caption" tone="muted">
                Privada
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
        {facts.map((f, i) => (
          <View key={f.label} style={[styles.fact, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule }]}>
            <Text variant="label" tone="muted">
              {f.label}
            </Text>
            <Text variant="bodyStrong" tone={f.danger ? 'danger' : 'default'}>
              {f.value}
            </Text>
          </View>
        ))}
      </View>

      {task.notes ? <Text tone="muted">{task.notes}</Text> : null}

      <Button
        label={done ? 'Deshacer' : view.bucket === 'proximas' ? 'Completar por adelantado' : 'Completar'}
        variant={done ? 'outline' : 'filled'}
        color={lineColor === colors.trunk ? undefined : lineColor}
        onPress={() => toggle(view)}
      />

      <View style={styles.section}>
        <Text variant="title">Historial</Text>
        {history.data?.length ? (
          history.data.map((c) => (
            <View key={c.id} style={styles.historyRow}>
              <StationBadge color={colorOf(c.completed_by)} state="done" size={24} />
              <View style={styles.flex}>
                <Text variant="body">
                  <Text variant="bodyStrong" color={colorOf(c.completed_by)}>
                    {nameOf(c.completed_by)}
                  </Text>{' '}
                  la completó {formatMoment(c.completed_at, today)}
                </Text>
                {rule ? (
                  <Text variant="caption" tone="subtle">
                    Correspondía a {relativeDay(c.occurrence_on, today)}
                    {c.source === 'qr' ? ' · con QR' : ''}
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text tone="muted">{history.isPending ? 'Cargando…' : 'Nadie la ha completado todavía.'}</Text>
        )}
      </View>

      <View style={styles.actions}>
        <Button label="Archivar" variant="outline" onPress={confirmArchive} loading={archive.isPending} />
        {isOwner ? (
          <Button label="Borrar" variant="text" onPress={confirmDelete} loading={remove.isPending} />
        ) : (
          <Text variant="caption" tone="subtle" style={styles.center}>
            Solo {nameOf(task.owner_id)} puede borrarla; tú puedes archivarla.
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
  },
  station: {
    width: touchTarget + 4,
    height: touchTarget + 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -space.sm,
    marginTop: -6,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  plates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
  },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
  },
  section: {
    gap: space.md,
    marginTop: space.sm,
  },
  historyRow: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
  },
  actions: {
    gap: space.sm,
    marginTop: space.lg,
  },
  center: {
    textAlign: 'center',
  },
});
