import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { householdErrorMessage } from '@/features/household/api';
import { useCreateHousehold, useJoinHousehold } from '@/features/household/hooks';
import { signOut } from '@/features/session/api';
import { useSession } from '@/features/session/SessionProvider';
import { Button, LinePlate, Screen, Text, TextField, radius, space, useTheme } from '@/ui';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { session } = useSession();
  const firstName = String(session?.user.user_metadata?.display_name ?? '').split(' ')[0];

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const create = useCreateHousehold();
  const join = useJoinHousehold();
  const busy = create.isPending || join.isPending;

  function submitCreate() {
    const value = name.trim();
    if (!value) {
      setNameError('Ponle un nombre al hogar.');
      return;
    }
    setNameError(null);
    create.mutate(value, { onError: (e) => setNameError(householdErrorMessage(e)) });
  }

  function submitJoin() {
    const value = code.trim().toUpperCase();
    if (value.length !== 8) {
      setCodeError('El código tiene 8 caracteres.');
      return;
    }
    setCodeError(null);
    join.mutate(value, { onError: (e) => setCodeError(householdErrorMessage(e)) });
  }

  return (
    <Screen scroll footer={<Button label="Cerrar sesión" variant="text" onPress={() => signOut()} disabled={busy} />}>
      <View style={styles.header}>
        <Text variant="headline">{firstName ? `Hola, ${firstName}` : 'Hola'}</Text>
        <Text tone="muted">
          Para empezar, crea el hogar o únete al de tu pareja con el código que te comparta.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
        <LinePlate label="Nuevo hogar" color={colors.trunk} />
        <TextField
          label="Nombre del hogar"
          placeholder="Nuestra casa"
          value={name}
          onChangeText={setName}
          error={nameError}
          maxLength={60}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={submitCreate}
        />
        <Button label="Crear hogar" onPress={submitCreate} loading={create.isPending} disabled={busy} />
      </View>

      <View style={styles.divider}>
        <View style={[styles.rule, { backgroundColor: colors.rule }]} />
        <Text variant="label" tone="subtle">
          o
        </Text>
        <View style={[styles.rule, { backgroundColor: colors.rule }]} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
        <LinePlate label="Unirme" color={colors.ink} />
        <TextField
          label="Código de invitación"
          placeholder="A1B2C3D4"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          error={codeError}
          hint="Lo genera tu pareja en Hogar → Invitar."
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          returnKeyType="go"
          onSubmitEditing={submitJoin}
          style={styles.code}
        />
        <Button label="Unirme al hogar" variant="tonal" onPress={submitJoin} loading={join.isPending} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space.sm,
    paddingTop: space.xl,
  },
  card: {
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  rule: {
    flex: 1,
    height: 1,
  },
  code: {
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
});
