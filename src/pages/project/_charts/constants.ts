import {
  BarChart3,
  BoxSelect,
  PieChart as PieIcon,
  LineChart as LineIcon,
  Radar as RadarIcon,
  ScatterChart as ScatterIcon,
  AreaChart as AreaIcon,
  Grid3X3,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import type { ChartKind } from "./types";

export const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(262, 83%, 58%)",
  "hsl(174, 84%, 32%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(142, 76%, 36%)",
];

export const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
  fontSize: "12px",
} as const;

/** Compact axis tick formatter: 1 200 000 → "1.2M", 3 500 → "3.5k" */
export const fmtAxisVal = (v: number): string => {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return v % 1 === 0 ? String(v) : v.toFixed(2);
};

/** Chart group structure — labels resolved via i18n at render time. */
export const CHART_GROUPS: Array<{
  groupKey: "distribution" | "aggregation" | "composition" | "relations" | "advanced";
  items: { key: ChartKind; Icon: LucideIcon }[];
}> = [
  {
    groupKey: "distribution",
    items: [
      { key: "hist",    Icon: BarChart3 },
      { key: "boxplot", Icon: BoxSelect },
    ],
  },
  {
    groupKey: "aggregation",
    items: [
      { key: "bar",  Icon: BarChart3 },
      { key: "line", Icon: LineIcon },
      { key: "area", Icon: AreaIcon },
    ],
  },
  {
    groupKey: "composition",
    items: [
      { key: "pie",      Icon: PieIcon },
      { key: "doughnut", Icon: PieIcon },
    ],
  },
  {
    groupKey: "relations",
    items: [
      { key: "scatter", Icon: ScatterIcon },
      { key: "bubble",  Icon: CircleDot },
    ],
  },
  {
    groupKey: "advanced",
    items: [
      { key: "radar",   Icon: RadarIcon },
      { key: "heatmap", Icon: Grid3X3 },
    ],
  },
];

export const AGG_TITLE_KEYS: Record<"bar" | "line" | "area", string> = {
  bar:  "charts.page.aggTitles.bar",
  line: "charts.page.aggTitles.line",
  area: "charts.page.aggTitles.area",
};

/** Hint keys, keyed by chart kind (use "agg" for bar/line/area, "pie" for pie/doughnut) */
export const CHART_HINT_KEYS: Record<string, string> = {
  agg:     "charts.page.hints.agg",
  pie:     "charts.page.hints.pie",
  hist:    "charts.page.hints.hist",
  boxplot: "charts.page.hints.boxplot",
  scatter: "charts.page.hints.scatter",
  bubble:  "charts.page.hints.bubble",
  radar:   "charts.page.hints.radar",
  heatmap: "charts.page.hints.heatmap",
};

/** @deprecated kept for compatibility — prefer i18n keys */
export const AGG_TITLES: Record<"bar" | "line" | "area", string> = {
  bar:  "Distribution",
  line: "Évolution",
  area: "Courbe de surface",
};

/** @deprecated kept for compatibility — prefer i18n keys */
export const CHART_HINT: Record<string, string> = {
  agg:     'Agrégation de Y par valeurs de X (Top K catégories). Agrégation "count" ne nécessite pas de colonne Y.',
  pie:     'Répartition Top K + "Autres". La légende ci-dessous affiche les comptages exacts.',
  hist:    "Histogramme calculé sur toute la colonne numérique. Les valeurs non numériques ou manquantes sont exclues.",
  boxplot: "Boîte = IQR [P25–P75] · trait = médiane · moustaches = min/max. Cliquer sur les colonnes pour les afficher/masquer.",
  scatter: "Nuage de points sur un échantillon aléatoire. Augmenter l'échantillon pour plus de précision.",
  bubble:  "Scatter dont la taille des bulles est proportionnelle à Z. L'axe Z est normalisé visuellement.",
  radar:   "Moyennes normalisées sur 100. Utile pour comparer le profil général des features numériques.",
  heatmap: "Corrélation de Pearson entre colonnes numériques. Rouge = forte corrélation positive, bleu = négative.",
};
