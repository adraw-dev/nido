import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
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
  HueSlider,
  Screen,
  TRUNK_HUE,
  Text,
  accents,
  hueAccent,
  hueColor,
  hueOf,
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
  const myHue = me ? hueOf(me.profile.accent) : null;
  const myAccent: AccentKey | undefined =
    me && myHue === null
      ? isAccentKey(me.profile.accent)
        ? me.profile.accent
        : ACCENT_KEYS[myIndex % ACCENT_KEYS.length]
      : undefined;
  // Color propio: la barra de tonos se abre al tocar el último círculo.
  const [customOpen, setCustomOpen] = useState(false);
  const [previewHue, setPreviewHue] = useState<number | null>(null);
  const showCustom = customOpen || myHue !== null;
  const customHue = previewHue ?? myHue ?? 20;
  const customHex = hueColor(customHue, scheme);
  const nearTrunk = Math.abs(((customHue - TRUNK_HUE + 540) % 360) - 180) < 18;
  const customUsedBy = lines.find((l) => l.user_id !== userId && l.color === customHex);

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
                  setCustomOpen(false);
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
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: myHue !== null, busy: updateAccent.isPending }}
            accessibilityLabel="Color personalizado"
            disabled={updateAccent.isPending}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setCustomOpen(true);
            }}
            style={[styles.swatchHit, myHue !== null && { borderColor: colors.ink }]}
          >
            <View
              style={[
                styles.swatch,
                myHue !== null
                  ? { backgroundColor: customHex }
                  : { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.rule },
              ]}
            >
              <MaterialCommunityIcons
                name={myHue !== null ? 'check' : 'palette-outline'}
                size={22}
                color={myHue !== null ? inkOn(customHex) : colors.ink}
              />
            </View>
          </Pressable>
        </View>
        {showCustom ? (
          <View style={styles.custom}>
            <View style={styles.customHead}>
              <View style={[styles.customPreview, { backgroundColor: customHex }]} />
              <Text variant="bodyStrong" style={styles.flex}>
                Tu propio color
              </Text>
            </View>
            <HueSlider
              value={customHue}
              onChange={setPreviewHue}
              onCommit={(h) => {
                setPreviewHue(h);
                Haptics.selectionAsync().catch(() => {});
                updateAccent.mutate(hueAccent(h), { onSettled: () => setPreviewHue(null) });
              }}
              disabled={updateAccent.isPending}
              accessibilityLabel="Tono de tu color de línea"
            />
            <Text variant="caption" tone={nearTrunk || customUsedBy ? 'danger' : 'muted'}>
              {nearTrunk
                ? 'Se parece al azul del tronco, el color de lo compartido. Mejor elige otro tono.'
                : customUsedBy
                  ? `Es el mismo color de ${customUsedBy.firstName}.`
                  : 'Desliza para elegir el tono; se guarda al soltar.'}
            </Text>
          </View>
        ) : null}
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

      <Button label="Recordatorios" variant="outline" onPress={() => router.push('/recordatorios')} />

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
  custom: {
    gap: space.sm,
    marginTop: space.sm,
  },
  customHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  customPreview: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
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
