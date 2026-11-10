import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { householdErrorMessage } from '@/features/household/api';
import {
  useCreateInvite,
  useCurrentHousehold,
  useMemberLines,
  useUpdateAccent,
} from '@/features/household/hooks';
import { signOut } from '@/features/session/api';
import { useUserId } from '@/features/session/SessionProvider';
import {
  ACCENT_KEYS,
  Avatar,
  Button,
  Screen,
  Text,
  accents,
  inkOn,
  isAccentKey,
  radius,
  space,
  touchTarget,
  useTheme,
  type AccentKey,
} from '@/ui';

export default function HouseholdScreen() {
  const { colors, scheme } = useTheme();
  const userId = useUserId();
  const { household } = useCurrentHousehold();
  const { lines } = useMemberLines(household.id);
  const updateAccent = useUpdateAccent(household.id);
  const invite = useCreateInvite();
  const [copied, setCopied] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const myIndex = lines.findIndex((l) => l.user_id === userId);
  const me = lines[myIndex];
  const myAccent: AccentKey | undefined = me
    ? isAccentKey(me.profile.accent)
      ? me.profile.accent
      : ACCENT_KEYS[myIndex % ACCENT_KEYS.length]
    : undefined;

  async function copyCode(code: string) {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen scroll edges={['bottom']}>
      <View style={styles.section}>
        <Text variant="headline">{household.name}</Text>
        <Text tone="muted">
          {lines.length === 1 ? '1 integrante' : `${lines.length} integrantes`}
        </Text>
      </View>

      {/* Integrantes */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
        {lines.map((m, i) => (
          <View
            key={m.user_id}
            style={[styles.member, i > 0 && { borderTopColor: colors.rule, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <View style={[styles.memberLine, { backgroundColor: m.color }]} />
            <Avatar name={m.profile.display_name} color={m.color} size={36} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {m.profile.display_name}
                {m.user_id === userId ? ' (tú)' : ''}
              </Text>
              <Text variant="caption" tone="subtle">
                {m.role === 'owner' ? 'Creó el hogar' : 'Integrante'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Mi color de línea */}
      <View style={styles.section}>
        <Text variant="title">Mi color de línea</Text>
        <Text variant="caption" tone="muted">
          Con este color firmas tus tareas, gastos y registros.
        </Text>
        <View style={styles.swatches} accessibilityRole="radiogroup">
          {ACCENT_KEYS.map((key) => {
            const hex = accents[key][scheme];
            const selected = key === myAccent;
            const usedBy = lines.find((l) => l.user_id !== userId && l.color === hex);
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, busy: updateAccent.isPending }}
                accessibilityLabel={`${accents[key].label}${usedBy ? `, lo usa ${usedBy.firstName}` : ''}`}
                disabled={updateAccent.isPending}
                onPress={() => {
                  if (selected) return;
                  Haptics.selectionAsync().catch(() => {});
                  updateAccent.mutate(key);
                }}
                style={[styles.swatchHit, selected && { borderColor: colors.ink }]}
              >
                <View style={[styles.swatch, { backgroundColor: hex }]}>
                  {selected ? <MaterialCommunityIcons name="check" size={22} color={inkOn(hex)} /> : null}
                  {usedBy && !selected ? (
                    <Text variant="caption" color={inkOn(hex)} style={styles.swatchInitial}>
                      {usedBy.firstName.charAt(0).toUpperCase()}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        {updateAccent.isError ? (
          <Text variant="caption" tone="danger">
            No se pudo guardar el color. Intenta de nuevo.
          </Text>
        ) : null}
      </View>

      {/* Invitar */}
      <View style={[styles.card, styles.cardPadded, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
        <Text variant="title">Invitar a alguien</Text>
        <Text variant="caption" tone="muted">
          El código sirve una sola vez y vence en 7 días.
        </Text>
        {invite.data ? (
          <View style={styles.codeRow}>
            <Text
              variant="figure"
              style={styles.code}
              selectable
              accessibilityLabel={`Código ${invite.data.code.split('').join(' ')}`}
            >
              {invite.data.code}
            </Text>
            <Button label={copied ? 'Copiado' : 'Copiar'} variant="tonal" onPress={() => copyCode(invite.data.code)} />
          </View>
        ) : null}
        {invite.data ? (
          <Text variant="caption" tone="subtle">
            Vence el {format(new Date(invite.data.expires_at), "d 'de' MMMM, h:mm a", { locale: es })}
          </Text>
        ) : null}
        {invite.isError ? (
          <Text variant="caption" tone="danger">
            {householdErrorMessage(invite.error)}
          </Text>
        ) : null}
        <Button
          label={invite.data ? 'Generar otro código' : 'Generar código'}
          variant={invite.data ? 'outline' : 'filled'}
          loading={invite.isPending}
          onPress={() => invite.mutate(household.id)}
        />
      </View>

      <Button
        label="Cerrar sesión"
        variant="outline"
        loading={signingOut}
        onPress={async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch {
            setSigningOut(false);
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: {
    gap: space.xs,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardPadded: {
    padding: space.lg,
    gap: space.md,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingRight: space.lg,
    minHeight: 64,
  },
  memberLine: {
    width: 6,
    alignSelf: 'stretch',
    marginVertical: -space.md,
    marginRight: space.xs,
  },
  swatches: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
    flexWrap: 'wrap',
  },
  swatchHit: {
    width: touchTarget + 6,
    height: touchTarget + 6,
    borderRadius: radius.pill,
    borderWidth: 2.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: touchTarget - 4,
    height: touchTarget - 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchInitial: {
    fontFamily: 'Roboto_700Bold',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  code: {
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 4,
  },
});
