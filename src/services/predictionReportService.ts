/**
 * predictionReportService.ts
 *
 * Streams a generated prediction report from the backend SSE endpoint.
 * Cannot use EventSource because the request is a POST with a JSON body —
 * we read the response stream manually with fetch + ReadableStream.
 *
 * Backend contract (see app/api/routes/reporting.py):
 *   POST /api/projects/{projectId}/training/predictions/models/{modelId}/report/stream?lang=fr
 *   Body: { prediction, score, lime[], input_data, row_index }
 *   Response: text/event-stream with chunk events then a final done event.
 */

const TOKEN_KEY = 'auth_token';
const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://127.0.0.1:8000/api';

// ── Public types ──────────────────────────────────────────────────────────────

export type ReportLang = 'fr' | 'en';

export interface ReportLimeItemIn {
  feature: string;
  contribution: number;
  data?: number | string | null;
}

export interface ReportRequestBody {
  prediction: string | number;
  score: number | null;
  lime: ReportLimeItemIn[];
  input_data: Record<string, unknown>;
  row_index: number;
}

export interface ReportFactor {
  label: string;
  value: string;
  direction: string;
  explanation: string;
  normal_range?: string | null;
  /** Server-derived from glossary normal_range. Never trust LLM for this. */
  status?: 'abnormal_high' | 'abnormal_low' | 'normal' | 'unknown';
}

export interface ChartFactor {
  label: string;
  value: string;
  direction: string;
  /** Normalised absolute weight in [0, 1]. */
  weight: number;
  status: string;
  normal_range: string | null;
}

export interface ChartData {
  /** Prediction score in percent (0–100), null for regression. */
  score_pct: number | null;
  /** Alert threshold in percent (default 50). */
  threshold_pct: number;
  is_classification: boolean;
  factors: ChartFactor[];
}

export interface ReportPrediction {
  label: string;
  confidence_text: string;
  score_pct: string | null;
}

export interface ReportChange {
  factor: string;
  current: string;
  target: string;
  /** "increase" | "decrease" — server-derived, not LLM-trusted. */
  direction: string;
  /** Pre-formatted human magnitude (e.g. "−24 mg/dL"). */
  magnitude_text: string;
  normal_range: string | null;
  /** LLM prose: "lower fasting glucose by …". */
  change_text: string;
  /** LLM prose: 1 sentence linking the change to the result. */
  why_it_matters: string;
}

export type ReportChunk =
  | { section: 'summary'; content: string }
  | { section: 'prediction'; content: ReportPrediction }
  | { section: 'risk_level'; content: string }
  | { section: 'chart_data'; content: ChartData }
  | { section: 'key_factors'; content: ReportFactor[] }
  | { section: 'context'; content: string }
  | { section: 'limitations'; content: string }
  | { section: 'next_steps'; content: string }
  | { section: 'what_to_change'; content: ReportChange[] }
  | { section: 'disclaimer'; content: string };

export interface ReportDoneMeta {
  report_id: string;
  provider: string;
  latency_ms: number;
  lang: ReportLang;
  /** Sprint 4 — set when the report was served from the DB cache. */
  cached?: boolean;
  /** Sprint 4 — last failure observed before the winning provider, if any. */
  fallback_reason?: string | null;
  retries?: number;
}

export interface StreamHandlers {
  onChunk: (chunk: ReportChunk) => void;
  onDone: (meta: ReportDoneMeta) => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

// ── SSE parser ────────────────────────────────────────────────────────────────

interface SSEEvent {
  event: string;
  data: string;
}

/** Splits an incoming buffer into completed SSE messages plus any leftover. */
function parseSSEBuffer(buffer: string): { events: SSEEvent[]; rest: string } {
  const events: SSEEvent[] = [];
  // SSE messages are separated by a blank line. \r\n\r\n or \n\n both occur.
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? '';
  for (const block of parts) {
    if (!block.trim()) continue;
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(':')) continue; // heartbeat / comment
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length > 0) events.push({ event: eventName, data: dataLines.join('\n') });
  }
  return { events, rest };
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function streamPredictionReport(
  projectId: string,
  modelId: number,
  body: ReportRequestBody,
  lang: ReportLang,
  handlers: StreamHandlers,
): Promise<void> {
  const url = `${API_BASE_URL}/projects/${projectId}/training/predictions/models/${modelId}/report/stream?lang=${encodeURIComponent(lang)}`;
  const token = localStorage.getItem(TOKEN_KEY);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: handlers.signal,
    });
  } catch (err) {
    handlers.onError(err instanceof Error ? err : new Error('Network error'));
    return;
  }

  if (!response.ok || !response.body) {
    handlers.onError(new Error(`Report request failed (HTTP ${response.status})`));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSSEBuffer(buffer);
      buffer = rest;
      for (const evt of events) {
        if (evt.event === 'chunk') {
          try {
            handlers.onChunk(JSON.parse(evt.data) as ReportChunk);
          } catch {
            // Malformed chunk — skip rather than abort the stream.
          }
        } else if (evt.event === 'done') {
          try {
            handlers.onDone(JSON.parse(evt.data) as ReportDoneMeta);
          } catch {
            handlers.onError(new Error('Malformed done event'));
          }
        }
      }
    }
  } catch (err) {
    handlers.onError(err instanceof Error ? err : new Error('Stream error'));
  }
}
