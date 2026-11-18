import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { fetchTransactions, financeErrorMessage, readScreenshot } from '@/features/finance/api';
import { AmountInput, CategoryGrid, Field } from '@/features/finance/components/FormBits';
import { sortCategories, useCategories, useImportTransactions } from '@/features/finance/hooks';
import {
  buildDrafts,
  parseBankDate,
  saveKey,
  suggestCategory,
  type Draft,
  type ExistingTx,
  type ReadMovement,
} from '@/features/finance/import/parse';
import type { Scope, TxKind } from '@/features/finance/types';
import { useCurrentHousehold } from '@/features/household/hooks';
import { addDaysKey, relativeDay } from '@/lib/dates';
import { formatCOP, groupThousands, parseCOP } from '@/lib/money';
import { useToday } from '@/lib/useToday';
import { Button, DateField, Screen, SegmentedControl, Text, TextField, radius, space, useTheme } from '@/ui';

type Phase = 'elegir' | 'leyendo' | 'revisar' | 'listo';

const MAX_IMAGES = 5;

export default function ImportScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const { household } = useCurrentHousehold();
  const categories = useCategories(household.id);
  const save = useImportTransactions(household.id);

  const [phase, setPhase] = useState<Phase>('elegir');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [problems, setProblems] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  // Lo leído de cada captura: al agregar otra se vuelve a armar la lista sin perder lo corregido.
  const [readImages, setReadImages] = useState<ReadMovement[][]>([]);
  const [history, setHistory] = useState<ExistingTx[]>([]);
  // Lo usual es que lo importado sea del hogar; "Solo mío" queda a un toque.
  const [scope, setScope] = useState<Scope>('hogar');
  const [openId, setOpenId] = useState<string | null>(null);
  const [saved, setSaved] = useState({ added: 0, tried: 0 });

  const chosen = drafts.filter((d) => d.include);
  const totals = { expense: 0, income: 0 };
  for (const d of chosen) totals[d.kind === 'expense' ? 'expense' : 'income'] += d.amount;

  async function pick(append = false) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets.length) return;

    const assets = result.assets.slice(0, MAX_IMAGES);
    const issues: string[] = [];
    const fresh: ReadMovement[][] = [];
    setProblems([]);
    setPhase('leyendo');
    for (const [i, asset] of assets.entries()) {
      setProgress({ done: i, total: assets.length });
      const label = assets.length > 1 ? `Captura ${i + 1}: ` : '';
      if (!asset.base64) {
        issues.push(`${label}no se pudo abrir la imagen.`);
        continue;
      }
      try {
        const read = await readScreenshot(asset.base64, asset.mimeType ?? 'image/jpeg');
        if (!read.length) issues.push(`${label}no se encontraron movimientos.`);
        fresh.push(read);
      } catch (e) {
        issues.push(`${label}${e instanceof Error ? e.message : 'no se pudo leer.'}`);
      }
    }

    if (!fresh.flat().length) {
      setProblems(issues);
      setPhase(append ? 'revisar' : 'elegir');
      return;
    }
    const images = append ? [...readImages, ...fresh] : fresh;
    const all = images.flat();

    // Lo ya guardado en esas fechas (duplicados) y en los 6 meses anteriores (categorías que sueles usar).
    const days = all
      .map((r) => parseBankDate(r.date_text, today))
      .filter((d): d is string => !!d)
      .sort();
    let existing: ExistingTx[] = [];
    try {
      existing = await fetchTransactions(household.id, addDaysKey(days[0] ?? today, -180), days.at(-1) ?? today);
    } catch {
      issues.push('No se pudo revisar qué ya estaba registrado; revisa los duplicados a mano.');
    }
    setHistory(existing);
    setReadImages(images);
    const built = buildDrafts(images, today, categories.data ?? [], existing);
    // Las filas que ya estaban conservan lo que corregiste (mismo id = misma captura y posición).
    const before = new Map(append ? drafts.map((d) => [d.id, d] as const) : []);
    setDrafts(built.map((d) => before.get(d.id) ?? d));
    setProblems(issues);
    setOpenId(null);
    setPhase('revisar');
  }

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((list) =>
      list.map((d) => {
        if (d.id !== id) return d;
        const next = { ...d, ...patch };
        // Al cambiar el tipo, la categoría anterior ya no sirve.
        if (patch.kind && patch.kind !== d.kind)
          next.categoryId = suggestCategory(next.description, next.kind, categories.data ?? [], history);
        // Lo que había que revisar queda listo cuando ya tiene fecha y valor.
        if (d.status === 'revisar' && !('include' in patch) && next.date && next.amount > 0) {
          next.status = 'nuevo';
          next.note = null;
        }
        return next;
      }),
    );
  }

  function toggle(d: Draft) {
    if (!d.include && (!d.date || d.amount <= 0)) {
      setOpenId(d.id); // falta algo: se abre para completarlo
      return;
    }
    update(d.id, { include: !d.include });
  }

  function submit() {
    const others = (kind: TxKind) => (categories.data ?? []).find((c) => c.kind === kind && c.name === 'Otros')?.id ?? null;
    const rows = chosen
      .filter((d) => d.date && d.amount > 0)
      .map((d) => ({
        kind: d.kind,
        amount: d.amount,
        category_id: d.categoryId ?? others(d.kind),
        goal_id: null,
        occurred_on: d.date!,
        description: d.description || null,
        visibility: scope === 'hogar' ? ('shared' as const) : ('personal' as const),
        import_key: saveKey(d),
      }));
    save.mutate(rows, {
      onSuccess: (added) => {
        setSaved({ added, tried: rows.length });
        setPhase('listo');
      },
    });
  }

  if (phase === 'leyendo') {
    return (
      <Screen edges={['bottom']} contentStyle={styles.center}>
        <ActivityIndicator size="large" color={colors.trunk} />
        <Text variant="title" accessibilityLiveRegion="polite">
          {progress.total > 1 ? `Leyendo captura ${progress.done + 1} de ${progress.total}…` : 'Leyendo la captura…'}
        </Text>
        <Text tone="muted" style={styles.centerText}>
          Toma unos segundos por imagen.
        </Text>
      </Screen>
    );
  }

  if (phase === 'listo') {
    const skipped = saved.tried - saved.added;
    return (
      <Screen edges={['bottom']} contentStyle={styles.center} footer={<Button label="Listo" onPress={() => router.back()} />}>
        <MaterialCommunityIcons name="check-circle" size={56} color={colors.trunk} />
        <Text variant="headline" style={styles.centerText}>
          {saved.added === 1 ? 'Se guardó 1 movimiento' : `Se guardaron ${saved.added} movimientos`}
        </Text>
        {skipped > 0 ? (
          <Text tone="muted" style={styles.centerText}>
            {skipped === 1 ? '1 ya estaba registrado' : `${skipped} ya estaban registrados`} y no se duplicó.
          </Text>
        ) : null}
      </Screen>
    );
  }

  if (phase === 'elegir') {
    return (
      <Screen scroll edges={['bottom']} footer={<Button label="Elegir capturas" onPress={() => pick()} />}>
        <View style={styles.intro}>
          <MaterialCommunityIcons name="image-text" size={40} color={colors.trunk} />
          <Text variant="title">Importa los movimientos del banco</Text>
          <Text tone="muted">
            Toma una captura de la lista de movimientos de tu app del banco y elígela aquí (hasta {MAX_IMAGES} a la vez). Nido lee
            fecha, descripción y valor; un valor con −$ es gasto y uno con solo $ es ingreso. Antes de guardar revisas todo.
          </Text>
          <Text variant="caption" tone="subtle">
            La imagen se lee con IA y no se guarda en ningún lado.
          </Text>
        </View>
        <Problems items={problems} />
      </Screen>
    );
  }

  // Revisar
  return (
    <Screen
      scroll
      edges={['bottom']}
      footer={
        <>
          {save.isError ? (
            <Text tone="danger" accessibilityLiveRegion="polite">
              {financeErrorMessage(save.error)}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted" style={styles.totals}>
            Gastos {formatCOP(totals.expense)} · Ingresos {formatCOP(totals.income)}
          </Text>
          <Button
            label={chosen.length === 1 ? 'Guardar 1 movimiento' : `Guardar ${chosen.length} movimientos`}
            onPress={submit}
            loading={save.isPending}
            disabled={!chosen.length}
          />
        </>
      }
    >
      <Problems items={problems} />

      <Field label="De quién es">
        <SegmentedControl<Scope>
          value={scope}
          onChange={setScope}
          segments={[
            { value: 'hogar', label: 'Del hogar' },
            { value: 'personal', label: 'Solo mío' },
          ]}
        />
      </Field>

      <View style={styles.listHeader}>
        <Text variant="label" tone="muted" style={styles.flex}>
          {drafts.length === 1 ? '1 movimiento leído' : `${drafts.length} movimientos leídos`}
        </Text>
        <Button label="Agregar captura" variant="text" onPress={() => pick(true)} />
      </View>

      <View style={[styles.list, { borderColor: colors.rule }]}>
        {drafts.map((d, i) => (
          <DraftRow
            key={d.id}
            draft={d}
            first={i === 0}
            open={openId === d.id}
            today={today}
            categories={sortCategories((categories.data ?? []).filter((c) => c.kind === d.kind))}
            onToggle={() => toggle(d)}
            onOpen={() => setOpenId(openId === d.id ? null : d.id)}
            onChange={(patch) => update(d.id, patch)}
          />
        ))}
      </View>
    </Screen>
  );
}

function Problems({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.problems}>
      {items.map((p) => (
        <Text key={p} variant="caption" tone="danger">
          {p}
        </Text>
      ))}
    </View>
  );
}

