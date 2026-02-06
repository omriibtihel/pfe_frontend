import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BarChart2,
  BarChart3,
  ChevronRight,
  Download,
  RefreshCw,
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
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import { useToast } from "@/hooks/use-toast";

import datasetService, { DatasetOut as DatasetListItem } from "@/services/datasetService";
import databaseService, {
  DatasetOverviewOut,
  DatasetProfileOut,
  AggFn,
  AggregateOut,
  ValueCountsOut,
  SampleOut,
  HistogramOut,
} from "@/services/databaseService";

import CorrelationHeatmap from "@/components/ui/CorrelationHeatmap";

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

const CHART_TABS: { key: ChartKind; label: string; Icon: any }[] = [
  { key: "bar", label: "Bar", Icon: BarChart3 },
  { key: "line", label: "Line", Icon: LineIcon },
  { key: "area", label: "Area", Icon: AreaIcon },
  { key: "pie", label: "Pie", Icon: PieIcon },
  { key: "doughnut", label: "Anneau", Icon: PieIcon },
  { key: "hist", label: "Histogram", Icon: BarChart2 },
  { key: "scatter", label: "Scatter", Icon: ScatterIcon },
  { key: "bubble", label: "Bubble", Icon: CircleDot },
  { key: "radar", label: "Radar", Icon: RadarIcon },
  { key: "heatmap", label: "Corrélation", Icon: Grid3X3 },
];

