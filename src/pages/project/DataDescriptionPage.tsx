// DataDescriptionPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FileText,
  ChevronRight,
  Hash,
  Type,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Info,
  Download,
  Search,
  ArrowUpDown,
  BarChart3,
  Database as DatabaseIcon,
  RefreshCcw,
  PieChart as PieIcon,
  LineChart as LineIcon,
  TrendingUp,
  Activity,
  Grid3X3,
  Filter,
} from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import { useToast } from "@/hooks/use-toast";

import datasetService, { DatasetOut as DatasetListItem } from "@/services/datasetService";
import databaseService, {
  DatasetOverviewOut,
  DatasetProfileOut,
} from "@/services/databaseService";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart as RechartsLineChart,
  Line,
} from "recharts";

type ColumnType = "numeric" | "categorical" | "text" | "datetime" | "unknown";

type UiColumn = {
  name: string;
  type: DatasetProfileOut["profiles"][number]["kind"];
  nullCount: number;
  uniqueCount: number | null;
  sampleValues: string[]; // pour categorical/text/datetime: top values
  stats?: {
    min?: number | null;
    mean?: number | null;
    max?: number | null;
    std?: number | null;
    p25?: number | null;
    p50?: number | null;
    p75?: number | null;
  };
};

type UiDataset = {
  id: number;
  name: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  columns: UiColumn[];
};

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(262, 83%, 58%)",
  "hsl(174, 84%, 32%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(142, 76%, 36%)",
];

function toUiType(kind: string): ColumnType {
  const k = (kind || "").toLowerCase();
  if (k === "numeric") return "numeric";
  if (k === "categorical") return "categorical";
  if (k === "text") return "text";
  if (k === "datetime") return "datetime";
  return "unknown";
}

function prettyType(kind: UiColumn["type"]) {
  if (kind === "numeric") return "Numérique";
  if (kind === "categorical") return "Catégorielle";
  if (kind === "text") return "Texte";
  if (kind === "datetime") return "Date/Heure";
  return "Inconnu";
}

function formatNum(v: unknown, digits = 2) {
  if (typeof v === "number" && Number.isFinite(v)) return v.toFixed(digits);
  return "—";
}

