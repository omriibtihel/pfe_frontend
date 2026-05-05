/**
 * PredictionReportPanel
 *
 * Streams an LLM-generated patient-readable report from the backend SSE
 * endpoint and renders it section by section. The compliance disclaimer
 * banner is always visible — even mid-stream — so the panel stays
 * compliant if the connection drops.
 *
 * Sprint 5: integrated with the project's i18next setup; download-as-PDF
 * via the dedicated ``predictionReportPdf`` builder.
 */
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Download, FileText, Loader2 } from 'lucide-react';

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

interface ReportState {
  prediction: ReportPrediction | null;
  summary: string;
  key_factors: ReportFactor[];
  context: string;
  limitations: string;
  next_steps: string;
  disclaimer: string;
}

const EMPTY_STATE: ReportState = {
  prediction: null,
  summary: '',
  key_factors: [],
  context: '',
  limitations: '',
  next_steps: '',
  disclaimer: '',
};

interface Props {
  projectId: string;
  modelId: number;
  row: PredictionRow;
  /** Display name shown in the PDF header. Defaults to "Project". */
  projectName?: string;
  /** Display name shown in the PDF header. Defaults to the model_type from backend. */
  modelName?: string;
  /** Optional override; otherwise inferred from i18next current language. */
  lang?: ReportLang;
}

export function PredictionReportPanel({
  projectId,
  modelId,
  row,
  projectName,
  modelName,
  lang: forcedLang,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang: ReportLang = forcedLang ?? (i18n.language?.startsWith('en') ? 'en' : 'fr');

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportState>(EMPTY_STATE);
  const [meta, setMeta] = useState<ReportDoneMeta | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
        score: row.score,
        lime: (row.lime ?? []).map((it) => ({
          feature: it.feature,
          contribution: it.contribution,
          data: it.data,
        })),
        input_data: row.inputData,
        row_index: row.rowIndex,
      },
      lang,
      {
        signal: controller.signal,
        onChunk: (chunk: ReportChunk) => {
          setReport((prev) => {
            switch (chunk.section) {
              case 'prediction':
                return { ...prev, prediction: chunk.content };
              case 'summary':
                return { ...prev, summary: chunk.content };
              case 'key_factors':
                return { ...prev, key_factors: chunk.content };
              case 'context':
                return { ...prev, context: chunk.content };
              case 'limitations':
                return { ...prev, limitations: chunk.content };
              case 'next_steps':
                return { ...prev, next_steps: chunk.content };
              case 'disclaimer':
                return { ...prev, disclaimer: chunk.content };
              default:
                return prev;
            }
          });
        },
        onDone: (m) => {
          setMeta(m);
          setLoading(false);
        },
        onError: (err) => {
          setError(err.message || (t('predictionReport.errors.stream') as string));
          setLoading(false);
        },
      },
    );
  }, [projectId, modelId, row, lang, t]);

  const handleOpen = () => {
    setOpen(true);
    void startGeneration();
  };

  const handleClose = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  const handleDownload = () => {
    downloadPredictionReportPdf({
      prediction: report.prediction,
      summary: report.summary,
      keyFactors: report.key_factors,
      context: report.context,
      limitations: report.limitations,
      nextSteps: report.next_steps,
      disclaimer: report.disclaimer,
      projectName: projectName ?? `Project ${projectId}`,
      modelName: modelName ?? `Model ${modelId}`,
      modelVersion: modelId,
      generatedAt: new Date(),
      lang,
    });
  };

  // Disable PDF until at least the summary section is in.
  const canDownload = !loading && !!report.summary;

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
        <div className="px-6 pb-6 pt-2 space-y-4 overflow-y-auto">
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

          {report.prediction && (
            <Section title={t('predictionReport.sections.prediction') as string}>
              <p className="text-base">
                <strong>{report.prediction.label}</strong>
                {report.prediction.score_pct ? ` — ${report.prediction.score_pct}` : ''}
                <span className="ml-2 text-xs text-muted-foreground">
                  ({t('predictionReport.confidence')}: {report.prediction.confidence_text})
                </span>
              </p>
            </Section>
          )}

          {report.summary && (
            <Section title={t('predictionReport.sections.summary') as string}>
              <p>{report.summary}</p>
            </Section>
          )}

          {report.key_factors.length > 0 && (
            <Section title={t('predictionReport.sections.keyFactors') as string}>
              <ul className="space-y-2">
                {report.key_factors.map((f, i) => (
                  <li key={i} className="rounded border p-2 text-sm">
                    <div className="font-medium">{f.label}</div>
                    <div className="text-muted-foreground">
                      {t('predictionReport.factor.value')}: {f.value}
                      {f.normal_range && (
                        <span className="ml-2">
                          ({t('predictionReport.factor.normalRange')}: {f.normal_range})
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs">{f.explanation}</div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default PredictionReportPanel;
