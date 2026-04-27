import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GitBranch,
  Search,
  Trash2,
  Target,
  Calendar,
  FileText,
  Layers,
  Pencil,
  Check,
  X,
  HardDrive,
} from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import datasetService, { DatasetOut as DatasetListItem } from "@/services/datasetService";
import dataService, { VersionUI } from "@/services/dataService";
import { staggerContainer, staggerItem } from "@/components/ui/page-transition";

// ── Label maps ────────────────────────────────────────────────────────────────

const OP_LABELS: Record<string, string> = {
  drop_columns: "Suppression colonnes",
  rename_columns: "Renommage colonnes",
  drop_duplicates: "Doublons supprimés",
  fill_missing: "Valeurs manquantes",
  standard_scaling: "Normalisation std",
  minmax_scaling: "Normalisation minmax",
  robust_scaling: "Normalisation robuste",
  label_encoding: "Encodage labels",
  onehot_encoding: "One-hot encoding",
  drop_outliers: "Outliers supprimés",
  clip_outliers: "Outliers clipés",
  set_target: "Cible définie",
};

function opLabel(op: string): string {
  return OP_LABELS[op] ?? op.replace(/_/g, " ");
}

// ── Size formatter ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDateFR(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}

// ── Inline rename input ───────────────────────────────────────────────────────

