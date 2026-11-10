import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useUserId } from '@/features/session/SessionProvider';
import { addDaysKey, fromKey, todayKey, type DateKey } from '@/lib/dates';
import { groupThousands, parseCOP } from '@/lib/money';
import { Button, Chip, Screen, Text, TextField, fonts, radius, space, useTheme, useRevealFocused } from '@/ui';

import { RECORD_META, RECORD_TYPES, type RecordInput, type RecordType, type Vehicle, type VehicleRecord } from '../types';

export type RecordFormProps = {
  vehicles: Vehicle[];
  initial?: VehicleRecord;
  defaultVehicleId?: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: RecordInput, vehicle: Vehicle) => void;
  footerExtra?: React.ReactNode;
};

export function RecordForm({ vehicles, initial, defaultVehicleId, submitting, error, onSubmit, footerExtra }: RecordFormProps) {
  const { colors } = useTheme();
  const userId = useUserId();
  const revealFocused = useRevealFocused();
  const today = todayKey();

  const [vehicleId, setVehicleId] = useState(initial?.vehicle_id ?? defaultVehicleId ?? vehicles[0]?.id);
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const [type, setType] = useState<RecordType>(initial?.type ?? 'combustible');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [titleTouched, setTitleTouched] = useState(!!initial);
  const hiddenValue = !!initial?.transaction_id && !initial.transaction;
  const [amountText, setAmountText] = useState(initial?.transaction ? groupThousands(initial.transaction.amount) : '');
  const [day, setDay] = useState<DateKey>(initial?.performed_on ?? today);
  const [kmText, setKmText] = useState(
    initial ? (initial.odometer_km !== null ? groupThousands(initial.odometer_km) : '') : vehicle ? groupThousands(vehicle.odometer_km) : '',
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [shared, setShared] = useState(
    initial?.transaction ? initial.transaction.visibility === 'shared' : (vehicle?.visibility ?? 'shared') === 'shared',
  );
  const [titleError, setTitleError] = useState<string | null>(null);

  const canChangeScope = !initial?.transaction || initial.transaction.owner_id === userId;
  const days = useMemo(() => {
    const list = Array.from({ length: 31 }, (_, i) => addDaysKey(today, -i));
    if (initial && !list.includes(initial.performed_on)) list.push(initial.performed_on);
    return list;
  }, [today, initial]);
  const dayLabel = (d: DateKey) =>
    d === today ? 'Hoy' : d === addDaysKey(today, -1) ? 'Ayer' : format(fromKey(d), 'EEE d MMM', { locale: es });

  function chooseType(next: RecordType) {
    setType(next);
    if (!titleTouched) setTitle('');
  }

  function chooseVehicle(id: string) {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (!initial && v) {
      setKmText(groupThousands(v.odometer_km));
      setShared(v.visibility === 'shared');
    }
  }

  function submit() {
    if (!vehicle) return;
    const finalTitle = (title.trim() || RECORD_META[type].label).slice(0, 80);
    if (!finalTitle) {
      setTitleError('Escribe el concepto.');
      return;
    }
    setTitleError(null);
    const km = parseCOP(kmText);
    const amount = parseCOP(amountText);
    onSubmit(
      {
        vehicleId: vehicle.id,
        type,
        title: finalTitle,
        amount: hiddenValue ? null : amount > 0 ? amount : null,
        performedOn: day,
        odometerKm: kmText.trim() ? km : null,
        notes: notes.trim() || null,
        visibility: shared ? 'shared' : 'personal',
      },
      vehicle,
    );
  }

  return (
    <Screen
      scroll
      edges={['bottom']}
      footer={
        <>
          {error ? <Text tone="danger">{error}</Text> : null}
          <Button label="Guardar" onPress={submit} loading={submitting} disabled={!vehicle} />
          {footerExtra}
        </>
      }
    >
      {vehicles.length > 1 && !initial ? (
        <View style={styles.wrapRow}>
          {vehicles.map((v) => (
            <Chip key={v.id} label={v.nickname} selected={vehicleId === v.id} onPress={() => chooseVehicle(v.id)} />
          ))}
        </View>
      ) : vehicle ? (
        <Text variant="title">{vehicle.nickname}</Text>
      ) : null}

      <View style={styles.types}>
        {RECORD_TYPES.map((r) => {
          const selected = r.type === type;
          return (
            <Pressable
              key={r.type}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={r.label}
              onPress={() => chooseType(r.type)}
              style={[
                styles.type,
                { borderColor: selected ? colors.ink : colors.rule, backgroundColor: selected ? colors.ink : colors.surface },
              ]}
            >
              <MaterialCommunityIcons name={r.icon} size={22} color={selected ? colors.bg : colors.inkMuted} />
              <Text variant="caption" color={selected ? colors.bg : colors.ink} numberOfLines={1}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label="Concepto"
        placeholder={RECORD_META[type].label}
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          setTitleTouched(true);
        }}
        error={titleError}
        maxLength={80}
        hint="Si lo dejas vacío, se usa el tipo."
      />

      <View style={styles.field}>
        <Text variant="label" tone="muted">
          Valor (opcional)
        </Text>
        {hiddenValue ? (
          <Text tone="muted">El valor es privado de quien lo registró.</Text>
        ) : (
          <View style={[styles.amountRow, { borderBottomColor: colors.ink }]}>
            <Text style={[styles.currency, { color: colors.inkMuted }]}>$</Text>
            <TextInput
              accessibilityLabel="Valor en pesos"
            onFocus={revealFocused}
              value={amountText}
              onChangeText={(t) => {
                const n = parseCOP(t);
                setAmountText(n ? groupThousands(n) : '');
              }}
              placeholder="0"
              placeholderTextColor={colors.inkSubtle}
              keyboardType="number-pad"
              maxLength={17}
              selectionColor={colors.trunk}
              style={[styles.amountInput, { color: colors.ink }]}
            />
          </View>
        )}
        {!hiddenValue ? (
          <Text variant="caption" tone="muted">
            Con valor, queda también como gasto en Dinero (categoría Vehículos), una sola vez.
          </Text>
        ) : null}
      </View>

      {parseCOP(amountText) > 0 && canChangeScope && !hiddenValue ? (
        <View style={styles.wrapRow}>
          <Chip label="Gasto del hogar" selected={shared} onPress={() => setShared(true)} />
          <Chip label="Gasto solo mío" selected={!shared} onPress={() => setShared(false)} />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text variant="label" tone="muted">
          Fecha
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {days.map((d) => (
            <Chip key={d} label={dayLabel(d)} selected={day === d} onPress={() => setDay(d)} />
          ))}
        </ScrollView>
      </View>

      <TextField
        label="Kilometraje (opcional)"
        value={kmText}
        onChangeText={(t) => {
          const n = parseCOP(t);
          setKmText(n ? groupThousands(n) : t.trim() === '' ? '' : '0');
        }}
        keyboardType="number-pad"
        maxLength={11}
        hint={vehicle ? `Actual: ${groupThousands(vehicle.odometer_km)} km. Si es mayor, el vehículo se actualiza.` : undefined}
      />

      <TextField label="Notas (opcional)" value={notes} onChangeText={setNotes} multiline style={styles.notes} textAlignVertical="top" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  type: {
    width: '30%',
    flexGrow: 1,
    minHeight: 60,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: space.xs,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, gap: space.sm },
  currency: { fontFamily: fonts.display, fontSize: 28 },
  amountInput: { flex: 1, fontFamily: fonts.displayHeavy, fontSize: 36, paddingVertical: space.sm, fontVariant: ['tabular-nums'] },
  notes: { minHeight: 80 },
});
