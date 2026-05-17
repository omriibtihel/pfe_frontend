import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  Database,
  RotateCcw,
  Info,
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
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/components/ui/page-transition";
import { ConfirmModal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import datasetService, {
  DatasetOut,
  DatasetPreviewOut,
} from "@/services/datasetService";
import { withDemoPrefix } from "@/demo/paths";

export function ImportPage() {
  const { id } = useParams();
  const projectId = id!;
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const appPath = (path: string) => withDemoPrefix(path, location.pathname);

  const [file, setFile] = useState<File | null>(null);
  const [datasets, setDatasets] = useState<DatasetOut[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    null
  );
  const [uploadedDatasetId, setUploadedDatasetId] = useState<number | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [uploadComplete, setUploadComplete] = useState(false);
  const [preview, setPreview] = useState<DatasetPreviewOut | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DatasetOut | null>(null);

  const [rowsToPreview, setRowsToPreview] = useState<number>(5);

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

      if (list.length > 0) {
        if (!selectedDatasetId) setSelectedDatasetId(list[0].id);
        setUploadedDatasetId((prev) => prev ?? list[0].id);
      } else {
        setSelectedDatasetId(null);
        setUploadedDatasetId(null);
        setPreview(null);
      }
    } catch (e) {
      toast({
        title: t("import.toastErrTitle"),
        description: (e as Error).message || t("import.errLoadList"),
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
        title: t("import.toastErrTitle"),
        description: (e as Error).message || t("import.errPreview"),
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
        title: t("import.toastImportedTitle"),
        description: t("import.toastImportedDesc"),
      });

      await loadDatasets();
      setSelectedDatasetId(created.id);
      setUploadedDatasetId(created.id);

      await loadPreview(created.id, rowsToPreview);

      setUploadComplete(true);
    } catch (e) {
      toast({
        title: t("import.toastErrTitle"),
        description: (e as Error).message || t("import.errImport"),
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

  const uploadedDataset = useMemo(
    () => datasets.find((d) => d.id === uploadedDatasetId) ?? null,
    [datasets, uploadedDatasetId]
  );

  useEffect(() => {
    if (uploadedDatasetId !== null && !uploadedDataset) {
      setUploadedDatasetId(null);
    }
  }, [uploadedDatasetId, uploadedDataset]);

  const handleRemoveUploaded = () => {
    if (uploadedDataset) setDeleteTarget(uploadedDataset);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await datasetService.delete(projectId, deleteTarget.id);

      toast({
        title: t("import.toastDeletedTitle"),
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
        title: t("import.toastErrTitle"),
        description: (e as Error).message || t("import.errDelete"),
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

  return (
    <AppLayout>
      <motion.div
        className="space-y-6 w-full"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        <motion.div variants={staggerItem}>
          <h1 className="text-3xl font-bold text-foreground">
            {t("import.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("import.subtitle")}
          </p>
        </motion.div>

        {/* Upload */}
        <motion.div variants={staggerItem} data-tour="import-upload">
          <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                {t("import.uploadTitle")}
              </CardTitle>
              <CardDescription>{t("import.uploadDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload
                onUpload={handleUpload}
                currentFile={
                  uploadedDataset
                    ? { name: uploadedDataset.original_name, size: uploadedDataset.size_bytes }
                    : null
                }
                onRemove={handleRemoveUploaded}
              />
              {isUploading && (
                <p className="text-sm text-muted-foreground mt-3">
                  {t("import.uploading")}
                </p>
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
              data-tour="import-preview"
            >
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-secondary" />
                      {t("import.previewTitle")}
                    </CardTitle>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => navigate(appPath(`/projects/${projectId}/database`))}
                        className="bg-gradient-to-r from-primary to-secondary"
                      >
                        <Database className="h-4 w-4 mr-2" />
                        {t("import.analysisMenu")}
                      </Button>
                    </div>
                  </div>

                  {/* ✅ rows selector */}
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  {/* Left: rows input */}
                  <div className="flex flex-col gap-1" data-tour="import-rows">
                    <Label htmlFor="rows" className="text-sm">
                      {t("import.rowsLabel")}
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
                      data-tour="import-preview-btn"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {t("import.preview")}
                    </Button>

                    <Button variant="outline" onClick={handleReset} className="h-9">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {t("import.reset")}
                    </Button>
                  </div>
                </div>

                </CardHeader>

                <CardContent>
                  {isLoadingPreview ? (
                    <div className="text-sm text-muted-foreground">
                      {t("import.loadingPreview")}
                    </div>
                  ) : !preview ? (
                    <div className="text-sm text-muted-foreground">
                      {t("import.noPreview")}
                    </div>
                  ) : previewRows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{t("import.emptyDataset")}</div>
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
                                  {String((row as Record<string, unknown>)?.[col] ?? "")}
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
                <p className="font-medium">{t("import.tipTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("import.tipDesc")}
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
        title={t("import.deleteTitle")}
        description={t("import.deleteDesc", { name: deleteTarget?.original_name ?? "" })}
        variant="destructive"
        confirmText={isDeleting ? t("import.deleting") : t("import.delete")}
      />
    </AppLayout>
  );
}

export default ImportPage;
