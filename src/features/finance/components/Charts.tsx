import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatCOP, formatCOPShort } from '@/lib/money';
import { Text, radius, space, useTheme } from '@/ui';

import type { CategoryShare } from '../summary';
import { categoryIcon, type Category } from '../types';

/**
 * Gasto o ingreso por categoría: una sola serie (azul del tronco), barras
 * finas ancladas a la izquierda, valores en tinta.
 */
export function CategoryBars({
  shares,
  categories,
  kind,
}: {
  shares: CategoryShare[];
  categories: Map<string, Category>;
  kind: 'income' | 'expense';
}) {
  const { colors } = useTheme();
  const max = Math.max(...shares.map((s) => s.total), 1);
  return (
    <View style={styles.bars}>
      {shares.map((s) => {
        const cat = s.categoryId ? categories.get(s.categoryId) : undefined;
        const name = cat?.name ?? 'Sin categoría';
        const pct = Math.round(s.share * 100);
        return (
          <View
            key={s.categoryId ?? 'none'}
            accessible
            accessibilityLabel={`${name}: ${formatCOP(s.total)}, ${pct}%`}
            style={styles.barRow}
          >
            <View style={styles.barHead}>
              <MaterialCommunityIcons name={categoryIcon(cat?.icon, kind)} size={18} color={colors.inkMuted} />
              <Text variant="label" style={styles.flex} numberOfLines={1}>
                {name}
              </Text>
              <Text variant="figure" style={styles.barValue}>
                {formatCOP(s.total)}
              </Text>
              <Text variant="caption" tone="subtle" style={styles.pct}>
                {pct}%
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
              <View style={[styles.fill, { width: `${(s.total / max) * 100}%`, backgroundColor: colors.trunk }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const MONTH_INITIAL = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAME = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Los 12 meses del año en columnas (una serie). Tocar una columna la
 * selecciona y muestra su valor arriba: el equivalente táctil del tooltip.
 */
export function MonthBars({
  values,
  selected,
  current,
  onSelect,
}: {
  values: number[];
  /** Mes seleccionado (0..11). */
  selected: number;
  /** Meses posteriores a este (0..11) son futuro y no se tocan; -1 si el año ya pasó completo. */
  current: number;
  onSelect: (month: number) => void;
}) {
  const { colors } = useTheme();
  const max = Math.max(...values, 1);
  const HEIGHT = 120;
  return (
    <View>
      <View style={[styles.columns, { height: HEIGHT, borderBottomColor: colors.rule }]}>
        {values.map((v, i) => {
          const future = current >= 0 && i > current;
          const isSel = i === selected;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityState={{ selected: isSel, disabled: future }}
              accessibilityLabel={`${MONTH_NAME[i]}: ${formatCOP(v)}`}
              disabled={future}
              onPress={() => onSelect(i)}
              style={styles.colHit}
            >
              <View
                style={[
                  styles.col,
                  {
                    height: v > 0 ? Math.max(3, (v / max) * (HEIGHT - 8)) : 0,
                    backgroundColor: colors.trunk,
                    opacity: isSel ? 1 : 0.4,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {MONTH_INITIAL.map((m, i) => (
          <Text
            key={i}
            variant="caption"
            tone={i === selected ? 'default' : 'subtle'}
            style={[styles.axisLabel, i === selected && styles.axisSelected]}
          >
            {m}
          </Text>
        ))}
      </View>
      <Text variant="caption" tone="subtle" style={styles.maxLabel}>
        Máximo del año: {formatCOPShort(max)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bars: {
    gap: space.md,
  },
  barRow: {
    gap: space.xs + 2,
  },
  barHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  barValue: {
    fontSize: 14,
  },
  pct: {
    width: 36,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
  },
  colHit: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 1, // 2 px de aire entre columnas
  },
  col: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  axis: {
    flexDirection: 'row',
    marginTop: space.xs,
  },
  axisLabel: {
    flex: 1,
    textAlign: 'center',
  },
  axisSelected: {
    fontFamily: 'Roboto_700Bold',
  },
  maxLabel: {
    marginTop: space.xs,
  },
});
