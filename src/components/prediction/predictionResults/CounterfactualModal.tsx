import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Lock, RotateCcw, Shuffle, Unlock, Wand2 } from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import type {
  CounterfactualResult,
  FeatureRange,
  FeatureRangesMap,
  PredictionResponse,
  PredictionRow,
} from '@/types';
import {
  _defaultLocked,
  _fmt,
  _fmtNum,
  _sliderBounds,
  _sliderStep,
  _toNumber,
} from './helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Probability gauge (live)
// ─────────────────────────────────────────────────────────────────────────────

function ProbabilityGauge({
  score,
  prediction,
  threshold,
  isLoading,
}: {
  score: number | null;
  prediction: unknown;
  threshold: number;
  isLoading: boolean;
}) {
  if (score === null) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Prédiction</span>
        <span className="text-base font-mono font-bold tabular-nums text-foreground">{String(prediction)}</span>
      </div>
    );
  }
  const pct = Math.round(score * 100);
  const flipped = score < threshold;
  const tPct = Math.round(threshold * 100);
  const accentClass = flipped
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
  const bar = flipped ? 'bg-emerald-500' : 'bg-red-500';

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Probabilité actuelle
            </span>
            {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold tabular-nums tracking-tight ${accentClass}`}>{pct}</span>
            <span className={`text-base font-semibold ${accentClass}`}>%</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none ${
            flipped
              ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-red-400/50 bg-red-500/10 text-red-700 dark:text-red-300'
          }`}
        >
          {flipped ? '✓ Prédiction inversée' : `Classe : ${String(prediction)}`}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${bar}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-[-4px] w-0.5 bg-foreground/40 rounded-full"
          style={{ left: `${tPct}%` }}
          title={`Seuil de décision : ${tPct}%`}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>0 %</span>
        <span className="font-mono">seuil {tPct} %</span>
        <span>100 %</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-feature row (slider for numeric, locked display otherwise)
// ─────────────────────────────────────────────────────────────────────────────

