import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { GitBranch, Search, Eye, Trash2, Target, Calendar, FileText, Info, Layers } from "lucide-react";

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

// helpers
function formatDateFR(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}

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

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const [ds, vs] = await Promise.all([datasetService.list(projectId), dataService.getVersions(projectId)]);
        if (!mounted) return;

        setDatasets(ds ?? []);
        setVersions(vs ?? []);
      } catch (e) {
        toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
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

  const filteredVersions = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (versions ?? [])
      .filter((v) => (filter === "predictable" ? Boolean(v.canPredict) : true))
      .filter((v) => {
        if (!q) return true;
        return String(v.name ?? "").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const da = new Date(a.createdAt ?? 0).getTime();
        const db = new Date(b.createdAt ?? 0).getTime();
        return db - da;
      });
  }, [versions, search, filter]);

  const versionsByDataset = useMemo(() => {
    const map = new Map<number, VersionUI[]>();
    const unknown: VersionUI[] = [];

    for (const v of filteredVersions) {
      if (!v.sourceDatasetId) {
        unknown.push(v);
        continue;
      }
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

  const renderVersionCard = (v: VersionUI, index: number) => {
    const canPredict = Boolean(v.canPredict);

    return (
      <motion.div
        key={v.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, type: "spring", stiffness: 260, damping: 20 }}
      >
        <Card className="card-hover h-full">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2 min-w-0">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">{v.name}</span>
              </CardTitle>
              {canPredict && <Badge className="bg-success text-success-foreground">Prêt</Badge>}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {formatDateFR(v.createdAt)}
            </div>

            {v.operations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Opérations :</p>
                <div className="flex flex-wrap gap-1">
                  {v.operations.slice(0, 3).map((op, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {op}
                    </Badge>
                  ))}
                  {v.operations.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{v.operations.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  // Choisis UNE de ces options selon ton routing :
                  // 1) page de détail
                  // navigate(`/projects/${projectId}/versions/${v.id}`);
                  // 2) ouvrir dans processing (si tu supportes ?version=)
                  navigate(`/projects/${projectId}/processing?version=${v.id}`);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                Voir
              </Button>

              {canPredict && (
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-primary to-secondary"
                  onClick={() => navigate(`/projects/${projectId}/predict?version=${v.id}`)}
                >
                  <Target className="h-4 w-4 mr-1" />
                  Prédire
                </Button>
              )}

              <Button variant="ghost" size="icon" onClick={() => setDeleteVersion(v)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderDatasetSection = (ds: DatasetListItem) => {
    if (datasetFilter !== "all" && datasetFilter !== String(ds.id)) return null;

    const list = versionsByDataset.map.get(ds.id) ?? [];

    return (
      <div key={ds.id} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">{ds.original_name}</h2>
            <p className="text-xs text-muted-foreground">Dataset importé #{ds.id}</p>
          </div>
          <Badge variant="secondary">
            <GitBranch className="h-3 w-3 mr-1" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <motion.div variants={staggerItem} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Historique des versions</h1>
            <p className="text-muted-foreground mt-1">
              Les versions prétraitées sont stockées séparément des datasets importés, et reliées à leur dataset source.
            </p>
          </div>

          <Badge variant="secondary" className="self-start md:self-auto">
            <GitBranch className="h-3 w-3 mr-1" />
            {visibleCount} versions visibles
          </Badge>
        </motion.div>

        {/* Filters row */}
        <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Dataset (source)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={datasetFilter} onValueChange={setDatasetFilter} disabled={isLoading || datasets.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les datasets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les datasets</SelectItem>
                  {datasets.map((ds) => (
                    <SelectItem key={ds.id} value={String(ds.id)}>
                      {ds.original_name} (#{ds.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recherche & filtres</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une version..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>

              <Select value={filter} onValueChange={(v) => setFilter(v as any)} disabled={isLoading}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Filtrer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les versions</SelectItem>
                  <SelectItem value="predictable">Prêtes à prédire</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info Banner */}
        <motion.div variants={staggerItem}>
          <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
            <CardContent className="flex items-start gap-3 py-4">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Organisation</p>
                <p className="text-sm text-muted-foreground">
                  Un dataset importé peut avoir plusieurs versions prétraitées (dataset_versions) listées ici.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Content */}
        <motion.div variants={staggerItem} className="space-y-8">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">Chargement...</CardContent>
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
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold truncate">Autres versions (parent non détecté)</h2>
                      <p className="text-xs text-muted-foreground">
                        Ajoute `source_dataset_id` (ou équivalent) côté backend pour les relier proprement.
                      </p>
                    </div>
                    <Badge variant="secondary">
                      <GitBranch className="h-3 w-3 mr-1" />
                      {unknown.length}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
