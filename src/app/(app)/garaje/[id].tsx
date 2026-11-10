import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useCurrentHousehold, useLineLookup } from '@/features/household/hooks';
import { useUserId } from '@/features/session/SessionProvider';
import { vehicleErrorMessage } from '@/features/vehicles/api';
import { KmLine } from '@/features/vehicles/components/KmLine';
import { Plate } from '@/features/vehicles/components/VehicleCard';
import {
  useArchiveVehicle,
  useDeleteVehicle,
  useRecords,
  useSetOdometer,
  useVehicles,
} from '@/features/vehicles/hooks';
import { formatKm, kmLine, spentByType, totalSpent } from '@/features/vehicles/stats';
import { KIND_ICON, OIL_INTERVAL_KM, RECORD_META, type RecordType } from '@/features/vehicles/types';
import { relativeDay } from '@/lib/dates';
import { formatCOP, groupThousands, parseCOP } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { Button, Chip, Screen, Text, TextField, radius, space, touchTarget, useTheme } from '@/ui';

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const today = useToday();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { colorOf, nameOf } = useLineLookup(household.id);
  const vehicles = useVehicles(household.id);
  const records = useRecords(household.id);
  const setKm = useSetOdometer(household.id);
  const archive = useArchiveVehicle(household.id);
  const remove = useDeleteVehicle(household.id);
  const [filter, setFilter] = useState<RecordType | 'todos'>('todos');
  const [editingKm, setEditingKm] = useState(false);
  const [kmText, setKmText] = useState('');

  const vehicle = vehicles.data?.find((v) => v.id === id);
  const history = useMemo(() => (records.data ?? []).filter((r) => r.vehicle_id === id), [records.data, id]);

  if (!vehicle) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: '' }} />
        <Text tone="muted">{vehicles.isPending ? 'Cargando…' : 'Este vehículo ya no existe o fue archivado.'}</Text>
      </Screen>
    );
  }

  const color = vehicle.visibility === 'shared' ? colors.trunk : colorOf(vehicle.owner_id);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const line = kmLine(vehicle, history, (t) => RECORD_META[t].label);
  const lastOil = line.nextOilKm !== null ? line.nextOilKm - OIL_INTERVAL_KM[vehicle.kind] : null;
  const progressToOil = lastOil !== null ? (vehicle.odometer_km - lastOil) / OIL_INTERVAL_KM[vehicle.kind] : null;
  const types = spentByType(history, yearStart).filter((t) => t.total > 0);
  const maxType = Math.max(...types.map((t) => t.total), 1);
  const presentTypes = [...new Set(history.map((r) => r.type))];
  const shown = filter === 'todos' ? history : history.filter((r) => r.type === filter);
  const subtitle = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ');

  function saveKm() {
    const km = parseCOP(kmText);
    if (km < vehicle!.odometer_km) {
      Alert.alert('Kilometraje menor', `El actual es ${formatKm(vehicle!.odometer_km)}. ¿Seguro que quieres bajarlo?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, cambiar', onPress: () => doSaveKm(km) },
      ]);
      return;
    }
    doSaveKm(km);
  }

  function doSaveKm(km: number) {
    setKm.mutate(
      { vehicleId: vehicle!.id, km },
      {
        onSuccess: () => setEditingKm(false),
        onError: (e) => Alert.alert('No se pudo guardar', vehicleErrorMessage(e)),
      },
    );
  }

  function confirmArchive() {
    Alert.alert('¿Archivar el vehículo?', 'Deja de aparecer en el garaje. Su historial y gastos se conservan.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar',
        onPress: () =>
          archive.mutate(vehicle!.id, {
            onSuccess: () => router.back(),
            onError: (e) => Alert.alert('No se pudo archivar', vehicleErrorMessage(e)),
          }),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert(
      '¿Borrar el vehículo?',
      'Se borra con todo su historial. Los gastos en Dinero se conservan sin vínculo. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () =>
            remove.mutate(vehicle!.id, {
              onSuccess: () => router.back(),
              onError: (e) => Alert.alert('No se pudo borrar', vehicleErrorMessage(e)),
            }),
        },
      ],
    );
  }

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Editar vehículo"
              onPress={() => router.push({ pathname: '/garaje/[id]/editar', params: { id: vehicle.id } })}
              style={styles.headerButton}
            >
              <MaterialCommunityIcons name="pencil-outline" size={24} color={colors.ink} />
            </Pressable>
          ),
        }}
      />

      <View style={styles.titleRow}>
        <View style={[styles.kindIcon, { backgroundColor: colors.surfaceMuted, borderColor: color }]}>
          <MaterialCommunityIcons name={KIND_ICON[vehicle.kind]} size={32} color={colors.inkMuted} />
        </View>
        <View style={styles.flex}>
          <Text variant="headline">{vehicle.nickname}</Text>
          <Text variant="caption" tone="muted">
            {[subtitle, vehicle.visibility === 'shared' ? 'Del hogar' : `De ${nameOf(vehicle.owner_id)}`].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {vehicle.plate ? <Plate plate={vehicle.plate} /> : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
        <View style={styles.cardHead}>
          <Text variant="title" style={styles.flex}>
            {formatKm(vehicle.odometer_km)}
          </Text>
          <Button
            label={editingKm ? 'Cancelar' : 'Actualizar km'}
            variant="text"
            onPress={() => {
              setKmText(groupThousands(vehicle.odometer_km));
              setEditingKm((e) => !e);
            }}
          />
        </View>
        {editingKm ? (
          <View style={styles.kmEdit}>
            <View style={styles.flex}>
              <TextField
                label="Kilometraje actual"
                value={kmText}
                onChangeText={(t) => setKmText(parseCOP(t) ? groupThousands(parseCOP(t)) : '')}
                keyboardType="number-pad"
                autoFocus
                maxLength={11}
              />
            </View>
            <Button label="Guardar" onPress={saveKm} loading={setKm.isPending} />
          </View>
        ) : null}
        <KmLine stations={line.stations} color={color} progressToNext={progressToOil} />
        <Text variant="caption" tone={line.kmToOil !== null && line.kmToOil <= 0 ? 'danger' : 'muted'}>
          {line.kmToOil === null
            ? 'Registra un cambio de aceite con su kilometraje para estimar el siguiente.'
            : line.kmToOil <= 0
              ? `El aceite se pasó por ${formatKm(-line.kmToOil)} (estimado cada ${formatKm(OIL_INTERVAL_KM[vehicle.kind])}).`
              : `Próximo aceite en ${formatKm(line.kmToOil)} (estimado cada ${formatKm(OIL_INTERVAL_KM[vehicle.kind])}).`}
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat label="Gasto del año" value={formatCOP(totalSpent(history, yearStart))} />
        <Stat label="Gasto total" value={formatCOP(totalSpent(history))} />
        <Stat label="Registros" value={String(history.length)} />
      </View>

      {types.length ? (
        <View style={styles.section}>
          <Text variant="title">En qué se va este año</Text>
          {types.map((t) => (
            <View key={t.type} accessible accessibilityLabel={`${RECORD_META[t.type].label}: ${formatCOP(t.total)}`} style={styles.barRow}>
              <View style={styles.barHead}>
                <MaterialCommunityIcons name={RECORD_META[t.type].icon} size={18} color={colors.inkMuted} />
                <Text variant="label" style={styles.flex}>
                  {RECORD_META[t.type].label}
                </Text>
                <Text variant="figure" style={styles.barValue}>
                  {formatCOP(t.total)}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
                <View style={[styles.fill, { width: `${(t.total / maxType) * 100}%`, backgroundColor: colors.trunk }]} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="title">Historial</Text>
        <Button
          label="Registrar gasto o mantenimiento"
          color={color}
          onPress={() => router.push({ pathname: '/garaje/registro/nuevo', params: { vehicle: vehicle.id } })}
        />
        {presentTypes.length > 1 ? (
          <View style={styles.wrapRow}>
            <Chip label="Todos" selected={filter === 'todos'} onPress={() => setFilter('todos')} />
            {presentTypes.map((t) => (
              <Chip key={t} label={RECORD_META[t].label} selected={filter === t} onPress={() => setFilter(t)} />
            ))}
          </View>
        ) : null}
        {shown.length === 0 ? (
          <Text tone="muted">{records.isPending ? 'Cargando…' : 'Todavía no hay registros.'}</Text>
        ) : (
          shown.map((r) => {
            const value = r.transaction
              ? formatCOP(r.transaction.amount)
              : r.transaction_id
                ? 'Valor privado'
                : 'Sin valor';
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`${r.title}, ${relativeDay(r.performed_on, today)}, ${value}, registró ${nameOf(r.created_by)}`}
                onPress={() => router.push({ pathname: '/garaje/registro/[id]', params: { id: r.id } })}
                style={({ pressed }) => [styles.recordRow, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={[styles.recordIcon, { backgroundColor: colors.surfaceMuted }]}>
                  <MaterialCommunityIcons name={RECORD_META[r.type].icon} size={20} color={colors.inkMuted} />
                  <View style={[styles.sign, { backgroundColor: colorOf(r.created_by), borderColor: colors.bg }]} />
                </View>
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {[relativeDay(r.performed_on, today), r.odometer_km !== null ? formatKm(r.odometer_km) : null, nameOf(r.created_by)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Text variant="figure" tone={r.transaction ? 'default' : 'subtle'} style={styles.recordValue}>
                  {value}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      <View style={styles.footer}>
        <Button label="Archivar vehículo" variant="outline" onPress={confirmArchive} loading={archive.isPending} />
        {vehicle.owner_id === userId ? (
          <Button label="Borrar vehículo" variant="text" onPress={confirmDelete} loading={remove.isPending} />
        ) : null}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="figure" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerButton: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  kindIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  kmEdit: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
  section: { gap: space.md, marginTop: space.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  barRow: { gap: space.xs + 2 },
  barHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barValue: { fontSize: 14 },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  recordIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sign: { position: 'absolute', right: -3, bottom: -3, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  recordValue: { fontSize: 14 },
  footer: { gap: space.sm, marginTop: space.lg },
});