function shortLabel(s: string, n = 18) {
  if (!s) return s;
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function pickDefault(cols: UiColumn[], fallback = "") {
  return cols[0]?.name ?? fallback;
}

function ChartLegendRow({
  items,
}: {
  items: Array<{ label: string; color?: string; value?: number }>;
}) {
  if (!items.length) return null;

  return (
    <div className="mt-3 rounded-2xl border bg-muted/20 p-3">
      <div className="text-xs font-medium text-muted-foreground mb-2">Légende</div>

      {/* ↑ augmente gap-x pour éviter l’effet “collé au voisin” */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-8 max-h-28 overflow-auto pr-1">
        {items.map((it, idx) => (
          <div
            key={`${it.label}-${idx}`}
            className="grid items-center gap-3
                       grid-cols-[minmax(0,12rem)_3.5rem]"
          >
            {/* left: color + label (colonne FIXE, n’étire pas) */}
            <div className="min-w-0 flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-sm border"
                style={{ backgroundColor: it.color ?? "hsl(var(--muted-foreground))" }}
              />
              <span className="truncate">{it.label}</span>
            </div>

            {/* right: value (colonne FIXE) */}
            <span className="tabular-nums text-muted-foreground text-right">
              {typeof it.value === "number" ? it.value.toLocaleString() : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


export function ChartsPage() {
  const { id } = useParams();
  const projectId = id!;
  const { toast } = useToast();

  // load base data
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);

  const [overview, setOverview] = useState<DatasetOverviewOut | null>(null);
  const [profile, setProfile] = useState<DatasetProfileOut | null>(null);

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

  // heatmap
  const [heatCols, setHeatCols] = useState<string[]>([]);

  // chart results
  const [chartLoading, setChartLoading] = useState(false);
  const [aggOut, setAggOut] = useState<AggregateOut | null>(null);
  const [countsOut, setCountsOut] = useState<ValueCountsOut | null>(null);
  const [sampleOut, setSampleOut] = useState<SampleOut | null>(null);
  const [histOut, setHistOut] = useState<HistogramOut | null>(null);

  const load = async (opts?: { forceDatasetId?: number | null }) => {
    const forced = opts?.forceDatasetId ?? null;

    if (!isLoading) setIsRefreshing(true);
    else setIsRefreshing(false);

    try {
      const dsList = await datasetService.list(projectId);
      setDatasets(dsList as any);

      const active = await databaseService.getActiveDataset(projectId);
      const chosen = forced ?? active.active_dataset_id ?? (dsList?.[0]?.id ?? null);

      setActiveDatasetId(chosen);

      if (!chosen) {
        setOverview(null);
        setProfile(null);
        return;
      }

      // Profile top_k is about *profiling* (top values in stats), not charts
      const PROFILE_TOPK = 20;

      const [o, p] = await Promise.all([
        databaseService.getOverview(projectId, chosen, 10),
        databaseService.getProfile(projectId, chosen, PROFILE_TOPK),
      ]);

      setOverview(o);
      setProfile(p);
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
  };

  useEffect(() => {
    setIsLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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
      showScatter: chartKind === "scatter",
      showBubble: chartKind === "bubble",
      showRadar: chartKind === "radar",
      showHeatmap: chartKind === "heatmap",
    };
  }, [chartKind, isAggChart, isPieChart, showYForAgg]);

  // ---- Defaults / keep selections valid when dataset changes ----
  useEffect(() => {
    if (!columns.length) return;

    const defCat = pickDefault(categoricalCols);
    const defNum1 = pickDefault(numericCols);
    const defNum2 = numericCols[1]?.name ?? defNum1;
    const defNum3 = numericCols[2]?.name ?? defNum2;

    setXCat((p) => p || defCat);
    setYNum((p) => p || defNum1);

    setPieCol((p) => p || defCat);

    setHistCol((p) => p || defNum1);

    setSx((p) => p || defNum1);
    setSy((p) => p || defNum2);

    setBx((p) => p || defNum1);
    setBy((p) => p || defNum2);
    setBz((p) => p || defNum3);

    // Heatmap default: first 6 numeric
    setHeatCols((prev) => (prev.length ? prev : numericCols.slice(0, 6).map((c) => c.name)));

    // If there are no numeric columns, force count
    if (!numericCols.length) setAgg("count");

    // reset outputs
    setAggOut(null);
    setCountsOut(null);
    setSampleOut(null);
    setHistOut(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDatasetId, columns.length]);

  // ---- Fetch data depending on chart ----
  useEffect(() => {
    const ds = activeDatasetId;
    if (!ds) return;

    const run = async () => {
      setChartLoading(true);
      try {
        setAggOut(null);
        setCountsOut(null);
        setSampleOut(null);
        setHistOut(null);

        // Aggregate (bar/line/area)
        if (isAggChart) {
          if (!xCat) return;

          const res = await databaseService.aggregate(projectId, ds, {
            x: xCat,
            agg,
            top_k: topK,
            order: "desc",
            dropna: true,
            ...(agg !== "count" ? { y: yNum } : {}),
          });

          setAggOut(res);
          return;
        }

        // Pie/Doughnut (value counts)
        if (isPieChart) {
          if (!pieCol) return;
          const res = await databaseService.valueCounts(projectId, ds, {
            col: pieCol,
            top_k: topK,
            dropna: true,
          });
          setCountsOut(res);
          return;
        }

        // Histogram
        if (chartKind === "hist") {
          if (!histCol) return;
          const res = await databaseService.hist(projectId, ds, { col: histCol, bins: histBins, dropna: true });
          setHistOut(res);
          return;
        }

        // Scatter
        if (chartKind === "scatter") {
          if (!sx || !sy) return;
          const res = await databaseService.sample(projectId, ds, { cols: [sx, sy], n: sampleN });
          setSampleOut(res);
          return;
        }

        // Bubble
        if (chartKind === "bubble") {
          if (!bx || !by || !bz) return;
          const res = await databaseService.sample(projectId, ds, { cols: [bx, by, bz], n: sampleN });
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
    activeDatasetId,
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
    heatCols,
    isAggChart,
    isPieChart,
  ]);

  const onRefresh = async () => {
    await load({ forceDatasetId: activeDatasetId });
  };

  const rowsCount = overview?.shape?.rows ?? 0;

  const seriesLabel = useMemo(() => {
    if (!isAggChart) return "";
    return agg === "count" ? "count" : `${agg}(${yNum})`;
  }, [agg, yNum, isAggChart]);

  // Radar (profile-based)
  const radarData = useMemo(() => {
    const selected = numericCols.slice(0, 8);
    const means = selected.map((c) => c.numeric?.mean ?? 0);
    const maxAbs = Math.max(1e-9, ...means.map((v) => Math.abs(v)));
    return selected.map((c) => ({
      metric: c.name,
      value: ((c.numeric?.mean ?? 0) / maxAbs) * 100,
    }));
  }, [numericCols]);

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

  if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;
  if (!activeDatasetId) return <AppLayout><div className="p-6">Aucun dataset</div></AppLayout>;

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

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
          <div className="absolute inset-0 pointer-events-none opacity-50 [background:radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.15),transparent_40%),radial-gradient(circle_at_90%_30%,rgba(99,102,241,0.12),transparent_45%),radial-gradient(circle_at_40%_100%,rgba(16,185,129,0.10),transparent_40%)]" />
          <div className="relative p-6 md:p-10">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Visualisation des données
            </h1>
            <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
              Les axes et options s’adaptent automatiquement selon le type de graphique .
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Projet #{projectId}</Badge>
              <Badge variant="outline">Dataset #{activeDatasetId}</Badge>
              <Badge variant="outline">{rowsCount.toLocaleString()} lignes</Badge>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Rafraîchir
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4 mr-2" />
                Exporter (bientôt)
              </Button>
            </div>
          </div>
        </div>

        {/* Main studio card */}
        <Card className="rounded-3xl overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-col gap-4">
              {/* toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {CHART_TABS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setChartKind(key)}
                    className={[
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                      chartKind === key
                        ? "bg-white dark:bg-slate-900 border-primary shadow-sm"
                        : "bg-transparent hover:bg-white/60 dark:hover:bg-slate-900/60",
                    ].join(" ")}
                  >
                    <Icon className={`h-4 w-4 ${chartKind === key ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`${chartKind === key ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
                {/* Dataset */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Dataset</p>
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
                    <Select value={xCat} onValueChange={setXCat}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choisir X" /></SelectTrigger>
                      <SelectContent>
                        {categoricalCols.map((c) => (
                          <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Y (numeric) - only if agg != count */}
                {needs.showYNum && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Axe Y (numérique)</p>
                    <Select value={yNum} onValueChange={setYNum}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choisir Y" /></SelectTrigger>
                      <SelectContent>
                        {numericCols.map((c) => (
                          <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select value={pieCol} onValueChange={setPieCol}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choisir colonne" /></SelectTrigger>
                      <SelectContent>
                        {categoricalCols.map((c) => (
                          <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Histogram controls */}
                {needs.showHist && (
                  <>
                    <div className="space-y-1 lg:col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">Colonne numérique</p>
                      <Select value={histCol} onValueChange={setHistCol}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choisir colonne" /></SelectTrigger>
                        <SelectContent>
                          {numericCols.map((c) => (
                            <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

                {/* Scatter controls */}
                {needs.showScatter && (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">X (numérique)</p>
                      <Select value={sx} onValueChange={setSx}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {numericCols.map((c) => (
                            <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Y (numérique)</p>
                      <Select value={sy} onValueChange={setSy}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {numericCols.map((c) => (
                            <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Select value={bx} onValueChange={setBx}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {numericCols.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Y (num)</p>
                      <Select value={by} onValueChange={setBy}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {numericCols.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Z (taille)</p>
                      <Select value={bz} onValueChange={setBz}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {numericCols.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
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
                    {shortLabel(bx)} vs {shortLabel(by)} | size={shortLabel(bz)} ({sampleN})
                  </span>
                )}
              </div>

              {chartLoading && (
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Génération…
                </span>
              )}
            </div>

            {chartKind === "heatmap" ? (
              <div className="rounded-2xl border bg-card overflow-hidden">
                <div className="min-h-[640px]">
                  <CorrelationHeatmap
                    projectId={projectId}
                    datasetId={activeDatasetId}
                    dtypes={overview?.dtypes ?? {}}
                    maxCols={20}
                    topPairs={8}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="h-[460px] rounded-2xl border bg-card overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartKind === "bar" ? (
                      <BarChart data={aggOut?.rows ?? []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="x" tickFormatter={(v) => shortLabel(String(v), 12)} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "10px",
                          }}
                        />
                        <Bar dataKey="y" name={seriesLabel} fill="hsl(221, 83%, 53%)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    ) : chartKind === "line" ? (
                      <LineChart data={aggOut?.rows ?? []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="x" tickFormatter={(v) => shortLabel(String(v), 12)} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "10px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="y"
                          name={seriesLabel}
                          stroke="hsl(221, 83%, 53%)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    ) : chartKind === "area" ? (
                      <AreaChart data={aggOut?.rows ?? []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="x" tickFormatter={(v) => shortLabel(String(v), 12)} className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "10px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="y"
                          name={seriesLabel}
                          stroke="hsl(221, 83%, 53%)"
                          fill="hsl(221, 83%, 53%)"
                          fillOpacity={0.15}
                        />
                      </AreaChart>
                    ) : isPieChart ? (
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={150}
                          innerRadius={chartKind === "doughnut" ? 90 : 0}
                          labelLine={false}
                          label={false} // ✅ keep pie readable; legend below
                        >
                          {pieData.map((entry, idx) => (
                            <Cell key={`${entry.name}-${idx}`} fill={(entry as any).fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "10px",
                          }}
                        />
                      </PieChart>
                    ) : chartKind === "hist" ? (
                      <BarChart data={histBars}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="bin"
                          className="text-[10px]"
                          interval={Math.max(0, Math.floor(histBars.length / 8) - 1)}
                        />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "10px",
                          }}
                        />
                        <Bar dataKey="count" name="Count" fill="hsl(262, 83%, 58%)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    ) : chartKind === "radar" ? (
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "10px",
                          }}
                        />
                        <Radar
                          dataKey="value"
                          stroke="hsl(221, 83%, 53%)"
                          fill="hsl(221, 83%, 53%)"
                          fillOpacity={0.25}
                        />
                      </RadarChart>
                    ) : chartKind === "scatter" ? (
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" dataKey="x" name={sx} className="text-xs" />
                        <YAxis type="number" dataKey="y" name={sy} className="text-xs" />
                        <ZAxis type="number" dataKey="z" range={[50, 50]} />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "10px",
                          }}
                        />
                        <Scatter name="Sample" data={scatterPoints} fill="hsl(262, 83%, 58%)" />
                      </ScatterChart>
                    ) : (
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" dataKey="x" name={bx} className="text-xs" />
                        <YAxis type="number" dataKey="y" name={by} className="text-xs" />
                        <ZAxis type="number" dataKey="z" name={bz} range={[40, 180]} />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "10px",
                          }}
                        />
                        <Scatter name="Bubble" data={scatterPoints} fill="hsl(174, 84%, 32%)" />
                      </ScatterChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* ✅ Legends / info blocks for readability */}
                {isPieChart && pieData.length > 0 && (
                  <ChartLegendRow
                    items={pieData.map((d) => ({
                      label: String((d as any).name),
                      color: (d as any).fill,
                      value: Number((d as any).value),
                    }))}
                  />
                )}

                {chartKind === "scatter" && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">X: {sx}</Badge>
                    <Badge variant="outline">Y: {sy}</Badge>
                    <Badge variant="outline">n={scatterPoints.length}</Badge>
                  </div>
                )}

                {chartKind === "bubble" && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">X: {bx}</Badge>
                    <Badge variant="outline">Y: {by}</Badge>
                    <Badge variant="outline">Taille (Z): {bz}</Badge>
                    <Badge variant="outline">n={scatterPoints.length}</Badge>
                  </div>
                )}
              </>
            )}

            <div className="mt-3 text-xs text-muted-foreground">
              {isAggChart ? (
                <>Bar/Line/Area : group by <b>X</b> + agrégation (Top K).</>
              ) : isPieChart ? (
                <>Pie/Doughnut : Top K catégories + “Autres” (lisible même avec beaucoup de valeurs).</>
              ) : chartKind === "hist" ? (
                <>Histogram : distribution d’une seule colonne numérique (bins).</>
              ) : chartKind === "bubble" ? (
                <>Bubble : X,Y numériques + Z (taille) via sample rows.</>
              ) : chartKind === "heatmap" ? (
                <>Corrélation : matrice sur colonnes numériques sélectionnées.</>
              ) : (
                <>Les contrôles affichés dépendent du graphique, pour éviter la confusion.</>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default ChartsPage;
