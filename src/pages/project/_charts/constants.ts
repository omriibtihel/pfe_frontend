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

export const CHART_GROUPS: Array<{
  label: string;
  items: { key: ChartKind; label: string; Icon: any }[];
}> = [
  {
    label: "Distribution",
    items: [
      { key: "hist",    label: "Histogramme", Icon: BarChart3 },
      { key: "boxplot", label: "Boxplot",      Icon: BoxSelect },
    ],
  },
  {
    label: "Agrégation",
    items: [
      { key: "bar",  label: "Bar",  Icon: BarChart3 },
      { key: "line", label: "Line", Icon: LineIcon },
      { key: "area", label: "Area", Icon: AreaIcon },
    ],
  },
  {
    label: "Composition",
    items: [
      { key: "pie",      label: "Pie",    Icon: PieIcon },
      { key: "doughnut", label: "Anneau", Icon: PieIcon },
    ],
  },
  {
    label: "Relations",
    items: [
      { key: "scatter", label: "Scatter", Icon: ScatterIcon },
      { key: "bubble",  label: "Bubble",  Icon: CircleDot },
    ],
  },
  {
    label: "Avancé",
    items: [
      { key: "radar",   label: "Radar",      Icon: RadarIcon },
      { key: "heatmap", label: "Corrélation", Icon: Grid3X3 },
    ],
  },
];

/** Title prefix for each aggregation chart kind */
export const AGG_TITLES: Record<"bar" | "line" | "area", string> = {
  bar:  "Distribution",
  line: "Évolution",
  area: "Courbe de surface",
};

/** Bottom hint text, keyed by chart kind (use "agg" for bar/line/area, "pie" for pie/doughnut) */
export const CHART_HINT: Record<string, string> = {
  agg:     'Agrégation de Y par valeurs de X (Top K catégories). Agrégation "count" ne nécessite pas de colonne Y.',
  pie:     'Répartition Top K + "Autres". La légende ci-dessous affiche les comptages exacts.',
  hist:    "Distribution d'une colonne numérique découpée en bins. Augmenter les bins pour plus de précision.",
  boxplot: "Boîte = IQR [P25–P75] · trait = médiane · moustaches = min/max. Cliquer sur les colonnes pour les afficher/masquer.",
  scatter: "Nuage de points sur un échantillon aléatoire. Augmenter l'échantillon pour plus de précision.",
  bubble:  "Scatter dont la taille des bulles est proportionnelle à Z. L'axe Z est normalisé visuellement.",
  radar:   "Moyennes normalisées sur 100. Utile pour comparer le profil général des features numériques.",
  heatmap: "Corrélation de Pearson entre colonnes numériques. Rouge = forte corrélation positive, bleu = négative.",
};
