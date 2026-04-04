import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  LearningCurveData,
  ModelResult,
  PermutationImportanceItem,
  ShapGlobalData,
} from '@/types';
import type { FeatureImportanceChartRow } from './trainingResultsHelpers';

const FI_PALETTE = [
  'hsl(217,91%,60%)',
  'hsl(245,75%,62%)',
  'hsl(265,68%,60%)',
  'hsl(195,78%,52%)',
  'hsl(172,66%,44%)',
  'hsl(145,55%,46%)',
  'hsl(30,90%,55%)',
  'hsl(340,70%,55%)',
];

// ---------------------------------------------------------------------------
// Variables tab — feature importance, permutation importance, SHAP global
// ---------------------------------------------------------------------------

interface ModelCardVariablesTabProps {
  result: ModelResult;
  featureChartData: FeatureImportanceChartRow[];
}

export function ModelCardVariablesTab({ result, featureChartData }: ModelCardVariablesTabProps) {
  return (
    <div className="space-y-4">
      {featureChartData.length > 0 && (
        <section aria-label="Importance des variables">
          <div className="mb-1.5 flex items-center justify-between">
            <p
              className="text-xs font-medium cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
              title="Score calculé par le modèle lui-même (ex. gain d'information pour les arbres, coefficient pour les modèles linéaires). Rapide mais peut être biaisé si les variables sont corrélées."
            >
              Importance des variables
            </p>
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
              Top {featureChartData.length}
            </span>
          </div>
          <div
            className="rounded-lg border border-border/50 bg-muted/20 p-1.5"
            style={{ height: `${Math.min(240, Math.max(140, featureChartData.length * 26 + 32))}px` }}
            role="img"
            aria-label={`Graphique d'importance des ${featureChartData.length} variables principales`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart
                data={featureChartData}
                layout="vertical"
                margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="rgba(128,128,128,0.15)"
                />
                <XAxis type="number" domain={[0, 1]} hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={112}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(100,100,100,0.08)' }}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px', padding: '8px 12px' }}
                  formatter={(_value, _name, item) => {
                    const payload = (
                      item as
                        | { payload?: { rawImportance?: number; displayImportance?: number } }
                        | undefined
                    )?.payload;
                    const raw = Number(payload?.rawImportance);
                    const disp = Number(payload?.displayImportance);
                    if (!Number.isFinite(raw)) return ['—', 'Importance'];
                    const pct = Number.isFinite(disp) ? ` (${(disp * 100).toFixed(1)}%)` : '';
                    const rawLabel =
                      raw >= 10 ? raw.toFixed(1) : raw >= 1 ? raw.toFixed(3) : raw.toFixed(4);
                    return [`${rawLabel}${pct}`, 'Importance'];
                  }}
                  labelFormatter={(_label, payload) =>
                    String(
                      (
                        Array.isArray(payload)
                          ? (payload[0] as { payload?: { feature?: string } } | undefined)
                          : undefined
                      )?.payload?.feature ?? '',
                    )
                  }
                />
                <Bar dataKey="normalizedImportance" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {featureChartData.map((_, idx) => (
                    <Cell key={`fi-cell-${idx}`} fill={FI_PALETTE[idx % FI_PALETTE.length]} />
                  ))}
                  <LabelList
                    dataKey="displayImportance"
                    position="right"
                    formatter={(v: unknown) => {
                      const n = Number(v);
                      return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '';
                    }}
                    style={{ fontSize: '10px', fontWeight: 500 }}
                  />
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {result.permutationImportance &&
        result.permutationImportance.length > 0 &&
        (() => {
          const pi = result.permutationImportance as PermutationImportanceItem[];
          const maxMean = Math.max(...pi.map((d) => Math.abs(d.mean)), 1e-9);
          return (
            <section aria-label="Importance par permutation">
              <div className="mb-1.5 flex items-center justify-between">
                <p
                  className="text-xs font-medium cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
                  title="Mesure la chute de performance quand les valeurs d'une variable sont mélangées aléatoirement sur le test set. Indépendant du type de modèle et fiable même si les variables sont corrélées. Valeur négative = variable inutile ou bruitée."
                >
                  Importance par permutation
                </p>
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  Top {pi.length}
                </span>
              </div>
              <p className="mb-1.5 text-[10px] text-muted-foreground">
                Chute de performance quand la variable est mélangée (test). Négatif = peu utile.
              </p>
              <div
                className="rounded-lg border border-border/50 bg-muted/20 p-1.5"
                style={{ height: `${Math.min(260, Math.max(140, pi.length * 24 + 32))}px` }}
                role="img"
                aria-label={`Graphique d'importance par permutation — ${pi.length} variables`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={pi.map((d) => ({
                      label:
                        d.feature.length > 18 ? `${d.feature.slice(0, 16)}…` : d.feature,
                      feature: d.feature,
                      importance: d.mean,
                      normalizedImportance: d.mean / maxMean,
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="rgba(128,128,128,0.15)"
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={116}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(100,100,100,0.08)' }}
                      contentStyle={{
                        borderRadius: '8px',
                        fontSize: '12px',
                        padding: '8px 12px',
                      }}
                      formatter={(
                        _v: unknown,
                        _n: string,
                        item: { payload?: { importance?: number } },
                      ) => {
                        const v = item?.payload?.importance;
                        if (v == null) return ['—', 'Importance'];
                        return [v.toFixed(4), 'Chute de score'];
                      }}
                      labelFormatter={(_l: unknown, payload: unknown[]) => {
                        const p = (payload?.[0] as { payload?: { feature?: string } })?.payload;
                        return String(p?.feature ?? '');
                      }}
                    />
                    <Bar dataKey="normalizedImportance" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {pi.map((d, idx) => (
                        <Cell
                          key={`pi-cell-${idx}`}
                          fill={
                            d.mean < 0 ? 'hsl(0,70%,55%)' : FI_PALETTE[idx % FI_PALETTE.length]
                          }
                        />
                      ))}
                      <LabelList
                        dataKey="importance"
                        position="right"
                        formatter={(v: unknown) => {
                          const n = Number(v);
                          return Number.isFinite(n) ? n.toFixed(3) : '';
                        }}
                        style={{ fontSize: '10px', fontWeight: 500 }}
                      />
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </section>
          );
        })()}

      {result.shapGlobal &&
        result.shapGlobal.summary.length > 0 &&
        (() => {
          const sg = result.shapGlobal as ShapGlobalData;
          const maxAbs = Math.max(...sg.summary.map((d) => d.mean_abs_shap), 1e-9);
          const explainerLabel: Record<string, string> = {
            tree: 'TreeSHAP',
            linear: 'LinearSHAP',
            kernel: 'KernelSHAP',
          };
          return (
            <section aria-label="SHAP — importance globale">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <p
                    className="text-xs font-medium cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
                    title="Valeurs SHAP (SHapley Additive exPlanations) : contribution moyenne de chaque variable à la prédiction, calculée en valeur absolue. Contrairement aux autres méthodes, SHAP garantit une répartition juste et cohérente de l'impact, même entre variables corrélées."
                  >
                    SHAP — Importance globale
                  </p>
                  <span className="rounded-full border border-violet-400/40 bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                    {explainerLabel[sg.explainer_type] ?? sg.explainer_type}
                  </span>
                </div>
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  Top {sg.summary.length} · n={sg.n_samples}
                </span>
              </div>
              <div
                className="rounded-lg border border-border/50 bg-muted/20 p-1.5"
                style={{ height: `${Math.min(280, Math.max(150, sg.summary.length * 24 + 32))}px` }}
                role="img"
                aria-label={`SHAP global — ${sg.summary.length} variables`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={sg.summary.map((d) => ({
                      label:
                        d.feature.length > 18 ? `${d.feature.slice(0, 16)}…` : d.feature,
                      feature: d.feature,
                      mean_abs_shap: d.mean_abs_shap,
                      mean_shap: d.mean_shap,
                      normalized: d.mean_abs_shap / maxAbs,
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 64, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="rgba(128,128,128,0.15)"
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={116}
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(100,100,100,0.08)' }}
                      contentStyle={{
                        borderRadius: '8px',
                        fontSize: '12px',
                        padding: '8px 12px',
                      }}
                      formatter={(
                        _v: unknown,
                        _n: string,
                        item: { payload?: { mean_abs_shap?: number; mean_shap?: number } },
                      ) => {
                        const abs = item?.payload?.mean_abs_shap;
                        const signed = item?.payload?.mean_shap;
                        if (abs == null) return ['—', 'SHAP'];
                        return [
                          `|SHAP|=${abs.toFixed(4)}  (μ=${signed != null ? signed.toFixed(4) : '—'})`,
                          'Importance',
                        ];
                      }}
                      labelFormatter={(_l: unknown, payload: unknown[]) =>
                        String(
                          (payload?.[0] as { payload?: { feature?: string } })?.payload?.feature ??
                            '',
                        )
                      }
                    />
                    <Bar dataKey="normalized" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {sg.summary.map((d, idx) => (
                        <Cell
                          key={`shap-cell-${idx}`}
                          fill={d.mean_shap < 0 ? 'hsl(217,91%,60%)' : 'hsl(30,90%,55%)'}
                        />
                      ))}
                      <LabelList
                        dataKey="mean_abs_shap"
                        position="right"
                        formatter={(v: unknown) => {
                          const n = Number(v);
                          return Number.isFinite(n) ? n.toFixed(3) : '';
                        }}
                        style={{ fontSize: '10px', fontWeight: 500 }}
                      />
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex justify-center gap-3">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[hsl(30,90%,55%)]" /> Vers le haut
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[hsl(217,91%,60%)]" /> Vers le bas
                </span>
              </div>
            </section>
          );
        })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Courbes tab — diagnostic curves (ROC / PR / Calibration) + learning curves
// ---------------------------------------------------------------------------

interface ModelCardCourbesTabProps {
  result: ModelResult;
}

export function ModelCardCourbesTab({ result }: ModelCardCourbesTabProps) {
  return (
    <div className="space-y-4">
      {result.curves &&
        (result.curves.roc || result.curves.pr || result.curves.calibration) && (
          <section aria-label="Courbes de diagnostic">
            <p
              className="mb-1.5 text-xs font-medium cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
              title="Courbes d'évaluation qui complètent les métriques chiffrées : elles montrent le comportement du modèle sur l'ensemble des seuils de décision possibles, pas seulement au seuil par défaut (0.5)."
            >
              Courbes de diagnostic
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {result.curves.roc && (
                <div>
                  <p
                    className="mb-1 text-center text-[10px] text-muted-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                    title="Courbe ROC (Receiver Operating Characteristic) : trace le taux de vrais positifs (TPR) en fonction du taux de faux positifs (FPR) pour chaque seuil. L'aire sous la courbe (AUC) mesure la capacité de discrimination — 1.0 = parfait, 0.5 = aléatoire."
                  >
                    ROC Curve
                  </p>
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-1.5" style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={result.curves.roc.map(([fpr, tpr]) => ({ fpr, tpr }))}
                        margin={{ top: 4, right: 8, bottom: 16, left: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(128,128,128,0.15)"
                        />
                        <XAxis
                          dataKey="fpr"
                          type="number"
                          domain={[0, 1]}
                          tickCount={5}
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 'FPR',
                            position: 'insideBottom',
                            offset: -4,
                            fontSize: 10,
                          }}
                        />
                        <YAxis
                          type="number"
                          domain={[0, 1]}
                          tickCount={5}
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 'TPR',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 8,
                            fontSize: 10,
                          }}
                        />
                        <Tooltip
                          formatter={(v: number) => v.toFixed(3)}
                          labelFormatter={(v: number) => `FPR: ${v.toFixed(3)}`}
                        />
                        <ReferenceLine
                          stroke="#6b7280"
                          strokeDasharray="4 4"
                          segment={[
                            { x: 0, y: 0 },
                            { x: 1, y: 1 },
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="tpr"
                          stroke="#8b5cf6"
                          dot={false}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {result.curves.pr && (
                <div>
                  <p
                    className="mb-1 text-center text-[10px] text-muted-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                    title="Courbe Précision-Rappel : montre le compromis entre la précision (proportion de vrais positifs parmi les prédictions positives) et le rappel (proportion de vrais positifs détectés). Plus utile que la ROC quand les classes sont très déséquilibrées."
                  >
                    Precision-Recall
                  </p>
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-1.5" style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={result.curves.pr.map(([recall, precision]) => ({
                          recall,
                          precision,
                        }))}
                        margin={{ top: 4, right: 8, bottom: 16, left: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(128,128,128,0.15)"
                        />
                        <XAxis
                          dataKey="recall"
                          type="number"
                          domain={[0, 1]}
                          tickCount={5}
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 'Recall',
                            position: 'insideBottom',
                            offset: -4,
                            fontSize: 10,
                          }}
                        />
                        <YAxis
                          type="number"
                          domain={[0, 1]}
                          tickCount={5}
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 'Precision',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 8,
                            fontSize: 10,
                          }}
                        />
                        <Tooltip
                          formatter={(v: number) => v.toFixed(3)}
                          labelFormatter={(v: number) => `Recall: ${v.toFixed(3)}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="precision"
                          stroke="#06b6d4"
                          dot={false}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {result.curves.calibration && (
                <div>
                  <div className="mb-1 flex items-center justify-center gap-1.5">
                    <p
                      className="text-[10px] text-muted-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
                      title="Courbe de calibration : compare les probabilités prédites par le modèle aux fréquences réelles observées. Un modèle bien calibré suit la diagonale — s'il prédit 70% de probabilité, l'événement doit arriver ~70% du temps."
                    >
                      Calibration
                    </p>
                    <span
                      className="rounded-full border border-emerald-400/50 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                      title="Brier score — mesure la calibration (0 = parfait)"
                    >
                      Brier {result.curves.calibration.brier_score.toFixed(3)}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-1.5" style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={result.curves.calibration.points.map(([mp, fp]) => ({
                          predicted: mp,
                          actual: fp,
                        }))}
                        margin={{ top: 4, right: 8, bottom: 16, left: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(128,128,128,0.15)"
                        />
                        <XAxis
                          dataKey="predicted"
                          type="number"
                          domain={[0, 1]}
                          tickCount={5}
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 'Probabilité prédite',
                            position: 'insideBottom',
                            offset: -4,
                            fontSize: 10,
                          }}
                        />
                        <YAxis
                          type="number"
                          domain={[0, 1]}
                          tickCount={5}
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 'Fraction réelle',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 8,
                            fontSize: 10,
                          }}
                        />
                        <Tooltip
                          formatter={(v: number) => v.toFixed(3)}
                          labelFormatter={(v: number) => `Prédit: ${v.toFixed(3)}`}
                        />
                        <ReferenceLine
                          stroke="#9ca3af"
                          strokeDasharray="4 4"
                          segment={[
                            { x: 0, y: 0 },
                            { x: 1, y: 1 },
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          stroke="#10b981"
                          dot={{ r: 3, fill: '#10b981' }}
                          strokeWidth={2}
                          name="Modèle"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

      {result.learningCurves &&
        (() => {
          const lc = result.learningCurves as LearningCurveData;
          const lcData = lc.train_sizes.map((s, i) => ({
            samples: s,
            train: lc.train_mean[i],
            val: lc.val_mean[i],
          }));
          const scoringLabel =
            lc.scoring === 'r2'
              ? 'R²'
              : lc.scoring.replace('neg_', '-').replace('_', ' ').toUpperCase();
          return (
            <section aria-label="Courbes d'apprentissage">
              <div className="mb-1.5 flex items-center gap-1.5">
                <p
                  className="text-xs font-medium cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
                  title="Montre l'évolution du score en fonction du nombre d'exemples d'entraînement. Si l'écart entre la courbe train et val est grand → surapprentissage (besoin de régularisation). Si les deux courbes plafonnent bas → sous-apprentissage (modèle trop simple ou données insuffisantes)."
                >
                  Courbes d&apos;apprentissage
                </p>
                <span className="text-[10px] text-muted-foreground">({scoringLabel})</span>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-1.5" style={{ height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={lcData}
                    margin={{ top: 4, right: 8, bottom: 16, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                    <XAxis
                      dataKey="samples"
                      tick={{ fontSize: 10 }}
                      label={{
                        value: 'Échantillons',
                        position: 'insideBottom',
                        offset: -4,
                        fontSize: 10,
                      }}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => v.toFixed(2)}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        v?.toFixed(3) ?? '—',
                        name === 'train' ? 'Entraînement' : 'Validation',
                      ]}
                      labelFormatter={(v: number) => `${v} échantillons`}
                    />
                    <Line
                      type="monotone"
                      dataKey="train"
                      stroke="#8b5cf6"
                      dot={false}
                      strokeWidth={2}
                      name="train"
                    />
                    <Line
                      type="monotone"
                      dataKey="val"
                      stroke="#06b6d4"
                      dot={false}
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      name="val"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex justify-center gap-3">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="inline-block h-0.5 w-3 rounded bg-violet-500" /> Entraînement
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="inline-block h-0.5 w-3 rounded bg-cyan-500 opacity-70" style={{ borderTop: '2px dashed' }} /> Validation
                </span>
              </div>
            </section>
          );
        })()}
    </div>
  );
}
