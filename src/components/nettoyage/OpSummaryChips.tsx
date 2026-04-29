/**
 * OpSummaryChips — puces contextuelles pour l'historique des opérations de nettoyage.
 *
 * Extrait les informations significatives de `op.params` et `op.result` pour chaque
 * type d'action, et les affiche sous forme de petits badges dans la liste d'historique.
 */
import type { ProcessingOperation } from '@/types';

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

function plural(n: number, singular: string, pluralSuffix = 's'): string {
  return n > 1 ? `${singular}${pluralSuffix}` : singular;
}

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

function buildDropColumnsChips(op: ProcessingOperation, r: OpResult | null): Chip[] {
  const chips: Chip[] = [];
  const dropped = (op.columns ?? []).filter(Boolean);

  if (dropped.length > 0) {
    chips.push(chip('count', `−${dropped.length} ${plural(dropped.length, 'colonne')}`, 'destructive'));
    dropped.slice(0, 3).forEach((c, i) =>
      chips.push(chip(`col-${i}`, <span className="font-mono">{c}</span>))
    );
    if (dropped.length > 3)
      chips.push(chip('more', `+${dropped.length - 3} autres`));
  }

  const bc = r?.before_shape?.cols;
  const ac = r?.after_shape?.cols;
  if (bc != null && ac != null)
    chips.push(chip('shape', `${bc} → ${ac} col.`));

  return chips;
}

function buildDropDuplicatesChips(op: ProcessingOperation, r: OpResult | null): Chip[] {
  const chips: Chip[] = [];
  const br = r?.before_shape?.rows;
  const ar = r?.after_shape?.rows;
  const removed = r?.rows_removed ?? (br != null && ar != null ? br - ar : 0);

  if (removed > 0) {
    chips.push(chip('removed', `−${removed} ${plural(removed, 'doublon')}`, 'destructive'));
    if (br != null && ar != null)
      chips.push(chip('shape', `${br} → ${ar} lignes`));
  } else if (r) {
    chips.push(chip('none', 'Aucun doublon trouvé', 'success'));
  }

  // Backend stores subset columns in op.columns, not in params.subset
  const subset = (op.columns ?? []).filter(Boolean);
  if (subset.length > 0) {
    const preview = subset.slice(0, 2).join(', ') + (subset.length > 2 ? ` +${subset.length - 2}` : '');
    chips.push(chip('subset', `sur : ${preview}`));
  } else if (r) {
    chips.push(chip('all', 'toutes les colonnes'));
  }

  return chips;
}

function buildDropEmptyRowsChips(_op: ProcessingOperation, r: OpResult | null): Chip[] {
  const chips: Chip[] = [];
  const br = r?.before_shape?.rows;
  const ar = r?.after_shape?.rows;
  const removed = r?.rows_removed ?? (br != null && ar != null ? br - ar : 0);

  if (removed > 0) {
    chips.push(chip('removed', `−${removed} ${plural(removed, 'ligne')} vide${removed > 1 ? 's' : ''}`, 'destructive'));
    if (br != null && ar != null)
      chips.push(chip('shape', `${br} → ${ar} lignes`));
  } else if (r) {
    chips.push(chip('none', 'Aucune ligne vide', 'success'));
  }

  return chips;
}

function buildDropEmptyColsChips(_op: ProcessingOperation, r: OpResult | null): Chip[] {
  const chips: Chip[] = [];
  const removed = r?.columns_removed ?? [];
  const bc = r?.before_shape?.cols;
  const ac = r?.after_shape?.cols;

  if (removed.length > 0) {
    chips.push(chip('count', `−${removed.length} ${plural(removed.length, 'colonne')} vide${removed.length > 1 ? 's' : ''}`, 'destructive'));
    removed.slice(0, 3).forEach((c, i) =>
      chips.push(chip(`col-${i}`, <span className="font-mono">{c}</span>))
    );
    if (removed.length > 3)
      chips.push(chip('more', `+${removed.length - 3} autres`));
    if (bc != null && ac != null)
      chips.push(chip('shape', `${bc} → ${ac} col.`));
  } else if (r) {
    chips.push(chip('none', 'Aucune colonne vide', 'success'));
  }

  return chips;
}

