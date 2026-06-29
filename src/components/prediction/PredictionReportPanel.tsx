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
  Activity,
  AlignLeft,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Check,
  Download,
  FileText,
  Info,
  KeyRound,
  ListChecks,
  Loader2,
  ShieldAlert,
  Target,
  Wand2,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  streamPredictionReport,
  type ReportChange,
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
  /** Whether the task is classification — drives the "what to change" empty note. */
  is_classification: boolean;
  summary: string;
  key_factors: ReportFactor[];
  context: string;
  limitations: string;
  next_steps: string;
  what_to_change: ReportChange[];
  disclaimer: string;
}

const EMPTY_STATE: ReportState = {
  prediction: null,
  risk_level: '',
  threshold_pct: 50,
  is_classification: true,
  summary: '',
  key_factors: [],
  context: '',
  limitations: '',
  next_steps: '',
  what_to_change: [],
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
// ScoreMeter — professional linear score indicator with a threshold marker
// ─────────────────────────────────────────────────────────────────────────────

function ScoreMeter({
  scorePct,
  thresholdPct,
  lang,
}: {
  scorePct: number;
  thresholdPct: number;
  lang: ReportLang;
}) {
  const fill = Math.max(0, Math.min(100, scorePct));
  const threshPos = Math.max(0, Math.min(100, thresholdPct));
  const isConcerning = scorePct > thresholdPct;
  const color = isConcerning ? '#ef4444' : '#16a34a';

  return (
    <div className="w-full shrink-0 rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm sm:w-72">
      {/* Header: label + big score */}
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {lang === 'fr' ? "Score de l'analyse" : 'Analysis score'}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-4xl font-bold leading-none tracking-tight tabular-nums" style={{ color }}>
          {scorePct}
        </span>
        <span className="text-xl font-semibold" style={{ color }}>%</span>
      </div>

      {/* Track + coloured fill + threshold marker */}
      <div className="relative mt-4 h-2.5 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${fill}%`, backgroundColor: color }}
        />
        <div
          className="absolute -top-1 -bottom-1 w-[2px] rounded bg-foreground/70"
          style={{ left: `${threshPos}%` }}
          aria-hidden
        />
      </div>

      {/* Scale labels (0 / threshold / 100) */}
      <div className="relative mt-1.5 h-4 text-[10px] text-muted-foreground">
        <span className="absolute left-0">0%</span>
        <span className="absolute right-0">100%</span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap font-medium text-foreground/70"
          style={{ left: `${threshPos}%` }}
        >
          {lang === 'fr' ? `Alerte ${thresholdPct}%` : `Alert ${thresholdPct}%`}
        </span>
      </div>

      {/* Status pill */}
      <div
        className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          isConcerning
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
        }`}
      >
        {isConcerning ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
        {isConcerning
          ? (lang === 'fr' ? "Au-dessus du niveau d'alerte" : 'Above the alert level')
          : (lang === 'fr' ? "En dessous du niveau d'alerte" : 'Below the alert level')}
      </div>
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
            if (chunk.section === 'chart_data')  return { ...prev, threshold_pct: chunk.content.threshold_pct, is_classification: chunk.content.is_classification };
            if (chunk.section === 'summary')     return { ...prev, summary:     chunk.content };
            if (chunk.section === 'key_factors') return { ...prev, key_factors: chunk.content };
            if (chunk.section === 'context')     return { ...prev, context:     chunk.content };
            if (chunk.section === 'limitations') return { ...prev, limitations: chunk.content };
            if (chunk.section === 'next_steps')  return { ...prev, next_steps:  chunk.content };
            if (chunk.section === 'what_to_change') return { ...prev, what_to_change: chunk.content };
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
      // Actionable LLM sections
      whatToChange:    report.what_to_change,
      isClassification: report.is_classification,
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

          {/* Prediction — hero card */}
          {report.prediction && (
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent p-5 shadow-sm">
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    {t('predictionReport.sections.prediction')}
                  </div>
                  <p className="mt-1.5 text-2xl font-bold leading-tight tracking-tight">
                    {report.prediction.label}
                    {report.prediction.score_pct && (
                      <span className="ml-2 text-lg font-semibold text-primary">
                        {report.prediction.score_pct}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('predictionReport.confidence')}: {report.prediction.confidence_text}
                  </p>
                </div>
                {report.risk_level && <RiskBadge level={report.risk_level} lang={lang} />}
              </div>
            </div>
          )}

          {/* Streaming skeleton — shown until the first narrative section lands */}
          {loading && !report.summary && (
            <div className="space-y-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl border border-border/50 bg-muted/40"
                />
              ))}
            </div>
          )}

          {/* Charts — rendered immediately from row.lime + row.score */}
          {showCharts && (
            <Section title={lang === 'fr' ? 'Vue graphique' : 'Visual overview'} icon={BarChart3} accent="violet">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {showGauge && (
                  <ScoreMeter
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
            <Section title={t('predictionReport.sections.summary') as string} icon={AlignLeft} accent="sky">
              <p>{report.summary}</p>
            </Section>
          )}

          {/* Key factors */}
          {report.key_factors.length > 0 && (
            <Section title={t('predictionReport.sections.keyFactors') as string} icon={KeyRound} accent="amber">
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
            <Section title={t('predictionReport.sections.context') as string} icon={Info} accent="slate">
              <p>{report.context}</p>
            </Section>
          )}

          {report.limitations && (
            <Section title={t('predictionReport.sections.limitations') as string} icon={ShieldAlert} accent="rose">
              <p>{report.limitations}</p>
            </Section>
          )}

          {report.next_steps && (
            <Section title={t('predictionReport.sections.nextSteps') as string} icon={ListChecks} accent="emerald">
              <p>{report.next_steps}</p>
            </Section>
          )}

          {/* What to change — actionable counterfactuals (DiCE-derived) */}
          {report.what_to_change.length > 0 && (
            <Section title={lang === 'fr' ? 'Que faudrait-il changer ?' : 'What would need to change?'} icon={Wand2} accent="violet">
              <p className="mb-2 text-xs text-muted-foreground">
                {lang === 'fr'
                  ? 'Pistes hypothétiques calculées par l\'outil pour rapprocher votre profil de la zone rassurante. Ce ne sont pas des promesses.'
                  : 'Hypothetical paths the tool computed to move your profile toward the reassuring zone. These are not promises.'}
              </p>
              <ul className="space-y-2">
                {report.what_to_change.map((c, i) => (
                  <li key={i} className="rounded-md border bg-card p-3 text-sm shadow-sm">
                    <div className="flex flex-wrap items-baseline gap-2 mb-1">
                      <Target className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="font-semibold">{c.factor}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.current}
                        <ArrowRight className="inline mx-1 h-3 w-3 align-middle" />
                        <span className="font-medium text-foreground">{c.target}</span>
                        <span className="ml-2 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                          {c.magnitude_text}
                        </span>
                      </span>
                    </div>
                    {c.change_text && (
                      <p className="text-xs leading-relaxed text-foreground">{c.change_text}</p>
                    )}
                    {c.why_it_matters && (
                      <p className="text-xs leading-relaxed text-muted-foreground mt-1">
                        {c.why_it_matters}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Explicit note when no actionable change could be computed */}
          {!loading && report.is_classification && report.what_to_change.length === 0 && (
            <Section
              title={lang === 'fr' ? 'Que faudrait-il changer ?' : 'What would need to change?'}
              icon={Wand2}
              accent="violet"
            >
              <p className="text-xs leading-relaxed text-muted-foreground">
                {lang === 'fr'
                  ? "Aucune piste d'ajustement n'a pu être calculée pour ce profil : l'outil n'a pas identifié de changement réaliste qui modifierait le résultat."
                  : 'No adjustment path could be computed for this profile: the tool did not find a realistic change that would alter the result.'}
              </p>
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

type SectionAccent = 'sky' | 'violet' | 'amber' | 'emerald' | 'slate' | 'rose';

const SECTION_TONE: Record<SectionAccent, string> = {
  sky: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  slate: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
};

function Section({
  title,
  icon: Icon,
  accent = 'slate',
  children,
}: {
  title: string;
  icon?: LucideIcon;
  accent?: SectionAccent;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {Icon && (
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${SECTION_TONE[accent]}`}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      </div>
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

export default PredictionReportPanel;
