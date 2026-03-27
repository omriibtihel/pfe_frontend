import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, RefreshCcw, Search, SlidersHorizontal, X as XIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

import databaseService, { CorrelationOut } from "@/services/databaseService";

type Props = {
  projectId: string;
  datasetId: number | null;
  dtypes?: Record<string, string> | null;
  maxCols?: number;
  topPairs?: number;
  /** When set, use version correlation endpoint instead of dataset endpoint */
  versionId?: number | null;
  /** Called whenever new correlation data is fetched — allows parent to include it in report */
  onDataReady?: (data: CorrelationOut) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isNumericDtype(dtype: string) {
  const d = (dtype || "").toLowerCase();
  return d.includes("int") || d.includes("float") || d.includes("double") || d.includes("number");
}

function corrColor(v: number, dark: boolean) {
  const x = Math.max(-1, Math.min(1, v));
  const t = Math.abs(x);
  const mid = dark ? [15, 23, 42] : [248, 250, 252];
  const pos = dark ? [59, 130, 246] : [37, 99, 235];
  const neg = dark ? [239, 68, 68] : [220, 38, 38];
  const base = x >= 0 ? pos : neg;
  const r = Math.round(mid[0] + (base[0] - mid[0]) * t);
  const g = Math.round(mid[1] + (base[1] - mid[1]) * t);
  const b = Math.round(mid[2] + (base[2] - mid[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function textColorForBg(rgb: string) {
  const nums = rgb.match(/\d+/g)?.map(Number);
  if (!nums || nums.length < 3) return "text-foreground";
  const [r, g, b] = nums;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 140 ? "text-white" : "text-slate-900";
}

type Pair = { a: string; b: string; corr: number };

function computeTopPairs(data: CorrelationOut, limit: number): { positive: Pair[]; negative: Pair[] } {
  const cols = data.columns;
  const m = data.matrix;
  const pairs: Pair[] = [];
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const v = m?.[i]?.[j];
      if (!Number.isFinite(v)) continue;
      pairs.push({ a: cols[i], b: cols[j], corr: v });
    }
  }
  return {
    positive: [...pairs].sort((a, b) => b.corr - a.corr).slice(0, limit),
    negative: [...pairs].sort((a, b) => a.corr - b.corr).slice(0, limit),
  };
}

function isDarkMode() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export default function CorrelationHeatmap({
  projectId,
  datasetId,
  dtypes,
  maxCols = 20,
  topPairs = 8,
  versionId,
  onDataReady,
}: Props) {
  const { toast } = useToast();

  const numericColumns = useMemo(
    () =>
      Object.entries(dtypes ?? {})
        .filter(([, dtype]) => isNumericDtype(dtype))
        .map(([name]) => name),
    [dtypes],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [data, setData] = useState<CorrelationOut | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [colOpen, setColOpen] = useState(false);
  const [colSearch, setColSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapWidth, setWrapWidth] = useState(900);

  // dark mode observer
  useEffect(() => {
    const update = () => setDark(isDarkMode());
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // container width observer
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && Number.isFinite(w)) setWrapWidth(w);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // init / reset when source changes
  useEffect(() => {
    const init = new Set(numericColumns.slice(0, Math.min(10, maxCols)));
    setSelected(init);
    setData(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, versionId]);

  const selectedArray = useMemo(
    () => numericColumns.filter((c) => selected.has(c)),
    [numericColumns, selected],
  );

  const canCompute = selectedArray.length >= 2;

  // auto-recompute with debounce when selection changes
  useEffect(() => {
    if (!canCompute) { setData(null); return; }
    const timer = setTimeout(() => { void fetchCorr(selectedArray); }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArray.join(",")]);

  const fetchCorr = async (cols: string[]) => {
    setIsLoading(true);
    try {
      const res = versionId
        ? await databaseService.versionCorrelation(projectId, versionId, cols)
        : await databaseService.correlation(projectId, datasetId!, cols);
      setData(res);
      onDataReady?.(res);
    } catch (e) {
      toast({
        title: "Erreur",
        description: (e as Error).message || "Impossible de générer la matrice",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggle = (col: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        if (next.size >= maxCols) {
          toast({ title: `Maximum ${maxCols} colonnes`, variant: "destructive" });
          return prev;
        }
        next.add(col);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(numericColumns.slice(0, maxCols)));
  const clearAll = () => setSelected(new Set());

  // grid cell sizing
  const cellPx = useMemo(() => {
    const n = (data?.columns?.length ?? selectedArray.length) + 1;
    if (n <= 1) return 64;
    const safe = Math.max(260, wrapWidth - 2);
    return clamp(Math.floor(safe / n), 22, 82);
  }, [wrapWidth, data?.columns?.length, selectedArray.length]);

  const headerVertical = cellPx < 56;
  const showNumbers = cellPx >= 34;
  const textClass = cellPx >= 56 ? "text-xs" : cellPx >= 36 ? "text-[10px]" : "text-[9px]";
  const padClass = cellPx >= 56 ? "p-2" : cellPx >= 36 ? "p-1.5" : "p-1";

  const [showTopPairs, setShowTopPairs] = useState(false);
  const top = useMemo(
    () => (data && showTopPairs ? computeTopPairs(data, topPairs) : null),
    [data, showTopPairs, topPairs],
  );

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              Matrice de corrélation
            </CardTitle>
            <CardDescription>Corrélation (Pearson) entre colonnes numériques (−1 à +1).</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{selectedArray.length} / {numericColumns.length} colonnes</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchCorr(selectedArray)}
              disabled={isLoading || !canCompute}
            >
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                : <RefreshCcw className="h-4 w-4 mr-1.5" />}
              Actualiser
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {numericColumns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune colonne numérique dans ce dataset.</p>
        ) : (
          <>
            {/* ── Column picker ───────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm font-semibold shrink-0">Colonnes</p>
              <Popover open={colOpen} onOpenChange={setColOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm hover:bg-muted/50 transition min-w-[220px] text-left">
                    <span className="flex-1 text-xs text-muted-foreground truncate">
                      {selectedArray.length === 0
                        ? "Choisir colonnes"
                        : `${selectedArray.length} colonne${selectedArray.length > 1 ? "s" : ""} sélectionnée${selectedArray.length > 1 ? "s" : ""}`}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">{selectedArray.length}/{numericColumns.length}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-0">
                  {/* header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="text-xs font-semibold">{selectedArray.length} / {numericColumns.length} sélectionnée{selectedArray.length > 1 ? "s" : ""}</span>
                    <div className="flex gap-3 text-xs">
                      <button className="text-primary hover:underline" onClick={selectAll}>Tout</button>
                      <button className="text-muted-foreground hover:underline" onClick={clearAll}>Aucune</button>
                    </div>
                  </div>
                  {/* search */}
                  {numericColumns.length > 8 && (
                    <div className="flex items-center gap-1.5 px-3 py-2 border-b">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
                        placeholder="Rechercher..."
                        value={colSearch}
                        onChange={(e) => setColSearch(e.target.value)}
                      />
                      {colSearch && (
                        <button onClick={() => setColSearch("")} className="text-muted-foreground hover:text-foreground">
                          <XIcon className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                  {/* list */}
                  <div className="max-h-60 overflow-y-auto p-1">
                    {numericColumns
                      .filter((c) => !colSearch || c.toLowerCase().includes(colSearch.toLowerCase()))
                      .map((col) => {
                        const isSelected = selected.has(col);
                        return (
                          <button
                            key={col}
                            onClick={() => toggle(col)}
                            className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs text-left hover:bg-muted/60 transition cursor-pointer"
                          >
                            <span
                              className="h-4 w-4 rounded border flex items-center justify-center shrink-0 transition"
                              style={isSelected ? { backgroundColor: "hsl(var(--primary))", borderColor: "hsl(var(--primary))" } : {}}
                            >
                              {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                            </span>
                            <span className="truncate flex-1" title={col}>{col}</span>
                          </button>
                        );
                      })}
                    {colSearch && numericColumns.filter((c) => c.toLowerCase().includes(colSearch.toLowerCase())).length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-3">Aucune colonne</p>
                    )}
                  </div>
                  <div className="px-3 py-2 border-t text-[10px] text-muted-foreground">
                    Maximum {maxCols} colonnes
                  </div>
                </PopoverContent>
              </Popover>
              {!canCompute && selectedArray.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">&#9888; min. 2 colonnes</p>
              )}
            </div>

            {/* ── Loading indicator ────────────────────────────────────── */}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calcul en cours…
              </div>
            )}

            {/* ── Heatmap grid ─────────────────────────────────────────── */}
            {!isLoading && data && (
              <div className="space-y-4">
                <div ref={wrapRef} className="rounded-xl border bg-background overflow-hidden w-full">
                  <div
                    className="grid w-full"
                    style={{ gridTemplateColumns: `repeat(${data.columns.length + 1}, minmax(0, 1fr))` }}
                  >
                    {/* top-left empty cell */}
                    <div className={`border-b border-r bg-muted/30 ${padClass}`} />

                    {/* column headers */}
                    {data.columns.map((c) => (
                      <div
                        key={`h-${c}`}
                        className={`border-b bg-muted/30 ${padClass} ${textClass} font-medium`}
                        title={c}
                        style={
                          headerVertical
                            ? { writingMode: "vertical-rl", transform: "rotate(180deg)", lineHeight: 1, textAlign: "left" }
                            : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
                        }
                      >
                        {headerVertical ? c : <span className="block truncate">{c}</span>}
                      </div>
                    ))}

                    {/* rows */}
                    {data.columns.map((rowName, i) => (
                      <Fragment key={`row-${rowName}`}>
                        <div
                          className={`border-r bg-muted/30 ${padClass} ${textClass} font-medium`}
                          title={rowName}
                          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          <span className="block truncate">{rowName}</span>
                        </div>
                        {data.columns.map((colName, j) => {
                          const v = data.matrix?.[i]?.[j] ?? 0;
                          const bg = corrColor(Number(v), dark);
                          const txt = textColorForBg(bg);
                          return (
                            <div
                              key={`${rowName}-${colName}`}
                              className={`border-t text-center relative group select-none ${txt} ${textClass} ${padClass}`}
                              style={{ backgroundColor: bg }}
                              title={`${rowName} × ${colName}\nr = ${Number(v).toFixed(4)}`}
                            >
                              <span className={showNumbers ? "" : "opacity-0 group-hover:opacity-100 transition"}>
                                {Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "0.00"}
                              </span>
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>

                {/* legend */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-10 rounded-sm" style={{ background: "linear-gradient(90deg, rgb(220,38,38), rgb(248,250,252), rgb(37,99,235))" }} />
                  </div>
                  <span>−1 (négative)</span>
                  <span className="mx-1">·</span>
                  <span>0 (neutre)</span>
                  <span className="mx-1">·</span>
                  <span>+1 (positive)</span>
                </div>

                {/* Top pairs — accordéon */}
                <div className="rounded-xl border bg-muted/20 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/40 transition-colors"
                    onClick={() => setShowTopPairs((v) => !v)}
                  >
                    <span>Top corrélations</span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showTopPairs ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showTopPairs && (
                    <div className="px-4 pb-4 space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Paires les plus corrélées positivement et négativement.
                      </p>
                      <Separator />
                      {top ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="rounded-lg border bg-background p-3">
                            <p className="text-sm font-medium mb-2">Positives</p>
                            <div className="space-y-2">
                              {top.positive.map((p) => (
                                <div key={`pos-${p.a}-${p.b}`} className="rounded-md border bg-card p-2">
                                  <div className="text-xs text-muted-foreground truncate" title={`${p.a} × ${p.b}`}>
                                    {p.a} × {p.b}
                                  </div>
                                  <div className="flex items-center justify-between mt-1">
                                    <Badge variant="secondary">+{p.corr.toFixed(3)}</Badge>
                                    <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                                      <div className="h-full bg-primary rounded-full" style={{ width: `${clamp(p.corr * 100, 0, 100)}%` }} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-lg border bg-background p-3">
                            <p className="text-sm font-medium mb-2">Négatives</p>
                            <div className="space-y-2">
                              {top.negative.map((p) => (
                                <div key={`neg-${p.a}-${p.b}`} className="rounded-md border bg-card p-2">
                                  <div className="text-xs text-muted-foreground truncate" title={`${p.a} × ${p.b}`}>
                                    {p.a} × {p.b}
                                  </div>
                                  <div className="flex items-center justify-between mt-1">
                                    <Badge variant="destructive">{p.corr.toFixed(3)}</Badge>
                                    <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                                      <div className="h-full bg-destructive rounded-full" style={{ width: `${clamp(Math.abs(p.corr) * 100, 0, 100)}%` }} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <p className="md:col-span-2 text-xs text-muted-foreground">
                            Corrélation ≠ causalité. À interpréter avec le contexte métier.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isLoading && !data && canCompute && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sélection en cours de calcul…
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
