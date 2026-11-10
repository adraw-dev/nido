import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addMonths, format, getDaysInMonth, getISODay, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDaysKey, fromKey, toKey, type DateKey } from '@/lib/dates';
import { WEEKDAY_SHORT, type Weekday } from '@/lib/recurrence';
import { StationBadge, Text, space, touchTarget, useTheme, type StationState } from '@/ui';

const STATE_LABEL: Record<StationState, string> = {
  done: 'cumplido',
  pending: 'pendiente',
  overdue: 'sin cumplir',
  skipped: 'no toca',
};

export type MonthCalendarProps = {
  /** Cualquier día del mes que se muestra. */
  month: DateKey;
  today: DateKey;
  color: string;
  stateOf: (day: DateKey) => StationState;
  onChangeMonth: (month: DateKey) => void;
  /** Tocar un día pasado o de hoy (por ejemplo, para registrar un olvido). */
  onDayPress?: (day: DateKey) => void;
};

/** Calendario del mes con una estación por día. */
export function MonthCalendar({ month, today, color, stateOf, onChangeMonth, onDayPress }: MonthCalendarProps) {
  const { colors } = useTheme();
  const first = toKey(startOfMonth(fromKey(month)));
  const total = getDaysInMonth(fromKey(first));
  const lead = getISODay(fromKey(first)) - 1; // huecos antes del día 1 (lunes primero)
  const cells: (DateKey | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => addDaysKey(first, i)),
  ];
  while (cells.length % 7) cells.push(null);
  const canGoNext = toKey(startOfMonth(fromKey(today))) > first;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          onPress={() => onChangeMonth(toKey(addMonths(fromKey(first), -1)))}
          style={styles.nav}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.ink} />
        </Pressable>
        <Text variant="title" style={styles.monthTitle}>
          {format(fromKey(first), 'MMMM yyyy', { locale: es })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          accessibilityState={{ disabled: !canGoNext }}
          disabled={!canGoNext}
          onPress={() => onChangeMonth(toKey(addMonths(fromKey(first), 1)))}
          style={[styles.nav, { opacity: canGoNext ? 1 : 0.3 }]}
        >
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.week}>
        {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((d) => (
          <Text key={d} variant="caption" tone="subtle" style={styles.cellText}>
            {WEEKDAY_SHORT[d]}
          </Text>
        ))}
      </View>

      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={styles.week}>
          {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const state = stateOf(day);
            const future = day > today;
            const isToday = day === today;
            const label = `${format(fromKey(day), "d 'de' MMMM", { locale: es })}: ${future ? 'por venir' : STATE_LABEL[state]}`;
            return (
              <Pressable
                key={day}
                accessibilityRole={onDayPress && !future ? 'button' : undefined}
                accessibilityLabel={label}
                disabled={!onDayPress || future}
                onPress={() => onDayPress?.(day)}
                style={[styles.cell, isToday && { borderColor: colors.ink, borderWidth: 1.5, borderRadius: 12 }]}
              >
                <View style={{ opacity: future ? 0.35 : 1 }}>
                  <StationBadge color={color} state={future ? 'pending' : state} size={24} />
                </View>
                <Text variant="caption" tone={isToday ? 'default' : 'subtle'} style={styles.dayNumber}>
                  {fromKey(day).getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nav: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    flex: 1,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  week: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.xs,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cellText: {
    flex: 1,
    textAlign: 'center',
  },
  dayNumber: {
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
});