function FeatureSliderRow({
  name,
  value,
  originalValue,
  range,
  locked,
  onValueChange,
  onLockToggle,
}: {
  name: string;
  value: number | null;
  originalValue: unknown;
  range: FeatureRange | undefined;
  locked: boolean;
  onValueChange: (v: number) => void;
  onLockToggle: () => void;
}) {
  const origNum = _toNumber(originalValue);

  if (value === null || origNum === null) {
    return (
      <div className="group flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
          <Lock className="h-3 w-3" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] font-medium text-foreground truncate" title={name}>
            {name}
          </span>
          <span className="text-[10px] text-muted-foreground">Variable non modifiable</span>
        </div>
        <span className="shrink-0 font-mono tabular-nums text-[11px] font-semibold text-foreground">
          {originalValue != null ? _fmt(originalValue) : '—'}
        </span>
      </div>
    );
  }

  const [min, max] = _sliderBounds(range, value, origNum);
  const step = _sliderStep(min, max);
  const delta = value - origNum;
  const hasDelta = Math.abs(delta) >= step / 2;

  const deltaTone = !hasDelta
    ? 'border-border bg-muted/40 text-muted-foreground'
    : delta < 0
      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : 'border-orange-400/40 bg-orange-500/10 text-orange-700 dark:text-orange-300';

  const origPct = ((origNum - min) / (max - min)) * 100;
  const clampedOrigPct = Math.max(0, Math.min(100, origPct));

  return (
    <div className={`group px-3 py-2.5 rounded-md transition-colors ${locked ? 'opacity-60' : 'hover:bg-muted/20'}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onLockToggle}
            className={`flex h-6 w-6 items-center justify-center rounded-md shrink-0 transition-colors ${
              locked
                ? 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
            title={locked ? 'Déverrouiller cette variable' : 'Verrouiller cette variable'}
            aria-label={locked ? 'Déverrouiller' : 'Verrouiller'}
          >
            {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
          <span className="text-[11px] font-medium text-foreground truncate" title={name}>
            {name}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono tabular-nums text-[11px] font-semibold text-foreground">
            {_fmtNum(value, step)}
          </span>
          <span
            className={`min-w-[44px] text-center rounded-full border px-1.5 py-0.5 text-[10px] font-mono font-semibold leading-none ${deltaTone}`}
          >
            {hasDelta ? `${delta > 0 ? '+' : ''}${_fmtNum(delta, step)}` : '—'}
          </span>
        </div>
      </div>
      <div className="relative pl-8 pr-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={locked}
          onChange={(e) => onValueChange(parseFloat(e.target.value))}
          className="w-full accent-primary disabled:opacity-50 disabled:cursor-not-allowed h-1"
        />
        <div
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-2.5 w-0.5 rounded-full bg-muted-foreground/60"
          style={{ left: `calc(2rem + (100% - 2.25rem) * ${clampedOrigPct / 100})` }}
          title={`Valeur d'origine : ${_fmtNum(origNum, step)}`}
        />
        <div className="relative h-3 mt-1">
          <span className="absolute left-0 top-0 text-[10px] font-mono tabular-nums text-muted-foreground">
            {_fmtNum(min, step)}
          </span>
          <span className="absolute right-0 top-0 text-[10px] font-mono tabular-nums text-muted-foreground">
            {_fmtNum(max, step)}
          </span>
          <span
            className="absolute top-0 -translate-x-1/2 text-[10px] font-mono tabular-nums text-foreground/70 whitespace-nowrap"
            style={{ left: `calc((100% - 0.25rem) * ${clampedOrigPct / 100})` }}
            title="Valeur d'origine du patient"
          >
            ▴ {_fmtNum(origNum, step)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive panel — sliders + live prediction + auto-suggest
// ─────────────────────────────────────────────────────────────────────────────

function InteractiveCFPanel({
  row,
  result,
  featureRanges,
  cachedResult,
  isLoadingAutoSuggest,
  onAutoSuggest,
  liveRunner,
}: {
  row: PredictionRow;
  result: PredictionResponse;
  featureRanges: FeatureRangesMap;
  cachedResult?: CounterfactualResult;
  isLoadingAutoSuggest: boolean;
  onAutoSuggest: (featuresToVary: string[]) => Promise<void>;
  liveRunner: (overrides: Record<string, unknown>) => Promise<{ prediction: unknown; score: number | null }>;
}) {
  const featureNames = result.featureNamesExpected;
  const threshold = result.thresholdUsed ?? 0.5;

  const buildInitial = useCallback((): Record<string, number> => {
    const init: Record<string, number> = {};
    for (const f of featureNames) {
      const n = _toNumber(row.inputData[f]);
      if (n !== null) init[f] = n;
    }
    return init;
  }, [featureNames, row.inputData]);

  const [values, setValues] = useState<Record<string, number>>(buildInitial);
  const [locked, setLocked] = useState<Set<string>>(
    () => new Set(featureNames.filter((f) => _defaultLocked(f, row.inputData[f]))),
  );
  const [livePrediction, setLivePrediction] = useState<{ prediction: unknown; score: number | null }>({
    prediction: row.prediction,
    score: row.score,
  });
  const [isLivePredicting, setIsLivePredicting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>('');

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const merged: Record<string, unknown> = { ...row.inputData, ...values };
    const payloadKey = JSON.stringify(merged);
    if (payloadKey === lastPayloadRef.current) return;

    debounceRef.current = setTimeout(async () => {
      lastPayloadRef.current = payloadKey;
      setIsLivePredicting(true);
      try {
        const res = await liveRunner(merged);
        setLivePrediction(res);
      } catch {
        // Silent fail — keep last successful prediction visible.
      } finally {
        setIsLivePredicting(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [values, row.inputData, liveRunner]);

  // When auto-suggest finishes, populate sliders with the suggested values.
  useEffect(() => {
    if (!cachedResult?.counterfactual) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const item of cachedResult.counterfactual ?? []) {
        if (item.suggested_value != null && item.feature in next) {
          next[item.feature] = item.suggested_value;
        }
      }
      return next;
    });
  }, [cachedResult]);

  const toggleLock = (name: string) =>
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const handleReset = () => {
    setValues(buildInitial());
  };

  const handleAutoSuggest = () => {
    const modifiable = featureNames.filter((f) => !locked.has(f));
    if (modifiable.length === 0) return;
    void onAutoSuggest(modifiable);
  };

  const modifiableCount = featureNames.filter((f) => !locked.has(f)).length;
  const changedCount = Object.entries(values).filter(([f, v]) => {
    const orig = _toNumber(row.inputData[f]);
    return orig !== null && Math.abs(v - orig) > 1e-9;
  }).length;

  const modifiableFeatures = featureNames.filter((f) => !locked.has(f));
  const lockedFeatures = featureNames.filter((f) => locked.has(f));

  const noFlipFound =
    cachedResult?.counterfactual !== undefined &&
    cachedResult.counterfactual !== null &&
    cachedResult.counterfactual.length === 0;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-2 bg-popover/95 backdrop-blur-sm">
        <ProbabilityGauge
          score={livePrediction.score}
          prediction={livePrediction.prediction}
          threshold={threshold}
          isLoading={isLivePredicting}
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-medium tabular-nums">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {modifiableCount} modifiable{modifiableCount !== 1 ? 's' : ''}
        </span>
        {lockedFeatures.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            <Lock className="h-2.5 w-2.5" />
            {lockedFeatures.length} fixe{lockedFeatures.length !== 1 ? 's' : ''}
          </span>
        )}
        {changedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {changedCount} ajustée{changedCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {modifiableFeatures.length > 0 && (
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Variables modifiables
          </p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border max-h-72 overflow-y-auto">
            {modifiableFeatures.map((f) => (
              <FeatureSliderRow
                key={f}
                name={f}
                value={values[f] ?? null}
                originalValue={row.inputData[f]}
                range={featureRanges[f]}
                locked={false}
                onValueChange={(v) => setValues((prev) => ({ ...prev, [f]: v }))}
                onLockToggle={() => toggleLock(f)}
              />
            ))}
          </div>
        </div>
      )}

      {lockedFeatures.length > 0 && (
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Variables fixes
            <span className="ml-1.5 normal-case font-normal text-[10px] tracking-normal">
              — cliquez sur le cadenas pour autoriser leur modification
            </span>
          </p>
          <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border/50">
            {lockedFeatures.map((f) => (
              <FeatureSliderRow
                key={f}
                name={f}
                value={values[f] ?? null}
                originalValue={row.inputData[f]}
                range={featureRanges[f]}
                locked={true}
                onValueChange={(v) => setValues((prev) => ({ ...prev, [f]: v }))}
                onLockToggle={() => toggleLock(f)}
              />
            ))}
          </div>
        </div>
      )}

      {noFlipFound && (
        <div className="rounded-xl border border-l-4 border-l-amber-500 border-border bg-card p-3 flex items-start gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          <p className="text-[11px] text-foreground leading-relaxed">
            <span className="font-medium">Aucune combinaison automatique trouvée.</span>{' '}
            <span className="text-muted-foreground">
              {cachedResult?.message ?? 'Déverrouillez plus de variables ou ajustez manuellement les sliders.'}
            </span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={handleReset}
          disabled={changedCount === 0}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Remettre toutes les variables à leur valeur originale"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Réinitialiser
        </button>
        <button
          type="button"
          onClick={handleAutoSuggest}
          disabled={isLoadingAutoSuggest || modifiableCount === 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Laisser l'algorithme proposer une combinaison qui inverse la prédiction"
        >
          {isLoadingAutoSuggest ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5" />
          )}
          {isLoadingAutoSuggest ? 'Calcul en cours…' : 'Auto-suggérer'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal wrapper
// ─────────────────────────────────────────────────────────────────────────────

export function CounterfactualModal({
  row,
  result,
  featureRanges,
  cachedResult,
  isLoadingAutoSuggest,
  onAutoSuggest,
  liveRunner,
  onClose,
}: {
  row: PredictionRow;
  result: PredictionResponse;
  featureRanges: FeatureRangesMap;
  cachedResult?: CounterfactualResult;
  isLoadingAutoSuggest: boolean;
  onAutoSuggest: (featuresToVary: string[]) => Promise<void>;
  liveRunner: (overrides: Record<string, unknown>) => Promise<{ prediction: unknown; score: number | null }>;
  onClose: () => void;
}) {
  const isClassification = result.taskType === 'classification';
  const descParts = [
    `Prédiction initiale : ${String(row.prediction)}`,
    isClassification && row.score != null ? `Score : ${(row.score * 100).toFixed(1)} %` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      icon={<Shuffle className="h-5 w-5" />}
      title={`Que changer ? — ligne ${row.rowIndex + 1}`}
      description={descParts}
      footer={
        <div className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
          <Wand2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <p>
            Ajustez les sliders pour observer l'effet sur la prédiction en temps réel, ou cliquez sur{' '}
            <span className="font-medium text-foreground">Auto-suggérer</span> pour une combinaison automatique.
            Ces suggestions sont indicatives et ne remplacent pas un avis clinique.
          </p>
        </div>
      }
    >
      <InteractiveCFPanel
        row={row}
        result={result}
        featureRanges={featureRanges}
        cachedResult={cachedResult}
        isLoadingAutoSuggest={isLoadingAutoSuggest}
        onAutoSuggest={onAutoSuggest}
        liveRunner={liveRunner}
      />
    </Modal>
  );
}
