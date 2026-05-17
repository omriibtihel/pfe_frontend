// src/demo/scenes.ts
//
// Declarative scene scripts driving the guided tour. Each scene is a sequence
// of typed steps; the engine executes them in order.
//
// Selectors target `data-tour="..."` attributes added to real page components.
// Radix Tabs panels are reachable via `[role="tabpanel"][data-state="active"]`,
// which lets us spotlight the content of whichever tab is currently selected
// without adding data-tour attributes to every panel.

import { DEMO_PROJECT_ID, DEMO_SESSION_ID, DEMO_VERSION_ID } from "./fixtures";
import type { TourScript } from "./types";

const importRoute = `/demo/projects/${DEMO_PROJECT_ID}/import`;
const exploreRoute = `/demo/projects/${DEMO_PROJECT_ID}/database`;
const chartsRoute = `/demo/projects/${DEMO_PROJECT_ID}/charts`;
const dashboardRoute = `/demo/dashboard`;
const newProjectRoute = `/demo/projects/new`;
const nettoyageRoute = `/demo/projects/${DEMO_PROJECT_ID}/nettoyage`;
const prepRoute = `/demo/projects/${DEMO_PROJECT_ID}/preparation`;
const trainingRoute = `/demo/projects/${DEMO_PROJECT_ID}/versions/${DEMO_VERSION_ID}/training`;
const resultsRoute = `/demo/projects/${DEMO_PROJECT_ID}/versions/${DEMO_VERSION_ID}/training/results?session=${DEMO_SESSION_ID}`;
const predictRoute = `/demo/projects/${DEMO_PROJECT_ID}/predict`;
const predictResultsRoute = `/demo/projects/${DEMO_PROJECT_ID}/predict/results`;

/** Selector for the currently-visible Radix tab panel. */
const ACTIVE_TABPANEL = '[role="tabpanel"][data-state="active"]';

