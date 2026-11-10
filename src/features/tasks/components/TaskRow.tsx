import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatMoment, formatTime, relativeDay } from '@/lib/dates';
import { describeRule, parseRule } from '@/lib/recurrence';
import { StationBadge, Text, space, touchTarget, useTheme } from '@/ui';

import type { TaskView } from '../derive';
import { lineOf } from '../derive';

export type TaskRowProps = {
  view: TaskView;
  today: string;
  colorOf: (id: string | 'trunk' | null | undefined) => string;
  nameOf: (id: string | 'trunk' | null | undefined) => string;
  onToggle: () => void;
  onOpen: () => void;
};

const STATE_LABEL = { pending: 'pendiente', done: 'hecha', overdue: 'atrasada' } as const;

/** Fila de tarea: la estación (tocar = completar) y el texto (tocar = detalle). */
export function TaskRow({ view, today, colorOf, nameOf, onToggle, onOpen }: TaskRowProps) {
  const { colors } = useTheme();
  const { task, state, completion } = view;
  const line = lineOf(task);
  const lineColor = colorOf(line);
  const done = state === 'done';

  const meta: string[] = [];
  if (state === 'overdue' && view.showOn) meta.push(`venció ${relativeDay(view.showOn, today)}`);
  else if (view.bucket === 'proximas' && view.showOn) meta.push(relativeDay(view.showOn, today));
  const time = formatTime(task.due_time);
  if (time) meta.push(time);
  const rule = parseRule(task.recurrence);
  if (rule) meta.push(describeRule(rule, task.due_on));
  if (task.priority === 1) meta.push('prioridad alta');

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`${task.title}, ${STATE_LABEL[state]}. ${done ? 'Toca para deshacer' : 'Toca para completar'}`}
        onPress={onToggle}
        hitSlop={4}
        style={styles.station}
      >
        <StationBadge color={lineColor} state={state} size={30} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityHint="Abre el detalle de la tarea"
        onPress={onOpen}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={styles.text}>
          <Text
            variant="bodyStrong"
            tone={done ? 'subtle' : 'default'}
            numberOfLines={2}
            style={done && styles.doneTitle}
          >
            {task.title}
          </Text>
          {done && completion ? (
            <Text variant="caption" color={colorOf(completion.completed_by)} numberOfLines={1}>
              {nameOf(completion.completed_by)} · {formatMoment(completion.completed_at, today)}
            </Text>
          ) : (
            <View style={styles.metaRow}>
              <View style={[styles.lineDot, { backgroundColor: lineColor }]} />
              <Text variant="caption" tone={state === 'overdue' ? 'danger' : 'muted'} numberOfLines={1} style={styles.flex}>
                {[nameOf(line), ...meta].join(' · ')}
              </Text>
            </View>
          )}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.inkSubtle} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
  },
  station: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -space.sm,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  doneTitle: {
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
  },
  lineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flex: {
    flex: 1,
  },
});
