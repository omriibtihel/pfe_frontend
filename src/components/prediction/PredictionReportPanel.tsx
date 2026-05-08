/**
 * PredictionReportPanel
 *
 * Streams an LLM-generated patient-readable report and renders it section by
 * section. Two inline SVG charts are computed directly from `row.lime` and
 * `row.score` (already available as props) — they appear immediately when the
 * modal opens, without waiting for the SSE stream.
 *
 * Charts:
 *   - ScoreGauge   : semi-circle arc showing the score vs the alert threshold
 *   - FactorsChart : horizontal bars, direction from LIME contributions
 *
 * Labels and status badges improve progressively as `key_factors` arrive via SSE.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Download,
  FileText,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  streamPredictionReport,
  type ReportChunk,
  type ReportDoneMeta,
  type ReportFactor,
  type ReportLang,
  type ReportPrediction,
} from '@/services/predictionReportService';
import { downloadPredictionReportPdf } from '@/services/predictionReportPdf';
import type { PredictionRow } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

interface ReportState {
  prediction: ReportPrediction | null;
  risk_level: string;
  /** threshold_pct from the backend when available — used to refine the gauge. */
  threshold_pct: number;
  summary: string;
  key_factors: ReportFactor[];
  context: string;
  limitations: string;
  next_steps: string;
  disclaimer: string;
}

