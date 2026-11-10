import { StyleSheet, View } from 'react-native';

import { formatCOP } from '@/lib/money';
import { Text, radius, space, useTheme } from '@/ui';

import type { Balance } from '../summary';

/** Balance del período: entró, salió, se ahorró y lo que queda libre. */
export function BalanceCard({ balance }: { balance: Balance }) {
  const { colors } = useTheme();
  const items = [
    { label: 'Ingresos', value: formatCOP(balance.income) },
    { label: 'Gastos', value: formatCOP(balance.expense) },
    { label: 'Ahorro', value: formatCOP(balance.saving) },
  ];
  return (
    <View
      accessible
      accessibilityLabel={`Balance: ingresos ${items[0].value}, gastos ${items[1].value}, ahorro ${items[2].value}, libre ${formatCOP(balance.net)}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.rule }]}
    >
      <Text variant="caption" tone="muted">
        Libre en el período
      </Text>
      <Text variant="display" tone={balance.net < 0 ? 'danger' : 'default'} style={styles.net}>
        {formatCOP(balance.net)}
      </Text>
      <View style={[styles.row, { borderTopColor: colors.rule }]}>
        {items.map((i) => (
          <View key={i.label} style={styles.item}>
            <Text variant="caption" tone="muted">
              {i.label}
            </Text>
            <Text variant="figure" numberOfLines={1} adjustsFontSizeToFit style={styles.value}>
              {i.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  net: {
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: space.sm,
    paddingTop: space.md,
    gap: space.sm,
  },
  item: {
    flex: 1,
    gap: 2,
  },
  value: {
    fontSize: 15,
  },
});
