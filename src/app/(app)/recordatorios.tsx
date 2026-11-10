import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';

import { useSavePrefs, usePrefs, DEFAULT_PREFS, type NotificationPrefs } from '@/features/notifications/prefs';
import { countScheduled, getPermission, requestPermission, sendTest } from '@/features/notifications/scheduler';
import { Button, Chip, Screen, Text, radius, space, useTheme } from '@/ui';

const LEADS: { value: NotificationPrefs['taskLeadMin']; label: string }[] = [
  { value: 0, label: 'A la hora' },
  { value: 10, label: '10 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1 h antes' },
];

export default function RemindersScreen() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const prefs = usePrefs();
  const save = useSavePrefs();
  const [testing, setTesting] = useState(false);

  const permission = useQuery({ queryKey: ['notification-permission'], queryFn: getPermission });
  const scheduled = useQuery({ queryKey: ['notification-count'], queryFn: countScheduled, refetchInterval: 4000 });
  const p = prefs.data ?? DEFAULT_PREFS;
  const granted = permission.data === 'granted';

  function update(patch: Partial<NotificationPrefs>) {
    save.mutate({ ...p, ...patch });
  }

  async function activate() {
    const ok = await requestPermission();
    await qc.invalidateQueries({ queryKey: ['notification-permission'] });
    if (ok) {
      // Fuerza a reagendar con el permiso nuevo.
      await qc.invalidateQueries({ queryKey: ['notification-prefs'] });
    } else {
      Alert.alert(
        'Notificaciones bloqueadas',
        'Actívalas en los ajustes del celular para esta app.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
        ],
      );
    }
  }

  async function test() {
    setTesting(true);
    try {
      await sendTest();
      Alert.alert('Aviso en camino', 'Llega en unos 5 segundos. Puedes bloquear el celular para verlo.');
    } catch (e) {
      Alert.alert('No se pudo enviar', String((e as Error)?.message ?? e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Screen scroll edges={['bottom']}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: granted ? colors.rule : colors.trunk }]}>
        <Text variant="title">{granted ? 'Notificaciones activas' : 'Notificaciones apagadas'}</Text>
        <Text tone="muted">
          {granted
            ? `Este celular tiene ${scheduled.data ?? 0} recordatorios agendados. Se actualizan solos cuando cambian tus tareas y hábitos.`
            : 'Nido necesita permiso para avisarte de tus tareas y hábitos.'}
        </Text>
        {granted ? (
          <Button label="Enviar aviso de prueba" variant="outline" onPress={test} loading={testing} />
        ) : (
          <Button label="Activar notificaciones" onPress={activate} />
        )}
      </View>

      <View style={styles.section}>
        <Row
          title="Tareas con hora"
          caption="Tus tareas y las compartidas que tienen hora, de los próximos 7 días."
          value={p.tasks}
          onChange={(tasks) => update({ tasks })}
        />
        {p.tasks ? (
          <View style={styles.wrapRow}>
            {LEADS.map((l) => (
              <Chip key={l.value} label={l.label} selected={p.taskLeadMin === l.value} onPress={() => update({ taskLeadMin: l.value })} />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Row
          title="Hábitos"
          caption="Los tuyos que tienen hora de recordatorio, solo los días que tocan. La hora se pone al editar el hábito."
          value={p.habits}
          onChange={(habits) => update({ habits })}
        />
      </View>

      <View style={[styles.note, { backgroundColor: colors.surfaceMuted }]}>
        <Text variant="label">Avisos de tu pareja</Text>
        <Text variant="caption" tone="muted">
          “Completó Sacar la basura” y avisos parecidos llegan por internet (push). Expo Go en Android no los permite:
          funcionarán con la app instalada (APK).
        </Text>
      </View>
    </Screen>
  );
}

function Row({
  title,
  caption,
  value,
  onChange,
}: {
  title: string;
  caption: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="muted">
          {caption}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={title}
        trackColor={{ true: colors.trunk, false: colors.rule }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1.5, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  section: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note: { borderRadius: radius.md, padding: space.md, gap: space.xs },
});
