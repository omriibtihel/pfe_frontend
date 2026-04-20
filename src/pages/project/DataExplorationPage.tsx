import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  CheckCircle,
  Database,
  FileText,
  Layers,
  RefreshCcw,
  Search,
  ShieldCheck,
  TableProperties,
  Target,
} from 'lucide-react';

import { AppLayout } from '@/layouts/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageSkeleton } from '@/components/ui/loading-skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useDataExploration } from '@/hooks/useDataExploration';
import DataTable from '@/components/ui/data-table';
import CorrelationHeatmap from '@/components/ui/CorrelationHeatmap';
import databaseService from '@/services/databaseService';
import type { CorrelationOut, AnalyticsOverview, AnalyticsProfile } from '@/services/databaseService';
import dataService, { type VersionUI } from '@/services/dataService';
import { ReportExportModal } from '@/components/report/ReportExportModal';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import type { ColKind, ColProfile } from './dataExploration/types';
import { fmt, pctLabel, KIND_COLORS, kindLabel } from './dataExploration/types';
import { KindIcon } from './dataExploration/KindIcon';
import { QualityBadge } from './dataExploration/QualityBadge';
import { ColumnDetailPanel } from './dataExploration/ColumnDetailPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function DataExplorationPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = id!;
  const { toast } = useToast();

  const {
    datasets,
    activeDatasetId,
    overview,
    profile,
    targetColumn,
    isLoading,
    isRefreshing,
    reload,
    changeActiveDataset,
    setTargetColumn,
    refreshPreview,
  } = useDataExploration(projectId);

  // ── Version source state ─────────────────────────────────────────────────────
  const [sourceType, setSourceType] = useState<'dataset' | 'version'>('dataset');
  const [versions, setVersions] = useState<VersionUI[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const [versionOverview, setVersionOverview] = useState<AnalyticsOverview | null>(null);
  const [versionProfile, setVersionProfile] = useState<AnalyticsProfile | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);

  // Load versions list once
  useEffect(() => {
    void dataService.getVersions(projectId).then((list) => {
      setVersions(list);
      setActiveVersionId((prev) => prev ?? list[0]?.id ?? null);
    });
  }, [projectId]);

  const loadVersionAnalytics = useCallback(
    async (vId: number, rows = 20, tk = 5) => {
      setVersionLoading(true);
      try {
        const [o, p] = await Promise.all([
          databaseService.getVersionOverview(projectId, vId, rows),
          databaseService.getVersionProfile(projectId, vId, tk),
        ]);
        setVersionOverview(o);
        setVersionProfile(p);
      } catch (err) {
        toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
      } finally {
        setVersionLoading(false);
      }
    },
    [projectId, toast],
  );

  // When version source is active and version selection changes, load analytics
  useEffect(() => {
    if (sourceType !== 'version' || !activeVersionId) return;
    void loadVersionAnalytics(activeVersionId);
  }, [projectId, sourceType, activeVersionId, loadVersionAnalytics]);

  // Derived: use version or dataset analytics
  const activeOverview = sourceType === 'version' ? versionOverview : overview;
  const activeProfile = sourceType === 'version' ? versionProfile : profile;

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('apercu');
  const [rowsPreview, setRowsPreview] = useState(20);
  const [topK, setTopK] = useState(5);

  // Column list filters
  const [colSearch, setColSearch] = useState('');
  const [colKindFilter, setColKindFilter] = useState<'all' | ColKind | 'missing'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'nulls'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Column detail panel
  const [selectedCol, setSelectedCol] = useState<ColProfile | null>(null);

  // Target modal
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [tempTarget, setTempTarget] = useState('');

  // Report export
  const [showReport, setShowReport] = useState(false);
  const [correlationData, setCorrelationData] = useState<CorrelationOut | null>(null);

  // ── Derived data ────────────────────────────────────────────────────────────

  const colProfiles: ColProfile[] = useMemo(() => {
    if (!activeProfile) return [];
    return activeProfile.profiles.map((p) => ({
      name: p.name,
      kind: p.kind,
      dtype: p.dtype,
      missing: p.missing,
      missingPct: p.missing_pct,
      unique: p.unique,
      uniquePct: p.unique_pct,
      numeric: p.numeric ?? null,
      topValues: p.categorical?.top_values ?? [],
    }));
  }, [activeProfile]);

  const totalRows = activeOverview?.shape?.rows ?? 0;
  const totalCols = activeOverview?.shape?.cols ?? 0;

  const numericCount = useMemo(
    () => colProfiles.filter((c) => c.kind === 'numeric').length,
    [colProfiles],
  );
  const categoricalCount = useMemo(
    () => colProfiles.filter((c) => c.kind === 'categorical' || c.kind === 'text').length,
    [colProfiles],
  );

  const totalNulls = useMemo(
    () => colProfiles.reduce((acc, c) => acc + c.missing, 0),
    [colProfiles],
  );

  const completeness = useMemo(() => {
    const cells = totalRows * totalCols;
    if (!cells) return 100;
    return Math.round(Math.max(0, (1 - totalNulls / cells) * 100));
  }, [totalRows, totalCols, totalNulls]);

  const filteredCols = useMemo(() => {
    const q = colSearch.trim().toLowerCase();
    return colProfiles
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .filter((c) => {
        if (colKindFilter === 'all') return true;
        if (colKindFilter === 'missing') return c.missing > 0;
        return c.kind === colKindFilter;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
        else if (sortBy === 'type') cmp = a.kind.localeCompare(b.kind);
        else if (sortBy === 'nulls') cmp = a.missing - b.missing;
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [colProfiles, colSearch, sortBy, sortDir]);

  const missingCols = useMemo(
    () =>
      colProfiles
        .filter((c) => c.missing > 0)
        .sort((a, b) => b.missing - a.missing)
        .slice(0, 20),
    [colProfiles],
  );

  const typeDistData = useMemo(
    () =>
      Object.entries(
        colProfiles.reduce(
          (acc, c) => {
            acc[c.kind] = (acc[c.kind] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      ).map(([kind, count]) => ({
        name: kindLabel(kind as ColKind),
        count,
        fill: KIND_COLORS[kind as ColKind] ?? KIND_COLORS.unknown,
      })),
    [colProfiles],
  );

  const outlierCols = useMemo(() => {
    const names = new Set<string>();
    for (const c of colProfiles) {
      if (c.kind !== 'numeric' || !c.numeric) continue;
      const { p25, p75, min, max } = c.numeric;
      if (p25 == null || p75 == null || min == null || max == null) continue;
      const iqr = p75 - p25;
      if (iqr === 0) continue;
      if (max - p75 > 3 * iqr || p25 - min > 3 * iqr) names.add(c.name);
    }
    return names;
  }, [colProfiles]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const toggleSort = (col: 'name' | 'type' | 'nulls') => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const handleOpenTargetModal = (prefill?: string) => {
    setTempTarget(prefill ?? targetColumn ?? '');
    setShowTargetModal(true);
  };

  const handleRefresh = useCallback(() => {
    if (sourceType === 'version' && activeVersionId) {
      void loadVersionAnalytics(activeVersionId);
    } else {
      void reload();
    }
  }, [sourceType, activeVersionId, loadVersionAnalytics, reload]);

  const handleConfirmTarget = async () => {
    if (!activeDatasetId) return;
    try {
      const value = tempTarget.trim() || null;
      const res = await databaseService.setDatasetTarget(projectId, activeDatasetId, value);
      setTargetColumn(res.target_column ?? null);
      setShowTargetModal(false);
      toast({
        title: 'Variable cible mise à jour',
        description: res.target_column ? `Cible : ${res.target_column}` : 'Cible supprimée',
      });
    } catch (err) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!datasets.length && (sourceType !== 'version' || !versions.length)) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Database className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Aucun dataset disponible</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Importez un fichier CSV ou Excel pour commencer l'exploration.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  const activeDataset = datasets.find((d) => d.id === activeDatasetId);

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60">
                <TableProperties className="h-5 w-5 text-white" />
              </div>
              Exploration des données
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Analysez, comprenez et préparez votre dataset.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {/* Source toggle */}
            <div className="flex rounded-lg border overflow-hidden text-sm">
              <button
                className={`px-3 py-1.5 transition ${sourceType === 'dataset' ? 'bg-white dark:bg-slate-900 font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}
                onClick={() => setSourceType('dataset')}
              >
                Dataset
              </button>
              <button
                className={`px-3 py-1.5 border-l transition ${sourceType === 'version' ? 'bg-white dark:bg-slate-900 font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}
                onClick={() => setSourceType('version')}
              >
                Version
              </button>
            </div>

            {/* Dataset / Version selector */}
            {sourceType === 'version' ? (
              <Select
                value={String(activeVersionId ?? '')}
                onValueChange={(v) => setActiveVersionId(Number(v))}
              >
                <SelectTrigger className="w-64">
                  <Layers className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                  <SelectValue placeholder="Choisir une version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={String(activeDatasetId ?? '')}
                onValueChange={(v) => void changeActiveDataset(Number(v))}
              >
                <SelectTrigger className="w-64">
                  <Layers className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                  <SelectValue placeholder="Choisir un dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.original_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || versionLoading}
            >
              <RefreshCcw className={`h-4 w-4 mr-1.5 ${(isRefreshing || versionLoading) ? 'animate-spin' : ''}`} />
              Rafraîchir
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReport(true)}
              disabled={!activeOverview || !activeProfile || sourceType === 'version'}
            >
              <FileText className="h-4 w-4 mr-1.5" />
              Rapport PDF
            </Button>
          </div>
        </div>

        {/* ── Summary cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Lignes</p>
              <p className="text-3xl font-bold text-primary mt-1">{totalRows.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{totalCols} colonnes</p>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Numériques</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {numericCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {categoricalCount} catégorielles
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Complétude</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {completeness}%
              </p>
              <Progress value={completeness} className="h-1.5 mt-2" />
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Valeurs nulles</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {totalNulls.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {pctLabel(totalNulls, totalRows * totalCols)} des cellules
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Target column banner ─────────────────────────────────────────── */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-3 px-5">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Variable cible</p>
                <p className="text-xs text-muted-foreground">Colonne à prédire par les modèles</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold">
                {targetColumn ?? '—'}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => handleOpenTargetModal()}>
                Changer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="apercu" className="flex items-center gap-1.5">
              <Database className="h-4 w-4" />
              Aperçu
            </TabsTrigger>
            <TabsTrigger value="colonnes" className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              Colonnes
            </TabsTrigger>
            <TabsTrigger value="analyse" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Analyse
            </TabsTrigger>
          </TabsList>

          {/* ════════ Tab 1 : Aperçu ════════ */}
          <TabsContent value="apercu" className="space-y-4">

            {/* Preview controls */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Aperçu tabulaire
                    {activeDataset && (
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        — {activeDataset.original_name}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span>Lignes :</span>
                      <Input
                        type="number"
                        min={1}
                        max={200}
                        value={rowsPreview}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v)) setRowsPreview(Math.min(200, Math.max(1, v)));
                        }}
                        className="w-20 h-8 text-sm"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (sourceType === 'version' && activeVersionId) {
                          void loadVersionAnalytics(activeVersionId, rowsPreview, topK);
                        } else {
                          void refreshPreview(rowsPreview, topK);
                        }
                      }}
                      disabled={isRefreshing || versionLoading}
                    >
                      Appliquer
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!activeOverview?.preview?.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Aucune donnée à afficher.
                  </p>
                ) : (
                  <DataTable
                    data={activeOverview.preview}
                    pageSize={10}
                    columns={Object.keys(activeOverview.preview[0]).map((key) => ({
                      key,
                      header: (
                        <span className="flex items-center gap-1.5">
                          {key}
                          {targetColumn === key && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                              Target
                            </Badge>
                          )}
                        </span>
                      ),
                      onHeaderClick: () => {
                        const col = colProfiles.find((c) => c.name === key);
                        if (col) {
                          setSelectedCol(col);
                          setActiveTab('colonnes');
                        }
                      },
                      className: targetColumn === key ? 'bg-primary/8 font-medium' : '',
                    }))}
                  />
                )}
              </CardContent>
            </Card>

            {/* Dataset metadata */}
            {activeDataset && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Métadonnées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Fichier</dt>
                      <dd className="font-medium truncate" title={activeDataset.original_name}>
                        {activeDataset.original_name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Taille</dt>
                      <dd className="font-medium">
                        {activeDataset.size_bytes
                          ? `${(activeDataset.size_bytes / 1024).toFixed(1)} Ko`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Type</dt>
                      <dd className="font-medium">{activeDataset.content_type ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Importé le</dt>
                      <dd className="font-medium">
                        {new Date(activeDataset.created_at).toLocaleDateString('fr-FR')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Dimensions</dt>
                      <dd className="font-medium">
                        {totalRows} × {totalCols}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Colonne cible</dt>
                      <dd className="font-medium">{targetColumn ?? '—'}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ════════ Tab 2 : Colonnes ════════ */}
          <TabsContent value="colonnes" className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">

              {/* Column list */}
              <div className={`flex-1 min-w-0 transition-all ${selectedCol ? 'lg:max-w-[55%]' : ''}`}>
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" />
                        {filteredCols.length} / {totalCols} colonnes
                      </CardTitle>
                      <div className="relative w-56">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Rechercher…"
                          value={colSearch}
                          onChange={(e) => setColSearch(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>
                    {/* Kind filter buttons */}
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {(
                        [
                          { key: 'all', label: 'Tout' },
                          { key: 'numeric', label: 'Numérique' },
                          { key: 'categorical', label: 'Catégorielle' },
                          { key: 'missing', label: 'Avec nulls' },
                        ] as { key: 'all' | ColKind | 'missing'; label: string }[]
                      ).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setColKindFilter(key)}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors border ${
                            colKindFilter === key
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_100px_80px_80px] gap-2 px-4 py-2 bg-muted/50 border-y border-border/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <button
                        className="flex items-center gap-1 text-left"
                        onClick={() => toggleSort('name')}
                      >
                        Colonne
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                      <button
                        className="flex items-center gap-1"
                        onClick={() => toggleSort('type')}
                      >
                        Type
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                      <button
                        className="flex items-center gap-1"
                        onClick={() => toggleSort('nulls')}
                      >
                        Nulls
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                      <span>Qualité</span>
                    </div>

                    {/* Rows */}
                    <div className="max-h-[520px] overflow-y-auto">
                      {filteredCols.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          Aucune colonne trouvée.
                        </p>
                      ) : (
                        filteredCols.map((col) => {
                          const isSelected = selectedCol?.name === col.name;
                          const isTarget = targetColumn === col.name;
                          const missingPct = totalRows
                            ? ((col.missing / totalRows) * 100).toFixed(1)
                            : '0';

                          return (
                            <button
                              key={col.name}
                              className={`w-full grid grid-cols-[1fr_100px_80px_80px] gap-2 items-center px-4 py-2.5 border-b border-border/40 text-left text-sm transition-colors hover:bg-muted/40 ${
                                isSelected ? 'bg-primary/8 border-l-2 border-l-primary' : ''
                              }`}
                              onClick={() => setSelectedCol(isSelected ? null : col)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <KindIcon kind={col.kind} />
                                <span className="truncate font-medium" title={col.name}>
                                  {col.name}
                                </span>
                                {outlierCols.has(col.name) && (
                                  <span title="Outliers possibles (IQR×3)" className="flex-shrink-0">
                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground truncate">
                                {col.dtype}
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  col.missing > 0
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {col.missing > 0 ? `${missingPct}%` : '—'}
                              </span>
                              <QualityBadge missing={col.missing} total={totalRows} />
                            </button>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Column detail panel */}
              {selectedCol && (
                <div className="w-full lg:w-[45%] flex-shrink-0">
                  <Card className="h-full">
                    <CardContent className="pt-5">
                      <ColumnDetailPanel
                        col={selectedCol}
                        totalRows={totalRows}
                        isTarget={targetColumn === selectedCol.name}
                        onSetTarget={() => handleOpenTargetModal(selectedCol.name)}
                        onClose={() => setSelectedCol(null)}
                        projectId={projectId}
                        datasetId={activeDatasetId ?? 0}
                        versionId={sourceType === 'version' ? activeVersionId : null}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ════════ Tab 3 : Analyse ════════ */}
          <TabsContent value="analyse" className="space-y-6">

            {/* Type distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Distribution des types
                  </CardTitle>
                  <CardDescription>Répartition des colonnes par type</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={typeDistData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(v: number) => [`${v} colonne${v > 1 ? 's' : ''}`, 'Nombre']}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {typeDistData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Missing values chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Valeurs manquantes
                  </CardTitle>
                  <CardDescription>
                    {missingCols.length} colonne{missingCols.length !== 1 ? 's' : ''} avec des
                    valeurs nulles (sur {totalCols})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {missingCols.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                      <CheckCircle className="h-8 w-8 text-emerald-500" />
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        Aucune valeur manquante !
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-52 overflow-auto space-y-2.5">
                      {missingCols.map((col) => {
                        const pct = totalRows ? (col.missing / totalRows) * 100 : 0;
                        return (
                          <div key={col.name} className="flex items-center gap-2 text-sm">
                            <button
                              className="w-32 text-left truncate text-xs hover:text-primary transition-colors"
                              onClick={() => {
                                setSelectedCol(col);
                                setActiveTab('colonnes');
                              }}
                              title={col.name}
                            >
                              {col.name}
                            </button>
                            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, pct)}%`,
                                  background: `linear-gradient(90deg, hsl(38,92%,50%), hsl(0,72%,51%))`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-20 text-right flex-shrink-0">
                              {col.missing} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Numeric distributions overview */}
            {colProfiles.filter((c) => c.kind === 'numeric' && c.numeric).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    Statistiques numériques globales
                  </CardTitle>
                  <CardDescription>
                    Min / moyenne / max pour chaque colonne numérique
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-border/60">
                          {['Colonne', 'Min', 'P25', 'Médiane', 'Moyenne', 'P75', 'Max', 'Std'].map(
                            (h) => (
                              <th
                                key={h}
                                className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {colProfiles
                          .filter((c) => c.kind === 'numeric' && c.numeric)
                          .map((col) => (
                            <tr
                              key={col.name}
                              className="border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedCol(col);
                                setActiveTab('colonnes');
                              }}
                            >
                              <td className="px-3 py-2 font-medium">{col.name}</td>
                              <td className="px-3 py-2 text-muted-foreground">{fmt(col.numeric?.min)}</td>
                              <td className="px-3 py-2 text-muted-foreground">{fmt(col.numeric?.p25)}</td>
                              <td className="px-3 py-2 text-muted-foreground">{fmt(col.numeric?.p50)}</td>
                              <td className="px-3 py-2 font-medium">{fmt(col.numeric?.mean)}</td>
                              <td className="px-3 py-2 text-muted-foreground">{fmt(col.numeric?.p75)}</td>
                              <td className="px-3 py-2 text-muted-foreground">{fmt(col.numeric?.max)}</td>
                              <td className="px-3 py-2 text-muted-foreground">{fmt(col.numeric?.std)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Correlation heatmap */}
            <CorrelationHeatmap
              projectId={projectId}
              datasetId={sourceType === 'version' ? null : activeDatasetId}
              versionId={sourceType === 'version' ? activeVersionId : null}
              dtypes={activeOverview?.dtypes || {}}
              onDataReady={setCorrelationData}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Target modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        title="Variable cible"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sélectionnez la colonne que les modèles devront prédire.
          </p>
          <Select value={tempTarget} onValueChange={setTempTarget}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une colonne…" />
            </SelectTrigger>
            <SelectContent>
              {(activeOverview?.columns ?? []).map((col) => (
                <SelectItem key={col} value={col}>
                  {col}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Laissez vide pour supprimer la cible actuelle.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowTargetModal(false)}>
              Annuler
            </Button>
            <Button onClick={() => void handleConfirmTarget()}>Confirmer</Button>
          </div>
        </div>
      </Modal>

      {/* Report export modal */}
      {overview && profile && activeDataset && sourceType === 'dataset' && (
        <ReportExportModal
          open={showReport}
          onClose={() => setShowReport(false)}
          correlationData={correlationData}
          reportInput={{ dataset: activeDataset, overview, profile, targetColumn }}
        />
      )}
    </AppLayout>
  );
}
