import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text, space, useTheme } from '@/ui';

import type { HabitView } from '../hooks';
import { streakLabel } from '../stats';
import { HabitRing } from './HabitRing';

export type HabitRowProps = {
  view: HabitView;
  color: string;
  todayIndex: number;
  /** Nombre del dueño si no es tuyo (hábito compartido de la pareja). */
  ownerName?: string;
  canLog: boolean;
  onLog: () => void;
  onOpen: () => void;
};

const PERIOD_NOW = { day: 'hoy', week: 'esta semana', month: 'este mes' } as const;

export function progressText(view: HabitView): string {
  const { habit, progress } = view;
  const unit = habit.unit ? ` ${habit.unit}` : '';
  if (habit.period === 'day' && !progress.due) return 'Hoy no toca';
  return `${progress.amount} de ${progress.target}${unit} ${PERIOD_NOW[habit.period]}`;
}

/** Fila de hábito: el anillo suma uno (solo el dueño), el texto abre el detalle. */
export function HabitRow({ view, color, todayIndex, ownerName, canLog, onLog, onOpen }: HabitRowProps) {
  const { colors } = useTheme();
  const { habit, progress, streak } = view;
  const restDay = habit.period === 'day' && !progress.due;
  const label = `${habit.name}: ${progressText(view)}${progress.met ? ', cumplido' : ''}`;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={canLog && !restDay ? 'Toca para sumar uno' : undefined}
        accessibilityState={{ disabled: !canLog || restDay }}
        disabled={!canLog || restDay}
        onPress={onLog}
        style={({ pressed }) => ({ opacity: restDay ? 0.5 : pressed ? 0.7 : 1 })}
      >
        <HabitRing
          size={64}
          color={color}
          fraction={progress.fraction}
          week={view.week.map((w) => w.state)}
          todayIndex={todayIndex}
          center={progress.met ? '✓' : `${progress.amount}/${progress.target}`}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityHint="Abre el detalle del hábito"
        onPress={onOpen}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={styles.text}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {habit.name}
          </Text>
          <Text variant="caption" tone={progress.met ? 'default' : 'muted'} color={progress.met ? color : undefined}>
            {progress.met ? `Cumplido ${PERIOD_NOW[habit.period]}` : progressText(view)}
          </Text>
          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {[ownerName ? `De ${ownerName}` : null, streak.count > 0 ? `Racha: ${streakLabel(streak)}` : 'Sin racha todavía']
              .filter(Boolean)
              .join(' · ')}
          </Text>
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
    gap: space.md,
    paddingVertical: space.md,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
