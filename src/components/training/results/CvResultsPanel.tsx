import { Layers, Target } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { CvFoldResult, CvMetricsSummary } from '@/types';

const METRIC_TOOLTIPS: Record<string, string> = {
  roc_auc: 'Aire sous la courbe ROC. Mesure la capacité à distinguer les classes (1 = parfait, 0.5 = aléatoire).',
  pr_auc: 'Aire sous la courbe Précision-Rappel. Plus fiable que la ROC sur des données très déséquilibrées.',
  npv: 'Valeur Prédictive Négative. Parmi les cas prédits négatifs, proportion qui sont réellement négatifs.',
  specificity: 'Taux de vrais négatifs (TNR). Proportion de cas négatifs correctement identifiés comme tels.',
  accuracy: 'Proportion globale de prédictions correctes sur le jeu de validation.',
  f1: 'Moyenne harmonique de la précision et du rappel. Équilibre les deux.',
  precision: 'Parmi les cas prédits positifs, proportion qui sont réellement positifs.',
  recall: 'Parmi tous les cas positifs, proportion correctement détectée (sensibilité).',
};

// eslint-disable-next-line react-refresh/only-export-components
export function fmtMetric(v: number | undefined | null): string {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Math.abs(Number(v)) <= 1.5 ? `${(Number(v) * 100).toFixed(1)}%` : Number(v).toFixed(4);
}

function flattenMetrics(m: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  const SKIP = new Set(['warnings', 'meta', 'confusion_matrix', 'per_class', 'averaged', 'binary', 'global', 'legacy_flat']);
  const lf = m.legacy_flat as Record<string, unknown> | undefined;
  const gl = m.global as Record<string, unknown> | undefined;
  if (lf) Object.entries(lf).forEach(([k, v]) => { if (typeof v === 'number' && !Number.isNaN(v)) out[k] = v; });
  if (gl) Object.entries(gl).forEach(([k, v]) => { if (typeof v === 'number' && !Number.isNaN(v) && !(k in out)) out[k] = v; });
  Object.entries(m).forEach(([k, v]) => {
    if (!SKIP.has(k) && typeof v === 'number' && !Number.isNaN(v) && !(k in out)) out[k] = v;
  });
  return out;
}

export interface CvResultsPanelProps {
  cvSummary: CvMetricsSummary;
  cvFoldResults: CvFoldResult[];
  kFolds?: number;
  hasHoldoutTest?: boolean;
  cvTestMetrics?: Record<string, unknown> | null;
  cvMeanMetrics?: Record<string, number> | null;
}

