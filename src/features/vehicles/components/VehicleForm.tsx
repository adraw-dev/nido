import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useUserId } from '@/features/session/SessionProvider';
import { groupThousands, parseCOP } from '@/lib/money';
import { Button, Chip, Screen, SegmentedControl, Text, TextField, space } from '@/ui';

import type { Vehicle, VehicleInput, VehicleKind } from '../types';

const schema = z.object({
  nickname: z.string().trim().min(1, 'Ponle un nombre.').max(40, 'Máximo 40 caracteres.'),
  year: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{4}$/.test(v) && Number(v) >= 1950 && Number(v) <= 2100), 'Año entre 1950 y 2100.'),
});

export type VehicleFormProps = {
  initial?: Vehicle;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: VehicleInput) => void;
};

export function VehicleForm({ initial, submitLabel, submitting, error, onSubmit }: VehicleFormProps) {
  const userId = useUserId();
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [kind, setKind] = useState<VehicleKind>(initial?.kind ?? 'moto');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '');
  const [plate, setPlate] = useState(initial?.plate ?? '');
  const [km, setKm] = useState(initial ? groupThousands(initial.odometer_km) : '');
  const [shared, setShared] = useState(initial ? initial.visibility === 'shared' : true);
  const [errors, setErrors] = useState<{ nickname?: string; year?: string }>({});
  const canChangeScope = !initial || initial.owner_id === userId;

  function submit() {
    const parsed = schema.safeParse({ nickname, year });
    if (!parsed.success) {
      const out: { nickname?: string; year?: string } = {};
      for (const i of parsed.error.issues) out[i.path[0] as 'nickname' | 'year'] ??= i.message;
      setErrors(out);
      return;
    }
    setErrors({});
    onSubmit({
      nickname: parsed.data.nickname,
      kind,
      brand: brand.trim() || null,
      model: model.trim() || null,
      year: year.trim() ? Number(year) : null,
      plate: plate.trim().toUpperCase().replace(/\s+/g, '') || null,
      odometer_km: parseCOP(km),
      visibility: shared ? 'shared' : 'personal',
    });
  }

  return (
    <Screen
      scroll
      edges={['bottom']}
      footer={
        <>
          {error ? <Text tone="danger">{error}</Text> : null}
          <Button label={submitLabel} onPress={submit} loading={submitting} />
        </>
      }
    >
      <SegmentedControl<VehicleKind>
        value={kind}
        onChange={setKind}
        segments={[
          { value: 'moto', label: 'Moto' },
          { value: 'carro', label: 'Carro' },
        ]}
      />
      <TextField
        label="Apodo"
        placeholder={kind === 'moto' ? 'La Himalayan' : 'El Mazda'}
        value={nickname}
        onChangeText={setNickname}
        error={errors.nickname}
        maxLength={40}
        autoFocus={!initial}
        autoCapitalize="words"
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label="Marca" value={brand} onChangeText={setBrand} maxLength={30} autoCapitalize="words" />
        </View>
        <View style={styles.flex}>
          <TextField label="Modelo" value={model} onChangeText={setModel} maxLength={30} autoCapitalize="words" />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label="Año" value={year} onChangeText={setYear} error={errors.year} keyboardType="number-pad" maxLength={4} />
        </View>
        <View style={styles.flex}>
          <TextField label="Placa" placeholder="ABC12D" value={plate} onChangeText={setPlate} autoCapitalize="characters" autoCorrect={false} maxLength={8} />
        </View>
      </View>
      <TextField
        label="Kilometraje actual"
        value={km}
        onChangeText={(t) => {
          const n = parseCOP(t);
          setKm(n ? groupThousands(n) : '');
        }}
        keyboardType="number-pad"
        hint="Sube solo cuando registras un mantenimiento con más km."
        maxLength={11}
      />
      {canChangeScope ? (
        <View style={styles.field}>
          <Text variant="label" tone="muted">
            De quién es
          </Text>
          <View style={styles.wrapRow}>
            <Chip label="Del hogar" selected={shared} onPress={() => setShared(true)} />
            <Chip label="Solo mío" selected={!shared} onPress={() => setShared(false)} />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.md },
  field: { gap: space.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