const EMPTY_STATE: ReportState = {
  prediction: null,
  risk_level: '',
  threshold_pct: 50,
  summary: '',
  key_factors: [],
  context: '',
  limitations: '',
  next_steps: '',
  disclaimer: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  modelId: number;
  row: PredictionRow;
  projectName?: string;
  modelName?: string;
  lang?: ReportLang;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk badge
// ─────────────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';

function RiskBadge({ level, lang }: { level: string; lang: ReportLang }) {
  const cfg: Record<RiskLevel, { label: string; className: string }> = {
    low: {
      label: lang === 'fr' ? 'Risque faible' : 'Low risk',
      className:
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
        'bg-green-100 text-green-800 border border-green-300 ' +
        'dark:bg-green-900/40 dark:text-green-300 dark:border-green-700',
    },
    medium: {
      label: lang === 'fr' ? 'Risque modéré' : 'Moderate risk',
      className:
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
        'bg-amber-100 text-amber-800 border border-amber-300 ' +
        'dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
    },
    high: {
      label: lang === 'fr' ? 'Risque élevé' : 'High risk',
      className:
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
        'bg-red-100 text-red-800 border border-red-300 ' +
        'dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
    },
    unknown: { label: '', className: '' },
  };
  const normalized: RiskLevel = ['low', 'medium', 'high'].includes(level)
    ? (level as RiskLevel)
    : 'unknown';
  const { label, className } = cfg[normalized];
  if (!label) return null;
  return <span className={className}>{label}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Direction icon
// ─────────────────────────────────────────────────────────────────────────────

function DirectionIcon({ direction }: { direction: string }) {
  const d = direction?.toLowerCase() ?? '';
  if (d === 'increase' || d === 'augmente')
    return <ArrowUp className="inline h-3.5 w-3.5 text-red-500 shrink-0" />;
  if (d === 'decrease' || d === 'diminue')
    return <ArrowDown className="inline h-3.5 w-3.5 text-blue-500 shrink-0" />;
  return <ArrowRight className="inline h-3.5 w-3.5 text-gray-400 shrink-0" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge per factor
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status, lang }: { status?: string; lang: ReportLang }) {
  if (!status || status === 'unknown') return null;
  const cfg: Record<string, { label: string; cls: string }> = {
    abnormal_high: {
      label: lang === 'fr' ? 'Au-dessus de la normale' : 'Above normal',
      cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    },
    abnormal_low: {
      label: lang === 'fr' ? 'En-dessous de la normale' : 'Below normal',
      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    },
    normal: {
      label: lang === 'fr' ? 'Dans la normale' : 'Within normal range',
      cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    },
  };
  const entry = cfg[status];
  if (!entry) return null;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScoreGauge — semi-circle SVG
//
// Geometry: centre (GCX, GCY), radius GR.
// 0 % → left point (angle = −π), 100 % → right point (angle = 0).
// Every arc spans [0°, 180°], so largeArc is always 0.
// ─────────────────────────────────────────────────────────────────────────────

const GCX = 120;
const GCY = 128;
const GR  = 98;

function pctToArcPoint(pct: number) {
  const a = (pct / 100) * Math.PI - Math.PI; // [−π, 0]
  return {
    x: GCX + GR * Math.cos(a),
    y: GCY + GR * Math.sin(a),
  };
}

function ScoreGauge({
  scorePct,
  thresholdPct,
  lang,
}: {
  scorePct: number;
  thresholdPct: number;
  lang: ReportLang;
}) {
  const f = (n: number) => n.toFixed(1);

  const start  = pctToArcPoint(0);
  const end    = pctToArcPoint(100);
  const score  = pctToArcPoint(scorePct);
  const thresh = pctToArcPoint(thresholdPct);
  const threshAngle = (thresholdPct / 100) * Math.PI - Math.PI;

  // largeArc = 0 always: every arc covers at most 180° of the semi-circle.
  const isConcerning = scorePct > thresholdPct;
  const arcColor     = isConcerning ? '#ef4444' : '#16a34a';

  const threshLabelAnchor = thresholdPct < 50 ? 'end' : 'start';
  const threshLabelDx     = thresholdPct < 50 ? -8 : 8;

  return (
    <div className="flex flex-col items-center shrink-0">
      <svg
        viewBox="0 0 240 145"
        width="240"
        height="145"
        aria-label={lang === 'fr' ? `Jauge : ${scorePct}%` : `Gauge: ${scorePct}%`}
      >
        {/* Grey background arc */}
        <path
          d={`M ${f(start.x)} ${f(start.y)} A ${GR} ${GR} 0 0 1 ${f(end.x)} ${f(end.y)}`}
          fill="none" stroke="#e5e7eb" strokeWidth={22} strokeLinecap="round"
        />

        {/* Coloured score arc (largeArc always 0 — see comment above) */}
        {scorePct > 0 && scorePct < 100 && (
          <path
            d={`M ${f(start.x)} ${f(start.y)} A ${GR} ${GR} 0 0 1 ${f(score.x)} ${f(score.y)}`}
            fill="none" stroke={arcColor} strokeWidth={22} strokeLinecap="round"
          />
        )}
        {scorePct >= 100 && (
          <path
            d={`M ${f(start.x)} ${f(start.y)} A ${GR} ${GR} 0 0 1 ${f(end.x)} ${f(end.y)}`}
            fill="none" stroke={arcColor} strokeWidth={22} strokeLinecap="round"
          />
        )}

        {/* Threshold tick */}
        <line
          x1={f(GCX + (GR - 14) * Math.cos(threshAngle))}
          y1={f(GCY + (GR - 14) * Math.sin(threshAngle))}
          x2={f(GCX + (GR + 14) * Math.cos(threshAngle))}
          y2={f(GCY + (GR + 14) * Math.sin(threshAngle))}
          stroke="#4b5563" strokeWidth={3} strokeLinecap="round"
        />

        {/* Threshold label */}
        <text
          x={f(thresh.x + threshLabelDx)}
          y={f(thresh.y - 10)}
          textAnchor={threshLabelAnchor}
          fontSize={9} fill="#4b5563"
          fontFamily="system-ui, sans-serif"
        >
          {lang === 'fr' ? `Alerte ${thresholdPct}%` : `Alert ${thresholdPct}%`}
        </text>

        {/* Score value */}
        <text
          x={GCX} y={GCY - 34}
          textAnchor="middle"
          fontSize={34} fontWeight="bold" fill={arcColor}
          fontFamily="system-ui, sans-serif"
        >
          {scorePct}%
        </text>

        {/* Subtitle */}
        <text
          x={GCX} y={GCY - 12}
          textAnchor="middle"
          fontSize={10} fill="#6b7280"
          fontFamily="system-ui, sans-serif"
        >
          {lang === 'fr' ? "Score de l'analyse" : 'Analysis score'}
        </text>

        {/* 0 % / 100 % labels */}
        <text x={f(start.x - 2)} y={f(start.y + 14)} textAnchor="middle" fontSize={9} fill="#9ca3af" fontFamily="system-ui, sans-serif">0%</text>
        <text x={f(end.x + 2)}   y={f(end.y + 14)}   textAnchor="middle" fontSize={9} fill="#9ca3af" fontFamily="system-ui, sans-serif">100%</text>
      </svg>

      <p className="text-[11px] text-center text-muted-foreground -mt-1">
        {isConcerning
          ? (lang === 'fr' ? '⚠ Au-dessus du niveau d\'alerte' : '⚠ Above the alert level')
          : (lang === 'fr' ? '✓ En dessous du niveau d\'alerte' : '✓ Below the alert level')}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FactorsChart — horizontal bar chart
// ─────────────────────────────────────────────────────────────────────────────

interface BarFactor {
  label: string;
  value: string;
  direction: string;
  weight: number;   // [0, 1]
  status: string;
  normal_range: string | null;
}

const LABEL_W  = 138;
const BAR_HALF = 88;
const ROW_H    = 44;
const HEADER_H = 44;
const CHART_W  = LABEL_W + BAR_HALF * 2 + 80;

function FactorsChart({ factors, lang }: { factors: BarFactor[]; lang: ReportLang }) {
  if (factors.length === 0) return null;
  const cx     = LABEL_W + BAR_HALF;
  const chartH = HEADER_H + factors.length * ROW_H + 12;

  return (
    <div className="flex-1 min-w-0">
      <svg
        viewBox={`0 0 ${CHART_W} ${chartH}`}
        width="100%"
        style={{ maxWidth: CHART_W }}
        aria-label={lang === 'fr' ? 'Influence des facteurs' : 'Factor influence chart'}
      >
        {/* Title */}
        <text x={cx} y={18} textAnchor="middle" fontSize={11} fontWeight="600" fill="#374151" fontFamily="system-ui, sans-serif">
          {lang === 'fr' ? 'Influence des facteurs' : 'Factor influence'}
        </text>

        {/* Legend */}
        <text x={cx - 8} y={34} textAnchor="end"   fontSize={9} fill="#3b82f6" fontFamily="system-ui, sans-serif">
          {lang === 'fr' ? '← Rassurant' : '← Reassuring'}
        </text>
        <text x={cx + 8} y={34} textAnchor="start" fontSize={9} fill="#ef4444" fontFamily="system-ui, sans-serif">
          {lang === 'fr' ? 'Préoccupant →' : 'Concerning →'}
        </text>

        {/* Centre axis */}
        <line x1={cx} y1={HEADER_H - 4} x2={cx} y2={chartH - 8}
          stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 3" />

        {factors.map((f, i) => {
          const rowY   = HEADER_H + i * ROW_H;
          const midY   = rowY + ROW_H / 2;
          const barLen = Math.max(Math.round(f.weight * BAR_HALF * 0.92), f.weight > 0 ? 4 : 0);

          const isConcerning = f.direction === 'increase';
          const isNeutral    = f.direction === 'neutral';
          const barColor = isNeutral ? '#9ca3af' : isConcerning ? '#ef4444' : '#3b82f6';
          const barX     = isConcerning ? cx : cx - barLen;

          const MAX_LBL = 20;
          const label   = f.label.length > MAX_LBL ? f.label.slice(0, MAX_LBL - 1) + '…' : f.label;

          return (
            <g key={i}>
              {i % 2 === 0 && (
                <rect x={0} y={rowY} width={CHART_W} height={ROW_H} fill="#f9fafb" rx={3} />
              )}
              {/* Label */}
              <text x={LABEL_W - 8} y={midY + 4} textAnchor="end" fontSize={10} fill="#374151" fontFamily="system-ui, sans-serif">
                {label}
              </text>
              {/* Bar */}
              {barLen > 0 && (
                <rect x={barX} y={midY - 11} width={barLen} height={22}
                  fill={barColor} rx={4} opacity={0.85} />
              )}
              {/* Value */}
              <text x={cx + BAR_HALF + 6} y={midY + 4} textAnchor="start" fontSize={9} fill="#6b7280" fontFamily="system-ui, sans-serif">
                {f.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PredictionReportPanel({
  projectId,
  modelId,
  row,
  projectName,
  modelName,
  lang: forcedLang,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang: ReportLang =
    forcedLang ?? (i18n.language?.startsWith('en') ? 'en' : 'fr');

  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [report, setReport]   = useState<ReportState>(EMPTY_STATE);
  const [meta, setMeta]       = useState<ReportDoneMeta | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Chart data: computed from LIME contributions (available immediately) ──
  // Sorted lime items (same order the backend uses for key_factors).
  const sortedLime = useMemo(() => {
    return [...(row.lime ?? [])]
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 8);
  }, [row.lime]);

  // Bar factors: LIME weights + labels from key_factors (when loaded).
  const barFactors = useMemo((): BarFactor[] => {
    if (sortedLime.length === 0) return [];
    const maxAbs = Math.max(...sortedLime.map(l => Math.abs(l.contribution)), 1e-9);
    return sortedLime.map((lime, i) => {
      const kf = report.key_factors[i] as ReportFactor | undefined;
      const cleanName = lime.feature.replace(/^(num__|cat__|remainder__)/, '');
      return {
        label:       kf?.label      ?? cleanName,
        value:       kf?.value      ?? (lime.data != null ? String(lime.data) : '—'),
        direction:   lime.contribution > 0 ? 'increase' : lime.contribution < 0 ? 'decrease' : 'neutral',
        weight:      Math.abs(lime.contribution) / maxAbs,
        status:      kf?.status     ?? 'unknown',
        normal_range: kf?.normal_range ?? null,
      };
    });
  }, [sortedLime, report.key_factors]);

  const scorePct    = row.score != null ? Math.round(row.score * 100) : null;
  const thresholdPct = report.threshold_pct; // 50 by default, updated via SSE chart_data

  const showGauge  = scorePct !== null;
  const showBars   = barFactors.length > 0;
  const showCharts = showGauge || showBars;

  // ── SSE streaming ─────────────────────────────────────────────────────────

  const startGeneration = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setReport(EMPTY_STATE);
    setMeta(null);
    setError(null);
    setLoading(true);

    await streamPredictionReport(
      projectId,
      modelId,
      {
        prediction: row.prediction,
        score:      row.score,
        lime: (row.lime ?? []).map(it => ({
          feature:      it.feature,
          contribution: it.contribution,
          data:         it.data,
        })),
        input_data: row.inputData,
        row_index:  row.rowIndex,
      },
      lang,
      {
        signal:  controller.signal,
        onChunk: (chunk: ReportChunk) => {
          setReport(prev => {
            if (chunk.section === 'prediction')  return { ...prev, prediction:  chunk.content };
            if (chunk.section === 'risk_level')  return { ...prev, risk_level:  chunk.content };
            if (chunk.section === 'chart_data')  return { ...prev, threshold_pct: chunk.content.threshold_pct };
            if (chunk.section === 'summary')     return { ...prev, summary:     chunk.content };
            if (chunk.section === 'key_factors') return { ...prev, key_factors: chunk.content };
            if (chunk.section === 'context')     return { ...prev, context:     chunk.content };
            if (chunk.section === 'limitations') return { ...prev, limitations: chunk.content };
            if (chunk.section === 'next_steps')  return { ...prev, next_steps:  chunk.content };
            if (chunk.section === 'disclaimer')  return { ...prev, disclaimer:  chunk.content };
            return prev;
          });
        },
        onDone:  m => { setMeta(m); setLoading(false); },
        onError: err => {
          setError(err.message || (t('predictionReport.errors.stream') as string));
          setLoading(false);
        },
      },
    );
  }, [projectId, modelId, row, lang, t]);

  const handleOpen = () => { setOpen(true); void startGeneration(); };
  const handleClose = () => { abortRef.current?.abort(); setOpen(false); };

  const handleDownload = () => {
    downloadPredictionReportPdf({
      prediction:   report.prediction,
      summary:      report.summary,
      keyFactors:   report.key_factors,
      context:      report.context,
      limitations:  report.limitations,
      nextSteps:    report.next_steps,
      disclaimer:   report.disclaimer,
      projectName:  projectName ?? `Project ${projectId}`,
      modelName:    modelName   ?? `Model ${modelId}`,
      modelVersion: modelId,
      generatedAt:  new Date(),
      lang,
      // Charts — same data as the modal
      scorePct:     scorePct ?? undefined,
      thresholdPct: thresholdPct,
      chartFactors: barFactors.map(f => ({
        label:     f.label,
        value:     f.value,
        direction: f.direction,
        weight:    f.weight,
      })),
    });
  };

  const canDownload = !loading && !!report.summary;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        <FileText className="mr-2 h-4 w-4" />
        {t('predictionReport.button')}
      </Button>

      <Modal
        isOpen={open}
        onClose={handleClose}
        title={t('predictionReport.title')}
        size="2xl"
        footer={
          <Button onClick={handleDownload} disabled={!canDownload} size="sm">
            <Download className="mr-2 h-4 w-4" />
            {t('predictionReport.download')}
          </Button>
        }
      >
        <div className="px-6 pb-6 pt-2 space-y-5 overflow-y-auto">

          {/* Compliance banner */}
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t('predictionReport.disclaimerBanner')}</span>
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              {error}
            </div>
          )}

          {/* Prediction + risk badge */}
          {report.prediction && (
            <Section title={t('predictionReport.sections.prediction') as string}>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-base font-semibold">
                  {report.prediction.label}
                  {report.prediction.score_pct ? ` — ${report.prediction.score_pct}` : ''}
                </p>
                {report.risk_level && (
                  <RiskBadge level={report.risk_level} lang={lang} />
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('predictionReport.confidence')}: {report.prediction.confidence_text}
              </p>
            </Section>
          )}

          {/* Charts — rendered immediately from row.lime + row.score */}
          {showCharts && (
            <Section title={lang === 'fr' ? 'Vue graphique' : 'Visual overview'}>
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {showGauge && (
                  <ScoreGauge
                    scorePct={scorePct!}
                    thresholdPct={thresholdPct}
                    lang={lang}
                  />
                )}
                {showBars && (
                  <FactorsChart factors={barFactors} lang={lang} />
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {lang === 'fr'
                  ? 'Barres : rouge = facteur orientant vers un résultat préoccupant · bleu = facteur rassurant.'
                  : 'Bars: red = factor pulling toward a concerning result · blue = reassuring factor.'}
              </p>
            </Section>
          )}

          {/* Summary */}
          {report.summary && (
            <Section title={t('predictionReport.sections.summary') as string}>
              <p>{report.summary}</p>
            </Section>
          )}

          {/* Key factors */}
          {report.key_factors.length > 0 && (
            <Section title={t('predictionReport.sections.keyFactors') as string}>
              <ul className="space-y-2">
                {report.key_factors.map((f, i) => (
                  <li key={i} className="rounded-md border bg-card p-3 text-sm shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold">{f.label}</span>
                      <DirectionIcon direction={f.direction} />
                      <StatusBadge status={f.status} lang={lang} />
                    </div>
                    <div className="text-xs text-muted-foreground mb-1.5">
                      <span className="font-medium text-foreground">{f.value}</span>
                      {f.normal_range && (
                        <span className="ml-2">
                          ({t('predictionReport.factor.normalRange')}: {f.normal_range})
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{f.explanation}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {report.context && (
            <Section title={t('predictionReport.sections.context') as string}>
              <p>{report.context}</p>
            </Section>
          )}

          {report.limitations && (
            <Section title={t('predictionReport.sections.limitations') as string}>
              <p>{report.limitations}</p>
            </Section>
          )}

          {report.next_steps && (
            <Section title={t('predictionReport.sections.nextSteps') as string}>
              <p>{report.next_steps}</p>
            </Section>
          )}

          {report.disclaimer && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              {report.disclaimer}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('predictionReport.generating')}
            </div>
          )}

          {meta && (
            <div className="text-[10px] text-muted-foreground">
              {meta.provider} · {meta.latency_ms} ms · {meta.report_id}
              {meta.cached ? ` · ${t('predictionReport.cached')}` : ''}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default PredictionReportPanel;
