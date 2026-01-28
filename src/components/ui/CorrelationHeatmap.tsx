import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCcw, SlidersHorizontal, Check, ChevronDown } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";

import databaseService, { CorrelationOut } from "@/services/databaseService";

type Props = {
  projectId: string;
  datasetId: number;
  dtypes?: Record<string, string> | null;
  maxCols?: number;   // default 20
  topPairs?: number;  // default 8
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

  const mid = dark ? [15, 23, 42] : [248, 250, 252]; // slate-ish
  const pos = dark ? [59, 130, 246] : [37, 99, 235]; // blue
  const neg = dark ? [239, 68, 68] : [220, 38, 38];  // red
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

  const positive = [...pairs].sort((p1, p2) => p2.corr - p1.corr).slice(0, limit);
  const negative = [...pairs].sort((p1, p2) => p1.corr - p2.corr).slice(0, limit);
  return { positive, negative };
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
}: Props) {
  const { toast } = useToast();

  const numericColumns = useMemo(() => {
    return Object.entries(dtypes ?? {})
      .filter(([, dtype]) => isNumericDtype(dtype))
      .map(([name]) => name);
  }, [dtypes]);

  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [topN, setTopN] = useState<number>(Math.min(10, numericColumns.length || 10));
  const [manualSelected, setManualSelected] = useState<string[]>([]);
  const [openPicker, setOpenPicker] = useState(false);

  const [data, setData] = useState<CorrelationOut | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [dark, setDark] = useState(false);

  // measure available width for “no-scroll” grid
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapWidth, setWrapWidth] = useState<number>(900);

  useEffect(() => {
    const update = () => setDark(isDarkMode());
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && Number.isFinite(w)) setWrapWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // defaults on dataset change
    const initial = numericColumns.slice(0, Math.min(10, maxCols, numericColumns.length));
    setManualSelected(initial);
    setTopN(Math.min(10, numericColumns.length || 10));
    setData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  const selectedColumns = useMemo(() => {
    if (mode === "manual") {
      const set = new Set(manualSelected);
      const ordered = numericColumns.filter((c) => set.has(c));
      return ordered.slice(0, maxCols);
    }
    const n = Math.max(2, Math.min(maxCols, topN, numericColumns.length));
    return numericColumns.slice(0, n);
  }, [mode, manualSelected, numericColumns, topN, maxCols]);

  const canCompute = selectedColumns.length >= 2;

  // IMPORTANT: “no scroll” => we FORCE cells to fit the available width.
  // cell size shrinks as columns increase.
  const cellPx = useMemo(() => {
    const n = (data?.columns?.length ?? selectedColumns.length) + 1; // + header col
    if (n <= 1) return 64;
    const safe = Math.max(260, wrapWidth - 2); // small padding
    const auto = Math.floor(safe / n);
    // allow very small cells on small screens (to avoid scroll)
    return clamp(auto, 22, 82);
  }, [wrapWidth, data?.columns?.length, selectedColumns.length]);

  const headerVertical = cellPx < 56;
  const showNumbers = cellPx >= 34; // hide numbers if too tiny (still visible on hover)
  const textClass = cellPx >= 56 ? "text-xs" : cellPx >= 36 ? "text-[10px]" : "text-[9px]";
  const padClass = cellPx >= 56 ? "p-2" : cellPx >= 36 ? "p-1.5" : "p-1";

  const top = useMemo(() => (data ? computeTopPairs(data, topPairs) : null), [data, topPairs]);

  const fetchCorr = async () => {
    if (!canCompute) {
      toast({
        title: "Corrélation indisponible",
        description: "Il faut au moins 2 colonnes numériques.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      const res = await databaseService.correlation(projectId, datasetId, selectedColumns);
      setData(res);
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

  // auto compute when dataset changes (if possible)
  useEffect(() => {
    if (numericColumns.length >= 2) fetchCorr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  const toggleManualColumn = (col: string) => {
    setManualSelected((prev) => {
      const has = prev.includes(col);
      if (has) return prev.filter((x) => x !== col);

      if (prev.length >= maxCols) {
        toast({
          title: "Limite atteinte",
          description: `Maximum ${maxCols} colonnes.`,
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, col];
    });
  };

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              Matrice de corrélation
            </CardTitle>
            <CardDescription>Corrélation (Pearson) entre colonnes numériques (−1 à +1).</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Numériques: {numericColumns.length}</Badge>
            <Badge variant="outline">Sélection: {selectedColumns.length}</Badge>

            <Button variant={mode === "auto" ? "default" : "outline"} onClick={() => setMode("auto")} size="sm">
              Auto
            </Button>
            <Button variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")} size="sm">
              Manuel
            </Button>

            <Button variant="outline" onClick={fetchCorr} disabled={isLoading || !canCompute} size="sm">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
              Générer
            </Button>
          </div>
        </div>

        {mode === "auto" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Nombre de colonnes utilisées</p>
                <p className="text-sm text-muted-foreground">
                  {Math.max(2, Math.min(maxCols, topN, numericColumns.length))} / {Math.min(maxCols, numericColumns.length)}
                </p>
              </div>
              <div className="pt-2">
                <Slider
                  value={[topN]}
                  min={2}
                  max={Math.max(2, Math.min(maxCols, numericColumns.length || 2))}
                  step={1}
                  onValueChange={(v) => setTopN(v[0])}
                  disabled={numericColumns.length < 2}
                />
              </div>
                <p className="text-sm font-medium mb-2">Lecture rapide</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• +1 : corrélation positive forte</li> <li>• 0 : pas de relation linéaire</li>
                    <li>• −1 : corrélation négative forte</li>
                </ul>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-sm font-medium mb-1">Colonnes sélectionnées</p>
              <div className="flex flex-wrap gap-2">
                {selectedColumns.slice(0, 10).map((c) => (
                  <Badge key={c} variant="outline" className="truncate max-w-[160px]">
                    {c}
                  </Badge>
                ))}
                {selectedColumns.length > 10 && <Badge variant="outline">+{selectedColumns.length - 10}</Badge>}
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm">
                <span className="font-medium">Sélection manuelle</span>{" "}
                <span className="text-muted-foreground">(max {maxCols} colonnes)</span>
              </div>

              <Popover open={openPicker} onOpenChange={setOpenPicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-between md:w-[360px] w-full">
                    {manualSelected.length === 0 ? "Choisir des colonnes…" : `${manualSelected.length} colonne(s) sélectionnée(s)`}
                    <ChevronDown className="h-4 w-4 ml-2 opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[380px]" align="end">
                  <Command>
                    <CommandInput placeholder="Rechercher une colonne…" />
                    <CommandEmpty>Aucun résultat.</CommandEmpty>
                    <CommandGroup heading="Colonnes numériques">
                      {numericColumns.map((col) => {
                        const checked = manualSelected.includes(col);
                        return (
                          <CommandItem
                            key={col}
                            onSelect={() => toggleManualColumn(col)}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`h-4 w-4 inline-flex items-center justify-center rounded border ${
                                  checked ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                                }`}
                              >
                                {checked ? <Check className="h-3 w-3" /> : null}
                              </span>
                              <span className="truncate" title={col}>
                                {col}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">{dtypes?.[col] ?? ""}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {manualSelected.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedColumns.map((c) => (
                  <Badge key={c} variant="secondary" className="cursor-pointer" title="Cliquer pour retirer" onClick={() => toggleManualColumn(c)}>
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {!canCompute ? (
          <div className="text-sm text-muted-foreground">
            Il faut au moins 2 colonnes numériques pour afficher la matrice.
          </div>
        ) : !data ? (
          <div className="text-sm text-muted-foreground">
            Clique sur <span className="font-medium">Générer</span> pour créer la heatmap.
          </div>
        ) : (
          <div className="space-y-4">
                <div ref={wrapRef} className="rounded-xl border bg-background overflow-hidden w-full">
                <div
                    className="grid w-full"
                    style={{
                    gridTemplateColumns: `repeat(${data.columns.length + 1}, minmax(0, 1fr))`,
                    }}
                >

                {/* top-left */}
                <div className={`border-b border-r bg-muted/30 ${padClass}`} />

                {/* column headers */}
                {data.columns.map((c) => (
                  <div
                    key={`h-${c}`}
                    className={`border-b bg-muted/30 ${padClass} ${textClass} font-medium`}
                    title={c}
                    style={
                      headerVertical
                        ? {
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                            lineHeight: 1,
                            textAlign: "left",
                          }
                        : {
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }
                    }
                  >
                    {headerVertical ? c : <span className="block truncate">{c}</span>}
                  </div>
                ))}

                {/* rows */}
                {data.columns.map((rowName, i) => (
                  <Fragment key={`row-${rowName}`}>
                    {/* row header */}
                    <div
                      className={`border-r bg-muted/30 ${padClass} ${textClass} font-medium`}
                      title={rowName}
                      style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      <span className="block truncate">{rowName}</span>
                    </div>

                    {/* cells */}
                    {data.columns.map((colName, j) => {
                      const v = data.matrix?.[i]?.[j] ?? 0;
                      const bg = corrColor(Number(v), dark);
                      const txt = textColorForBg(bg);

                      return (
                        <div
                          key={`${rowName}-${colName}`}
                          className={`border-t text-center relative group select-none ${txt} ${textClass} ${padClass}`}
                          style={{ backgroundColor: bg }}
                          title={`${rowName} × ${colName}\ncorrelation = ${Number(v).toFixed(4)}`}
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

            {/* TOP CORRELATIONS UNDER HEATMAP (positives next to negatives) */}
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">Top corrélations</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Paires les plus corrélées (positives) et anti-corrélées (négatives).
                  </p>
                </div>
                <Badge variant="outline">{topPairs}</Badge>
              </div>

              <Separator className="my-3" />

              {!top ? (
                <div className="text-sm text-muted-foreground">Aucune donnée.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Positive */}
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-sm font-medium mb-2">📈 Positives</p>
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

                  {/* Negative */}
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-sm font-medium mb-2">📉 Négatives</p>
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

                  <div className="md:col-span-2 text-xs text-muted-foreground">
                    ⚠️ Corrélation ≠ causalité. À interpréter avec le contexte.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
