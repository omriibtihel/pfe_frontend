/**
 * OpSummaryChips — puces contextuelles pour l'historique des opérations de nettoyage.
 *
 * Extrait les informations significatives de `op.params` et `op.result` pour chaque
 * type d'action, et les affiche sous forme de petits badges dans la liste d'historique.
 */
import type { ProcessingOperation } from '@/types';
import type { TFunction } from 'i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

type PerColumnStats = Record<string, { changed_count?: number }>;

type OpResult = {
  before_shape?: { rows?: number; cols?: number };
  after_shape?: { rows?: number; cols?: number };
  rows_removed?: number;
  columns_removed?: string[];
  columns_added?: string[];
  rename_mapping?: Record<string, string>;
  applied_rename?: Record<string, string>;
  per_column?: PerColumnStats;
};

type ChipVariant = 'default' | 'destructive' | 'success' | 'warning' | 'rename';

// ── Styles par variante ───────────────────────────────────────────────────────

const CHIP_STYLES: Record<ChipVariant, string> = {
  default:     'bg-muted/50 border-border/60 text-muted-foreground',
  destructive: 'bg-destructive/8 border-destructive/20 text-destructive',
  success:     'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400',
  warning:     'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
  rename:      'bg-secondary/10 border-secondary/20 text-secondary',
};

const CHIP_BASE = 'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px]';

// ── Helpers ───────────────────────────────────────────────────────────────────

function totalChangedFromPerCol(perCol: PerColumnStats): number {
  return Object.values(perCol).reduce((sum, col) => sum + (col?.changed_count ?? 0), 0);
}

function resolveRenameMapping(
  result: OpResult | null,
  params: Record<string, unknown>,
): Record<string, string> {
  // Prefer applied_rename (alias-resolved) over rename_mapping (raw params).
  // Discard empty objects so we fall through to the next source.
  for (const candidate of [result?.applied_rename, result?.rename_mapping, params.mapping]) {
    if (candidate && typeof candidate === 'object' && Object.keys(candidate).length > 0) {
      return candidate as Record<string, string>;
    }
  }
  return {};
}

function getResult(op: ProcessingOperation): OpResult | null {
  return (op as unknown as { result?: OpResult }).result
    ?? (op.params as { __result?: OpResult })?.__result
    ?? null;
}

// ── Chip descriptor ───────────────────────────────────────────────────────────

type Chip = { key: string; content: React.ReactNode; variant: ChipVariant };

function chip(key: string, content: React.ReactNode, variant: ChipVariant = 'default'): Chip {
  return { key, content, variant };
}

// ── Per-action builders ───────────────────────────────────────────────────────

function buildDropColumnsChips(op: ProcessingOperation, r: OpResult | null, t: TFunction): Chip[] {
  const chips: Chip[] = [];
  const dropped = (op.columns ?? []).filter(Boolean);

  if (dropped.length > 0) {
    chips.push(chip('count', t('nettoyage.chips.minusCols', { n: dropped.length, count: dropped.length }), 'destructive'));
    dropped.slice(0, 3).forEach((c, i) =>
      chips.push(chip(`col-${i}`, <span className="font-mono">{c}</span>))
    );
    if (dropped.length > 3)
      chips.push(chip('more', t('nettoyage.chips.moreOthers', { n: dropped.length - 3 })));
  }

  const bc = r?.before_shape?.cols;
  const ac = r?.after_shape?.cols;
  if (bc != null && ac != null)
    chips.push(chip('shape', t('nettoyage.chips.shapeCols', { before: bc, after: ac })));

  return chips;
}

function buildDropDuplicatesChips(op: ProcessingOperation, r: OpResult | null, t: TFunction): Chip[] {
  const chips: Chip[] = [];
  const br = r?.before_shape?.rows;
  const ar = r?.after_shape?.rows;
  const removed = r?.rows_removed ?? (br != null && ar != null ? br - ar : 0);

  if (removed > 0) {
    chips.push(chip('removed', t('nettoyage.chips.minusDup', { n: removed, count: removed }), 'destructive'));
    if (br != null && ar != null)
      chips.push(chip('shape', t('nettoyage.chips.shapeRows', { before: br, after: ar })));
  } else if (r) {
    chips.push(chip('none', t('nettoyage.chips.noDup'), 'success'));
  }

  // Backend stores subset columns in op.columns, not in params.subset
  const subset = (op.columns ?? []).filter(Boolean);
  if (subset.length > 0) {
    const preview = subset.slice(0, 2).join(', ') + (subset.length > 2 ? ` +${subset.length - 2}` : '');
    chips.push(chip('subset', t('nettoyage.chips.onSubset', { cols: preview })));
  } else if (r) {
    chips.push(chip('all', t('nettoyage.chips.onAllCols')));
  }

  return chips;
}

