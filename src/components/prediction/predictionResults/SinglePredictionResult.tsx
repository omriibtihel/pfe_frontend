import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Shuffle,
  Sparkles,
  Star,
  Target,
  XCircle,
} from 'lucide-react';

import { AppLayout } from '@/layouts/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PredictionReportPanel } from '@/components/prediction/PredictionReportPanel';
import type {
  ExplanationMethod,
  LimeLocalItem,
  PredictionResponse,
  PredictionRow,
  ShapLocalItem,
} from '@/types';

import { CounterfactualModal } from './CounterfactualModal';
import { ExplanationPanel, METHOD_LABELS, MethodToggle } from './ExplanationPanel';
import { CONF_BADGE, _confLevel, _confTooltip, _fmt } from './helpers';
import { usePredictionExplanations } from './usePredictionExplanations';

// ─────────────────────────────────────────────────────────────────────────────
// Hero card — large, focused display of the single prediction
// ─────────────────────────────────────────────────────────────────────────────

function HeroCard({
  row,
  isClassification,
  threshold,
}: {
  row: PredictionRow;
  isClassification: boolean;
  threshold: number;
}) {
  const valStr = String(row.prediction);
  const lower = valStr.toLowerCase();
  const isPositive =
    lower === '1' || lower === 'true' || lower === 'yes' || lower === 'oui' || lower === 'positive';
  const isNegative =
    lower === '0' || lower === 'false' || lower === 'no' || lower === 'non' || lower === 'negative';

  const tone = isClassification
    ? isPositive
      ? {
          ring: 'ring-red-400/40',
          bg: 'from-red-500/10 via-red-500/5 to-transparent',
          icon: <AlertTriangle className="h-7 w-7" />,
          iconBox: 'bg-red-500/15 text-red-600 dark:text-red-400',
          text: 'text-red-700 dark:text-red-300',
          label: 'Résultat positif',
        }
      : isNegative
        ? {
            ring: 'ring-emerald-400/40',
            bg: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
            icon: <CheckCircle2 className="h-7 w-7" />,
            iconBox: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
            text: 'text-emerald-700 dark:text-emerald-300',
            label: 'Résultat négatif',
          }
        : {
            ring: 'ring-border',
            bg: 'from-primary/10 via-primary/5 to-transparent',
            icon: <Target className="h-7 w-7" />,
            iconBox: 'bg-primary/15 text-primary',
            text: 'text-foreground',
            label: 'Classe prédite',
          }
    : {
        ring: 'ring-primary/30',
        bg: 'from-primary/10 via-primary/5 to-transparent',
        icon: <Target className="h-7 w-7" />,
        iconBox: 'bg-primary/15 text-primary',
        text: 'text-foreground',
        label: 'Valeur prédite',
      };

  const level = isClassification ? _confLevel(row.score, threshold) : null;
  const conf = level ? CONF_BADGE[level] : null;

  return (
    <Card className={`relative overflow-hidden ring-1 ${tone.ring} shadow-sm`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${tone.bg} pointer-events-none`} aria-hidden />
      <CardContent className="relative pt-8 pb-7 px-4 sm:px-6 md:px-10">
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone.iconBox}`}>
            {tone.icon}
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {tone.label}
            </p>
            <p className={`text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight tabular-nums break-all ${tone.text}`}>
              {isClassification ? valStr : _fmt(row.prediction)}
            </p>
          </div>
          {isClassification && row.score !== null && (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="inline-flex items-baseline gap-1 rounded-full border border-border bg-card/80 px-3 py-1 backdrop-blur-sm">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Probabilité</span>
                <span className="text-base font-bold tabular-nums text-foreground">
                  {(row.score * 100).toFixed(1)}%
                </span>
              </span>
              {conf && (
                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${conf.badge}`}>
                  Confiance : {conf.label}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence gauge — semicircular bar with threshold marker
// ─────────────────────────────────────────────────────────────────────────────

function ConfidenceGauge({
  score,
  threshold,
}: {
  score: number;
  threshold: number;
}) {
  const pct = Math.round(score * 100);
  const tPct = Math.round(threshold * 100);
  const level = _confLevel(score, threshold);
  const conf = CONF_BADGE[level];
  const tooltip = _confTooltip(level, threshold);

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-5 pb-5 px-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Jauge de confiance
          </p>
          <span className="text-[10px] tabular-nums text-muted-foreground">seuil {tPct}%</span>
        </div>

        <div className="relative">
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%`, backgroundColor: conf.bar }}
            />
            <div
              className="absolute inset-y-[-4px] w-0.5 rounded-full bg-foreground/50"
              style={{ left: `${tPct}%` }}
              title={`Seuil de décision : ${tPct}%`}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] tabular-nums text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-3 pt-1 border-t border-border">
          <div>
            <p className="text-3xl font-bold tabular-nums tracking-tight" style={{ color: conf.bar }}>
              {pct}%
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{tooltip}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inputs recap — features the user filled, key features starred
// ─────────────────────────────────────────────────────────────────────────────

function InputsRecap({
  inputData,
  topFeatures,
}: {
  inputData: Record<string, unknown>;
  topFeatures: string[];
}) {
  const topSet = new Set(topFeatures);
  const allKeys = Object.keys(inputData);
  const orderedKeys = [
    ...topFeatures.filter((f) => f in inputData),
    ...allKeys.filter((k) => !topSet.has(k)).sort((a, b) => a.localeCompare(b)),
  ];

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-5 pb-5 px-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Données saisies
          </p>
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            {allKeys.length} variable{allKeys.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="rounded-lg border border-border divide-y divide-border/50 max-h-[420px] overflow-y-auto">
          {orderedKeys.map((k) => {
            const isTop = topSet.has(k);
            return (
              <div
                key={k}
                className={`flex items-baseline justify-between gap-3 px-3 py-2 hover:bg-muted/40 transition-colors ${
                  isTop ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px] text-foreground truncate" title={k}>
                  {isTop && <Star className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />}
                  <span className={isTop ? 'font-medium' : 'text-muted-foreground'}>{k}</span>
                </span>
                <span className="font-mono tabular-nums text-[12px] font-semibold text-foreground shrink-0">
                  {_fmt(inputData[k])}
                </span>
              </div>
            );
          })}
          {orderedKeys.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Aucune donnée disponible.</p>
          )}
        </div>
        {topFeatures.length > 0 && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
            Variables jugées les plus importantes par le modèle
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline explanation card — auto-fetches on mount, with method toggle
// ─────────────────────────────────────────────────────────────────────────────

function ExplanationCard({
  shapItems,
  limeItems,
  method,
  onMethodChange,
  isLoading,
  projectId,
  modelId,
  modelName,
  projectName,
  row,
  isClassification,
}: {
  shapItems: ShapLocalItem[] | null;
  limeItems: LimeLocalItem[] | null;
  method: ExplanationMethod;
  onMethodChange: (m: ExplanationMethod) => void;
  isLoading: boolean;
  projectId: string;
  modelId: number;
  modelName: string;
  projectName: string;
  row: PredictionRow;
  isClassification: boolean;
}) {
  const rowWithLime: PredictionRow = { ...row, lime: limeItems ?? row.lime ?? null };

  const methodDescription =
    method === 'shap'
      ? "SHAP mesure la contribution réelle de chaque variable à la prédiction, en comparant à une moyenne de référence. Vue globale et fiable."
      : method === 'lime'
        ? "LIME explique la prédiction en testant de petites variations autour de cette ligne. Vue locale, intuitive et rapide."
        : "Comparaison des deux approches : SHAP (contribution globale et exacte) et LIME (explication locale par variations). Si elles divergent (⚠), la variable est instable.";

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-5 pb-5 px-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Pourquoi ce résultat ?</p>
              <p className="text-[10px] text-muted-foreground">Contributions des variables à la prédiction</p>
            </div>
          </div>
          <MethodToggle value={method} onChange={onMethodChange} />
        </div>

        <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">{methodDescription}</p>
        </div>

        <div className="rounded-lg border border-border bg-card min-h-[200px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                Calcul des contributions…
              </p>
            </div>
          ) : (
            <ExplanationPanel method={method} shapItems={shapItems} limeItems={limeItems} />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
          <p className="text-[10px] text-muted-foreground leading-relaxed flex-1 min-w-0">
            Impact{' '}
            <span className="font-medium text-orange-600 dark:text-orange-400">positif ↑</span>
            {' '}ou{' '}
            <span className="font-medium text-blue-600 dark:text-blue-400">négatif ↓</span>
            {' '}par rapport à la prédiction moyenne du modèle.
          </p>
          {(shapItems?.length || limeItems?.length) && (
            <PredictionReportPanel
              projectId={projectId}
              modelId={modelId}
              row={rowWithLime}
              projectName={projectName}
              modelName={modelName}
            />
          )}
          {!isClassification && null}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function SinglePredictionResult({
  result,
  projectId,
}: {
  result: PredictionResponse;
  projectId: string;
}) {
  const navigate = useNavigate();

  const row = result.rows[0];
  const isClassification = result.taskType === 'classification';
  const threshold = result.thresholdUsed ?? 0.5;
  const topFeatures = result.topFeatures ?? [];

  const {
    getRowExplanations,
    fetchExplanations,
    runCounterfactual,
    cfLiveRunner,
    featureRanges,
    ensureFeatureRanges,
    isRowLoading,
    isCfLoading,
    exportCsv,
    isExporting,
  } = usePredictionExplanations(projectId, result);

  const [method, setMethod] = useState<ExplanationMethod>('shap');
  const [openCfModal, setOpenCfModal] = useState(false);

  const entry = row ? getRowExplanations(row) : { shap: undefined, lime: undefined, counterfactual: undefined };
  const shapItems: ShapLocalItem[] | null = entry.shap ?? null;
  const limeItems: LimeLocalItem[] | null = entry.lime ?? null;
  const isLoadingExplain = row ? isRowLoading(row) : false;
  const isLoadingCf = row ? isCfLoading(row) : false;
  const cfResult = entry.counterfactual;

  // Auto-fetch SHAP on mount when missing
  useEffect(() => {
    if (!row) return;
    if (!shapItems) void fetchExplanations(row, 'shap');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMethodChange = useCallback(
    (m: ExplanationMethod) => {
      setMethod(m);
      if (row) void fetchExplanations(row, m);
    },
    [fetchExplanations, row],
  );

  const handleCfAutoSuggest = useCallback(
    async (featuresToVary: string[]) => {
      if (!row) return;
      await runCounterfactual(row, featuresToVary);
    },
    [row, runCounterfactual],
  );

  // Lazy-load feature ranges when CF modal opens
  useEffect(() => {
    if (openCfModal) ensureFeatureRanges();
  }, [openCfModal, ensureFeatureRanges]);

  const driftWarnings = result.driftWarnings ?? [];

  const uncertain = useMemo(
    () => isClassification && row && _confLevel(row.score, threshold) === 'uncertain',
    [isClassification, row, threshold],
  );

  if (!row) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto text-center space-y-5 pt-16">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
            <XCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">Aucune ligne dans le résultat</h2>
          <Button onClick={() => navigate(`/projects/${projectId}/predict`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 self-start text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate(`/projects/${projectId}/predict`)}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Nouvelle prédiction
          </Button>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Résultat de prédiction</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[11px]">
                  <Target className="mr-1 h-3 w-3" /> Saisie manuelle
                </Badge>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-foreground">
                  {result.modelType}
                </span>
                {threshold !== 0.5 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    Seuil calibré : {threshold.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenCfModal(true)}
                className="flex-1 sm:flex-none border-amber-400/50 bg-amber-50/50 text-amber-700 hover:bg-amber-100/50 dark:bg-amber-950/20 dark:text-amber-300"
              >
                <Shuffle className="h-4 w-4 mr-2" /> Que changer ?
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={isExporting} className="flex-1 sm:flex-none">
                {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Exporter CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Drift warnings */}
        {driftWarnings.length > 0 && (
          <div className="rounded-xl border border-l-4 border-l-amber-500 border-border bg-card shadow-sm p-4">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              Vos données sortent de la plage habituelle
              <span className="ml-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                {driftWarnings.length} avert.
              </span>
            </div>
            <ul className="space-y-1.5 pl-9">
              {driftWarnings.map((w, i) => (
                <li key={i} className="text-xs flex items-start gap-2 text-muted-foreground">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none mt-0.5 ${
                      w.severity === 'critical'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {w.severity === 'critical' ? 'CRITIQUE' : 'AVERT.'}
                  </span>
                  <span>
                    <span className="font-mono font-semibold text-foreground">{w.column}</span> · {w.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Uncertain alert */}
        {uncertain && (
          <div className="rounded-xl border border-l-4 border-l-red-500 border-border bg-card shadow-sm p-4 flex items-start gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Prédiction incertaine</p>
              <p className="text-xs text-muted-foreground mt-1">
                Le score est très proche du seuil de décision. Une vérification clinique est recommandée.
              </p>
            </div>
          </div>
        )}

        {/* Hero + Gauge */}
        {isClassification && row.score !== null ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <HeroCard row={row} isClassification={isClassification} threshold={threshold} />
            <ConfidenceGauge score={row.score} threshold={threshold} />
          </div>
        ) : (
          <HeroCard row={row} isClassification={isClassification} threshold={threshold} />
        )}

        {/* Two-column: inputs + explanation */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2">
            <InputsRecap inputData={row.inputData} topFeatures={topFeatures} />
          </div>
          <div className="lg:col-span-3">
            <ExplanationCard
              shapItems={shapItems}
              limeItems={limeItems}
              method={method}
              onMethodChange={handleMethodChange}
              isLoading={isLoadingExplain}
              projectId={projectId}
              modelId={result.modelId}
              modelName={result.modelType}
              projectName={`Projet ${projectId}`}
              row={row}
              isClassification={isClassification}
            />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-2">
          Méthode actuelle : <span className="font-medium text-foreground">{METHOD_LABELS[method]}</span> · Cette
          prédiction est indicative et ne remplace pas un avis clinique.
        </p>
      </div>

      {/* Counterfactual Modal */}
      {openCfModal && (
        <CounterfactualModal
          row={row}
          result={result}
          featureRanges={featureRanges}
          cachedResult={cfResult}
          isLoadingAutoSuggest={isLoadingCf}
          onAutoSuggest={handleCfAutoSuggest}
          liveRunner={cfLiveRunner}
          onClose={() => setOpenCfModal(false)}
        />
      )}
    </AppLayout>
  );
}