const STATUS_LABEL: Record<Draft['status'], string | null> = {
  nuevo: null,
  revisar: 'Revisar',
  registrado: 'Ya registrado',
  posible: '¿Repetido?',
};

function DraftRow({
  draft: d,
  first,
  open,
  today,
  categories,
  onToggle,
  onOpen,
  onChange,
}: {
  draft: Draft;
  first: boolean;
  open: boolean;
  today: string;
  categories: ReturnType<typeof sortCategories>;
  onToggle: () => void;
  onOpen: () => void;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const { colors } = useTheme();
  const category = categories.find((c) => c.id === d.categoryId);
  const amountShown = d.amount > 0 ? (d.kind === 'expense' ? formatCOP(-d.amount) : formatCOP(d.amount, { sign: true })) : '$ ?';
  const status = STATUS_LABEL[d.status];
  const meta = [d.date ? relativeDay(d.date, today) : 'Sin fecha', category?.name].filter(Boolean).join(' · ');

  return (
    <View style={[!first && styles.rowRule, { borderTopColor: colors.rule, opacity: d.include || open ? 1 : 0.6 }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: d.include }}
          accessibilityLabel={`Importar ${d.description || 'movimiento'}`}
          onPress={onToggle}
          hitSlop={8}
          style={styles.check}
        >
          <MaterialCommunityIcons
            name={d.include ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={d.include ? colors.trunk : colors.inkSubtle}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${d.kind === 'expense' ? 'Gasto' : 'Ingreso'}: ${d.description}, ${amountShown}, ${meta}${status ? `, ${status}` : ''}`}
          accessibilityHint={open ? 'Cierra la edición' : 'Abre para corregir'}
          onPress={onOpen}
          style={styles.rowMain}
        >
          <View style={styles.flex}>
            <Text variant="bodyStrong" numberOfLines={open ? undefined : 1}>
              {d.description || 'Sin descripción'}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {meta}
            </Text>
            {status ? (
              <Text variant="caption" tone={d.status === 'revisar' ? 'danger' : 'subtle'}>
                {status}
                {d.note ? `: ${d.note}` : ''}
              </Text>
            ) : null}
          </View>
          <Text variant="figure" tone={d.kind === 'expense' ? 'default' : 'trunk'}>
            {amountShown}
          </Text>
        </Pressable>
      </View>

      {open ? (
        <View style={[styles.editor, { backgroundColor: colors.surface, borderColor: colors.rule }]}>
          <SegmentedControl<TxKind>
            value={d.kind}
            onChange={(kind) => onChange({ kind })}
            segments={[
              { value: 'expense', label: 'Gasto' },
              { value: 'income', label: 'Ingreso' },
            ]}
          />
          <AmountInput
            label="Valor"
            accessibilityLabel="Valor en pesos"
            value={d.amount > 0 ? groupThousands(d.amount) : ''}
            onChange={(t) => onChange({ amount: parseCOP(t) })}
          />
          <DateField
            label="Fecha"
            value={d.date}
            onChange={(date) => date && onChange({ date })}
            placeholder="Elegir fecha"
            maximumDate={today}
          />
          <TextField
            label="Descripción"
            value={d.description}
            onChangeText={(description) => onChange({ description })}
            maxLength={120}
          />
          <Field label="Categoría">
            <CategoryGrid categories={categories} value={d.categoryId} onChange={(categoryId) => onChange({ categoryId })} />
          </Field>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  centerText: { textAlign: 'center' },
  intro: { gap: space.md, paddingTop: space.md },
  problems: { gap: space.xs },
  totals: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  listHeader: { flexDirection: 'row', alignItems: 'center' },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth },
  check: { width: 32, alignItems: 'center' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  editor: { gap: space.lg, padding: space.lg, borderWidth: 1, borderRadius: radius.md, marginBottom: space.md },
});
