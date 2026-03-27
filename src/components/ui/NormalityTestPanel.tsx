import { useState, useCallback, useMemo } from "react";
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
import { ChevronDown, FlaskConical, RefreshCw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import databaseService, {
  NormalityColResult,
  HistogramOut,
  SampleOut,
} from "@/services/databaseService";
import type { DatasetProfileOut } from "@/services/databaseService";

// ─────────────────────────────────────────────────────────────────────────────
// Probit (inverse normal CDF) — rational approximation (Abramowitz & Stegun)
// ─────────────────────────────────────────────────────────────────────────────
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

type UiColumn = { name: string; kind: DatasetProfileOut["profiles"][number]["kind"] };

interface NormalityTestPanelProps {
  projectId: string;
  activeDatasetId: number;
  columns: UiColumn[];
  /** When set, use version analytics endpoints instead of dataset endpoints */
  versionId?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const KIND_BADGE: Record<string, { label: string; cls: string }> = {
  numeric:     { label: "num",  cls: "text-emerald-600 dark:text-emerald-400" },
  categorical: { label: "cat",  cls: "text-amber-500 dark:text-amber-400" },
  text:        { label: "txt",  cls: "text-sky-500 dark:text-sky-400" },
  datetime:    { label: "date", cls: "text-purple-500 dark:text-purple-400" },
  unknown:     { label: "?",    cls: "text-muted-foreground" },
};

export function NormalityTestPanel({ projectId, activeDatasetId, columns, versionId }: NormalityTestPanelProps) {
  const { toast } = useToast();

  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NormalityColResult[] | null>(null);
  const [activeResult, setActiveResult] = useState<NormalityColResult | null>(null);

  const [qqPoints, setQqPoints] = useState<{ x: number; y: number }[]>([]);
  const [histWithCurve, setHistWithCurve] = useState<{ bin: string; count: number; normal: number; mid: number }[]>([]);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Run normality tests ──────────────────────────────────────────────────
  const runTests = useCallback(async () => {
    if (!selectedCols.length) return;
    setLoading(true);
    setResults(null);
    setActiveResult(null);
    setQqPoints([]);
    setHistWithCurve([]);
    try {
      const out = versionId
        ? await databaseService.versionNormalityTest(projectId, versionId, selectedCols)
        : await databaseService.normalityTest(projectId, activeDatasetId, selectedCols);
      setResults(out.results);
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [projectId, activeDatasetId, versionId, selectedCols, toast]);

  // ── Load detail (Q-Q + histogram) for a specific column ─────────────────
  const loadDetail = useCallback(async (res: NormalityColResult) => {
    setActiveResult(res);
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

      // Q-Q Plot points
      const raw = (sampleOut as SampleOut).rows
        .map((r) => Number(r[res.col]))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      const n = raw.length;
      const qq = raw.map((val, i) => ({
        x: parseFloat((res.mean + res.std * probit((i + 0.5) / n)).toFixed(4)),
        y: parseFloat(val.toFixed(4)),
      }));
      setQqPoints(qq);

      // Histogram + normal curve
      const bins = (histOut as HistogramOut).rows;
      const totalCount = bins.reduce((s, b) => s + b.count, 0);
      const hc = bins.map((b) => {
        const mid = (b.x0 + b.x1) / 2;
        const binWidth = b.x1 - b.x0;
        const normalFreq = normalPdf(mid, res.mean, res.std) * totalCount * binWidth;
        return {
          bin: `${b.x0.toFixed(2)}`,
          count: b.count,
          normal: parseFloat(normalFreq.toFixed(2)),
          mid,
        };
      });
      setHistWithCurve(hc);
    } catch (e) {
      toast({ title: "Erreur détail", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  }, [projectId, activeDatasetId, toast]);

  const filteredCols = useMemo(
    () => columns.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [columns, search]
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Toolbar : popover selector + run button ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Popover trigger */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8 text-sm font-normal">
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              Colonnes
              {selectedCols.length > 0 && (
                <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold px-1.5 py-px leading-none">
                  {selectedCols.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-64 p-0">
            {/* Search */}
            <div className="flex items-center border-b px-3 gap-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* List */}
            <ScrollArea className="max-h-56">
              {filteredCols.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Aucun résultat</p>
              ) : (
                filteredCols.map((c) => {
                  const sel = selectedCols.includes(c.name);
                  const kb = KIND_BADGE[c.kind] ?? KIND_BADGE.unknown;
                  return (
                    <div
                      key={c.name}
                      onClick={() => toggleCol(c.name)}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox checked={sel} onCheckedChange={() => toggleCol(c.name)} />
                      <span className="text-sm truncate flex-1">{c.name}</span>
                      <span className={`text-[10px] font-mono font-semibold shrink-0 ${kb.cls}`}>
                        {kb.label}
                      </span>
                    </div>
                  );
                })
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="flex items-center justify-between border-t px-3 py-2">
              <button
                onClick={toggleAllFiltered}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
              {selectedCols.length > 0 && (
                <button
                  onClick={() => setSelectedCols([])}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Effacer
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Selected chips */}
        {selectedCols.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 h-8 rounded-md border bg-muted/50 px-2.5 text-xs font-medium text-foreground"
          >
            {name}
            <button
              onClick={() => toggleCol(name)}
              className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Spacer + run button */}
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

      {/* Results table */}
      {results && results.length > 0 && (
        <Card className="rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <p className="font-semibold text-base">Résultats — Test de normalité</p>
            <p className="text-xs text-muted-foreground">
              Cliquez sur une ligne pour afficher le Q-Q Plot et l'histogramme.
              <br />
              Seuil α = 0.05 · Shapiro-Wilk (n ≤ 5 000) · D'Agostino-Pearson (n &gt; 5 000)
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Colonne</th>
                    <th className="px-4 py-2 text-left font-medium">Test</th>
                    <th className="px-4 py-2 text-right font-medium">n</th>
                    <th className="px-4 py-2 text-right font-medium">Moyenne</th>
                    <th className="px-4 py-2 text-right font-medium">Éc. type</th>
                    <th className="px-4 py-2 text-right font-medium">Asymétrie</th>
                    <th className="px-4 py-2 text-right font-medium">Aplatissement</th>
                    <th className="px-4 py-2 text-right font-medium">Stat.</th>
                    <th className="px-4 py-2 text-right font-medium">p-value</th>
                    <th className="px-4 py-2 text-center font-medium">Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const isActive = activeResult?.col === r.col;
                    return (
                      <tr
                        key={r.col}
                        onClick={() => void loadDetail(r)}
                        className={`border-b cursor-pointer transition-colors ${
                          isActive
                            ? "bg-primary/8 hover:bg-primary/12"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <td className="px-4 py-2.5 font-medium">{r.col}</td>
                        <td className="px-4 py-2.5 text-muted-foreground capitalize">
                          {r.test_used === "shapiro" ? "Shapiro-Wilk" : "D'Agostino"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.n.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.mean.toFixed(3)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.std.toFixed(3)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.skewness.toFixed(3)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.kurtosis.toFixed(3)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.stat.toFixed(4)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.p_value.toFixed(4)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge
                            variant="outline"
                            className={
                              r.is_normal
                                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                                : "border-rose-500 text-rose-600 dark:text-rose-400"
                            }
                          >
                            {r.is_normal ? "Normale" : "Non-normale"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail: Q-Q Plot + Histogram */}
      {activeResult && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Q-Q Plot */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Q-Q Plot — <span className="text-primary">{activeResult.col}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Points sur la droite = distribution normale
                  </p>
                </div>
                {detailLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </CardHeader>
            <CardContent>
              {qqPoints.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  {(() => {
                      // Compute shared domain so both axes + diagonal line align perfectly
                      const allVals = qqPoints.flatMap((p) => [p.x, p.y]);
                      const vMin = Math.min(...allVals);
                      const vMax = Math.max(...allVals);
                      const pad = (vMax - vMin) * 0.05;
                      const domain: [number, number] = [vMin - pad, vMax + pad];
                      const refLine = [{ x: vMin - pad, y: vMin - pad }, { x: vMax + pad, y: vMax + pad }];
                      return (
                        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="x"
                            type="number"
                            name="Quantiles théoriques"
                            label={{ value: "Quantiles théoriques", position: "insideBottom", offset: -10, fontSize: 11 }}
                            className="text-xs"
                            domain={domain}
                          />
                          <YAxis
                            dataKey="y"
                            type="number"
                            name="Quantiles empiriques"
                            label={{ value: "Quantiles empiriques", angle: -90, position: "insideLeft", fontSize: 11 }}
                            className="text-xs"
                            domain={domain}
                          />
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(v: number) => v.toFixed(3)}
                            cursor={{ strokeDasharray: "3 3" }}
                          />
                          {/* Diagonal y = x as a second Scatter with line — always fully visible */}
                          <Scatter
                            data={refLine}
                            line={{ stroke: "hsl(38, 92%, 50%)", strokeWidth: 1.5, strokeDasharray: "6 3" }}
                            shape={() => null}
                            legendType="none"
                          />
                          <Scatter
                            data={qqPoints}
                            fill="hsl(221, 83%, 53%)"
                            fillOpacity={0.7}
                          />
                        </ScatterChart>
                      );
                    })()}
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  {detailLoading ? "Chargement…" : "Sélectionnez une ligne du tableau"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histogram + normal curve */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">Distribution — <span className="text-primary">{activeResult.col}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Histogramme + courbe gaussienne théorique
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-500/70" />
                    Fréquence
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-4 border-t-2 border-dashed border-orange-400" />
                    Normale
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {histWithCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={histWithCurve} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="bin"
                      className="text-xs"
                      label={{ value: activeResult.col, position: "insideBottom", offset: -10, fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" name="Fréquence" fill="hsl(221, 83%, 53%)" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                    <Line
                      dataKey="normal"
                      name="Courbe normale"
                      type="monotone"
                      stroke="hsl(38, 92%, 50%)"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  {detailLoading ? "Chargement…" : "Sélectionnez une ligne du tableau"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <div className="rounded-2xl border-2 border-dashed border-muted p-12 text-center text-muted-foreground">
          <FlaskConical className="h-10 w-10 opacity-30 mx-auto mb-3" />
          <p className="text-sm">Sélectionnez des colonnes et lancez les tests pour voir les résultats.</p>
        </div>
      )}
    </div>
  );
}
