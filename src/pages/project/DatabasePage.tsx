import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Database,
  Target,
  BarChart3,
  PieChart,
  Grid3X3,
  Download,
  Settings,
  RefreshCcw,
} from "lucide-react";

import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/loading-skeleton";
import { useToast } from "@/hooks/use-toast";

import datasetService, { DatasetOut as DatasetListItem } from "@/services/datasetService";
import databaseService, { DatasetOverviewOut, DatasetProfileOut } from "@/services/databaseService";

import CorrelationHeatmap from "@/components/ui/CorrelationHeatmap";
import DataTable from "@/components/ui/data-table";



// Si tu as déjà un endpoint correlation => crée une fonction dans databaseService
// Sinon on tente et on fallback
async function tryFetchCorrelation(
  projectId: string,
  datasetId: number,
  columns: string[]
): Promise<number[][] | null> {
  try {

    const qs = columns.map((c) => `columns=${encodeURIComponent(c)}`).join("&");
    const apiClient = (await import("@/services/apiClient")).default;
    const res = await apiClient.get<{ columns: string[]; matrix: number[][] }>(
      `/projects/${projectId}/datasets/${datasetId}/correlation?${qs}`
    );
    return res.matrix;
  } catch {
    return null;
  }
}

function formatNumber(v: unknown) {
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(4) : String(v);
  return String(v);
}