export function CvResultsPanel({
  cvSummary,
  cvFoldResults,
  kFolds,
  hasHoldoutTest,
  cvTestMetrics,
}: CvResultsPanelProps) {
  const meanEntries = Object.entries(cvSummary.mean ?? {}).filter(([k]) => k !== 'training_time_sec');
  const successFolds = cvFoldResults.filter((f) => f.status === 'ok');
  const failedFolds = cvFoldResults.filter((f) => f.status !== 'ok');
  const holdoutFlat: Record<string, number> = hasHoldoutTest && cvTestMetrics
    ? flattenMetrics(cvTestMetrics as Record<string, unknown>)
    : {};

  const topMetricKeys = [...meanEntries]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([k]) => k);

  // Toutes les clés de métriques CV (sans training_time)
  const metricKeys = meanEntries.map(([k]) => k);

  return (
    <div className="space-y-3" role="region" aria-label="Résultats de validation croisée">
      {/* En-tête compact */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Layers className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
        <span className="text-xs font-medium">
          Validation croisée — {kFolds ?? cvFoldResults.length} folds
        </span>
        <Badge variant="default" className="text-[10px] px-1.5 py-0">CV</Badge>
        {hasHoldoutTest && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
            <Target className="h-2.5 w-2.5" aria-hidden="true" />
            Holdout séparé
          </Badge>
        )}
        {failedFolds.length > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            {failedFolds.length} fold{failedFolds.length > 1 ? 's' : ''} échoué{failedFolds.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Tableau transposé : stats en lignes, top métriques en colonnes */}
      {topMetricKeys.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-xs" aria-label="Statistiques CV par métrique">
            <thead className="bg-muted/60">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground w-20 shrink-0">
                  Stat
                </th>
                {topMetricKeys.map((k) => (
                  <th
                    key={k}
                    scope="col"
                    className={`px-3 py-2 text-center font-medium ${METRIC_TOOLTIPS[k] ? 'cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2' : ''}`}
                    title={METRIC_TOOLTIPS[k]}
                  >
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Ligne Moyenne */}
              <tr className="border-t border-border/60 bg-background">
                <td
                  className="px-3 py-2 font-medium text-muted-foreground cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
                  title="Moyenne des scores obtenus sur chaque fold de validation. C'est l'estimation principale de la performance du modèle sur des données non vues."
                >
                  Moy. CV
                </td>
                {topMetricKeys.map((k) => (
                  <td key={k} className="px-3 py-2 text-center font-semibold text-primary">
                    {fmtMetric(cvSummary.mean?.[k])}
                  </td>
                ))}
              </tr>
              {/* Ligne Écart-type */}
              <tr className="border-t border-border/50">
                <td
                  className="px-3 py-2 font-medium text-muted-foreground cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
                  title="Écart-type entre les folds. Une valeur faible indique que le modèle est stable et que la performance ne varie pas beaucoup d'un fold à l'autre."
                >
                  ±σ
                </td>
                {topMetricKeys.map((k) => (
                  <td key={k} className="px-3 py-2 text-center text-muted-foreground">
                    {fmtMetric(cvSummary.std?.[k])}
                  </td>
                ))}
              </tr>
              {/* Ligne Étendue Min–Max combinée */}
              <tr className="border-t border-border/50">
                <td
                  className="px-3 py-2 font-medium text-muted-foreground cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
                  title="Score minimum et maximum observés parmi tous les folds. Un écart important (Min ↔ Max) signale une instabilité : certains sous-ensembles de données pénalisent plus le modèle que d'autres."
                >
                  Étendue
                </td>
                {topMetricKeys.map((k) => {
                  const mn = cvSummary.min?.[k];
                  const mx = cvSummary.max?.[k];
                  return (
                    <td key={k} className="px-3 py-2 text-center text-muted-foreground">
                      {mn != null && mx != null
                        ? `${fmtMetric(mn)}–${fmtMetric(mx)}`
                        : '—'}
                    </td>
                  );
                })}
              </tr>
              {/* Ligne Holdout (si applicable) */}
              {hasHoldoutTest && (
                <tr className="border-t border-border/60 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <td
                    className="px-3 py-2 font-medium text-emerald-700 dark:text-emerald-400 cursor-help underline decoration-dotted decoration-emerald-600/50 underline-offset-2"
                    title="Score mesuré sur le jeu de test holdout, totalement isolé pendant l'entraînement et la validation croisée. C'est l'évaluation finale la plus fiable de la capacité du modèle à généraliser."
                  >
                    Holdout
                  </td>
                  {topMetricKeys.map((k) => (
                    <td key={k} className="px-3 py-2 text-center font-semibold text-emerald-700 dark:text-emerald-400">
                      {fmtMetric(holdoutFlat[k])}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Note si des métriques supplémentaires existent */}
      {metricKeys.length > topMetricKeys.length && (
        <p className="text-[10px] text-muted-foreground">
          +&nbsp;{metricKeys.length - topMetricKeys.length} autre{metricKeys.length - topMetricKeys.length > 1 ? 's métriques' : ' métrique'} visible{metricKeys.length - topMetricKeys.length > 1 ? 's' : ''} dans les détails par fold.
        </p>
      )}

      {/* Détails par fold — collapsible */}
      {successFolds.length > 0 && topMetricKeys.length > 0 && (
        <details className="group">
          <summary className="list-none cursor-pointer select-none text-[10px] text-muted-foreground transition-colors hover:text-foreground flex items-center gap-1">
            <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">›</span>
            Détails par fold ({successFolds.length} folds réussis)
          </summary>
          <div className="mt-1.5 overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-xs" aria-label="Résultats par fold">
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">Fold</th>
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">Train</th>
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">Val</th>
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">Balancing</th>
                  {topMetricKeys.map((k) => (
                    <th
                      key={k}
                      scope="col"
                      className={`px-2 py-1.5 text-left font-medium ${METRIC_TOOLTIPS[k] ? 'cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2' : ''}`}
                      title={METRIC_TOOLTIPS[k]}
                    >
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cvFoldResults.map((fr) => {
                  const flat: Record<string, number | null | unknown> = {};
                  if (fr.metrics && typeof fr.metrics === 'object') {
                    const m = fr.metrics as Record<string, unknown>;
                    const lf = m.legacy_flat as Record<string, unknown> | undefined;
                    const gl = m.global as Record<string, unknown> | undefined;
                    if (lf) Object.assign(flat, lf);
                    if (gl) Object.entries(gl).forEach(([k, v]) => { if (!(k in flat)) flat[k] = v; });
                    Object.entries(m).forEach(([k, v]) => {
                      if (!['legacy_flat', 'global', 'binary', 'averaged', 'per_class', 'confusion_matrix', 'warnings', 'meta'].includes(k)) {
                        if (!(k in flat)) flat[k] = v;
                      }
                    });
                  }
                  return (
                    <tr
                      key={fr.fold}
                      className={`border-t border-border/60 ${fr.status !== 'ok' ? 'bg-destructive/10' : ''}`}
                    >
                      <td className="px-2 py-1.5 font-medium">{fr.fold}</td>
                      <td className="px-2 py-1.5">{fr.train_size ?? '—'}</td>
                      <td className="px-2 py-1.5">{fr.val_size ?? '—'}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {fr.status !== 'ok'
                          ? <span className="text-destructive">{fr.error ?? 'Erreur'}</span>
                          : fr.balancing_strategy ?? 'none'}
                      </td>
                      {topMetricKeys.map((k) => (
                        <td key={k} className="px-2 py-1.5">
                          {fr.status === 'ok' ? fmtMetric(flat[k] as number | null) : '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <p className="text-[10px] italic text-muted-foreground">
        {hasHoldoutTest
          ? 'Refit sur données hors-holdout. Score holdout = évaluation finale indépendante.'
          : 'Refit final sur toutes les données. Métriques CV = estimation de généralisation.'}
      </p>
    </div>
  );
}
