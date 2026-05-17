// src/demo/demoAdapter.ts
//
// Axios request interceptor that short-circuits API calls when demo mode is on.
//
// Strategy: when demo mode is active AND the URL matches a demo route pattern,
// we attach a custom adapter to the request that resolves from fixtures.
// All other requests fall through to the default HTTP adapter, so non-demo
// usage of the app remains untouched.

import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import {
  demoFixtures,
  DEMO_PROJECT_ID,
  DEMO_DATASET_ID,
  DEMO_VERSION_ID,
  DEMO_SESSION_ID,
} from "./fixtures";

let demoModeEnabled = false;

/**
 * Tiny mutable state mirroring how a real session would evolve.
 * Pages read responses that change based on prior user actions.
 */
const demoState = {
  datasetUploaded: false,
};

export function setDemoMode(on: boolean) {
  demoModeEnabled = on;
  if (!on) {
    // Reset state when leaving demo mode so a second run starts fresh.
    demoState.datasetUploaded = false;
  }
}

export function isDemoModeEnabled() {
  return demoModeEnabled;
}

/** Tiny URL matcher — we keep this isolated to avoid pulling in a routing lib. */
function urlMatches(url: string | undefined, pattern: RegExp): boolean {
  return !!url && pattern.test(url);
}

interface DemoRoute {
  method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  pattern: RegExp;
  handler: (config: InternalAxiosRequestConfig) => unknown;
}

/**
 * Demo routes. Order matters — first match wins.
 * URLs here are matched against `config.url` which is relative to the axios baseURL.
 */
