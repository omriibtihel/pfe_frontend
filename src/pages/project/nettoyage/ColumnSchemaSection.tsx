/**
 * ColumnSchemaSection — section nettoyage + actions + tous les modaux overlay.
 * Comprend : Cleaning card, Actions card, et tous les modaux (substitution,
 * renommage, target, save-name, alerts, inspector).
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings2, Eraser, Save, Undo2, Trash2,
  Type as TypeIcon, RefreshCw, BookmarkPlus,
  ChevronsUpDown, X, Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { ColumnSelector } from "@/components/nettoyage/ColumnSelector";
import { AlertsModal } from "@/components/nettoyage/AlertsModal";
import { InspectorModal } from "@/components/nettoyage/InspectorModal";

import type { NettoyageState } from "./useNettoyageState";
import type { NettoyageData } from "./useNettoyageData";
import type { NettoyageActions } from "./useNettoyageActions";

// ── Props ─────────────────────────────────────────────────────────────────────
interface ColumnSchemaSectionProps {
  state: NettoyageState;
  data: NettoyageData;
  actions: NettoyageActions;
  projectId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ColumnSchemaSection({ state, data, actions, projectId }: ColumnSchemaSectionProps) {
  const { toast } = useToast();

  const disableProcessingActions = state.isLoading || state.isSwitchingDataset || !data.effectiveDatasetId;

  // ── Rename modal local state ───────────────────────────────────────────────
  const [renamePickerOpen, setRenamePickerOpen] = useState(false);
  const [renameSearch, setRenameSearch] = useState("");
  const [renameSelectedCol, setRenameSelectedCol] = useState("");
  const [renameNewName, setRenameNewName] = useState("");

  const renameFilteredCols = state.columns.filter(
    (c) => !renameSearch || c.toLowerCase().includes(renameSearch.toLowerCase()),
  );

  const handleRenameAdd = () => {
    const trimmed = renameNewName.trim();
    if (!renameSelectedCol || !trimmed || trimmed === renameSelectedCol) return;
    state.setRenameMap({ ...state.renameMap, [renameSelectedCol]: trimmed });
    setRenameSelectedCol("");
    setRenameNewName("");
  };

  return (
    <>
      {/* ── Cleaning + Actions grid ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {/* Cleaning Card */}
        <Card className="group relative overflow-hidden border-0 shadow-card hover:shadow-premium transition-all duration-500 lg:col-span-2">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-primary/40 rounded-l-2xl" />
          <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />
          <CardHeader className="relative z-10">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                <Eraser className="h-4.5 w-4.5 text-primary" />
              </div>
              Nettoyage
            </CardTitle>
            <CardDescription>Opérations sûres (sans fit/stat global)</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Col 1 — Row 1 */}
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:bg-destructive/5 hover:border-destructive/30"
                disabled={disableProcessingActions || state.selectedColumns.length === 0}
                onClick={() => actions.runCleaning("Colonnes supprimées", "drop_columns")}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer colonnes sélectionnées
              </Button>

              {/* Col 2 — Row 1 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={() =>
                  actions.runCleaning(
                    state.selectedColumns.length ? "Doublons supprimés (subset)" : "Doublons supprimés (toutes colonnes)",
                    "drop_duplicates",
                    { keep: state.dupKeep },
                  )
                }
              >
                Supprimer doublons {state.selectedColumns.length ? "(subset)" : "(tout)"}
              </Button>

              {/* Col 1 — Row 2 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={() =>
                  actions.runCleaning(
                    state.selectedColumns.length ? "Lignes vides supprimées (subset)" : "Lignes vides supprimées",
                    "drop_empty_rows",
                  )
                }
              >
                Supprimer lignes vides {state.selectedColumns.length ? "(subset)" : ""}
              </Button>

              {/* Col 2 — Row 2 */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs text-muted-foreground font-medium">Conserver :</span>
                <Select
                  value={state.dupKeep}
                  onValueChange={(v) => state.setDupKeep(v === "last" ? "last" : "first")}
                  disabled={disableProcessingActions}
                >
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">Premier</SelectItem>
                    <SelectItem value="last">Dernier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Col 1 — Row 3 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={() =>
                  actions.runCleaning(
                    state.selectedColumns.length ? "Colonnes vides supprimées (subset)" : "Colonnes vides supprimées",
                    "drop_empty_cols",
                  )
                }
              >
                Supprimer colonnes vides {state.selectedColumns.length ? "(subset)" : ""}
              </Button>

              {/* Col 2 — Row 3 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={() =>
                  actions.runCleaning(
                    state.selectedColumns.length ? "Espaces inutiles supprimés (sélection)" : "Espaces inutiles supprimés (colonnes texte)",
                    "strip_whitespace",
                  )
                }
              >
                <TypeIcon className="h-4 w-4 mr-2" />
                Supprimer espaces inutiles {state.selectedColumns.length ? "(sélection)" : "(auto)"}
              </Button>

              {/* Col 1 — Row 4 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={() => { state.setRenameMap({}); state.setShowRenameModal(true); }}
              >
                Renommer colonnes
              </Button>

              {/* Col 2 — Row 4 */}
              <Button
                variant="outline"
                className="w-full justify-start hover:bg-primary/5"
                disabled={disableProcessingActions}
                onClick={actions.openSubstitution}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Substitution de valeurs
              </Button>

              <div className="sm:col-span-2">
                <ColumnSelector
                  key={`clean-${data.effectiveDatasetId ?? "x"}`}
                  columns={state.columns}
                  selectedColumns={state.selectedColumns}
                  onToggle={state.toggleColumn}
                  label="Colonnes (utilisées selon l'action)"
                  metaMap={state.columnMetaMap}
                />
              </div>

              <p className="sm:col-span-2 text-[11px] text-muted-foreground/70 leading-relaxed">
                Astuce : pour <b>doublons</b>, <b>lignes/colonnes vides</b> et <b>strip</b>, si aucune colonne n'est sélectionnée, l'action s'applique sur toutes.
                Pour la <b>substitution</b>, tu choisis une colonne dans le modal.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card className="group relative overflow-hidden border-0 shadow-card hover:shadow-premium transition-all duration-500">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-secondary to-accent/40 rounded-l-2xl" />
          <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-secondary/5 blur-2xl group-hover:bg-secondary/10 transition-colors duration-500" />
          <CardHeader className="relative z-10">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary/15 to-accent/5 flex items-center justify-center">
                <Settings2 className="h-4.5 w-4.5 text-secondary" />
              </div>
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 relative z-10">
            <Button
              variant="outline"
              className="w-full justify-start hover:bg-secondary/5"
              onClick={actions.handleUndo}
              disabled={disableProcessingActions || state.operations.length === 0}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Annuler dernière
            </Button>

            <Button
              className="w-full bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              disabled={disableProcessingActions || state.isSavingProcessed}
              onClick={actions.handleSave}
            >
              <Save className="h-4 w-4 mr-2" />
              {state.isSavingProcessed
                ? "Enregistrement..."
                : data.isEditingVersion
                ? "Enregistrer (mettre à jour la version)"
                : "Enregistrer version nettoyée"}
            </Button>

            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Cette version <b>cleaned</b> sera utilisée pour l'entraînement (split + fit/transform dans le training pipeline).
            </p>

            {data.isEditingVersion && (
              <Button variant="ghost" className="w-full justify-start" onClick={actions.navigateToVersions} disabled={state.isLoading}>
                ← Retour aux versions
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Modaux ── */}

      {/* Substitution */}
      <Modal isOpen={state.showSubstitutionModal} onClose={() => state.setShowSubstitutionModal(false)} title="Substitution de valeurs" size="lg">
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-sm font-medium">Remplacer une valeur par une autre</p>
            <p className="text-xs text-muted-foreground mt-1">
              Exemple : remplacer <code>"?"</code> par <code>""</code> (vide) ou <code>"Unknown"</code>. Mode <b>exact</b>.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Colonne</p>
            <Select value={state.substColumn || ""} onValueChange={(v) => state.setSubstColumn(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={state.selectedColumns.length === 1 ? `Sélectionnée: ${state.selectedColumns[0]}` : "Choisir une colonne..."} />
              </SelectTrigger>
              <SelectContent>
                {state.columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">De (valeur à remplacer)</p>
                <Input value={state.substFrom} onChange={(e) => state.setSubstFrom(e.target.value)} placeholder='ex: "?" ou 0 ou Unknown' disabled={state.substTreatFromAsNull} />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={state.substTreatFromAsNull} onCheckedChange={(v) => state.setSubstTreatFromAsNull(Boolean(v))} className="h-3.5 w-3.5" />
                  De = null
                </label>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Par (nouvelle valeur)</p>
                <Input value={state.substTo} onChange={(e) => state.setSubstTo(e.target.value)} placeholder='ex: "" (vide) ou 1 ou Normal' disabled={state.substTreatToAsNull} />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={state.substTreatToAsNull} onCheckedChange={(v) => state.setSubstTreatToAsNull(Boolean(v))} className="h-3.5 w-3.5" />
                  Par = null
                </label>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={state.substCaseSensitive} onCheckedChange={(v) => state.setSubstCaseSensitive(Boolean(v))} className="h-3.5 w-3.5" />
                Sensible à la casse (chaînes)
              </label>
              <Badge variant="outline" className="text-[11px]">mode : exact</Badge>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => state.setShowSubstitutionModal(false)}>Annuler</Button>
            <Button onClick={actions.applySubstitution} disabled={disableProcessingActions}>Appliquer</Button>
          </div>
        </div>
      </Modal>

      {/* Renommage */}
      <Modal
        isOpen={state.showRenameModal}
        onClose={() => state.setShowRenameModal(false)}
        title="Renommer colonnes"
        size="lg"
      >
        <div className="space-y-4">
          {/* Sélecteur + input */}
          <div className="flex items-center gap-2">
            <Popover open={renamePickerOpen} onOpenChange={setRenamePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-52 justify-between font-normal" size="sm">
                  <span className="truncate">{renameSelectedCol || "Choisir une colonne…"}</span>
                  <ChevronsUpDown className="h-3.5 w-3.5 ml-2 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Rechercher…"
                    value={renameSearch}
                    onChange={(e) => setRenameSearch(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {renameFilteredCols.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Aucun résultat</p>
                  ) : (
                    renameFilteredCols.map((col) => (
                      <button
                        key={col}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors truncate"
                        onClick={() => {
                          setRenameSelectedCol(col);
                          setRenameSearch("");
                          setRenamePickerOpen(false);
                        }}
                      >
                        {col}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground shrink-0">→</span>

            <Input
              className="flex-1 h-8 text-sm"
              placeholder="Nouveau nom…"
              value={renameNewName}
              onChange={(e) => setRenameNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameAdd(); }}
            />

            <Button size="sm" variant="outline" onClick={handleRenameAdd} disabled={!renameSelectedCol || !renameNewName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Liste des renommages en attente */}
          {Object.keys(state.renameMap).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">En attente</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {Object.entries(state.renameMap).map(([old, next]) => (
                  <div key={old} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
                    <span className="font-medium truncate flex-1">{old}</span>
                    <span className="text-muted-foreground shrink-0">→</span>
                    <span className="truncate flex-1 text-primary font-medium">{next}</span>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => {
                        const m = { ...state.renameMap };
                        delete m[old];
                        state.setRenameMap(m);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => state.setShowRenameModal(false)}>Annuler</Button>
            <Button
              onClick={async () => {
                if (!Object.keys(state.renameMap).length) {
                  toast({ title: "Aucun renommage", description: "Ajoutez au moins un renommage.", variant: "destructive" });
                  return;
                }
                await actions.runCleaning("Colonnes renommées", "rename_columns", { mapping: state.renameMap }, []);
                state.setShowRenameModal(false);
              }}
              disabled={disableProcessingActions || !Object.keys(state.renameMap).length}
            >
              Appliquer ({Object.keys(state.renameMap).length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Target column */}
      <Modal isOpen={state.showTargetModal} onClose={() => state.setShowTargetModal(false)} title="Choisir la colonne cible" size="lg">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choisis la colonne cible pour l'entraînement (classification/régression). Tu peux la changer plus tard.
          </p>
          <Select value={state.tempTarget || ""} onValueChange={(v) => state.setTempTarget(v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner une colonne..." /></SelectTrigger>
            <SelectContent>
              {state.columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => state.setShowTargetModal(false)}>Plus tard</Button>
            <Button
              onClick={async () => {
                if (!data.effectiveDatasetId) return;
                if (!state.tempTarget) {
                  toast({ title: "Cible requise", description: "Sélectionne une colonne.", variant: "destructive" });
                  return;
                }
                try {
                  await data.setTarget(data.effectiveDatasetId, state.tempTarget);
                  state.setTargetColumn(state.tempTarget);
                  state.setShowTargetModal(false);
                  toast({ title: "Cible enregistrée", description: `Cible : ${state.tempTarget}` });
                } catch (e) {
                  toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
                }
              }}
              disabled={disableProcessingActions}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Nommer la version */}
      {(() => {
        const trimmed = state.saveVersionName.trim();
        const isDuplicateName = trimmed
          ? state.versions.some((v) => v.name.trim().toLowerCase() === trimmed.toLowerCase())
          : false;
        return (
          <Modal
            isOpen={state.showSaveNameModal}
            onClose={() => state.setShowSaveNameModal(false)}
            title="Nommer la version"
            description="Donnez un nom à cette version nettoyée"
            size="sm"
            icon={<BookmarkPlus className="h-4 w-4" />}
            footer={
              <div className="flex justify-end gap-2.5">
                <Button variant="outline" size="sm" onClick={() => state.setShowSaveNameModal(false)}>Annuler</Button>
                <Button size="sm" onClick={actions.confirmSaveVersion} disabled={!trimmed || isDuplicateName}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Enregistrer
                </Button>
              </div>
            }
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nom de la version</label>
              <Input
                value={state.saveVersionName}
                onChange={(e) => state.setSaveVersionName(e.target.value)}
                placeholder="ex : patients_cleaned_v2"
                onKeyDown={(e) => { if (e.key === "Enter" && trimmed && !isDuplicateName) actions.confirmSaveVersion(); }}
                autoFocus
                className={isDuplicateName ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {isDuplicateName ? (
                <p className="text-[11px] text-destructive">Ce nom est déjà utilisé par une autre version.</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Le système suggère un nom par défaut. Vous pouvez le modifier librement.</p>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Inspector modal (externalisé) */}
      <InspectorModal
        open={state.inspectorOpen}
        onClose={() => state.setInspectorOpen(false)}
        col={state.inspectedCol}
        tab={state.inspectorTab}
        onTabChange={state.setInspectorTab}
        dtypes={state.dtypes}
        metaMap={state.columnMetaMap}
        kindOverrides={state.kindOverrides}
        verifiedCategorical={state.verifiedCategorical}
        projectId={projectId}
        effectiveDatasetId={data.effectiveDatasetId}
        disableActions={disableProcessingActions}
        onRefresh={() => { if (!data.effectiveDatasetId) return; void data.refreshProcessing(data.effectiveDatasetId, state.page); }}
        onRunCleaning={actions.runCleaning}
        onSetOverride={actions.setOverride}
        onClearOverride={actions.clearOverride}
        onVerifyCategorical={actions.verifyCategorical}
      />

      {/* Alerts modal (externalisé) */}
      <AlertsModal
        open={state.alertsOpen}
        onClose={() => state.setAlertsOpen(false)}
        metaMap={state.columnMetaMap}
        verifiedCategorical={state.verifiedCategorical}
        kindOverrides={state.kindOverrides}
        dismissedAlertKeys={state.dismissedAlertKeys}
        thresholds={data.alertThresholds}
        disableActions={disableProcessingActions}
        onDismissAlert={actions.dismissAlert}
        onVerifyCategorical={actions.verifyCategorical}
        onSetOverride={actions.setOverride}
        onClearOverride={actions.clearOverride}
        onRunCleaning={actions.runCleaning}
      />
    </>
  );
}