function buildRenameColumnsChips(op: ProcessingOperation, r: OpResult | null): Chip[] {
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
    chips.push(chip('more', `+${entries.length - 3} autres`));

  return chips;
}

function buildSubstituteValuesChips(op: ProcessingOperation, r: OpResult | null): Chip[] {
  const chips: Chip[] = [];
  const p = op.params ?? {};
  const fromVal = p.treat_from_as_null ? 'null/vide' : String(p.from_value ?? '?');
  const toVal   = p.to_value == null   ? 'null/vide' : String(p.to_value);

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
    chips.push(chip('count', `${total} ${plural(total, 'valeur')} modifiée${total > 1 ? 's' : ''}`, 'warning'));
  else if (r)
    chips.push(chip('none', 'Aucune valeur modifiée', 'success'));

  return chips;
}

function buildStripWhitespaceChips(op: ProcessingOperation, r: OpResult | null): Chip[] {
  const chips: Chip[] = [];
  const cols = (op.columns ?? []).filter(Boolean);

  if (cols.length > 0)
    chips.push(chip('cols', `${cols.length} ${plural(cols.length, 'colonne')}`));

  const perCol: PerColumnStats = r?.per_column ?? {};
  const total = totalChangedFromPerCol(perCol);

  if (total > 0)
    chips.push(chip('count', `${total} ${plural(total, 'cellule')} nettoyée${total > 1 ? 's' : ''}`, 'warning'));
  else if (r)
    chips.push(chip('none', 'Aucun espace trouvé', 'success'));

  return chips;
}

function buildSchemaChips(op: ProcessingOperation): Chip[] {
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
      <><span className="font-mono">{column}</span>{' '}type réinitialisé</>
    ), 'warning'));
  } else if (schemaAction === 'verify_categorical' && column) {
    const verified = p.verified !== false;
    chips.push(chip('verify', (
      <>
        <span className="font-mono">{column}</span>{' '}
        {verified ? 'confirmé catégoriel' : 'confirmation retirée'}
      </>
    ), verified ? 'rename' : 'warning'));
  } else if (schemaAction === 'dismiss_alert') {
    const key = p.alert_key ? String(p.alert_key) : null;
    const dismissed = p.dismissed !== false;
    chips.push(chip('alert', (
      <>
        {dismissed ? 'Alerte ignorée' : 'Alerte rétablie'}
        {key ? <span className="ml-1 font-mono opacity-70">{key}</span> : null}
      </>
    ), dismissed ? 'warning' : 'default'));
  }

  return chips;
}

// ── Public API ────────────────────────────────────────────────────────────────

const ACTION_BUILDERS: Record<string, (op: ProcessingOperation, r: OpResult | null) => Chip[]> = {
  drop_columns:    buildDropColumnsChips,
  drop_duplicates: buildDropDuplicatesChips,
  drop_empty_rows: buildDropEmptyRowsChips,
  drop_empty_cols: buildDropEmptyColsChips,
  rename_columns:  buildRenameColumnsChips,
  substitute_values: buildSubstituteValuesChips,
  strip_whitespace:  buildStripWhitespaceChips,
};

export function buildOpSummaryChips(op: ProcessingOperation): React.ReactNode[] {
  const action = String(op.params?.action ?? '');
  const r = getResult(op);

  const builder = ACTION_BUILDERS[action];
  const chips = builder ? builder(op, r) : buildSchemaChips(op);

  return chips.map(({ key, content, variant }) => (
    <span
      key={key}
      className={`${CHIP_BASE} ${CHIP_STYLES[variant]}`}
    >
      {content}
    </span>
  ));
}
