import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { groupThousands, parseCOP } from '@/lib/money';
import { Text, fonts, radius, space, useRevealFocused, useTheme } from '@/ui';

import { categoryIcon, type Category } from '../types';

/** Rótulo pequeño sobre un grupo de controles. */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {children}
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Valor en pesos con cifras grandes: "$ 1.200.000". `value` es el texto ya agrupado. */
export function AmountInput({
  label,
  value,
  onChange,
  error,
  accessibilityLabel,
  size = 'md',
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  error?: string | null;
  accessibilityLabel: string;
  size?: 'md' | 'lg';
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const revealFocused = useRevealFocused();
  return (
    <View style={styles.field}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View style={[styles.amountRow, { borderBottomColor: error ? colors.danger : colors.ink }]}>
        <Text style={[styles.currency, size === 'lg' && styles.currencyLg, { color: colors.inkMuted }]}>$</Text>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          onFocus={revealFocused}
          value={value}
          onChangeText={(t) => {
            const n = parseCOP(t);
            onChange(n ? groupThousands(n) : '');
          }}
          placeholder="0"
          placeholderTextColor={colors.inkSubtle}
          keyboardType="number-pad"
          maxLength={17}
          autoFocus={autoFocus}
          selectionColor={colors.trunk}
          style={[styles.amountInput, size === 'lg' && styles.amountInputLg, { color: colors.ink }]}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Rejilla de categorías con ícono; tocar la elegida la quita (queda "Otros"). */
export function CategoryGrid({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.categories}>
      {categories.map((c) => {
        const selected = value === c.id;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={c.name}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(selected ? null : c.id);
            }}
            style={[
              styles.category,
              { borderColor: selected ? colors.ink : colors.rule, backgroundColor: selected ? colors.ink : colors.surface },
            ]}
          >
            <MaterialCommunityIcons name={categoryIcon(c.icon, c.kind)} size={22} color={selected ? colors.bg : colors.inkMuted} />
            <Text variant="caption" color={selected ? colors.bg : colors.ink} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Días del mes 1–31 como un calendario. `max` = cuántos se pueden elegir
 * (1 mensual, 2 quincenal); al pasarse, se suelta el más antiguo.
 */
export function DayOfMonthPicker({
  value,
  onChange,
  max,
  color,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  max: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const fill = color ?? colors.ink;
  return (
    <View style={styles.days} accessibilityRole="radiogroup">
      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
        const selected = value.includes(d);
        return (
          <Pressable
            key={d}
            accessibilityRole={max > 1 ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: selected }}
            accessibilityLabel={d === 31 ? 'Día 31 o último del mes' : `Día ${d}`}
            hitSlop={2}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              if (selected) {
                if (value.length > 1) onChange(value.filter((x) => x !== d));
                return;
              }
              onChange([...value, d].slice(-max).sort((a, b) => a - b));
            }}
            style={[
              styles.day,
              { borderColor: selected ? fill : colors.rule, backgroundColor: selected ? fill : colors.surface },
            ]}
          >
            <Text variant="label" color={selected ? colors.bg : colors.ink} style={styles.tabular}>
              {d}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, gap: space.sm },
  currency: { fontFamily: fonts.display, fontSize: 28 },
  currencyLg: { fontSize: 32 },
  amountInput: { flex: 1, fontFamily: fonts.displayHeavy, fontSize: 36, paddingVertical: space.sm, fontVariant: ['tabular-nums'] },
  amountInputLg: { fontSize: 44 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  category: {
    width: '23%',
    flexGrow: 1,
    minHeight: 64,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: space.xs,
  },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: {
    // 7 por fila, como un calendario; sin flexGrow para que la última fila no se estire.
    width: '12.4%',
    aspectRatio: 1,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabular: { fontVariant: ['tabular-nums'] },
});
