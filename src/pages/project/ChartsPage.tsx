import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BarChart3,
  BoxSelect,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  X as XIcon,
  PieChart as PieIcon,
  LineChart as LineIcon,
  Radar as RadarIcon,
  ScatterChart as ScatterIcon,
  AreaChart as AreaIcon,
  Grid3X3,
  CircleDot,
} from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import { useToast } from "@/hooks/use-toast";

import datasetService, { DatasetOut as DatasetListItem } from "@/services/datasetService";
import dataService, { type VersionUI } from "@/services/dataService";
import databaseService, {
  DatasetProfileOut,
  AnalyticsOverview,
  AnalyticsProfile,
  AggFn,
  AggregateOut,
  ValueCountsOut,
  SampleOut,
  HistogramOut,
  CorrelationOut,
} from "@/services/databaseService";

import CorrelationHeatmap from "@/components/ui/CorrelationHeatmap";
import { NormalityTestPanel } from "@/components/ui/NormalityTestPanel";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";

type UiColumn = {
  name: string;
  kind: DatasetProfileOut["profiles"][number]["kind"];
  dtype: string;
  missing: number;
  numeric?: { mean?: number | null; std?: number | null };
};

type ChartKind =
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "doughnut"
  | "hist"
  | "boxplot"
  | "scatter"
  | "bubble"
  | "radar"
  | "heatmap";

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(262, 83%, 58%)",
  "hsl(174, 84%, 32%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(142, 76%, 36%)",
];

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
  fontSize: "12px",
} as const;

// Compact axis tick formatter: 1 200 000 → "1.2M", 3 500 → "3.5k"
const fmtAxisVal = (v: number) => {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v % 1 === 0 ? String(v) : v.toFixed(2);
};