interface InlineRenameProps {
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

function InlineRename({ initialValue, onConfirm, onCancel }: InlineRenameProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const confirm = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue) onConfirm(trimmed);
    else onCancel();
  };

  return (
    <div className="flex items-center gap-1 min-w-0 flex-1">
      <input
        ref={inputRef}
        className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirm();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={confirm}
      />
      <button
        className="shrink-0 rounded p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
        onMouseDown={(e) => { e.preventDefault(); confirm(); }}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
        onMouseDown={(e) => { e.preventDefault(); onCancel(); }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function VersionsPage() {
  const { id } = useParams();
  const projectId = id!;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [versions, setVersions] = useState<VersionUI[]>([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "predictable">("all");
  const [datasetFilter, setDatasetFilter] = useState<string>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [deleteVersion, setDeleteVersion] = useState<VersionUI | null>(null);
  const [renamingVersionId, setRenamingVersionId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    Promise.all([datasetService.list(projectId), dataService.getVersions(projectId)])
      .then(([ds, vs]) => {
        if (!mounted) return;
        setDatasets(ds ?? []);
        setVersions(vs ?? []);
      })
      .catch((e) => toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" }))
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleDelete = async () => {
    if (!deleteVersion) return;
    try {
      await dataService.deleteVersion(projectId, deleteVersion.id);
      setVersions((prev) => prev.filter((v) => v.id !== deleteVersion.id));
      toast({ title: "Version supprimée" });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeleteVersion(null);
    }
  };

  const handleRename = async (versionId: number, newName: string) => {
    const isDuplicate = versions.some(
      (v) => v.id !== versionId && v.name.trim().toLowerCase() === newName.trim().toLowerCase(),
    );
    if (isDuplicate) {
      toast({
        title: "Nom déjà utilisé",
        description: `Une version nommée "${newName}" existe déjà dans ce projet.`,
        variant: "destructive",
      });
      return;
    }
    const previous = versions.find((v) => v.id === versionId)?.name;
    setVersions((prev) =>
      prev.map((v) => (v.id === versionId ? { ...v, name: newName } : v)),
    );
    setRenamingVersionId(null);
    try {
      await dataService.renameVersion(projectId, versionId, newName);
    } catch (e) {
      // rollback
      setVersions((prev) =>
        prev.map((v) => (v.id === versionId ? { ...v, name: previous ?? v.name } : v)),
      );
      toast({ title: "Erreur", description: "Impossible de renommer la version.", variant: "destructive" });
    }
  };

  const filteredVersions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (versions ?? [])
      .filter((v) => (filter === "predictable" ? Boolean(v.canPredict) : true))
      .filter((v) => (q ? String(v.name ?? "").toLowerCase().includes(q) : true))
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }, [versions, search, filter]);

  const versionsByDataset = useMemo(() => {
    const map = new Map<number, VersionUI[]>();
    const unknown: VersionUI[] = [];
    for (const v of filteredVersions) {
      if (!v.sourceDatasetId) { unknown.push(v); continue; }
      const arr = map.get(v.sourceDatasetId) ?? [];
      arr.push(v);
      map.set(v.sourceDatasetId, arr);
    }
    return { map, unknown };
  }, [filteredVersions]);

  const visibleCount = useMemo(() => {
    if (datasetFilter === "all") return filteredVersions.length;
    const did = Number(datasetFilter);
    if (!Number.isFinite(did)) return filteredVersions.length;
    return (versionsByDataset.map.get(did) ?? []).length;
  }, [datasetFilter, filteredVersions.length, versionsByDataset.map]);

  // ── Version card ─────────────────────────────────────────────────────────────

  const renderVersionCard = (v: VersionUI, index: number) => {
    const canPredict = Boolean(v.canPredict);
    const isRenaming = renamingVersionId === v.id;
    const sizeLabel = formatBytes(v.sizeBytes);

    return (
      <motion.div
        key={v.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, type: "spring", stiffness: 260, damping: 20 }}
      >
        <Card className="card-hover h-full">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="flex min-w-0 flex-1 items-center gap-2 text-base">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                {isRenaming ? (
                  <InlineRename
                    initialValue={v.name}
                    onConfirm={(name) => handleRename(v.id, name)}
                    onCancel={() => setRenamingVersionId(null)}
                  />
                ) : (
                  <span className="truncate">{v.name}</span>
                )}
              </CardTitle>

              <div className="flex shrink-0 items-center gap-1">
                {canPredict && (
                  <Badge className="bg-success text-success-foreground text-[10px]">Prêt</Badge>
                )}
                {!isRenaming && (
                  <button
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => setRenamingVersionId(v.id)}
                    title="Renommer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateFR(v.createdAt)}
              </span>
              {sizeLabel && (
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5" />
                  {sizeLabel}
                </span>
              )}
              {v.targetColumn && (
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  {v.targetColumn}
                </span>
              )}
            </div>

            {/* Operations */}
            {v.operations.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {v.operations.slice(0, 4).map((op, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {opLabel(op)}
                  </Badge>
                ))}
                {v.operations.length > 4 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{v.operations.length - 4}
                  </Badge>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 bg-gradient-to-r from-primary to-secondary"
                onClick={() => navigate(`/projects/${projectId}/nettoyage?version=${v.id}`)}
              >
                <Target className="mr-1 h-3.5 w-3.5" />
                Prétraiter
              </Button>

              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                disabled={!canPredict}
                title={canPredict ? undefined : "Définis une target pour pouvoir entraîner"}
                onClick={() => navigate(`/projects/${projectId}/versions/${v.id}/training`)}
              >
                <GitBranch className="mr-1 h-3.5 w-3.5" />
                Entraîner
              </Button>

              <Button variant="ghost" size="icon" onClick={() => setDeleteVersion(v)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // ── Dataset section ───────────────────────────────────────────────────────────

  const renderDatasetSection = (ds: DatasetListItem) => {
    if (datasetFilter !== "all" && datasetFilter !== String(ds.id)) return null;
    const list = versionsByDataset.map.get(ds.id) ?? [];

    return (
      <div key={ds.id} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{ds.original_name}</h2>
            <p className="text-xs text-muted-foreground">Dataset importé #{ds.id}</p>
          </div>
          <Badge variant="secondary">
            <GitBranch className="mr-1 h-3 w-3" />
            {list.length} version{list.length > 1 ? "s" : ""}
          </Badge>
        </div>

        {list.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucune version sauvegardée pour ce dataset.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map((v, idx) => renderVersionCard(v, idx))}
          </div>
        )}
      </div>
    );
  };

  const unknown = versionsByDataset.unknown;
  const showUnknown = datasetFilter === "all" && unknown.length > 0;

  return (
    <AppLayout>
      <motion.div className="space-y-6" initial="initial" animate="animate" variants={staggerContainer}>

        {/* Header */}
        <motion.div variants={staggerItem} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Historique des versions</h1>
            <p className="mt-1 text-muted-foreground">
              Versions prétraitées groupées par dataset source.
            </p>
          </div>
          <Badge variant="secondary" className="self-start md:self-auto">
            <GitBranch className="mr-1 h-3 w-3" />
            {visibleCount} version{visibleCount > 1 ? "s" : ""}
          </Badge>
        </motion.div>

        {/* Compact filters bar */}
        <motion.div variants={staggerItem}>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher une version..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                disabled={isLoading}
              />
            </div>

            {/* Dataset filter */}
            <Select value={datasetFilter} onValueChange={setDatasetFilter} disabled={isLoading || datasets.length === 0}>
              <SelectTrigger className="w-52">
                <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Tous les datasets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les datasets</SelectItem>
                {datasets.map((ds) => (
                  <SelectItem key={ds.id} value={String(ds.id)}>
                    {ds.original_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={filter} onValueChange={(v) => setFilter(v as "all" | "predictable")} disabled={isLoading}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les versions</SelectItem>
                <SelectItem value="predictable">Prêtes à prédire</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div variants={staggerItem} className="space-y-8">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Chargement...
              </CardContent>
            </Card>
          ) : datasets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Aucun dataset importé pour ce projet.
              </CardContent>
            </Card>
          ) : (
            <>
              {datasets.map((ds) => renderDatasetSection(ds))}

              {showUnknown && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold">Versions sans dataset source</h2>
                      <p className="text-xs text-muted-foreground">
                        Non rattachées à un dataset importé.
                      </p>
                    </div>
                    <Badge variant="secondary">
                      <GitBranch className="mr-1 h-3 w-3" />
                      {unknown.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {unknown.map((v, idx) => renderVersionCard(v, idx))}
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>

      <ConfirmModal
        isOpen={!!deleteVersion}
        onClose={() => setDeleteVersion(null)}
        onConfirm={handleDelete}
        title="Supprimer la version"
        description={`Êtes-vous sûr de vouloir supprimer "${deleteVersion?.name}" ?`}
        variant="destructive"
        confirmText="Supprimer"
      />
    </AppLayout>
  );
}

export default VersionsPage;