export const tourScript: TourScript = {
  scenes: [
    // ── 1. Dashboard ─────────────────────────────────────────────────────────
    {
      id: "dashboard",
      title: { fr: "Tableau de bord", en: "Dashboard" },
      route: dashboardRoute,
      estimatedMs: 14000,
      steps: [
        { kind: "wait", ms: 1000 },
        { kind: "spotlight", target: '[data-tour="dashboard-hero"]' },
        {
          kind: "narrate",
          text: {
            fr: "Voici le tableau de bord — vue d'ensemble de vos projets et point de départ du workflow.",
            en: "This is the dashboard — projects overview and entry point of the workflow.",
          },
          anchor: '[data-tour="dashboard-hero"]',
          ms: 2800,
        },
        { kind: "clearSpotlight" },
        { kind: "spotlight", target: '[data-tour="sidebar"]' },
        {
          kind: "narrate",
          text: {
            fr: "Le menu latéral expose tout le pipeline : import → exploration → graphiques → nettoyage → préparation → entraînement → prédiction.",
            en: "The sidebar lists every workflow step: import → exploration → charts → cleaning → preparation → training → prediction.",
          },
          anchor: '[data-tour="sidebar"]',
          ms: 3800,
        },
        { kind: "clearSpotlight" },
        { kind: "spotlight", target: '[data-tour="dashboard-new-project"]' },
        { kind: "moveCursorTo", target: '[data-tour="dashboard-new-project"]', duration: 700 },
        {
          kind: "narrate",
          text: {
            fr: "On commence par créer un nouveau projet.",
            en: "Let's start by creating a new project.",
          },
          anchor: '[data-tour="dashboard-new-project"]',
          ms: 1800,
        },
        { kind: "clickAt", target: '[data-tour="dashboard-new-project"]' },
        { kind: "wait", ms: 800 },
      ],
    },

    // ── 2. New project ───────────────────────────────────────────────────────
    {
      id: "new-project",
      title: { fr: "Création de projet", en: "Project creation" },
      route: newProjectRoute,
      estimatedMs: 16000,
      steps: [
        { kind: "wait", ms: 800 },
        {
          kind: "narrate",
          text: {
            fr: "Formulaire de création — un nom et une description suffisent pour démarrer.",
            en: "Creation form — a name and a description are enough to get started.",
          },
          ms: 2200,
        },
        { kind: "spotlight", target: '[data-tour="new-project-name"]' },
        { kind: "moveCursorTo", target: '[data-tour="new-project-name"]', duration: 600 },
        { kind: "typeInto", target: '[data-tour="new-project-name"]', value: "Cardio Demo", perCharMs: 70 },
        { kind: "clearSpotlight" },
        { kind: "spotlight", target: '[data-tour="new-project-description"]' },
        { kind: "moveCursorTo", target: '[data-tour="new-project-description"]', duration: 600 },
        { kind: "typeInto", target: '[data-tour="new-project-description"]', value: "Prédiction de maladie cardiaque.", perCharMs: 35 },
        { kind: "clearSpotlight" },
        { kind: "spotlight", target: '[data-tour="new-project-submit"]' },
        { kind: "moveCursorTo", target: '[data-tour="new-project-submit"]', duration: 600 },
        {
          kind: "narrate",
          text: {
            fr: "On crée le projet — Mediq nous emmène directement à l'étape suivante : l'import du dataset.",
            en: "Create the project — Mediq takes us straight to the next step: dataset import.",
          },
          anchor: '[data-tour="new-project-submit"]',
          ms: 2400,
        },
        { kind: "clickAt", target: '[data-tour="new-project-submit"]' },
        { kind: "wait", ms: 1400 },
      ],
    },

    // ── 3. Import ────────────────────────────────────────────────────────────
    {
      id: "import",
      title: { fr: "Import du dataset", en: "Import dataset" },
      route: importRoute,
      estimatedMs: 22000,
      steps: [
        { kind: "wait", ms: 800 },
        { kind: "spotlight", target: '[data-tour="import-upload"]' },
        {
          kind: "narrate",
          text: {
            fr: "Première étape : importer un dataset médical. CSV ou Excel, jusqu'à 50 Mo.",
            en: "First step: import a medical dataset. CSV or Excel, up to 50 MB.",
          },
          anchor: '[data-tour="import-upload"]',
          ms: 2400,
        },
        { kind: "moveCursorTo", target: '[data-tour="import-upload"]', duration: 900 },
        { kind: "uploadDemoFile", target: "input#file-upload", fixtureId: "cardio-csv" },
        { kind: "wait", ms: 1200 },
        { kind: "clearSpotlight" },
        { kind: "spotlight", target: '[data-tour="import-preview"]' },
        {
          kind: "narrate",
          text: {
            fr: "Le schéma est détecté automatiquement et un aperçu apparaît.",
            en: "The schema is auto-detected and a preview appears.",
          },
          anchor: '[data-tour="import-preview"]',
          ms: 2400,
        },
        { kind: "moveCursorTo", target: '[data-tour="import-rows"]', duration: 700 },
        { kind: "typeInto", target: '[data-tour="import-rows"] input', value: "10", perCharMs: 90 },
        { kind: "moveCursorTo", target: '[data-tour="import-preview-btn"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="import-preview-btn"]' },
        { kind: "wait", ms: 700 },
        {
          kind: "narrate",
          text: {
            fr: "Une fois le dataset importé, on passe à l'exploration.",
            en: "Once imported, we move on to exploration.",
          },
          ms: 2000,
        },
      ],
    },

    // ── 2. Data Exploration — walks through all 3 sub-tabs ───────────────────
    {
      id: "exploration",
      title: { fr: "Exploration des données", en: "Data exploration" },
      route: exploreRoute,
      estimatedMs: 30000,
      steps: [
        { kind: "wait", ms: 1000 },
        { kind: "spotlight", target: '[data-tour="explore-header"]' },
        {
          kind: "narrate",
          text: {
            fr: "L'exploration des données : statistiques, qualité, corrélations — tout y est, regroupé en trois onglets.",
            en: "Data exploration: statistics, quality, correlations — everything in three tabs.",
          },
          anchor: '[data-tour="explore-header"]',
          ms: 2800,
        },
        { kind: "clearSpotlight" },

        // Tab 1: Overview
        { kind: "moveCursorTo", target: '[data-tour="explore-tab-overview"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="explore-tab-overview"]' },
        { kind: "wait", ms: 700 },
        { kind: "spotlight", target: ACTIVE_TABPANEL },
        {
          kind: "narrate",
          text: {
            fr: "Aperçu — taille du dataset, types de colonnes, valeurs manquantes et preview des lignes en un coup d'œil.",
            en: "Overview — dataset size, column types, missing values, and a row preview at a glance.",
          },
          ms: 3400,
        },
        { kind: "clearSpotlight" },

        // Tab 2: Columns
        { kind: "moveCursorTo", target: '[data-tour="explore-tab-columns"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="explore-tab-columns"]' },
        { kind: "wait", ms: 900 },
        { kind: "spotlight", target: ACTIVE_TABPANEL },
        {
          kind: "narrate",
          text: {
            fr: "Colonnes — chaque ligne est cliquable pour voir le profil détaillé.",
            en: "Columns — each row is clickable to inspect its profile.",
          },
          ms: 2400,
        },
        // Click on a column row to expand its details
        { kind: "moveCursorTo", target: '[data-tour="explore-col-row-age"]', duration: 600 },
        { kind: "clickAt", target: '[data-tour="explore-col-row-age"]' },
        { kind: "wait", ms: 1000 },
        {
          kind: "narrate",
          text: {
            fr: "On clique sur la colonne « age » — distribution, quartiles, min/max, valeurs uniques et alertes qualité.",
            en: "We click the \"age\" column — distribution, quartiles, min/max, unique values and quality alerts.",
          },
          ms: 3200,
        },
        { kind: "clearSpotlight" },

        // Tab 3: Analysis
        { kind: "moveCursorTo", target: '[data-tour="explore-tab-analysis"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="explore-tab-analysis"]' },
        { kind: "wait", ms: 900 },
        { kind: "spotlight", target: ACTIVE_TABPANEL },
        {
          kind: "narrate",
          text: {
            fr: "Analyse — matrice de corrélation et insights statistiques pour orienter la modélisation.",
            en: "Analysis — correlation matrix and statistical insights to guide modeling.",
          },
          ms: 3400,
        },
      ],
    },

    // ── 3. Charts — walks through both sub-tabs ──────────────────────────────
    {
      id: "charts",
      title: { fr: "Graphiques", en: "Charts" },
      route: chartsRoute,
      estimatedMs: 20000,
      steps: [
        { kind: "wait", ms: 1000 },
        { kind: "spotlight", target: '[data-tour="charts-hero"]' },
        {
          kind: "narrate",
          text: {
            fr: "Page Graphiques : visualisez histogrammes, comptages, agrégations, scatter, pie charts…",
            en: "Charts page: visualize histograms, counts, aggregations, scatter and pie charts…",
          },
          anchor: '[data-tour="charts-hero"]',
          ms: 2800,
        },
        { kind: "clearSpotlight" },

        // Charts tab (active by default) — cycle through 3 chart types
        { kind: "moveCursorTo", target: '[data-tour="charts-tab-charts"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="charts-tab-charts"]' },
        { kind: "wait", ms: 800 },
        { kind: "spotlight", target: ACTIVE_TABPANEL },
        {
          kind: "narrate",
          text: {
            fr: "Plusieurs types de graphiques selon la nature des variables. Essayons-en quelques-uns.",
            en: "Several chart types depending on variable nature. Let's try a few.",
          },
          ms: 2200,
        },

        // 1) Histogram
        { kind: "moveCursorTo", target: '[data-tour="charts-kind-hist"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="charts-kind-hist"]' },
        { kind: "wait", ms: 1100 },
        {
          kind: "narrate",
          text: {
            fr: "Histogramme — distribution d'une variable numérique.",
            en: "Histogram — distribution of a numeric variable.",
          },
          ms: 2200,
        },

        // 2) Bar (aggregate)
        { kind: "moveCursorTo", target: '[data-tour="charts-kind-bar"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="charts-kind-bar"]' },
        { kind: "wait", ms: 1100 },
        {
          kind: "narrate",
          text: {
            fr: "Barres — comptages ou agrégations par catégorie.",
            en: "Bars — counts or aggregates per category.",
          },
          ms: 2200,
        },

        // 3) Pie
        { kind: "moveCursorTo", target: '[data-tour="charts-kind-pie"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="charts-kind-pie"]' },
        { kind: "wait", ms: 1100 },
        {
          kind: "narrate",
          text: {
            fr: "Camembert — répartition proportionnelle d'une variable catégorielle.",
            en: "Pie — proportional split of a categorical variable.",
          },
          ms: 2400,
        },
        { kind: "clearSpotlight" },

        // Normality tab — full visual flow: pick columns + run test + show results
        { kind: "moveCursorTo", target: '[data-tour="charts-tab-normality"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="charts-tab-normality"]' },
        { kind: "wait", ms: 900 },
        { kind: "spotlight", target: ACTIVE_TABPANEL },
        {
          kind: "narrate",
          text: {
            fr: "L'onglet Normalité teste la distribution gaussienne — Shapiro, D'Agostino, Anderson.",
            en: "The Normality tab tests Gaussian distribution — Shapiro, D'Agostino, Anderson.",
          },
          ms: 2600,
        },
        { kind: "clearSpotlight" },
        {
          kind: "narrate",
          text: {
            fr: "Mediq a pré-sélectionné deux colonnes numériques — il ne reste qu'à lancer le test.",
            en: "Mediq pre-selected two numeric columns — just hit Run.",
          },
          ms: 2400,
        },
        // Click Run directly — columns are auto-selected in demo mode by the
        // panel's demo-aware effect (see NormalityTestPanel).
        { kind: "moveCursorTo", target: '[data-tour="normality-run"]', duration: 600 },
        { kind: "clickAt", target: '[data-tour="normality-run"]' },
        { kind: "wait", ms: 1400 },
        { kind: "spotlight", target: ACTIVE_TABPANEL },
        {
          kind: "narrate",
          text: {
            fr: "Résultats : statistique du test, p-value, skewness, et verdict normalité pour chaque colonne.",
            en: "Results: test statistic, p-value, skewness, and normality verdict for each column.",
          },
          ms: 2800,
        },
        { kind: "clearSpotlight" },
        // Click the first result row to expand the Q-Q plot + histogram overlay
        { kind: "moveCursorTo", target: '[data-tour="normality-result-row-age"]', duration: 600 },
        { kind: "clickAt", target: '[data-tour="normality-result-row-age"]' },
        { kind: "wait", ms: 1400 },
        { kind: "spotlight", target: ACTIVE_TABPANEL },
        {
          kind: "narrate",
          text: {
            fr: "On clique sur la ligne d'« age » — Q-Q plot et histogramme avec courbe normale superposée pour visualiser la distribution.",
            en: "Click on the \"age\" row — Q-Q plot and histogram with overlaid normal curve to visualize the distribution.",
          },
          ms: 3600,
        },
      ],
    },

    // ── 4. Nettoyage ─────────────────────────────────────────────────────────
    {
      id: "nettoyage",
      title: { fr: "Nettoyage", en: "Cleaning" },
      route: nettoyageRoute,
      estimatedMs: 22000,
      steps: [
        // Longer initial wait — Nettoyage loads schema + workspace + ops + preview in parallel.
        { kind: "wait", ms: 1800 },
        { kind: "spotlight", target: '[data-tour="nettoyage-hero"]' },
        {
          kind: "narrate",
          text: {
            fr: "Le module Nettoyage : appliquez des opérations sur les données — imputation, normalisation, encodage, filtrage.",
            en: "The Cleaning module: apply operations on the data — imputation, scaling, encoding, filtering.",
          },
          anchor: '[data-tour="nettoyage-hero"]',
          ms: 2800,
        },
        { kind: "clearSpotlight" },
        // Wait once more so the preview table has fully hydrated before spotlight.
        { kind: "wait", ms: 900 },
        { kind: "spotlight", target: '[data-tour="nettoyage-grid"]' },
        {
          kind: "narrate",
          text: {
            fr: "À gauche : aperçu paginé du dataset avec recherche et tri par colonne.",
            en: "Left side: paginated dataset preview with column search and sort.",
          },
          anchor: '[data-tour="nettoyage-grid"]',
          ms: 3200,
        },
        {
          kind: "narrate",
          text: {
            fr: "À droite : historique des opérations — chaque action tracée, annulable, et on peut sauvegarder une nouvelle version du dataset.",
            en: "Right side: operations timeline — every action tracked, undoable, can save a new dataset version.",
          },
          anchor: '[data-tour="nettoyage-grid"]',
          ms: 3800,
        },
      ],
    },

    // ── 5. Preparation — walks through 4 sub-tabs with content highlight ─────
    {
      id: "preparation",
      title: { fr: "Préparation", en: "Preparation" },
      route: prepRoute,
      estimatedMs: 30000,
      steps: [
        { kind: "wait", ms: 800 },
        {
          kind: "narrate",
          text: {
            fr: "Préparation : quatre étapes pour configurer l'entraînement à partir d'une version nettoyée.",
            en: "Preparation: four steps to configure training from a cleaned version.",
          },
          ms: 2200,
        },
        { kind: "spotlight", target: '[data-tour="prep-tabs"]' },
        { kind: "wait", ms: 500 },
        { kind: "clearSpotlight" },

        // 1. Split
        { kind: "moveCursorTo", target: '[data-tour="prep-tab-split"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="prep-tab-split"]' },
        { kind: "wait", ms: 700 },
        { kind: "spotlight", target: ACTIVE_TABPANEL },
        {
          kind: "narrate",
          text: {
            fr: "1. Split — choisissez la stratégie de découpe : Holdout (train/val/test) ou K-Fold pour la validation croisée.",
            en: "1. Split — pick the split strategy: Holdout (train/val/test) or K-Fold cross-validation.",
          },
          ms: 3400,
        },
        { kind: "clearSpotlight" },

        // 2. Columns
        { kind: "moveCursorTo", target: '[data-tour="prep-tab-columns"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="prep-tab-columns"]' },
        { kind: "wait", ms: 800 },
        { kind: "spotlight", target: ACTIVE_TABPANEL },
        {
          kind: "narrate",
          text: {
            fr: "2. Colonnes — pour chaque variable, ajustez le type, l'imputation, l'encodage et la normalisation.",
            en: "2. Columns — per variable, tune the type, imputation, encoding and scaling.",
          },
          ms: 3400,
        },
        { kind: "clearSpotlight" },

        // 3. Balancing
        { kind: "moveCursorTo", target: '[data-tour="prep-tab-balancing"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="prep-tab-balancing"]' },
        { kind: "wait", ms: 800 },
        { kind: "spotlight", target: ACTIVE_TABPANEL },
        {
          kind: "narrate",
          text: {
            fr: "3. Rééquilibrage — analysez la distribution des classes et appliquez SMOTE, class_weight ou undersampling.",
            en: "3. Balancing — analyze class distribution and apply SMOTE, class_weight or undersampling.",
          },
          ms: 3400,
        },
        { kind: "clearSpotlight" },

        // 4. Features
        { kind: "moveCursorTo", target: '[data-tour="prep-tab-features"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="prep-tab-features"]' },
        { kind: "wait", ms: 800 },
        { kind: "spotlight", target: ACTIVE_TABPANEL },
        {
          kind: "narrate",
          text: {
            fr: "4. Feature engineering — créez de nouvelles colonnes avec des expressions Python (log, ratios, interactions…).",
            en: "4. Feature engineering — derive new columns with Python expressions (log, ratios, interactions…).",
          },
          ms: 3400,
        },
        { kind: "clearSpotlight" },

        { kind: "spotlight", target: '[data-tour="prep-save"]' },
        { kind: "moveCursorTo", target: '[data-tour="prep-save"]', duration: 500 },
        {
          kind: "narrate",
          text: {
            fr: "Sauvegardez la config — direction l'entraînement.",
            en: "Save the config — onward to training.",
          },
          anchor: '[data-tour="prep-save"]',
          ms: 2000,
        },
      ],
    },

    // ── 6. Training — wizard + 4 steps walkthrough ───────────────────────────
    {
      id: "training",
      title: { fr: "Entraînement", en: "Training" },
      route: trainingRoute,
      estimatedMs: 52000,
      steps: [
        { kind: "wait", ms: 1600 },
        {
          kind: "narrate",
          text: {
            fr: "Studio d'entraînement — wizard de 4 étapes : dataset, modèles, métriques, lancement.",
            en: "Training Studio — a 4-step wizard: dataset, models, metrics, launch.",
          },
          ms: 2400,
        },
        // ── Step 0: Dataset & target ──────────────────────────────────────
        { kind: "spotlight", target: '[data-tour="train-step-content"]' },
        {
          kind: "narrate",
          text: {
            fr: "Étape 1 — Dataset & cible : choisissez la version du dataset et la colonne à prédire.",
            en: "Step 1 — Dataset & target: pick the dataset version and the column to predict.",
          },
          ms: 2800,
        },
        { kind: "clearSpotlight" },

        // Spotlight the target card — Step1 now auto-fills it from version metadata.
        { kind: "spotlight", target: '[data-tour="train-step1-target"]' },
        { kind: "moveCursorTo", target: '[data-tour="train-step1-target-trigger"]', duration: 700 },
        {
          kind: "narrate",
          text: {
            fr: "La colonne cible est « target » — la variable à prédire (présence de maladie cardiaque). Mediq la pré-remplit depuis les métadonnées du dataset.",
            en: "The target column is \"target\" — the variable to predict (heart-disease presence). Mediq pre-fills it from the dataset metadata.",
          },
          anchor: '[data-tour="train-step1-target"]',
          ms: 3200,
        },
        { kind: "clearSpotlight" },

        { kind: "spotlight", target: '[data-tour="train-next-btn"]' },
        { kind: "moveCursorTo", target: '[data-tour="train-next-btn"]', duration: 600 },
        {
          kind: "narrate",
          text: {
            fr: "Avant de remplir les étapes, choisissez le mode d'entraînement.",
            en: "Before filling the steps, pick a training mode.",
          },
          anchor: '[data-tour="train-next-btn"]',
          ms: 2200,
        },
        { kind: "clickAt", target: '[data-tour="train-next-btn"]' },
        { kind: "wait", ms: 900 },
        { kind: "clearSpotlight" },

        // Mode dialog
        { kind: "spotlight", target: '[data-tour="train-mode-automl"]' },
        { kind: "moveCursorTo", target: '[data-tour="train-mode-automl"]', duration: 700 },
        {
          kind: "narrate",
          text: {
            fr: "Mode intelligent : Mediq analyse vos données et recommande la meilleure configuration en un clic.",
            en: "Intelligent mode: Mediq analyzes your data and recommends the best configuration in one click.",
          },
          anchor: '[data-tour="train-mode-automl"]',
          ms: 3000,
        },
        { kind: "clearSpotlight" },
        { kind: "spotlight", target: '[data-tour="train-mode-manual"]' },
        { kind: "moveCursorTo", target: '[data-tour="train-mode-manual"]', duration: 600 },
        {
          kind: "narrate",
          text: {
            fr: "Mode manuel : vous gardez le contrôle total — choix des modèles, hyperparamètres, métriques.",
            en: "Manual mode: you keep full control — models, hyperparameters, metrics.",
          },
          anchor: '[data-tour="train-mode-manual"]',
          ms: 2800,
        },

        // Pick manual to walk through the wizard. handleManual auto-completes
        // step 0 and jumps to step 1 (Models).
        { kind: "clickAt", target: '[data-tour="train-mode-manual"]' },
        { kind: "wait", ms: 1200 },
        { kind: "clearSpotlight" },

        // ── Step 1: Models ────────────────────────────────────────────────
        { kind: "spotlight", target: '[data-tour="train-step-content"]' },
        {
          kind: "narrate",
          text: {
            fr: "Étape 2 — Modèles : choisissez parmi Random Forest, Logistic Regression, XGBoost, SVM…",
            en: "Step 2 — Models: pick from Random Forest, Logistic Regression, XGBoost, SVM…",
          },
          ms: 2800,
        },
        // Select Random Forest to unlock Next
        { kind: "moveCursorTo", target: '[data-tour="train-model-randomforest"]', duration: 700 },
        { kind: "clickAt", target: '[data-tour="train-model-randomforest"]' },
        { kind: "wait", ms: 500 },
        {
          kind: "narrate",
          text: {
            fr: "Random Forest — robuste, rapide, gère bien les données tabulaires hétérogènes.",
            en: "Random Forest — robust, fast, handles heterogeneous tabular data well.",
          },
          anchor: '[data-tour="train-model-randomforest"]',
          ms: 2400,
        },
        // Pick a second model for richness
        { kind: "moveCursorTo", target: '[data-tour="train-model-logisticregression"]', duration: 700 },
        { kind: "clickAt", target: '[data-tour="train-model-logisticregression"]' },
        { kind: "wait", ms: 500 },
        {
          kind: "narrate",
          text: {
            fr: "On ajoute aussi Logistic Regression pour comparer un baseline linéaire à un modèle non-linéaire.",
            en: "We also add Logistic Regression to compare a linear baseline with a non-linear model.",
          },
          anchor: '[data-tour="train-model-logisticregression"]',
          ms: 2600,
        },
        // Advance to step 2 (Metrics)
        { kind: "moveCursorTo", target: '[data-tour="train-next-btn"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="train-next-btn"]' },
        { kind: "wait", ms: 1100 },
        { kind: "clearSpotlight" },

        // ── Step 2: Metrics ───────────────────────────────────────────────
        { kind: "spotlight", target: '[data-tour="train-step-content"]' },
        {
          kind: "narrate",
          text: {
            fr: "Étape 3 — Métriques : Accuracy, F1, ROC-AUC, PR-AUC, matrice de confusion. Les essentielles sont pré-cochées.",
            en: "Step 3 — Metrics: Accuracy, F1, ROC-AUC, PR-AUC, confusion matrix. Essentials are pre-checked.",
          },
          ms: 3000,
        },
        // Advance to step 3 (Launch)
        { kind: "moveCursorTo", target: '[data-tour="train-next-btn"]', duration: 500 },
        { kind: "clickAt", target: '[data-tour="train-next-btn"]' },
        { kind: "wait", ms: 1000 },
        { kind: "clearSpotlight" },

        // ── Step 3: Launch ────────────────────────────────────────────────
        { kind: "spotlight", target: '[data-tour="train-step-content"]' },
        {
          kind: "narrate",
          text: {
            fr: "Étape 4 — Récapitulatif : tous les paramètres sont validés avant lancement.",
            en: "Step 4 — Summary: every parameter is validated before launch.",
          },
          ms: 2800,
        },
        { kind: "clearSpotlight" },
        { kind: "spotlight", target: '[data-tour="train-launch-btn"]' },
        { kind: "moveCursorTo", target: '[data-tour="train-launch-btn"]', duration: 700 },
        {
          kind: "narrate",
          text: {
            fr: "Cliquez sur « Lancer l'entraînement » — Mediq démarre la pipeline en arrière-plan.",
            en: "Click \"Launch training\" — Mediq starts the pipeline in the background.",
          },
          anchor: '[data-tour="train-launch-btn"]',
          ms: 2400,
        },
        { kind: "clickAt", target: '[data-tour="train-launch-btn"]' },
        { kind: "wait", ms: 1800 },
        {
          kind: "narrate",
          text: {
            fr: "Entraînement lancé. Place aux résultats détaillés.",
            en: "Training launched. Now to the detailed results.",
          },
          ms: 2200,
        },
      ],
    },

    // ── 7. Training Results ──────────────────────────────────────────────────
    {
      id: "results",
      title: { fr: "Résultats & rapport", en: "Results & report" },
      route: resultsRoute,
      estimatedMs: 24000,
      steps: [
        { kind: "wait", ms: 1400 },
        { kind: "spotlight", target: '[data-tour="results-header"]' },
        {
          kind: "narrate",
          text: {
            fr: "Une fois l'entraînement terminé, vous accédez aux résultats détaillés. L'entête affiche le statut, la durée et permet de télécharger le rapport PDF ou JSON.",
            en: "Once training is done, you reach the detailed results. The header shows status, duration, and PDF/JSON report exports.",
          },
          anchor: '[data-tour="results-header"]',
          ms: 3600,
        },
        { kind: "clearSpotlight" },

        { kind: "spotlight", target: '[data-tour="results-overview"]' },
        {
          kind: "narrate",
          text: {
            fr: "Vue d'ensemble — le meilleur modèle est mis en avant avec ses métriques clés (Accuracy, F1, ROC-AUC).",
            en: "Overview — the best model is highlighted with its key metrics (Accuracy, F1, ROC-AUC).",
          },
          anchor: '[data-tour="results-overview"]',
          ms: 3400,
        },
        { kind: "clearSpotlight" },

        { kind: "spotlight", target: '[data-tour="results-comparison"]' },
        {
          kind: "narrate",
          text: {
            fr: "Tableau comparatif — toutes les métriques côte à côte pour comparer les modèles.",
            en: "Comparison table — all metrics side by side to compare models.",
          },
          anchor: '[data-tour="results-comparison"]',
          ms: 3200,
        },
        { kind: "clearSpotlight" },

        { kind: "spotlight", target: '[data-tour="results-details"]' },
        {
          kind: "narrate",
          text: {
            fr: "Détails par modèle — matrice de confusion, courbes ROC/PR, importance des features, SHAP, et bouton de sauvegarde pour activer un modèle en production.",
            en: "Per-model details — confusion matrix, ROC/PR curves, feature importance, SHAP, and a Save button to activate a model for production.",
          },
          anchor: '[data-tour="results-details"]',
          ms: 4000,
        },
      ],
    },

    // ── 8. Prediction ────────────────────────────────────────────────────────
    {
      id: "prediction",
      title: { fr: "Prédiction", en: "Prediction" },
      route: predictRoute,
      estimatedMs: 18000,
      steps: [
        { kind: "wait", ms: 1200 },
        { kind: "spotlight", target: '[data-tour="predict-header"]' },
        {
          kind: "narrate",
          text: {
            fr: "Page Prédiction — utilisez le modèle sauvegardé pour inférer sur de nouvelles données.",
            en: "Prediction page — use the saved model to infer on new data.",
          },
          anchor: '[data-tour="predict-header"]',
          ms: 2800,
        },
        { kind: "clearSpotlight" },

        { kind: "spotlight", target: '[data-tour="predict-mode-manual"]' },
        { kind: "moveCursorTo", target: '[data-tour="predict-mode-manual"]', duration: 600 },
        {
          kind: "narrate",
          text: {
            fr: "Mode manuel — saisissez les valeurs des features dans un formulaire pour une prédiction unique.",
            en: "Manual mode — fill feature values in a form for a single prediction.",
          },
          anchor: '[data-tour="predict-mode-manual"]',
          ms: 3000,
        },
        { kind: "clearSpotlight" },

        { kind: "spotlight", target: '[data-tour="predict-mode-file"]' },
        { kind: "moveCursorTo", target: '[data-tour="predict-mode-file"]', duration: 600 },
        {
          kind: "narrate",
          text: {
            fr: "Mode fichier — chargez un CSV pour prédire sur des centaines de lignes d'un coup.",
            en: "File mode — upload a CSV to predict on hundreds of rows at once.",
          },
          anchor: '[data-tour="predict-mode-file"]',
          ms: 2800,
        },
        { kind: "clearSpotlight" },

        { kind: "spotlight", target: '[data-tour="predict-launch"]' },
        { kind: "moveCursorTo", target: '[data-tour="predict-launch"]', duration: 500 },
        {
          kind: "narrate",
          text: {
            fr: "Cliquez sur Prédire pour lancer l'inférence — résultats affichés sur la page suivante.",
            en: "Click Predict to run inference — results show on the next page.",
          },
          anchor: '[data-tour="predict-launch"]',
          ms: 2200,
        },
      ],
    },

    // ── 9. Prediction Results ────────────────────────────────────────────────
    {
      id: "prediction-results",
      title: { fr: "Résultats de prédiction", en: "Prediction results" },
      route: predictResultsRoute,
      estimatedMs: 14000,
      steps: [
        { kind: "wait", ms: 1400 },
        {
          kind: "narrate",
          text: {
            fr: "Voici la prédiction — la classe prédite, son score de confiance et l'importance des features pour cette décision.",
            en: "Here's the prediction — predicted class, confidence score and per-feature importance for this decision.",
          },
          ms: 3600,
        },
        {
          kind: "narrate",
          text: {
            fr: "Vous pouvez exporter les résultats en PDF ou CSV, et activer SHAP pour une explication détaillée.",
            en: "You can export results as PDF or CSV, and enable SHAP for a detailed explanation.",
          },
          ms: 3200,
        },
        {
          kind: "narrate",
          text: {
            fr: "C'est la fin du tour Mediq — vous avez vu tout le workflow, de l'import des données à la prédiction.",
            en: "That's the end of the Mediq tour — you've seen the whole workflow, from data import to prediction.",
          },
          ms: 4000,
        },
      ],
    },
  ],
};

export default tourScript;