const CHART_GROUPS: Array<{
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
      { key: "bar",  label: "Bar",   Icon: BarChart3 },
      { key: "line", label: "Line",  Icon: LineIcon },
      { key: "area", label: "Area",  Icon: AreaIcon },
    ],
  },
  {
    label: "Composition",
    items: [
      { key: "pie",     label: "Pie",   Icon: PieIcon },
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

// Title prefix for each aggregation chart kind
const AGG_TITLES: Record<"bar" | "line" | "area", string> = {
  bar:  "Distribution",
  line: "Évolution",
  area: "Courbe de surface",
};

// Bottom hint text indexed by chart kind (use "agg" for bar/line/area, "pie" for pie/doughnut)
const CHART_HINT: Record<string, string> = {
  agg:     'Agrégation de Y par valeurs de X (Top K catégories). Agrégation "count" ne nécessite pas de colonne Y.',
  pie:     'Répartition Top K + "Autres". La légende ci-dessous affiche les comptages exacts.',
  hist:    "Distribution d'une colonne numérique découpée en bins. Augmenter les bins pour plus de précision.",
  boxplot: "Boîte = IQR [P25–P75] · trait = médiane · moustaches = min/max. Cliquer sur les colonnes pour les afficher/masquer.",
  scatter: "Nuage de points sur un échantillon aléatoire. Augmenter l'échantillon pour plus de précision.",
  bubble:  "Scatter dont la taille des bulles est proportionnelle à Z. L'axe Z est normalisé visuellement.",
  radar:   "Moyennes normalisées sur 100. Utile pour comparer le profil général des features numériques.",
  heatmap: "Corrélation de Pearson entre colonnes numériques. Rouge = forte corrélation positive, bleu = négative.",
};

function shortLabel(s: string, n = 18) {
  if (!s) return s;
  return s.length > n ? `${s.slice(0, n)}…` : s;
}


const fmtN = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "—" : v.toFixed(d);

// ── Custom boxplot shape — horizontal bars (recharts layout="vertical") ──────
// recharts passes: x = pixel of 0 on X axis, width = pixels for [0→value],
// y = row top, height = row height.  scale = width/value (constant across rows).
// Every shifted stat maps to: xStat = x + s_stat * scale.
function BoxPlotShape(props: any) {
  const { x, y, width, height, value, s_min, s_p25, s_p50, s_p75, s_max, fill } = props;
  if (!Number.isFinite(width) || width <= 0 || !value) return null;

  const scale = width / value;
  const xMin  = x + s_min * scale;
  const xP25  = x + s_p25 * scale;
  const xP50  = x + s_p50 * scale;
  const xP75  = x + s_p75 * scale;
  const xMax  = x + s_max * scale;   // ≈ x + width

  const iqrW = xP75 - xP25;
  const cy   = y + height / 2;
  const boxH = Math.min(height * 0.65, 34);
  const boxY = cy - boxH / 2;
  const capH = boxH * 0.50;

  return (
    <g>
      {/* lower whisker: min → p25 */}
      <line x1={xMin} y1={cy} x2={xP25} y2={cy} stroke={fill} strokeWidth={1.5} />
      <line x1={xMin} y1={cy - capH / 2} x2={xMin} y2={cy + capH / 2} stroke={fill} strokeWidth={2} />
      {/* upper whisker: p75 → max */}
      <line x1={xP75} y1={cy} x2={xMax} y2={cy} stroke={fill} strokeWidth={1.5} />
      <line x1={xMax} y1={cy - capH / 2} x2={xMax} y2={cy + capH / 2} stroke={fill} strokeWidth={2} />
      {/* IQR box */}
      <rect x={xP25} y={boxY} width={Math.max(iqrW, 2)} height={boxH} fill={fill} fillOpacity={0.18} stroke={fill} strokeWidth={2} rx={3} />
      {/* median */}
      <line x1={xP50} y1={boxY} x2={xP50} y2={boxY + boxH} stroke={fill} strokeWidth={3} />
    </g>
  );
}

function EmptyChart({
  message,
  icon,
}: {
  message: string;
  icon?: React.ReactNode;
}) {
  if (!message) return <div className="h-[420px]" />;
  return (
    <div className="h-[420px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
      {icon ?? <BarChart3 className="h-10 w-10 opacity-20" />}
      <p className="text-sm text-center max-w-xs">{message}</p>
    </div>
  );
}

// ── Searchable column selector ────────────────────────────────────────────────
// Shows a sticky search input inside the dropdown when there are > 8 options.
function ColSelect({
  value,
  onChange,
  cols,
  placeholder = "Choisir colonne",
}: {
  value: string;
  onChange: (v: string) => void;
  cols: Array<string | { name: string }>;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const names = cols.map((c) => (typeof c === "string" ? c : c.name));
  const filtered = q ? names.filter((n) => n.toLowerCase().includes(q.toLowerCase())) : names;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="rounded-xl">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {names.length > 8 && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b sticky top-0 bg-popover z-10">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Rechercher..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
            {q && (
              <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        {filtered.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
        {q && filtered.length === 0 && (
          <div className="py-3 text-xs text-center text-muted-foreground">Aucune colonne</div>
        )}
      </SelectContent>
    </Select>
  );
}

// ── Chart header (title + subtitle inside the card) ──────────────────────────
function ChartHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-5 pt-4 pb-1">
      <p className="text-sm font-semibold leading-snug">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Multi-column selector (popover + checkboxes + search) ────────────────────
function MultiColSelect({
  triggerLabel,
  all,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  maxItems,
}: {
  triggerLabel?: string;
  all: string[];
  selected: string[];
  onToggle: (col: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  maxItems?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q ? all.filter((n) => n.toLowerCase().includes(q.toLowerCase())) : all;
  const atMax = maxItems !== undefined && selected.length >= maxItems;

  const triggerText =
    selected.length === 0
      ? triggerLabel ?? "Choisir colonnes"
      : `${selected.length} colonne${selected.length > 1 ? "s" : ""} sélectionnée${selected.length > 1 ? "s" : ""}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 w-full rounded-xl border bg-background px-3 py-2 text-sm hover:bg-muted/50 transition text-left">
          <span className="flex-1 text-xs text-muted-foreground truncate">{triggerText}</span>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">{selected.length}/{all.length}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {/* header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-semibold">{selected.length} / {all.length} sélectionnée{selected.length > 1 ? "s" : ""}</span>
          <div className="flex gap-3 text-xs">
            <button className="text-primary hover:underline" onClick={onSelectAll}>Tout</button>
            <button className="text-muted-foreground hover:underline" onClick={onClearAll}>Aucune</button>
          </div>
        </div>
        {/* search — visible only when list is long */}
        {all.length > 8 && (
          <div className="flex items-center gap-1.5 px-3 py-2 border-b">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Rechercher..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        {/* list */}
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.map((name) => {
            const isSelected = selected.includes(name);
            const disabled = !isSelected && atMax;
            const color = COLORS[all.indexOf(name) % COLORS.length];
            return (
              <button
                key={name}
                disabled={disabled}
                onClick={() => onToggle(name)}
                className={`w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs text-left transition ${
                  disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-muted/60 cursor-pointer"
                }`}
              >
                <span
                  className="h-4 w-4 rounded border flex items-center justify-center shrink-0 transition"
                  style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
                >
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="truncate flex-1" title={name}>{name}</span>
              </button>
            );
          })}
          {q && filtered.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-3">Aucune colonne</p>
          )}
        </div>
        {maxItems !== undefined && (
          <div className="px-3 py-2 border-t text-[10px] text-muted-foreground">
            Maximum {maxItems} colonnes
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}


const PROFILE_TOPK = 20;

export function ChartsPage() {
  const { id } = useParams();
  const projectId = id!;
  const { toast } = useToast();

  // load base data
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);

  // version source
  const [sourceType, setSourceType] = useState<"dataset" | "version">("dataset");
  const [versions, setVersions] = useState<VersionUI[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [profile, setProfile] = useState<AnalyticsProfile | null>(null);

  // Export ref — points to the chart canvas area for PNG export
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // UI
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  // TopK is for charts only (aggregate + pie/doughnut)
  const [topK, setTopK] = useState<number>(15);

  // aggregate charts (bar/line/area)
  const [xCat, setXCat] = useState<string>("");
  const [yNum, setYNum] = useState<string>("");
  const [agg, setAgg] = useState<AggFn>("avg");

  // pie/doughnut
  const [pieCol, setPieCol] = useState<string>("");

  // hist
  const [histCol, setHistCol] = useState<string>("");
  const [histBins, setHistBins] = useState<number>(20);

  // scatter
  const [sx, setSx] = useState<string>("");
  const [sy, setSy] = useState<string>("");
  const [sampleN, setSampleN] = useState<number>(400);

  // bubble
  const [bx, setBx] = useState<string>("");
  const [by, setBy] = useState<string>("");
  const [bz, setBz] = useState<string>("");

  // boxplot column selection
  const [boxplotCols, setBoxplotCols] = useState<string[]>([]);
  // radar column selection (max 8)
  const [radarCols, setRadarCols] = useState<string[]>([]);

  // chart results
  const [chartLoading, setChartLoading] = useState(false);
  const [aggOut, setAggOut] = useState<AggregateOut | null>(null);
  const [countsOut, setCountsOut] = useState<ValueCountsOut | null>(null);
  const [sampleOut, setSampleOut] = useState<SampleOut | null>(null);
  const [histOut, setHistOut] = useState<HistogramOut | null>(null);
  // heatmap data (received via onDataReady callback — used for PNG export)
  const [heatmapData, setHeatmapData] = useState<CorrelationOut | null>(null);

  const loadAnalytics = useCallback(
    async (src: "dataset" | "version", id: number) => {
      if (src === "version") {
        const [o, p] = await Promise.all([
          databaseService.getVersionOverview(projectId, id, 10),
          databaseService.getVersionProfile(projectId, id, PROFILE_TOPK),
        ]);
        setOverview(o);
        setProfile(p);
      } else {
        const [o, p] = await Promise.all([
          databaseService.getOverview(projectId, id, 10),
          databaseService.getProfile(projectId, id, PROFILE_TOPK),
        ]);
        // strip the `dataset` field to match AnalyticsOverview / AnalyticsProfile
        setOverview({ shape: o.shape, columns: o.columns, dtypes: o.dtypes, missing: o.missing, preview: o.preview });
        setProfile({ shape: p.shape, profiles: p.profiles });
      }
    },
    [projectId],
  );

  // load() fetches datasets + versions list, sets active IDs, then delegates
  // analytics loading to the effect below — avoids double fetch on init.
  const load = useCallback(
    async (opts?: { forceDatasetId?: number | null }) => {
      setIsRefreshing(true);
      try {
        const [dsList, vList] = await Promise.all([
          datasetService.list(projectId),
          dataService.getVersions(projectId),
        ]);
        setDatasets(dsList as any);
        setVersions(vList);

        const active = await databaseService.getActiveDataset(projectId);
        const forced = opts?.forceDatasetId ?? null;
        const chosen = forced ?? active.active_dataset_id ?? (dsList?.[0]?.id ?? null);
        setActiveDatasetId(chosen);
        setActiveVersionId((prev) => prev ?? vList[0]?.id ?? null);

        if (!chosen) {
          setOverview(null);
          setProfile(null);
        }
        // analytics are loaded by the effect below reacting to activeDatasetId
      } catch (error) {
        toast({
          title: "Erreur",
          description: (error as Error).message || "Impossible de charger les données",
          variant: "destructive",
        });
      } finally {
        setIsRefreshing(false);
        setIsLoading(false);
      }
    },
    [projectId, toast, loadAnalytics],
  );

  // Reload analytics whenever the source type or active id changes.
  // This is the single place that drives overview + profile fetches.
  useEffect(() => {
    if (sourceType === "dataset" && activeDatasetId) {
      void loadAnalytics("dataset", activeDatasetId);
    } else if (sourceType === "version" && activeVersionId) {
      void loadAnalytics("version", activeVersionId);
    }
  }, [sourceType, activeDatasetId, activeVersionId, loadAnalytics]);

  useEffect(() => {
    setIsLoading(true);
    void load();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: UiColumn[] = useMemo(() => {
    if (!profile) return [];
    return profile.profiles.map((c) => ({
      name: c.name,
      kind: c.kind,
      dtype: c.dtype,
      missing: c.missing ?? 0,
      numeric: c.numeric ? { mean: c.numeric.mean ?? null, std: c.numeric.std ?? null } : undefined,
    }));
  }, [profile]);

  const numericCols = useMemo(() => columns.filter((c) => c.kind === "numeric"), [columns]);

  // Numeric columns that have full boxplot stats (min/p25/p50/p75/max)
  const allBoxplotCols = useMemo(() => {
    if (!profile) return [];
    return profile.profiles
      .filter(
        (c) =>
          c.kind === "numeric" &&
          c.numeric?.min != null &&
          c.numeric.p25 != null &&
          c.numeric.p50 != null &&
          c.numeric.p75 != null &&
          c.numeric.max != null,
      )
      .map((c) => c.name);
  }, [profile]);

  // All numeric column names available for radar
  const allRadarCols = useMemo(() => numericCols.map((c) => c.name), [numericCols]);

  const categoricalCols = useMemo(
    () => columns.filter((c) => c.kind === "categorical" || c.kind === "text" || c.kind === "datetime"),
    [columns]
  );

  const isAggChart = chartKind === "bar" || chartKind === "line" || chartKind === "area";
  const isPieChart = chartKind === "pie" || chartKind === "doughnut";
  const showYForAgg = isAggChart && agg !== "count";

  // ---- What controls are needed per chart ----
  const needs = useMemo(() => {
    return {
      showTopK: isAggChart || isPieChart,
      showAgg: isAggChart,
      showXCat: isAggChart,
      showYNum: showYForAgg,
      showPieCol: isPieChart,
      showHist: chartKind === "hist",
      showBoxplot: chartKind === "boxplot",
      showScatter: chartKind === "scatter",
      showBubble: chartKind === "bubble",
      showRadar: chartKind === "radar",
      showHeatmap: chartKind === "heatmap",
    };
  }, [chartKind, isAggChart, isPieChart, showYForAgg]);

  // ---- When the source changes, clear all column selections and results ----
  // Each source (dataset or version) is treated as an independent dataset:
  // stale column names from the previous source must not carry over.
  useEffect(() => {
    setXCat(""); setYNum(""); setPieCol(""); setHistCol("");
    setSx(""); setSy(""); setBx(""); setBy(""); setBz("");
    setBoxplotCols([]); setRadarCols([]);
    setAggOut(null); setCountsOut(null); setSampleOut(null); setHistOut(null);
  }, [sourceType, activeDatasetId, activeVersionId]);

  // ---- Once columns are available, populate default selections ----
  useEffect(() => {
    if (!columns.length) return;
    const defCat = categoricalCols[0]?.name ?? "";
    const defNum1 = numericCols[0]?.name ?? "";
    const defNum2 = numericCols[1]?.name ?? defNum1;
    const defNum3 = numericCols[2]?.name ?? defNum2;
    setXCat(defCat);
    setYNum(defNum1);
    setPieCol(defCat);
    setHistCol(defNum1);
    setSx(defNum1);
    setSy(defNum2);
    setBx(defNum1);
    setBy(defNum2);
    setBz(defNum3);
    setBoxplotCols(allBoxplotCols.slice(0, 1));
    setRadarCols(numericCols.slice(0, 8).map((c) => c.name));
    if (!numericCols.length) setAgg("count");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  // Dispatch chart calls to the right service based on source type
  const effectiveId = sourceType === "version" ? activeVersionId : activeDatasetId;

  // ---- Fetch data depending on chart ----
  useEffect(() => {
    const id = effectiveId;
    if (!id) return;

    const isVersion = sourceType === "version";

    const doAggregate = (params: Parameters<typeof databaseService.aggregate>[2]) =>
      isVersion
        ? databaseService.versionAggregate(projectId, id, params)
        : databaseService.aggregate(projectId, id, params);

    const doValueCounts = (params: Parameters<typeof databaseService.valueCounts>[2]) =>
      isVersion
        ? databaseService.versionValueCounts(projectId, id, params)
        : databaseService.valueCounts(projectId, id, params);

    const doHist = (params: Parameters<typeof databaseService.hist>[2]) =>
      isVersion
        ? databaseService.versionHist(projectId, id, params)
        : databaseService.hist(projectId, id, params);

    const doSample = (params: Parameters<typeof databaseService.sample>[2]) =>
      isVersion
        ? databaseService.versionSample(projectId, id, params)
        : databaseService.sample(projectId, id, params);

    const run = async () => {
      // Profile-based charts don't need a fetch — clear outputs and return early
      if (chartKind === "radar" || chartKind === "heatmap" || chartKind === "boxplot") {
        setAggOut(null); setCountsOut(null); setSampleOut(null); setHistOut(null);
        return;
      }
      setChartLoading(true);
      try {
        setAggOut(null);
        setCountsOut(null);
        setSampleOut(null);
        setHistOut(null);

        // Aggregate (bar/line/area)
        if (isAggChart) {
          if (!xCat) return;
          const res = await doAggregate({
            x: xCat, agg, top_k: topK, order: "desc", dropna: true,
            ...(agg !== "count" ? { y: yNum } : {}),
          });
          setAggOut(res);
          return;
        }

        // Pie/Doughnut (value counts)
        if (isPieChart) {
          if (!pieCol) return;
          const res = await doValueCounts({ col: pieCol, top_k: topK, dropna: true });
          setCountsOut(res);
          return;
        }

        // Histogram
        if (chartKind === "hist") {
          if (!histCol) return;
          const res = await doHist({ col: histCol, bins: histBins, dropna: true });
          setHistOut(res);
          return;
        }

        // Scatter
        if (chartKind === "scatter") {
          if (!sx || !sy) return;
          const res = await doSample({ cols: [sx, sy], n: sampleN });
          setSampleOut(res);
          return;
        }

        // Bubble
        if (chartKind === "bubble") {
          if (!bx || !by || !bz) return;
          const res = await doSample({ cols: [bx, by, bz], n: sampleN });
          setSampleOut(res);
          return;
        }

        // radar uses profile only
      } catch (e) {
        toast({
          title: "Erreur chart",
          description: (e as Error).message || "Impossible de générer le graphique",
          variant: "destructive",
        });
      } finally {
        setChartLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    projectId,
    effectiveId,
    sourceType,
    chartKind,
    topK,
    agg,
    xCat,
    yNum,
    pieCol,
    histCol,
    histBins,
    sx,
    sy,
    bx,
    by,
    bz,
    sampleN,
    isAggChart,
    isPieChart,
  ]);

  const onRefresh = async () => {
    if (sourceType === "version" && activeVersionId) {
      await loadAnalytics("version", activeVersionId);
    } else {
      await load({ forceDatasetId: activeDatasetId });
    }
  };

  const rowsCount = overview?.shape?.rows ?? 0;

  const seriesLabel = useMemo(() => {
    if (!isAggChart) return "";
    return agg === "count" ? "count" : `${agg}(${yNum})`;
  }, [agg, yNum, isAggChart]);

  // Radar (profile-based, filtered by radarCols selection)
  const radarData = useMemo(() => {
    const selected = numericCols.filter((c) => radarCols.includes(c.name));
    if (!selected.length) return [];
    const means = selected.map((c) => c.numeric?.mean ?? 0);
    const maxAbs = Math.max(1e-9, ...means.map((v) => Math.abs(v)));
    return selected.map((c) => ({
      metric: shortLabel(c.name, 16),
      fullName: c.name,
      mean: c.numeric?.mean ?? 0,
      value: ((c.numeric?.mean ?? 0) / maxAbs) * 100,
    }));
  }, [numericCols, radarCols]);

  // Pie data (TopK + Others)
  const pieData = useMemo(() => {
    const rows = countsOut?.rows ?? [];
    const base = rows.map((r, i) => ({
      name: r.value,
      value: r.count,
      fill: COLORS[i % COLORS.length],
    }));

    const others = countsOut?.others_count ?? 0;
    if (others > 0) {
      base.push({ name: "Autres", value: others, fill: "hsl(var(--muted-foreground))" });
    }
    return base;
  }, [countsOut]);

  // Histogram bars
  const histBars = useMemo(() => {
    const bins = histOut?.rows ?? [];
    return bins.map((b) => ({
      bin: `${b.x0.toFixed(2)}–${b.x1.toFixed(2)}`,
      count: b.count,
    }));
  }, [histOut]);

  // Scatter/bubble points
  const scatterPoints = useMemo(() => {
    const r = sampleOut?.rows ?? [];
    if (chartKind === "scatter") {
      return r
        .map((row) => ({ x: Number(row[sx]), y: Number(row[sy]), z: 1 }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    }
    if (chartKind === "bubble") {
      return r
        .map((row) => ({ x: Number(row[bx]), y: Number(row[by]), z: Number(row[bz]) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
    }
    return [];
  }, [sampleOut, chartKind, sx, sy, bx, by, bz]);

  // Pearson correlation coefficient (client-side, from scatter sample)
  const pearsonR = useMemo(() => {
    if (chartKind !== "scatter" || scatterPoints.length < 5) return null;
    const n = scatterPoints.length;
    const mx = scatterPoints.reduce((s, p) => s + p.x, 0) / n;
    const my = scatterPoints.reduce((s, p) => s + p.y, 0) / n;
    const num = scatterPoints.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
    const dx = Math.sqrt(scatterPoints.reduce((s, p) => s + (p.x - mx) ** 2, 0));
    const dy = Math.sqrt(scatterPoints.reduce((s, p) => s + (p.y - my) ** 2, 0));
    if (dx < 1e-9 || dy < 1e-9) return null;
    const r = num / (dx * dy);
    return Number.isFinite(r) ? r : null;
  }, [chartKind, scatterPoints]);

  // Boxplot — derived from profile stats, no extra API call needed.
  // Uses profile.profiles directly (full numeric stats: min/p25/p50/p75/max).
  // UiColumn.numeric only carries {mean, std} so numericCols cannot be used here.
  //
  // Strategy: single Bar per column, dataKey="value" = s_max (shifted max).
  // recharts sets bar height = pixels for [0 → s_max], giving us the Y scale.
  // BoxPlotShape uses that scale to draw every element at the correct pixel y.
  // Shift = max(0, -globalMin) lifts all values so every s_* >= 0 (recharts
  // stacked bars and the linear scale both require a non-negative domain start).
  const boxplotInfo = useMemo(() => {
    if (!profile) return { data: [], shift: 0 };

    const validCols = profile.profiles.filter(
      (c) =>
        c.kind === "numeric" &&
        c.numeric?.min != null &&
        c.numeric.p25 != null &&
        c.numeric.p50 != null &&
        c.numeric.p75 != null &&
        c.numeric.max != null &&
        boxplotCols.includes(c.name),
    );

    if (!validCols.length) return { data: [], shift: 0 };

    const globalMin = Math.min(...validCols.map((c) => c.numeric!.min!));
    const shift = Math.max(0, -globalMin);

    const data = validCols.map((col, i) => {
      const { min, p25, p50, p75, max } = col.numeric!;
      const s_min = min! + shift;
      const s_p25 = p25! + shift;
      const s_p50 = p50! + shift;
      const s_p75 = p75! + shift;
      const s_max = max! + shift;
      return {
        name: col.name,        // full name — YAxis uses it as category label
        value: s_max,          // Bar width covers [0 → s_max] → full X range
        s_min, s_p25, s_p50, s_p75, s_max,
        _min: min!, _p25: p25!, _p50: p50!, _p75: p75!, _max: max!,
        fill: COLORS[i % COLORS.length],
      };
    });

    return { data, shift };
  }, [profile, boxplotCols]);

  // Build a standalone SVG string from correlation matrix data (for heatmap export)
  const buildHeatmapSvg = useCallback((data: NonNullable<typeof heatmapData>): string => {
    const cols = data.columns;
    const n = cols.length;
    const cell = Math.min(64, Math.max(32, Math.floor(780 / (n + 1))));
    const labelW = 140;
    const W = labelW + n * cell;
    const H = labelW + n * cell;
    const fs = Math.min(11, Math.max(8, Math.floor(cell * 0.22)));
    const trunc = (s: string, max = 16) => (s.length > max ? `${s.slice(0, max)}…` : s);

    const corrColor = (v: number) => {
      const x = Math.max(-1, Math.min(1, v));
      const t = Math.abs(x);
      const mid = [248, 250, 252];
      const pos = [37, 99, 235];
      const neg = [220, 38, 38];
      const base = x >= 0 ? pos : neg;
      return `rgb(${Math.round(mid[0] + (base[0] - mid[0]) * t)},${Math.round(mid[1] + (base[1] - mid[1]) * t)},${Math.round(mid[2] + (base[2] - mid[2]) * t)})`;
    };
    const textColor = (rgb: string) => {
      const nums = rgb.match(/\d+/g)?.map(Number);
      if (!nums) return "#0f172a";
      const lum = 0.2126 * nums[0] + 0.7152 * nums[1] + 0.0722 * nums[2];
      return lum < 140 ? "#ffffff" : "#0f172a";
    };

    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
    s += `<rect width="${W}" height="${H}" fill="white"/>`;
    s += `<rect width="${labelW}" height="${H}" fill="#f8fafc"/>`;
    s += `<rect width="${W}" height="${labelW}" fill="#f8fafc"/>`;

    // column headers (rotated -45°)
    cols.forEach((col, j) => {
      const cx = labelW + j * cell + cell / 2;
      s += `<text x="${cx}" y="${labelW - 6}" font-size="${fs}" font-family="system-ui,sans-serif" fill="#475569" text-anchor="start" transform="rotate(-45 ${cx} ${labelW - 6})">${trunc(col)}</text>`;
    });
    // row headers
    cols.forEach((col, i) => {
      const cy = labelW + i * cell + cell / 2 + fs / 3;
      s += `<text x="${labelW - 6}" y="${cy}" font-size="${fs}" font-family="system-ui,sans-serif" fill="#475569" text-anchor="end">${trunc(col)}</text>`;
    });
    // cells
    cols.forEach((_, i) => {
      cols.forEach((_, j) => {
        const v = data.matrix?.[i]?.[j] ?? 0;
        const bg = corrColor(Number(v));
        const fg = textColor(bg);
        const x = labelW + j * cell;
        const y = labelW + i * cell;
        s += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${bg}" stroke="white" stroke-width="0.5"/>`;
        if (cell >= 28) {
          s += `<text x="${x + cell / 2}" y="${y + cell / 2 + fs / 3}" font-size="${fs}" font-family="system-ui,sans-serif" fill="${fg}" text-anchor="middle">${Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "—"}</text>`;
        }
      });
    });
    s += "</svg>";
    return s;
  }, [heatmapData]);

  // Trigger SVG-to-PNG download given a raw SVG string
  const downloadSvgAsPng = useCallback((svgData: string, filename: string) => {
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * 2;
      canvas.height = img.naturalHeight * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = filename;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = filename.replace(".png", ".svg");
      a.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
      a.click();
    };
    img.src = url;
  }, []);

  // Export current chart as PNG (falls back to SVG if canvas rendering fails)
  const handleExport = useCallback(() => {
    // Heatmap: built from correlation data (no recharts SVG available)
    if (chartKind === "heatmap") {
      if (!heatmapData) return;
      downloadSvgAsPng(buildHeatmapSvg(heatmapData), `chart-heatmap-${Date.now()}.png`);
      return;
    }

    const container = chartContainerRef.current;
    if (!container) return;
    const svg = container.querySelector("svg");
    if (!svg) return;

    const { width, height } = svg.getBoundingClientRect();
    const w = width || 800;
    const h = height || 480;

    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "white");
    clone.insertBefore(bg, clone.firstChild);

    const svgData = new XMLSerializer().serializeToString(clone);
    downloadSvgAsPng(svgData, `chart-${chartKind}-${Date.now()}.png`);
  }, [chartKind, heatmapData, buildHeatmapSvg, downloadSvgAsPng]);

  if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;
  if (!activeDatasetId && !activeVersionId) return <AppLayout><div className="p-6">Aucun dataset ou version disponible</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to={`/projects/${projectId}/database`} className="hover:text-foreground transition-colors">
            Base de données
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Visualisation</span>
        </div>

        {/* Hero — compact */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
          <div className="absolute inset-0 pointer-events-none opacity-40 [background:radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.18),transparent_40%),radial-gradient(circle_at_90%_30%,rgba(99,102,241,0.14),transparent_45%)]" />
          <div className="relative p-5 md:p-7 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Visualisation des données
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Projet&nbsp;<b>#{projectId}</b> &middot; {sourceType === "version" ? `Version #${activeVersionId}` : `Dataset #${activeDatasetId}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Rafraîchir
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Exporter PNG
              </Button>
            </div>
          </div>
        </div>

        {/* Dataset info strip */}
        {overview && columns.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Lignes",        value: overview.shape.rows.toLocaleString("fr-FR"), cls: "" },
              { label: "Colonnes",      value: String(overview.shape.cols),                 cls: "" },
              { label: "Numériques",    value: String(numericCols.length),                  cls: "text-blue-600 dark:text-blue-400" },
              { label: "Catégorielles", value: String(categoricalCols.length),              cls: "text-purple-600 dark:text-purple-400" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
                <span className="text-muted-foreground text-xs">{label}</span>
                <span className={`font-semibold ${cls}`}>{value}</span>
              </div>
            ))}
            {(() => {
              const tot = columns.reduce((s, c) => s + c.missing, 0);
              const cells = overview.shape.rows * overview.shape.cols;
              if (!cells || !tot) return null;
              const pct = (tot / cells) * 100;
              return (
                <div className={`flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm ${pct > 10 ? "border-amber-300 dark:border-amber-700" : ""}`}>
                  <span className="text-muted-foreground text-xs">Valeurs manquantes</span>
                  <span className={`font-semibold ${pct > 10 ? "text-amber-600 dark:text-amber-400" : ""}`}>{pct.toFixed(1)}%</span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Tabs: Graphiques / Tests Statistiques */}
        <Tabs defaultValue="charts">
          <TabsList className="mb-4">
            <TabsTrigger value="charts">Graphiques</TabsTrigger>
            <TabsTrigger value="normality">Tests Statistiques</TabsTrigger>
          </TabsList>

          <TabsContent value="normality">
            <NormalityTestPanel
              projectId={projectId}
              activeDatasetId={activeDatasetId ?? 0}
              columns={columns}
              versionId={sourceType === "version" ? activeVersionId : null}
            />
          </TabsContent>

          <TabsContent value="charts">
        {/* Main studio card */}
        <Card className="rounded-3xl overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-col gap-4">
              {/* Grouped chart type selector */}
              <div className="flex flex-wrap items-end gap-4">
                {CHART_GROUPS.map((group) => (
                  <div key={group.label} className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/60 pl-0.5">
                      {group.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {group.items.map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          onClick={() => setChartKind(key)}
                          title={label}
                          className={[
                            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition",
                            chartKind === key
                              ? "bg-white dark:bg-slate-900 border-primary shadow-sm text-foreground font-medium"
                              : "bg-transparent border-transparent hover:bg-white/60 dark:hover:bg-slate-900/60 hover:border-border text-muted-foreground",
                          ].join(" ")}
                        >
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${chartKind === key ? "text-primary" : ""}`} />
                          <span className="hidden sm:inline">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
                {/* Source selector */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Source</p>
                  <div className="flex rounded-xl border overflow-hidden">
                    <button
                      className={`flex-1 px-3 py-2 text-sm transition ${sourceType === "dataset" ? "bg-white dark:bg-slate-900 font-medium" : "bg-transparent text-muted-foreground hover:bg-muted/50"}`}
                      onClick={() => setSourceType("dataset")}
                    >
                      Dataset
                    </button>
                    <button
                      className={`flex-1 px-3 py-2 text-sm transition border-l ${sourceType === "version" ? "bg-white dark:bg-slate-900 font-medium" : "bg-transparent text-muted-foreground hover:bg-muted/50"}`}
                      onClick={() => setSourceType("version")}
                    >
                      Version
                    </button>
                  </div>
                </div>

                {/* Dataset / Version picker */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {sourceType === "version" ? "Version" : "Dataset"}
                  </p>
                  {sourceType === "version" ? (
                    <Select
                      value={String(activeVersionId ?? "")}
                      onValueChange={(v) => setActiveVersionId(Number(v))}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choisir une version" /></SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={String(activeDatasetId)} onValueChange={(v) => load({ forceDatasetId: Number(v) })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {datasets.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.original_name ?? `Dataset #${d.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* TopK (aggregate + pie/doughnut) */}
                {needs.showTopK && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Top K</p>
                    <Select value={String(topK)} onValueChange={(v) => setTopK(Number(v))}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[5, 8, 10, 15, 20, 30, 50].map((k) => (
                          <SelectItem key={k} value={String(k)}>Top {k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* X (categorical) */}
                {needs.showXCat && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Axe X (catégoriel)</p>
                    <ColSelect value={xCat} onChange={setXCat} cols={categoricalCols} placeholder="Choisir X" />
                  </div>
                )}

                {/* Y (numeric) - only if agg != count */}
                {needs.showYNum && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Axe Y (numérique)</p>
                    <ColSelect value={yNum} onChange={setYNum} cols={numericCols} placeholder="Choisir Y" />
                  </div>
                )}

                {/* Agg */}
                {needs.showAgg && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Agrégation</p>
                    <Select value={agg} onValueChange={(v) => setAgg(v as AggFn)}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">count</SelectItem>
                        <SelectItem value="sum">sum</SelectItem>
                        <SelectItem value="avg">avg</SelectItem>
                        <SelectItem value="min">min</SelectItem>
                        <SelectItem value="max">max</SelectItem>
                        <SelectItem value="median">median</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Pie column */}
                {needs.showPieCol && (
                  <div className="space-y-1 lg:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground">Colonne (catégorielle)</p>
                    <ColSelect value={pieCol} onChange={setPieCol} cols={categoricalCols} placeholder="Choisir colonne" />
                  </div>
                )}

                {/* Histogram controls */}
                {needs.showHist && (
                  <>
                    <div className="space-y-1 lg:col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">Colonne numérique</p>
                      <ColSelect value={histCol} onChange={setHistCol} cols={numericCols} placeholder="Choisir colonne" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Bins</p>
                      <Select value={String(histBins)} onValueChange={(v) => setHistBins(Number(v))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[10, 15, 20, 30, 40, 60].map((b) => (
                            <SelectItem key={b} value={String(b)}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Boxplot column selector */}
                {needs.showBoxplot && (
                  <div className="space-y-1 lg:col-span-3">
                    <p className="text-xs font-medium text-muted-foreground">Colonnes à afficher</p>
                    {allBoxplotCols.length === 0 ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Aucune colonne numérique</Badge>
                    ) : (
                      <MultiColSelect
                        triggerLabel="Choisir colonnes"
                        all={allBoxplotCols}
                        selected={boxplotCols}
                        onToggle={(col) => setBoxplotCols((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col])}
                        onSelectAll={() => setBoxplotCols(allBoxplotCols)}
                        onClearAll={() => setBoxplotCols([])}
                      />
                    )}
                  </div>
                )}

                {/* Scatter controls */}
                {needs.showScatter && (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">X (numérique)</p>
                      <ColSelect value={sx} onChange={setSx} cols={numericCols} placeholder="Choisir X" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Y (numérique)</p>
                      <ColSelect value={sy} onChange={setSy} cols={numericCols} placeholder="Choisir Y" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Échantillon</p>
                      <Select value={String(sampleN)} onValueChange={(v) => setSampleN(Number(v))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[100, 200, 400, 800, 1500].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n} points</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Bubble controls */}
                {needs.showBubble && (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">X (num)</p>
                      <ColSelect value={bx} onChange={setBx} cols={numericCols} placeholder="Choisir X" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Y (num)</p>
                      <ColSelect value={by} onChange={setBy} cols={numericCols} placeholder="Choisir Y" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Z (taille)</p>
                      <ColSelect value={bz} onChange={setBz} cols={numericCols} placeholder="Choisir Z" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Échantillon</p>
                      <Select value={String(sampleN)} onValueChange={(v) => setSampleN(Number(v))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[100, 200, 400, 800, 1500].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n} points</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Radar column selector */}
                {needs.showRadar && (
                  <div className="space-y-1 lg:col-span-3">
                    <p className="text-xs font-medium text-muted-foreground">Colonnes radar</p>
                    {allRadarCols.length === 0 ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Aucune colonne numérique</Badge>
                    ) : (
                      <>
                        <MultiColSelect
                          triggerLabel="Choisir colonnes"
                          all={allRadarCols}
                          selected={radarCols}
                          onToggle={(col) => setRadarCols((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : prev.length < 8 ? [...prev, col] : prev)}
                          onSelectAll={() => setRadarCols(allRadarCols.slice(0, 8))}
                          onClearAll={() => setRadarCols([])}
                          maxItems={8}
                        />
                        {radarCols.length > 0 && radarCols.length < 3 && (
                          <p className="text-xs text-amber-500">&#9888; min. 3 colonnes requises</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full">
                  {chartKind.toUpperCase()}
                </Badge>

                {isAggChart && xCat && (
                  <span className="text-sm text-muted-foreground">
                    {shortLabel(xCat)} → <b className="text-foreground">{seriesLabel}</b> (Top {topK})
                  </span>
                )}

                {isPieChart && pieCol && (
                  <span className="text-sm text-muted-foreground">
                    Comptage : <b className="text-foreground">{shortLabel(pieCol)}</b> (Top {topK} + Autres)
                  </span>
                )}

                {chartKind === "hist" && histCol && (
                  <span className="text-sm text-muted-foreground">
                    Distribution : <b className="text-foreground">{shortLabel(histCol)}</b> ({histBins} bins)
                  </span>
                )}

                {(chartKind === "scatter") && sx && sy && (
                  <span className="text-sm text-muted-foreground">
                    {shortLabel(sx)} vs {shortLabel(sy)} ({sampleN})
                  </span>
                )}

                {(chartKind === "bubble") && bx && by && bz && (
                  <span className="text-sm text-muted-foreground">
                    {shortLabel(bx)} vs {shortLabel(by)} | taille={shortLabel(bz)} ({sampleN} pts)
                  </span>
                )}

                {chartKind === "boxplot" && boxplotInfo.data.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {boxplotInfo.data.length} colonne{boxplotInfo.data.length > 1 ? "s" : ""} &middot; IQR [P25–P75]
                  </span>
                )}

                {chartKind === "radar" && radarData.length >= 3 && (
                  <span className="text-sm text-muted-foreground">
                    {radarData.length} colonnes &middot; moyennes normalisées
                  </span>
                )}
              </div>

            </div>

            <div ref={chartContainerRef}>
            {chartKind === "heatmap" ? (
              <div className="rounded-2xl border bg-card overflow-hidden">
                <div className="min-h-[640px]">
                  <CorrelationHeatmap
                    projectId={projectId}
                    datasetId={sourceType === "version" ? null : activeDatasetId}
                    versionId={sourceType === "version" ? activeVersionId : null}
                    dtypes={overview?.dtypes ?? {}}
                    maxCols={20}
                    topPairs={8}
                    onDataReady={setHeatmapData}
                  />
                </div>
              </div>
            ) : chartKind === "boxplot" ? (
              <>
                <div className="rounded-2xl border bg-card overflow-hidden">
                  {boxplotInfo.data.length === 0 ? (
                    <div className="h-[320px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <BoxSelect className="h-10 w-10 opacity-20" />
                      <p className="text-sm">
                        {allBoxplotCols.length === 0
                          ? "Aucune colonne numérique disponible"
                          : "Sélectionner au moins une colonne"}
                      </p>
                    </div>
                  ) : (
                    <>
                      <ChartHeader
                        title="Distribution — Boîtes à moustaches"
                        subtitle={`${boxplotInfo.data.length} colonne${boxplotInfo.data.length > 1 ? "s" : ""} · IQR [P25–P75]`}
                      />
                      <div className="p-4 pt-2">
                        <ResponsiveContainer
                          width="100%"
                          height={Math.max(280, boxplotInfo.data.length * 58 + 40)}
                        >
                          <BarChart
                            layout="vertical"
                            data={boxplotInfo.data}
                            margin={{ top: 10, right: 40, bottom: 10, left: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                            <XAxis
                              type="number"
                              domain={[0, "auto"]}
                              tickFormatter={(v) => fmtN(v - boxplotInfo.shift, 1)}
                              className="text-xs"
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={155}
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v) => shortLabel(String(v), 22)}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                if (!d) return null;
                                return (
                                  <div className="bg-card border rounded-xl p-3 text-xs shadow space-y-0.5 min-w-[150px]">
                                    <p className="font-semibold mb-1 text-sm truncate max-w-[180px]">{d.name}</p>
                                    <p className="text-muted-foreground">Max     : <span className="text-foreground font-medium">{fmtN(d._max)}</span></p>
                                    <p className="text-muted-foreground">P75     : <span className="text-foreground font-medium">{fmtN(d._p75)}</span></p>
                                    <p className="font-semibold" style={{ color: d.fill }}>Médiane : {fmtN(d._p50)}</p>
                                    <p className="text-muted-foreground">P25     : <span className="text-foreground font-medium">{fmtN(d._p25)}</span></p>
                                    <p className="text-muted-foreground">Min     : <span className="text-foreground font-medium">{fmtN(d._min)}</span></p>
                                  </div>
                                );
                              }}
                            />
                            <Bar dataKey="value" isAnimationActive={false} shape={<BoxPlotShape />}>
                              {boxplotInfo.data.map((entry) => (
                                <Cell key={entry.name} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </div>

                {/* Boxplot legend */}
                {boxplotInfo.data.length > 0 && (
                  <div className="mt-3 rounded-xl border bg-muted/20 p-3 space-y-3">
                    {/* Visual key */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { color: "bg-slate-400", label: "Min / Max", desc: "Moustaches (extrêmes)" },
                        { color: "bg-primary/30 border border-primary", label: "Boîte IQR", desc: "P25 à P75 (50 % central)" },
                        { color: "bg-primary", label: "Médiane", desc: "P50 (trait central)" },
                        { color: "bg-transparent", label: "Tooltip", desc: "Cliquer pour les stats" },
                      ].map(({ color, label, desc }) => (
                        <div key={label} className="flex items-start gap-2">
                          <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-sm ${color}`} />
                          <div>
                            <p className="text-xs font-medium leading-tight">{label}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Per-column stats */}
                    <div className="border-t pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-1.5 gap-x-6">
                      {boxplotInfo.data.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 text-xs min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                          <span className="truncate text-muted-foreground flex-1" title={d.name}>{shortLabel(d.name, 22)}</span>
                          <span className="tabular-nums shrink-0 text-muted-foreground text-[10px]">
                            {fmtN(d._min, 1)} – <span className="text-foreground font-medium">{fmtN(d._p50, 1)}</span> – {fmtN(d._max, 1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Chart container — relative for loading overlay */}
                <div className="relative rounded-2xl border bg-card overflow-hidden">
                  {/* Loading spinner overlay */}
                  {chartLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
                      <RefreshCw className="h-7 w-7 animate-spin text-primary/70" />
                    </div>
                  )}

                  {/* ── BAR / LINE / AREA ───────────────────────────────── */}
                  {isAggChart && (
                    !xCat ? (
                      <EmptyChart message="Aucune colonne catégorielle disponible pour l'axe X" />
                    ) : !aggOut || aggOut.rows.length === 0 ? (
                      <EmptyChart message={chartLoading ? "" : "Aucun résultat pour ces paramètres"} />
                    ) : (
                      <>
                        <ChartHeader
                          title={`${AGG_TITLES[chartKind as "bar" | "line" | "area"]} par ${shortLabel(xCat, 30)}`}
                          subtitle={agg === "count" ? `Nombre d'occurrences · Top ${topK}` : `${agg.toUpperCase()}(${shortLabel(yNum, 22)}) · Top ${topK}`}
                        />
                        <ResponsiveContainer width="100%" height={420}>
                          {chartKind === "bar" ? (
                            <BarChart data={aggOut.rows} margin={{ top: 10, right: 20, bottom: 60, left: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="x" tickFormatter={(v) => shortLabel(String(v), 14)} className="text-xs" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={56} />
                              <YAxis className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : v, seriesLabel]} />
                              <Bar dataKey="y" name={seriesLabel} fill="hsl(221, 83%, 53%)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                            </BarChart>
                          ) : chartKind === "line" ? (
                            <LineChart data={aggOut.rows} margin={{ top: 10, right: 20, bottom: 60, left: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="x" tickFormatter={(v) => shortLabel(String(v), 14)} className="text-xs" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={56} />
                              <YAxis className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : v, seriesLabel]} />
                              <Line type="monotone" dataKey="y" name={seriesLabel} stroke="hsl(221, 83%, 53%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                            </LineChart>
                          ) : (
                            <AreaChart data={aggOut.rows} margin={{ top: 10, right: 20, bottom: 60, left: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="x" tickFormatter={(v) => shortLabel(String(v), 14)} className="text-xs" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={56} />
                              <YAxis className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : v, seriesLabel]} />
                              <Area type="monotone" dataKey="y" name={seriesLabel} stroke="hsl(221, 83%, 53%)" fill="hsl(221, 83%, 53%)" fillOpacity={0.15} strokeWidth={2} />
                            </AreaChart>
                          )}
                        </ResponsiveContainer>
                      </>
                    )
                  )}

                  {/* ── PIE / DOUGHNUT ──────────────────────────────────── */}
                  {isPieChart && (
                    !pieCol ? (
                      <EmptyChart icon={<PieIcon className="h-10 w-10 opacity-20" />} message="Aucune colonne catégorielle disponible" />
                    ) : !countsOut || pieData.length === 0 ? (
                      <EmptyChart icon={<PieIcon className="h-10 w-10 opacity-20" />} message={chartLoading ? "" : "Aucun résultat"} />
                    ) : (
                      <>
                        <ChartHeader
                          title={chartKind === "doughnut" ? `Composition — ${shortLabel(pieCol, 30)}` : `Répartition — ${shortLabel(pieCol, 30)}`}
                          subtitle={`Top ${topK}${countsOut.others_count > 0 ? ` + Autres (${countsOut.others_count.toLocaleString("fr-FR")})` : ""} · ${countsOut.total_count.toLocaleString("fr-FR")} au total`}
                        />
                        <ResponsiveContainer width="100%" height={420}>
                          <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={155} innerRadius={chartKind === "doughnut" ? 95 : 0} labelLine={false} label={false}>
                              {pieData.map((entry, idx) => (
                                <Cell key={`${entry.name}-${idx}`} fill={(entry as any).fill} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [typeof v === "number" ? v.toLocaleString() : v, "Occurrences"]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </>
                    )
                  )}

                  {/* ── HISTOGRAM ───────────────────────────────────────── */}
                  {chartKind === "hist" && (
                    !histCol ? (
                      <EmptyChart message="Aucune colonne numérique disponible" />
                    ) : !histOut || histBars.length === 0 ? (
                      <EmptyChart message={chartLoading ? "" : "Aucun résultat"} />
                    ) : (
                      <>
                        <ChartHeader
                          title={`Distribution — ${shortLabel(histCol, 30)}`}
                          subtitle={`${histBins} bins · ${histOut.rows.reduce((s, b) => s + b.count, 0).toLocaleString("fr-FR")} valeurs`}
                        />
                        <ResponsiveContainer width="100%" height={420}>
                          <BarChart data={histBars} margin={{ top: 10, right: 20, bottom: 60, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="bin" className="text-[10px]" angle={-30} textAnchor="end" height={56} interval={Math.max(0, Math.ceil(histBars.length / 10) - 1)} tick={{ fontSize: 10 }} />
                            <YAxis className="text-xs" tickFormatter={fmtAxisVal} width={52} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [typeof v === "number" ? v.toLocaleString() : v, "Fréquence"]} />
                            <Bar dataKey="count" name="Fréquence" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </>
                    )
                  )}

                  {/* ── RADAR ───────────────────────────────────────────── */}
                  {chartKind === "radar" && (
                    radarData.length < 3 ? (
                      <EmptyChart
                        icon={<RadarIcon className="h-10 w-10 opacity-20" />}
                        message={
                          allRadarCols.length === 0
                            ? "Aucune colonne numérique disponible"
                            : radarCols.length === 0
                            ? "Sélectionner des colonnes pour le radar"
                            : "Sélectionner au moins 3 colonnes"
                        }
                      />
                    ) : (
                      <>
                        <ChartHeader
                          title="Profil des moyennes"
                          subtitle={`${radarData.length} colonnes · valeurs normalisées [0–100]`}
                        />
                        <ResponsiveContainer width="100%" height={420}>
                          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={150}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} tickCount={4} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                if (!d) return null;
                                return (
                                  <div className="bg-card border rounded-xl p-2.5 text-xs shadow space-y-0.5">
                                    <p className="font-semibold mb-1 truncate max-w-[180px]">{d.fullName}</p>
                                    <p className="text-muted-foreground">Moyenne : <span className="text-foreground font-medium">{fmtN(d.mean)}</span></p>
                                    <p className="text-muted-foreground">Score norm. : <span className="text-foreground font-medium">{fmtN(d.value, 1)}</span></p>
                                  </div>
                                );
                              }}
                            />
                            <Radar dataKey="value" stroke="hsl(221, 83%, 53%)" fill="hsl(221, 83%, 53%)" fillOpacity={0.25} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </>
                    )
                  )}

                  {/* ── SCATTER ─────────────────────────────────────────── */}
                  {chartKind === "scatter" && (
                    !sx || !sy ? (
                      <EmptyChart icon={<ScatterIcon className="h-10 w-10 opacity-20" />} message="Sélectionner deux colonnes numériques" />
                    ) : !sampleOut || scatterPoints.length === 0 ? (
                      <EmptyChart icon={<ScatterIcon className="h-10 w-10 opacity-20" />} message={!chartLoading ? "Aucun point à afficher" : ""} />
                    ) : (
                      <>
                        <ChartHeader
                          title={`${shortLabel(sx, 22)} vs ${shortLabel(sy, 22)}`}
                          subtitle={`Nuage de points · ${scatterPoints.length.toLocaleString("fr-FR")} points échantillonnés`}
                        />
                        <ResponsiveContainer width="100%" height={420}>
                          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" dataKey="x" name={sx} className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                            <YAxis type="number" dataKey="y" name={sy} className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                            <ZAxis type="number" dataKey="z" range={[30, 30]} />
                            <Tooltip
                              cursor={{ strokeDasharray: "3 3" }}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                if (!d) return null;
                                return (
                                  <div className="bg-card border rounded-xl p-2.5 text-xs shadow space-y-0.5">
                                    <p className="text-muted-foreground">{shortLabel(sx, 22)}: <span className="text-foreground font-medium">{fmtN(d.x)}</span></p>
                                    <p className="text-muted-foreground">{shortLabel(sy, 22)}: <span className="text-foreground font-medium">{fmtN(d.y)}</span></p>
                                  </div>
                                );
                              }}
                            />
                            <Scatter name="Points" data={scatterPoints} fill="hsl(262, 83%, 58%)" fillOpacity={0.6} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </>
                    )
                  )}

                  {/* ── BUBBLE ──────────────────────────────────────────── */}
                  {chartKind === "bubble" && (
                    !bx || !by || !bz ? (
                      <EmptyChart icon={<CircleDot className="h-10 w-10 opacity-20" />} message="Sélectionner trois colonnes numériques (X, Y, taille)" />
                    ) : !sampleOut || scatterPoints.length === 0 ? (
                      <EmptyChart icon={<CircleDot className="h-10 w-10 opacity-20" />} message={!chartLoading ? "Aucun point à afficher" : ""} />
                    ) : (
                      <>
                        <ChartHeader
                          title={`${shortLabel(bx, 18)} / ${shortLabel(by, 18)} / ${shortLabel(bz, 18)}`}
                          subtitle={`Bulles · taille = ${shortLabel(bz, 22)} · ${scatterPoints.length.toLocaleString("fr-FR")} points`}
                        />
                        <ResponsiveContainer width="100%" height={420}>
                          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" dataKey="x" name={bx} className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                            <YAxis type="number" dataKey="y" name={by} className="text-xs" tickFormatter={fmtAxisVal} width={60} />
                            <ZAxis type="number" dataKey="z" name={bz} range={[40, 500]} />
                            <Tooltip
                              cursor={{ strokeDasharray: "3 3" }}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                if (!d) return null;
                                return (
                                  <div className="bg-card border rounded-xl p-2.5 text-xs shadow space-y-0.5">
                                    <p className="text-muted-foreground">{shortLabel(bx, 22)}: <span className="text-foreground font-medium">{fmtN(d.x)}</span></p>
                                    <p className="text-muted-foreground">{shortLabel(by, 22)}: <span className="text-foreground font-medium">{fmtN(d.y)}</span></p>
                                    <p className="text-muted-foreground">{shortLabel(bz, 22)}: <span className="text-foreground font-medium">{fmtN(d.z)}</span></p>
                                  </div>
                                );
                              }}
                            />
                            <Scatter name="Bulles" data={scatterPoints} fill="hsl(174, 84%, 32%)" fillOpacity={0.65} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </>
                    )
                  )}
                </div>

                {/* ── LÉGENDES ──────────────────────────────────────────── */}

                {/* Agrégation (bar/line/area) */}
                {isAggChart && aggOut && aggOut.rows.length > 0 && (
                  <div className="mt-3 rounded-xl border bg-muted/20 px-4 py-2.5 flex items-center gap-3">
                    <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: "hsl(221, 83%, 53%)" }} />
                    <span className="text-xs font-medium">{seriesLabel}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {aggOut.rows.length} catégorie{aggOut.rows.length > 1 ? "s" : ""}
                      {agg !== "count" && (
                        <> · total {aggOut.rows.reduce((s, r) => s + (r.y ?? 0), 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</>
                      )}
                    </span>
                  </div>
                )}

                {/* Pie / Doughnut */}
                {isPieChart && pieData.length > 0 && (
                  <div className="mt-3 rounded-2xl border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-semibold">Légende</span>
                      <span className="text-muted-foreground">{countsOut?.total_count.toLocaleString("fr-FR")} occurrences au total</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-8 max-h-36 overflow-auto pr-1">
                      {pieData.map((d, idx) => {
                        const pct = countsOut?.total_count
                          ? (((d as any).value / countsOut.total_count) * 100).toFixed(1)
                          : null;
                        return (
                          <div key={`${(d as any).name}-${idx}`} className="grid items-center gap-3 grid-cols-[minmax(0,12rem)_4.5rem]">
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: (d as any).fill }} />
                              <span className="truncate text-xs">{(d as any).name}</span>
                            </div>
                            <div className="text-right">
                              <span className="tabular-nums text-xs font-semibold">{Number((d as any).value).toLocaleString()}</span>
                              {pct && <span className="text-muted-foreground text-[10px] ml-1">({pct}%)</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Histogramme — statistiques descriptives */}
                {chartKind === "hist" && histCol && histBars.length > 0 && profile && (() => {
                  const col = profile.profiles.find((c) => c.name === histCol);
                  const n = col?.numeric;
                  if (!n) return null;
                  const stats = [
                    { label: "N",       v: n.count, d: 0 },
                    { label: "Moy.",    v: n.mean,  d: 3 },
                    { label: "Std",     v: n.std,   d: 3 },
                    { label: "Min",     v: n.min,   d: 3 },
                    { label: "P25",     v: n.p25,   d: 3 },
                    { label: "Médiane", v: n.p50,   d: 3 },
                    { label: "P75",     v: n.p75,   d: 3 },
                    { label: "Max",     v: n.max,   d: 3 },
                  ];
                  return (
                    <div className="mt-3 rounded-xl border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: "hsl(262, 83%, 58%)" }} />
                        <span className="text-xs font-semibold truncate flex-1" title={histCol}>{histCol}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">Statistiques descriptives</span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {stats.map(({ label, v, d }) => (
                          <div key={label} className="text-center">
                            <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                            <p className="text-xs font-semibold tabular-nums">{fmtN(v as number | null | undefined, d)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Scatter — axes + Pearson r */}
                {chartKind === "scatter" && scatterPoints.length > 0 && (
                  <div className="mt-3 rounded-xl border bg-muted/20 p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Axe X</p>
                        <p className="text-xs font-semibold truncate" title={sx}>{shortLabel(sx, 18)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Axe Y</p>
                        <p className="text-xs font-semibold truncate" title={sy}>{shortLabel(sy, 18)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Points</p>
                        <p className="text-xs font-semibold tabular-nums">{scatterPoints.length.toLocaleString("fr-FR")}</p>
                      </div>
                      {pearsonR !== null && (
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Pearson r</p>
                          <p className={`text-xs font-semibold tabular-nums ${Math.abs(pearsonR) >= 0.7 ? "text-primary" : ""}`}>
                            {pearsonR.toFixed(3)}&nbsp;
                            <span className="font-normal text-muted-foreground">
                              ({Math.abs(pearsonR) >= 0.7 ? "forte" : Math.abs(pearsonR) >= 0.4 ? "modérée" : "faible"})
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bubble — axes */}
                {chartKind === "bubble" && scatterPoints.length > 0 && (
                  <div className="mt-3 rounded-xl border bg-muted/20 p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Axe X",      v: bx },
                        { label: "Axe Y",      v: by },
                        { label: "Taille (Z)", v: bz },
                        { label: "Points",     v: scatterPoints.length.toLocaleString("fr-FR") },
                      ].map(({ label, v }) => (
                        <div key={label} className="text-center">
                          <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                          <p className="text-xs font-semibold truncate" title={v}>{shortLabel(v, 18)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Radar — moyennes réelles */}
                {chartKind === "radar" && radarData.length >= 3 && (
                  <div className="mt-3 rounded-xl border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between px-1 text-xs">
                      <span className="font-semibold">Légende · moyennes réelles</span>
                      <span className="text-muted-foreground">{radarData.length} colonnes</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {radarData.map((d, i) => (
                        <div key={d.metric} className="flex items-center gap-2 text-xs min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="truncate text-muted-foreground flex-1" title={d.fullName}>{d.metric}</span>
                          <span className="font-semibold tabular-nums shrink-0">{fmtN(d.mean, 2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            </div>{/* end chartContainerRef */}

            {CHART_HINT[isAggChart ? "agg" : isPieChart ? "pie" : chartKind] && (
              <p className="mt-3 text-xs text-muted-foreground">
                {CHART_HINT[isAggChart ? "agg" : isPieChart ? "pie" : chartKind]}
              </p>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default ChartsPage;
