import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { VehicleCard } from '@/features/vehicles/components/VehicleCard';
import { useRecords, useVehicles } from '@/features/vehicles/hooks';
import { kmLine, totalSpent } from '@/features/vehicles/stats';
import { RECORD_META } from '@/features/vehicles/types';
import { useToday } from '@/lib/useToday';
import { Button, EmptyState, Fab, Text, space, useTheme } from '@/ui';

export default function GarageScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const { household } = useCurrentHousehold();
  const { colorOf } = useLineLookup(household.id);
  const vehicles = useVehicles(household.id);
  const records = useRecords(household.id);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const list = vehicles.data ?? [];

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={vehicles.isRefetching}
            onRefresh={() => {
              vehicles.refetch();
              records.refetch();
            }}
            colors={[colors.trunk]}
            tintColor={colors.trunk}
          />
        }
      >
        <Text variant="headline" accessibilityRole="header">
          Garaje
        </Text>

        {vehicles.isError || records.isError ? (
          <View style={styles.block}>
            <Text tone="danger">No pudimos cargar el garaje.</Text>
            <Button label="Reintentar" variant="tonal" onPress={() => vehicles.refetch()} />
          </View>
        ) : null}

        {list.length === 0 && !vehicles.isPending ? (
          <EmptyState
            title="Todavía no hay vehículos"
            caption="Agrega la moto o el carro. Cada uno tendrá su línea de kilometraje con el próximo mantenimiento como siguiente estación."
          />
        ) : (
          list.map((v) => {
            const mine = (records.data ?? []).filter((r) => r.vehicle_id === v.id);
            const line = kmLine(v, mine, (t) => RECORD_META[t].label);
            return (
              <VehicleCard
                key={v.id}
                vehicle={v}
                color={v.visibility === 'shared' ? colors.trunk : colorOf(v.owner_id)}
                spentThisYear={totalSpent(mine, yearStart)}
                kmToOil={line.kmToOil}
                onPress={() => router.push({ pathname: '/garaje/[id]', params: { id: v.id } })}
              />
            );
          })
        )}

        <Button label="Agregar vehículo" variant="outline" onPress={() => router.push('/garaje/nuevo')} />
      </ScrollView>

      {list.length > 0 ? (
        <Fab label="Registrar gasto del vehículo" onPress={() => router.push('/garaje/registro/nuevo')} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: space.xl - 4,
    paddingTop: space.md,
    paddingBottom: 96,
    gap: space.lg,
  },
  block: { gap: space.md },
});
