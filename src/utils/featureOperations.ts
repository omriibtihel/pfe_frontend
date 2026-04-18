// ─────────────────────────────────────────────────────────────────────────────
// Feature Engineering — operation catalog
//
// Each operation defines its inputs (column selectors / constants) and a
// buildExpr function that generates the Python expression sent to the backend.
// ─────────────────────────────────────────────────────────────────────────────

/** Wrap a column name in col('...') if it is not a valid Python identifier. */
function ref(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `col('${name}')`;
}

/** Sanitize a column name to a valid snake_case identifier fragment. */
function slug(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '_').replace(/^_+|_+$/g, '').slice(0, 18) || 'col';
}

// ─────────────────────────────────────────────────────────────────────────────

export type InputKind = 'column' | 'constant';

export interface OperationInput {
  /** Unique key used to index into columns[] or constants{} */
  key: string;
  label: string;
  kind: InputKind;
  /** Only for kind='constant' */
  defaultValue?: number;
  placeholder?: string;
}

export interface Operation {
  id: string;
  label: string;
  category: string;
  description: string;
  inputs: OperationInput[];
  buildExpr: (cols: string[], consts: Record<string, number>) => string;
  autoName?: (cols: string[], consts: Record<string, number>) => string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog
// ─────────────────────────────────────────────────────────────────────────────

export const OPERATIONS: Operation[] = [

  // ── Deux colonnes ──────────────────────────────────────────────────────────

  {
    id: 'sum2',
    label: 'a + b — somme',
    category: 'Deux colonnes',
    description: 'Somme de deux colonnes.',
    inputs: [
      { key: 'a', label: 'Colonne a', kind: 'column' },
      { key: 'b', label: 'Colonne b', kind: 'column' },
    ],
    buildExpr: ([a, b]) => `${ref(a)} + ${ref(b)}`,
    autoName: ([a, b]) => `${slug(a)}_plus_${slug(b)}`,
  },
  {
    id: 'difference',
    label: 'a − b — différence',
    category: 'Deux colonnes',
    description: 'Différence entre deux colonnes.',
    inputs: [
      { key: 'a', label: 'Colonne a', kind: 'column' },
      { key: 'b', label: 'Colonne b', kind: 'column' },
    ],
    buildExpr: ([a, b]) => `${ref(a)} - ${ref(b)}`,
    autoName: ([a, b]) => `${slug(a)}_minus_${slug(b)}`,
  },
  {
    id: 'product',
    label: 'a × b — produit',
    category: 'Deux colonnes',
    description: 'Produit (interaction) entre deux colonnes. Capture les effets croisés.',
    inputs: [
      { key: 'a', label: 'Colonne a', kind: 'column' },
      { key: 'b', label: 'Colonne b', kind: 'column' },
    ],
    buildExpr: ([a, b]) => `${ref(a)} * ${ref(b)}`,
    autoName: ([a, b]) => `${slug(a)}_x_${slug(b)}`,
  },
  {
    id: 'ratio',
    label: 'a ÷ b — ratio',
    category: 'Deux colonnes',
    description: 'Rapport entre deux colonnes. NaN si b = 0.',
    inputs: [
      { key: 'a', label: 'Numérateur a', kind: 'column' },
      { key: 'b', label: 'Dénominateur b', kind: 'column' },
    ],
    buildExpr: ([a, b]) => `${ref(a)} / ${ref(b)}`,
    autoName: ([a, b]) => `${slug(a)}_div_${slug(b)}`,
  },
  {
    id: 'relative_diff',
    label: '(a − b) / b — diff. relative',
    category: 'Deux colonnes',
    description: 'Différence relative. Mesure la variation proportionnelle par rapport à b.',
    inputs: [
      { key: 'a', label: 'Valeur a', kind: 'column' },
      { key: 'b', label: 'Référence b', kind: 'column' },
    ],
    buildExpr: ([a, b]) => `(${ref(a)} - ${ref(b)}) / ${ref(b)}`,
    autoName: ([a, b]) => `${slug(a)}_reldiff_${slug(b)}`,
  },
  {
    id: 'proportion',
    label: 'a / (a + b) — proportion',
    category: 'Deux colonnes',
    description: 'Part de a dans la somme (a + b). Résultat entre 0 et 1.',
    inputs: [
      { key: 'a', label: 'Colonne a', kind: 'column' },
      { key: 'b', label: 'Colonne b', kind: 'column' },
    ],
    buildExpr: ([a, b]) => `${ref(a)} / (${ref(a)} + ${ref(b)})`,
    autoName: ([a, b]) => `${slug(a)}_prop_${slug(b)}`,
  },
  {
    id: 'abs_diff',
    label: '|a − b| — distance',
    category: 'Deux colonnes',
    description: 'Distance absolue entre deux colonnes.',
    inputs: [
      { key: 'a', label: 'Colonne a', kind: 'column' },
      { key: 'b', label: 'Colonne b', kind: 'column' },
    ],
    buildExpr: ([a, b]) => `abs(${ref(a)} - ${ref(b)})`,
    autoName: ([a, b]) => `dist_${slug(a)}_${slug(b)}`,
  },
  {
    id: 'max2',
    label: 'max(a, b)',
    category: 'Deux colonnes',
    description: 'Maximum entre deux colonnes, ligne par ligne.',
    inputs: [
      { key: 'a', label: 'Colonne a', kind: 'column' },
      { key: 'b', label: 'Colonne b', kind: 'column' },
    ],
    buildExpr: ([a, b]) => `maximum(${ref(a)}, ${ref(b)})`,
    autoName: ([a, b]) => `max_${slug(a)}_${slug(b)}`,
  },
  {
    id: 'min2',
    label: 'min(a, b)',
    category: 'Deux colonnes',
    description: 'Minimum entre deux colonnes, ligne par ligne.',
    inputs: [
      { key: 'a', label: 'Colonne a', kind: 'column' },
      { key: 'b', label: 'Colonne b', kind: 'column' },
    ],
    buildExpr: ([a, b]) => `minimum(${ref(a)}, ${ref(b)})`,
    autoName: ([a, b]) => `min_${slug(a)}_${slug(b)}`,
  },

  // ── Transformation (1 colonne) ─────────────────────────────────────────────

  {
    id: 'log1p',
    label: 'log(1 + x)',
    category: 'Transformation',
    description: 'Logarithme naturel de (1 + x). Idéal pour les valeurs ≥ 0 (compte, montant…).',
    inputs: [{ key: 'x', label: 'Colonne x', kind: 'column' }],
    buildExpr: ([x]) => `log1p(${ref(x)})`,
    autoName: ([x]) => `log1p_${slug(x)}`,
  },
  {
    id: 'log',
    label: 'log(x)',
    category: 'Transformation',
    description: 'Logarithme naturel. Requiert x > 0 (négatifs → NaN).',
    inputs: [{ key: 'x', label: 'Colonne x', kind: 'column' }],
    buildExpr: ([x]) => `log(${ref(x)})`,
    autoName: ([x]) => `log_${slug(x)}`,
  },
  {
    id: 'sqrt',
    label: '√x — racine carrée',
    category: 'Transformation',
    description: 'Racine carrée. Valeurs négatives → NaN.',
    inputs: [{ key: 'x', label: 'Colonne x', kind: 'column' }],
    buildExpr: ([x]) => `sqrt(${ref(x)})`,
    autoName: ([x]) => `sqrt_${slug(x)}`,
  },
  {
    id: 'square',
    label: 'x² — carré',
    category: 'Transformation',
    description: 'Carré de la valeur. Capture les effets non-linéaires.',
    inputs: [{ key: 'x', label: 'Colonne x', kind: 'column' }],
    buildExpr: ([x]) => `${ref(x)} ** 2`,
    autoName: ([x]) => `${slug(x)}_sq`,
  },
  {
    id: 'cube',
    label: 'x³ — cube',
    category: 'Transformation',
    description: 'Cube de la valeur.',
    inputs: [{ key: 'x', label: 'Colonne x', kind: 'column' }],
    buildExpr: ([x]) => `${ref(x)} ** 3`,
    autoName: ([x]) => `${slug(x)}_cu`,
  },
  {
    id: 'abs',
    label: '|x| — valeur absolue',
    category: 'Transformation',
    description: 'Valeur absolue.',
    inputs: [{ key: 'x', label: 'Colonne x', kind: 'column' }],
    buildExpr: ([x]) => `abs(${ref(x)})`,
    autoName: ([x]) => `abs_${slug(x)}`,
  },
  {
    id: 'exp',
    label: 'eˣ — exponentielle',
    category: 'Transformation',
    description: 'Exponentielle. Attention aux grandes valeurs.',
    inputs: [{ key: 'x', label: 'Colonne x', kind: 'column' }],
    buildExpr: ([x]) => `exp(${ref(x)})`,
    autoName: ([x]) => `exp_${slug(x)}`,
  },
  {
    id: 'reciprocal',
    label: '1/x — inverse',
    category: 'Transformation',
    description: 'Inverse de x. NaN si x = 0.',
    inputs: [{ key: 'x', label: 'Colonne x', kind: 'column' }],
    buildExpr: ([x]) => `1 / ${ref(x)}`,
    autoName: ([x]) => `inv_${slug(x)}`,
  },
  {
    id: 'is_missing',
    label: 'Valeur manquante → 0/1',
    category: 'Transformation',
    description: '1 si la valeur est NaN, 0 sinon. Indicateur de donnée manquante.',
    inputs: [{ key: 'x', label: 'Colonne x', kind: 'column' }],
    buildExpr: ([x]) => `isnan(${ref(x)}) * 1`,
    autoName: ([x]) => `missing_${slug(x)}`,
  },

  // ── Avec constante ─────────────────────────────────────────────────────────

  {
    id: 'power_k',
    label: 'xᵏ — puissance k',
    category: 'Avec constante',
    description: 'x élevé à la puissance k.',
    inputs: [
      { key: 'x', label: 'Colonne x', kind: 'column' },
      { key: 'k', label: 'Exposant k', kind: 'constant', defaultValue: 2, placeholder: '2' },
    ],
    buildExpr: ([x], { k }) => `${ref(x)} ** ${k}`,
    autoName: ([x], { k }) => `${slug(x)}_pow${k}`,
  },
  {
    id: 'flag_gt',
    label: 'x > seuil → 0/1',
    category: 'Avec constante',
    description: '1 si x dépasse le seuil, 0 sinon. Binarise une variable continue.',
    inputs: [
      { key: 'x', label: 'Colonne x', kind: 'column' },
      { key: 'k', label: 'Seuil', kind: 'constant', defaultValue: 0, placeholder: '0' },
    ],
    buildExpr: ([x], { k }) => `(${ref(x)} > ${k}) * 1`,
    autoName: ([x], { k }) => `${slug(x)}_gt${k}`,
  },
  {
    id: 'flag_lt',
    label: 'x < seuil → 0/1',
    category: 'Avec constante',
    description: '1 si x est inférieur au seuil, 0 sinon.',
    inputs: [
      { key: 'x', label: 'Colonne x', kind: 'column' },
      { key: 'k', label: 'Seuil', kind: 'constant', defaultValue: 0, placeholder: '0' },
    ],
    buildExpr: ([x], { k }) => `(${ref(x)} < ${k}) * 1`,
    autoName: ([x], { k }) => `${slug(x)}_lt${k}`,
  },
  {
    id: 'flag_between',
    label: 'low ≤ x ≤ high → 0/1',
    category: 'Avec constante',
    description: '1 si x est dans l\'intervalle [low, high], 0 sinon.',
    inputs: [
      { key: 'x', label: 'Colonne x', kind: 'column' },
      { key: 'low', label: 'Borne basse', kind: 'constant', defaultValue: 0, placeholder: '0' },
      { key: 'high', label: 'Borne haute', kind: 'constant', defaultValue: 100, placeholder: '100' },
    ],
    buildExpr: ([x], { low, high }) =>
      `((${ref(x)} >= ${low}) * (${ref(x)} <= ${high})) * 1`,
    autoName: ([x], { low, high }) => `${slug(x)}_between${low}_${high}`,
  },
  {
    id: 'clip_range',
    label: 'Clip [low, high]',
    category: 'Avec constante',
    description: 'Borne les valeurs dans un intervalle. Traite les outliers.',
    inputs: [
      { key: 'x', label: 'Colonne x', kind: 'column' },
      { key: 'low', label: 'Borne basse', kind: 'constant', defaultValue: 0, placeholder: '0' },
      { key: 'high', label: 'Borne haute', kind: 'constant', defaultValue: 100, placeholder: '100' },
    ],
    buildExpr: ([x], { low, high }) => `clip(${ref(x)}, ${low}, ${high})`,
    autoName: ([x]) => `${slug(x)}_clipped`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Derived helpers
// ─────────────────────────────────────────────────────────────────────────────

export const OPERATIONS_BY_CATEGORY: Record<string, Operation[]> = OPERATIONS.reduce<
  Record<string, Operation[]>
>((acc, op) => {
  (acc[op.category] ??= []).push(op);
  return acc;
}, {});

export function getOperation(id: string): Operation | undefined {
  return OPERATIONS.find((op) => op.id === id);
}

/** Compute the generated expression from an operation + current selections. */
export function buildExpression(
  op: Operation,
  columns: string[],
  constants: Record<string, number>,
): string {
  const colInputs = op.inputs.filter((i) => i.kind === 'column');
  const constInputs = op.inputs.filter((i) => i.kind === 'constant');
  const cols = colInputs.map((_, i) => columns[i] ?? '');
  if (cols.some((c) => !c)) return '';
  const consts = { ...constants };
  for (const ci of constInputs) {
    if (consts[ci.key] === undefined) consts[ci.key] = ci.defaultValue ?? 0;
  }
  return op.buildExpr(cols, consts);
}

/** Suggest a feature name from the current operation + selections. */
export function suggestName(
  op: Operation,
  columns: string[],
  constants: Record<string, number>,
): string {
  if (!op.autoName) return '';
  const colInputs = op.inputs.filter((i) => i.kind === 'column');
  const constInputs = op.inputs.filter((i) => i.kind === 'constant');
  const cols = colInputs.map((_, i) => columns[i] ?? '');
  if (cols.some((c) => !c)) return '';
  const consts = { ...constants };
  for (const ci of constInputs) {
    if (consts[ci.key] === undefined) consts[ci.key] = ci.defaultValue ?? 0;
  }
  return op.autoName(cols, consts);
}

/** True when a name looks like an auto-generated default (feature_N). */
export function isDefaultName(name: string): boolean {
  return /^feature_\d+$/.test(name);
}

/**
 * Return a short insertable snippet for an operation.
 * Uses the operation's input keys as placeholder names so the result is readable.
 * Example: sum2 → "a + b",  log1p → "log1p(x)",  power_k → "x ** 2"
 */
export function getSnippet(op: Operation): string {
  const cols = op.inputs.filter((i) => i.kind === 'column').map((i) => i.key);
  const consts: Record<string, number> = {};
  for (const ci of op.inputs.filter((i) => i.kind === 'constant')) {
    consts[ci.key] = ci.defaultValue ?? 0;
  }
  return op.buildExpr(cols, consts);
}