function buildDropEmptyRowsChips(_op: ProcessingOperation, r: OpResult | null, t: TFunction): Chip[] {
  const chips: Chip[] = [];
  const br = r?.before_shape?.rows;
  const ar = r?.after_shape?.rows;
  const removed = r?.rows_removed ?? (br != null && ar != null ? br - ar : 0);

  if (removed > 0) {
    chips.push(chip('removed', t('nettoyage.chips.minusEmptyRows', { n: removed, count: removed }), 'destructive'));
    if (br != null && ar != null)
      chips.push(chip('shape', t('nettoyage.chips.shapeRows', { before: br, after: ar })));
  } else if (r) {
    chips.push(chip('none', t('nettoyage.chips.noEmptyRows'), 'success'));
  }

  return chips;
}

function buildDropEmptyColsChips(_op: ProcessingOperation, r: OpResult | null, t: TFunction): Chip[] {
  const chips: Chip[] = [];
  const removed = r?.columns_removed ?? [];
  const bc = r?.before_shape?.cols;
  const ac = r?.after_shape?.cols;

  if (removed.length > 0) {
    chips.push(chip('count', t('nettoyage.chips.minusEmptyCols', { n: removed.length, count: removed.length }), 'destructive'));
    removed.slice(0, 3).forEach((c, i) =>
      chips.push(chip(`col-${i}`, <span className="font-mono">{c}</span>))
    );
    if (removed.length > 3)
      chips.push(chip('more', t('nettoyage.chips.moreOthers', { n: removed.length - 3 })));
    if (bc != null && ac != null)
      chips.push(chip('shape', t('nettoyage.chips.shapeCols', { before: bc, after: ac })));
  } else if (r) {
    chips.push(chip('none', t('nettoyage.chips.noEmptyCols'), 'success'));
  }

  return chips;
}

function buildRenameColumnsChips(op: ProcessingOperation, r: OpResult | null, t: TFunction): Chip[] {
  const chips: Chip[] = [];
  const mapping = resolveRenameMapping(r, op.params ?? {});
  const entries = Object.entries(mapping);

  entries.slice(0, 3).forEach(([oldName, newName], i) =>
    chips.push(chip(`rename-${i}`, (
      <>
        <span className="font-mono opacity-70">{oldName}</span>
        <span className="mx-1 opacity-40">→</span>
        <span className="font-mono font-medium">{newName}</span>
      </>
    ), 'rename'))
  );

  if (entries.length > 3)
    chips.push(chip('more', t('nettoyage.chips.moreOthers', { n: entries.length - 3 })));

  return chips;
}

function buildSubstituteValuesChips(op: ProcessingOperation, r: OpResult | null, t: TFunction): Chip[] {
  const chips: Chip[] = [];
  const p = op.params ?? {};
  const nullOrEmpty = t('nettoyage.chips.nullOrEmpty');
  const fromVal = p.treat_from_as_null ? nullOrEmpty : String(p.from_value ?? '?');
  const toVal   = p.to_value == null   ? nullOrEmpty : String(p.to_value);

  chips.push(chip('subst', (
    <>
      <span className="font-mono opacity-70">"{fromVal}"</span>
      <span className="mx-1 opacity-40">→</span>
      <span className="font-mono font-medium">"{toVal}"</span>
    </>
  ), 'rename'));

  const perCol: PerColumnStats = r?.per_column ?? {};
  const total = totalChangedFromPerCol(perCol);

  if (total > 0)
    chips.push(chip('count', t('nettoyage.chips.valuesChanged', { n: total, count: total }), 'warning'));
  else if (r)
    chips.push(chip('none', t('nettoyage.chips.noChange'), 'success'));

  return chips;
}

function buildStripWhitespaceChips(op: ProcessingOperation, r: OpResult | null, t: TFunction): Chip[] {
  const chips: Chip[] = [];
  const cols = (op.columns ?? []).filter(Boolean);

  if (cols.length > 0)
    chips.push(chip('cols', t('nettoyage.chips.cols', { n: cols.length, count: cols.length })));

  const perCol: PerColumnStats = r?.per_column ?? {};
  const total = totalChangedFromPerCol(perCol);

  if (total > 0)
    chips.push(chip('count', t('nettoyage.chips.cellsCleaned', { n: total, count: total }), 'warning'));
  else if (r)
    chips.push(chip('none', t('nettoyage.chips.noSpace'), 'success'));

  return chips;
}

