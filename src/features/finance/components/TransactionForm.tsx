import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useUserId } from '@/features/session/SessionProvider';
import { addDaysKey, fromKey, todayKey, type DateKey } from '@/lib/dates';
import { groupThousands, parseCOP } from '@/lib/money';
import { Button, Chip, Screen, SegmentedControl, Text, TextField, fonts, radius, space, useTheme, useRevealFocused } from '@/ui';

import { sortCategories, useCategories, useGoals } from '../hooks';
import { categoryIcon, type Scope, type Transaction, type TransactionInput, type TxKind } from '../types';

export type TransactionFormProps = {
  householdId: string;
  initial?: Transaction;
  defaults?: { kind?: TxKind; scope?: Scope; goalId?: string | null; withdraw?: boolean };
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: TransactionInput) => void;
  /** Botón extra al pie (por ejemplo, borrar). */
  footerExtra?: React.ReactNode;
};

export function TransactionForm({ householdId, initial, defaults, submitting, error, onSubmit, footerExtra }: TransactionFormProps) {
  const { colors } = useTheme();
  const userId = useUserId();
  const revealFocused = useRevealFocused();
  const today = todayKey();
  const categories = useCategories(householdId);
  const goals = useGoals(householdId);

  const initialAmount = initial ? Number(initial.amount) : 0;
  const [kind, setKind] = useState<TxKind>(initial?.kind ?? defaults?.kind ?? 'expense');
  const [amountText, setAmountText] = useState(initialAmount ? groupThousands(initialAmount) : '');
  const [withdraw, setWithdraw] = useState(initial ? initialAmount < 0 : !!defaults?.withdraw);
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [goalId, setGoalId] = useState<string | null>(initial?.goal_id ?? defaults?.goalId ?? null);
  const [day, setDay] = useState<DateKey>(initial?.occurred_on ?? today);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [scope, setScope] = useState<Scope>(
    initial ? (initial.visibility === 'shared' ? 'hogar' : 'personal') : (defaults?.scope ?? 'hogar'),
  );
  const [amountError, setAmountError] = useState<string | null>(null);

  // Solo quien registró el movimiento puede volverlo personal (la base de datos lo exige).
  const canChangeScope = !initial || initial.owner_id === userId;
  const kindCategories = useMemo(
    () => sortCategories((categories.data ?? []).filter((c) => c.kind === kind)),
    [categories.data, kind],
  );
  const activeGoals = goals.progress.filter((g) => !g.achieved || g.goal.id === goalId);

  const days = useMemo(() => {
    const list = Array.from({ length: 31 }, (_, i) => addDaysKey(today, -i));
    if (initial && !list.includes(initial.occurred_on)) list.push(initial.occurred_on);
    return list;
  }, [today, initial]);
  const dayLabel = (d: DateKey) =>
    d === today ? 'Hoy' : d === addDaysKey(today, -1) ? 'Ayer' : format(fromKey(d), 'EEE d MMM', { locale: es });

  function changeKind(next: TxKind) {
    setKind(next);
    setCategoryId(null);
  }

  function submit() {
    const amount = parseCOP(amountText);
    if (amount <= 0) {
      setAmountError('Escribe el valor.');
      return;
    }
    setAmountError(null);
    // Sin categoría elegida: "Otros" del tipo (ingresos y gastos).
    const fallback = kindCategories.find((c) => c.name === 'Otros')?.id ?? null;
    onSubmit({
      kind,
      amount: kind === 'saving' && withdraw ? -amount : amount,
      category_id: kind === 'saving' ? null : (categoryId ?? fallback),
      goal_id: kind === 'saving' ? goalId : null,
      occurred_on: day,
      description: description.trim() || null,
      visibility: scope === 'hogar' ? 'shared' : 'personal',
    });
  }

  return (
    <Screen
      scroll
      edges={['bottom']}
      footer={
        <>
          {error ? (
            <Text tone="danger" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Button label="Guardar" onPress={submit} loading={submitting} />
          {footerExtra}
        </>
      }
    >
      <SegmentedControl<TxKind>
        value={kind}
        onChange={changeKind}
        segments={[
          { value: 'expense', label: 'Gasto' },
          { value: 'income', label: 'Ingreso' },
          { value: 'saving', label: 'Ahorro' },
        ]}
      />

      <View style={styles.amountBlock}>
        <View style={[styles.amountRow, { borderBottomColor: amountError ? colors.danger : colors.ink }]}>
          <Text style={[styles.currency, { color: colors.inkMuted }]}>{kind === 'saving' && withdraw ? '−$' : '$'}</Text>
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
            autoFocus={!initial}
            maxLength={17}
            selectionColor={colors.trunk}
            style={[styles.amountInput, { color: colors.ink }]}
          />
        </View>
        {amountError ? (
          <Text variant="caption" tone="danger">
            {amountError}
          </Text>
        ) : null}
      </View>

      {kind === 'saving' ? (
        <>
          <View style={styles.wrapRow}>
            <Chip label="Aporte" selected={!withdraw} onPress={() => setWithdraw(false)} />
            <Chip label="Retiro" selected={withdraw} onPress={() => setWithdraw(true)} />
          </View>
          <Field label="Meta">
            {activeGoals.length ? (
              <View style={styles.wrapRow}>
                <Chip label="Sin meta" selected={goalId === null} onPress={() => setGoalId(null)} />
                {activeGoals.map((g) => (
                  <Chip key={g.goal.id} label={g.goal.name} selected={goalId === g.goal.id} onPress={() => setGoalId(g.goal.id)} />
                ))}
              </View>
            ) : (
              <Text variant="caption" tone="muted">
                Aún no hay metas. Puedes crearlas en Dinero → Metas.
              </Text>
            )}
          </Field>
        </>
      ) : (
        <Field label="Categoría">
          <View style={styles.categories}>
            {kindCategories.map((c) => {
              const selected = categoryId === c.id;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={c.name}
                  onPress={() => setCategoryId(selected ? null : c.id)}
                  style={[
                    styles.category,
                    {
                      borderColor: selected ? colors.ink : colors.rule,
                      backgroundColor: selected ? colors.ink : colors.surface,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={categoryIcon(c.icon, c.kind)}
                    size={22}
                    color={selected ? colors.bg : colors.inkMuted}
                  />
                  <Text variant="caption" color={selected ? colors.bg : colors.ink} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      )}

      <Field label="Fecha">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {days.map((d) => (
            <Chip key={d} label={dayLabel(d)} selected={day === d} onPress={() => setDay(d)} />
          ))}
        </ScrollView>
      </Field>

      {canChangeScope ? (
        <Field label="De quién es">
          <SegmentedControl<Scope>
            value={scope}
            onChange={setScope}
            segments={[
              { value: 'hogar', label: 'Del hogar' },
              { value: 'personal', label: 'Solo mío' },
            ]}
          />
          <Text variant="caption" tone="muted">
            {scope === 'hogar' ? 'Tu pareja lo verá en las finanzas del hogar.' : 'Solo tú lo verás.'}
          </Text>
        </Field>
      ) : null}

      <TextField label="Nota (opcional)" placeholder="Mercado del mes" value={description} onChangeText={setDescription} maxLength={120} />
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  amountBlock: { gap: space.xs, paddingVertical: space.sm },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    gap: space.sm,
  },
  currency: {
    fontFamily: fonts.display,
    fontSize: 32,
  },
  amountInput: {
    flex: 1,
    fontFamily: fonts.displayHeavy,
    fontSize: 44,
    paddingVertical: space.sm,
    fontVariant: ['tabular-nums'],
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  category: {
    width: '23%',
    flexGrow: 1,
    minHeight: 64,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: space.xs,
  },
});
