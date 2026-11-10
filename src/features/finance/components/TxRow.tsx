import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatCOP } from '@/lib/money';
import { Text, radius, space, useTheme } from '@/ui';

import { categoryIcon, KIND_LABEL, type Category, type Transaction } from '../types';

export type TxRowProps = {
  tx: Transaction;
  category?: Category;
  goalName?: string;
  /** Firma: quién lo registró y su color de línea. */
  ownerName: string;
  ownerColor: string;
  onPress: () => void;
};

/** Movimiento firmado con el color de línea de quien lo registró. */
export function TxRow({ tx, category, goalName, ownerName, ownerColor, onPress }: TxRowProps) {
  const { colors } = useTheme();
  const amount = Number(tx.amount);
  const title =
    tx.kind === 'saving'
      ? `${amount < 0 ? 'Retiro' : 'Aporte'}${goalName ? ` · ${goalName}` : ''}`
      : (category?.name ?? KIND_LABEL[tx.kind]);
  const shown =
    tx.kind === 'income' ? formatCOP(amount, { sign: true }) : tx.kind === 'expense' ? formatCOP(-amount) : formatCOP(amount, { sign: true });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${KIND_LABEL[tx.kind]}: ${title}${tx.description ? `, ${tx.description}` : ''}, ${shown}, registró ${ownerName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
        <MaterialCommunityIcons name={categoryIcon(category?.icon, tx.kind)} size={20} color={colors.inkMuted} />
        <View style={[styles.sign, { backgroundColor: ownerColor, borderColor: colors.bg }]} />
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {[ownerName, tx.description, tx.visibility === 'personal' ? 'Solo mío' : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text variant="figure" tone={tx.kind === 'expense' ? 'default' : 'trunk'} style={styles.amount}>
        {shown}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingVertical: space.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sign: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  amount: {
    fontSize: 15,
  },
});