export function DataDescriptionPage() {
  const { id } = useParams();
  const projectId = id!;
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);

  const [overview, setOverview] = useState<DatasetOverviewOut | null>(null);
  const [profile, setProfile] = useState<DatasetProfileOut | null>(null);
  const [datasetMeta, setDatasetMeta] = useState<DatasetListItem | null>(null);

  // Table filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "type" | "nulls">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Charts state
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  const topK = 5;

  const load = async (opts?: { forceDatasetId?: number | null }) => {
    const forced = opts?.forceDatasetId ?? null;

    if (!isLoading) setIsRefreshing(true);
    else setIsRefreshing(false);

    try {
      const dsList = await datasetService.list(projectId);
      setDatasets(dsList as any);

      const active = await databaseService.getActiveDataset(projectId);
      const chosen =
        forced ??
        active.active_dataset_id ??
        (dsList?.[0]?.id ?? null);

      setActiveDatasetId(chosen);

      if (!chosen) {
        setOverview(null);
        setProfile(null);
        setDatasetMeta(null);
        setSelectedColumns([]);
        return;
      }

      const meta = dsList.find((d) => d.id === chosen) ?? null;
      setDatasetMeta(meta);

      const [o, p] = await Promise.all([
        databaseService.getOverview(projectId, chosen, 10),
        databaseService.getProfile(projectId, chosen, topK),
      ]);

      setOverview(o);
      setProfile(p);
    } catch (error) {
      toast({
        title: "Erreur",
        description: (error as Error).message || "Impossible de charger la description",
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

  const uiDataset: UiDataset | null = useMemo(() => {
    if (!overview || !profile || !activeDatasetId) return null;

    const rows = overview.shape?.rows ?? 0;
    const cols = overview.shape?.cols ?? 0;

    const mappedCols: UiColumn[] = profile.profiles.map((c) => {
      // ⚠️ Ton type actuel indique: categorical = { unique: number; top_values: ... }
      // Donc unique existe seulement si ton backend le renvoie.
      const uniqueCount =
        c.kind === "categorical" || c.kind === "text" || c.kind === "datetime"
          ? (c.categorical?.unique ?? null)
          : null;

      const sampleValues =
        c.kind === "categorical" || c.kind === "text" || c.kind === "datetime"
          ? (c.categorical?.top_values ?? []).map((tv) => String(tv.value)).slice(0, 6)
          : [];

      const stats =
        c.kind === "numeric" && c.numeric
          ? {
              min: c.numeric.min ?? null,
              mean: c.numeric.mean ?? null,
              max: c.numeric.max ?? null,
              std: c.numeric.std ?? null,
              p25: c.numeric.p25 ?? null,
              p50: c.numeric.p50 ?? null,
              p75: c.numeric.p75 ?? null,
            }
          : undefined;

      return {
        name: c.name,
        type: c.kind,
        nullCount: c.missing ?? 0,
        uniqueCount,
        sampleValues,
        stats,
      };
    });

    return {
      id: activeDatasetId,
      name: datasetMeta?.original_name ?? `Dataset #${activeDatasetId}`,
      fileName: datasetMeta?.original_name ?? "—",
      rowCount: rows,
      columnCount: cols,
      columns: mappedCols,
    };
  }, [overview, profile, activeDatasetId, datasetMeta]);

  const numericColumns = useMemo(
    () => (uiDataset ? uiDataset.columns.filter((c) => c.type === "numeric") : []),
    [uiDataset]
  );

  const categoricalColumns = useMemo(
    () =>
      uiDataset
        ? uiDataset.columns.filter(
            (c) => c.type === "categorical" || c.type === "text" || c.type === "datetime"
          )
        : [],
    [uiDataset]
  );

  // Init selectedColumns (first 4 numeric) when dataset changes
  useEffect(() => {
    if (!uiDataset) return;
    const defaults = uiDataset.columns
      .filter((c) => c.type === "numeric")
      .slice(0, 4)
      .map((c) => c.name);
    setSelectedColumns(defaults);
  }, [uiDataset?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalNulls = useMemo(() => {
    if (!uiDataset) return 0;
    return uiDataset.columns.reduce((sum, c) => sum + (c.nullCount || 0), 0);
  }, [uiDataset]);

  const completenessScore = useMemo(() => {
    if (!uiDataset) return 0;
    const totalCells = uiDataset.rowCount * uiDataset.columnCount;
    if (!totalCells) return 0;
    return Math.max(0, Math.min(100, Math.round((1 - totalNulls / totalCells) * 100)));
  }, [uiDataset, totalNulls]);

  const filteredColumns = useMemo(() => {
    if (!uiDataset) return [];
    const q = searchQuery.trim().toLowerCase();

    return uiDataset.columns
      .filter((col) => (q ? col.name.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === "name") comparison = a.name.localeCompare(b.name);
        else if (sortBy === "type") comparison = a.type.localeCompare(b.type);
        else if (sortBy === "nulls") comparison = (a.nullCount || 0) - (b.nullCount || 0);
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [uiDataset, searchQuery, sortBy, sortDirection]);

  // ---------------- Charts Data (based on existing uiDataset) ----------------
  const distributionData = useMemo(() => {
    // On ne peut pas reconstruire min/max/avg depuis sampleValues (catégorielles)
    // Donc on utilise directement les stats numériques si dispo.
    return numericColumns.map((col) => ({
      name: col.name,
      min: col.stats?.min ?? null,
      max: col.stats?.max ?? null,
      avg: col.stats?.mean ?? null,
    }));
  }, [numericColumns]);

  const categoryData = useMemo(() => {
    return categoricalColumns.map((col) => ({
      name: col.name,
      uniqueValues: col.uniqueCount ?? 0,
      nulls: col.nullCount ?? 0,
    }));
  }, [categoricalColumns]);

  const pieData = useMemo(() => {
    return categoricalColumns.slice(0, 5).map((col, i) => ({
      name: col.name,
      value: col.uniqueCount ?? 0,
      fill: COLORS[i % COLORS.length],
    }));
  }, [categoricalColumns]);

  const missingData = useMemo(() => {
    if (!uiDataset) return [];
    return uiDataset.columns
      .filter((c) => (c.nullCount ?? 0) > 0)
      .map((col) => ({
        name: col.name,
        nulls: col.nullCount,
        valid: uiDataset.rowCount - col.nullCount,
        percentage: uiDataset.rowCount ? ((col.nullCount / uiDataset.rowCount) * 100) : 0,
      }))
      .sort((a, b) => b.nulls - a.nulls);
  }, [uiDataset]);

  const toggleColumn = (colName: string) => {
    setSelectedColumns((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName]
    );
  };

  // ---------------- UI helpers ----------------
  const getTypeIcon = (type: ColumnType) => {
    switch (type) {
      case "numeric":
        return <Hash className="h-4 w-4 text-primary" />;
      case "categorical":
      case "text":
        return <Type className="h-4 w-4 text-secondary" />;
      case "datetime":
        return <Calendar className="h-4 w-4 text-accent" />;
      default:
        return <Type className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getQualityBadge = (nullCount: number, rowCount: number) => {
    const pct = rowCount ? (nullCount / rowCount) * 100 : 0;
    if (pct === 0) return <Badge className="bg-emerald-600 text-white">Parfait</Badge>;
    if (pct < 5) return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Bon</Badge>;
    if (pct < 15) return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Attention</Badge>;
    return <Badge className="bg-destructive text-destructive-foreground">Critique</Badge>;
  };

  const toggleSort = (column: "name" | "type" | "nulls") => {
    if (sortBy === column) setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const onRefresh = async () => {
    await load({ forceDatasetId: activeDatasetId });
  };

  if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;
  if (!uiDataset) return <AppLayout><div className="p-6">Aucune donnée</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to={`/projects/${projectId}/database`} className="hover:text-foreground transition-colors">
            Base de données
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Description</span>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              Description des données
            </h1>
            <p className="text-muted-foreground mt-1">
              Profil des colonnes + visualisations rapides (sans quitter la page)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Rafraîchir
            </Button>
            <Button variant="outline" disabled>
              <Download className="h-4 w-4 mr-2" />
              Exporter le rapport
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-bl-full" />
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DatabaseIcon className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Dataset</span>
              </div>
              <p className="text-2xl font-bold truncate">{uiDataset.name}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{uiDataset.fileName}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Hash className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Dimensions</span>
              </div>
              <p className="text-2xl font-bold">
                {uiDataset.rowCount} × {uiDataset.columnCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">lignes × colonnes</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Complétude</span>
              </div>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold">{completenessScore}%</p>
                <Progress value={completenessScore} className="h-2 flex-1 mb-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Valeurs nulles</span>
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalNulls}</p>
              <p className="text-xs text-muted-foreground mt-1">
                sur {uiDataset.rowCount * uiDataset.columnCount} cellules
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ------------------- NEW: Visualisations integrated ------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-secondary" />
              Visualisations rapides
            </CardTitle>
            <CardDescription>
              Basées sur le profil (min/max/moyenne + uniques + valeurs manquantes).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Stats (charts header cards) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Numériques</p>
                      <p className="text-2xl font-bold text-primary">{numericColumns.length}</p>
                    </div>
                    <Activity className="h-8 w-8 text-primary/40" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Catégorielles</p>
                      <p className="text-2xl font-bold text-secondary">{categoricalColumns.length}</p>
                    </div>
                    <PieIcon className="h-8 w-8 text-secondary/40" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Total lignes</p>
                      <p className="text-2xl font-bold text-accent">{uiDataset.rowCount}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-accent/40" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Avec valeurs nulles</p>
                      <p className="text-2xl font-bold text-warning">{missingData.length}</p>
                    </div>
                    <Grid3X3 className="h-8 w-8 text-warning/40" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Column Filter (numeric) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  Colonnes numériques à visualiser
                </CardTitle>
                <CardDescription>
                  Affiche seulement les colonnes numériques sélectionnées dans les graphiques.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {numericColumns.map((col) => (
                    <label
                      key={col.name}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${
                        selectedColumns.includes(col.name)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Checkbox
                        checked={selectedColumns.includes(col.name)}
                        onCheckedChange={() => toggleColumn(col.name)}
                      />
                      <span className="text-sm">{col.name}</span>
                    </label>
                  ))}
                  {!numericColumns.length && (
                    <span className="text-sm text-muted-foreground">Aucune colonne numérique détectée.</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Charts Tabs */}
            <Tabs defaultValue="distribution" className="space-y-6">
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="distribution" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Distribution
                </TabsTrigger>
                <TabsTrigger value="categories" className="flex items-center gap-2">
                  <PieIcon className="h-4 w-4" />
                  Catégories
                </TabsTrigger>
                <TabsTrigger value="missing" className="flex items-center gap-2">
                  <LineIcon className="h-4 w-4" />
                  Valeurs manquantes
                </TabsTrigger>
                <TabsTrigger value="correlation" className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Corrélation
                </TabsTrigger>
              </TabsList>

              {/* Distribution */}
              <TabsContent value="distribution" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        Distribution (min / moy / max)
                      </CardTitle>
                      <CardDescription>
                        Calculée à partir des statistiques du profil.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart
                          data={distributionData.filter((d) => selectedColumns.includes(d.name))}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          <Bar dataKey="min" fill="hsl(221, 83%, 53%)" name="Min" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="avg" fill="hsl(262, 83%, 58%)" name="Moyenne" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="max" fill="hsl(174, 84%, 32%)" name="Max" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-secondary" />
                        Tendances (moyenne & max)
                      </CardTitle>
                      <CardDescription>Vue rapide sur l’ordre des colonnes sélectionnées.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={320}>
                        <RechartsLineChart
                          data={distributionData.filter((d) => selectedColumns.includes(d.name))}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="avg"
                            stroke="hsl(221, 83%, 53%)"
                            strokeWidth={2}
                            dot={{ fill: "hsl(221, 83%, 53%)" }}
                            name="Moyenne"
                          />
                          <Line
                            type="monotone"
                            dataKey="max"
                            stroke="hsl(262, 83%, 58%)"
                            strokeWidth={2}
                            dot={{ fill: "hsl(262, 83%, 58%)" }}
                            name="Max"
                          />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Categories */}
              <TabsContent value="categories" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieIcon className="h-5 w-5 text-secondary" />
                        Répartition (top 5 colonnes)
                      </CardTitle>
                      <CardDescription>Basée sur le nombre de valeurs uniques.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={320}>
                        <RechartsPieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={105}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-accent" />
                        Cardinalité (toutes)
                      </CardTitle>
                      <CardDescription>Comparaison des valeurs uniques.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={categoryData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" className="text-xs" />
                          <YAxis dataKey="name" type="category" className="text-xs" width={110} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Bar
                            dataKey="uniqueValues"
                            fill="hsl(262, 83%, 58%)"
                            radius={[0, 4, 4, 0]}
                            name="Valeurs uniques"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Missing */}
              <TabsContent value="missing" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineIcon className="h-5 w-5 text-warning" />
                      Analyse des valeurs manquantes
                    </CardTitle>
                    <CardDescription>Colonnes avec données manquantes.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {missingData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Badge className="bg-emerald-600 text-white mb-2">Parfait!</Badge>
                          <p>Aucune valeur manquante dans le dataset</p>
                        </div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={missingData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          <Bar dataKey="valid" stackId="a" fill="hsl(142, 76%, 36%)" name="Valides" />
                          <Bar dataKey="nulls" stackId="a" fill="hsl(38, 92%, 50%)" name="Manquantes" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {missingData.map((col) => (
                    <Card key={col.name} className="border-l-4 border-l-amber-500">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{col.name}</span>
                          <Badge variant="outline" className="text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800">
                            {col.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, col.percentage))}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {col.nulls} valeurs manquantes sur {uiDataset.rowCount}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Correlation placeholder */}
              <TabsContent value="correlation" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Grid3X3 className="h-5 w-5 text-primary" />
                      Matrice de corrélation
                    </CardTitle>
                    <CardDescription>
                      Nécessite des données brutes (ou un endpoint backend) pour calculer la corrélation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80 bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl flex items-center justify-center border-2 border-dashed border-border">
                      <div className="text-center space-y-3">
                        <div className="w-16 h-16 mx-auto rounded-xl bg-primary/10 flex items-center justify-center">
                          <Grid3X3 className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Heatmap de corrélation</p>
                          <p className="text-sm text-muted-foreground">
                            Sélectionnez au moins 2 colonnes (actuel: {selectedColumns.length})
                          </p>
                        </div>
                        <Button disabled={selectedColumns.length < 2}>
                          Générer la matrice
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Column Details (original) */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Détails des colonnes</CardTitle>
                <CardDescription>Informations statistiques pour chaque variable</CardDescription>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une colonne..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all">Toutes ({uiDataset.columns.length})</TabsTrigger>
                <TabsTrigger value="numeric">Numériques ({numericColumns.length})</TabsTrigger>
                <TabsTrigger value="categorical">Catégorielles ({categoricalColumns.length})</TabsTrigger>
              </TabsList>

              {/* ALL */}
              <TabsContent value="all" className="space-y-0">
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 p-3 bg-muted/50 border-b text-sm font-medium">
                    <button
                      type="button"
                      className="col-span-3 flex items-center gap-1 hover:text-primary transition-colors text-left"
                      onClick={() => toggleSort("name")}
                    >
                      Colonne <ArrowUpDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="col-span-2 flex items-center gap-1 hover:text-primary transition-colors text-left"
                      onClick={() => toggleSort("type")}
                    >
                      Type <ArrowUpDown className="h-3 w-3" />
                    </button>
                    <div className="col-span-2">Unique</div>
                    <button
                      type="button"
                      className="col-span-2 flex items-center gap-1 hover:text-primary transition-colors text-left"
                      onClick={() => toggleSort("nulls")}
                    >
                      Nulls <ArrowUpDown className="h-3 w-3" />
                    </button>
                    <div className="col-span-2">Qualité</div>
                    <div className="col-span-1">Exemples</div>
                  </div>

                  <div className="divide-y">
                    {filteredColumns.map((col) => (
                      <div
                        key={col.name}
                        className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-muted/30 transition-colors"
                      >
                        <div className="col-span-3 flex items-center gap-2 min-w-0">
                          {getTypeIcon(toUiType(col.type))}
                          <span className="font-medium truncate">{col.name}</span>
                        </div>

                        <div className="col-span-2">
                          <Badge variant="outline">{prettyType(col.type)}</Badge>
                        </div>

                        <div className="col-span-2 text-muted-foreground">
                          {col.uniqueCount === null ? "—" : `${col.uniqueCount} valeurs`}
                        </div>

                        <div className="col-span-2">
                          {col.nullCount > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {col.nullCount}
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />0
                            </span>
                          )}
                        </div>

                        <div className="col-span-2">
                          {getQualityBadge(col.nullCount, uiDataset.rowCount)}
                        </div>

                        <div className="col-span-1">
                          <span className="text-xs text-muted-foreground truncate block">
                            {col.type === "numeric"
                              ? `min ${formatNum(col.stats?.min)}, max ${formatNum(col.stats?.max)}`
                              : col.sampleValues.length
                              ? `${col.sampleValues.slice(0, 2).join(", ")}…`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* NUMERIC */}
              <TabsContent value="numeric" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {numericColumns
                    .filter((col) => col.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
                    .map((col) => (
                      <Card key={col.name} className="border-l-4 border-l-primary">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-primary" />
                              <span className="font-medium">{col.name}</span>
                            </div>
                            {getQualityBadge(col.nullCount, uiDataset.rowCount)}
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">Min</p>
                              <p className="font-semibold text-sm">{formatNum(col.stats?.min)}</p>
                            </div>
                            <div className="p-2 rounded bg-primary/10">
                              <p className="text-xs text-muted-foreground">Moy</p>
                              <p className="font-semibold text-sm">{formatNum(col.stats?.mean)}</p>
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">Max</p>
                              <p className="font-semibold text-sm">{formatNum(col.stats?.max)}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{col.uniqueCount === null ? "— uniques" : `${col.uniqueCount} uniques`}</span>
                            <span>{col.nullCount} nulls</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </TabsContent>

              {/* CATEGORICAL */}
              <TabsContent value="categorical" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoricalColumns
                    .filter((col) => col.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
                    .map((col) => {
                      const cardinalityPct =
                        uiDataset.rowCount && col.uniqueCount != null
                          ? (col.uniqueCount / uiDataset.rowCount) * 100
                          : 0;

                      return (
                        <Card key={col.name} className="border-l-4 border-l-secondary">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Type className="h-4 w-4 text-secondary" />
                                <span className="font-medium">{col.name}</span>
                              </div>
                              {getQualityBadge(col.nullCount, uiDataset.rowCount)}
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Valeurs uniques</span>
                                <Badge variant="secondary">{col.uniqueCount ?? "—"}</Badge>
                              </div>

                              <div className="flex flex-wrap gap-1">
                                {col.sampleValues.slice(0, 4).map((val, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {val}
                                  </Badge>
                                ))}
                                {!col.sampleValues.length && (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                              <span>Cardinalité: {cardinalityPct.toFixed(1)}%</span>
                              <span>{col.nullCount} nulls</span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Info className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Explorez davantage vos données</p>
                  <p className="text-sm text-muted-foreground">
                    Visualisez les graphiques ou commencez le prétraitement
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link to={`/projects/${id}/database`}>
                    Voir database
                  </Link>
                </Button>
                <Button asChild className="bg-gradient-to-r from-primary to-secondary">
                  <Link to={`/projects/${projectId}/processing`}>
                    Prétraitement
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default DataDescriptionPage;
