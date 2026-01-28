import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  Database,
  RotateCcw,
  Info,
  Trash2,
  Eye,
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
import { FileUpload } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/components/ui/page-transition";
import { ConfirmModal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import datasetService, {
  DatasetOut,
  DatasetPreviewOut,
} from "@/services/datasetService";

export function ImportPage() {
  const { id } = useParams();
  const projectId = id!;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [datasets, setDatasets] = useState<DatasetOut[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    null
  );

  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [uploadComplete, setUploadComplete] = useState(false);
  const [preview, setPreview] = useState<DatasetPreviewOut | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DatasetOut | null>(null);

  const [rowsToPreview, setRowsToPreview] = useState<number>(2);

  const previewRows = useMemo(() => preview?.rows ?? [], [preview]);
  const previewColumns = useMemo(
    () =>
      previewRows.length > 0
        ? Object.keys(previewRows[0])
        : preview?.columns ?? [],
    [previewRows, preview]
  );

  const loadDatasets = async () => {
    setIsLoadingList(true);
    try {
      const list = await datasetService.list(projectId);
      setDatasets(list);

      if (list.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(list[0].id);
      }

      if (list.length === 0) {
        setSelectedDatasetId(null);
        setPreview(null);
      }
    } catch (e) {
      toast({
        title: "Erreur",
        description: (e as Error).message || "Impossible de charger les datasets",
        variant: "destructive",
      });
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadPreview = async (datasetId: number, rows: number) => {
    setIsLoadingPreview(true);
    try {
      const p = await datasetService.preview(projectId, datasetId, rows);
      setPreview(p);
    } catch (e) {
      setPreview(null);
      toast({
        title: "Erreur",
        description:
          (e as Error).message || "Impossible de prévisualiser le dataset",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    loadDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ✅ preview auto quand on change de dataset (avec rowsToPreview)
  useEffect(() => {
    if (selectedDatasetId) loadPreview(selectedDatasetId, rowsToPreview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatasetId]);

  const handleUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsUploading(true);
    setUploadComplete(false);

    try {
      const created = await datasetService.upload(projectId, uploadedFile);
      toast({
        title: "Fichier importé",
        description: "Votre dataset a été chargé avec succès",
      });

      await loadDatasets();
      setSelectedDatasetId(created.id);

      await loadPreview(created.id, rowsToPreview);

      setUploadComplete(true);
    } catch (e) {
      toast({
        title: "Erreur",
        description: (e as Error).message || "Échec de l'import",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadComplete(false);
    setPreview(null);
    setRowsToPreview(5);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await datasetService.delete(projectId, deleteTarget.id);

      toast({
        title: "Dataset supprimé",
        description: deleteTarget.original_name,
      });

      const remaining = datasets.filter((d) => d.id !== deleteTarget.id);
      setDatasets(remaining);

      if (selectedDatasetId === deleteTarget.id) {
        const next = remaining[0]?.id ?? null;
        setSelectedDatasetId(next);
        setPreview(null);
        if (next) await loadPreview(next, rowsToPreview);
      }

      if (remaining.length === 0) {
        setSelectedDatasetId(null);
        setPreview(null);
      }
    } catch (e) {
      toast({
        title: "Erreur",
        description: (e as Error).message || "Impossible de supprimer le dataset",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const onClickPreview = async () => {
    if (!selectedDatasetId) return;
    const rows = Number(rowsToPreview) || 5;
    await loadPreview(selectedDatasetId, rows);
  };

  const getDatasetLabel = (name?: string) => {
    const ext = (name || "").toLowerCase().split(".").pop();
    if (ext === "xlsx" || ext === "xls") return "XLSX";
    if (ext === "csv") return "CSV";
    return "FILE";
  };


  return (
    <AppLayout>
      <motion.div
        className="space-y-6 max-w-4xl mx-auto"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        <motion.div variants={staggerItem}>
          <h1 className="text-3xl font-bold text-foreground">
            Import de données
          </h1>
          <p className="text-muted-foreground mt-1">
            Chargez votre dataset médical pour commencer l'analyse
          </p>
        </motion.div>

        {/* Upload */}
        <motion.div variants={staggerItem}>
          <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Charger un fichier
              </CardTitle>
              <CardDescription>Formats acceptés: CSV, Excel (.xlsx)</CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload onUpload={handleUpload} />
              {isUploading && (
                <p className="text-sm text-muted-foreground mt-3">
                  Upload en cours…
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* List datasets */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Datasets du projet</CardTitle>
              <Button
                variant="outline"
                onClick={loadDatasets}
                disabled={isLoadingList}
              >
                Rafraîchir
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingList ? (
                <div className="text-sm text-muted-foreground">Chargement…</div>
              ) : datasets.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Aucun dataset pour ce projet. Importez un fichier pour commencer.
                </div>
              ) : (
                <div className="space-y-2">
                  {datasets.map((d) => (
                    <div
                      key={d.id}
                      className={[
                        "w-full p-3 rounded-lg border transition flex items-center justify-between gap-3",
                        selectedDatasetId === d.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40",
                      ].join(" ")}
                    >
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setSelectedDatasetId(d.id)}
                        type="button"
                      >
                        <p className="font-medium truncate">{d.original_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(d.size_bytes / 1024).toFixed(1)} KB •{" "}
                          {new Date(d.created_at).toLocaleString("fr-FR")}
                        </p>
                      </button>

                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{getDatasetLabel(d.original_name)}</Badge>


                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(d)}
                          aria-label="Supprimer le dataset"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Preview */}
        <AnimatePresence>
          {selectedDatasetId && (
            <motion.div
              variants={staggerItem}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-secondary" />
                      Aperçu du dataset
                    </CardTitle>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => navigate(`/projects/${projectId}/database`)}
                        className="bg-gradient-to-r from-primary to-secondary"
                      >
                        <Database className="h-4 w-4 mr-2" />
                        Menu d'analyse
                      </Button>
                    </div>
                  </div>

                  {/* ✅ rows selector */}
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  {/* Left: rows input */}
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="rows" className="text-sm">
                      Nombre de lignes
                    </Label>

                    <div className="flex items-center gap-3">
                      <Input
                        id="rows"
                        type="number"
                        min={1}
                        max={200}
                        value={rowsToPreview}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isNaN(v)) return;
                          setRowsToPreview(Math.min(200, Math.max(1, v)));
                        }}
                        className="w-32 h-9"
                      />
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-2 md:justify-end">
                    <Button
                      onClick={onClickPreview}
                      disabled={isLoadingPreview}
                      className="h-9"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Prévisualiser
                    </Button>

                    <Button variant="outline" onClick={handleReset} className="h-9">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Réinitialiser
                    </Button>
                  </div>
                </div>

                </CardHeader>

                <CardContent>
                  {isLoadingPreview ? (
                    <div className="text-sm text-muted-foreground">
                      Chargement de l’aperçu…
                    </div>
                  ) : !preview ? (
                    <div className="text-sm text-muted-foreground">
                      Aucun aperçu disponible pour le moment.
                    </div>
                  ) : previewRows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Dataset vide.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            {previewColumns.map((key) => (
                              <th
                                key={key}
                                className="px-4 py-2 text-left font-medium"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, i) => (
                            <tr key={i} className="border-t border-border">
                              {previewColumns.map((col) => (
                                <td key={col} className="px-4 py-2">
                                  {String((row as any)?.[col] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tip */}
        <motion.div variants={staggerItem}>
          <Card className="bg-muted/30">
            <CardContent className="flex items-start gap-3 py-4">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Conseil</p>
                <p className="text-sm text-muted-foreground">
                  Pour de meilleurs résultats, vérifie que la colonne cible est bien définie
                  et que les valeurs manquantes sont gérées.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Supprimer le dataset"
        description={`Êtes-vous sûr de vouloir supprimer "${deleteTarget?.original_name}" ?`}
        variant="destructive"
        confirmText={isDeleting ? "Suppression..." : "Supprimer"}
      />
    </AppLayout>
  );
}

export default ImportPage;
