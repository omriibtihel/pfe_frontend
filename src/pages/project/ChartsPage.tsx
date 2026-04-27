import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Download, RefreshCw } from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import { useToast } from "@/hooks/use-toast";

import datasetService, { DatasetOut as DatasetListItem } from "@/services/datasetService";
import dataService, { type VersionUI } from "@/services/dataService";
import databaseService, {
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

// ── Sub-modules (types, constants, UI, panels) ──────────────────────────────
import type { UiColumn, ChartKind } from "./_charts/types";
import { COLORS, CHART_GROUPS, CHART_HINT } from "./_charts/constants";
import { shortLabel } from "./_charts/utils";
import { ColSelect } from "./_charts/ColSelect";
import { MultiColSelect } from "./_charts/MultiColSelect";
import { AggPanel } from "./_charts/panels/AggPanel";
import { PiePanel } from "./_charts/panels/PiePanel";
import { HistPanel } from "./_charts/panels/HistPanel";
import { BoxplotPanel } from "./_charts/panels/BoxplotPanel";
import { ScatterPanel } from "./_charts/panels/ScatterPanel";
import { BubblePanel } from "./_charts/panels/BubblePanel";
import { RadarPanel } from "./_charts/panels/RadarPanel";

// ── Constants ────────────────────────────────────────────────────────────────
const PROFILE_TOPK = 20;

// ── Component ────────────────────────────────────────────────────────────────
export function ChartsPage() {
  const { id } = useParams();
  const projectId = id!;
  const { toast } = useToast();

  // ── Loading ──────────────────────────────────────────────────────────────
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Datasets & versions lists ────────────────────────────────────────────
  type DataSource = { kind: "dataset" | "version"; id: number };

  const [datasets,      setDatasets]      = useState<DatasetListItem[]>([]);
  const [versions,      setVersions]      = useState<VersionUI[]>([]);
  const [activeSource,  setActiveSource]  = useState<DataSource | null>(null);

  // Derived source type and ids
  const sourceType      = activeSource?.kind ?? "dataset";
  const activeDatasetId = activeSource?.kind === "dataset" ? activeSource.id : null;
  const activeVersionId = activeSource?.kind === "version" ? activeSource.id : null;

  // ── Analytics (overview + profile) ──────────────────────────────────────
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [profile,  setProfile]  = useState<AnalyticsProfile  | null>(null);

  // ── Chart type & shared controls ────────────────────────────────────────
  const [chartKind, setChartKind] = useState<ChartKind>("hist");
  const [topK,      setTopK]      = useState<number>(15);

  // ── Per-chart column / parameter state ──────────────────────────────────
  const [xCat,   setXCat]   = useState("");
  const [yNum,   setYNum]   = useState("");
  const [agg,    setAgg]    = useState<AggFn>("avg");

  const [pieCol,    setPieCol]    = useState("");
  const [histCol,   setHistCol]   = useState("");
  const [histBins,  setHistBins]  = useState(20);

  const [sx, setSx] = useState("");
  const [sy, setSy] = useState("");
  const [bx, setBx] = useState("");
  const [by, setBy] = useState("");
  const [bz, setBz] = useState("");
  const [sampleN, setSampleN] = useState(400);

  const [boxplotCols, setBoxplotCols] = useState<string[]>([]);
  const [radarCols,   setRadarCols]   = useState<string[]>([]);

  // ── Column selection readiness (guards against stale columns on source switch) ──
  const [columnSelectionReady, setColumnSelectionReady] = useState(false);

  // ── Chart results ────────────────────────────────────────────────────────
  const [chartLoading, setChartLoading] = useState(false);
  const [aggOut,    setAggOut]    = useState<AggregateOut | null>(null);
  const [countsOut, setCountsOut] = useState<ValueCountsOut | null>(null);
  const [sampleOut, setSampleOut] = useState<SampleOut     | null>(null);
  const [histOut,   setHistOut]   = useState<HistogramOut  | null>(null);

  // Heatmap data (received via onDataReady callback — needed for PNG export)
  const [heatmapData, setHeatmapData] = useState<CorrelationOut | null>(null);

  // Ref to the chart canvas area — used for SVG export
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // ── Data loading ─────────────────────────────────────────────────────────
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
        setOverview({ shape: o.shape, columns: o.columns, dtypes: o.dtypes, missing: o.missing, preview: o.preview });
        setProfile({ shape: p.shape, profiles: p.profiles });
      }
    },
    [projectId],
  );

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

        const active  = await databaseService.getActiveDataset(projectId);
        const forced  = opts?.forceDatasetId ?? null;
        const chosen = forced ?? active.active_dataset_id ?? (dsList?.[0]?.id ?? null);
        setActiveSource((prev) => prev ?? (chosen ? { kind: "dataset", id: chosen } : null));

        if (!chosen) { setOverview(null); setProfile(null); }
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

  // Reload analytics when source changes
  useEffect(() => {
    if (!activeSource) return;
    void loadAnalytics(activeSource.kind, activeSource.id);
  }, [activeSource, loadAnalytics]);

  useEffect(() => {
    setIsLoading(true);
    void load();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived column lists ─────────────────────────────────────────────────
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

  const numericCols     = useMemo(() => columns.filter((c) => c.kind === "numeric"), [columns]);
  const categoricalCols = useMemo(
    () => columns.filter((c) => c.kind === "categorical" || c.kind === "text" || c.kind === "datetime"),
    [columns],
  );

  const allBoxplotCols = useMemo(() => {
    if (!profile) return [];
    return profile.profiles
      .filter(
        (c) =>
          c.kind === "numeric" &&
          c.numeric?.min  != null && c.numeric.p25 != null &&
          c.numeric.p50   != null && c.numeric.p75 != null && c.numeric.max != null,
      )
      .map((c) => c.name);
  }, [profile]);

  const allRadarCols = useMemo(() => numericCols.map((c) => c.name), [numericCols]);

  // ── Chart-kind flags ─────────────────────────────────────────────────────
  const isAggChart  = chartKind === "bar" || chartKind === "line" || chartKind === "area";
  const isPieChart  = chartKind === "pie" || chartKind === "doughnut";
  const showYForAgg = isAggChart && agg !== "count";

  const needs = useMemo(() => ({
    showTopK:   isAggChart || isPieChart,
    showAgg:    isAggChart,
    showXCat:   isAggChart,
    showYNum:   showYForAgg,
    showPieCol: isPieChart,
    showHist:   chartKind === "hist",
    showBoxplot: chartKind === "boxplot",
    showScatter: chartKind === "scatter",
    showBubble:  chartKind === "bubble",
    showRadar:   chartKind === "radar",
    showHeatmap: chartKind === "heatmap",
  }), [chartKind, isAggChart, isPieChart, showYForAgg]);

  // ── Clear selections when source changes ─────────────────────────────────
  useEffect(() => {
    setColumnSelectionReady(false);
    setXCat(""); setYNum(""); setPieCol(""); setHistCol("");
    setSx(""); setSy(""); setBx(""); setBy(""); setBz("");
    setBoxplotCols([]); setRadarCols([]);
    setAggOut(null); setCountsOut(null); setSampleOut(null); setHistOut(null);
  }, [activeSource]);

  // ── Populate defaults when columns are first available ───────────────────
  useEffect(() => {
    if (!columns.length) return;
    const defCat  = categoricalCols[0]?.name ?? "";
    const defNum1 = numericCols[0]?.name ?? "";
    const defNum2 = numericCols[1]?.name ?? defNum1;
    const defNum3 = numericCols[2]?.name ?? defNum2;
    setXCat(defCat); setYNum(defNum1); setPieCol(defCat); setHistCol(defNum1);
    setSx(defNum1); setSy(defNum2);
    setBx(defNum1); setBy(defNum2); setBz(defNum3);
    setBoxplotCols(allBoxplotCols.slice(0, 1));
    setRadarCols(numericCols.slice(0, 8).map((c) => c.name));
    if (!numericCols.length) setAgg("count");
    setColumnSelectionReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  // ── Fetch chart data ──────────────────────────────────────────────────────
  const effectiveId = sourceType === "version" ? activeVersionId : activeDatasetId;

  useEffect(() => {
    const id = effectiveId;
    if (!id) return;

    const isVersion = sourceType === "version";
    const doAggregate  = (p: Parameters<typeof databaseService.aggregate>[2])  =>
      isVersion ? databaseService.versionAggregate(projectId, id, p)   : databaseService.aggregate(projectId, id, p);
    const doValueCounts = (p: Parameters<typeof databaseService.valueCounts>[2]) =>
      isVersion ? databaseService.versionValueCounts(projectId, id, p) : databaseService.valueCounts(projectId, id, p);
    const doHist   = (p: Parameters<typeof databaseService.hist>[2])   =>
      isVersion ? databaseService.versionHist(projectId, id, p)   : databaseService.hist(projectId, id, p);
    const doSample = (p: Parameters<typeof databaseService.sample>[2]) =>
      isVersion ? databaseService.versionSample(projectId, id, p) : databaseService.sample(projectId, id, p);

    const run = async () => {
      if (!columnSelectionReady) return;
      if (chartKind === "radar" || chartKind === "heatmap" || chartKind === "boxplot") {
        setAggOut(null); setCountsOut(null); setSampleOut(null); setHistOut(null);
        return;
      }
      setChartLoading(true);
      try {
        setAggOut(null); setCountsOut(null); setSampleOut(null); setHistOut(null);

        if (isAggChart) {
          if (!xCat) return;
          setAggOut(await doAggregate({ x: xCat, agg, top_k: topK, order: "desc", dropna: true, ...(agg !== "count" ? { y: yNum } : {}) }));
        } else if (isPieChart) {
          if (!pieCol) return;
          setCountsOut(await doValueCounts({ col: pieCol, top_k: topK, dropna: true }));
        } else if (chartKind === "hist") {
          if (!histCol) return;
          setHistOut(await doHist({ col: histCol, bins: histBins, dropna: true }));
        } else if (chartKind === "scatter") {
          if (!sx || !sy) return;
          setSampleOut(await doSample({ cols: [sx, sy], n: sampleN }));
        } else if (chartKind === "bubble") {
          if (!bx || !by || !bz) return;
          setSampleOut(await doSample({ cols: [bx, by, bz], n: sampleN }));
        }
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
  }, [projectId, effectiveId, sourceType, chartKind, topK, agg, xCat, yNum, pieCol, histCol, histBins, sx, sy, bx, by, bz, sampleN, isAggChart, isPieChart, columnSelectionReady]);

  // ── Source change handler ─────────────────────────────────────────────────
  const handleSourceChange = useCallback((value: string) => {
    const dash = value.indexOf("-");
    const kind = value.slice(0, dash) as "dataset" | "version";
    const id = Number(value.slice(dash + 1));
    setActiveSource({ kind, id });
  }, []);

  // ── Refresh callback ──────────────────────────────────────────────────────
  const onRefresh = async () => {
    if (activeSource) {
      await loadAnalytics(activeSource.kind, activeSource.id);
    } else {
      await load();
    }
  };

  // ── Derived data for panels ───────────────────────────────────────────────
  const seriesLabel = useMemo(
    () => (isAggChart ? (agg === "count" ? "count" : `${agg}(${yNum})`) : ""),
    [agg, yNum, isAggChart],
  );

  const radarData = useMemo(() => {
    const selected = numericCols.filter((c) => radarCols.includes(c.name));
    if (!selected.length) return [];
    const means  = selected.map((c) => c.numeric?.mean ?? 0);
    const maxAbs = Math.max(1e-9, ...means.map((v) => Math.abs(v)));
    return selected.map((c) => ({
      metric:   shortLabel(c.name, 16),
      fullName: c.name,
      mean:     c.numeric?.mean ?? 0,
      value:    ((c.numeric?.mean ?? 0) / maxAbs) * 100,
    }));
  }, [numericCols, radarCols]);

  const pieData = useMemo(() => {
    const rows   = countsOut?.rows ?? [];
    const base   = rows.map((r, i) => ({ name: r.value, value: r.count, fill: COLORS[i % COLORS.length] }));
    const others = countsOut?.others_count ?? 0;
    if (others > 0) base.push({ name: "Autres", value: others, fill: "hsl(var(--muted-foreground))" });
    return base;
  }, [countsOut]);

  const histBars = useMemo(
    () => (histOut?.rows ?? []).map((b) => ({ bin: `${b.x0.toFixed(2)}–${b.x1.toFixed(2)}`, count: b.count })),
    [histOut],
  );

  const scatterPoints = useMemo(() => {
    const r = sampleOut?.rows ?? [];
    if (chartKind === "scatter") {
      return r.map((row) => ({ x: Number(row[sx]), y: Number(row[sy]), z: 1 }))
               .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    }
    if (chartKind === "bubble") {
      return r.map((row) => ({ x: Number(row[bx]), y: Number(row[by]), z: Number(row[bz]) }))
               .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
    }
    return [];
  }, [sampleOut, chartKind, sx, sy, bx, by, bz]);

  const [pearsonR, setPearsonR] = useState<number | null>(null);
  useEffect(() => {
    if (chartKind !== "scatter" || !sx || !sy) { setPearsonR(null); return; }
    let cancelled = false;
    const fetch = activeVersionId
      ? databaseService.versionPearson(projectId!, activeVersionId, { x: sx, y: sy })
      : activeDatasetId
      ? databaseService.pearson(projectId!, activeDatasetId, { x: sx, y: sy })
      : null;
    if (!fetch) { setPearsonR(null); return; }
    fetch.then((res) => { if (!cancelled) setPearsonR(res.r); }).catch(() => { if (!cancelled) setPearsonR(null); });
    return () => { cancelled = true; };
  }, [chartKind, sx, sy, activeDatasetId, activeVersionId, projectId]);

  const boxplotInfo = useMemo(() => {
    if (!profile) return { data: [], shift: 0 };
    const validCols = profile.profiles.filter(
      (c) =>
        c.kind === "numeric" &&
        c.numeric?.min != null && c.numeric.p25 != null &&
        c.numeric.p50  != null && c.numeric.p75 != null && c.numeric.max != null &&
        boxplotCols.includes(c.name),
    );
    if (!validCols.length) return { data: [], shift: 0 };

    const globalMin = Math.min(...validCols.map((c) => c.numeric!.min!));
    const shift     = Math.max(0, -globalMin);

    const data = validCols.map((col, i) => {
      const { min, p25, p50, p75, max } = col.numeric!;
      const s_min = min! + shift, s_p25 = p25! + shift, s_p50 = p50! + shift;
      const s_p75 = p75! + shift, s_max = max! + shift;
      return {
        name: col.name, value: s_max,
        s_min, s_p25, s_p50, s_p75, s_max,
        _min: min!, _p25: p25!, _p50: p50!, _p75: p75!, _max: max!,
        _mean: col.numeric!.mean ?? null,
        _std: col.numeric!.std ?? null,
        fill: COLORS[i % COLORS.length],
      };
    });
    return { data, shift };
  }, [profile, boxplotCols]);

  // ── PNG export ────────────────────────────────────────────────────────────
  const buildHeatmapSvg = useCallback((data: NonNullable<typeof heatmapData>): string => {
    const cols = data.columns;
    const n    = cols.length;
    const cell = Math.min(64, Math.max(32, Math.floor(780 / (n + 1))));
    const labelW = 140;
    const W = labelW + n * cell, H = labelW + n * cell;
    const fs = Math.min(11, Math.max(8, Math.floor(cell * 0.22)));
    const trunc = (s: string, max = 16) => (s.length > max ? `${s.slice(0, max)}…` : s);

    const corrColor = (v: number) => {
      const x  = Math.max(-1, Math.min(1, v));
      const t  = Math.abs(x);
      const mid = [248, 250, 252], pos = [37, 99, 235], neg = [220, 38, 38];
      const base = x >= 0 ? pos : neg;
      return `rgb(${Math.round(mid[0] + (base[0] - mid[0]) * t)},${Math.round(mid[1] + (base[1] - mid[1]) * t)},${Math.round(mid[2] + (base[2] - mid[2]) * t)})`;
    };
    const textColor = (rgb: string) => {
      const nums = rgb.match(/\d+/g)?.map(Number);
      if (!nums) return "#0f172a";
      return 0.2126 * nums[0] + 0.7152 * nums[1] + 0.0722 * nums[2] < 140 ? "#ffffff" : "#0f172a";
    };

    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
    s += `<rect width="${W}" height="${H}" fill="white"/>`;
    s += `<rect width="${labelW}" height="${H}" fill="#f8fafc"/>`;
    s += `<rect width="${W}" height="${labelW}" fill="#f8fafc"/>`;
    cols.forEach((col, j) => {
      const cx = labelW + j * cell + cell / 2;
      s += `<text x="${cx}" y="${labelW - 6}" font-size="${fs}" font-family="system-ui,sans-serif" fill="#475569" text-anchor="start" transform="rotate(-45 ${cx} ${labelW - 6})">${trunc(col)}</text>`;
    });
    cols.forEach((col, i) => {
      const cy = labelW + i * cell + cell / 2 + fs / 3;
      s += `<text x="${labelW - 6}" y="${cy}" font-size="${fs}" font-family="system-ui,sans-serif" fill="#475569" text-anchor="end">${trunc(col)}</text>`;
    });
    cols.forEach((_, i) => {
      cols.forEach((_, j) => {
        const v  = data.matrix?.[i]?.[j] ?? 0;
        const bg = corrColor(Number(v));
        const fg = textColor(bg);
        const x  = labelW + j * cell, y = labelW + i * cell;
        s += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${bg}" stroke="white" stroke-width="0.5"/>`;
        if (cell >= 28) {
          s += `<text x="${x + cell / 2}" y="${y + cell / 2 + fs / 3}" font-size="${fs}" font-family="system-ui,sans-serif" fill="${fg}" text-anchor="middle">${Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "—"}</text>`;
        }
      });
    });
    s += "</svg>";
    return s;
  }, [heatmapData]);

  const downloadSvgAsPng = useCallback((svgData: string, filename: string) => {
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth  * 2;
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

  const handleExport = useCallback(() => {
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
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("width",  String(width  || 800));
    clone.setAttribute("height", String(height || 480));
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "white");
    clone.insertBefore(bg, clone.firstChild);
    downloadSvgAsPng(new XMLSerializer().serializeToString(clone), `chart-${chartKind}-${Date.now()}.png`);
  }, [chartKind, heatmapData, buildHeatmapSvg, downloadSvgAsPng]);

  // ── Early exits ───────────────────────────────────────────────────────────
  if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;
  if (!activeDatasetId && !activeVersionId) {
    return <AppLayout><div className="p-6">Aucun dataset ou version disponible</div></AppLayout>;
  }

  // ── Render ────────────────────────────────────────────────────────────────
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
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
          <div className="absolute inset-0 pointer-events-none opacity-40 [background:radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.18),transparent_40%),radial-gradient(circle_at_90%_30%,rgba(99,102,241,0.14),transparent_45%)]" />
          <div className="relative p-5 md:p-7 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Visualisation des données
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Projet&nbsp;<b>#{projectId}</b> &middot;{" "}
                {activeSource ? `${activeSource.kind === "version" ? "Version" : "Dataset"} #${activeSource.id}` : "—"}
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
              const tot   = columns.reduce((s, c) => s + c.missing, 0);
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

        {/* Tabs */}
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
            <Card className="rounded-3xl overflow-hidden">

              {/* ── Controls ──────────────────────────────────────────── */}
              <CardHeader className="border-b bg-muted/30">
                <div className="flex flex-col gap-4">

                  {/* Chart type selector */}
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

                  {/* Parameter controls */}
                  <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">

                    {/* Unified source selector */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Source</p>
                      <Select
                        value={activeSource ? `${activeSource.kind}-${activeSource.id}` : ""}
                        onValueChange={handleSourceChange}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Choisir une source" />
                        </SelectTrigger>
                        <SelectContent>
                          {datasets.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Datasets</SelectLabel>
                              {datasets.map((d) => (
                                <SelectItem key={`dataset-${d.id}`} value={`dataset-${d.id}`}>
                                  {d.original_name ?? `Dataset #${d.id}`}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {versions.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Versions</SelectLabel>
                              {versions.map((v) => (
                                <SelectItem key={`version-${v.id}`} value={`version-${v.id}`}>
                                  {v.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Top K */}
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

                    {/* X — categorical */}
                    {needs.showXCat && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Axe X (catégoriel)</p>
                        <ColSelect value={xCat} onChange={setXCat} cols={categoricalCols} placeholder="Choisir X" />
                      </div>
                    )}

                    {/* Y — numeric (only when agg ≠ count) */}
                    {needs.showYNum && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Axe Y (numérique)</p>
                        <ColSelect value={yNum} onChange={setYNum} cols={numericCols} placeholder="Choisir Y" />
                      </div>
                    )}

                    {/* Aggregation function */}
                    {needs.showAgg && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Agrégation</p>
                        <Select value={agg} onValueChange={(v) => setAgg(v as AggFn)}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(["count", "sum", "avg", "min", "max", "median"] as AggFn[]).map((fn) => (
                              <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                            ))}
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
                              {[10, 15, 20, 30, 40, 60].map((b) => <SelectItem key={b} value={String(b)}>{b}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* Boxplot column multi-select */}
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
                              {[100, 200, 400, 800, 1500].map((n) => <SelectItem key={n} value={String(n)}>{n} points</SelectItem>)}
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
                              {[100, 200, 400, 800, 1500].map((n) => <SelectItem key={n} value={String(n)}>{n} points</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* Radar column multi-select */}
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

              {/* ── Chart canvas ───────────────────────────────────────── */}
              <CardContent className="p-4 md:p-6">

                {/* Chart kind badge + quick summary */}
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="rounded-full">{chartKind.toUpperCase()}</Badge>
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
                  {chartKind === "hist"    && histCol && <span className="text-sm text-muted-foreground">Distribution : <b className="text-foreground">{shortLabel(histCol)}</b> ({histBins} bins)</span>}
                  {chartKind === "scatter" && sx && sy  && <span className="text-sm text-muted-foreground">{shortLabel(sx)} vs {shortLabel(sy)} ({sampleN})</span>}
                  {chartKind === "bubble"  && bx && by && bz && <span className="text-sm text-muted-foreground">{shortLabel(bx)} vs {shortLabel(by)} | taille={shortLabel(bz)} ({sampleN} pts)</span>}
                  {chartKind === "boxplot" && boxplotInfo.data.length > 0 && <span className="text-sm text-muted-foreground">{boxplotInfo.data.length} colonne{boxplotInfo.data.length > 1 ? "s" : ""} · IQR [P25–P75]</span>}
                  {chartKind === "radar"   && radarData.length >= 3          && <span className="text-sm text-muted-foreground">{radarData.length} colonnes · moyennes normalisées</span>}
                </div>

                {/* Chart panels */}
                <div ref={chartContainerRef}>
                  {chartKind === "heatmap" ? (
                    <div className="rounded-2xl border bg-card overflow-hidden min-h-[640px]">
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
                  ) : chartKind === "boxplot" ? (
                    <BoxplotPanel boxplotInfo={boxplotInfo} allBoxplotCols={allBoxplotCols} />
                  ) : isAggChart ? (
                    <AggPanel
                      chartKind={chartKind as "bar" | "line" | "area"}
                      xCat={xCat} aggOut={aggOut} seriesLabel={seriesLabel}
                      topK={topK} agg={agg} yNum={yNum} chartLoading={chartLoading}
                    />
                  ) : isPieChart ? (
                    <PiePanel
                      chartKind={chartKind as "pie" | "doughnut"}
                      pieCol={pieCol} countsOut={countsOut} pieData={pieData}
                      topK={topK} chartLoading={chartLoading}
                    />
                  ) : chartKind === "hist" ? (
                    <HistPanel
                      histCol={histCol} histBars={histBars} histBins={histBins}
                      histOut={histOut} chartLoading={chartLoading} profile={profile}
                    />
                  ) : chartKind === "scatter" ? (
                    <ScatterPanel
                      sx={sx} sy={sy} scatterPoints={scatterPoints}
                      sampleOut={sampleOut} chartLoading={chartLoading} pearsonR={pearsonR}
                    />
                  ) : chartKind === "bubble" ? (
                    <BubblePanel
                      bx={bx} by={by} bz={bz} scatterPoints={scatterPoints}
                      sampleOut={sampleOut} chartLoading={chartLoading}
                    />
                  ) : chartKind === "radar" ? (
                    <RadarPanel radarData={radarData} allRadarCols={allRadarCols} radarCols={radarCols} />
                  ) : null}
                </div>

                {/* Hint text */}
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