export default function DatabasePage() {
  const { id } = useParams();
  const projectId = id!;
  const { toast } = useToast();

  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(null);

  const [overview, setOverview] = useState<DatasetOverviewOut | null>(null);
  const [profile, setProfile] = useState<DatasetProfileOut | null>(null);

  const [targetColumn, setTargetColumn] = useState<string | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [tempTarget, setTempTarget] = useState<string>("");

  const [rowsPreview, setRowsPreview] = useState(10);
  const [topK, setTopK] = useState(5);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ---- Column profile modal (on header click) ----
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedColName, setSelectedColName] = useState<string | null>(null);

  // ---- Correlation ----
  const [corrCols, setCorrCols] = useState<string[]>([]);
  const [corrMatrix, setCorrMatrix] = useState<number[][] | null>(null);
  const [corrLoading, setCorrLoading] = useState(false);

  const loadAll = async (opts?: { forceDatasetId?: number | null }) => {
    setIsRefreshing(true);
    try {
      const ds = await datasetService.list(projectId);
      setDatasets(ds as any);

      const active = await databaseService.getActiveDataset(projectId);
      const chosen =
        opts?.forceDatasetId ??
        active.active_dataset_id ??
        (ds?.[0]?.id ?? null);

      setActiveDatasetId(chosen);

      if (!chosen) {
        setOverview(null);
        setProfile(null);
        setTargetColumn(null);
        return;
      }

      // ✅ load overview + profile + target FOR THIS DATASET
      const [o, p, t] = await Promise.all([
        databaseService.getOverview(projectId, chosen, rowsPreview),
        databaseService.getProfile(projectId, chosen, topK),
        // ✅ new endpoint: dataset target
        databaseService.getDatasetTarget(projectId, chosen),
      ]);

      setOverview(o);
      setProfile(p);
      setTargetColumn(t.target_column ?? null);
    } catch (e) {
      toast({
        title: "Erreur",
        description: (e as Error).message || "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

const onChangeActiveDataset = async (datasetId: number) => {
    try {
      // ✅ reset visuel immédiat pour éviter target précédente
      setActiveDatasetId(datasetId);
      setOverview(null);
      setProfile(null);
      setTargetColumn(null);

      await databaseService.setActiveDataset(projectId, datasetId);
      toast({ title: "Dataset actif mis à jour" });

      await loadAll({ forceDatasetId: datasetId });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
  };

  const onRefresh = async () => loadAll();

  const onOpenTargetModal = () => {
    setTempTarget(targetColumn ?? "");
    setShowTargetModal(true);
  };

const onConfirmTarget = async () => {
    try {
      if (!activeDatasetId) {
        toast({ title: "Erreur", description: "Aucun dataset actif", variant: "destructive" });
        return;
      }

      const value = tempTarget?.trim() ? tempTarget.trim() : null;

      // ✅ set target FOR THIS DATASET
      const res = await databaseService.setDatasetTarget(projectId, activeDatasetId, value);

      setTargetColumn(res.target_column ?? null);
      setShowTargetModal(false);

      toast({
        title: "Cible mise à jour",
        description: res.target_column ? `Nouvelle cible: ${res.target_column}` : "Cible supprimée",
      });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
  };


  const numericCols = useMemo(() => {
    if (!profile) return 0;
    return profile.profiles.filter((p) => p.kind === "numeric").length;
  }, [profile]);

  const categoricalCols = useMemo(() => {
    if (!profile) return 0;
    return profile.profiles.filter((p) => p.kind === "categorical" || p.kind === "text").length;
  }, [profile]);

  const totalNulls = useMemo(() => {
    if (!overview) return 0;
    return Object.values(overview.missing || {}).reduce((a, b) => a + (b || 0), 0);
  }, [overview]);

  // Missing: list ALL columns (sorted desc)
  const missingAll = useMemo(() => {
    if (!overview) return [];
    return Object.entries(overview.missing || {})
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [overview]);

  const selectedProfile = useMemo(() => {
    if (!profile || !selectedColName) return null;
    return profile.profiles.find((p) => p.name === selectedColName) ?? null;
  }, [profile, selectedColName]);

  // Correlation fetch
  const fetchCorrelation = async () => {
    if (!activeDatasetId || !corrCols.length) return;
    setCorrLoading(true);
    try {
      const m = await tryFetchCorrelation(projectId, activeDatasetId, corrCols);
      if (!m) {
        toast({
          title: "Correlation indisponible",
          description:
            "Ajoute un endpoint backend /correlation (ou vérifie son chemin).",
          variant: "destructive",
        });
        setCorrMatrix(null);
        return;
      }
      setCorrMatrix(m);
      toast({ title: "Matrice générée" });
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCorrLoading(false);
    }
  };

  if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;

  if (!datasets.length) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-3">
          <h1 className="text-2xl font-bold">Exploration des données</h1>
          <p className="text-muted-foreground">
            Aucun dataset n’est disponible pour ce projet. Importez un fichier pour continuer.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Exploration des données</h1>
            <p className="text-muted-foreground mt-1">Analysez et comprenez votre dataset</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="w-full sm:w-72">
              <Select
                value={String(activeDatasetId ?? "")}
                onValueChange={(v) => onChangeActiveDataset(Number(v))}
              >
                <SelectTrigger>
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
            </div>

            <Button variant="outline" onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Rafraîchir
            </Button>

            <Button variant="outline" disabled>
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
            <Button variant="outline" disabled>
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Lignes</p>
              <p className="text-3xl font-bold text-primary">{overview?.shape.rows ?? "—"}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Colonnes</p>
              <p className="text-3xl font-bold text-secondary">{overview?.shape.cols ?? "—"}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Numériques</p>
              <p className="text-3xl font-bold text-accent">{numericCols}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Valeurs nulles</p>
              <p className="text-3xl font-bold text-warning">{totalNulls}</p>
            </CardContent>
          </Card>
        </div>

        {/* Target Section */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Variable cible</p>
                <p className="text-sm text-muted-foreground">Colonne à prédire</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-lg px-4 py-1">
                {targetColumn ?? "—"}
              </Badge>
              <Button variant="outline" onClick={onOpenTargetModal}>
                Changer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview controls + table */}
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Aperçu du dataset
            </CardTitle>

            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="w-full md:w-56 space-y-1">
                <p className="text-sm text-muted-foreground">Nombre de lignes</p>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={rowsPreview}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isNaN(v)) return;
                    setRowsPreview(Math.min(200, Math.max(1, v)));
                  }}
                />
                <p className="text-xs text-muted-foreground">Entre 1 et 200.</p>
              </div>

              <div className="w-full md:w-56 space-y-1">
                <p className="text-sm text-muted-foreground">Top K</p>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={topK}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isNaN(v)) return;
                    setTopK(Math.min(20, Math.max(1, v)));
                  }}
                />
                <p className="text-xs text-muted-foreground">Pour le profil (1 à 20).</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!activeDatasetId) return;
                    try {
                      const [o, p] = await Promise.all([
                        databaseService.getOverview(projectId, activeDatasetId, rowsPreview),
                        databaseService.getProfile(projectId, activeDatasetId, topK),
                      ]);
                      setOverview(o);
                      setProfile(p);
                    } catch (e) {
                      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
                    }
                  }}
                  disabled={isRefreshing}
                >
                  Rafraîchir l’aperçu
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
          {!overview?.preview?.length ? (
            <div className="text-sm text-muted-foreground">Aucune donnée à afficher.</div>
          ) : (
            <DataTable
              data={overview.preview}
              pageSize={10}
              columns={Object.keys(overview.preview[0]).map((key) => ({
                key,
                header: (
                  <>
                    <span>{key}</span>
                    {targetColumn === key ? (
                      <Badge className="bg-primary text-primary-foreground">Target</Badge>
                    ) : null}
                  </>
                ),
                onHeaderClick: () => {
                  setSelectedColName(key);
                  setProfileOpen(true);
                },
                className: targetColumn === key ? "bg-primary/10 font-medium" : "",
              }))}
            />
          )}
          </CardContent>
        </Card>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-secondary" />
                Types de colonnes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center">
                <div className="flex gap-8">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-2xl font-bold text-primary-foreground">
                      {numericCols}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Numériques</p>
                  </div>
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-secondary to-secondary/60 flex items-center justify-center text-2xl font-bold text-secondary-foreground">
                      {categoricalCols}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Catégorielles / texte</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Missing ALL columns */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-accent" />
                Valeurs manquantes (toutes les colonnes)
              </CardTitle>
              <CardDescription>Trié par ordre décroissant</CardDescription>
            </CardHeader>
            <CardContent>
              {!overview ? (
                <div className="text-sm text-muted-foreground">Aucune donnée.</div>
              ) : (
                <div className="max-h-[320px] overflow-auto pr-2 space-y-3">
                  {missingAll.map((col) => {
                    const pct =
                      overview?.shape?.rows ? (col.count / overview.shape.rows) * 100 : 0;
                    return (
                      <div key={col.name} className="flex items-center gap-3">
                        <span className="w-32 text-sm truncate">{col.name}</span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-warning to-destructive rounded-full"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-14 text-right">
                          {col.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Correlation matrix */}
        <CorrelationHeatmap
          projectId={id!}
          datasetId={activeDatasetId}
          dtypes={overview?.dtypes || {}}
        />

      </div>

      {/* Target modal */}
      <Modal
        isOpen={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        title="Changer la variable cible"
        size="lg"

      >
        <div className="space-y-4">
          <Select value={tempTarget} onValueChange={setTempTarget}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une colonne" />
            </SelectTrigger>
            <SelectContent>
              {(overview?.columns || []).map((col) => (
                <SelectItem key={col} value={col}>
                  {col}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="text-xs text-muted-foreground">
            Si tu veux supprimer la cible, laisse vide et confirme.
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowTargetModal(false)}>
              Annuler
            </Button>
            <Button onClick={onConfirmTarget}>Confirmer</Button>
          </div>
        </div>
      </Modal>

      {/* Column profile modal */}
      <Modal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        title={`Profil de colonne${selectedColName ? ` — ${selectedColName}` : ""}`}
        size="lg"

      >
        {!selectedProfile ? (
          <div className="text-sm text-muted-foreground">Profil indisponible.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedProfile.kind}</Badge>
              <Badge variant="outline">dtype: {selectedProfile.dtype}</Badge>
              {targetColumn === selectedProfile.name ? (
                <Badge className="bg-primary text-primary-foreground">Target</Badge>
              ) : null}
            </div>

            <div className="text-sm">
              <span className="text-muted-foreground">Missing :</span>{" "}
              <span className="font-medium">{selectedProfile.missing}</span>
            </div>

            {selectedProfile.kind === "numeric" && selectedProfile.numeric ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground">Mean</p>
                  <p className="font-medium">{selectedProfile.numeric.mean ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground">Std</p>
                  <p className="font-medium">{selectedProfile.numeric.std ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground">Min</p>
                  <p className="font-medium">{selectedProfile.numeric.min ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground">Max</p>
                  <p className="font-medium">{selectedProfile.numeric.max ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground">P25</p>
                  <p className="font-medium">{selectedProfile.numeric.p25 ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground">P50</p>
                  <p className="font-medium">{selectedProfile.numeric.p50 ?? "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground">P75</p>
                  <p className="font-medium">{selectedProfile.numeric.p75 ?? "—"}</p>
                </div>
              </div>
            ) : null}

            {(selectedProfile.kind === "categorical" ||
              selectedProfile.kind === "text" ||
              selectedProfile.kind === "datetime") &&
            selectedProfile.categorical ? (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Unique :</span>{" "}
                  <span className="font-medium">{selectedProfile.categorical.unique}</span>
                </div>

                <div className="overflow-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Valeur</th>
                        <th className="px-3 py-2 text-right font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProfile.categorical.top_values.map((tv, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2">{tv.value}</td>
                          <td className="px-3 py-2 text-right">{tv.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              {selectedColName && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setTempTarget(selectedColName);
                    setShowTargetModal(true);
                    setProfileOpen(false);
                  }}
                >
                  Définir comme cible
                </Button>
              )}
              <Button onClick={() => setProfileOpen(false)}>Fermer</Button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