const routes: DemoRoute[] = [
  {
    method: "POST",
    pattern: /^\/auth\/login\/?$/,
    handler: () => ({
      access_token: "__demo_token__",
      token_type: "bearer",
      role: demoFixtures.me.role,
      status: demoFixtures.me.status,
      user_id: demoFixtures.me.id,
    }),
  },
  {
    method: "GET",
    pattern: /^\/auth\/me\/?$/,
    handler: () => demoFixtures.me,
  },
  {
    method: "GET",
    pattern: /^\/projects\/?$/,
    handler: () => demoFixtures.projectList,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/?$`),
    handler: () => demoFixtures.project,
  },
  {
    method: "POST",
    pattern: /^\/projects\/?$/,
    handler: () => demoFixtures.project,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/?$`),
    handler: () => (demoState.datasetUploaded ? demoFixtures.datasetList : []),
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/upload/?$`),
    handler: () => {
      demoState.datasetUploaded = true;
      return demoFixtures.dataset;
    },
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/preview`),
    handler: () => demoFixtures.preview,
  },
  {
    method: "DELETE",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/\\d+/?$`),
    handler: () => {
      demoState.datasetUploaded = false;
      return undefined;
    },
  },

  // -- Preparation page endpoints -------------------------------------------
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/versions/?$`),
    handler: () => demoFixtures.versionList,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/versions/${DEMO_VERSION_ID}/prep-config/?$`),
    handler: () => demoFixtures.prepConfig,
  },
  {
    method: "PUT",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/versions/${DEMO_VERSION_ID}/prep-config/?$`),
    handler: () => ({ ok: true }),
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/versions/${DEMO_VERSION_ID}/columns-meta`),
    handler: () => demoFixtures.columnsMeta,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/versions/${DEMO_VERSION_ID}/column-values`),
    handler: () => ({ column: "target", values: ["0", "1"], total: 10 }),
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/versions/${DEMO_VERSION_ID}/column-distribution`),
    handler: () => ({ type: "categorical", total: 10, bars: [{ label: "0", count: 5 }, { label: "1", count: 5 }] }),
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/versions/${DEMO_VERSION_ID}/training-summary`),
    handler: () => ({ rowCount: 10, columnCount: 9 }),
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/database/target/?$`),
    handler: () => demoFixtures.datasetTarget,
  },

  // -- Training page endpoints ----------------------------------------------
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/capabilities/?$`),
    handler: () => demoFixtures.capabilities,
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/profile/?$`),
    handler: () => demoFixtures.profile,
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/recommend/?$`),
    handler: () => demoFixtures.recommendation,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/sessions/?$`),
    handler: () => demoFixtures.trainingSessions,
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/validate/?$`),
    handler: () => ({ valid: true, errors: [], warnings: [] }),
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/versions/[^/]+/sessions/?$`),
    handler: () => demoFixtures.session,
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/automl/?$`),
    handler: () => demoFixtures.session,
  },

  // -- DataExploration / database endpoints ---------------------------------
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/overview`),
    handler: () => demoFixtures.overview,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/profile`),
    handler: () => demoFixtures.profileOut,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/target/?$`),
    handler: () => demoFixtures.datasetTarget,
  },
  {
    method: "PUT",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/target/?$`),
    handler: () => demoFixtures.datasetTarget,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/correlation`),
    handler: () => demoFixtures.correlation,
  },

  // -- Charts endpoints -----------------------------------------------------
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/charts/hist`),
    handler: () => demoFixtures.histogram,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/charts/value-counts`),
    handler: () => demoFixtures.valueCounts,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/charts/aggregate`),
    handler: () => demoFixtures.aggregate,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/charts/sample`),
    handler: () => ({ rows: demoFixtures.preview.rows, total: demoFixtures.preview.rows.length }),
  },

  // -- Nettoyage endpoints --------------------------------------------------
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/nettoyage/operations`),
    handler: () => demoFixtures.operations,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/nettoyage/columns-meta`),
    handler: () => demoFixtures.columnsMeta,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/nettoyage/preview`),
    handler: () => ({
      rows: demoFixtures.preview.rows,
      total: demoFixtures.preview.rows.length,
      page: 1,
      page_size: 25,
      total_pages: 1,
      columns: demoFixtures.overview.columns,
      dtypes: demoFixtures.overview.dtypes,
    }),
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/nettoyage/schema/?$`),
    handler: () => ({ columns: demoFixtures.overview.columns, dtypes: demoFixtures.overview.dtypes, kinds: {} }),
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/nettoyage/alert-config`),
    handler: () => ({ thresholds: {} }),
  },
  // Workspace endpoints (idempotent stubs).
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/versions/[^/]+/workspace/?$`),
    handler: () => ({ workspace_dataset_id: DEMO_DATASET_ID }),
  },
  {
    method: "DELETE",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/versions/[^/]+/workspace/?$`),
    handler: () => ({ ok: true }),
  },
  {
    method: "DELETE",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/nettoyage/workspace/?$`),
    handler: () => ({ ok: true }),
  },
  // Normality test — POST with selected columns. Field names mirror the real
  // backend (snake_case) and include mean/std so the row-detail loader
  // (loadDetail in NormalityTestPanel) can produce Q-Q + histogram overlays.
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/datasets/${DEMO_DATASET_ID}/normality-test`),
    handler: () => ({
      k_tested: 2,
      cols_skipped: [],
      correction_applied: false,
      results: [
        {
          col: "age",
          n: 10,
          test_used: "shapiro",
          stat: 0.962,
          p_raw: 0.81,
          p_adj: 0.81,
          skewness: 0.12,
          excess_kurtosis: -0.4,
          mean: 51.0,
          std: 9.7,
          is_normal: true,
          recommended_transform: "none",
          distribution_shape: "approximately_symmetric",
        },
        {
          col: "cholesterol",
          n: 10,
          test_used: "shapiro",
          stat: 0.948,
          p_raw: 0.64,
          p_adj: 0.64,
          skewness: 0.38,
          excess_kurtosis: -0.1,
          mean: 244.3,
          std: 51.2,
          is_normal: true,
          recommended_transform: "none",
          distribution_shape: "approximately_symmetric",
        },
      ],
    }),
  },

  // -- Training results endpoints ------------------------------------------
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/sessions/${DEMO_SESSION_ID}/?$`),
    handler: () => demoFixtures.session,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/sessions/${DEMO_SESSION_ID}/.*`),
    // Fallback for sub-resources like /download, /export, /models/{id}, etc.
    handler: () => ({}),
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/sessions/${DEMO_SESSION_ID}/models/.*`),
    handler: () => ({ ok: true, isSaved: true }),
  },
  {
    method: "DELETE",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/sessions/${DEMO_SESSION_ID}/models/.*`),
    handler: () => ({ ok: true }),
  },

  // -- Prediction endpoints ------------------------------------------------
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/saved-models/?$`),
    handler: () => demoFixtures.savedModels,
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/active-model/?$`),
    handler: () => demoFixtures.activeModel,
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/predict/?$`),
    handler: () => demoFixtures.predictionResponse,
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/predict/json/?$`),
    handler: () => demoFixtures.predictionResponse,
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/models/[^/]+/predict/?$`),
    handler: () => demoFixtures.predictionResponse,
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/models/[^/]+/predict/json/explain`),
    handler: () => demoFixtures.predictionExplainResponse,
  },
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/models/[^/]+/predict/json/?$`),
    handler: () => demoFixtures.predictionResponse,
  },
  
  {
    method: "POST",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/models/[^/]+/counterfactual`),
    handler: () => ({
      model_id: 1,
      task_type: "classification",
      original_prediction: 1,
      original_score: 0.82,
      counterfactual: [
        { feature: "chest_pain", original_value: 2, suggested_value: 0, delta: -2 },
        { feature: "max_heart_rate", original_value: 160, suggested_value: 180, delta: 20 },
      ],
      message: "Suggested changes to flip the prediction.",
    }),
  },
  {
    method: "GET",
    pattern: new RegExp(`^/projects/${DEMO_PROJECT_ID}/training/models/[^/]+/feature-ranges`),
    handler: () => ({
      ranges: {
        age: { type: "numeric", min: 30, max: 80, mean: 55, std: 12 },
        cholesterol: { type: "numeric", min: 150, max: 400, mean: 240, std: 50 },
      },
    }),
  },
];

