import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatCOP } from '@/lib/money';
import { Text, radius, space, useTheme } from '@/ui';

import { formatKm } from '../stats';
import { KIND_ICON, type Vehicle } from '../types';

/** Placa con el amarillo de las placas colombianas. */
export function Plate({ plate }: { plate: string }) {
  return (
    <View style={styles.plate} accessibilityLabel={`Placa ${plate.split('').join(' ')}`}>
      <Text variant="plate" color="#15171A" style={styles.plateText}>
        {plate}
      </Text>
    </View>
  );
}

export function VehicleCard({
  vehicle,
  color,
  spentThisYear,
  kmToOil,
  onPress,
}: {
  vehicle: Vehicle;
  color: string;
  spentThisYear: number;
  kmToOil: number | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const subtitle = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.nickname}, ${subtitle}, ${formatKm(vehicle.odometer_km)}, gasto del año ${formatCOP(spentThisYear)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.rule, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.lineBar, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialCommunityIcons name={KIND_ICON[vehicle.kind]} size={28} color={colors.inkMuted} />
          </View>
          <View style={styles.flex}>
            <Text variant="title" numberOfLines={1}>
              {vehicle.nickname}
            </Text>
            {subtitle ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {vehicle.plate ? <Plate plate={vehicle.plate} /> : null}
        </View>
        <View style={styles.stats}>
          <View style={styles.flex}>
            <Text variant="caption" tone="muted">
              Kilometraje
            </Text>
            <Text variant="figure">{formatKm(vehicle.odometer_km)}</Text>
          </View>
          <View style={styles.flex}>
            <Text variant="caption" tone="muted">
              Gasto del año
            </Text>
            <Text variant="figure" numberOfLines={1} adjustsFontSizeToFit>
              {formatCOP(spentThisYear)}
            </Text>
          </View>
        </View>
        {kmToOil !== null ? (
          <Text variant="caption" tone={kmToOil <= 0 ? 'danger' : 'muted'}>
            {kmToOil <= 0 ? `Aceite vencido hace ${formatKm(-kmToOil)} (estimado)` : `Aceite en ${formatKm(kmToOil)} (estimado)`}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  lineBar: {
    width: 6,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    padding: space.lg,
    gap: space.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  stats: {
    flexDirection: 'row',
    gap: space.md,
  },
  plate: {
    backgroundColor: '#F2C200',
    borderColor: '#15171A',
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  plateText: {
    letterSpacing: 2,
  },
});