function buildSchemaChips(op: ProcessingOperation, t: TFunction): Chip[] {
  const chips: Chip[] = [];
  const p = op.params ?? {};
  const schemaAction = String(p.schema_action ?? '');
  const column = p.column ? String(p.column) : null;

  if (schemaAction === 'set_kind' && column && p.kind) {
    chips.push(chip('kind', (
      <>
        <span className="font-mono">{column}</span>
        <span className="mx-1 opacity-40">→</span>
        <span className="font-medium">{String(p.kind)}</span>
      </>
    ), 'rename'));
  } else if (schemaAction === 'clear_kind' && column) {
    chips.push(chip('clear', (
      <><span className="font-mono">{column}</span>{' '}{t('nettoyage.chips.typeReset')}</>
    ), 'warning'));
  } else if (schemaAction === 'verify_categorical' && column) {
    const verified = p.verified !== false;
    chips.push(chip('verify', (
      <>
        <span className="font-mono">{column}</span>{' '}
        {verified ? t('nettoyage.chips.confirmedCat') : t('nettoyage.chips.confirmationRemoved')}
      </>
    ), verified ? 'rename' : 'warning'));
  } else if (schemaAction === 'dismiss_alert') {
    const key = p.alert_key ? String(p.alert_key) : null;
    const dismissed = p.dismissed !== false;
    chips.push(chip('alert', (
      <>
        {dismissed ? t('nettoyage.chips.alertIgnored') : t('nettoyage.chips.alertRestored')}
        {key ? <span className="ml-1 font-mono opacity-70">{key}</span> : null}
      </>
    ), dismissed ? 'warning' : 'default'));
  }

  return chips;
}

// ── Generic fallback (unknown / future cleaning actions) ──────────────────────

/**
 * Résumé minimal basé uniquement sur les deltas de forme — utilisé quand
 * `params.action` ne correspond à aucun builder spécialisé. On ne retombe
 * jamais sur `buildSchemaChips` (qui n'a de sens que pour `op_type=schema`).
 */
function buildGenericCleaningChips(_op: ProcessingOperation, r: OpResult | null, t: TFunction): Chip[] {
  if (!r) return [];
  const chips: Chip[] = [];
  const br = r.before_shape?.rows;
  const ar = r.after_shape?.rows;
  const bc = r.before_shape?.cols;
  const ac = r.after_shape?.cols;

  if (br != null && ar != null && br !== ar)
    chips.push(chip('rows', t('nettoyage.chips.shapeRows', { before: br, after: ar })));
  if (bc != null && ac != null && bc !== ac)
    chips.push(chip('cols', t('nettoyage.chips.shapeCols', { before: bc, after: ac })));

  return chips;
}

// ── Public API ────────────────────────────────────────────────────────────────

const ACTION_BUILDERS: Record<string, (op: ProcessingOperation, r: OpResult | null, t: TFunction) => Chip[]> = {
  drop_columns:    buildDropColumnsChips,
  drop_duplicates: buildDropDuplicatesChips,
  drop_empty_rows: buildDropEmptyRowsChips,
  drop_empty_cols: buildDropEmptyColsChips,
  rename_columns:  buildRenameColumnsChips,
  substitute_values: buildSubstituteValuesChips,
  strip_whitespace:  buildStripWhitespaceChips,
};

export function buildOpSummaryChips(op: ProcessingOperation, t: TFunction): React.ReactNode[] {
  const opType = String(op.op_type ?? '').toLowerCase();
  const r = getResult(op);

  let chips: Chip[];
  if (opType === 'schema') {
    chips = buildSchemaChips(op, t);
  } else {
    // op_type "cleaning" (ou inconnu mais non-schema) : dispatch sur l'action,
    // fallback générique sur les deltas de forme — jamais sur les chips schema.
    const action = String(op.params?.action ?? '');
    const builder = ACTION_BUILDERS[action];
    chips = builder ? builder(op, r, t) : buildGenericCleaningChips(op, r, t);
  }

  return chips.map(({ key, content, variant }) => (
    <span
      key={key}
      className={`${CHIP_BASE} ${CHIP_STYLES[variant]}`}
    >
      {content}
    </span>
  ));
}
