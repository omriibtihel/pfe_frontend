import React, { useState, useCallback, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Info,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import databaseService, {
  NormalityColResult,
  HistogramOut,
  SampleOut,
} from "@/services/databaseService";
import type { DatasetProfileOut } from "@/services/databaseService";

// ───────���──────────────────────────────────��──────────────────────────────────
// Probit — rational approximation (Abramowitz & Stegun)
// ────────────────────────────���────────────────────────────────────────────────
function probit(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
              1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
              6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
              -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p <= pHigh) {
    const q = p - 0.5, r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
          ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
}

function normalPdf(x: number, mean: number, std: number): number {
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / std) ** 2);
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "10px",
} as const;

// ───────────────────────────────────────────────────────────────────���─────────
// Badge gradué selon distribution_shape + skewness_level
// ─────────────────────────────────────────────────────────────────────────────
type BadgeConfig = { label: string; cls: string };

function distributionBadge(r: NormalityColResult): BadgeConfig {
  if (r.error) return { label: "Erreur", cls: "border-muted text-muted-foreground" };
  const { distribution_shape: shape, skewness_level: level } = r;

  if (shape === "symmetric" || shape === "approximately_symmetric") {
    return { label: "Symétrique", cls: "border-emerald-500 text-emerald-600 dark:text-emerald-400" };
  }
  if (shape === "heavy_tailed") {
    return { label: "Dist. lourde", cls: "border-violet-500 text-violet-600 dark:text-violet-400" };
  }
  const side = shape === "right_skewed" ? "droite" : "gauche";
  if (level === "severe") {
    return { label: `Asymétrie ${side} forte`, cls: "border-rose-500 text-rose-600 dark:text-rose-400" };
  }
  if (level === "moderate") {
    return { label: `Asymétrie ${side} modérée`, cls: "border-orange-500 text-orange-600 dark:text-orange-400" };
  }
  return { label: `Asymétrie ${side} légère`, cls: "border-yellow-500 text-yellow-600 dark:text-yellow-400" };
}

// ─────────────────��───────────────────────────────��───────────────────────────
// Libellé et tooltip des transformations conseillées
// ───────────────────────────────��───────────────────────────────────��─────────
const TRANSFORM_LABELS: Record<string, { label: string; tip: string }> = {
  none:        { label: "—",          tip: "Aucune transformation nécessaire." },
  log:         { label: "log(x)",     tip: "Logarithme naturel. Requiert x > 0. Idéal pour forte asymétrie droite. Applicable directement en préparation ML." },
  sqrt:        { label: "√x",         tip: "Racine carrée. Requiert x ≥ 0. Pour asymétrie droite modérée. Applicable directement en préparation ML." },
  yeo_johnson: { label: "Yeo-Johnson",tip: "Power transform Yeo-Johnson. Accepte toutes valeurs. Cherche λ optimal. Applicable en préparation ML." },
  box_cox:     { label: "Box-Cox",    tip: "Power transform Box-Cox. Requiert x > 0 strictement. Applicable en préparation ML." },
};

// ────────────────────��──────────────────────────────────���─────────────────────
// Props
// ────────────────────────────────────────────��────────────────────────────────
type UiColumn = { name: string; kind: DatasetProfileOut["profiles"][number]["kind"] };

interface NormalityTestPanelProps {
  projectId: string;
  activeDatasetId: number;
  columns: UiColumn[];
  versionId?: number | null;
}