/**
 * Catch-all: any URL targeting the demo project that we didn't explicitly
 * mock returns a neutral payload, so child components don't blow up with 404s.
 * Heuristic: plural-looking paths get an empty array, anything else gets null.
 */
function catchAllHandler(config: InternalAxiosRequestConfig): unknown {
  const url = config.url ?? "";
  if (/\/(sessions|datasets|versions|models|operations|columns|features|metrics)\b/.test(url)) {
    return [];
  }
  return null;
}

function isDemoScopedUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith(`/projects/${DEMO_PROJECT_ID}/`) ||
    url === `/projects/${DEMO_PROJECT_ID}` ||
    url.startsWith("/auth/")
  );
}

function findRoute(config: InternalAxiosRequestConfig): DemoRoute | undefined {
  const method = (config.method ?? "GET").toUpperCase() as DemoRoute["method"];
  const explicit = routes.find((r) => r.method === method && urlMatches(config.url, r.pattern));
  if (explicit) return explicit;

  if (isDemoScopedUrl(config.url)) {
    return {
      method,
      pattern: /.*/,
      handler: catchAllHandler,
    };
  }
  return undefined;
}

function makeResponse<T>(config: InternalAxiosRequestConfig, data: T, latencyMs = 350): Promise<AxiosResponse<T>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        data,
        status: 200,
        statusText: "OK (demo)",
        headers: {},
        config,
      } as AxiosResponse<T>);
    }, latencyMs);
  });
}

/**
 * Custom adapter that resolves the request from fixtures. Attached per-request
 * by the interceptor only when a demo route matches.
 */
function demoAdapter(config: InternalAxiosRequestConfig) {
  const route = findRoute(config);
  if (!route) {
    // No fixture matched — return 404 so the page error path is exercised.
    return Promise.reject(
      Object.assign(new Error(`No demo fixture for ${config.method} ${config.url}`), {
        response: {
          data: { detail: "Demo fixture missing" },
          status: 404,
          statusText: "Not Found (demo)",
          headers: {},
          config,
        },
      }),
    );
  }
  const data = route.handler(config);
  return makeResponse(config, data);
}

/**
 * Interceptor entry point — install once on app boot.
 * Returns the modified config; we hijack the adapter when the request is demo-bound.
 */
export function demoRequestInterceptor(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  if (!demoModeEnabled) return config;
  if (!findRoute(config)) return config;
  (config as AxiosRequestConfig).adapter = demoAdapter as AxiosRequestConfig["adapter"];
  return config;
}