// ───────────────────��───────────────────────────────��─────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────���────────
export function NormalityTestPanel({
  projectId,
  activeDatasetId,
  columns,
  versionId,
}: NormalityTestPanelProps) {
  const { toast } = useToast();

  // 4.1 — only numeric columns are selectable
  const numericCols = useMemo(
    () => columns.filter((c) => c.kind === "numeric"),
    [columns]
  );

  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NormalityColResult[] | null>(null);
  const [correctionApplied, setCorrectionApplied] = useState(false);
  const [kTested, setKTested] = useState(0);
  const [colsSkipped, setColsSkipped] = useState<string[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [qqPoints, setQqPoints] = useState<{ x: number; y: number }[]>([]);
  const [histWithCurve, setHistWithCurve] = useState<
    { bin: string; count: number; normal: number; mid: number }[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Run tests ──────────────────────���───────────────────────────────────────
  const runTests = useCallback(async () => {
    if (!selectedCols.length) return;
    setLoading(true);
    setResults(null);
    setExpandedRow(null);
    setQqPoints([]);
    setHistWithCurve([]);
    try {
      const out = versionId
        ? await databaseService.versionNormalityTest(projectId, versionId, selectedCols)
        : await databaseService.normalityTest(projectId, activeDatasetId, selectedCols);
      setResults(out.results);
      setCorrectionApplied(out.correction_applied);
      setKTested(out.k_tested);
      setColsSkipped(out.columns_skipped ?? []);
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [projectId, activeDatasetId, versionId, selectedCols, toast]);

  // ── Load Q-Q + histogram for a row ────────────────────────────────────────
  const loadDetail = useCallback(
    async (res: NormalityColResult) => {
      if (res.error || res.mean == null || res.std == null) return;
      setDetailLoading(true);
      try {
        const [sampleOut, histOut] = await Promise.all([
          versionId
            ? databaseService.versionSample(projectId, versionId, { cols: [res.col], n: 500 })
            : databaseService.sample(projectId, activeDatasetId, { cols: [res.col], n: 500 }),
          versionId
            ? databaseService.versionHist(projectId, versionId, { col: res.col, bins: 20 })
            : databaseService.hist(projectId, activeDatasetId, { col: res.col, bins: 20 }),
        ]);

        // 4.6 — compute mean/std from the sample itself
        const raw = (sampleOut as SampleOut).rows
          .map((r) => Number(r[res.col]))
          .filter(Number.isFinite)
          .sort((a, b) => a - b);
        const n = raw.length;
        if (n === 0) return;
        const sampleMean = raw.reduce((s, v) => s + v, 0) / n;
        const sampleStd = Math.sqrt(
          raw.reduce((s, v) => s + (v - sampleMean) ** 2, 0) / Math.max(1, n - 1)
        );

        const qq = raw.map((val, i) => ({
          x: parseFloat((sampleMean + sampleStd * probit((i + 0.5) / n)).toFixed(4)),
          y: parseFloat(val.toFixed(4)),
        }));
        setQqPoints(qq);

        const bins = (histOut as HistogramOut).rows;
        const totalCount = bins.reduce((s, b) => s + b.count, 0);
        const hc = bins.map((b) => {
          const mid = (b.x0 + b.x1) / 2;
          const bw = b.x1 - b.x0;
          return {
            bin: `${b.x0.toFixed(2)}`,
            count: b.count,
            normal: parseFloat(
              (normalPdf(mid, sampleMean, sampleStd) * totalCount * bw).toFixed(2)
            ),
            mid,
          };
        });
        setHistWithCurve(hc);
      } catch (e) {
        toast({ title: "Erreur détail", description: (e as Error).message, variant: "destructive" });
      } finally {
        setDetailLoading(false);
      }
    },
    [projectId, activeDatasetId, versionId, toast]
  );

  const toggleRow = (col: string, res: NormalityColResult) => {
    if (expandedRow === col) {
      setExpandedRow(null);
      setQqPoints([]);
      setHistWithCurve([]);
    } else {
      setExpandedRow(col);
      setQqPoints([]);
      setHistWithCurve([]);
      void loadDetail(res);
    }
  };

  // ── Column selector helpers ────────────────────────────────────────────────
  const filteredCols = useMemo(
    () => numericCols.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [numericCols, search]
  );

  const toggleCol = (name: string) =>
    setSelectedCols((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );

  const allFilteredSelected =
    filteredCols.length > 0 && filteredCols.every((c) => selectedCols.includes(c.name));

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedCols((prev) => prev.filter((n) => !filteredCols.some((c) => c.name === n)));
    } else {
      const toAdd = filteredCols.map((c) => c.name).filter((n) => !selectedCols.includes(n));
      setSelectedCols((prev) => [...prev, ...toAdd]);
    }
  };

  const testLabel = (test: string) =>
    test === "shapiro" ? "Shapiro-Wilk" : test === "anderson" ? "Anderson-Darling" : "D'Agostino";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="space-y-6">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 text-sm font-normal">
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                Colonnes numériques
                {selectedCols.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold px-1.5 py-px leading-none">
                    {selectedCols.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <div className="flex items-center border-b px-3 gap-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  placeholder="Rechercher…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <ScrollArea className="max-h-56">
                {filteredCols.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Aucune colonne numérique</p>
                ) : (
                  filteredCols.map((c) => (
                    <div
                      key={c.name}
                      onClick={() => toggleCol(c.name)}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox checked={selectedCols.includes(c.name)} onCheckedChange={() => toggleCol(c.name)} />
                      <span className="text-sm truncate flex-1">{c.name}</span>
                    </div>
                  ))
                )}
              </ScrollArea>
              <div className="flex items-center justify-between border-t px-3 py-2">
                <button onClick={toggleAllFiltered} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
                {selectedCols.length > 0 && (
                  <button onClick={() => setSelectedCols([])} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                    Effacer
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {selectedCols.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 h-8 rounded-md border bg-muted/50 px-2.5 text-xs font-medium">
              {name}
              <button onClick={() => toggleCol(name)} className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          <Button
            onClick={() => void runTests()}
            disabled={loading || selectedCols.length === 0}
            size="sm"
            className="gap-2 h-8 ml-auto"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            {loading ? "Calcul…" : "Lancer"}
          </Button>
        </div>

        {/* BH banner — affiché dès que la correction est appliquée (k ≥ 2) */}
        {results && correctionApplied && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 px-4 py-2.5 text-sm text-blue-700 dark:text-blue-300">
            <Info className="h-4 w-4 shrink-0" />
            Correction Benjamini-Hochberg appliquée sur {kTested} colonne{kTested > 1 ? "s" : ""}.
            Les p-values affichées sont ajustées (FDR 5 %).
          </div>
        )}

        {/* Skipped columns warning */}
        {results && colsSkipped.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
            <Info className="h-4 w-4 shrink-0" />
            {colsSkipped.length} colonne{colsSkipped.length > 1 ? "s" : ""} ignorée{colsSkipped.length > 1 ? "s" : ""} (données insuffisantes) :{" "}
            {colsSkipped.join(", ")}.
          </div>
        )}

        {/* Results table */}
        {results && results.filter((r) => !r.error).length > 0 && (
          <Card className="rounded-2xl overflow-hidden">
            <CardHeader className="pb-3">
              <p className="font-semibold text-base">Résultats — Test de normalité</p>
              <p className="text-xs text-muted-foreground">
                Cliquez sur une ligne pour afficher le Q-Q Plot et l'histogramme.
                <br />
                Seuil α = 0.05 · Shapiro-Wilk (n ≤ 50) · D'Agostino-Pearson (51–2000) · Anderson-Darling (n &gt; 2000) · BH appliqué dès k ≥ 2 colonnes.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="px-3 py-2 w-6" />
                      <th className="px-4 py-2 text-left font-medium">Colonne</th>
                      <th className="px-4 py-2 text-left font-medium">Test</th>
                      <th className="px-4 py-2 text-right font-medium">n</th>
                      <th className="px-4 py-2 text-right font-medium">Asymétrie</th>
                      <th className="px-4 py-2 text-right font-medium">
                        <UITooltip>
                          <TooltipTrigger className="inline-flex items-center gap-1 cursor-default">
                            Exc. aplatissement <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>Convention Fisher — 0 pour une gaussienne</TooltipContent>
                        </UITooltip>
                      </th>
                      <th className="px-4 py-2 text-right font-medium">p brute</th>
                      <th className="px-4 py-2 text-right font-medium">
                        <UITooltip>
                          <TooltipTrigger className="inline-flex items-center gap-1 cursor-default">
                            p ajustée {correctionApplied && <Info className="h-3 w-3" />}
                          </TooltipTrigger>
                          <TooltipContent>
                            {correctionApplied
                              ? "Correction Benjamini-Hochberg (FDR 5 %)"
                              : "Identique à la p brute (1 seul test)"}
                          </TooltipContent>
                        </UITooltip>
                      </th>
                      <th className="px-4 py-2 text-center font-medium">Distribution</th>
                      <th className="px-4 py-2 text-center font-medium">Transformation conseillée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results
                      .filter((r) => !r.error)
                      .map((r) => {
                        const badge = distributionBadge(r);
                        const tInfo = TRANSFORM_LABELS[r.recommended_transform] ?? TRANSFORM_LABELS.none;
                        const isOpen = expandedRow === r.col;
                        return (
                          <React.Fragment key={r.col}>
                            <tr
                              onClick={() => toggleRow(r.col, r)}
                              className={`border-b cursor-pointer transition-colors ${
                                isOpen ? "bg-primary/8" : "hover:bg-muted/40"
                              }`}
                            >
                              <td className="px-3 py-2.5 text-muted-foreground">
                                {isOpen
                                  ? <ChevronDown className="h-3.5 w-3.5" />
                                  : <ChevronRight className="h-3.5 w-3.5" />}
                              </td>
                              <td className="px-4 py-2.5 font-medium">{r.col}</td>
                              <td className="px-4 py-2.5 text-muted-foreground capitalize">
                                {testLabel(r.test_used)}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{r.n.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {r.skewness != null ? r.skewness.toFixed(3) : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {r.excess_kurtosis != null ? r.excess_kurtosis.toFixed(3) : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {r.p_value != null ? r.p_value.toFixed(4) : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {r.p_value_corrected != null ? r.p_value_corrected.toFixed(4) : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <Badge variant="outline" className={badge.cls}>
                                  {badge.label}
                                </Badge>
                              </td>
                              {/* 4.4 — transform tooltip */}
                              <td className="px-4 py-2.5 text-center">
                                {r.recommended_transform === "none" ? (
                                  <span className="text-muted-foreground text-xs">—</span>
                                ) : (
                                  <UITooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="border-blue-400 text-blue-600 dark:text-blue-400 cursor-default"
                                      >
                                        {tInfo.label}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs text-center">
                                      <p>{tInfo.tip}</p>
                                      <p className="mt-1 text-[11px] text-muted-foreground">
                                        Conseil uniquement — aucune transformation automatique.
                                      </p>
                                    </TooltipContent>
                                  </UITooltip>
                                )}
                              </td>
                            </tr>

                            {/* 4.4 — Expanded detail row */}
                            {isOpen && (
                              <tr key={`${r.col}-detail`} className="bg-muted/20">
                                <td colSpan={10} className="px-6 py-4">
                                  <div className="grid grid-cols-2 gap-4 mb-4 text-xs text-muted-foreground">
                                    <span>Moyenne : <strong className="text-foreground">{r.mean?.toFixed(4) ?? "—"}</strong></span>
                                    <span>Éc. type : <strong className="text-foreground">{r.std?.toFixed(4) ?? "—"}</strong></span>
                                    <span>Stat. du test : <strong className="text-foreground">{r.stat?.toFixed(5) ?? "—"}</strong></span>
                                    <span>
                                      Normalité pratique :{" "}
                                      <strong className={r.is_normal_practical ? "text-emerald-600" : "text-rose-600"}>
                                        {r.is_normal_practical ? "Oui (|sk| < 0.5 et |kurt| < 2)" : "Non"}
                                      </strong>
                                    </span>
                                  </div>

                                  {detailLoading ? (
                                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm gap-2">
                                      <RefreshCw className="h-4 w-4 animate-spin" /> Chargement…
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                      {/* Q-Q Plot */}
                                      <div>
                                        <p className="text-xs font-semibold mb-2">Q-Q Plot — {r.col}</p>
                                        <p className="text-[11px] text-muted-foreground mb-3">
                                          Points sur la droite = distribution normale
                                        </p>
                                        {qqPoints.length > 0 && (() => {
                                          const allVals = qqPoints.flatMap((p) => [p.x, p.y]);
                                          const vMin = Math.min(...allVals);
                                          const vMax = Math.max(...allVals);
                                          const pad = (vMax - vMin) * 0.05;
                                          const domain: [number, number] = [vMin - pad, vMax + pad];
                                          const refLine = [
                                            { x: vMin - pad, y: vMin - pad },
                                            { x: vMax + pad, y: vMax + pad },
                                          ];
                                          return (
                                            <ResponsiveContainer width="100%" height={260}>
                                              <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 8 }}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis
                                                  dataKey="x" type="number"
                                                  label={{ value: "Quantiles théoriques", position: "insideBottom", offset: -10, fontSize: 10 }}
                                                  className="text-xs" domain={domain}
                                                />
                                                <YAxis
                                                  dataKey="y" type="number"
                                                  label={{ value: "Quantiles empiriques", angle: -90, position: "insideLeft", fontSize: 10 }}
                                                  className="text-xs" domain={domain}
                                                />
                                                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => v.toFixed(3)} cursor={{ strokeDasharray: "3 3" }} />
                                                <Scatter data={refLine} line={{ stroke: "hsl(38,92%,50%)", strokeWidth: 1.5, strokeDasharray: "6 3" }} shape={() => null} legendType="none" />
                                                <Scatter data={qqPoints} fill="hsl(221,83%,53%)" fillOpacity={0.7} />
                                              </ScatterChart>
                                            </ResponsiveContainer>
                                          );
                                        })()}
                                      </div>

                                      {/* Histogram */}
                                      <div>
                                        <p className="text-xs font-semibold mb-2">Distribution — {r.col}</p>
                                        <p className="text-[11px] text-muted-foreground mb-3">
                                          Histogramme + courbe gaussienne (paramètres calculés sur l'échantillon)
                                        </p>
                                        {histWithCurve.length > 0 && (
                                          <ResponsiveContainer width="100%" height={260}>
                                            <ComposedChart data={histWithCurve} margin={{ top: 8, right: 16, bottom: 20, left: 8 }}>
                                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                              <XAxis dataKey="bin" className="text-xs"
                                                label={{ value: r.col, position: "insideBottom", offset: -10, fontSize: 10 }}
                                                interval="preserveStartEnd"
                                              />
                                              <YAxis className="text-xs" />
                                              <Tooltip contentStyle={TOOLTIP_STYLE} />
                                              <Bar dataKey="count" name="Fréquence" fill="hsl(221,83%,53%)" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                                              <Line dataKey="normal" name="Courbe normale" type="monotone" stroke="hsl(38,92%,50%)" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                                            </ComposedChart>
                                          </ResponsiveContainer>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!results && !loading && (
          <div className="rounded-2xl border-2 border-dashed border-muted p-12 text-center text-muted-foreground">
            <FlaskConical className="h-10 w-10 opacity-30 mx-auto mb-3" />
            <p className="text-sm">Sélectionnez des colonnes numériques et lancez les tests pour voir les résultats.</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
